using System.Globalization;
using System.Text;
using System.Text.Json.Serialization;

namespace BookNook.Core.Search;

public record BookSearchResult
{
    /// <summary>Stable id used to add the result to a library: "ol:{workId}" or "gb:{volumeId}".</summary>
    public required string Id { get; init; }
    public required string Title { get; init; }
    public string? Subtitle { get; init; }
    public IReadOnlyList<string> Authors { get; init; } = [];
    public string? Isbn13 { get; init; }
    public string? Isbn10 { get; init; }
    public string? OpenLibraryId { get; init; }
    public string? GoogleVolumeId { get; init; }
    public string? CoverUrl { get; init; }
    public int? PageCount { get; init; }
    public int? PublishedYear { get; init; }
    public string? Publisher { get; init; }
    public string? Description { get; init; }
    public IReadOnlyList<string> Subjects { get; init; } = [];

    /// <summary>Every ISBN the provider knows for this work; used only for cross-provider matching.</summary>
    [JsonIgnore]
    public IReadOnlyList<string> AllIsbns { get; init; } = [];
}

public interface IBookSearchProvider
{
    string Prefix { get; }
    Task<IReadOnlyList<BookSearchResult>> SearchAsync(string query, int limit, CancellationToken ct);
    Task<BookSearchResult?> GetAsync(string providerId, CancellationToken ct);
}

public static class SearchResultMerger
{
    /// <summary>
    /// Open Library results come first; each is enriched with whatever it is missing from a
    /// matching Google Books result. Unmatched Google results are appended afterwards.
    /// </summary>
    public static List<BookSearchResult> Merge(IReadOnlyList<BookSearchResult> primary, IReadOnlyList<BookSearchResult> secondary)
    {
        var unused = secondary.ToList();
        var merged = new List<BookSearchResult>(primary.Count + secondary.Count);

        foreach (var p in primary)
        {
            var match = unused.FirstOrDefault(s => IsSameBook(p, s));
            if (match is not null)
            {
                unused.Remove(match);
                merged.Add(Enrich(p, match, preferSecondaryCover: IsSameEdition(p, match)));
            }
            else
            {
                merged.Add(p);
            }
        }

        foreach (var s in unused)
        {
            // A Google result can still duplicate an already-merged Open Library one.
            if (!merged.Any(m => IsSameBook(m, s))) merged.Add(s);
        }

        // Stable sort: results with a cover and an author first (summaries/study guides rarely have
        // both), otherwise keeping each provider's relevance order.
        return merged
            .Select((r, i) => (r, i))
            .OrderBy(x => x.r.CoverUrl is not null && x.r.Authors.Count > 0 ? 0 : 1)
            .ThenBy(x => x.i)
            .Select(x => x.r)
            .ToList();
    }

    /// <param name="preferSecondaryCover">
    /// Use the secondary (Google) cover even when the primary has one. Google covers are publisher
    /// artwork at ~800px, where Open Library's are often photos of physical copies, so prefer them
    /// whenever we're confident it's the same edition.
    /// </param>
    public static BookSearchResult Enrich(BookSearchResult p, BookSearchResult s, bool preferSecondaryCover = false) => p with
    {
        Subtitle = p.Subtitle ?? s.Subtitle,
        Authors = p.Authors.Count > 0 ? p.Authors : s.Authors,
        Isbn13 = p.Isbn13 ?? s.Isbn13,
        Isbn10 = p.Isbn10 ?? s.Isbn10,
        GoogleVolumeId = p.GoogleVolumeId ?? s.GoogleVolumeId,
        OpenLibraryId = p.OpenLibraryId ?? s.OpenLibraryId,
        CoverUrl = preferSecondaryCover && s.CoverUrl is not null ? s.CoverUrl : p.CoverUrl ?? s.CoverUrl,
        PageCount = p.PageCount ?? s.PageCount,
        PublishedYear = p.PublishedYear ?? s.PublishedYear,
        Publisher = p.Publisher ?? s.Publisher,
        Description = p.Description ?? s.Description,
        Subjects = p.Subjects.Count > 0 ? p.Subjects : s.Subjects,
        AllIsbns = p.AllIsbns.Union(s.AllIsbns).ToList(),
    };

    /// <summary>
    /// Shares an ISBN <em>and</em> a title. The ISBN alone isn't enough: an Open Library work lists the
    /// ISBNs of every edition, translations included, so a French edition on Google would match an
    /// English work by ISBN.
    /// </summary>
    public static bool IsSameEdition(BookSearchResult a, BookSearchResult b) =>
        a.AllIsbns.Count > 0 && b.AllIsbns.Count > 0 && a.AllIsbns.Intersect(b.AllIsbns).Any()
        && NormaliseTitle(a.Title) == NormaliseTitle(b.Title);

    public static bool IsSameBook(BookSearchResult a, BookSearchResult b)
    {
        if (a.AllIsbns.Count > 0 && b.AllIsbns.Count > 0 && a.AllIsbns.Intersect(b.AllIsbns).Any())
            return true;

        return NormaliseTitle(a.Title) == NormaliseTitle(b.Title)
            && a.Authors.Count > 0 && b.Authors.Count > 0
            && Surname(a.Authors[0]) == Surname(b.Authors[0]);
    }

    public static string NormaliseTitle(string title)
    {
        var decomposed = title.Split(':')[0].Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in decomposed)
        {
            if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
            else if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && sb.Length > 0 && sb[^1] != ' ') sb.Append(' ');
        }
        var s = sb.ToString().Trim();
        return s.StartsWith("the ") ? s[4..] : s;
    }

    private static string Surname(string author) =>
        author.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).LastOrDefault()?.ToLowerInvariant() ?? "";
}
