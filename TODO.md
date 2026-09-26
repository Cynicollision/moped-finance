# TODO / Backlog

Work items and ideas, grouped by priority. Move items up or down as priorities change; delete them once done (git history is the changelog).

- **Now**: re-establishing a solid baseline. Do these before new feature work.
- **Next**: hardening and finishing the core app (manual entry, import/export).
- **Later**: bigger features that need design first.
- **Ideas**: unsorted thoughts, not yet committed to.

---

## Now

### Production build
The production setup was written but never run; only the dev compose stack (API with nodemon hot reload + Postgres) has been used and is verified working. The production image builds but doesn't start: `docker build .` then `docker run` fails with `Cannot find module '/app/server/dist/index.js'`.
- [ ] `CMD ["node", "dist/index.js"]` (and `main` in `server/package.json`) is wrong: because the server imports `../shared`, tsc emits to `dist/server/index.js` and `dist/shared/`.
- [ ] The `@server/*` / `@shared/*` path aliases aren't rewritten in the compiled output, so `node dist/server/index.js` fails with `Cannot find module '@server/api'`. Rewrite them at build time (e.g. `tsc-alias`) or bundle the server (e.g. esbuild).
- [ ] Static files don't line up: Angular's application builder writes to `dist/moped-finance/browser/`, the Dockerfile copies `dist/moped-finance` to `server/public` (so `index.html` ends up in `server/public/browser/`), and Express serves `path.join(__dirname, 'public')`, which resolves to `dist/server/public`. Pick one location and make all three agree.
- [ ] The client hardcodes `apiUrl: 'http://localhost:3000'` in both `environment.ts` (production) and `environment.development.ts`, so a production browser would call its own machine. Use relative URLs (`apiUrl: ''`) so the app talks to the origin that served it, and in development route through the dev-server proxy. `client/proxy.conf.json` exists but is unused, and it only covers `/api` while auth is mounted at `/auth`. With same-origin requests the server-side CORS setup can likely go.
- [ ] Add a CI smoke test: build the image, start it, and check that `/` returns `index.html`.

### Tests
- [ ] Fix the client test `App > should render sidenav container` in `client/src/app/app.spec.ts`. The hand-rolled Router mock is missing `createUrlTree`; use `provideRouter([])` instead of mocking `Router`.

### CI
- [ ] Add client tests (`ng test --watch=false`) to `.github/workflows/ci.yml`.
- [ ] Add a server type-check (`tsc --noEmit`) and a client production build (`ng build`) to CI.

### GitHub
- [ ] Optional: install the Claude GitHub App (`/install-github-app` from a `claude` terminal session).
- [ ] Protect `main`: require CI to pass; work on feature branches through PRs.

---

## Next

### Design decisions
From a review of the code, the schema, and the requirements' Observations (2026-09-25). Decide these first, since they shape the refactors below. Record each decision in `docs/` (architecture or the relevant requirement) once it's made.
- [ ] **What "hidden" means.** Hidden accounts still count in totals (ACCT-1.9). Hidden transactions still count in Cashflow and can't be un-hidden in the UI (TXN, CASH observations). Pick one meaning per record type ("exclude from totals and reports" or "declutter the list"), apply it consistently, and add a "show hidden" toggle.
- [ ] **Sign conventions.** Transactions are signed (money out is negative), liability balances are stored negative, and budget amounts are always positive with direction taken from their type. The UI mostly hides signs (TXN, DASH, BUD observations). Write down one rule set, and have forms and imports enforce it, e.g. an In/Out toggle instead of a signed amount field.
- [ ] **Transfers and debt paydown.** Transfer groups don't show on the Categories screen (CAT-1.11), and extra mortgage principal counts as spending in Cashflow (CASH observations). Decide how transfers and principal payments are modeled before building budget-vs-actual.
- [ ] **Where balances come from.** Balances only come from imported history. The account form's Balance field is discarded (ACCT-2.2), and transactions never change balances. Option 1: balance history is the source of truth, plus an "Update balance" action (simplest, fits manual tracking). Option 2: derive balances from transactions.
- [ ] **Net-worth series.** The chart adds up whatever entries exist on each date, so accounts updated on different days make the total jump (DASH observations). Carry each account's last known balance forward into each day, week or month when building the series.
- [ ] **Split transactions.** `is_split`/`split_parent_id` exist but have no UI or behavior. Design splits or drop the columns.
- [ ] **Budget vs actual.** Budget and Cashflow are unconnected (BUD, CASH observations). Decide whether budgets are compared with actual spending per category and period; this drives the budget screen redesign below.
- [ ] **Category lifecycle.** There's no delete in the UI. Deleting a category through the API orphans its transactions (which then vanish from the list) and its budget streams. Inactive categories still appear in pickers. New users start with no categories (CAT observations). Decide delete behavior (block, reassign, or archive only) and whether to seed default categories.

### Server refactors
- [ ] Validate referenced IDs and return a 400 instead of a foreign-key 500: the institution on account create/update, the category on transaction and budget-stream create/update (ACCT, BUD, TXN observations).
- [ ] Move CSV parsing, validation and export out of the account and transaction controllers into a small import/export module that reports row-level errors. Today a bad date causes a 500 and a non-numeric amount becomes 0. Do this together with the partial-import and bulk-insert items under Correctness.
- [ ] Remove the `as any` casts in routes (e.g. `req.query as any` in `transaction-routes.ts`); have the validator return typed, parsed values.
- [ ] The transaction list (`search` in `transaction-data.ts`) inner-joins categories, so uncategorized transactions disappear (TXN observations). Export already uses a left join; do the same here, and support sorting by category and account (TXN-1.2).

### Client: mobile and dialogs
- [ ] Define shared breakpoints: one SCSS partial or mixin plus `BreakpointObserver` in TypeScript. Components currently use ad hoc 599/600/768px media queries, and a ~800 px window with the side nav open overflows (APP observations).
- [ ] Tables on phones: Transactions, Budget, Cashflow and Account Details use `mat-table`. At handset width, switch to a list or card layout (name and amount, with a second line for date and category) instead of a table that scrolls sideways.
- [ ] Pick one pattern for create and edit. Today accounts, institutions and transactions use full pages, while budget streams, categories and groups use dialogs (`ModalService`: fixed 500px, `disableClose: true`). Suggested rule: full pages for records with many fields or that need their own URL; dialogs for small forms, full-screen on phones. Allow Esc and backdrop clicks to close unless the form has unsaved changes.
- [ ] Budget screen redesign, together with the budget-vs-actual decision: consider inline add/edit rows or a side panel instead of a dialog per stream, an empty state (BUD observations), and a layout that works on phones.
- [ ] On phones, collapse the Transactions filters into a panel or bottom sheet.

### Client refactors
- [ ] The app runs without zone.js, but component state is a mix of signals and plain fields, with manual `cdr.detectChanges()` calls in budget, cashflow, categories and transaction-form. Standardize on signals (with `OnPush`) so updates render without manual change detection.
- [ ] Replace the global loading overlay on every request (APP-2.1) with loading states or skeletons per view, so screens don't flash empty or $0.00 values that look real.
- [ ] Consistent success feedback (a snackbar) for create, save and delete (APP observations).
- [ ] Move the ~80 inline `style="..."` attributes in templates (e.g. `app.html`) into component SCSS. The two category dialog components, `chart.component.ts` and `value-period-change.component.ts` also use inline templates or styles, against `docs/conventions.md`.
- [ ] The `@client/*` path alias in `client/tsconfig.json` is unused; use it or remove it.

### UX fixes from the requirements review
- [ ] Credit-card accounts can't be created: the group has no account types, but Type is required (ACCT-1.10).
- [ ] The transaction import screen lists the wrong CSV columns and doesn't say which rows failed (TXN-3.7, TXN-3.8).
- [ ] The Settings menu item links to a route that doesn't exist (APP-1.5). Replace it with a Settings screen that has change password (AUTH-5.1) and display name.
- [ ] Chart y-axis labels repeat because they round to thousands or millions (ACCT, DASH observations).
- [ ] Choose a sort order for institutions, accounts within a group, and the category group picker (currently creation order).
- [ ] The Cashflow year list is a fixed four-year window; derive it from the data (CASH observations).
- [ ] Import breadcrumbs, the Accounts/Dashboard name mismatch, and the product name on Login/Register (APP, DASH observations).

### Data & deployment
- [ ] Add database migrations (e.g. drizzle-kit). Schema is currently applied with `CREATE TABLE IF NOT EXISTS` scripts, which can't upgrade an existing production database. The Drizzle tables already declare everything the SQL scripts do (enforced by `server/src/data/schema-parity.spec.ts`), so generate the baseline migration from Drizzle, point `db:init` and `TestDatabaseUtil.createMockDatabase` at the migrations, and delete `schema_*.sql` and the parity spec.
- [ ] Give production a working database init path. The `db:*` scripts need `ts-node`, which isn't in the production image. Options: compile the scripts into the image, or run migrations on startup.
- [ ] Safe first-user bootstrap for production. Registration closes after the first user (AUTH-2.7), so a fresh instance belongs to whoever registers first; decide whether that's acceptable on the NAS or create the owner another way. The old Gemini-era deployment docs inserted a hardcoded `admin`/`admin123` password hash; don't carry that approach forward.
- [ ] Document backup and restore for the Postgres volume.
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images).

### Security & auth
- [ ] Use a persistent session store (e.g. `connect-pg-simple`). The default in-memory store logs everyone out on every restart.
- [ ] Fail startup in production if `SESSION_SECRET` is unset; don't fall back to `'dev-secret-key'` (`server/index.ts`).

### Correctness
- [ ] `syncAccount` and `syncInstitution` are stubs that return success (`account-controller.ts:95`, `institution-controller.ts:80`). Until real sync exists, return a not-implemented result and hide/disable the sync UI. Then replace the skipped `xit('should return sync stub success')` in `institution-routes.spec.ts`.
- [ ] Balance CSV import returns `Result.success` when parsing fails; it should be a bad request (`account-controller.ts:145`).
- [ ] Decide whether balance/transaction imports allow partial success (`account-controller.ts:220`, `:240`; `transaction-controller.ts:211`).
- [ ] Bulk insert for transaction import instead of row-by-row (`transaction-controller.ts:198`).

### Testing
- [ ] Frontend coverage: services (`api`, `finance`, `auth`, `modal`, `notification`), `auth.guard`, the demo interceptor, and key components (summary, transactions, imports).
- [ ] Make server "now" injectable (via `DateTimeUtil`) so date-based logic is deterministic in tests.
- [ ] `TestExpressUtil.createMockLogger` should mock `IAppLogger`, not `AppLogger` (`server/src/utility/testing/express-util.ts:23`).

### Tooling
- [ ] Install Prettier (already configured in `client/package.json` but not a dependency) and apply it to both packages.
- [ ] Add ESLint (angular-eslint on the client, typescript-eslint on the server) and run it in CI.

### Code cleanup
- [ ] Decide whether to keep or remove the unused Gemini gateway (`server/src/gateways/`) and its `GEMINI_*` env vars.

---

## Later

### Automated bank sync
Manual entry and import/export come first. Constraints for when this gets picked up:
- **No paid subscription.** It must fit a single user on a free tier (or use a free alternative). Check the current terms before building anything.
- **Polling only.** The host isn't reachable from the internet, so no webhooks. Sync on a schedule and/or on demand.
- [ ] Write `docs/integrations/bank-sync.md` before coding: provider choice and cost, link flow, encrypted storage of access tokens, cursor-based incremental sync, mapping provider items/accounts to institutions/accounts, de-duplicating against CSV imports, and sandbox → production.
- [ ] Implement behind the existing sync endpoints.

---

## Ideas

- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Cashflow does, and round at the edges. Revisit integer cents only if totals ever drift.
- Project Claude Code skills (e.g. `new-finance-resource`, `verify`, `schema-change` once migrations exist). Skipped for now; revisit if the same multi-step instructions keep getting repeated.
