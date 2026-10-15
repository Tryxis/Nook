using System.Text.RegularExpressions;

namespace BookNook.Core.Search;

/// <summary>
/// Builds cover image URLs. A user's chosen cover is stored as a short id ("ol:{coverId}" or
/// "gb:{volumeId}") rather than a URL, so the server only ever fetches images from these two hosts.
/// </summary>
public static partial class CoverUrls
{
    /// <summary>Google's "fife" sizing returns the largest available scan up to these bounds (typically ~800px wide).</summary>
    private const string GoogleLargeSize = "&fife=w800-h1200";

    public static string OpenLibrary(long coverId, char size = 'L') =>
        $"https://covers.openlibrary.org/b/id/{coverId}-{size}.jpg?default=false";

    public static string Google(string volumeId, bool large = true) =>
        $"https://books.google.com/books/content?id={volumeId}&printsec=frontcover&img=1&zoom=1&source=gbs_api{(large ? GoogleLargeSize : "")}";

    /// <summary>Upgrades a Google thumbnail URL (128px) to the large size. Other URLs pass through unchanged.</summary>
    public static string UpgradeGoogle(string url)
    {
        if (!url.Contains("books.google.com/books", StringComparison.OrdinalIgnoreCase) || url.Contains("fife=")) return url;
        return url.Replace("http://", "https://").Replace("&edge=curl", "") + GoogleLargeSize;
    }

    public static bool IsValidChoice(string? choice) => choice is not null && FromChoice(choice) is not null;

    public static string? FromChoice(string choice)
    {
        if (choice.StartsWith("ol:") && long.TryParse(choice[3..], out var id) && id > 0) return OpenLibrary(id);
        if (choice.StartsWith("gb:") && VolumeId().IsMatch(choice[3..])) return Google(choice[3..]);
        return null;
    }

    [GeneratedRegex("^[A-Za-z0-9_-]{6,20}$")]
    private static partial Regex VolumeId();
}
