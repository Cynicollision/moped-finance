# TODO / Backlog

Work items and ideas, grouped by priority. Move items up or down as priorities change; delete them once done (git history is the changelog).

- **Now**: re-establishing a solid baseline. Do these before new feature work.
- **Next**: hardening and finishing the core app (manual entry, import/export).
- **Later**: bigger features that need design first.
- **Ideas**: unsorted thoughts, not yet committed to.

---

## Now

Nothing right now.

---

## Next

### Client: mobile and dialogs
- [ ] Define shared breakpoints: one SCSS partial or mixin plus `BreakpointObserver` in TypeScript. Components currently use ad hoc 599/600/768px media queries, and a ~800 px window with the side nav open overflows (APP known gaps).
- [ ] Tables on phones: Transactions, Budget, Cashflow and Account Details use `mat-table`. At handset width, switch to a list or card layout (name and amount, with a second line for date and category) instead of a table that scrolls sideways.
- [ ] Pick one pattern for create and edit. Today accounts, institutions and transactions use full pages, while budget streams, categories and groups use dialogs (`ModalService`: fixed 500px, `disableClose: true`). Suggested rule: full pages for records with many fields or that need their own URL; dialogs for small forms, full-screen on phones. Allow Esc and backdrop clicks to close unless the form has unsaved changes.
- [ ] Budget screen redesign, together with BUD-1.2 and BUD-1.8 to BUD-1.10: consider inline add/edit rows or a side panel instead of a dialog per stream, an empty state (BUD known gaps), and a layout that works on phones.
- [ ] On phones, collapse the Transactions filters into a panel or bottom sheet.

### Client refactors
- [ ] The app runs without zone.js, but component state is a mix of signals and plain fields, with manual `cdr.detectChanges()` calls in budget, cashflow, categories and transaction-form. Standardize on signals (with `OnPush`) so updates render without manual change detection.
- [ ] Replace the global loading overlay on every request (APP-2.1) with loading states or skeletons per view, so screens don't flash empty or $0.00 values that look real.
- [ ] Consistent success feedback (a snackbar) for create, save and delete (APP known gaps).
- [ ] Move the ~80 inline `style="..."` attributes in templates (e.g. `app.html`) into component SCSS. The two category dialog components, `chart.component.ts` and `value-period-change.component.ts` also use inline templates or styles, against `docs/conventions.md`.
- [ ] The `@client/*` path alias in `client/tsconfig.json` is unused; use it or remove it.
- [ ] `api.service.ts` passes `withCredentials: true` on every request; it's unneeded now that requests are same-origin (relative `apiUrl` plus the dev-server proxy).

### UX fixes from the requirements review
- [ ] The import screens don't show which rows failed (TXN-3.7, ACCT-3.7): `import-transactions.component.ts` and `balance-import.component.ts` show only the dry run's `resultMessage` when `isValidToImport` is false; list `failedRowMessages` there too. The transaction import screen also lists the wrong CSV columns (TXN-3.8).
- [ ] The Cashflow year list is a fixed four-year window; derive it from the data (CASH known gaps).
- [ ] Import breadcrumbs and the product name on Login/Register (APP known gaps).
- [ ] Register screen: explain that this creates the instance's only account, which owns all its data, and that Register won't be available again afterwards (AUTH-2.8). Add it to `register.component.html` above the form.

### Data & deployment
- [ ] Document backup and restore for the Postgres volume, including a backup before updates that add migrations (they only go forward). Include retention for `core.logs`, which grows without bound (errors are logged to the database).
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images).

### Security & auth
- [ ] Use a persistent session store (e.g. `connect-pg-simple`). The default in-memory store logs everyone out on every restart.
- [ ] Fail startup in production if `SESSION_SECRET` is unset; don't fall back to `'dev-secret-key'` (`server/index.ts`).
- [ ] Session cookie: set `sameSite: 'lax'`, and make logout's `clearCookie` options match the session cookie (it uses `NODE_ENV === 'production'` for `secure`, the session uses `COOKIE_SECURE`). Document `COOKIE_SECURE` and `TRUST_FIRST_PROXY` for plain HTTP on the LAN versus a reverse proxy with HTTPS.
- [ ] Decide on HTTP Basic auth (AUTH-3.5). With one user it mainly sends the password on every request, in clear text over plain HTTP. Keep it (and state what it's for) or remove it.
- [ ] Security headers with `helmet`. Check the Content-Security-Policy against the Angular production build before enabling it.

### Correctness
- [ ] Cashflow periods include the next period's first day west of UTC (APP-5.6). `DateTimeUtil.getDatesForPeriod` sets the boundaries with local-time setters (`setDate`, `setHours(23, 59, …)`), then `retrieveCashflowByCategory` formats them with `DateTimeUtil.toDateString`, which uses UTC. With `TZ=America/New_York`, April is `2026-04-01`..`2026-05-01`, so a May 1 mortgage payment counts in April too (seen with the seed data). Build the period as calendar date strings, and add a spec that runs under a non-UTC `TZ`.
- [ ] Calendar dates are off by a day outside UTC. The API returns `date` columns as UTC-midnight timestamps (`mapRowToTransaction` in `transaction-data.ts` uses `DateTimeUtil.toISOString`; `BalanceHistory.date` and `TotalValueHistory.date` are `Date`s), so the client's date pipe and `new Date(...)` in `transaction-form.component.ts` show the previous day in US time zones. The client also sends dates with `toISOString()` (`transactions.component.ts` filters, `finance.service.ts` `fetchTotalValueHistory`, `cashflow.component.ts`), which gives the previous day east of UTC, and `fetchAccountBalanceHistory` sends `Date.toString()`. Make calendar dates plain `YYYY-MM-DD` strings in `shared/` types and both directions, and format them in the client without converting through UTC.

### Testing
- [ ] Frontend coverage: services (`api`, `finance`, `auth`, `modal`, `notification`), `auth.guard`, the demo interceptor, and key components (summary, transactions, imports).
- [ ] Make server "now" injectable (via `DateTimeUtil`) so date-based logic is deterministic in tests.
- [ ] `TestExpressUtil.createMockLogger` should mock `IAppLogger`, not `AppLogger` (`server/src/utility/testing/express-util.ts`).

### Tooling
- [ ] Install Prettier (already configured in `client/package.json` but not a dependency) and apply it to both packages. Its config doesn't set `tabWidth`, so it would default to 2 spaces; set 4 to match `docs/conventions.md` and `.editorconfig`, and move the config to a root `.prettierrc` so it covers the server too.
- [ ] Add ESLint (angular-eslint on the client, typescript-eslint on the server) and run it in CI.

---

## Later

### Automated bank sync
Manual entry and import/export come first. Constraints for when this gets picked up:
- **No paid subscription.** It must fit a single user on a free tier (or use a free alternative). Check the current terms before building anything.
- **Polling only.** The host isn't reachable from the internet, so no webhooks. Sync on a schedule and/or on demand.
- [ ] Write `docs/integrations/bank-sync.md` before coding: provider choice and cost, link flow, encrypted storage of access tokens, cursor-based incremental sync, mapping provider items/accounts to institutions/accounts, de-duplicating against CSV imports, and sandbox → production.
- [ ] Implement behind the existing sync endpoints.

### Demo mode
- [ ] Populate demo mode from `server/seed-data/` (APP-4.3): `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete.

---

## Ideas

- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Cashflow does, and round at the edges. Revisit integer cents only if totals ever drift.
- Project Claude Code skills (e.g. `new-finance-resource`, `verify`, `schema-change` once migrations exist). Skipped for now; revisit if the same multi-step instructions keep getting repeated.
