using BookNook.Api.Contracts;
using BookNook.Core.Entities;
using BookNook.Core.Rules;
using BookNook.Core.Search;
using BookNook.Infrastructure.Data;
using BookNook.Infrastructure.Search;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Api.Controllers;

public class LibraryController(AppDbContext db, BookSearchService search) : ApiControllerBase
{
    // ---- Entries ----

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserBookSummaryDto>>> List(
        [FromQuery] ReadingStatus? status, [FromQuery] Guid? shelfId, [FromQuery] string? q,
        [FromQuery] string sort = "recent", [FromQuery] bool favorites = false, [FromQuery] BookFormat? format = null,
        CancellationToken ct = default)
    {
        var query = UserBooks().AsNoTracking();
        if (format is { } f && f != BookFormat.None) query = query.Where(ub => (ub.Formats & f) == f);
        if (status is not null) query = query.Where(ub => ub.Status == status);
        if (shelfId is not null) query = query.Where(ub => ub.Shelves.Any(s => s.Id == shelfId));
        if (favorites) query = query.Where(ub => ub.IsFavorite);

        // Per-user libraries are small, so text filtering and sorting happen in memory.
        IEnumerable<UserBook> items = await query.AsSplitQuery().ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            items = items.Where(ub =>
                ub.Book.Title.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                ub.Book.Authors.Any(a => a.Contains(term, StringComparison.OrdinalIgnoreCase)));
        }

        items = sort switch
        {
            "title" => items.OrderBy(ub => ub.Book.Title, StringComparer.OrdinalIgnoreCase),
            "author" => items.OrderBy(ub => ub.Book.Authors.FirstOrDefault() ?? "", StringComparer.OrdinalIgnoreCase),
            "rating" => items.OrderByDescending(ub => ub.Rating ?? -1).ThenBy(ub => ub.Book.Title),
            "finished" => items.OrderByDescending(ub => ub.ReadThroughs.Max(r => r.FinishedOn) ?? DateOnly.MinValue),
            _ => items.OrderByDescending(ub => ub.UpdatedAt),
        };

        return Ok(items.Select(ub => ub.ToSummary()).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserBookDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var ub = await FindAsync(id, ct);
        return ub is null ? NotFound() : ub.ToDetail();
    }

    /// <summary>Which of the given search results are already in the user's library (resultId → entry id).</summary>
    [HttpGet("lookup")]
    public async Task<ActionResult<Dictionary<string, Guid>>> Lookup([FromQuery] string[] resultIds, CancellationToken ct)
    {
        var ol = resultIds.Where(r => r.StartsWith("ol:")).Select(r => r[3..]).ToList();
        var gb = resultIds.Where(r => r.StartsWith("gb:")).Select(r => r[3..]).ToList();

        var owned = await db.UserBooks
            .Where(ub => ub.UserId == UserId)
            .Where(ub => (ub.Book.OpenLibraryId != null && ol.Contains(ub.Book.OpenLibraryId))
                      || (ub.Book.GoogleVolumeId != null && gb.Contains(ub.Book.GoogleVolumeId)))
            .Select(ub => new { ub.Id, ub.Book.OpenLibraryId, ub.Book.GoogleVolumeId })
            .ToListAsync(ct);

        var map = new Dictionary<string, Guid>();
        foreach (var o in owned)
        {
            if (o.OpenLibraryId is not null) map[$"ol:{o.OpenLibraryId}"] = o.Id;
            if (o.GoogleVolumeId is not null) map[$"gb:{o.GoogleVolumeId}"] = o.Id;
        }
        return map;
    }

    [HttpPost]
    public async Task<ActionResult<UserBookDetailDto>> Add(AddToLibraryRequest req, CancellationToken ct)
    {
        if (!Enum.IsDefined(req.Status)) return Invalid("status", "Unknown status.");

        var result = await search.ResolveAsync(req.ResultId, ct);
        if (result is null) return Invalid("resultId", "That book could not be found. Try searching again.");

        var book = await FindOrCreateBookAsync(result, ct);

        var existing = await UserBooks().FirstOrDefaultAsync(ub => ub.BookId == book.Id, ct);
        if (existing is not null) return Ok(existing.ToDetail());

        var ub = new UserBook { UserId = UserId, Book = book, BookId = book.Id, Status = ReadingStatus.WantToRead };
        ReadingStatusRules.ApplyStatusChange(ub, req.Status, Today);
        db.UserBooks.Add(ub);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = ub.Id }, ub.ToDetail());
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserBookDetailDto>> Update(Guid id, UpdateUserBookRequest req, CancellationToken ct)
    {
        if (!Enum.IsDefined(req.Status)) return Invalid("status", "Unknown status.");
        if (req.Formats.Any(f => !BookFormats.All.Contains(f))) return Invalid("formats", "Unknown format.");
        if (req.Rating is { } r && !RatingRules.IsValid(r)) return Invalid("rating", "Rating must be 0.5–5 in half-star steps.");

        var ub = await FindAsync(id, ct);
        if (ub is null) return NotFound();

        ReadingStatusRules.ApplyStatusChange(ub, req.Status, Today);

        var review = string.IsNullOrWhiteSpace(req.Review) ? null : req.Review.Trim();
        if (review != ub.Review)
        {
            ub.Review = review;
            ub.ReviewUpdatedAt = review is null ? null : DateTime.UtcNow;
        }

        ub.Rating = req.Rating;
        ub.Formats = BookFormats.Combine(req.Formats);
        ub.IsFavorite = req.IsFavorite;
        // A status change to Finished sets the page to the end; don't overwrite that with a stale value.
        if (!(req.Status == ReadingStatus.Finished && ub.CurrentPage == ub.Book.PageCount && req.CurrentPage < ub.CurrentPage))
            ub.CurrentPage = req.CurrentPage;
        ub.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    /// <summary>Just the reading position, for quick "I'm on page N" updates.</summary>
    [HttpPut("{id:guid}/progress")]
    public async Task<ActionResult<UserBookDetailDto>> UpdateProgress(Guid id, ProgressRequest req, CancellationToken ct)
    {
        var ub = await FindAsync(id, ct);
        if (ub is null) return NotFound();
        ub.CurrentPage = req.CurrentPage;
        ub.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
    {
        var ub = await FindAsync(id, ct);
        if (ub is null) return NotFound();
        db.UserBooks.Remove(ub);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("{id:guid}/shelves")]
    public async Task<ActionResult<UserBookDetailDto>> SetShelves(Guid id, SetShelvesRequest req, CancellationToken ct)
    {
        var ub = await FindAsync(id, ct);
        if (ub is null) return NotFound();

        var wanted = req.ShelfIds.Distinct().ToList();
        var shelves = await db.Shelves.Where(s => s.UserId == UserId && wanted.Contains(s.Id)).ToListAsync(ct);
        if (shelves.Count != wanted.Count) return Invalid("shelfIds", "One or more shelves don't exist.");

        ub.Shelves.RemoveAll(s => !wanted.Contains(s.Id));
        foreach (var s in shelves.Where(s => ub.Shelves.All(x => x.Id != s.Id))) ub.Shelves.Add(s);
        ub.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    // ---- Read-throughs ----

    [HttpPost("{id:guid}/reads")]
    public async Task<ActionResult<UserBookDetailDto>> AddRead(Guid id, ReadThroughRequest req, CancellationToken ct)
    {
        if (ValidateDates(req) is { } error) return error;
        var ub = await FindAsync(id, ct);
        if (ub is null) return NotFound();

        ub.ReadThroughs.Add(new ReadThrough
        {
            UserBookId = ub.Id, StartedOn = req.StartedOn, FinishedOn = req.FinishedOn, Abandoned = req.Abandoned,
        });
        SyncStatusWithReads(ub);
        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    [HttpPut("{id:guid}/reads/{readId:guid}")]
    public async Task<ActionResult<UserBookDetailDto>> UpdateRead(Guid id, Guid readId, ReadThroughRequest req, CancellationToken ct)
    {
        if (ValidateDates(req) is { } error) return error;
        var ub = await FindAsync(id, ct);
        var read = ub?.ReadThroughs.FirstOrDefault(r => r.Id == readId);
        if (ub is null || read is null) return NotFound();

        read.StartedOn = req.StartedOn;
        read.FinishedOn = req.FinishedOn;
        read.Abandoned = req.Abandoned;
        SyncStatusWithReads(ub);
        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    [HttpDelete("{id:guid}/reads/{readId:guid}")]
    public async Task<ActionResult<UserBookDetailDto>> DeleteRead(Guid id, Guid readId, CancellationToken ct)
    {
        var ub = await FindAsync(id, ct);
        var read = ub?.ReadThroughs.FirstOrDefault(r => r.Id == readId);
        if (ub is null || read is null) return NotFound();

        ub.ReadThroughs.Remove(read);
        db.ReadThroughs.Remove(read);
        ub.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    // ---- Bookmarks ----

    [HttpPost("{id:guid}/bookmarks")]
    public async Task<ActionResult<UserBookDetailDto>> AddBookmark(Guid id, BookmarkRequest req, CancellationToken ct)
    {
        if (req.Page is null && req.Percent is null && string.IsNullOrWhiteSpace(req.Note))
            return Invalid("page", "Add a page, a percentage or a note.");
        var ub = await FindAsync(id, ct);
        if (ub is null) return NotFound();

        ub.Bookmarks.Add(new Bookmark { UserBookId = ub.Id, Page = req.Page, Percent = req.Percent, Note = Clean(req.Note) });
        // Bookmarking further than you've logged moves your progress forward.
        if (req.Page is int page && page > (ub.CurrentPage ?? 0)) ub.CurrentPage = page;
        ub.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    [HttpPut("{id:guid}/bookmarks/{bookmarkId:guid}")]
    public async Task<ActionResult<UserBookDetailDto>> UpdateBookmark(Guid id, Guid bookmarkId, BookmarkRequest req, CancellationToken ct)
    {
        var ub = await FindAsync(id, ct);
        var bm = ub?.Bookmarks.FirstOrDefault(b => b.Id == bookmarkId);
        if (ub is null || bm is null) return NotFound();

        bm.Page = req.Page;
        bm.Percent = req.Percent;
        bm.Note = Clean(req.Note);
        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    [HttpDelete("{id:guid}/bookmarks/{bookmarkId:guid}")]
    public async Task<ActionResult<UserBookDetailDto>> DeleteBookmark(Guid id, Guid bookmarkId, CancellationToken ct)
    {
        var ub = await FindAsync(id, ct);
        var bm = ub?.Bookmarks.FirstOrDefault(b => b.Id == bookmarkId);
        if (ub is null || bm is null) return NotFound();

        ub.Bookmarks.Remove(bm);
        db.Bookmarks.Remove(bm);
        await db.SaveChangesAsync(ct);
        return ub.ToDetail();
    }

    // ---- Helpers ----

    private IQueryable<UserBook> UserBooks() => db.UserBooks
        .Where(ub => ub.UserId == UserId)
        .Include(ub => ub.Book)
        .Include(ub => ub.ReadThroughs)
        .Include(ub => ub.Shelves);

    private Task<UserBook?> FindAsync(Guid id, CancellationToken ct) => UserBooks()
        .Include(ub => ub.Bookmarks)
        .AsSplitQuery()
        .FirstOrDefaultAsync(ub => ub.Id == id, ct);

    private async Task<Book> FindOrCreateBookAsync(BookSearchResult r, CancellationToken ct)
    {
        var book = await db.Books.FirstOrDefaultAsync(b =>
            (r.OpenLibraryId != null && b.OpenLibraryId == r.OpenLibraryId) ||
            (r.GoogleVolumeId != null && b.GoogleVolumeId == r.GoogleVolumeId) ||
            (r.Isbn13 != null && b.Isbn13 == r.Isbn13), ct);

        if (book is null)
        {
            book = new Book { Title = r.Title };
            db.Books.Add(book);
        }

        // Fill gaps on an existing record without overwriting what's there.
        book.Subtitle ??= r.Subtitle;
        if (book.Authors.Count == 0) book.Authors = r.Authors.ToList();
        book.Isbn13 ??= r.Isbn13;
        book.Isbn10 ??= r.Isbn10;
        book.OpenLibraryId ??= r.OpenLibraryId;
        book.GoogleVolumeId ??= r.GoogleVolumeId;
        book.CoverUrl ??= r.CoverUrl;
        book.PageCount ??= r.PageCount;
        book.PublishedYear ??= r.PublishedYear;
        book.Publisher ??= r.Publisher;
        book.Description ??= r.Description;
        if (book.Subjects.Count == 0) book.Subjects = r.Subjects.ToList();

        return book;
    }

    /// <summary>After hand-editing dates, make the status agree with the most recent read.</summary>
    private static void SyncStatusWithReads(UserBook ub)
    {
        ub.UpdatedAt = DateTime.UtcNow;
        var latest = ReadingStatusRules.LatestReadThrough(ub);
        if (latest is null) return;
        ub.Status = latest switch
        {
            { FinishedOn: null } => ReadingStatus.Reading,
            { Abandoned: true } => ReadingStatus.DidNotFinish,
            _ => ReadingStatus.Finished,
        };
    }

    private ActionResult? ValidateDates(ReadThroughRequest req)
    {
        if (req.StartedOn is null && req.FinishedOn is null) return Invalid("startedOn", "Add a start or finish date.");
        if (req.StartedOn > req.FinishedOn) return Invalid("finishedOn", "Finish date can't be before the start date.");
        if (req.StartedOn > Today.AddDays(1) || req.FinishedOn > Today.AddDays(1)) return Invalid("finishedOn", "Dates can't be in the future.");
        return null;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
