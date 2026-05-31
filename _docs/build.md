# Build & Deployment

This document covers the build pipeline, Docker image management, and deployment to the Synology NAS.

## Pipeline Overview

```
Push to main → GitHub Actions CI → Run Tests → Build Docker Image → Push to GHCR
                                                                          ↓
                                              NAS: docker pull → docker-compose up
```

1. **Push to `main`** triggers the CI workflow (`.github/workflows/ci.yml`)
2. **Tests run** — server-side Jest tests must pass before the image builds
3. **Docker image builds** — the multi-stage `Dockerfile` compiles the Angular frontend, compiles the TypeScript backend (without source maps), and produces a lean production image
4. **Image pushes to GHCR** — tagged as `latest` and with the commit SHA
5. **On the NAS** — pull the new image and restart the containers

## Multi-Stage Dockerfile

The `Dockerfile` uses three stages to produce a small, secure production image:

| Stage | Name | Purpose |
|-------|------|---------|
| 1 | `client-builder` | Installs Angular dependencies and builds the frontend |
| 2a | `server-deps` | Installs all server dependencies (dev compose targets this stage) |
| 2b | `server-builder` | Copies server source and compiles TypeScript with production config |
| 3 | *(final)* | Installs only production dependencies, copies build artifacts, runs as non-root user |

### Development vs Production

| Aspect | Development | Production |
|--------|------------|------------|
| Compose file | `docker-compose.yml` | `docker-compose.prod.yml` |
| Dockerfile target | `server-deps` (Stage 2a) | Full build (all stages) |
| TypeScript | `ts-node` via nodemon (no compilation) | `tsc` via `tsconfig.prod.json` (no source maps) |
| Angular | `ng serve` locally (port 4200) | Built and served as static files by Express |
| Debug port | 9229 exposed | Not exposed |
| Source volumes | Mounted from host | Not mounted (baked into image) |

## GitHub Container Registry (GHCR)

Images are stored at: `ghcr.io/cynicollision/homelab`

GHCR is included with GitHub — even for private repos, you get 500MB storage and 1GB data transfer/month at no cost. A single app image is typically 100-200MB.

### Image Tags
- **`latest`** — always points to the most recent build from `main`
- **`<commit-sha>`** — every build is also tagged with its commit SHA for traceability and rollback

## Deploying to the Synology NAS

> [!TIP]
> **Recommended for Synology NAS users:** A comprehensive, step-by-step, beginner-friendly guide is available at [nas-deployment.md](file:///c:/code/HomeLab/_docs/nas-deployment.md). It details how to set up GHCR private registries in the Synology DSM GUI, prepare your `.env` file, and initialize/seed your database correctly.

### Prerequisites
- Docker and Docker Compose installed on the NAS
- A `.env` file on the NAS with production values (see `.env.example` for template)
- Network access to `ghcr.io` (the NAS must be able to pull images from the internet)

### First-Time Setup

1. **Create a project directory** on the NAS:
   ```bash
   mkdir -p /volume1/docker/homelab
   cd /volume1/docker/homelab
   ```

2. **Copy files to the NAS** — you need two files:
   - `docker-compose.prod.yml`
   - `.env` (copy from `.env.example` and fill in production values)

   You can use SCP, the Synology File Station, or any file transfer method:
   ```bash
   scp docker-compose.prod.yml .env your-nas:/volume1/docker/homelab/
   ```

3. **Set the Docker image** in your `.env` file:
   ```
   DOCKER_IMAGE=ghcr.io/cynicollision/homelab:latest
   ```

4. **Authenticate with GHCR** (required once for private repos):
   ```bash
   # Create a Personal Access Token (PAT) on GitHub with read:packages scope
   # https://github.com/settings/tokens/new?scopes=read:packages
   echo "YOUR_PAT" | docker login ghcr.io -u cynicollision --password-stdin
   ```

5. **Pull the image and start the services:**
   ```bash
   docker pull ghcr.io/cynicollision/homelab:latest
   docker-compose -f docker-compose.prod.yml up -d
   ```

6. **Initialize the database** (first time only):

   The database starts empty. You need to run the initialization and seed scripts inside the running API container. These scripts create the PostgreSQL schemas and populate them with initial data.

   ```bash
   # Initialize all schemas (core, finance, grounds)
   docker-compose -f docker-compose.prod.yml exec api npx ts-node -r tsconfig-paths/register scripts/init-core-db.ts
   docker-compose -f docker-compose.prod.yml exec api npx ts-node -r tsconfig-paths/register scripts/init-finance-db.ts
   docker-compose -f docker-compose.prod.yml exec api npx ts-node -r tsconfig-paths/register scripts/init-grounds-db.ts

   # Seed initial data (creates default user, etc.)
   docker-compose -f docker-compose.prod.yml exec api npx ts-node -r tsconfig-paths/register scripts/seed-core-db.ts
   docker-compose -f docker-compose.prod.yml exec api npx ts-node -r tsconfig-paths/register scripts/seed-finance-db.ts
   docker-compose -f docker-compose.prod.yml exec api npx ts-node -r tsconfig-paths/register scripts/seed-grounds-db.ts
   ```

   > **Note:** The production image only has production dependencies (`--omit=dev`), so `ts-node` is not available. If these commands fail, you have two options:
   > - **Option A:** Pre-compile the scripts as part of the Docker build and run them with `node` instead of `ts-node`
   > - **Option B:** Connect to Postgres directly and run the raw SQL schema files:
   >   ```bash
   >   docker-compose -f docker-compose.prod.yml exec postgres psql -U $PGUSER -d $PGDATABASE -f /path/to/schema_core.sql
   >   ```
   >   You would need to mount the SQL files into the Postgres container, or copy them in manually.
   >
   > For the simplest first-time setup, the recommended approach is to connect directly to Postgres and apply the SQL schemas manually, then seed data through the application's API or a direct SQL insert for the initial user.

7. **Verify** the app is running:
   ```bash
   curl http://localhost:3000/api/healthcheck
   ```

### Updating (Subsequent Deployments)

```bash
cd /volume1/docker/homelab
docker pull ghcr.io/cynicollision/homelab:latest
docker-compose -f docker-compose.prod.yml up -d
```

The database volume (`db_data`) persists across container restarts, so your data is safe.

## Testing the Production Build Locally

To verify the production image works before pushing:

```bash
# Build the image locally
docker build -t home-lab-api:latest .

# Start with the production compose (uses locally-built image)
docker-compose -f docker-compose.prod.yml up -d

# Verify
curl http://localhost:3000/api/healthcheck

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

## Environment Variables (Production)

The `.env` file on the NAS should contain all variables from `.env.example`. Key production considerations:

| Variable | Production Notes |
|----------|-----------------|
| `PGUSER`, `PGPASSWORD` | Use strong, unique credentials |
| `PGDATABASE` | Same database name as dev, or a production-specific name |
| `SESSION_SECRET` | Must be a long, random string (not the dev default) |
| `COOKIE_SECURE` | Set to `false` for HTTP-only local network. Set to `true` if you add HTTPS |
| `DOCKER_IMAGE` | Set to `ghcr.io/cynicollision/homelab:latest` |
| `NODE_ENV` | Set automatically by the compose file (`production`) |
| `PGHOST` | Set automatically by the compose file (`postgres`) |
