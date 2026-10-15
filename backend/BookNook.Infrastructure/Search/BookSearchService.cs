using BookNook.Core.Search;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace BookNook.Infrastructure.Search;

/// <summary>
/// Searches Open Library first and fills gaps from Google Books. Results are cached briefly
/// so that adding a book from a result page doesn't need another round trip.
/// </summary>
public class BookSearchService(
    OpenLibraryProvider openLibrary,
    GoogleBooksProvider google,
    IMemoryCache cache,
    ILogger<BookSearchService> logger)
{
    private static readonly TimeSpan ResultTtl = TimeSpan.FromHours(1);

    public async Task<IReadOnlyList<BookSearchResult>> SearchAsync(string query, int limit, CancellationToken ct)
    {
        query = query.Trim();
        var cacheKey = $"search:{query.ToLowerInvariant()}:{limit}";
        if (cache.TryGetValue(cacheKey, out IReadOnlyList<BookSearchResult>? cached)) return cached!;

        // Run both concurrently; either failing just means fewer/less rich results.
        var olTask = SafeSearch(openLibrary, query, limit, ct);
        var gbTask = SafeSearch(google, query, limit, ct);
        await Task.WhenAll(olTask, gbTask);

        var merged = SearchResultMerger.Merge(olTask.Result, gbTask.Result).Take(limit).ToList();

        cache.Set(cacheKey, (IReadOnlyList<BookSearchResult>)merged, TimeSpan.FromMinutes(10));
        foreach (var r in merged) cache.Set(ResultKey(r.Id), r, ResultTtl);
        return merged;
    }

    /// <summary>Looks up a result by its search id, from cache or by refetching it from the provider.</summary>
    public async Task<BookSearchResult?> ResolveAsync(string resultId, CancellationToken ct)
    {
        if (cache.TryGetValue(ResultKey(resultId), out BookSearchResult? cached)) return cached;

        var parts = resultId.Split(':', 2);
        if (parts.Length != 2) return null;

        IBookSearchProvider? provider = parts[0] switch
        {
            "ol" => openLibrary,
            "gb" => google,
            _ => null,
        };
        if (provider is null) return null;

        var result = await provider.GetAsync(parts[1], ct);
        if (result is null) return null;

        // Enrich a refetched Open Library result from Google using its ISBN.
        if (provider == openLibrary && result.Isbn13 is not null && google.IsEnabled)
        {
            var extra = await SafeSearch(google, $"isbn:{result.Isbn13}", 1, ct);
            if (extra.Count > 0) result = SearchResultMerger.Enrich(result, extra[0]);
        }

        cache.Set(ResultKey(resultId), result, ResultTtl);
        return result;
    }

    private async Task<IReadOnlyList<BookSearchResult>> SafeSearch(IBookSearchProvider p, string q, int limit, CancellationToken ct)
    {
        try
        {
            return await p.SearchAsync(q, limit, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            if (ct.IsCancellationRequested) throw;
            logger.LogWarning(ex, "Book search provider {Provider} failed for {Query}", p.Prefix, q);
            return [];
        }
    }

    private static string ResultKey(string id) => $"result:{id}";
}
