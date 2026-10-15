using BookNook.Core.Entities;

namespace BookNook.Core.Rules;

/// <summary>
/// Keeps read-through history in step with status changes, so users get sensible
/// start/finish dates without filling them in by hand (they can still edit them).
/// </summary>
public static class ReadingStatusRules
{
    public static void ApplyStatusChange(UserBook book, ReadingStatus newStatus, DateOnly today)
    {
        if (book.Status == newStatus) return;

        var open = OpenReadThrough(book);

        switch (newStatus)
        {
            case ReadingStatus.Reading:
                // Starting (or restarting) a book opens a new read unless one is already in progress.
                if (open is null)
                    book.ReadThroughs.Add(new ReadThrough { UserBookId = book.Id, StartedOn = today });
                break;

            case ReadingStatus.Finished:
                if (open is not null)
                    open.FinishedOn = today;
                else
                    book.ReadThroughs.Add(new ReadThrough { UserBookId = book.Id, FinishedOn = today });
                if (book.Book?.PageCount is int pages) book.CurrentPage = pages;
                break;

            case ReadingStatus.DidNotFinish:
                if (open is not null)
                {
                    open.FinishedOn = today;
                    open.Abandoned = true;
                }
                break;

            case ReadingStatus.WantToRead:
                // Moving back to the TBR pile discards an in-progress read that never got going.
                if (open is not null && open.StartedOn == today)
                    book.ReadThroughs.Remove(open);
                break;
        }

        book.Status = newStatus;
    }

    /// <summary>The read that represents "now": an in-progress read wins, otherwise the most recent.</summary>
    public static ReadThrough? LatestReadThrough(UserBook book) =>
        book.ReadThroughs
            .OrderBy(r => r.FinishedOn is null ? 0 : 1)
            .ThenByDescending(r => r.StartedOn ?? r.FinishedOn)
            .ThenByDescending(r => r.FinishedOn)
            .FirstOrDefault();

    public static ReadThrough? OpenReadThrough(UserBook book) =>
        book.ReadThroughs
            .Where(r => r.FinishedOn is null)
            .OrderByDescending(r => r.StartedOn)
            .FirstOrDefault();
}
