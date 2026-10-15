namespace BookNook.Core.Rules;

public static class RatingRules
{
    public const decimal Min = 0.5m;
    public const decimal Max = 5.0m;

    /// <summary>A rating is valid when it is between 0.5 and 5 and a whole multiple of 0.5.</summary>
    public static bool IsValid(decimal rating) =>
        rating is >= Min and <= Max && rating * 2 == decimal.Truncate(rating * 2);
}
