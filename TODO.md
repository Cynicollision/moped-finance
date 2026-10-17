# TODO / Backlog

Work items and ideas, grouped by release milestone. Delete an item once it's done (git history is the changelog).

Each milestone ends with a release: a `vX.Y.0` tag and a GitHub Release (see [development.md](docs/development.md#releases)). Version 1.0 is the release that finishes the last milestone below; until then each one takes the next minor version.

| Milestone | Release | What it adds |
|---|---|---|
| [Initial release](#initial-release-v01) | v0.1 | The core app with manual accounts: every `Partial` and `Planned` requirement except the later milestones', a public repository, and a deployed image |
| [Automatic categorization](#automatic-categorization-v02) | v0.2 | Rules and learning that set categories on add, import and sync |
| [Tools](#tools-v03) | v0.3 | Reports and a retirement tracker |
| [Real estate values](#real-estate-values-v04) | v0.4 | Real Estate accounts' values from an online estimate |
| [Automated bank sync](#automated-bank-sync-v05) | v0.5 | Transactions and balances from SimpleFIN Bridge |

Within a milestone, items are listed in the order to work through them (later items build on earlier ones). Each is about a day's work or one Claude Code session, possibly several PRs. **Ideas** at the end are unsorted thoughts, not yet committed to.

---

## Initial release (v0.1)

The core application with manual accounts. Done once the items below are, the image runs on the home server, and it passes testing on a phone over the LAN.

### Public repository
Make `Cynicollision/moped-finance` public. Comes before the GHCR job below, since public images and Actions minutes follow from it. The history stays as it is (decided 2026-10-17): every PR's `refs/pull/N/head` keeps the early commits reachable anyway, and a regex scan of every branch's history that day found no secrets or personal data.
- [ ] **Scan with gitleaks** over the full history of every branch (`gitleaks detect --log-opts="--all"`), and look at anything it flags.
- [ ] **Tidy branches:** delete the merged `origin/claude/*` branches and turn on "Automatically delete head branches".
- [ ] **Review GitHub settings:** require approval for Actions on fork PRs, secret scanning with push protection, Dependabot alerts, and private vulnerability reporting. Then make it public.

### Naming
- [ ] **Drop the leftover `Finance` prefix** from when this was one app of several: components (`FinanceAccountDetailsComponent`, `FinanceBudgetComponent`, ...) and server classes (`FinanceAccountData`, `FinanceEntityFactory`, `FinanceEntityIdPrefix`, ...), whose files are already named without it. Move the client's `app/finance/*` folders up to `app/*`, beside `settings/` and `login/`. `FinanceService`, `@shared/finance` and the `finance` database schema keep the name: there it marks the domain layer as opposed to `core`.

### Fixes
- [ ] **Red menu entries** (APP-1.10, APP-2.4): the profile menu's Sign out and the records' ⋮ Delete show in the normal text colour, though APP-1.10 is marked Implemented. `.danger-item` in `styles.scss` sets `color` with the same specificity as Material's `.mat-mdc-menu-item` rule, and Material's menu styles load after the global ones, so they win (seen on Angular 21 and 22, 2026-10-17). Set the colour through `mat.menu-overrides` (`item-label-text-color`, `item-icon-color`) under `.danger-item`, and add a test that would catch it.

### Spending periods and consistency with Budget
- [ ] **Decide, then write CASH requirements.** Make the kind of period (Month / Quarter / Year / Average) more prominent than CASH-1.1's picker, which hides it behind the period row: for example a visible switch like Budget's Monthly / Quarterly / Yearly (BUD-1.6). Consider more averages than CASH-1.12's Past 12 months, such as This year (the average month so far) and All time, and what each does to Previous / Next and the drill-down to Transactions (CASH-1.6).
- [ ] **Make Spending and Budget look alike**: the same summary card layout, period switch, section headings and list columns where they show the same things (Saved vs Left over, the Essential / Discretionary headings of CASH-1.8 and BUD-1.7). Compare the two screens side by side at each breakpoint first, and write any shared pattern into conventions.md. `spending.component.*`, `budget.component.*`.

### Install as an app
- [ ] APP-9.1, 9.2: web app manifest (name, icons, theme colours, start URL), and a service worker if browsers still need one to offer installation. Choose caching so a new version shows up after an update (APP-9.2), for example Angular's `@angular/service-worker` with its update checks, or no caching at all. Installing needs HTTPS (app.md Notes), so test with `USE_HTTPS` or on localhost.

### Demo mode
- [ ] APP-4.2, 4.3: populate demo mode from `server/seed-data/`: `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete. Last of the features, so it covers the finished screens.

### Data & deployment
- [ ] Document backup and restore for the Postgres volume, including a backup before updates that add migrations (they only go forward). Include retention for `core.logs`, which grows without bound (errors are logged to the database).
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images). Tag images with the release version as well as `latest`.

### Release
- [ ] **Deploy** the image to the home server following deployment.md, and replace its "not deployed yet" status and intended setup with the exact steps.
- [ ] **Test on a phone** over the LAN: the main flows on a real device, and installing as an app (APP-9), which needs HTTPS through a proxy.
- [ ] **Screenshots** in `README.md` (seed data, phone and desktop, light and dark), once Spending and Budget look the way they will.
- [ ] **Tag `v0.1.0`** and publish its GitHub Release. Decide whether `package.json` versions follow the tags (the client says 0.0.0 and the server 1.0.0 today).

---

## Automatic categorization (v0.2)

- [ ] **Rules.** CAT-8.1 to 8.5, 8.7, CAT-5.5: Rules screen in Settings (SET-1.1), matching on statement, merchant and amount, first match wins, applied on add, import and sync, with "apply to existing Uncategorized".
- [ ] **Learning.** CAT-9.1 to 9.4, CAT-8.6: Learn from my transactions, and View Transaction saying how a category was set.

---

## Tools (v0.3)

A Tools area for features that analyse the data rather than record it. Not written up as requirements yet.
- [ ] **Decide, then write requirements**, probably in a new domain file. What the Tools area is (a destination in the navigation, or a Settings-like hub), and:
  - **Reports**: which ones, for example spending trends over months and breakdowns by category or group, and how they relate to Spending (CASH) and the Dashboard chart.
  - **Retirement tracker**, built on the Retirement account group (ACCT-1.2): for example progress toward a target balance, or contributions against the yearly limits. The group already gives retirement savings their own Dashboard total; decide what else is worth tracking. (Replaces the old Retirement flag and the goals feature of the app this one replaces.)
- [ ] **Chart library.** Re-evaluate Chart.js against the chart types the reports need (trends over months, category breakdowns): compare it with alternatives such as ECharts on those chart types, touch interaction and bundle size. Chart.js stays until then (decided 2026-09-27).

---

## Real estate values (v0.4)

- [ ] Keep Real Estate accounts' (ACCT-1.2) values up to date from an online estimate, such as Zillow's Zestimate, with the property's address entered on the account (only for Real Estate types). Write requirements first (ACCT, plus SET for any provider key), deciding:
  - **Provider.** Zillow no longer offers a public Zestimate API, and scraping breaks its terms, so compare what's available then: property-data APIs with value estimates (for example RentCast or ATTOM) on price, free tier, rate limits, coverage and terms for personal use. A key would be entered in Settings, like SimpleFIN's setup token.
  - **How values land.** Probably a set balance entry (ACCT-5) per sync, on the estimate's date, so a value the user enters by hand still works as before. Decide how often (monthly is plenty), whether to backfill history the provider offers, and how the user turns it off or overrides it.
  - **Polling only** (no webhooks, as for bank sync): a scheduled fetch, which bank sync can reuse later, and/or a sync-now action on Account Details.
  - **Privacy.** The address goes to a third party; say so where it's entered.

---

## Automated bank sync (v0.5)

Manual entry and import/export come first. Constraints for when this gets picked up:
- **Provider: SimpleFIN Bridge** (decided 2026-10-15, replacing a Plaid-style link flow). It's a paid subscription (about $15 a year in 2026; check the current price), which the owner accepted. The user links banks in Bridge and pastes a one-time setup token into Settings → Bank Sync (SET-4.2), which the server exchanges for an access URL. One connection covers every bank, so INST-2's per-institution Connect, Reconnect and Disconnect need rewriting before building: for example, map each SimpleFIN account (and its `org`) to an institution and account on the first sync.
- **Polling only.** The host isn't reachable from the internet, so no webhooks. Sync on a schedule and/or on demand. Scheduling: a built-in timer (no setup for self-hosters) as the main schedule, reusing Real estate values' if it has one, with the sync endpoints also callable by an external scheduler using a Read & write API token (AUTH-11).
- [ ] **Design.** Write `docs/integrations/bank-sync.md` before coding: claiming the setup token and storing the access URL (it embeds credentials; decide whether to encrypt it at rest and with what key), polling within Bridge's rate limits and date ranges (`start-date`, `pending`), mapping SimpleFIN orgs/accounts to institutions/accounts, de-duplicating against CSV imports by transaction ID, and testing with Bridge's demo token. Rewrite INST-2 and ACCT-4 for the single connection.
- [ ] **Connect and link.** INST-2.1 to 2.4, 2.6; ACCT-4.3 (connected derived from the link, replacing `is_manual`); ACCT-2.6's Manual/Connected; ACCT-5.5 (linking turns off `adjusts_balance` on the account's transactions).
- [ ] **Combining histories.** INST-2.8 to 2.11: Combine / Use the bank's history / Keep my history only, with the preview counts and one database transaction.
- [ ] **Sync.** INST-2.12, ACCT-4.1, 4.2; TXN-2.12, TXN-4.8 (synced transactions' read-only fields and splits); SET-4.1 (Bank Sync settings, schedule), SET-4.2 (setup token).
- [ ] **Disconnect.** INST-2.5, 2.7; ACCT-4.4, 4.5; ACCT-1.5's read-only institution for connected accounts; ACCT-6.1's disconnect on close.

---

## Ideas

- TypeScript 7 (the native compiler) once Angular, typescript-eslint and ts-jest support it; on 2026-10-17 they all stopped below 7, so both packages stay on 6.0 (decided 2026-10-17).
- Drizzle 1.0 (`drizzle-orm` and `drizzle-kit`) once it's out of release candidates; kit 1.0 drops `@esbuild-kit`, which clears the server's `esbuild` audit finding (development.md). Check its migration guide: the migrations folder format and the relational query API change.

- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Spending does, and round at the edges. Revisit integer cents only if totals ever drift.
- Project Claude Code skills (e.g. `new-finance-resource`, `verify`, `schema-change` once migrations exist). Skipped for now; revisit if the same multi-step instructions keep getting repeated.
- Spending compares an unfinished period with its whole budget (CASH-1.10), so mid-month nearly everything reads as under. A pace marker (how far through the period today is), or a pro-rated budget for the current period, would make it fairer. `spending.component.ts`, `difference`.
- A balance that drops on one day after weeks unchanged (closing an account, ACCT-6.1, or paying off a card) is drawn as a slide from the previous change, because ACCT-2.11's curve joins only the days the balance changes. Consider holding the line level until the day before each change (`value-history.component.ts`).
- In debug mode, date pickers open on and highlight the real today rather than the fixed debug date, since Material's `DateAdapter.today()` doesn't go through `DateProviderService`. A `DateAdapter` subclass whose `today()` returns `DateProviderService.now()` would fix it.
- Warn before reloading or closing the tab with unsaved changes (`beforeunload`). APP-2.7 covers only leaving within the app.
