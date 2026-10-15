using BookNook.Api.Contracts;
using BookNook.Core.Entities;
using BookNook.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Api.Controllers;

public class ShelvesController(AppDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ShelfDto>>> List(CancellationToken ct)
    {
        var shelves = await db.Shelves
            .Where(s => s.UserId == UserId)
            .OrderBy(s => s.Name)
            .Select(s => new
            {
                s.Id, s.Name, s.Description, s.CreatedAt,
                Count = s.Books.Count,
                Audiobooks = s.Books.Count(b => (b.Formats & BookFormat.Audiobook) != 0),
                Covers = s.Books
                    .Where(b => b.Book.CoverUrl != null)
                    .OrderByDescending(b => b.UpdatedAt)
                    .Select(b => b.Book.Id)
                    .Take(4)
                    .ToList(),
            })
            .ToListAsync(ct);

        return shelves
            .Select(s => new ShelfDto(s.Id, s.Name, s.Description, s.Count, s.Audiobooks, s.Covers.Select(id => $"/api/books/{id}/cover").ToList(), s.CreatedAt))
            .ToList();
    }

    [HttpPost]
    public async Task<ActionResult<ShelfDto>> Create(ShelfRequest req, CancellationToken ct)
    {
        var name = req.Name.Trim();
        if (await NameTaken(name, null, ct)) return Invalid("name", "You already have a shelf with that name.");

        var shelf = new Shelf { UserId = UserId, Name = name, Description = Clean(req.Description) };
        db.Shelves.Add(shelf);
        await db.SaveChangesAsync(ct);
        return new ShelfDto(shelf.Id, shelf.Name, shelf.Description, 0, 0, [], shelf.CreatedAt);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ShelfDto>> Update(Guid id, ShelfRequest req, CancellationToken ct)
    {
        var shelf = await db.Shelves.Include(s => s.Books).FirstOrDefaultAsync(s => s.Id == id && s.UserId == UserId, ct);
        if (shelf is null) return NotFound();

        var name = req.Name.Trim();
        if (await NameTaken(name, id, ct)) return Invalid("name", "You already have a shelf with that name.");

        shelf.Name = name;
        shelf.Description = Clean(req.Description);
        await db.SaveChangesAsync(ct);
        return new ShelfDto(shelf.Id, shelf.Name, shelf.Description, shelf.Books.Count,
            shelf.Books.Count(b => b.Formats.HasFlag(BookFormat.Audiobook)), [], shelf.CreatedAt);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await db.Shelves.Where(s => s.Id == id && s.UserId == UserId).ExecuteDeleteAsync(ct);
        return deleted == 0 ? NotFound() : NoContent();
    }

    private Task<bool> NameTaken(string name, Guid? exceptId, CancellationToken ct) =>
        db.Shelves.AnyAsync(s => s.UserId == UserId && s.Id != exceptId && s.Name.ToLower() == name.ToLower(), ct);

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
