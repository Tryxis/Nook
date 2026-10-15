using System.Security.Cryptography;
using BookNook.Core.Entities;
using BookNook.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Api.Admin;

/// <summary>
/// One-off maintenance commands, run instead of the web server:
///   dotnet run --project backend/BookNook.Api -- reset-password someone@example.com
///   dotnet run --project backend/BookNook.Api -- delete-user someone@example.com
///   dotnet run --project backend/BookNook.Api -- delete-guests
/// They use the same configuration (connection string) as the app, so pointing at Neon from your
/// machine affects the live database.
/// </summary>
public static class AdminCommands
{
    public static bool IsCommand(string[] args) => args.Length > 0 && args[0] is "reset-password" or "delete-user" or "delete-guests";

    public static async Task<int> RunAsync(WebApplication app, string[] args)
    {
        using var scope = app.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        switch (args[0])
        {
            case "reset-password" when args.Length == 2:
                return await ResetPasswordAsync(users, args[1]);
            case "delete-user" when args.Length == 2:
                return await DeleteUserAsync(users, args[1]);
            case "delete-guests" when args.Length == 1:
                return await DeleteGuestsAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>());
            default:
                Console.Error.WriteLine("Usage: reset-password <email> | delete-user <email> | delete-guests");
                return 2;
        }
    }

    private static async Task<int> ResetPasswordAsync(UserManager<AppUser> users, string email)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || user.IsGuest)
        {
            Console.Error.WriteLine($"No account found for {email}.");
            return 1;
        }

        var temporary = GeneratePassword();
        // Remove + add rather than a reset token: no email/token provider is configured.
        // Both rotate the security stamp, which signs the user out of their other sessions.
        if (await users.HasPasswordAsync(user))
        {
            var removed = await users.RemovePasswordAsync(user);
            if (!removed.Succeeded) return Fail(removed);
        }
        var added = await users.AddPasswordAsync(user, temporary);
        if (!added.Succeeded) return Fail(added);

        // Clear any lockout from failed attempts so the new password works straight away.
        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);

        Console.WriteLine($"Password reset for {user.Email} ({user.DisplayName}).");
        Console.WriteLine($"Temporary password: {temporary}");
        Console.WriteLine("Send it to them privately and ask them to change it in Settings → Password.");
        return 0;
    }

    /// <summary>Deletes an account and everything in it (library, reviews, shelves) via cascades.</summary>
    private static async Task<int> DeleteUserAsync(UserManager<AppUser> users, string email)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null)
        {
            Console.Error.WriteLine($"No account found for {email}.");
            return 1;
        }
        var result = await users.DeleteAsync(user);
        if (!result.Succeeded) return Fail(result);
        Console.WriteLine($"Deleted {user.Email} ({user.DisplayName}) and all of their data.");
        return 0;
    }

    /// <summary>Deletes every guest account now, rather than waiting for the 24-hour cleanup.</summary>
    private static async Task<int> DeleteGuestsAsync(AppDbContext db)
    {
        var deleted = await db.Users.Where(u => u.IsGuest).ExecuteDeleteAsync();
        Console.WriteLine($"Deleted {deleted} guest account(s).");
        return 0;
    }

    private static int Fail(IdentityResult result)
    {
        Console.Error.WriteLine(string.Join("; ", result.Errors.Select(e => e.Description)));
        return 1;
    }

    /// <summary>16 characters from an unambiguous alphabet (no 0/O, 1/l/I), with at least one digit.</summary>
    private static string GeneratePassword()
    {
        const string letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
        const string digits = "23456789";
        var chars = new char[16];
        for (var i = 0; i < chars.Length; i++)
        {
            var pool = i % 4 == 3 ? digits : letters;
            chars[i] = pool[RandomNumberGenerator.GetInt32(pool.Length)];
        }
        return new string(chars);
    }
}
