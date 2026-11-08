# TODO / Backlog

Work items and ideas, grouped by release milestone. Delete an item once it's done (git history is the changelog).

v0.1.0, the initial release with manual accounts, came out on 2026-11-07. Each milestone ends with a release: a `vX.Y.0` tag and a GitHub Release (see [development.md](docs/development.md#releases)). Version 1.0 is the release that finishes the last milestone below; until then each one takes the next minor version.

| Milestone | Release | What it adds |
|---|---|---|
| [Bank sync and categorization](#bank-sync-and-categorization-v02) | v0.2 | Transactions and balances from SimpleFIN Bridge, with rules and learning that set categories on add, import and sync |
| [Real estate values](#real-estate-values-v03) | v0.3 | Real Estate accounts' values from an online estimate |

Within a milestone, items are listed in the order to work through them (later items build on earlier ones). Each is about a day's work or one Claude Code session, possibly several PRs. **Unscheduled** holds work that isn't part of a milestone yet: Tools, built when a feature needs them, bank sync's later additions, account details, and demo mode. **Ideas** at the end are unsorted thoughts, not yet committed to.

---

## Bank sync and categorization (v0.2)

Requirements: [SYNC](docs/requirements/bank-sync.md), ACCT-4 and ACCT-7, CAT-8 and CAT-9. Design: [v0.2-design.md](docs/v0.2-design.md), written 2026-11-07 from the SimpleFIN spec before any code. Read it before starting an item, and correct them as the code proves them wrong. The deciding constraints:
- **Provider: SimpleFIN Bridge** (decided 2026-10-15), a paid subscription (about $15 a year in 2026) the owner accepted. One connection covers every bank; accounts link to Bridge's bank accounts, not institutions to banks.
- **Polling only, scheduled inside the server** (decided 2026-11-07): the host isn't reachable from the internet, and the server has to enforce Bridge's limit of about 24 requests a day anyway (SYNC-3.4). No external scheduler.

- [ ] **Manage Account.** ACCT-7 (all but 7.3's bank sync section, which comes with linking), ACCT-1.5, 1.6, 2.2, 2.8, 6.1, 6.3; APP-2.4, 2.6. Replaces Edit Account (`account-form`) with the sectioned page and adds the Update balance dialog. Update `conventions.md`'s **Create and edit** rule (an account's Close and Delete live in Manage Account's last section, not the ⋮ menu) and the Edit Account mentions in APP-1.8, 1.9, 2.7 and 6.3. Needs no bank sync, so it goes first.
- [ ] **SimpleFIN client and encryption key.** Claim Bridge's demo token and record its responses as fixtures (`server/src/api/bank-sync/test-data/`), then work through the design's **To confirm** list and fix the design and SYNC-4.2 to match. Build `simplefin-client.ts` (claim, fetch, Zod parsing of v1 and v2, credentials moved to a Basic header) and `SecretBox` with `ENCRYPTION_KEY` (startup check, `.env.example`, compose files, `deployment.md`).
- [ ] **Connect.** SYNC-1, SYNC-3.3 to 3.7 (Sync now, the quota, the lock, the 90-day request, run history), and SYNC-2.1, 2.2, 2.6, 2.9's list of bank accounts: the `simplefin` schema's `access`, `connections`, `accounts` and `sync_runs` tables, the Bank Sync page, and Bank Sync in SET-1.1's list. A sync at this stage stores the payload and the bank-account list, and writes nothing to accounts.
- [ ] **Link.** SYNC-2.3 to 2.5, 2.7, 2.8, 2.10; ACCT-4.3 (drop `is_manual`), 4.5, 7.3; ACCT-1.3's pointer to Bank Sync, ACCT-2.6, ACCT-5.5, INST-1.12. Linking applies the latest stored payload's transactions (SYNC-4.1, 4.2, 4.6), so this item builds `sync-transform.ts` and `simplefin.transactions` too.
- [ ] **Sync writes.** SYNC-4.3 to 4.5, 4.7, 4.8; ACCT-4.1, 4.2, 4.4; TXN-2.12 (read-only fields; deleting is remembered), TXN-4.8: each sync adds and updates transactions and records balances for every linked account, in one database transaction. Categorization is a no-op hook until Rules.
- [ ] **Schedule and alerts.** SYNC-3.1, 3.2 (`SyncScheduler`, the `bankSyncAutomatic` setting) and SYNC-5 (the banner on the Dashboard and Bank Sync). Prune old `sync_runs` payloads on the log-retention timer.
- [ ] **Rules.** CAT-8.1 to 8.5, 8.7, 8.8, CAT-5.5: the rules tables and `RuleEngine`, the Rules page in Settings (SET-1.1), applied on add, import and sync, with Apply to existing.
- [ ] **Learning.** CAT-9, CAT-8.6: Learn from my transactions, `category_source`, and View Transaction saying how a category or merchant was set.
- [ ] **Fold the design into the docs.** Move what stays true from `v0.2-design.md` into `architecture.md` (a Bank sync section beside Request flow, the `simplefin` schema under Database, the SimpleFIN notes, rules), delete the design doc and its links (CLAUDE.md, SYNC, CAT-8), then release v0.2.

---

## Real estate values (v0.3)

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

### Bank sync, later

- [ ] **Pending transactions** (SYNC-6.1): show the bank's pending transactions and replace each when it posts. Left out of v0.2 because a pending transaction's ID may change when it posts (check what the demo token showed; v0.2-design.md **To confirm**), which needs matching beyond the ID.

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
