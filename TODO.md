# TODO / Backlog

Work items and ideas, grouped by priority. Move items up or down as priorities change; delete them once done (git history is the changelog).

- **Now**: re-establishing a solid baseline. Do these before new feature work.
- **Next**: hardening and finishing the core app (manual entry, import/export).
- **Later**: bigger features that need design first.
- **Ideas**: unsorted thoughts, not yet committed to.

---

## Now

Nothing right now: the client baseline is done. Pull the next item up from Next.

---

## Next

### Data & deployment
- [ ] Document backup and restore for the Postgres volume, including a backup before updates that add migrations (they only go forward). Include retention for `core.logs`, which grows without bound (errors are logged to the database).
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images).

### Testing
- [ ] Frontend coverage: services (`api`, `finance`, `auth`), `auth.guard`, the demo interceptor, and key components (transactions, imports).
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
- [ ] Re-evaluate Chart.js when Spending gets more report and chart types (trends over months, category breakdowns). Compare it with alternatives such as ECharts on the chart types needed, touch interaction and bundle size. Chart.js stays until then (decided 2026-09-27).

### Demo mode
- [ ] Populate demo mode from `server/seed-data/` (APP-4.3): `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete.

---

## Ideas

- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Spending does, and round at the edges. Revisit integer cents only if totals ever drift.
- Project Claude Code skills (e.g. `new-finance-resource`, `verify`, `schema-change` once migrations exist). Skipped for now; revisit if the same multi-step instructions keep getting repeated.
- Spending compares an unfinished period with its whole budget (CASH-1.10), so mid-month nearly everything reads as under. A pace marker (how far through the period today is), or a pro-rated budget for the current period, would make it fairer. `spending.component.ts`, `difference`.
- Warn before reloading or closing the tab with unsaved changes (`beforeunload`). APP-2.7 covers only leaving within the app.
