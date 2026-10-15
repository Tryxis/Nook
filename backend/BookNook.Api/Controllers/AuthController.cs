using BookNook.Api.Contracts;
using BookNook.Api.Guest;
using BookNook.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BookNook.Api.Controllers;

public class AuthController(UserManager<AppUser> users, SignInManager<AppUser> signIn) : ApiControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<ActionResult<UserDto>> Register(RegisterRequest req)
    {
        var user = new AppUser
        {
            UserName = req.Email.Trim(),
            Email = req.Email.Trim(),
            DisplayName = req.DisplayName.Trim(),
        };

        var result = await users.CreateAsync(user, req.Password);
        if (!result.Succeeded)
        {
            foreach (var e in result.Errors)
                ModelState.AddModelError(e.Code.Contains("Password") ? "password" : "email", e.Description);
            return ValidationProblem(ModelState);
        }

        await signIn.SignInAsync(user, isPersistent: true);
        return ToDto(user);
    }

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<ActionResult<UserDto>> Login(LoginRequest req)
    {
        var user = await users.FindByEmailAsync(req.Email.Trim());
        if (user is null || user.IsGuest) return Unauthorized(new ProblemDetails { Title = "Email or password is incorrect." });

        var result = await signIn.PasswordSignInAsync(user, req.Password, req.RememberMe, lockoutOnFailure: true);
        if (result.IsLockedOut)
            return Unauthorized(new ProblemDetails { Title = "Too many failed attempts. Try again in a few minutes." });
        if (!result.Succeeded)
            return Unauthorized(new ProblemDetails { Title = "Email or password is incorrect." });

        return ToDto(user);
    }

    /// <summary>One click, no credentials: a fresh demo account for portfolio visitors.</summary>
    [AllowAnonymous]
    [EnableRateLimiting("guest")]
    [HttpPost("guest")]
    public async Task<ActionResult<UserDto>> Guest([FromServices] GuestService guests, CancellationToken ct)
    {
        var user = await guests.CreateAndSignInAsync(ct);
        return ToDto(user);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signIn.SignOutAsync();
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me()
    {
        var user = await users.FindByIdAsync(UserId);
        return user is null ? Unauthorized() : ToDto(user);
    }

    [HttpPut("me")]
    public async Task<ActionResult<UserDto>> UpdateMe(UpdateProfileRequest req)
    {
        var user = await users.FindByIdAsync(UserId);
        if (user is null) return Unauthorized();

        user.DisplayName = req.DisplayName.Trim();
        user.YearlyGoal = req.YearlyGoal;
        await users.UpdateAsync(user);
        return ToDto(user);
    }

    [HttpPost("password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var user = await users.FindByIdAsync(UserId);
        if (user is null) return Unauthorized();
        if (user.IsGuest) return Invalid("currentPassword", "Guest accounts don't have a password.");

        var result = await users.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var e in result.Errors)
                ModelState.AddModelError(e.Code == "PasswordMismatch" ? "currentPassword" : "newPassword",
                    e.Code == "PasswordMismatch" ? "That's not your current password." : e.Description);
            return ValidationProblem(ModelState);
        }

        // The security stamp changed; re-issue this session's cookie so only *other* sessions end.
        await signIn.RefreshSignInAsync(user);
        return NoContent();
    }

    private static UserDto ToDto(AppUser u) => new(u.Id, u.IsGuest ? "" : u.Email ?? "", u.DisplayName, u.YearlyGoal, u.IsGuest);
}
