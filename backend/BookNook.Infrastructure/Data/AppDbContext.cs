using BookNook.Core.Entities;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace BookNook.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options), IDataProtectionKeyContext
{
    /// <summary>
    /// ASP.NET Data Protection keys (they sign the auth cookie). Kept in the database because
    /// container hosts like Render wipe the filesystem on every deploy, which would log everyone out.
    /// </summary>
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    public DbSet<Book> Books => Set<Book>();
    public DbSet<UserBook> UserBooks => Set<UserBook>();
    public DbSet<ReadThrough> ReadThroughs => Set<ReadThrough>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();
    public DbSet<Shelf> Shelves => Set<Shelf>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Ids are assigned in code. Telling EF they are never store-generated makes it INSERT
        // children added to an already-tracked parent's collection, instead of trying an UPDATE.
        b.Entity<Book>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<UserBook>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<ReadThrough>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Bookmark>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Shelf>().Property(x => x.Id).ValueGeneratedNever();

        b.Entity<AppUser>(e =>
        {
            e.Property(u => u.DisplayName).HasMaxLength(60);
            e.HasIndex(u => new { u.IsGuest, u.CreatedAt });
        });

        b.Entity<Book>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(500);
            e.Property(x => x.Subtitle).HasMaxLength(500);
            e.Property(x => x.Isbn13).HasMaxLength(13);
            e.Property(x => x.Isbn10).HasMaxLength(10);
            e.Property(x => x.OpenLibraryId).HasMaxLength(32);
            e.Property(x => x.GoogleVolumeId).HasMaxLength(32);
            e.Property(x => x.CoverUrl).HasMaxLength(1000);
            e.Property(x => x.Publisher).HasMaxLength(300);
            e.HasIndex(x => x.Isbn13).IsUnique().HasFilter("\"Isbn13\" IS NOT NULL");
            e.HasIndex(x => x.OpenLibraryId).IsUnique().HasFilter("\"OpenLibraryId\" IS NOT NULL");
            e.HasIndex(x => x.GoogleVolumeId).IsUnique().HasFilter("\"GoogleVolumeId\" IS NOT NULL");
        });

        b.Entity<UserBook>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.BookId }).IsUnique();
            e.HasIndex(x => new { x.UserId, x.Status });
            e.Property(x => x.Rating).HasPrecision(2, 1);
            e.Property(x => x.Review).HasMaxLength(10_000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            // Formats is a [Flags] enum stored as an int bit field, so "has audiobook" filters run in SQL.
            e.HasOne(x => x.User).WithMany(u => u.Books).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book).WithMany().HasForeignKey(x => x.BookId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.ReadThroughs).WithOne().HasForeignKey(r => r.UserBookId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Bookmarks).WithOne().HasForeignKey(r => r.UserBookId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Shelves).WithMany(s => s.Books).UsingEntity(j => j.ToTable("ShelfBooks"));
        });

        b.Entity<Bookmark>(e =>
        {
            e.Property(x => x.Percent).HasPrecision(5, 2);
            e.Property(x => x.Note).HasMaxLength(2000);
        });

        b.Entity<Shelf>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Description).HasMaxLength(500);
            e.HasIndex(x => new { x.UserId, x.Name }).IsUnique();
            e.HasOne<AppUser>().WithMany(u => u.Shelves).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
