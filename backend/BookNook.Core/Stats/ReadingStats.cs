using BookNook.Core.Entities;

namespace BookNook.Core.Stats;

public record MonthStat(int Month, int Books, int Pages);
public record RatingBucket(decimal Rating, int Count);
public record NamedCount(string Name, int Count);
public record YearStat(int Year, int Books, int Pages);
public record BookHighlight(Guid UserBookId, Guid BookId, string Title, int Pages);

public record ReadingStatsResult(
    int Year,
    int BooksFinished,
    int PagesRead,
    int CurrentlyReading,
    int WantToRead,
    int DidNotFinish,
    decimal? AverageRating,
    double? AverageDaysToFinish,
    double PagesPerDay,
    int? Goal,
    IReadOnlyList<MonthStat> Monthly,
    IReadOnlyList<RatingBucket> RatingDistribution,
    IReadOnlyList<NamedCount> TopAuthors,
    IReadOnlyList<NamedCount> TopSubjects,
    IReadOnlyList<NamedCount> Formats,
    int ReadAndListened,
    IReadOnlyList<YearStat> History,
    BookHighlight? Longest,
    BookHighlight? Shortest);

public static class ReadingStatsCalculator
{
    /// <param name="books">The user's library, with Book and ReadThroughs loaded.</param>
    public static ReadingStatsResult Calculate(IReadOnlyCollection<UserBook> books, int year, int? goal, DateOnly today)
    {
        // Every completed (non-abandoned) read counts, so rereads show up in totals.
        var finishedReads = books
            .SelectMany(ub => ub.ReadThroughs
                .Where(r => r.FinishedOn is not null && !r.Abandoned)
                .Select(r => (Book: ub, Read: r)))
            .ToList();

        var thisYear = finishedReads.Where(x => x.Read.FinishedOn!.Value.Year == year).ToList();
        var thisYearBooks = thisYear.Select(x => x.Book).Distinct().ToList();

        var monthly = Enumerable.Range(1, 12)
            .Select(m =>
            {
                var inMonth = thisYear.Where(x => x.Read.FinishedOn!.Value.Month == m).ToList();
                return new MonthStat(m, inMonth.Count, inMonth.Sum(x => x.Book.Book.PageCount ?? 0));
            })
            .ToList();

        var rated = thisYearBooks.Where(b => b.Rating is not null).ToList();
        var distribution = Enumerable.Range(1, 10)
            .Select(i => i / 2m)
            .Select(r => new RatingBucket(r, rated.Count(b => b.Rating == r)))
            .ToList();

        var durations = thisYear
            .Where(x => x.Read.StartedOn is not null)
            .Select(x => x.Read.FinishedOn!.Value.DayNumber - x.Read.StartedOn!.Value.DayNumber + 1)
            .Where(d => d > 0)
            .ToList();

        var pagesRead = thisYear.Sum(x => x.Book.Book.PageCount ?? 0);
        var daysElapsed = year == today.Year
            ? today.DayOfYear
            : year < today.Year ? new DateOnly(year, 12, 31).DayOfYear : 0;

        var withPages = thisYearBooks.Where(b => b.Book.PageCount is > 0).ToList();

        return new ReadingStatsResult(
            Year: year,
            BooksFinished: thisYear.Count,
            PagesRead: pagesRead,
            CurrentlyReading: books.Count(b => b.Status == ReadingStatus.Reading),
            WantToRead: books.Count(b => b.Status == ReadingStatus.WantToRead),
            DidNotFinish: books.Count(b => b.ReadThroughs.Any(r => r.Abandoned && r.FinishedOn?.Year == year)),
            AverageRating: rated.Count > 0 ? Math.Round(rated.Average(b => b.Rating!.Value), 2) : null,
            AverageDaysToFinish: durations.Count > 0 ? Math.Round(durations.Average(), 1) : null,
            PagesPerDay: daysElapsed > 0 ? Math.Round((double)pagesRead / daysElapsed, 1) : 0,
            Goal: goal,
            Monthly: monthly,
            RatingDistribution: distribution,
            TopAuthors: TopCounts(thisYearBooks.SelectMany(b => b.Book.Authors.Take(1)), 5),
            TopSubjects: TopCounts(thisYearBooks.SelectMany(b => b.Book.Subjects.Select(NormaliseSubject).OfType<string>().Distinct()), 8),
            // A book read and listened to counts towards both formats.
            Formats: BookFormats.All
                .Select(f => new NamedCount(f.ToString(), thisYearBooks.Count(b => b.Formats.HasFlag(f))))
                .Where(n => n.Count > 0)
                .OrderByDescending(n => n.Count)
                .ToList(),
            ReadAndListened: thisYearBooks.Count(b => b.Formats.IsReadAndListened()),
            History: finishedReads
                .GroupBy(x => x.Read.FinishedOn!.Value.Year)
                .Select(g => new YearStat(g.Key, g.Count(), g.Sum(x => x.Book.Book.PageCount ?? 0)))
                .OrderBy(y => y.Year)
                .ToList(),
            Longest: Highlight(withPages.MaxBy(b => b.Book.PageCount)),
            Shortest: Highlight(withPages.MinBy(b => b.Book.PageCount)));
    }

    private static List<NamedCount> TopCounts(IEnumerable<string> names, int take) =>
        names
            .GroupBy(n => n, StringComparer.OrdinalIgnoreCase)
            .Select(g => new NamedCount(g.First(), g.Count()))
            .OrderByDescending(n => n.Count)
            .ThenBy(n => n.Name)
            .Take(take)
            .ToList();

    /// <summary>
    /// Open Library subjects are noisy ("Fiction, general", "nyt:hardcover-fiction=2008-10-12").
    /// Keep short human-readable ones, title-cased.
    /// </summary>
    private static string? NormaliseSubject(string subject)
    {
        var s = subject.Trim();
        if (s.Length is < 3 or > 30 || s.Contains(':') || s.Contains('=')) return null;
        s = s.Split(',')[0].Trim();
        return System.Globalization.CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.ToLowerInvariant());
    }

    private static BookHighlight? Highlight(UserBook? b) =>
        b is null ? null : new BookHighlight(b.Id, b.BookId, b.Book.Title, b.Book.PageCount ?? 0);
}
