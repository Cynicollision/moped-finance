# Development

The API and Postgres run in Docker with hot reload; the Angular dev server runs on the host.

## Prerequisites

- Node.js 22
- Docker with Compose v2 (Docker Desktop, or Docker Engine on Linux)

Any OS works. Development has mostly happened on Windows with Docker Desktop's WSL2 backend. That's why nodemon polls for changes (`--legacy-watch`): file-change events don't reliably reach containers through Windows bind mounts. Polling also works on macOS and Linux.

## First-time setup

1. Copy `.env.example` to `.env` and fill in the Postgres credentials and the `SEED_USER_*` values. `SESSION_SECRET` is optional; without it the server generates one and keeps it in the database. The compose file sets `PGHOST` inside the container, so `.env` only needs it for running scripts from the host.
2. Install dependencies: `npm ci` in the repository root (Prettier), `client/` and `server/`. The API container installs its own, but the host copies are needed for editor support and tests. Optionally, `git config blame.ignoreRevsFile .git-blame-ignore-revs` makes `git blame` skip formatting-only commits, as GitHub does.
3. Start the stack: `docker compose up -d`.
4. Seed a user plus sample data: `docker compose exec api npm run db:seed`. The API creates the tables itself when it starts.

## Day to day

| What | Command | Notes |
|---|---|---|
| Start API + DB | `docker compose up -d` | API on :3000, Postgres on :5432 |
| Rebuild after dependency or Dockerfile changes | `docker compose up -d --build` | |
| API logs | `docker compose logs -f api` | |
| Stop | `docker compose down` | Data stays in the `moped-finance_db_data` volume |
| Client | `npm start` in `client/` | http://localhost:4200, `development` configuration; proxies API calls to :3000 |
| Client in demo mode | `npx ng serve --configuration demo` in `client/` | No API needed |

**Hot reload:** nodemon polls `server/` and `shared/` inside the container (`server/nodemon.json`) and restarts on `.ts` changes. Each restart takes about 15 seconds because ts-node type-checks on startup. A compile error leaves the API down until the next save; check the logs.

The container runs whatever is in your working tree, so switching branches switches the running API too. On restart it applies any migrations the branch adds (APP-5.8). Migrations only go forward, so switching back to a branch without them leaves the newer tables in place; `db:reset` if that gets in the way.

**Debugging the API:** the container exposes the Node inspector on :9229. In VS Code, use the "Attach to Node.js (Docker)" launch configuration.

## Database scripts

Run these inside the API container (`docker compose exec api npm run <script>`), except `db:generate`, which doesn't need a database and runs anywhere.

| Script | Does |
|---|---|
| `db:generate` | Writes a migration for Drizzle table changes to `server/migrations/` |
| `db:migrate` | Applies pending migrations (the API also does this on startup) |
| `db:seed` | Adds the `SEED_USER_*` user and the synthetic sample data in `server/seed-data/` (about two years up to the debug "today"). `db:seed:core` and `db:seed:finance` do one part; `db:seed:finance` needs an empty finance schema |
| `db:drop` | Drops the `core`, `finance` and `drizzle` schemas: **all data** and the migration history |
| `db:reset` | `drop`, then `migrate`, then `seed` |

A database created before migrations existed (by the old `db:init`) can't be migrated, since its tables already exist; run `db:reset` once.

### Changing the schema

1. Change the Drizzle table in `*-schema.ts` (see [architecture.md](architecture.md#schema-and-migrations)).
2. `npm run db:generate -- --name <what_changed>` in `server/`. Read the SQL it writes; drizzle-kit asks interactively when it can't tell a rename from a drop and add.
3. Commit the SQL file and the updated `migrations/meta/`. The API restarts on the new `.sql` file and applies it.

drizzle-kit can't ask its rename question without a terminal. To write a rename by hand, add the SQL file, copy the last snapshot with the change applied (new `id`, `prevId` set to the old `id`), and add a journal entry. Give the entry a `when` later than the previous one and no later than now: Drizzle applies a migration only if its `when` is later than the last one applied, so a future `when` makes it skip every migration generated after it. Then check that `npx drizzle-kit generate` reports no schema changes.

To change data rather than the schema, `npm run db:generate -- --custom --name <what_changed>` writes an empty SQL file to fill in. Test it in `src/data/migrations.spec.ts`, which sets up data as it was before and runs the file's SQL again.

Don't edit a migration once it's merged: databases that already ran it won't run it again. Fix mistakes with a new migration. If `main` gained a migration while your branch had one, delete yours, merge `main`, and generate again, since migrations are numbered and applied in order.

## Client scripts

Run these in `client/`.

| Script | Does |
|---|---|
| `emoji-data` | Writes the category emoji picker's data (CAT-1.20), `public/emoji/data.json`, from the `emoji-picker-element-data` package, leaving out flags |

The emoji data is committed, so every build serves the same file. Run `npm run emoji-data` and commit the result whenever `emoji-picker-element-data` changes version (an `npm update`, or bumping it in `package.json`), or after changing what `scripts/emoji-data.mjs` leaves out. CI fails if the committed file doesn't match the installed package.

## Before opening a PR

- `npm run format` in the repository root (or `npm run format:check` to only check)
- `npm test`, `npx tsc --noEmit` and `npm run lint` in `server/` (the lint covers `shared/` too)
- `npx ng test --watch=false`, `npx ng lint` and `npx ng build` in `client/`

See [testing.md](testing.md) for how the tests are set up.

`main` has a ruleset ("Protect main": pull request required, CI passing, branch up to date, no force pushes). GitHub doesn't enforce rulesets on a private repository on the free plan, so it only takes effect if the repository becomes public or moves to GitHub Pro. Follow it anyway.
