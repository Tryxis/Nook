using BookNook.Core.Entities;
using BookNook.Core.Rules;

namespace BookNook.Tests;

public class RatingRulesTests
{
    [Theory]
    [InlineData(0.5), InlineData(1), InlineData(3.5), InlineData(5)]
    public void Accepts_half_star_steps(decimal rating) => Assert.True(RatingRules.IsValid(rating));

    [Theory]
    [InlineData(0), InlineData(4.3), InlineData(5.5), InlineData(-1), InlineData(2.25)]
    public void Rejects_everything_else(decimal rating) => Assert.False(RatingRules.IsValid(rating));
}

public class ReadingStatusRulesTests
{
    private static readonly DateOnly Today = new(2026, 10, 15);

    private static UserBook NewBook(ReadingStatus status = ReadingStatus.WantToRead, int? pages = 300) =>
        new() { Status = status, Book = new Book { Title = "T", PageCount = pages } };

    [Fact]
    public void Starting_opens_a_read()
    {
        var ub = NewBook();
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Reading, Today);

        var read = Assert.Single(ub.ReadThroughs);
        Assert.Equal(Today, read.StartedOn);
        Assert.Null(read.FinishedOn);
        Assert.Equal(ReadingStatus.Reading, ub.Status);
    }

    [Fact]
    public void Finishing_closes_the_open_read_and_sets_progress_to_last_page()
    {
        var ub = NewBook();
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Reading, Today.AddDays(-10));
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Finished, Today);

        var read = Assert.Single(ub.ReadThroughs);
        Assert.Equal(Today.AddDays(-10), read.StartedOn);
        Assert.Equal(Today, read.FinishedOn);
        Assert.Equal(300, ub.CurrentPage);
    }

    [Fact]
    public void Finishing_without_a_start_records_just_a_finish_date()
    {
        var ub = NewBook();
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Finished, Today);

        var read = Assert.Single(ub.ReadThroughs);
        Assert.Null(read.StartedOn);
        Assert.Equal(Today, read.FinishedOn);
    }

    [Fact]
    public void Rereading_a_finished_book_adds_a_second_read()
    {
        var ub = NewBook();
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Finished, Today.AddDays(-100));
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Reading, Today);

        Assert.Equal(2, ub.ReadThroughs.Count);
        Assert.Equal(Today, ReadingStatusRules.LatestReadThrough(ub)!.StartedOn);
    }

    [Fact]
    public void Did_not_finish_marks_the_read_abandoned()
    {
        var ub = NewBook();
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Reading, Today.AddDays(-3));
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.DidNotFinish, Today);

        var read = Assert.Single(ub.ReadThroughs);
        Assert.True(read.Abandoned);
        Assert.Equal(Today, read.FinishedOn);
    }

    [Fact]
    public void Undoing_a_same_day_start_discards_the_read()
    {
        var ub = NewBook();
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.Reading, Today);
        ReadingStatusRules.ApplyStatusChange(ub, ReadingStatus.WantToRead, Today);

        Assert.Empty(ub.ReadThroughs);
    }

    [Fact]
    public void Latest_prefers_an_open_read_over_a_finished_one_on_the_same_day()
    {
        var ub = NewBook();
        ub.ReadThroughs.Add(new ReadThrough { StartedOn = Today, FinishedOn = Today });
        ub.ReadThroughs.Add(new ReadThrough { StartedOn = Today });

        Assert.Null(ReadingStatusRules.LatestReadThrough(ub)!.FinishedOn);
    }
}

public class BookFormatsTests
{
    [Fact]
    public void Split_and_combine_round_trip()
    {
        var both = BookFormats.Combine([BookFormat.Audiobook, BookFormat.Print]);
        Assert.Equal(BookFormat.Print | BookFormat.Audiobook, both);
        Assert.Equal([BookFormat.Print, BookFormat.Audiobook], both.Split());
        Assert.Empty(BookFormat.None.Split());
    }

    [Theory]
    [InlineData(BookFormat.Print | BookFormat.Audiobook, true)]
    [InlineData(BookFormat.Ebook | BookFormat.Audiobook, true)]
    [InlineData(BookFormat.Audiobook, false)]
    [InlineData(BookFormat.Print | BookFormat.Ebook, false)]
    [InlineData(BookFormat.None, false)]
    public void Read_and_listened_needs_audio_plus_text(BookFormat formats, bool expected) =>
        Assert.Equal(expected, formats.IsReadAndListened());
}
