# Backlog

Work outside the milestone being built. The milestones in order are in the [roadmap](roadmap.md); the one being built has its own file in [milestones/](milestones/), and work for it goes there, not here.

Each section says what happens to its items next:

- **Inbox**: found but not sorted yet. Follow-up work noticed during other work, and anything a review turns up, lands here. Only the owner moves an item out.
- **A milestone not planned yet** (M03 ...): what's known so far about it, until a planning session writes its file.
- **Anytime**: self-contained work with a clear end that needs no decision first, small enough for a PR of its own between milestone tasks.
- **Parked**: waiting on something. Each item says what, as **Revisit when**.
- **Ideas**: not committed to.

An item is one bullet: a bold title, what's wrong or wanted, and where (file and symbol, or requirement IDs). Items added from now on end with where they came from, such as `(PR 112)` or `(noticed in T9)`. Delete an item once it's done; git history is the changelog.

---

## Inbox

Nothing yet.

---

## M03 Real estate values (v0.3)

- **Real estate values from an online estimate.** Keep Real Estate accounts' (ACCT-1.2) values up to date from an online estimate, such as Zillow's Zestimate, with the property's address entered on the account (only for Real Estate types). Write requirements first (ACCT, plus SET for any provider key), deciding:
  - **Provider.** Zillow no longer offers a public Zestimate API, and scraping breaks its terms, so compare what's available then: property-data APIs with value estimates (for example RentCast or ATTOM) on price, free tier, rate limits, coverage and terms for personal use. A key would be entered in Settings, like SimpleFIN's setup token, and stored encrypted with `ENCRYPTION_KEY` (as SimpleFIN's access URL is).
  - **How values land.** Probably a set balance entry (ACCT-5) per sync, on the estimate's date, so a value the user enters by hand still works as before. Decide how often (monthly is plenty), whether to backfill history the provider offers, and how the user turns it off or overrides it.
  - **Polling only** (no webhooks, as for bank sync): a scheduled fetch, reusing bank sync's scheduler (`SyncScheduler`), and/or a sync-now action on Account Details.
  - **Privacy.** The address goes to a third party; say so where it's entered.

---

## Anytime

- **Debug mode's date pickers use the real today.** They open on and highlight the real today rather than the fixed debug date, since Material's `DateAdapter.today()` doesn't go through `DateProviderService`. A `DateAdapter` subclass whose `today()` returns `DateProviderService.now()` would fix it.
- **A sudden balance drop is drawn as a slide.** A balance that drops on one day after weeks unchanged (closing an account, ACCT-6.1, or paying off a card) is drawn as a slide from the previous change, because ACCT-2.11's curve joins only the days the balance changes. Consider holding the line level until the day before each change (`value-history.component.ts`).
- **Warn before leaving the page with unsaved changes** (`beforeunload`) when reloading or closing the tab. APP-2.7 covers only leaving within the app.

---

## Parked

- **Tools.** Features that analyse the data rather than record it: not a milestone of their own, but built when an existing or new feature needs them, and filed under that feature's milestone then. Not written up as requirements yet. **Revisit when** a feature needs a report, planner or tracker.
  - **Decide, then write requirements**, probably in a new domain file. What the Tools area is (a destination in the navigation, or a Settings-like hub), and:
    - **Reports**: which ones, for example spending trends over months and breakdowns by category or group, and how they relate to Spending (CASH) and the Dashboard chart.
    - **Debt paydown and savings planners**, which would need interest rates and APYs (Account details below).
    - **Retirement tracker**, built on the Retirement account group (ACCT-1.2): for example progress toward a target balance, or contributions against the yearly limits. The group already gives retirement savings their own Dashboard total; decide what else is worth tracking. (Replaces the old Retirement flag and the goals feature of the app this one replaces.)
  - **Chart library.** Re-evaluate Chart.js against the chart types the reports need (trends over months, category breakdowns): compare it with alternatives such as ECharts on those chart types, touch interaction and bundle size. Chart.js stays until then (decided 2026-09-27).
- **Account details.** Optional details per account, such as a savings account's APY, a card's credit limit and APR, or a loan's interest rate. If built: a `details` jsonb column on `accounts`, checked by a schema per account group in shared code, so a new field needs no migration (as `core.settings` does). SimpleFIN doesn't supply any of these, though a card's limit could be worked out from `available-balance`. **Revisit when** a feature uses them, such as a debt paydown or savings planner under Tools (decided 2026-11-07).
- **Demo mode's data.** APP-4.2, 4.3: populate demo mode from `server/seed-data/`: `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete. The shell stays as it is until then. **Revisit when** the other features are finished, so it covers the finished screens (decided 2026-11-07).
- **TypeScript 7** (the native compiler). On 2026-10-17 Angular, typescript-eslint and ts-jest all stopped below 7, so both packages stay on 6.0 (decided 2026-10-17). **Revisit when** all three support it.
- **Drizzle 1.0** (`drizzle-orm` and `drizzle-kit`). Kit 1.0 drops `@esbuild-kit`, which clears the server's `esbuild` audit finding (development.md). Check its migration guide: the migrations folder format and the relational query API change. **Revisit when** it's out of release candidates.
- **Money as integer cents.** Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Spending does, and round at the edges. **Revisit when** totals ever drift.

---

## Ideas

- **Tags on transactions**, set by hand or by a rule action (CAT-8's actions are child rows built to take new types).
- **Match the two sides of a transfer** between the user's accounts (a card payment appears in checking and on the card). Rules can categorize both as Transfer; pairing them, for example to show one as the other's counterpart or warn when one side is missing, is a separate feature.
- **Spending's pace through the period.** Spending compares an unfinished period with its whole budget (CASH-1.10), so mid-month nearly everything reads as under. A pace marker (how far through the period today is), or a pro-rated budget for the current period, would make it fairer. `spending.component.ts`, `difference`.
