namespace BookNook.Core.Entities;

public enum ReadingStatus
{
    WantToRead = 0,
    Reading = 1,
    Finished = 2,
    DidNotFinish = 3,
}

/// <summary>How a book was read. Flags, because people often read and listen to the same book.</summary>
[Flags]
public enum BookFormat
{
    None = 0,
    Print = 1,
    Ebook = 2,
    Audiobook = 4,
}

public static class BookFormats
{
    public static readonly BookFormat[] All = [BookFormat.Print, BookFormat.Ebook, BookFormat.Audiobook];

    /// <summary>The individual formats set in a combined value, in display order.</summary>
    public static IReadOnlyList<BookFormat> Split(this BookFormat formats) =>
        All.Where(f => formats.HasFlag(f)).ToList();

    public static BookFormat Combine(IEnumerable<BookFormat> formats) =>
        formats.Aggregate(BookFormat.None, (acc, f) => acc | f);

    /// <summary>Read (print or e-book) and listened to.</summary>
    public static bool IsReadAndListened(this BookFormat formats) =>
        formats.HasFlag(BookFormat.Audiobook) && (formats & (BookFormat.Print | BookFormat.Ebook)) != 0;
}

/// <summary>One user's relationship with one book: status, rating, review and history.</summary>
public class UserBook
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "";
    public AppUser? User { get; set; }
    public Guid BookId { get; set; }
    public Book Book { get; set; } = null!;

    public ReadingStatus Status { get; set; }
    public BookFormat Formats { get; set; }

    /// <summary>0.5–5.0 in half-star steps. See <see cref="Rules.RatingRules"/>.</summary>
    public decimal? Rating { get; set; }
    public string? Review { get; set; }
    public DateTime? ReviewUpdatedAt { get; set; }
    public bool IsFavorite { get; set; }
    public int? CurrentPage { get; set; }

    /// <summary>This user's preferred cover ("ol:{id}" / "gb:{id}"), overriding the shared book cover.</summary>
    public string? CoverChoice { get; set; }

    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<ReadThrough> ReadThroughs { get; set; } = [];
    public List<Bookmark> Bookmarks { get; set; } = [];
    public List<Shelf> Shelves { get; set; } = [];
}

/// <summary>A single read of a book. Rereads produce additional rows.</summary>
public class ReadThrough
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserBookId { get; set; }
    public DateOnly? StartedOn { get; set; }
    public DateOnly? FinishedOn { get; set; }

    /// <summary>True when this read ended without finishing (DNF).</summary>
    public bool Abandoned { get; set; }
}

public class Bookmark
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserBookId { get; set; }
    public int? Page { get; set; }

    /// <summary>Position as a percentage, for ebooks/audiobooks without stable page numbers.</summary>
    public decimal? Percent { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Shelf
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<UserBook> Books { get; set; } = [];
}
