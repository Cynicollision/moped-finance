# Development

The API and Postgres run in Docker with hot reload; the Angular dev server runs on the host.

## Prerequisites

- Node.js 22
- Docker with Compose v2 (Docker Desktop, or Docker Engine on Linux)

Any OS works. Development has mostly happened on Windows with Docker Desktop's WSL2 backend. That's why nodemon polls for changes (`--legacy-watch`): file-change events don't reliably reach containers through Windows bind mounts. Polling also works on macOS and Linux.

## First-time setup

1. Copy `.env.example` to `.env` and fill in the Postgres credentials, `SESSION_SECRET`, and the `SEED_USER_*` values. The compose file sets `PGHOST` inside the container, so `.env` only needs it for running scripts from the host.
2. Install dependencies: `npm ci` in both `client/` and `server/`. The API container installs its own, but the host copies are needed for editor support and tests.
3. Start the stack: `docker compose up -d`.
4. Create the tables and seed a user plus sample data: `docker compose exec api npm run db:reset`.

## Day to day

| What | Command | Notes |
|---|---|---|
| Start API + DB | `docker compose up -d` | API on :3000, Postgres on :5432 |
| Rebuild after dependency or Dockerfile changes | `docker compose up -d --build` | |
| API logs | `docker compose logs -f api` | |
| Stop | `docker compose down` | Data stays in the `moped-finance_db_data` volume |
| Client | `npm start` in `client/` | http://localhost:4200, `development` configuration |
| Client in demo mode | `npx ng serve --configuration demo` in `client/` | No API needed |

**Hot reload:** nodemon polls `server/` and `shared/` inside the container (`server/nodemon.json`) and restarts on `.ts` changes. Each restart takes about 15 seconds because ts-node type-checks on startup. A compile error leaves the API down until the next save; check the logs.

**Debugging the API:** the container exposes the Node inspector on :9229. In VS Code, use the "Attach to Node.js (Docker)" launch configuration.

## Database scripts

Run these inside the API container (`docker compose exec api npm run <script>`). Each has `:core` and `:finance` variants, such as `db:reset:finance`.

| Script | Does |
|---|---|
| `db:init` | Creates schemas and tables from `server/scripts/schema_*.sql` |
| `db:seed` | Adds the `SEED_USER_*` user and sample finance data |
| `db:drop` | Drops the schemas and **all data** |
| `db:reset` | `drop`, then `init`, then `seed` |

There are no migrations yet. After changing a table, update both the SQL file and the Drizzle `*-schema.ts`, then reset (see [architecture.md](architecture.md#database)).

## Before opening a PR

- `npm test` in `server/`, and `npx tsc --noEmit` in `server/`
- `npx ng test --watch=false` and `npx ng build` in `client/`

See [testing.md](testing.md) for how the tests are set up.
