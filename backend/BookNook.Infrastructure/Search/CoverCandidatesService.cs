using System.Net.Http.Json;
using System.Text.Json.Serialization;
using BookNook.Core.Entities;
using BookNook.Core.Search;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BookNook.Infrastructure.Search;

/// <param name="Id">The value to store as a user's cover choice ("ol:{coverId}" / "gb:{volumeId}").</param>
/// <param name="ThumbUrl">A small image for the picker grid.</param>
public record CoverCandidate(string Id, string ThumbUrl, string Source, string? Label);

/// <summary>
/// Alternative covers for a book: the covers of its other English editions on Open Library, plus
/// matching volumes on Google Books. Used by the "Change cover" picker.
/// </summary>
public class CoverCandidatesService(
    IHttpClientFactory httpFactory,
    IOptions<GoogleBooksOptions> googleOptions,
    IMemoryCache cache,
    ILogger<CoverCandidatesService> logger)
{
    private const int MaxOpenLibrary = 30;
    private const int MaxGoogle = 12;

    public async Task<IReadOnlyList<CoverCandidate>> GetAsync(Book book, CancellationToken ct)
    {
        var key = $"covers:{book.Id}";
        if (cache.TryGetValue(key, out IReadOnlyList<CoverCandidate>? cached)) return cached!;

        var ol = Safe(() => OpenLibraryAsync(book, ct), "Open Library");
        var gb = Safe(() => GoogleAsync(book, ct), "Google Books");
        await Task.WhenAll(ol, gb);

        // Google first: those are publisher artwork; Open Library is mostly scans of physical copies.
        var all = (gb.Result ?? []).Concat(ol.Result ?? []).DistinctBy(c => c.Id).ToList();
        // A source that failed (Google 503s often) shouldn't hide its covers for a whole day.
        var complete = gb.Result is not null && ol.Result is not null;
        cache.Set(key, (IReadOnlyList<CoverCandidate>)all, complete ? TimeSpan.FromHours(24) : TimeSpan.FromMinutes(2));
        return all;
    }

    private async Task<IReadOnlyList<CoverCandidate>?> OpenLibraryAsync(Book book, CancellationToken ct)
    {
        var http = httpFactory.CreateClient("openlibrary");
        var workId = book.OpenLibraryId;
        if (workId is null && book.Isbn13 is not null)
        {
            // /isbn/{isbn}.json redirects to the edition, which links to its work.
            var edition = await http.GetFromJsonAsync<OlEdition>($"isbn/{book.Isbn13}.json", ct);
            workId = edition?.Works?.FirstOrDefault()?.Key?.Replace("/works/", "");
        }
        if (workId is null) return [];

        var editions = await http.GetFromJsonAsync<OlEditions>($"works/{workId}/editions.json?limit=200", ct);
        var title = SearchResultMerger.NormaliseTitle(book.Title);

        return (editions?.Entries ?? [])
            .Where(e => e.Covers is { Count: > 0 })
            // English editions, plus ones with no language recorded but the same title (skips translations).
            .Where(e => e.Languages?.Any(l => l.Key == "/languages/eng") == true
                     || (e.Languages is null or { Count: 0 } && e.Title is not null && SearchResultMerger.NormaliseTitle(e.Title) == title))
            .SelectMany(e => e.Covers!.Where(c => c > 0).Select(c => (Cover: c, Edition: e)))
            .DistinctBy(x => x.Cover)
            .Take(MaxOpenLibrary)
            .Select(x => new CoverCandidate(
                $"ol:{x.Cover}",
                CoverUrls.OpenLibrary(x.Cover, 'M'),
                "Open Library",
                Label(x.Edition.Publishers?.FirstOrDefault(), x.Edition.PublishDate)))
            .ToList();
    }

    private async Task<IReadOnlyList<CoverCandidate>?> GoogleAsync(Book book, CancellationToken ct)
    {
        var key = googleOptions.Value.ApiKey;
        if (string.IsNullOrWhiteSpace(key)) return [];

        var surname = book.Authors.FirstOrDefault()?.Split(' ', StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
        // Plain keywords: Google's intitle:/inauthor:/isbn: filters currently return nothing. Results are
        // narrowed to exact (normalised) title matches below.
        var q = $"{book.Title} {surname}".Trim();
        var http = httpFactory.CreateClient("googlebooks");
        var url = $"volumes?q={Uri.EscapeDataString(q)}&maxResults=20&key={key}";

        GbResponse? res = null;
        for (var attempt = 0; attempt < 5 && res is null; attempt++)
        {
            using var r = await http.GetAsync(url, ct);
            if (r.IsSuccessStatusCode) res = await r.Content.ReadFromJsonAsync<GbResponse>(ct);
            else if ((int)r.StatusCode >= 500) await Task.Delay(300 * (attempt + 1), ct); // Google 503s a lot
            else break;
        }
        if (res is null) return null;

        var title = SearchResultMerger.NormaliseTitle(book.Title);
        var candidates = (res?.Items ?? [])
            .Where(v => v.Id is not null && v.VolumeInfo?.ImageLinks is not null)
            .Where(v => v.VolumeInfo!.Language is null or "en")
            .Where(v => v.VolumeInfo!.Title is not null && SearchResultMerger.NormaliseTitle(v.VolumeInfo.Title) == title)
            .Select(v => new CoverCandidate(
                $"gb:{v.Id}",
                CoverUrls.Google(v.Id!, large: false),
                "Google Books",
                Label(v.VolumeInfo!.Publisher, v.VolumeInfo.PublishedDate)))
            .ToList();

        // The book's own Google volume, if it has one, should always be offered.
        if (book.GoogleVolumeId is { } own && candidates.All(c => c.Id != $"gb:{own}"))
            candidates.Insert(0, new CoverCandidate($"gb:{own}", CoverUrls.Google(own, large: false), "Google Books", null));

        return candidates.Take(MaxGoogle).ToList();
    }

    /// <returns>The candidates, or null if the source failed (as opposed to having none).</returns>
    private async Task<IReadOnlyList<CoverCandidate>?> Safe(Func<Task<IReadOnlyList<CoverCandidate>?>> f, string source)
    {
        try
        {
            return await f();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "Cover candidates from {Source} failed", source);
            return null;
        }
    }

    private static string? Label(string? publisher, string? date)
    {
        var year = date is { Length: >= 4 } ? System.Text.RegularExpressions.Regex.Match(date, @"\d{4}").Value : null;
        var parts = new[] { publisher, string.IsNullOrEmpty(year) ? null : year }.Where(p => !string.IsNullOrWhiteSpace(p));
        var label = string.Join(" · ", parts);
        return label.Length == 0 ? null : label;
    }

    private record OlEdition([property: JsonPropertyName("works")] List<OlKey>? Works);
    private record OlKey([property: JsonPropertyName("key")] string? Key);
    private record OlEditions([property: JsonPropertyName("entries")] List<OlEditionEntry>? Entries);
    private record OlEditionEntry(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("covers")] List<long>? Covers,
        [property: JsonPropertyName("publishers")] List<string>? Publishers,
        [property: JsonPropertyName("publish_date")] string? PublishDate,
        [property: JsonPropertyName("languages")] List<OlKey>? Languages);

    private record GbResponse([property: JsonPropertyName("items")] List<GbVolume>? Items);
    private record GbVolume(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("volumeInfo")] GbInfo? VolumeInfo);
    private record GbInfo(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("publisher")] string? Publisher,
        [property: JsonPropertyName("publishedDate")] string? PublishedDate,
        [property: JsonPropertyName("language")] string? Language,
        [property: JsonPropertyName("imageLinks")] object? ImageLinks);
}
