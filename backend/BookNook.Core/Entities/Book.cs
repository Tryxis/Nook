namespace BookNook.Core.Entities;

/// <summary>
/// Shared bibliographic record. Created the first time any user adds the book and
/// reused for everyone else, matched on external identifiers.
/// </summary>
public class Book
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }
    public List<string> Authors { get; set; } = [];
    public string? Isbn13 { get; set; }
    public string? Isbn10 { get; set; }

    /// <summary>Open Library work id, e.g. "OL45804W".</summary>
    public string? OpenLibraryId { get; set; }
    public string? GoogleVolumeId { get; set; }

    public string? CoverUrl { get; set; }
    public int? PageCount { get; set; }
    public int? PublishedYear { get; set; }
    public string? Publisher { get; set; }
    public string? Description { get; set; }
    public List<string> Subjects { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
