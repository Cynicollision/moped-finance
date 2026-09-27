# TODO / Backlog

Work items and ideas, grouped by priority. Move items up or down as priorities change; delete them once done (git history is the changelog).

- **Now**: re-establishing a solid baseline. Do these before new feature work.
- **Next**: hardening and finishing the core app (manual entry, import/export).
- **Later**: bigger features that need design first.
- **Ideas**: unsorted thoughts, not yet committed to.

---

## Now

### Client baseline
A series of PRs, in this order, that gives the client consistent, tested patterns to build features on (decided 2026-09-27). The target shape:
- Navigation: **Dashboard** (renamed from Summary, at `/dashboard`, matching `DASH` and `dashboard.md`), **Transactions**, **Cashflow**, **Budget**. Phones get a bottom navigation bar with those four; Settings and Sign out stay in the profile menu, opened from an avatar button in the page header, not a tab, so they're harder to reach by accident. Tablets get a navigation rail and desktops the side navigation.
- Settings becomes a hub with sub-pages: Institutions (today's Institutions screen, listing every account including hidden and closed ones), Categories, API Tokens, and later Rules, Profile and Appearance.
- The Dashboard keeps grouping accounts by type (DASH-2) and gets an **Add account** action; the account form gains an Institution select.
- Bank-connection UI is removed until INST-2 is redesigned. No disabled "coming soon" controls.
- Each PR adds specs for what it touches (see Testing).

1. [ ] **Calendar dates as strings.**
   - Dates are off by a day outside UTC. The API returns `date` columns as UTC-midnight timestamps (`mapRowToTransaction` in `transaction-data.ts` uses `DateTimeUtil.toISOString`; `BalanceHistory.date` and `TotalValueHistory.date` are `Date`s), so the client's date pipe and `new Date(...)` in `transaction-form.component.ts` show the previous day in US time zones. The client also sends dates with `toISOString()` (`transactions.component.ts` filters, `finance.service.ts` `fetchTotalValueHistory`, `cashflow.component.ts`), which gives the previous day east of UTC, and `fetchAccountBalanceHistory` sends `Date.toString()`. Make calendar dates plain `YYYY-MM-DD` strings in `shared/` types and both directions, and format them in the client without converting through UTC.
   - Cashflow periods include the next period's first day west of UTC (APP-5.6). `DateTimeUtil.getDatesForPeriod` sets the boundaries with local-time setters (`setDate`, `setHours(23, 59, ...)`), then `retrieveCashflowByCategory` formats them with `DateTimeUtil.toDateString`, which uses UTC. With `TZ=America/New_York`, April is `2026-04-01`..`2026-05-01`, so a May 1 mortgage payment counts in April too (seen with the seed data). Build the period as calendar date strings, and add a spec that runs under a non-UTC `TZ`.
2. [ ] **App shell and navigation.**
   - The navigation above, with routes renamed and redirects from the old ones (`/summary`, `/institutions/...`, `/categories`).
   - One page header component on every screen: title, breadcrumbs (a back arrow on phones), and a slot for a primary action and an overflow menu. It replaces each screen's own `desktop-page-title` and `hide-on-mobile` markup and the shell's handset title, so the title stops moving around (APP-1.3, APP-1.8).
   - Tab titles as "Dashboard · Moped Finance" through a `TitleStrategy`, fixing "Dashboard" on the summary and the flash of the bare product name (APP-1.9).
   - Remove Add Account's mode picker (its only other option is a disabled "Connect via ... (Coming Soon)"), and the **Manual Account** checkbox and Balance field, which the server discards (ACCT known gaps).
   - The product name on Login and Register, and on Register the explanation that this creates the instance's only account, which owns all its data, and that Register won't be available again afterwards (AUTH-2.8), above the form in `register.component.html`.
   - The page header also replaces the stopgap title styles: `.header-section` and `.desktop-page-title` in `styles.scss`, and the breadcrumb rules copied into each screen's SCSS (`account-details`, `add-account`, `edit-account`, `balance-import`, `import-transactions`, and the institution and transaction pages). A long `desktop-page-title` overlaps itself when it wraps (Add Account at phone width).
   - Update APP-1, DASH, INST, SET-1.1, ACCT-1.3 and the CAT screen paths.
3. [ ] **Feedback and dialogs.**
   - Replace the global loading overlay on every request (APP-2.1) with loading states or skeletons per view, so screens don't flash empty or $0.00 values that look real. Use Angular's `resource()` (or a small wrapper with the same shape) over `FinanceService`, and take loading out of `ApiService`.
   - Consistent success feedback (a snackbar) for create, save and delete (APP known gaps).
   - One pattern for create and edit: full pages for records with many fields or their own URL (account, transaction, imports), dialogs for small forms (institution, category, group, budget stream), full-screen on phones. `ModalService` (fixed 500px, `disableClose: true`) should let Esc and backdrop clicks close unless the form has unsaved changes, and then ask before discarding them. Add, view and edit institution become one dialog.
   - The category, category group and budget stream dialogs put their `modal-actions` buttons inside `<form>`, so `ModalLayoutComponent` doesn't project them into its action bar and they sit in the dialog content (`category-form-modal.component.html`, `category-group-form-modal.component.html`, `budget-form-modal.component.html`).
   - `color="warn"` does nothing under Material 3 but is still used: the Danger Zone Delete buttons (`edit-account`, `edit-institution`), Budget's Add Expense button and Delete menu item, and the import screens' warning icons. Use `danger-button` or `--color-negative`.
   - The import screens don't show which rows failed (TXN-3.7, ACCT-3.7): `import-transactions.component.ts` and `balance-import.component.ts` show only the dry run's `resultMessage` when `isValidToImport` is false; list `failedRowMessages` there too. The transaction import screen also lists the wrong CSV columns (TXN-3.8), and import breadcrumbs don't follow where the screen was opened from (APP known gaps).
4. [ ] **Lists and phones.**
   - A shared responsive list to replace `mat-table` in Transactions, Budget, Cashflow and Account Details: columns when the page area is wide; name and amount with a second line for date and category when it's narrow, instead of a table that scrolls sideways. Sortable headers when wide, a sort menu when narrow.
   - A shared money display that applies APP-6.1 and APP-6.2 ("+" and green for money in, no red for expected negatives).
   - On phones, collapse the Transactions filters into a bottom sheet.
   - The Cashflow year list is a fixed four-year window; derive it from the data (CASH known gaps), for example from the earliest transaction.
5. [ ] **Budget redesign**, with BUD-1.2 and BUD-1.10: a side panel (desktop) or full-screen dialog (phone) for adding and editing streams, an empty state (BUD known gaps), the Left over figure, and a layout that works on phones. Leave room for the 12-month averages (BUD-1.8, BUD-1.9), which need a server endpoint.
6. [ ] **Charts.** Rewrite `ChartComponent` on Chart.js: update the chart in place instead of recreating it in a `setTimeout`, resize with its container, take colours from the theme tokens instead of hard-coded dark defaults (`Chart.defaults`), and make y-axis ticks distinct (ACCT-2.12). Offer the 5- and 10-year timeframes (DASH-1.2, ACCT-2.4).

---

## Next

### Data & deployment
- [ ] Document backup and restore for the Postgres volume, including a backup before updates that add migrations (they only go forward). Include retention for `core.logs`, which grows without bound (errors are logged to the database).
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images).

### Testing
- [ ] Frontend coverage: services (`api`, `finance`, `auth`, `modal`, `notification`), `auth.guard`, the demo interceptor, and key components (transactions, imports).
- [ ] Make server "now" injectable (via `DateTimeUtil`) so date-based logic is deterministic in tests.
- [ ] `TestExpressUtil.createMockLogger` should mock `IAppLogger`, not `AppLogger` (`server/src/utility/testing/express-util.ts`).

### Tooling
- [ ] Install Prettier (already configured in `client/package.json` but not a dependency) and apply it to both packages. Its config doesn't set `tabWidth`, so it would default to 2 spaces; set 4 to match `docs/conventions.md` and `.editorconfig`, and move the config to a root `.prettierrc` so it covers the server too. Prettier always writes `} else {`, which conflicts with the convention of `else` on a new line (enforced in the client by `@stylistic/brace-style`), so decide which gives: drop the convention, or use Prettier only for HTML and SCSS. Until then the client lint checks TypeScript indentation, but nothing checks HTML or SCSS formatting.
- [ ] Add ESLint to the server (typescript-eslint, matching `client/eslint.config.js`) and run it in CI.

---

## Later

### Automated bank sync
Manual entry and import/export come first. Constraints for when this gets picked up:
- **No paid subscription.** It must fit a single user on a free tier (or use a free alternative). Check the current terms before building anything.
- **Polling only.** The host isn't reachable from the internet, so no webhooks. Sync on a schedule and/or on demand. Scheduling: a built-in timer (no setup for self-hosters) as the main schedule, with the sync endpoints also callable by an external scheduler using a Read & write API token (AUTH-11).
- [ ] Write `docs/integrations/bank-sync.md` before coding: provider choice and cost, link flow, encrypted storage of access tokens, cursor-based incremental sync, mapping provider items/accounts to institutions/accounts, de-duplicating against CSV imports, and sandbox → production.
- [ ] Implement behind the existing sync endpoints.

### Chart library
- [ ] Re-evaluate Chart.js when Cashflow gets more report and chart types (trends over months, category breakdowns). Compare it with alternatives such as ECharts on the chart types needed, touch interaction and bundle size. Chart.js stays until then (decided 2026-09-27).

### Demo mode
- [ ] Populate demo mode from `server/seed-data/` (APP-4.3): `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete.

---

## Ideas

- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Cashflow does, and round at the edges. Revisit integer cents only if totals ever drift.
- Project Claude Code skills (e.g. `new-finance-resource`, `verify`, `schema-change` once migrations exist). Skipped for now; revisit if the same multi-step instructions keep getting repeated.
