using BookNook.Core.Stats;
using BookNook.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Api.Controllers;

public class StatsController(AppDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ReadingStatsResult>> Get([FromQuery] int? year, CancellationToken ct)
    {
        var y = year ?? Today.Year;
        if (y is < 1900 or > 2200) return Invalid("year", "Pick a sensible year.");

        var books = await db.UserBooks
            .AsNoTracking()
            .Where(ub => ub.UserId == UserId)
            .Include(ub => ub.Book)
            .Include(ub => ub.ReadThroughs)
            .AsSplitQuery()
            .ToListAsync(ct);

        var goal = await db.Users.Where(u => u.Id == UserId).Select(u => u.YearlyGoal).FirstOrDefaultAsync(ct);

        // The goal is a "this year" setting; don't project it onto past years.
        return ReadingStatsCalculator.Calculate(books, y, y == Today.Year ? goal : null, Today);
    }
}
