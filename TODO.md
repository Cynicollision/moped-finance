# TODO / Backlog

High-level backlog: the release milestones toward 1.0, then work not scheduled yet, then ideas. Delete an item once it's done (git history is the changelog).

v0.1.0, the initial release with manual accounts, came out on 2026-11-07. Each milestone ends with a release: a `vX.Y.0` tag and a GitHub Release (see [development.md](docs/development.md#releases)). Version 1.0 is the release that finishes the last milestone below; until then each one takes the next minor version.

| Milestone | Release | What it adds | Status |
|---|---|---|---|
| M01 Manual accounts | v0.1 | Accounts, balances, transactions, categories, budget and spending, entered by hand or imported | Released 2026-11-07 |
| [M02 Bank sync and categorization](docs/milestones/M02-bank-sync-and-categorization.md) | v0.2 | Transactions and balances from SimpleFIN Bridge, with rules and learning that set categories on add, import and sync | Planned |
| [M03 Real estate values](#m03-real-estate-values-v03) | v0.3 | Real Estate accounts' values from an online estimate | Not planned yet |

A milestone being built has its own file in [docs/milestones/](docs/milestones/README.md), with its tasks in order, the decisions behind them, progress notes and, at the end, its outcome. Work for it goes there, not here. A milestone not planned yet is a section below with the items and questions known so far, until a planning session writes its file. **Unscheduled** holds work that isn't part of a milestone yet: Tools, built when a feature needs them, account details, and demo mode. **Ideas** at the end are unsorted thoughts, not yet committed to.

---

## M03 Real estate values (v0.3)

- [ ] Keep Real Estate accounts' (ACCT-1.2) values up to date from an online estimate, such as Zillow's Zestimate, with the property's address entered on the account (only for Real Estate types). Write requirements first (ACCT, plus SET for any provider key), deciding:
  - **Provider.** Zillow no longer offers a public Zestimate API, and scraping breaks its terms, so compare what's available then: property-data APIs with value estimates (for example RentCast or ATTOM) on price, free tier, rate limits, coverage and terms for personal use. A key would be entered in Settings, like SimpleFIN's setup token, and stored encrypted with `ENCRYPTION_KEY` (as SimpleFIN's access URL is).
  - **How values land.** Probably a set balance entry (ACCT-5) per sync, on the estimate's date, so a value the user enters by hand still works as before. Decide how often (monthly is plenty), whether to backfill history the provider offers, and how the user turns it off or overrides it.
  - **Polling only** (no webhooks, as for bank sync): a scheduled fetch, reusing bank sync's scheduler (`SyncScheduler`), and/or a sync-now action on Account Details.
  - **Privacy.** The address goes to a third party; say so where it's entered.

---

## Unscheduled

### Tools

Features that analyse the data rather than record it: not a milestone of their own, but built when an existing or new feature needs them, and filed under that feature's milestone then. Not written up as requirements yet.
- [ ] **Decide, then write requirements**, probably in a new domain file. What the Tools area is (a destination in the navigation, or a Settings-like hub), and:
  - **Reports**: which ones, for example spending trends over months and breakdowns by category or group, and how they relate to Spending (CASH) and the Dashboard chart.
  - **Debt paydown and savings planners**, which would need interest rates and APYs (Account details below).
  - **Retirement tracker**, built on the Retirement account group (ACCT-1.2): for example progress toward a target balance, or contributions against the yearly limits. The group already gives retirement savings their own Dashboard total; decide what else is worth tracking. (Replaces the old Retirement flag and the goals feature of the app this one replaces.)
- [ ] **Chart library.** Re-evaluate Chart.js against the chart types the reports need (trends over months, category breakdowns): compare it with alternatives such as ECharts on those chart types, touch interaction and bundle size. Chart.js stays until then (decided 2026-09-27).

### Account details

- [ ] Optional details per account, such as a savings account's APY, a card's credit limit and APR, or a loan's interest rate. Undecided until a feature uses them (decided 2026-11-07), such as a debt paydown or savings planner under Tools. If built: a `details` jsonb column on `accounts`, checked by a schema per account group in shared code, so a new field needs no migration (as `core.settings` does). SimpleFIN doesn't supply any of these, though a card's limit could be worked out from `available-balance`.

### Demo mode

Waits indefinitely (decided 2026-11-07); the shell stays as it is until then.
- [ ] APP-4.2, 4.3: populate demo mode from `server/seed-data/`: `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete. Last of the features, so it covers the finished screens.

---

## Ideas

- Tags on transactions, set by hand or by a rule action (CAT-8's actions are child rows built to take new types).
- Match the two sides of a transfer between the user's accounts (a card payment appears in checking and on the card). Rules can categorize both as Transfer; pairing them, for example to show one as the other's counterpart or warn when one side is missing, is a separate feature.
- TypeScript 7 (the native compiler) once Angular, typescript-eslint and ts-jest support it; on 2026-10-17 they all stopped below 7, so both packages stay on 6.0 (decided 2026-10-17).
- Drizzle 1.0 (`drizzle-orm` and `drizzle-kit`) once it's out of release candidates; kit 1.0 drops `@esbuild-kit`, which clears the server's `esbuild` audit finding (development.md). Check its migration guide: the migrations folder format and the relational query API change.
- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Spending does, and round at the edges. Revisit integer cents only if totals ever drift.
- Spending compares an unfinished period with its whole budget (CASH-1.10), so mid-month nearly everything reads as under. A pace marker (how far through the period today is), or a pro-rated budget for the current period, would make it fairer. `spending.component.ts`, `difference`.
- A balance that drops on one day after weeks unchanged (closing an account, ACCT-6.1, or paying off a card) is drawn as a slide from the previous change, because ACCT-2.11's curve joins only the days the balance changes. Consider holding the line level until the day before each change (`value-history.component.ts`).
- In debug mode, date pickers open on and highlight the real today rather than the fixed debug date, since Material's `DateAdapter.today()` doesn't go through `DateProviderService`. A `DateAdapter` subclass whose `today()` returns `DateProviderService.now()` would fix it.
- Warn before reloading or closing the tab with unsaved changes (`beforeunload`). APP-2.7 covers only leaving within the app.
