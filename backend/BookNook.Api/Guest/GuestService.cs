using BookNook.Core.Entities;
using BookNook.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Api.Guest;

public class GuestService(AppDbContext db, UserManager<AppUser> users, SignInManager<AppUser> signIn)
{
    /// <summary>Guest accounts (and everything in them) are deleted after this long.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    /// <summary>Creates an isolated, pre-filled guest account and signs the caller in as it.</summary>
    public async Task<AppUser> CreateAndSignInAsync(CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString("N");
        var user = new AppUser
        {
            // Not a real mailbox; guests can't sign in with a password, only via this endpoint.
            UserName = $"guest-{id}@guest.nook.invalid",
            Email = $"guest-{id}@guest.nook.invalid",
            DisplayName = "Guest",
            YearlyGoal = 24,
            IsGuest = true,
        };
        var result = await users.CreateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Could not create guest: {string.Join("; ", result.Errors.Select(e => e.Description))}");

        await SeedAsync(user, ct);

        // The cookie dies before the cleanup job removes the account, so a stale guest session
        // never points at a deleted user.
        await signIn.SignInAsync(user, new AuthenticationProperties
        {
            IsPersistent = true,
            ExpiresUtc = DateTimeOffset.UtcNow.Add(Lifetime - TimeSpan.FromHours(1)),
            AllowRefresh = false,
        });
        return user;
    }

    private async Task SeedAsync(AppUser user, CancellationToken ct)
    {
        var books = await EnsureDemoBooksAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly Ago(int days) => today.AddDays(-days);

        var shelves = GuestDemoData.ShelfNames.ToDictionary(
            n => n,
            n => new Shelf { UserId = user.Id, Name = n, Description = n == "Book club" ? "Picks from the second-Thursday book club." : null });
        db.Shelves.AddRange(shelves.Values);

        var now = DateTime.UtcNow;
        var i = 0;
        foreach (var e in GuestDemoData.Entries)
        {
            var book = books[e.Isbn13];
            var ub = new UserBook
            {
                UserId = user.Id,
                BookId = book.Id,
                Status = e.Status,
                Rating = e.Rating,
                Review = e.Review,
                ReviewUpdatedAt = e.Review is null ? null : now.AddDays(-(e.FinishedDaysAgo ?? 0)),
                IsFavorite = e.Favorite,
                Formats = e.Formats,
                CurrentPage = e.Status == ReadingStatus.Finished ? book.PageCount : e.CurrentPage,
                AddedAt = now.AddDays(-(e.StartedDaysAgo ?? 1) - 2),
                // Most recent activity first in "recently updated" lists.
                UpdatedAt = now.AddDays(-(e.FinishedDaysAgo ?? e.StartedDaysAgo ?? 0)).AddMinutes(-i++),
            };

            if (e.EarlierRead is { } earlier)
                ub.ReadThroughs.Add(new ReadThrough { UserBookId = ub.Id, StartedOn = Ago(earlier.StartedDaysAgo), FinishedOn = Ago(earlier.FinishedDaysAgo) });
            if (e.StartedDaysAgo is not null || e.FinishedDaysAgo is not null)
                ub.ReadThroughs.Add(new ReadThrough
                {
                    UserBookId = ub.Id,
                    StartedOn = e.StartedDaysAgo is int s ? Ago(s) : null,
                    FinishedOn = e.FinishedDaysAgo is int f ? Ago(f) : null,
                });

            foreach (var (page, note) in e.Bookmarks ?? [])
                ub.Bookmarks.Add(new Bookmark { UserBookId = ub.Id, Page = page, Note = note, CreatedAt = now.AddDays(-(e.StartedDaysAgo ?? 0) + 1) });

            foreach (var name in e.Shelves ?? [])
                ub.Shelves.Add(shelves[name]);

            db.UserBooks.Add(ub);
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Demo books are shared rows (matched on ISBN, like any other book). Insert any that are
    /// missing; if two guests race to insert the same one, the loser just re-reads it.
    /// </summary>
    private async Task<Dictionary<string, Book>> EnsureDemoBooksAsync(CancellationToken ct)
    {
        var isbns = GuestDemoData.Books.Select(b => b.Isbn13).ToList();
        for (var attempt = 0; ; attempt++)
        {
            var existing = await db.Books.Where(b => b.Isbn13 != null && isbns.Contains(b.Isbn13)).ToDictionaryAsync(b => b.Isbn13!, ct);
            var missing = GuestDemoData.Books.Where(d => !existing.ContainsKey(d.Isbn13)).ToList();
            if (missing.Count == 0) return existing;

            foreach (var d in missing)
            {
                db.Books.Add(new Book
                {
                    Title = d.Title,
                    Authors = [d.Author],
                    Isbn13 = d.Isbn13,
                    CoverUrl = $"https://covers.openlibrary.org/b/isbn/{d.Isbn13}-L.jpg?default=false",
                    PageCount = d.Pages,
                    PublishedYear = d.Year,
                    Subjects = d.Subjects.ToList(),
                    Description = d.Description,
                });
            }

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException) when (attempt < 2)
            {
                db.ChangeTracker.Clear();
            }
        }
    }
}

/// <summary>Hourly sweep that deletes expired guest accounts; their data cascades with them.</summary>
public class GuestCleanupService(IServiceScopeFactory scopes, ILogger<GuestCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var cutoff = DateTime.UtcNow - GuestService.Lifetime;
                var deleted = await db.Users.Where(u => u.IsGuest && u.CreatedAt < cutoff).ExecuteDeleteAsync(stoppingToken);
                if (deleted > 0) logger.LogInformation("Deleted {Count} expired guest accounts", deleted);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Guest cleanup failed; will retry next hour");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
