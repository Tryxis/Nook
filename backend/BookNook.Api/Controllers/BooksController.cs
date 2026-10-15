using BookNook.Api.Contracts;
using BookNook.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Api.Controllers;

public class BooksController(AppDbContext db, CoverProxy covers) : ApiControllerBase
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
        return url is null ? NotFound() : await covers.GetAsync(url, ct);
    }
}
