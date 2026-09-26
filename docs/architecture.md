# Architecture

Moped Finance is a single-user personal finance app: an Angular client, a Node/Express API, and PostgreSQL. It's one repo with three TypeScript packages.

| Folder | What | Key tech |
|---|---|---|
| `client/` | Web UI | Angular 21, Angular Material, Vitest |
| `server/` | REST API; also serves the built client in production | Express 4, Drizzle ORM, express-session, Jest + PGlite |
| `shared/` | Types, enums and API contracts used by both | Plain TypeScript, no runtime dependencies |

## Path aliases

| Alias | Resolves to | Used in |
|---|---|---|
| `@shared/*` | `shared/*` | client and server |
| `@server/*` | `server/src/*` | server |

Aliases are set in each package's `tsconfig.json`, and in `server/jest.config.js` for tests.

## Server

```
server/
  index.ts          app setup: session, CORS, routers, static files
  src/api/<domain>/ finance endpoints, one folder per domain
  src/auth/         login/register/session, auth middleware, users
  src/data/         DatabaseClient, EntityId, entity factories
  src/routing/      OperationHandler, Result factory, request validation
  src/logging/      logger (console and/or core.logs table)
  src/utility/      DateTimeUtil, test helpers
  scripts/          SQL schema + init/seed/drop scripts
```

### Request flow

Each finance domain (`accounts`, `budget`, `categories`, `institutions`, `transactions`) has the same layers:

1. **`*-routes.ts`**: defines Express routes, validates the request with Zod (`validator.body/query`), and hands a callback to `OperationHandler.execute`.
2. **`*-controller.ts`**: business rules, such as returning `Result.userErrorNotFound()` when a requested resource doesn't exist. Returns an `OperationResult` built with `Result.success(...)`, `Result.userErrorNotFound(...)` and similar; never touches `res`.
3. **`*-data.ts`**: Drizzle queries, mapping rows to `@shared` types. Each domain's `IFinance*Data` interface declares its own methods, typically `retrieveAll`, `retrieveSingle`, `insert`, `update` and `delete`.
4. **`*-schema.ts`**: Drizzle table definitions and `drizzle-zod` validation schemas.

`OperationHandler` logs the operation, maps the result's `OperationStatus` to an HTTP status code, and turns thrown errors into a 500.

Routers are wired up in `server/src/api/index.ts` under `/api/v1/<resource>`, behind `resolveUser` + `requireAuth`. Auth is mounted separately at `/auth` (`login`, `register`, `registration`, `logout`, `me`, `password`) and uses a cookie session (`express-session`, in-memory store for now).

## Database

One Postgres 16 database with two schemas:

- `core`: `users`, `logs`
- `finance`: `institutions`, `accounts`, `balance_history`, `category_groups`, `categories`, `transactions`, `budget_streams`

Each instance has one owner (AUTH-7). `core.users` exists for login, and registration closes after the first user. Finance tables have no `user_id`: every signed-in request sees all finance data. `core.logs.user_id` records who performed an operation.

The schema is defined twice, and both copies must stay in sync:

- `server/scripts/schema_core.sql` and `schema_finance.sql` create the tables (`CREATE TABLE IF NOT EXISTS`). They're used by `npm run db:init` and by the in-memory test database.
- `server/src/**/*-schema.ts` are the Drizzle definitions the app queries through.

There are no migrations yet (see `TODO.md`), so changing an existing table means resetting the local database.

## Client

```
client/src/app/
  core/       API/auth services, auth guard, DateProviderService, modal, loading, demo mode
  finance/    one folder per screen area: accounts, budget, cashflow, categories,
              institutions, summary, transactions, common
  login/, register/
```

- Standalone components, routes in `app.routes.ts`.
- All HTTP goes through `core/api.service.ts`, which prefixes `Environment.apiUrl`.
- Build configurations (`client/angular.json`, `client/src/environments/`):
  - `development`: debug mode (fixed "today" of 2026-05-17 plus a badge), dev login prefilled.
  - `production`: default for `ng build`.
  - `demo`: no backend. `core/demo/demo.interceptor.ts` answers requests in the browser. Currently only auth works; everything else returns an empty list.

## Production shape

In production a single container runs the API and serves the built client from Express, next to a Postgres container. See [deployment.md](deployment.md) for status; it hasn't been run yet.
