using BookNook.Core.Entities;
using BookNook.Core.Search;
using BookNook.Core.Stats;

namespace BookNook.Tests;

public class ReadingStatsTests
{
    private static readonly DateOnly Today = new(2026, 10, 15);

    private static UserBook Finished(string title, string author, int pages, decimal? rating, DateOnly? start, DateOnly finish) => new()
    {
        Status = ReadingStatus.Finished,
        Rating = rating,
        Book = new Book { Title = title, Authors = [author], PageCount = pages, Subjects = ["Fiction", "nyt:combined=2020"] },
        ReadThroughs = [new ReadThrough { StartedOn = start, FinishedOn = finish }],
    };

    [Fact]
    public void Counts_only_the_requested_year()
    {
        var books = new List<UserBook>
        {
            Finished("A", "Le Guin", 300, 5, new(2026, 1, 1), new(2026, 1, 10)),
            Finished("B", "Le Guin", 200, 4.5m, new(2026, 3, 1), new(2026, 3, 2)),
            Finished("C", "Clarke", 100, 3, null, new(2025, 6, 1)),
            new() { Status = ReadingStatus.Reading, Book = new Book { Title = "D" } },
        };

        var s = ReadingStatsCalculator.Calculate(books, 2026, goal: 12, Today);

        Assert.Equal(2, s.BooksFinished);
        Assert.Equal(500, s.PagesRead);
        Assert.Equal(1, s.CurrentlyReading);
        Assert.Equal(4.75m, s.AverageRating);
        Assert.Equal(6, s.AverageDaysToFinish); // (10 + 2) / 2, both days inclusive
        Assert.Equal(1, s.Monthly[0].Books);
        Assert.Equal(1, s.Monthly[2].Books);
        Assert.Equal("Le Guin", s.TopAuthors[0].Name);
        Assert.Equal(2, s.TopAuthors[0].Count);
        Assert.Equal(1, s.RatingDistribution.Single(b => b.Rating == 4.5m).Count);
        Assert.Equal([2025, 2026], s.History.Select(h => h.Year));
        Assert.Equal("A", s.Longest!.Title);
    }

    [Fact]
    public void Rereads_count_each_time_and_abandoned_reads_dont_count()
    {
        var ub = Finished("A", "X", 100, 4, null, new(2026, 2, 1));
        ub.ReadThroughs.Add(new ReadThrough { FinishedOn = new(2026, 8, 1) });
        ub.ReadThroughs.Add(new ReadThrough { FinishedOn = new(2026, 9, 1), Abandoned = true });

        var s = ReadingStatsCalculator.Calculate([ub], 2026, null, Today);

        Assert.Equal(2, s.BooksFinished);
        Assert.Equal(200, s.PagesRead);
        Assert.Equal(1, s.DidNotFinish);
    }

    [Fact]
    public void A_book_read_and_listened_counts_towards_both_formats()
    {
        var a = Finished("A", "X", 100, 4, null, new(2026, 2, 1));
        a.Formats = BookFormat.Print | BookFormat.Audiobook;
        var b = Finished("B", "Y", 100, 4, null, new(2026, 3, 1));
        b.Formats = BookFormat.Audiobook;
        var c = Finished("C", "Z", 100, 4, null, new(2026, 4, 1)); // format not set

        var s = ReadingStatsCalculator.Calculate([a, b, c], 2026, null, Today);

        Assert.Equal(2, s.Formats.Single(f => f.Name == "Audiobook").Count);
        Assert.Equal(1, s.Formats.Single(f => f.Name == "Print").Count);
        Assert.DoesNotContain(s.Formats, f => f.Name == "Ebook");
        Assert.Equal(1, s.ReadAndListened);
    }

    [Fact]
    public void Noisy_subjects_are_filtered()
    {
        var s = ReadingStatsCalculator.Calculate([Finished("A", "X", 1, null, null, new(2026, 1, 1))], 2026, null, Today);
        Assert.Equal(["Fiction"], s.TopSubjects.Select(t => t.Name));
    }

    [Fact]
    public void Empty_library_is_fine()
    {
        var s = ReadingStatsCalculator.Calculate([], 2026, null, Today);
        Assert.Equal(0, s.BooksFinished);
        Assert.Null(s.AverageRating);
        Assert.Null(s.Longest);
    }
}

public class SearchResultMergerTests
{
    private static BookSearchResult Ol(string id, string title, string author, string? cover = "c", params string[] isbns) => new()
    {
        Id = $"ol:{id}", OpenLibraryId = id, Title = title, Authors = [author], CoverUrl = cover, AllIsbns = isbns,
    };

    private static BookSearchResult Gb(string id, string title, string author, params string[] isbns) => new()
    {
        Id = $"gb:{id}", GoogleVolumeId = id, Title = title, Authors = [author], AllIsbns = isbns,
        Description = "From Google", PageCount = 320, CoverUrl = "g",
    };

    [Fact]
    public void Matches_on_isbn_and_fills_gaps_from_google()
    {
        var merged = SearchResultMerger.Merge(
            [Ol("1", "Piranesi", "Susanna Clarke", "c", "9781635575637")],
            [Gb("g1", "Piranesi (Hardcover)", "S. Clarke", "9781635575637")]);

        var r = Assert.Single(merged);
        Assert.Equal("ol:1", r.Id);
        Assert.Equal("g1", r.GoogleVolumeId);
        Assert.Equal("From Google", r.Description);
        Assert.Equal("c", r.CoverUrl); // Open Library's cover is kept
    }

    [Fact]
    public void Matches_on_title_and_surname_when_isbns_are_missing()
    {
        var merged = SearchResultMerger.Merge(
            [Ol("1", "The Left Hand of Darkness", "Ursula K. Le Guin")],
            [Gb("g1", "Left Hand of Darkness: 50th Anniversary", "Ursula Le Guin")]);

        Assert.Single(merged);
    }

    [Fact]
    public void Appends_unmatched_google_results_and_ranks_coverless_last()
    {
        var merged = SearchResultMerger.Merge(
            [Ol("1", "Summary of Dune", "Somebody", cover: null), Ol("2", "Dune", "Frank Herbert")],
            [Gb("g1", "Dune Messiah", "Frank Herbert")]);

        Assert.Equal(["ol:2", "gb:g1", "ol:1"], merged.Select(m => m.Id));
    }
}

public class CoverTests
{
    [Fact]
    public void Google_thumbnails_are_upgraded_to_the_large_size_once()
    {
        var thumb = "http://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api";
        var large = CoverUrls.UpgradeGoogle(thumb);
        Assert.StartsWith("https://", large);
        Assert.DoesNotContain("edge=curl", large);
        Assert.Contains("fife=w800-h1200", large);
        Assert.Equal(large, CoverUrls.UpgradeGoogle(large));
        Assert.Equal("https://covers.openlibrary.org/b/id/1-L.jpg", CoverUrls.UpgradeGoogle("https://covers.openlibrary.org/b/id/1-L.jpg"));
    }

    [Theory]
    [InlineData("ol:12345", true)]
    [InlineData("gb:CnSJEQAAQBAJ", true)]
    [InlineData("ol:-1", false)]
    [InlineData("ol:abc", false)]
    [InlineData("gb:../../etc", false)]
    [InlineData("https://evil.example/x.jpg", false)]
    public void Only_well_formed_choices_map_to_a_url(string choice, bool valid)
    {
        Assert.Equal(valid, CoverUrls.IsValidChoice(choice));
        var url = CoverUrls.FromChoice(choice);
        if (valid) Assert.Matches(@"^https://(covers\.openlibrary\.org|books\.google\.com)/", url!);
    }

    private static BookSearchResult R(string id, string title, string? cover, params string[] isbns) => new()
    {
        Id = id, Title = title, Authors = ["Author Name"], CoverUrl = cover, AllIsbns = isbns,
    };

    [Fact]
    public void Same_edition_match_prefers_the_google_cover()
    {
        var merged = SearchResultMerger.Merge(
            [R("ol:1", "The Hobbit", "ol-cover", "9780547928227", "9782070612888")],
            [R("gb:1", "The Hobbit", "gb-cover", "9780547928227")]);
        Assert.Equal("gb-cover", Assert.Single(merged).CoverUrl);
    }

    [Fact]
    public void Isbn_match_with_a_different_title_keeps_the_open_library_cover()
    {
        // An Open Library work lists translations' ISBNs too; a French edition must not supply the cover.
        var merged = SearchResultMerger.Merge(
            [R("ol:1", "Harry Potter and the Philosopher's Stone", "ol-cover", "9781408855652", "9782070584628")],
            [R("gb:1", "Harry Potter à l'école des sorciers", "gb-cover", "9782070584628")]);
        Assert.Equal("ol-cover", Assert.Single(merged).CoverUrl);
    }
}
