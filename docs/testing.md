# Testing

| Package | Runner | Command | CI |
|---|---|---|---|
| `server/` | Jest + Supertest | `npm test` (`npm run test:watch` to watch) | Yes |
| `client/` | Vitest (via `ng test`) | `npx ng test --watch=false` | Not yet (see `TODO.md`) |

## Server

Tests are route-level integration tests against a real, in-memory Postgres ([PGlite](https://pglite.dev)). They don't mock the data layer or need Docker.

Always run them with `npm test` (or `npm test -- <path>` for a subset). The script sets `NODE_OPTIONS=--experimental-vm-modules`, which PGlite needs; plain `npx jest` fails every suite with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`, which looks like a real breakage.

The pattern, as used by every `server/src/**/*-routes.spec.ts`:

1. `beforeAll`: `TestDatabaseUtil.createMockDatabase()` creates a PGlite database from `server/scripts/schema_*.sql`. Then create a test user, construct the real `*Data` classes, build the router, and wrap it with `TestExpressUtil.createTestApp(router, '/path', userId)`. That wrapper sets `req.user`, standing in for the auth middleware.
2. `beforeEach`: `TestDatabaseUtil.clearFinanceData(pglite)` and insert the rows the test needs, using the `FinanceEntityFactory` helpers.
3. Tests: make requests with `supertest` and assert on the status and body.
4. `afterAll`: `TestDatabaseUtil.destroyMockDatabase(pglite)`.

Finance data isn't scoped by user (AUTH-7), so there's no ownership to test. For endpoints that take an ID, test that a missing one returns 404. For a new unique constraint, test that a duplicate returns 400 with its message. To test how an operation behaves when the database fails part way (for example that an import rolls back), add a PL/pgSQL trigger that raises on a chosen row, and drop it in a `finally` (see the import tests in `transaction-routes.spec.ts`). `server/src/data/database-error-util.spec.ts` also checks that every unique index and foreign key in the schema has a message in `DatabaseErrorUtil`.

`server/src/data/schema-parity.spec.ts` isn't a route test: it compares the SQL scripts with the Drizzle tables (see [architecture.md](architecture.md#database)). Add new tables to its list.

Dates: server code gets "now" from `DateTimeUtil.now()`, which isn't injectable yet. Tests that depend on the current period should pass an explicit date (for example the `asOfDate` query param) instead of relying on the real clock.

## Client

Specs sit next to components and services and run in Vitest through the Angular builder. Coverage is thin so far (see `TODO.md`). Prefer Angular's real providers (`provideRouter([])`, `provideHttpClient()` + `provideHttpClientTesting()`) over hand-written mocks of framework classes.
