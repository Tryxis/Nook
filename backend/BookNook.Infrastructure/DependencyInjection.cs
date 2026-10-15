using BookNook.Infrastructure.Data;
using BookNook.Infrastructure.Search;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BookNook.Infrastructure;

public static class DependencyInjection
{
    private const string UserAgent = "Nook/1.0 (reading diary; contact via app owner)";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("BookNook")
            ?? throw new InvalidOperationException(
                "Connection string 'BookNook' is missing. Set it with: dotnet user-secrets set \"ConnectionStrings:BookNook\" \"...\" --project backend/BookNook.Api");

        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure()));

        services.AddDataProtection()
            .SetApplicationName("BookNook")
            .PersistKeysToDbContext<AppDbContext>();

        services.AddMemoryCache();
        services.Configure<GoogleBooksOptions>(config.GetSection("GoogleBooks"));

        services.AddHttpClient<OpenLibraryProvider>(c =>
        {
            c.BaseAddress = new Uri("https://openlibrary.org/");
            c.DefaultRequestHeaders.UserAgent.ParseAdd(UserAgent);
            c.Timeout = TimeSpan.FromSeconds(8);
        });
        services.AddHttpClient<GoogleBooksProvider>(c =>
        {
            c.BaseAddress = new Uri("https://www.googleapis.com/books/v1/");
            c.Timeout = TimeSpan.FromSeconds(8);
        });
        services.AddHttpClient("covers", c =>
        {
            c.DefaultRequestHeaders.UserAgent.ParseAdd(UserAgent);
            c.Timeout = TimeSpan.FromSeconds(10);
        });
        services.AddScoped<BookSearchService>();

        return services;
    }
}
