using System.Net.Http.Json;
using System.Text.Json.Serialization;
using BookNook.Core.Search;

namespace BookNook.Infrastructure.Search;

/// <summary>Open Library search API. Free and keyless; asks for an identifying User-Agent.</summary>
public class OpenLibraryProvider(HttpClient http) : IBookSearchProvider
{
    private const string Fields = "key,title,subtitle,author_name,isbn,cover_i,number_of_pages_median,first_publish_year,publisher,subject";

    public string Prefix => "ol";

    public async Task<IReadOnlyList<BookSearchResult>> SearchAsync(string query, int limit, CancellationToken ct)
    {
        var url = $"search.json?q={Uri.EscapeDataString(query)}&limit={limit}&fields={Fields}";
        var res = await http.GetFromJsonAsync<OlSearchResponse>(url, ct);
        return res?.Docs.Select(Map).OfType<BookSearchResult>().ToList() ?? [];
    }

    public async Task<BookSearchResult?> GetAsync(string workId, CancellationToken ct)
    {
        if (!IsWorkId(workId)) return null;
        var url = $"search.json?q={Uri.EscapeDataString($"key:\"/works/{workId}\"")}&limit=1&fields={Fields}";
        var res = await http.GetFromJsonAsync<OlSearchResponse>(url, ct);
        return res?.Docs.Select(Map).FirstOrDefault(r => r is not null);
    }

    private static bool IsWorkId(string id) =>
        id.Length is > 3 and < 20 && id.StartsWith("OL") && id.EndsWith('W') && id[2..^1].All(char.IsDigit);

    private static BookSearchResult? Map(OlDoc d)
    {
        if (string.IsNullOrWhiteSpace(d.Title) || d.Key is null) return null;
        var workId = d.Key.Replace("/works/", "");
        var isbns = d.Isbn ?? [];
        return new BookSearchResult
        {
            Id = $"ol:{workId}",
            OpenLibraryId = workId,
            Title = d.Title.Trim(),
            Subtitle = d.Subtitle,
            Authors = d.AuthorName ?? [],
            Isbn13 = isbns.FirstOrDefault(i => i.Length == 13 && i.StartsWith("978")) ?? isbns.FirstOrDefault(i => i.Length == 13),
            Isbn10 = isbns.FirstOrDefault(i => i.Length == 10),
            AllIsbns = isbns,
            CoverUrl = d.CoverId is > 0 ? $"https://covers.openlibrary.org/b/id/{d.CoverId}-L.jpg?default=false" : null,
            PageCount = d.Pages is > 0 ? d.Pages : null,
            PublishedYear = d.FirstPublishYear,
            Publisher = d.Publisher?.FirstOrDefault(),
            Subjects = d.Subject?.Take(25).ToList() ?? [],
        };
    }

    private record OlSearchResponse([property: JsonPropertyName("docs")] List<OlDoc> Docs);

    private record OlDoc(
        [property: JsonPropertyName("key")] string? Key,
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("subtitle")] string? Subtitle,
        [property: JsonPropertyName("author_name")] List<string>? AuthorName,
        [property: JsonPropertyName("isbn")] List<string>? Isbn,
        [property: JsonPropertyName("cover_i")] long? CoverId,
        [property: JsonPropertyName("number_of_pages_median")] int? Pages,
        [property: JsonPropertyName("first_publish_year")] int? FirstPublishYear,
        [property: JsonPropertyName("publisher")] List<string>? Publisher,
        [property: JsonPropertyName("subject")] List<string>? Subject);
}
