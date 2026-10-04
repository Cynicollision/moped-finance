# TODO / Backlog

Work items and ideas, grouped by priority. Move items up or down as priorities change; delete them once done (git history is the changelog).

- **Now**: technical baseline: deployment, tooling, test consistency.
- **Next**: finishing the requirements (`docs/requirements/`): every `Partial` and `Planned` sub-requirement except bank sync and automatic categorization. Each item is about a day's work or one Claude Code session, possibly several PRs, listed in the order to work through them (later items build on earlier ones).
- **Later**: bank sync, automatic categorization, and known gaps that aren't requirements yet.
- **Ideas**: unsorted thoughts, not yet committed to.

---

## Now

### Data & deployment
- [ ] Document backup and restore for the Postgres volume, including a backup before updates that add migrations (they only go forward). Include retention for `core.logs`, which grows without bound (errors are logged to the database).
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images).

### Tests
- [ ] Name existing tests after the requirement they cover (`it('ACCT-1.5 should ...')`), as the conventions ask for new ones. Server tests are about half done: `account-routes.spec.ts` (15 of 39), `category-routes.spec.ts` (12 of 24), `auth-routes.spec.ts` (9 of 18), `institution-routes.spec.ts` (1 of 11), `budget-stream-routes.spec.ts` (6 of 12), `transaction-routes.spec.ts` (38 of 53). The client is mostly done; the stragglers are `login`, `register`, `auth.service`, `finance.service`, `layout.service` and `chart.component` specs. Leave tests of plumbing that no requirement covers (utilities, `calendar-date-util.spec.ts`) as they are; don't invent requirements to name them after. A test that turns out to check behavior the requirements don't describe is worth a note in the domain's Known gaps. One PR per package.

---

## Next

### 1. Category emoji picker
- [ ] Replace the free-text **Icon (Emoji)** field in `category-form-modal.component` with a proper emoji picker: searchable, grouped, keyboard-accessible, themed with the app's tokens. Pick a library (or a small built-in set) with bundle size in mind. Reword CAT-1.2 to match.

### 2. Category delete
- [ ] CAT-1.10, CAT-4.4: Delete in the category edit dialog, with the transaction count and a choice of category to move them to, moved and deleted in one database transaction. Keep the budget-stream refusal (CAT-4.5).

### 3. Category import and export
- [ ] CAT-7.1 to CAT-7.5: Download Categories and Import Categories (dry run, add-only, groups created by name), through `@server/csv`.

### 4. Account types
- [ ] ACCT-1.1, 1.2, 1.8, 1.10, 1.11; DASH-2.1, 2.5: single **Type** field, with group and Asset/Liability derived from it; migration renaming stored values, typing existing credit cards, making type required; server refuses mismatched types; Retirement defaults by type; Dashboard gets Other Assets, the right group order and name sorting. Fix the `account-routes.spec.ts` ACCT-1.5 test that clears type with null. Also INST-1.1's ordering (institutions and their accounts by name).

### 5. Balances carried forward
- [ ] ACCT-2.1, 2.11; DASH-1.4, 1.7; ACCT-2.6 ("Balance as of" replaces "Last updated"): current balance ignores future entries; account and Dashboard series have a value for every day, carrying entries forward; headline, chart and card totals agree. DASH-1.8: Dashboard empty state.

### 6. Manual balances
- [ ] ACCT-5.1: set/adjusted source on balance entries (migration; existing entries are set). ACCT-1.4, 2.2: Starting Balance on Add Account and **Update Balance** on Account Details (ACCT-2.8). ACCT-2.13: Balance History section with edit and delete. ACCT-3.5: imports write set entries. APP-6.3 for balances: liabilities take **Amount owed** as a positive number. ACCT-2.10's empty Recent Transactions table. Known gap: ACCT-3.3's dry-run date range covers only valid rows.

### 7. Transaction form and filters
- [ ] TXN-2.13, APP-6.3: positive Amount with a Money out / Money in switch. TXN-2.6: required fields, Merchant included, flagged on the form. TXN-1.14: amount filters compare size, plus a Direction filter. Known gap (TXN-1.10): the default End Date silently hides future-dated transactions; give it a visible hint.

### 8. Hidden transactions
- [ ] TXN-1.8, 1.13, 2.11: **Show hidden transactions** filter (dimmed, crossed-out eye), so hidden transactions can be found and un-hidden; check Account Details' recent transactions leaves them out.

### 9. Hidden and closed accounts
- [ ] ACCT-1.9, DASH-2.9, TXN-1.12, TXN-2.1: hidden accounts left out of the Dashboard, Transactions list and filters, and the transaction form's account select (open, unhidden, sorted by name). ACCT-6.1 to 6.3, ACCT-2.8, DASH-2.10: Close Account (set entry of 0) and Reopen Account. ACCT-1.12, INST-1.1: Institutions marks hidden and closed accounts. Probably one PR for hiding, one for closing.

### 10. Transactions adjust balances
- [ ] ACCT-5.2 to 5.6; TXN-2.8, 2.9, 2.10, 3.11: **Adjust balance** on Add/Edit Transaction and on import, updating adjusted entries up to the next set entry, undone and reapplied on edit, delete and hide, all in one database transaction. Then confirm ACCT-3.11 (export and re-import into another account) works end to end.

### 11. Budget 12-month averages
- [ ] BUD-1.8, 1.9: server endpoint for each category's monthly average over the past 12 full months (counting what Spending counts), shown in the stream panel and beside each category in Budget's lists.

### 12. Split transactions: core
- [ ] TXN-4.1 to 4.3, 4.5, 4.7: split, edit split and unsplit, using the existing `is_split` / `split_parent_id` columns (or replacing them if a parts table fits better). The split dialog with the remainder filling the last part. Splits adjust the balance once, by the total.

### 13. Split transactions: everywhere else
- [ ] TXN-4.4, 4.6, 4.9, TXN-3.1: parts as rows in the Transactions list, filters and Spending drill-down; Spending and budget averages count parts; CSV export and import with `SplitId`.

### 14. Settings: Profile and Appearance
- [ ] SET-1.1, 2.1, 3.1: instance-level settings storage (also used by items 15 and 17), Profile (edit display name), Appearance (Dark, Light, Match system, applied before first paint). Light theme means a second set of the `styles.scss` tokens; likely a PR of its own.

### 15. Change Password and password rules
- [ ] AUTH-5.2, 5.3: Change Password in Settings. AUTH-9.1 to 9.4, AUTH-2.11: password rules (length, character classes) stored with the instance, editable in Settings, shown live under every password field and enforced by the server.

### 16. Register screen
- [ ] AUTH-2.8, 2.9, 2.10; CAT-6.1, 6.2: explain single-owner registration, field limits for username and display name, and **Start with default categories** (the CAT-6 list, with necessities) or **Start empty**. Known gap: close the AUTH-2.7 registration race (two simultaneous registrations on a fresh instance) at the database.

### 17. Sign-in protection
- [ ] AUTH-10.1 to 10.6: per-address lockout after failed sign-ins, settings for the limits, logged lockouts, and `TRUST_FIRST_PROXY` for the client address behind a proxy.

### 18. Demo mode
- [ ] APP-4.2, 4.3: populate demo mode from `server/seed-data/`: `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete. Last, so it covers the finished screens.

---

## Later

### Automated bank sync
Manual entry and import/export come first. Constraints for when this gets picked up:
- **No paid subscription.** It must fit a single user on a free tier (or use a free alternative). Check the current terms before building anything.
- **Polling only.** The host isn't reachable from the internet, so no webhooks. Sync on a schedule and/or on demand. Scheduling: a built-in timer (no setup for self-hosters) as the main schedule, with the sync endpoints also callable by an external scheduler using a Read & write API token (AUTH-11).
- [ ] **Design.** Write `docs/integrations/bank-sync.md` before coding: provider choice and cost, link flow, encrypted storage of access tokens, cursor-based incremental sync, mapping provider items/accounts to institutions/accounts, de-duplicating against CSV imports, and sandbox → production.
- [ ] **Connect and link.** INST-2.1 to 2.4, 2.6; ACCT-4.3 (connected derived from the link, replacing `is_manual`); ACCT-2.6's Manual/Connected.
- [ ] **Combining histories.** INST-2.8 to 2.11: Combine / Use the bank's history / Keep my history only, with the preview counts and one database transaction.
- [ ] **Sync.** INST-2.12, ACCT-4.1, 4.2; TXN-2.12, TXN-4.8 (synced transactions' read-only fields and splits); SET-4.1 (Bank Sync settings, schedule).
- [ ] **Disconnect.** INST-2.5, 2.7; ACCT-4.4, 4.5; ACCT-1.5's read-only institution for connected accounts; ACCT-6.1's disconnect on close.

### Automatic categorization
- [ ] **Rules.** CAT-8.1 to 8.5, 8.7, CAT-5.5: Rules screen in Settings (SET-1.1), matching on statement, merchant and amount, first match wins, applied on add, import and sync, with "apply to existing Uncategorized".
- [ ] **Learning.** CAT-9.1 to 9.4, CAT-8.6: Learn from my transactions, and View Transaction saying how a category was set.

### Known gaps
- [ ] **Duplicate detection on transaction import** (Transactions Known gaps): importing the same file twice creates everything twice. Decide on a match (date, account, amount, statement) and how the dry run reports it; related to bank sync's de-duplication.
- [ ] **Spending classifies in the browser** (Spending Known gaps): income versus expense (CASH-1.3) is worked out in `spending.component.ts` from loaded categories. Move it to the server, which item 11's averages endpoint may already need.

### Chart library
- [ ] Re-evaluate Chart.js when Spending gets more report and chart types (trends over months, category breakdowns). Compare it with alternatives such as ECharts on the chart types needed, touch interaction and bundle size. Chart.js stays until then (decided 2026-09-27).

---

## Ideas

- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Spending does, and round at the edges. Revisit integer cents only if totals ever drift.
- Project Claude Code skills (e.g. `new-finance-resource`, `verify`, `schema-change` once migrations exist). Skipped for now; revisit if the same multi-step instructions keep getting repeated.
- Spending compares an unfinished period with its whole budget (CASH-1.10), so mid-month nearly everything reads as under. A pace marker (how far through the period today is), or a pro-rated budget for the current period, would make it fairer. `spending.component.ts`, `difference`.
- Warn before reloading or closing the tab with unsaved changes (`beforeunload`). APP-2.7 covers only leaving within the app.
