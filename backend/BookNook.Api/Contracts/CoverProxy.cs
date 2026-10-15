using BookNook.Core.Search;
using Microsoft.AspNetCore.Mvc;

namespace BookNook.Api.Contracts;

/// <summary>
/// Fetches a cover image server-side and returns it from our own origin, so the share-image canvas
/// can read its pixels. Only ever called with URLs we built or stored ourselves.
/// </summary>
public class CoverProxy(IHttpClientFactory httpFactory)
{
    public async Task<IActionResult> GetAsync(string url, CancellationToken ct)
    {
        // Covers saved before large Google images were used still point at 128px thumbnails.
        url = CoverUrls.UpgradeGoogle(url);

        using var res = await httpFactory.CreateClient("covers").GetAsync(url, ct);
        if (!res.IsSuccessStatusCode) return new NotFoundResult();

        var type = res.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
        if (!type.StartsWith("image/")) return new NotFoundResult();

        var bytes = await res.Content.ReadAsByteArrayAsync(ct);
        // Google returns a tiny "image not available" placeholder rather than a 404.
        if (bytes.Length < 1500) return new NotFoundResult();

        return new FileContentResult(bytes, type);
    }
}
