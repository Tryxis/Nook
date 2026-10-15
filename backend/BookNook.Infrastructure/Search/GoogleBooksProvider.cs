using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using BookNook.Core.Search;
using Microsoft.Extensions.Options;

namespace BookNook.Infrastructure.Search;

public class GoogleBooksOptions
{
    public string? ApiKey { get; set; }
}

/// <summary>Google Books volumes API. Disabled (returns nothing) when no API key is configured.</summary>
public partial class GoogleBooksProvider(HttpClient http, IOptions<GoogleBooksOptions> options) : IBookSearchProvider
{
    private readonly string? _key = options.Value.ApiKey;

    public string Prefix => "gb";
    public bool IsEnabled => !string.IsNullOrWhiteSpace(_key);

    public async Task<IReadOnlyList<BookSearchResult>> SearchAsync(string query, int limit, CancellationToken ct)
    {
        if (!IsEnabled) return [];
        var url = $"volumes?q={Uri.EscapeDataString(query)}&maxResults={Math.Min(limit, 40)}&key={_key}";
        var res = await GetWithRetry<GbSearchResponse>(url, ct);
        return res?.Items?.Select(Map).OfType<BookSearchResult>().ToList() ?? [];
    }

    public async Task<BookSearchResult?> GetAsync(string volumeId, CancellationToken ct)
    {
        if (!IsEnabled || !VolumeIdPattern().IsMatch(volumeId)) return null;
        var res = await GetWithRetry<GbVolume>($"volumes/{volumeId}?key={_key}", ct);
        return res is null ? null : Map(res);
    }

    /// <summary>Google Books answers 503 on a sizeable share of requests; short retries clear nearly all of them.</summary>
    private async Task<T?> GetWithRetry<T>(string url, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            using var res = await http.GetAsync(url, ct);
            if ((int)res.StatusCode >= 500 && attempt < 2)
            {
                await Task.Delay(200 * (attempt + 1), ct);
                continue;
            }
            res.EnsureSuccessStatusCode();
            return await res.Content.ReadFromJsonAsync<T>(ct);
        }
    }

    private static BookSearchResult? Map(GbVolume v)
    {
        var info = v.VolumeInfo;
        if (info?.Title is null || v.Id is null) return null;
        var ids = info.IndustryIdentifiers ?? [];
        var isbn13 = ids.FirstOrDefault(i => i.Type == "ISBN_13")?.Identifier;
        var isbn10 = ids.FirstOrDefault(i => i.Type == "ISBN_10")?.Identifier;

        return new BookSearchResult
        {
            Id = $"gb:{v.Id}",
            GoogleVolumeId = v.Id,
            Title = info.Title.Trim(),
            Subtitle = info.Subtitle,
            Authors = info.Authors ?? [],
            Isbn13 = isbn13,
            Isbn10 = isbn10,
            AllIsbns = new[] { isbn13, isbn10 }.OfType<string>().ToList(),
            CoverUrl = CoverUrl(info.ImageLinks),
            PageCount = info.PageCount is > 0 ? info.PageCount : null,
            PublishedYear = info.PublishedDate is { Length: >= 4 } d && int.TryParse(d[..4], out var y) ? y : null,
            Publisher = info.Publisher,
            Description = StripHtml(info.Description),
            // Categories look like "Fiction / Fantasy / Epic"; keep each segment as a subject.
            Subjects = info.Categories?.SelectMany(c => c.Split('/', StringSplitOptions.TrimEntries)).Distinct().ToList() ?? [],
        };
    }

    private static string? CoverUrl(GbImageLinks? links)
    {
        var url = links?.Thumbnail ?? links?.SmallThumbnail;
        if (url is null) return null;
        // Google serves http links with a page-curl effect; upgrade both.
        return url.Replace("http://", "https://").Replace("&edge=curl", "");
    }

    private static string? StripHtml(string? html) =>
        html is null ? null : System.Net.WebUtility.HtmlDecode(HtmlTag().Replace(html, " ")).Trim();

    [GeneratedRegex("^[A-Za-z0-9_-]{6,20}$")]
    private static partial Regex VolumeIdPattern();

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex HtmlTag();

    private record GbSearchResponse([property: JsonPropertyName("items")] List<GbVolume>? Items);

    private record GbVolume(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("volumeInfo")] GbVolumeInfo? VolumeInfo);

    private record GbVolumeInfo(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("subtitle")] string? Subtitle,
        [property: JsonPropertyName("authors")] List<string>? Authors,
        [property: JsonPropertyName("publisher")] string? Publisher,
        [property: JsonPropertyName("publishedDate")] string? PublishedDate,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("industryIdentifiers")] List<GbIdentifier>? IndustryIdentifiers,
        [property: JsonPropertyName("pageCount")] int? PageCount,
        [property: JsonPropertyName("categories")] List<string>? Categories,
        [property: JsonPropertyName("imageLinks")] GbImageLinks? ImageLinks);

    private record GbIdentifier(
        [property: JsonPropertyName("type")] string? Type,
        [property: JsonPropertyName("identifier")] string? Identifier);

    private record GbImageLinks(
        [property: JsonPropertyName("smallThumbnail")] string? SmallThumbnail,
        [property: JsonPropertyName("thumbnail")] string? Thumbnail);
}
