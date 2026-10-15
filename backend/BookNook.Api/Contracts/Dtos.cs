using System.ComponentModel.DataAnnotations;
using BookNook.Core.Entities;

namespace BookNook.Api.Contracts;

// ---- Auth ----

public record RegisterRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MinLength(8), MaxLength(128)] string Password,
    [Required, MaxLength(60)] string DisplayName);

public record LoginRequest([Required] string Email, [Required] string Password, bool RememberMe = true);

public record ChangePasswordRequest([Required] string CurrentPassword, [Required, MinLength(8), MaxLength(128)] string NewPassword);

public record UpdateProfileRequest([Required, MaxLength(60)] string DisplayName, [Range(1, 1000)] int? YearlyGoal);

public record UserDto(string Id, string Email, string DisplayName, int? YearlyGoal, bool IsGuest);

// ---- Library ----

public record BookDto(
    Guid Id,
    string Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    string? Isbn13,
    string? CoverUrl,
    int? PageCount,
    int? PublishedYear,
    string? Publisher,
    string? Description,
    IReadOnlyList<string> Subjects);

public record ReadThroughDto(Guid Id, DateOnly? StartedOn, DateOnly? FinishedOn, bool Abandoned);

public record BookmarkDto(Guid Id, int? Page, decimal? Percent, string? Note, DateTime CreatedAt);

public record ShelfRefDto(Guid Id, string Name);

public record UserBookSummaryDto(
    Guid Id,
    BookDto Book,
    ReadingStatus Status,
    IReadOnlyList<BookFormat> Formats,
    decimal? Rating,
    bool HasReview,
    bool IsFavorite,
    int? CurrentPage,
    DateOnly? StartedOn,
    DateOnly? FinishedOn,
    IReadOnlyList<Guid> ShelfIds,
    DateTime AddedAt,
    DateTime UpdatedAt);

public record UserBookDetailDto(
    Guid Id,
    BookDto Book,
    ReadingStatus Status,
    IReadOnlyList<BookFormat> Formats,
    decimal? Rating,
    string? Review,
    DateTime? ReviewUpdatedAt,
    bool IsFavorite,
    int? CurrentPage,
    IReadOnlyList<ReadThroughDto> ReadThroughs,
    IReadOnlyList<BookmarkDto> Bookmarks,
    IReadOnlyList<ShelfRefDto> Shelves,
    DateTime AddedAt,
    DateTime UpdatedAt);

public record AddToLibraryRequest([Required, MaxLength(64)] string ResultId, ReadingStatus Status = ReadingStatus.WantToRead);

/// <summary>Full replacement of the user-editable fields on a library entry.</summary>
public record UpdateUserBookRequest(
    ReadingStatus Status,
    IReadOnlyList<BookFormat> Formats,
    decimal? Rating,
    [MaxLength(10_000)] string? Review,
    bool IsFavorite,
    [Range(0, 100_000)] int? CurrentPage);

public record ProgressRequest([Range(0, 100_000)] int? CurrentPage);

public record ReadThroughRequest(DateOnly? StartedOn, DateOnly? FinishedOn, bool Abandoned = false);

public record BookmarkRequest([Range(0, 100_000)] int? Page, [Range(0, 100)] decimal? Percent, [MaxLength(2000)] string? Note);

public record SetCoverRequest([MaxLength(64)] string? Choice);

public record CoverCandidatesDto(string? Current, IReadOnlyList<BookNook.Infrastructure.Search.CoverCandidate> Candidates);

public record SetShelvesRequest([Required] IReadOnlyList<Guid> ShelfIds);

// ---- Shelves ----

public record ShelfDto(Guid Id, string Name, string? Description, int BookCount, int AudiobookCount, IReadOnlyList<string> CoverUrls, DateTime CreatedAt);

public record ShelfRequest([Required, MaxLength(80)] string Name, [MaxLength(500)] string? Description);
