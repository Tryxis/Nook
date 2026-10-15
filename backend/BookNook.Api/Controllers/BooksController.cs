using BookNook.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Api.Controllers;

public class BooksController(AppDbContext db, IHttpClientFactory httpFactory) : ApiControllerBase
{
    /// <summary>
    /// Same-origin proxy for cover art. Only fetches URLs we stored ourselves (never a
    /// client-supplied URL), and lets the share-image canvas read pixels without CORS taint.
    /// </summary>
    [HttpGet("{id:guid}/cover")]
    [ResponseCache(Duration = 60 * 60 * 24 * 7, Location = ResponseCacheLocation.Client)]
    public async Task<IActionResult> Cover(Guid id, CancellationToken ct)
    {
        var url = await db.Books.Where(b => b.Id == id).Select(b => b.CoverUrl).FirstOrDefaultAsync(ct);
        if (url is null) return NotFound();

        using var res = await httpFactory.CreateClient("covers").GetAsync(url, ct);
        if (!res.IsSuccessStatusCode) return NotFound();

        var type = res.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
        if (!type.StartsWith("image/")) return NotFound();

        var bytes = await res.Content.ReadAsByteArrayAsync(ct);
        // Google returns a tiny "image not available" placeholder rather than a 404.
        if (bytes.Length < 1500) return NotFound();

        return File(bytes, type);
    }
}
