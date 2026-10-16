# TODO / Backlog

Work items and ideas, grouped by priority. Move items up or down as priorities change; delete them once done (git history is the changelog).

- **Now**: technical baseline: deployment and tooling.
- **Next**: finishing the requirements (`docs/requirements/`): every `Partial` and `Planned` sub-requirement except bank sync and automatic categorization. Each item is about a day's work or one Claude Code session, possibly several PRs, listed in the order to work through them (later items build on earlier ones).
- **Later**: bank sync, automatic categorization, and known gaps that aren't requirements yet.
- **Ideas**: unsorted thoughts, not yet committed to.

---

## Now

### Data & deployment
- [ ] Document backup and restore for the Postgres volume, including a backup before updates that add migrations (they only go forward). Include retention for `core.logs`, which grows without bound (errors are logged to the database).
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images).

---

## Next

### 16. Sign-in protection
- [ ] AUTH-10.1, 10.3, 10.5 to 10.7: per-address lockout after failed sign-ins, the limits as optional `.env` variables (not Settings), logged lockouts, and `TRUST_FIRST_PROXY` for the client address behind a proxy.

### 17. Forgotten password
- [ ] A password reset command run on the host (decided 2026-10-16, over a recovery key in `.env` or recovery codes): `docker exec -it moped-finance-api npm run reset-password` shows the username, asks for a new password twice, applies the AUTH-9 rules, and signs out every session while leaving API tokens alone (as AUTH-11.11 does). It has to work in the production image (compiled, no ts-node), so build it with the server. Login gets a **Forgot password?** link explaining it, and deployment.md documents it. Write the requirements first (a new AUTH section).
- [ ] Change Password (AUTH-5.3) signs out every other session, keeping the current one.

### 18. Demo mode
- [ ] APP-4.2, 4.3: populate demo mode from `server/seed-data/`: `demo.interceptor.ts` answers everything but auth with an empty list. Needs the CSVs turned into client-side data (a build step or JSON) and in-browser create/edit/delete. Last, so it covers the finished screens.

### 19. Install as an app
- [ ] APP-9.1, 9.2: web app manifest (name, icons, theme colours, start URL), and a service worker if browsers still need one to offer installation. Choose caching so a new version shows up after an update (APP-9.2), for example Angular's `@angular/service-worker` with its update checks, or no caching at all. Installing needs HTTPS (app.md Notes), so test with `USE_HTTPS` or on localhost.

---

## Later

### Automated bank sync
Manual entry and import/export come first. Constraints for when this gets picked up:
- **Provider: SimpleFIN Bridge** (decided 2026-10-15, replacing a Plaid-style link flow). It's a paid subscription (about $15 a year in 2026; check the current price), which the owner accepted. The user links banks in Bridge and pastes a one-time setup token into Settings → Bank Sync (SET-4.2), which the server exchanges for an access URL. One connection covers every bank, so INST-2's per-institution Connect, Reconnect and Disconnect need rewriting before building: for example, map each SimpleFIN account (and its `org`) to an institution and account on the first sync.
- **Polling only.** The host isn't reachable from the internet, so no webhooks. Sync on a schedule and/or on demand. Scheduling: a built-in timer (no setup for self-hosters) as the main schedule, with the sync endpoints also callable by an external scheduler using a Read & write API token (AUTH-11).
- [ ] **Design.** Write `docs/integrations/bank-sync.md` before coding: claiming the setup token and storing the access URL (it embeds credentials; decide whether to encrypt it at rest and with what key), polling within Bridge's rate limits and date ranges (`start-date`, `pending`), mapping SimpleFIN orgs/accounts to institutions/accounts, de-duplicating against CSV imports by transaction ID, and testing with Bridge's demo token. Rewrite INST-2 and ACCT-4 for the single connection.
- [ ] **Connect and link.** INST-2.1 to 2.4, 2.6; ACCT-4.3 (connected derived from the link, replacing `is_manual`); ACCT-2.6's Manual/Connected; ACCT-5.5 (linking turns off `adjusts_balance` on the account's transactions).
- [ ] **Combining histories.** INST-2.8 to 2.11: Combine / Use the bank's history / Keep my history only, with the preview counts and one database transaction.
- [ ] **Sync.** INST-2.12, ACCT-4.1, 4.2; TXN-2.12, TXN-4.8 (synced transactions' read-only fields and splits); SET-4.1 (Bank Sync settings, schedule), SET-4.2 (setup token).
- [ ] **Disconnect.** INST-2.5, 2.7; ACCT-4.4, 4.5; ACCT-1.5's read-only institution for connected accounts; ACCT-6.1's disconnect on close.

### Automatic categorization
- [ ] **Rules.** CAT-8.1 to 8.5, 8.7, CAT-5.5: Rules screen in Settings (SET-1.1), matching on statement, merchant and amount, first match wins, applied on add, import and sync, with "apply to existing Uncategorized".
- [ ] **Learning.** CAT-9.1 to 9.4, CAT-8.6: Learn from my transactions, and View Transaction saying how a category was set.

### Known gaps
- [ ] **Changing an account between asset and liability types** (Accounts Known gaps): the stored balances keep their sign, so a $500 checking account changed to a credit card reads as $500 in credit. Decide whether Edit Account flips the history's sign or warns first (`account-controller.ts`, `updateAccount`).

### Major dependency upgrades
- [ ] Majors held back on 2026-10-06, when everything was brought up to date within its range (see [development.md](docs/development.md#dependencies)). None has a known vulnerability; Angular 21 keeps getting security releases until its LTS ends. One PR each, checking the release notes' breaking changes:
  - Client: Angular, CDK, Material and `angular-eslint` 21 → 22; `vitest` 4 → 5; `jsdom` 27 → 29. TypeScript 5.9 → 6 or 7 only once Angular supports it.
  - Server: Express 4 → 5 with `@types/express` 5 (route path syntax and `req.query` handling changed); `dotenv` 16 → 18; TypeScript to match the client.
  - `@types/node` is `^20` while Node is 22 everywhere (`Dockerfile`, CI, development.md); move it to `^22`.
  - The server's dev-only audit findings (development.md) go away only with new releases of `nodemon`, `tsc-alias`, Jest's coverage packages and `drizzle-kit` (1.0 drops `@esbuild-kit`). Check again when doing these.

### Chart library
- [ ] Re-evaluate Chart.js when Spending gets more report and chart types (trends over months, category breakdowns). Compare it with alternatives such as ECharts on the chart types needed, touch interaction and bundle size. Chart.js stays until then (decided 2026-09-27).

---

## Ideas

- Money is handled as JS floats (`Number(row.amount)`). That's fine for display: keep doing sums in SQL, as Spending does, and round at the edges. Revisit integer cents only if totals ever drift.
- Project Claude Code skills (e.g. `new-finance-resource`, `verify`, `schema-change` once migrations exist). Skipped for now; revisit if the same multi-step instructions keep getting repeated.
- Spending compares an unfinished period with its whole budget (CASH-1.10), so mid-month nearly everything reads as under. A pace marker (how far through the period today is), or a pro-rated budget for the current period, would make it fairer. `spending.component.ts`, `difference`.
- A balance that drops on one day after weeks unchanged (closing an account, ACCT-6.1, or paying off a card) is drawn as a slide from the previous change, because ACCT-2.11's curve joins only the days the balance changes. Consider holding the line level until the day before each change (`value-history.component.ts`).
- Warn before reloading or closing the tab with unsaved changes (`beforeunload`). APP-2.7 covers only leaving within the app.
- A retirement tracker built on the Retirement account group (ACCT-1.2): for example progress toward a target balance, or contributions against the yearly limits. The group already gives retirement savings their own Dashboard total; decide what else is worth tracking before writing requirements. (Replaces the old Retirement flag and the goals feature of the app this one replaces.)
