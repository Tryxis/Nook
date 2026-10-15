using BookNook.Core.Entities;

namespace BookNook.Api.Guest;

/// <summary>
/// The library every guest starts with, so a portfolio visitor lands on populated stats,
/// shelves and share cards. Dates are offsets from "today" so it always looks current.
/// Covers are Open Library ISBN covers (all verified to exist).
/// </summary>
public static class GuestDemoData
{
    public record DemoBook(
        string Isbn13, string Title, string Author, int Pages, int Year, string[] Subjects, string Description);

    public record DemoEntry(
        string Isbn13,
        ReadingStatus Status,
        decimal? Rating = null,
        string? Review = null,
        bool Favorite = false,
        BookFormat Formats = BookFormat.Print,
        int? StartedDaysAgo = null,
        int? FinishedDaysAgo = null,
        int? CurrentPage = null,
        (int Page, string Note)[]? Bookmarks = null,
        string[]? Shelves = null,
        (int StartedDaysAgo, int FinishedDaysAgo)? EarlierRead = null);

    public static readonly DemoBook[] Books =
    [
        new("9781635575637", "Piranesi", "Susanna Clarke", 272, 2020, ["Fantasy", "Literary fiction"],
            "Piranesi lives in the House: a labyrinth of endless halls lined with statues, where tides surge up staircases and clouds drift through upper rooms."),
        new("9780593135204", "Project Hail Mary", "Andy Weir", 496, 2021, ["Science fiction"],
            "A lone astronaut wakes on a spacecraft with no memory of who he is, and slowly realises the fate of humanity rests on him."),
        new("9780547928227", "The Hobbit", "J.R.R. Tolkien", 300, 1937, ["Fantasy", "Classics"],
            "Bilbo Baggins is swept from his comfortable hobbit-hole into an adventure with thirteen dwarves and a wizard."),
        new("9780316556347", "Circe", "Madeline Miller", 393, 2018, ["Mythology", "Fantasy"],
            "The daughter of the sun god Helios, banished to an island, discovers the power of witchcraft and crosses paths with gods and heroes."),
        new("9780593318171", "Klara and the Sun", "Kazuo Ishiguro", 303, 2021, ["Literary fiction", "Science fiction"],
            "An Artificial Friend watches the world from a shop window, hoping to be chosen, and learns what it means to love."),
        new("9780141439518", "Pride and Prejudice", "Jane Austen", 480, 1813, ["Classics", "Romance"],
            "Elizabeth Bennet and Mr Darcy misjudge each other spectacularly in Austen's sharpest comedy of manners."),
        new("9780307744432", "The Night Circus", "Erin Morgenstern", 512, 2011, ["Fantasy", "Romance"],
            "A black-and-white circus that opens only at night is the stage for a duel between two young magicians."),
        new("9781984822178", "Normal People", "Sally Rooney", 288, 2018, ["Literary fiction", "Romance"],
            "Connell and Marianne circle each other from school in a small Irish town to university in Dublin."),
        new("9780062315007", "The Alchemist", "Paulo Coelho", 208, 1988, ["Fiction", "Philosophy"],
            "An Andalusian shepherd boy travels to the Egyptian desert in search of treasure, and of his Personal Legend."),
        new("9780735219090", "Where the Crawdads Sing", "Delia Owens", 384, 2018, ["Mystery", "Literary fiction"],
            "Abandoned as a child, Kya raises herself in the North Carolina marshes, until a local man is found dead."),
        new("9780525559474", "The Midnight Library", "Matt Haig", 304, 2020, ["Fantasy", "Literary fiction"],
            "Between life and death is a library, and every book in it lets Nora try another life she could have lived."),
        new("9780385737951", "The Maze Runner", "James Dashner", 375, 2009, ["Young adult", "Science fiction"],
            "Thomas wakes in a lift with no memory, delivered into a glade surrounded by a deadly, shifting maze."),
    ];

    public static readonly DemoEntry[] Entries =
    [
        new("9781635575637", ReadingStatus.Finished, 4.5m,
            "Strange, luminous and kind. A house of endless halls and tides that I did not want to leave, and a narrator whose gentleness stays with you long after the last page.",
            Favorite: true, StartedDaysAgo: 40, FinishedDaysAgo: 31,
            Bookmarks: [(61, "\"The Beauty of the House is immeasurable; its Kindness infinite.\""), (188, "The tide chapter. Read slowly.")],
            Shelves: ["Comfort reads"]),
        new("9780593135204", ReadingStatus.Finished, 5m,
            "The most fun I've had with a book all year. Rocky is the best friend in fiction, fist my bump.",
            Favorite: true, Formats: BookFormat.Audiobook | BookFormat.Print, StartedDaysAgo: 75, FinishedDaysAgo: 62, Shelves: ["Book club"]),
        new("9780316556347", ReadingStatus.Finished, 4m,
            "Lush and furious. Circe finally gets to tell her own story, and it's worth every century she waited.",
            StartedDaysAgo: 120, FinishedDaysAgo: 104, Shelves: ["Book club"]),
        new("9780593318171", ReadingStatus.Finished, 3.5m,
            "Quiet and a little devastating. Klara's way of seeing the world is the whole point, and it's beautiful.",
            Formats: BookFormat.Ebook, StartedDaysAgo: 160, FinishedDaysAgo: 148),
        new("9780141439518", ReadingStatus.Finished, 5m, null, Favorite: true,
            StartedDaysAgo: 230, FinishedDaysAgo: 205, Shelves: ["Comfort reads"],
            EarlierRead: (1500, 1470)),
        new("9781984822178", ReadingStatus.Finished, 3m,
            "I admired it more than I enjoyed it. The writing is precise; the two of them made me want to scream.",
            StartedDaysAgo: 265, FinishedDaysAgo: 258),
        new("9780062315007", ReadingStatus.Finished, 2.5m, null, Formats: BookFormat.Ebook, StartedDaysAgo: 280, FinishedDaysAgo: 277),
        new("9780735219090", ReadingStatus.Finished, 4m, null, StartedDaysAgo: 300, FinishedDaysAgo: 290, Shelves: ["Book club"]),
        new("9780547928227", ReadingStatus.Finished, 4.5m,
            "Read it aloud over a winter. Still the coziest adventure ever written.",
            StartedDaysAgo: 420, FinishedDaysAgo: 395, Shelves: ["Comfort reads"]),
        new("9780307744432", ReadingStatus.Reading, Formats: BookFormat.Print, StartedDaysAgo: 9, CurrentPage: 214,
            Bookmarks: [(97, "The ice garden."), (214, "Stopped here, Celia and Marco finally meet properly.")]),
        new("9780525559474", ReadingStatus.Reading, Formats: BookFormat.Ebook, StartedDaysAgo: 3, CurrentPage: 58),
        new("9780385737951", ReadingStatus.WantToRead, Formats: BookFormat.None, Shelves: ["Book club"]),
    ];

    public static readonly string[] ShelfNames = ["Comfort reads", "Book club"];
}
