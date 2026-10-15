using Microsoft.AspNetCore.Identity;

namespace BookNook.Core.Entities;

public class AppUser : IdentityUser
{
    public string DisplayName { get; set; } = "";

    /// <summary>Books the user aims to finish per calendar year. Null means no goal set.</summary>
    public int? YearlyGoal { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Throwaway demo account created by "Continue as guest"; deleted after a day.</summary>
    public bool IsGuest { get; set; }

    public List<UserBook> Books { get; set; } = [];
    public List<Shelf> Shelves { get; set; } = [];
}
