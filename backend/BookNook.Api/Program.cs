using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using BookNook.Api.Admin;
using BookNook.Api.Guest;
using BookNook.Core.Entities;
using BookNook.Infrastructure;
using BookNook.Infrastructure.Data;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services
    .AddIdentityCore<AppUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 8;
        o.Password.RequireNonAlphanumeric = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireLowercase = false;
        o.Lockout.MaxFailedAccessAttempts = 8;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    })
    .AddSignInManager()
    .AddEntityFrameworkStores<AppDbContext>();

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "nook.auth";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromDays(30);
    o.SlidingExpiration = true;
    // This is an API: answer with status codes instead of redirecting to a login page.
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();

// Re-check the security stamp every minute (default 30), so changing or resetting a password
// signs out other sessions promptly.
builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.FromMinutes(1));

builder.Services.AddScoped<GuestService>();
builder.Services.AddScoped<BookNook.Api.Contracts.CoverProxy>();
builder.Services.AddHostedService<GuestCleanupService>();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Protects the Google Books daily quota from a single user hammering search.
    o.AddPolicy("search", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
    // Each guest click creates an account, so this is deliberately tight.
    o.AddPolicy("guest", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(10) }));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

// Behind Render's (or any) reverse proxy, trust X-Forwarded-For/Proto so rate limits see the real
// client IP and the app knows the original request was HTTPS. Render sets RENDER=true.
var behindProxy = builder.Configuration["RENDER"] is not null || builder.Configuration.GetValue<bool>("BehindProxy");
if (behindProxy)
{
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        // The proxy's address isn't fixed, so accept forwarded headers from any upstream.
        o.KnownIPNetworks.Clear();
        o.KnownProxies.Clear();
    });
}

var app = builder.Build();

// Maintenance commands (e.g. reset-password) run and exit without starting the web server.
if (AdminCommands.IsCommand(args))
{
    Environment.ExitCode = await AdminCommands.RunAsync(app, args);
    return;
}

if (behindProxy) app.UseForwardedHeaders();

// Opt-in (set Database__MigrateOnStartup=true on Render) so each deploy brings the schema up to date.
// Off by default so local runs never touch the database schema unexpectedly.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
    app.UseHttpsRedirection();
}

// In production the built React app is served from wwwroot by this same process.
app.UseDefaultFiles();
var contentTypes = new FileExtensionContentTypeProvider();
// The PWA manifest must be served as JSON, or browsers ignore it (and the SPA fallback would answer instead).
contentTypes.Mappings[".webmanifest"] = "application/manifest+json";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
// Unknown /api routes are real 404s, not the SPA. (Catch-alls have the lowest route precedence,
// so every real API endpoint still wins.)
app.Map("/api/{**rest}", () => Results.NotFound()).AllowAnonymous();
// Everything else that isn't a file is a client-side route. The default pattern's "nonfile"
// constraint matters: without it the fallback also matches /assets/*.js and the static file
// middleware (which skips requests that already matched an endpoint) never serves them.
app.MapFallbackToFile("index.html");

app.Run();
