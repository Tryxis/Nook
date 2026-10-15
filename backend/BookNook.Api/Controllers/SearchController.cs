using BookNook.Core.Search;
using BookNook.Infrastructure.Search;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BookNook.Api.Controllers;

public class SearchController(BookSearchService search) : ApiControllerBase
{
    [HttpGet]
    [EnableRateLimiting("search")]
    public async Task<ActionResult<IReadOnlyList<BookSearchResult>>> Search([FromQuery] string q, [FromQuery] int limit = 20, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2) return Invalid("q", "Enter at least 2 characters.");
        if (q.Length > 200) return Invalid("q", "Search is too long.");
        return Ok(await search.SearchAsync(q, Math.Clamp(limit, 1, 40), ct));
    }
}
