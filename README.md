# Nook

A reading diary. Search for books, log start and finish dates, bookmark pages, rate in half stars,
write reviews, organise books into shelves, view reading stats, and export a review as an Instagram
story or post.

## Stack

- **Backend:** ASP.NET Core 10 Web API, ASP.NET Identity (cookie auth), EF Core with PostgreSQL (Neon)
- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query
- **Book data:** Open Library, with Google Books used to fill in missing details

| Project | Contents |
|---|---|
| `backend/BookNook.Api` | Controllers, auth, guest mode, admin commands |
| `backend/BookNook.Core` | Entities, reading-status rules, stats, search merging |
| `backend/BookNook.Infrastructure` | EF Core context and migrations, book search clients |
| `backend/BookNook.Tests` | Unit tests |
| `frontend` | React app |

The projects keep their original `BookNook` names. The app itself is branded Nook.

## Setup

Requires the .NET 10 SDK and Node 22.

```powershell
dotnet tool restore
dotnet user-secrets set "ConnectionStrings:BookNook" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require" --project backend/BookNook.Api
dotnet user-secrets set "GoogleBooks:ApiKey" "..." --project backend/BookNook.Api   # optional
dotnet ef database update --project backend/BookNook.Infrastructure --startup-project backend/BookNook.Api
cd frontend; npm install
```

## Development

```powershell
dotnet run --project backend/BookNook.Api --launch-profile http   # API: http://localhost:5205
cd frontend; npm run dev                                          # App: http://localhost:5173
```

Vite proxies `/api` to the backend.

```powershell
dotnet test backend
cd frontend; npm run build
```

### Migrations

```powershell
dotnet ef migrations add <Name> --project backend/BookNook.Infrastructure --startup-project backend/BookNook.Api --output-dir Data/Migrations
dotnet ef database update --project backend/BookNook.Infrastructure --startup-project backend/BookNook.Api
```

## Deployment (Render)

The `Dockerfile` builds the frontend and API into one image, and `render.yaml` defines the service.

1. In Render, create a new Blueprint from this repository.
2. Set `ConnectionStrings__BookNook` (Neon pooled connection string) and, optionally, `GoogleBooks__ApiKey`.
3. Set `region` in `render.yaml` to match the Neon database.

Migrations run on startup. The health check is `/api/health`. Auth keys are stored in the database,
so sessions persist across deploys. Free instances sleep when idle, so the first request after a
quiet period is slow.

To test the image locally:

```powershell
docker build -t nook .
docker run -p 8080:8080 -e ConnectionStrings__BookNook="..." nook
```

## Admin commands

These run against the database configured in user-secrets. Stop the dev API first.

```powershell
dotnet run --project backend/BookNook.Api -- reset-password <email>   # prints a temporary password
dotnet run --project backend/BookNook.Api -- delete-user <email>
dotnet run --project backend/BookNook.Api -- delete-guests
```

There is no email sending, so password resets go through `reset-password`. Render's free plan
blocks SMTP; an HTTPS email API such as Resend would be needed to add self-service resets.

## Implementation notes

- **Guest mode:** creates a temporary account with sample data. Guest accounts are deleted after
  24 hours. Sign-ups are rate limited per IP.
- **Covers:** served through `/api/books/{id}/cover`, so share images can be exported from the canvas.
- **Share images:** rendered client-side at 1080×1920 or 1080×1350 (`frontend/src/lib/shareImage.ts`).
- **Themes:** Classic, Vaporwave, Monochrome and Cosy pastel, defined as CSS variables in
  `frontend/src/index.css`. The selected theme is stored in `localStorage`.
- **Installable app:** web app manifest and icons in `frontend/public`. There is no offline support.
- **Fonts:** Fraunces and Inter, from Google Fonts.
