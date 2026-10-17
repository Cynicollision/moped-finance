# Testing

| Package | Runner | Command | CI |
|---|---|---|---|
| `server/` and `shared/` | Jest + Supertest | `npm test` in `server/` (`npm run test:watch` to watch) | Yes |
| `client/` | Vitest (via `ng test`) | `npx ng test --watch=false` | Yes |

## Server

Tests are route-level integration tests against a real, in-memory Postgres ([PGlite](https://pglite.dev)). They don't mock the data layer or need Docker.

Always run them with `npm test` (or `npm test -- <path>` for a subset). The script sets `NODE_OPTIONS=--experimental-vm-modules`, which PGlite needs; plain `npx jest` fails every suite with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`, which looks like a real breakage.

The pattern, as used by every `server/src/**/*-routes.spec.ts`:

1. `beforeAll`: `TestDatabaseUtil.createMockDatabase()` creates a PGlite database and applies `server/migrations/`. Then create a test user, construct the real `*Data` classes, build the router, and wrap it with `TestExpressUtil.createTestApp(router, '/path', userId)`. That wrapper sets `req.user`, standing in for the auth middleware.
2. `beforeEach`: `TestDatabaseUtil.clearFinanceData(pglite)` and insert the rows the test needs, using the `EntityFactory` helpers.
3. Tests: make requests with `supertest` and assert on the status and body.
4. `afterAll`: `TestDatabaseUtil.destroyMockDatabase(pglite)`.

Finance data isn't scoped by user (AUTH-7), so there's no ownership to test. For endpoints that take an ID, test that a missing one returns 404. For a new unique constraint, test that a duplicate returns 400 with its message. To test how an operation behaves when the database fails part way (for example that an import rolls back), add a PL/pgSQL trigger that raises on a chosen row, and drop it in a `finally` (see the import tests in `transaction-routes.spec.ts`). `server/src/data/database-error-util.spec.ts` also checks that every unique index and foreign key in the schema has a message in `DatabaseErrorUtil`.

Dates: server code gets "now" and "today" from `DateTimeUtil`. To test behaviour that depends on the time (a default period, token expiry), fix it with `DateTimeUtil.setClock(new Date('2026-05-01T12:00:00Z'))` and move it on with another call (`api-token-routes.spec.ts`). A setup file (`server/src/utility/testing/jest-setup.ts`) puts the real clock back after every test. It doesn't stop timers, unlike Jest's fake timers, so PGlite and Supertest keep working.

`shared/` has no runner of its own: its specs (`shared/**/*.spec.ts`) run with the server's Jest.

## Time zone

Both test runs set `TZ=America/New_York` before any test starts (`server/jest.config.js`, `client/vitest-base.config.mjs`), so they run west of UTC wherever they run, CI included. A calendar date read as UTC midnight is the previous day there, and a server day boundary built in local time spills into the next day, so those mistakes fail tests. Set it there, not in a test: Jest gives each test file its own copy of `process.env`, so a test can't change the zone. The matching mistake east of UTC, `toISOString()` on a local date, is caught by client lint instead.

## Client

Specs sit next to components and services and run in Vitest through the Angular builder. Prefer Angular's real providers (`provideRouter([])`, `provideHttpClient()` + `provideHttpClientTesting()`) over hand-written mocks of framework classes. Test a service through `HttpTestingController`, checking the URL and body it sends (`finance.service.spec.ts`), and a guard with `TestBed.runInInjectionContext` (`auth.guard.spec.ts`). To test a screen, provide a `FinanceService` stub whose methods resolve with data, create the component and `await fixture.whenStable()`, then check the rendered DOM, which is what the user sees once the screen loads (`dashboard.component.spec.ts`, `spending.component.spec.ts`); `whenStable` also waits for `viewResource` loads. To see a screen's placeholders, have the stub return a promise that never settles and call `fixture.detectChanges()` instead of `whenStable` (which would wait for it); to see its load error, use `mockRejectedValue` rather than a `Promise.reject` made up front, which Vitest reports as unhandled. After resolving a pending save, await that promise before `whenStable`, so the component has carried on past its own `await` (`edit-transaction.component.spec.ts`). To test routing (redirects, guards, tab titles) without loading screens, swap each route's component for an empty one and navigate with `RouterTestingHarness` (`app.routes.spec.ts`). For layout that depends on the window size, provide a `LayoutService` stub with a `sizeClass` signal (`app.spec.ts`). A bottom sheet or dialog only finishes closing with Material's animations off (`{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }`, `transactions.component.spec.ts`). The narrow layouts are CSS container queries, which jsdom doesn't apply, so check them in the browser. The unit tests don't load the global stylesheet; `styles.spec.ts` compiles `styles.scss` with Sass and adds it ahead of the component styles, as the app has them. jsdom applies the cascade but doesn't resolve `var()`, so it checks which Material tokens reach an element rather than its final colour.
