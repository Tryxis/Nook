using BookNook.Core.Entities;

namespace BookNook.Api.Contracts;

public static class Mapping
{
    /// <summary>Covers are always served through our proxy so the share-image canvas stays exportable.</summary>
    public static string? CoverPath(Book b) => b.CoverUrl is null ? null : $"/api/books/{b.Id}/cover";

    /// <summary>
    /// The cover this user sees: their chosen one, else the book's. The choice is in the query string
    /// so a changed cover isn't served from the browser cache.
    /// </summary>
    public static string? CoverPath(UserBook ub) => ub.CoverChoice is { } c
        ? $"/api/library/{ub.Id}/cover?c={Uri.EscapeDataString(c)}"
        : CoverPath(ub.Book);

    public static BookDto ToDto(this Book b, bool includeDescription = true) => new(
        b.Id, b.Title, b.Subtitle, b.Authors, b.Isbn13, CoverPath(b), b.PageCount, b.PublishedYear, b.Publisher,
        includeDescription ? b.Description : null, b.Subjects);

    public static UserBookSummaryDto ToSummary(this UserBook ub)
    {
        var latest = Core.Rules.ReadingStatusRules.LatestReadThrough(ub);
        return new(
            ub.Id, ub.Book.ToDto(includeDescription: false) with { CoverUrl = CoverPath(ub) }, ub.Status, ub.Formats.Split(), ub.Rating,
            !string.IsNullOrWhiteSpace(ub.Review), ub.IsFavorite, ub.CurrentPage,
            latest?.StartedOn, latest?.FinishedOn,
            ub.Shelves.Select(s => s.Id).ToList(), ub.AddedAt, ub.UpdatedAt);
    }

    public static UserBookDetailDto ToDetail(this UserBook ub) => new(
        ub.Id, ub.Book.ToDto() with { CoverUrl = CoverPath(ub) }, ub.Status, ub.Formats.Split(), ub.Rating, ub.Review, ub.ReviewUpdatedAt, ub.IsFavorite, ub.CurrentPage,
        ub.ReadThroughs
            .OrderBy(r => r.FinishedOn is null ? 0 : 1)
            .ThenByDescending(r => r.StartedOn ?? r.FinishedOn)
            .Select(r => r.ToDto())
            .ToList(),
        ub.Bookmarks
            .OrderByDescending(b => b.Page ?? 0)
            .ThenByDescending(b => b.CreatedAt)
            .Select(b => b.ToDto())
            .ToList(),
        ub.Shelves.OrderBy(s => s.Name).Select(s => new ShelfRefDto(s.Id, s.Name)).ToList(),
        ub.AddedAt, ub.UpdatedAt);

    public static ReadThroughDto ToDto(this ReadThrough r) => new(r.Id, r.StartedOn, r.FinishedOn, r.Abandoned);

    public static BookmarkDto ToDto(this Bookmark b) => new(b.Id, b.Page, b.Percent, b.Note, b.CreatedAt);
}
