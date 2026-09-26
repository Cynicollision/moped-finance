# Testing

| Package | Runner | Command | CI |
|---|---|---|---|
| `server/` | Jest + Supertest | `npm test` (`npm run test:watch` to watch) | Yes |
| `client/` | Vitest (via `ng test`) | `npx ng test --watch=false` | Not yet (see `TODO.md`) |

## Server

Tests are route-level integration tests against a real, in-memory Postgres ([PGlite](https://pglite.dev)). They don't mock the data layer or need Docker.

The pattern, as used by every `server/src/**/*-routes.spec.ts`:

1. `beforeAll`: `TestDatabaseUtil.createMockDatabase()` creates a PGlite database from `server/scripts/schema_*.sql`. Then create a test user, construct the real `*Data` classes, build the router, and wrap it with `TestExpressUtil.createTestApp(router, '/path', userId)`. That wrapper sets `req.user`, standing in for the auth middleware.
2. `beforeEach`: `TestDatabaseUtil.clearFinanceData(pglite)` and insert the rows the test needs, using the `FinanceEntityFactory` helpers.
3. Tests: make requests with `supertest` and assert on the status and body.
4. `afterAll`: `TestDatabaseUtil.destroyMockDatabase(pglite)`.

Finance data isn't scoped by user (AUTH-7), so there's no ownership to test. For endpoints that take an ID, test that a missing one returns 404.

Dates: server code gets "now" from `DateTimeUtil.now()`, which isn't injectable yet. Tests that depend on the current period should pass an explicit date (for example the `asOfDate` query param) instead of relying on the real clock.

## Client

Specs sit next to components and services and run in Vitest through the Angular builder. Coverage is thin so far (see `TODO.md`). Prefer Angular's real providers (`provideRouter([])`, `provideHttpClient()` + `provideHttpClientTesting()`) over hand-written mocks of framework classes.
