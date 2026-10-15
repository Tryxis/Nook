# Nook: one container that serves the React app and the API.
# Build:  docker build -t nook .
# Run:    docker run -p 8080:8080 -e ConnectionStrings__BookNook="..." nook

# ---- 1. Frontend: Vite writes the build into backend/BookNook.Api/wwwroot ----
FROM node:22-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Backend: restore (cached on project files), then publish ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src/backend
COPY backend/BookNook.Core/BookNook.Core.csproj BookNook.Core/
COPY backend/BookNook.Infrastructure/BookNook.Infrastructure.csproj BookNook.Infrastructure/
COPY backend/BookNook.Api/BookNook.Api.csproj BookNook.Api/
RUN dotnet restore BookNook.Api/BookNook.Api.csproj
COPY backend/ ./
COPY --from=web /src/backend/BookNook.Api/wwwroot BookNook.Api/wwwroot
RUN dotnet publish BookNook.Api/BookNook.Api.csproj -c Release -o /app --no-restore

# ---- 3. Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0
# Npgsql probes for Kerberos (GSSAPI) at startup and logs an error if the library is missing.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api /app ./
ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true
# Run as the image's built-in non-root user.
USER app
# Render tells the app which port to listen on via $PORT; default to 8080 elsewhere.
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet BookNook.Api.dll"]
