# M02 design: bank sync and rules

How the Bank sync and categorization milestone is built (requirements: [SYNC](../requirements/bank-sync.md), ACCT-4, ACCT-7, CAT-8, CAT-9). Written 2026-11-07 from the SimpleFIN spec, before any code. Each session corrects it as the code proves it wrong; the first checked it against Bridge's demo token ([What the demo token showed](#what-the-demo-token-showed)), and what only real banks can answer waits for the live trial ([To confirm](#to-confirm)). The order of work, and how it went, is in the [milestone's file](M02-bank-sync-and-categorization.md).

This doc is temporary. The milestone's last task (T12) moves what stays true into [architecture.md](../architecture.md) and deletes it.

## SimpleFIN in brief

Sources: the [protocol](https://www.simplefin.org/protocol.html) (v2, still a draft) and Bridge's [developer guide](https://beta-bridge.simplefin.org/info/developers).

The app speaks the protocol, not Bridge: the setup token carries its claim URL and the claim returns the access URL, so any SimpleFIN server works. Bridge is the one the owner uses and the one its limits are set by, but nothing on screen names it; the wording says "SimpleFIN" or "your SimpleFIN server" (decided 2026-11-22).

- **Claiming.** A setup token is a Base64-encoded claim URL. `POST` to it (empty body) returns the access URL as the response body: `https://user:password@host/path`. A claim works once; a used or unknown token gets 403.
- **Fetching.** `GET <access URL>/accounts?version=2&start-date=<unix>` with HTTP Basic auth from the URL's credentials. Other parameters: `end-date` (exclusive), `pending=1` (pending transactions, off by default), `account=<id>` (repeatable), `balances-only=1`.
- **Response.** `errlist` (`{ code, msg, conn_id?, account_id? }`, codes `gen.*`, `con.*`, `act.*`), `connections` (`conn_id`, `name`, `org_id`, `org_url?`, `sfin_url`), `accounts` (`id`, `name`, `conn_id`, `currency`, `balance`, `available-balance?`, `balance-date`, `transactions?`, `extra?`). A transaction has `id`, `posted`, `amount`, `description`, `transacted_at?`, `pending?`, `extra?`, and Bridge adds `payee`, `memo` and `mcc`. Amounts are numeric strings, positive for money in; timestamps are Unix seconds. Bridge answers in v1 unless asked for `version=2`: an `org` object per account instead of `connections` and `conn_id`, and a plain `errors` list of strings instead of `errlist`. Both versions may carry `x-api-message`, a list of notes from Bridge.
- **IDs.** An account ID is unique within its connection; a transaction ID is unique within its account and never reused there. Neither is promised to be stable, and nothing says whether a pending transaction keeps its ID when it posts.
- **Bridge's limits.** About 24 requests a day, with separate allowances for all-accounts and per-account requests; going past the warning level disables the access URL. At most 90 days between `start-date` and `end-date`, but more than 45 gets a warning in `errlist` ([what the demo token showed](#what-the-demo-token-showed)). History depth varies by bank. Bridge updates from banks about daily. 403 (revoked or wrong credentials) and 402 (payment required) are failures the user has to fix.

## Configuration

- **`ENCRYPTION_KEY`**: 32 random bytes, Base64 (`openssl rand -base64 32`). `SecretBox.fromEnvironment` reads it at startup in `index.ts`, beside the sign-in limits and log retention: unset means bank sync is unavailable (SYNC-1.2); set but not exactly 32 bytes of standard Base64 stops the server, naming the variable but not its value. Not tied to bank sync by name, so later credentials (a property-data API key for Real estate values) use it too. It's in `.env.example` and `deployment.md`; `docker-compose.yml` sets a fixed development key unless `.env` has one, and `docker-compose.prod.yml` passes it through from `.env` like every other variable.
- **Encryption**: AES-256-GCM via `node:crypto`, a random 12-byte IV per value, stored as `v1.<iv>.<tag>.<ciphertext>` (Base64url) so the format can change later. `SecretBox` in `server/src/utility/secret-box.ts` has `seal` and `open`; `open` throws `SecretBoxError` for a wrong key, tampering or a value that isn't sealed, which is SYNC-1.3's "can't be decrypted". It protects backups and database dumps, not a compromised host, which has the key too.
- **Time zone**: transaction and balance dates come from Unix timestamps through the server's `TZ` (APP-5.6), with a `DateTimeUtil` helper turning an instant into a `CalendarDate`.

## Data model

### A `simplefin` schema that finance doesn't know about

Everything bank sync stores lives in a third Postgres schema, `simplefin` (a `pgSchema` next to `core` and `finance` in `database-schemas.ts`), and its foreign keys point only one way: from `simplefin` into `finance`, never back. The finance tables get no SimpleFIN columns. So:

- Disconnecting (SYNC-1.4) empties the `simplefin` schema and leaves the user's own data as it was. Runs keep their times without their payloads, so SYNC-3.4's limit still counts requests made before connecting again.
- The tables are named after SimpleFIN's own model (connections, accounts, transactions), because that's what they hold. A second provider would have a different model and get its own schema; nothing in `finance` would change.
- `finance.accounts.is_manual` is dropped. Connected (ACCT-4.3) means a `simplefin.accounts` row's `linked_account_id` is that account, which the account queries read with an `EXISTS` subquery. That and a transaction's `isSynced` (below) are the only places `finance` code reads `simplefin`. Closing an account clears its link, and deleting one also deletes the `simplefin.transactions` rows of its transactions (SYNC-2.8).

IDs come from `EntityId`, as everywhere else; SimpleFIN's own IDs are unique columns beside them.

| Table | What | Foreign keys into `finance` |
|---|---|---|
| `simplefin.access` | At most one row: `access_url` (sealed), `claimed_at`, `schedule_minute` (0 to 359, SYNC-3.1), `paused_reason` (null, `refused`, `payment`, `undecryptable`; SYNC-1.3). | None |
| `simplefin.connections` | One row per SimpleFIN connection: `simplefin_id` (Bridge's `conn_id`, unique), `name`, `org_id`, `org_url`. One left without bank accounts is deleted. | None |
| `simplefin.accounts` | One row per SimpleFIN account: `connection_id`, `simplefin_id` (unique with `connection_id`), `name`, `currency`, `balance`, `balance_date`, `available_balance`, `missing_since` (SYNC-2.9: when the first sync that didn't return it ran, null while syncs return it), `is_ignored` (Don't sync), `sync_from` (SYNC-2.4). Linked is `linked_account_id` set; Not set up is neither linked nor ignored. A sync that doesn't return a bank account that's Not set up deletes it, since there's nothing to keep. | `linked_account_id` → `accounts`, unique (SYNC-2.5), `ON DELETE SET NULL` (SYNC-2.8) |
| `simplefin.transactions` | One row per bank transaction sync has seen: `simplefin_account_id` (cascade), `simplefin_id` (unique with `simplefin_account_id`), and the bank's `date`, `amount` and `description` as last seen. | `transaction_id` → `transactions`, unique, `ON DELETE SET NULL` |
| `simplefin.sync_runs` | One row per sync: `trigger` (`scheduled`, `manual`, `connect`), `started_at`, `requested_at` (set just before the request goes out, so a crash still counts it), `finished_at`, `status` (`running`, `succeeded`, `failed`, `skipped`; a partial unique index allows one `running` row, which is the lock), counts (accounts updated, transactions added and updated), `failure` (our own short reason), `messages` (jsonb: Bridge's, as `SimplefinAccountSet.messages` has them), `response` (jsonb, the parsed payload). | None |

What `simplefin.transactions` does:

- **Recognizes transactions already added** (SYNC-4.1) by `(simplefin_account_id, simplefin_id)`, without an external ID on `finance.transactions`.
- **Notices bank corrections** (SYNC-4.4) by comparing the bank's new date, amount and description with the ones it last saw, not with the transaction, whose fields the user may have edited after unlinking.
- **Remembers deletions.** Deleting a synced transaction leaves its row with `transaction_id` null, meaning "seen and deleted", so sync never adds it again (TXN-2.12).
- **Marks a transaction as synced**: `Transaction.isSynced`, derived in `transaction-data.ts` with an `EXISTS` subquery, is true when a row maps the transaction, or the first part of its split, to a bank account linked to the transaction's account. So TXN-2.12's read-only fields apply only while its account is connected, and to every part of its split. `saveTransaction` refuses a change to them; sending them unchanged, as the form does, is fine.
- A split keeps the mapping on the transaction that became its first part (TXN-4.1); sync leaves splits alone (SYNC-4.4).

Unlinking (SYNC-2.7) only clears `linked_account_id`, so the transaction rows stay and linking the same bank account again adds nothing twice. Disconnecting deletes them all; linking after connecting again can't recognize old transactions, but SYNC-2.4's default **Sync transactions from** date starts after them.

Other changes: `core.settings` gains `bankSyncAutomatic` (boolean, default true, SYNC-3.1) and `categorizationLearning` (default false, CAT-9.1). `DatabaseErrorUtil` gets messages for SYNC-2.5's unique keys. `drizzle.config.ts` already reads every `src/api/**/*-schema.ts`; `TestDatabaseUtil` needs to clear the new schema's tables.

`sync_runs.response` keeps the latest successful payload, for SYNC-2.10, and clears the others once they're 30 days old: `SyncScheduler` prunes when it starts and after each slot, rather than `LogRetention`, so logging doesn't depend on bank sync. It holds what the database already holds, so it adds no new exposure, and keeping it means a transform bug can be fixed and re-run without spending Bridge's allowance.

## Code layout

All in `server/src/api/bank-sync/`:

| File | Job |
|---|---|
| `simplefin-client.ts` | The only code that talks to Bridge. `ISimplefinClient` with `claim(setupToken)` and `fetchAccounts(accessUrl, startDate)`, which always asks for `version=2` and `pending=1`. Uses `fetch`, which refuses URLs with credentials, so it moves them into an `Authorization: Basic` header. HTTPS only (a claim URL or access URL that isn't `https:` is refused before anything is sent), 60-second timeout, no retries, nothing logged. Every failure is a `SimplefinError` with a `kind` (`invalid-setup-token`, `invalid-access-url`, `refused` for 403, `payment-required` for 402, `timeout`, `unreachable`, `unexpected-response`) and a message that never holds a URL, token or body, so the runner can log and store it as it is; a refused fetch also carries Bridge's `errlist` (`gen.auth`). |
| `simplefin-response.ts` | `parseAccountSet`: Zod schemas for v2 and v1 into our own `SimplefinAccountSet` (connections, accounts, transactions and Bridge's `messages`), or null for anything else. It's plain JSON, with timestamps left as Unix seconds and amounts as numbers, so a run can store it and linking can read it back; dates are worked out by the transform. v1's `org` becomes a connection (its `id`, else its `sfin-url`). `errlist`, `errors` and `x-api-message` all become `messages`, the last two without a code. |
| `simplefin-client-factory.ts` | `simplefinClientFromEnvironment`: the real client, or with `SIMPLEFIN_FAKE=true` a `DevelopmentSimplefinClient` that sends `fake` setup tokens and the access URLs they give to the fake and the rest to Bridge. Throws for the fake in production, so `index.ts` refuses to start. |
| `fake/` | The fake Bridge ([development.md](../development.md#bank-sync-in-development)). `FakeBridge` is a `fetch` that answers claims and `GET /accounts` as Bridge does, building v2 or v1 JSON from made-up banks (`fake-banks.ts`) and a scenario (`fake-scenarios.ts`); `FakeSimplefinClient` is the real `SimplefinClient` over it, with a 5-second timeout. Stateless: a fake access URL is `https://<scenario>:<claimed at>@fake-bridge.simplefin.invalid/simplefin`, and the payload follows from that and `DateTimeUtil`'s clock. |
| `simplefin-schema.ts`, `simplefin-data.ts` | The tables above and their queries. |
| `sync-quota.ts` | Counts `sync_runs.requested_at` in the last 24 hours against the cap of 20 (SYNC-3.4) and says when the next slot frees. |
| `sync-runner.ts` | One sync, the pipeline below. Used by the routes and the scheduler. |
| `sync-transform.ts` | `SyncTransform`, pure functions: a SimpleFIN account's posted transactions within a window to `SyncedTransaction`s (SYNC-4.2), the earliest date for SYNC-2.4's default, and the backfilled history (SYNC-4.6). |
| `bank-account-link-data.ts` | Link, create, ignore and unlink, each in one database transaction, and `applyPayload`, which brings one linked account up to date from its bank account's payload (adding new transactions, applying corrections, recording the balance) and is what both linking and each sync call. |
| `sync-schedule.ts` | `SyncSchedule`, pure: the four daily slots and when the next sync runs, catch-up included (SYNC-3.1, 3.2). |
| `sync-scheduler.ts` | `SyncScheduler`, the timer that runs each slot, and pruning old payloads. |
| `bank-sync-alerts.ts` | `bankSyncAlerts`, pure: SYNC-5.1's banner lines from the status. |
| `bank-sync-controller.ts`, `bank-sync-routes.ts` | The API. |

The client's tests stub `fetch` with fixtures recorded from the demo token (v2 and v1 shaped) in `server/src/api/bank-sync/test-data/`, whose README says what each one is; tests of everything above the client use `FakeSimplefinClient`, claiming `fake:<scenario>` tokens and moving the clock with `DateTimeUtil.setClock`. CI never calls Bridge.

## The sync pipeline

`SyncRunner.run(trigger)`:

1. **Lock.** Insert the run as `running` (`ON CONFLICT DO NOTHING` against `sync_runs_one_running_idx`); if nothing is inserted, one is running, so refuse with "A sync is already running." (SYNC-3.5). The database holds the lock, so it holds against two servers too, should there ever be more than one. On startup, `index.ts` fails any run a stopped server left `running` (`failInterruptedRuns`), and a run that throws is failed on the way out. An advisory lock would have had to hold a pooled connection through Bridge's request, and couldn't be tested: PGlite has one session, which Postgres gives the same advisory lock again.
2. **Quota.** If `SyncQuota` says no, a manual sync deletes its run and answers 429 with the time it frees up; a scheduled one records a `skipped` run (SYNC-3.4).
3. **Decrypt** the access URL; failing sets `paused_reason = 'undecryptable'` and stops.
4. **Request.** Insert the run with `requested_at`, then `fetchAccounts` with `start-date` 44 days before now (SYNC-3.6; the demo token warns from 45 days) and `pending=1`, so the stored payloads show how each bank's pending transactions post (SYNC-6; pending ones are still never added, SYNC-4.7). Always the full window, rather than since the last sync: it's one request either way, it picks up corrections the bank makes later (SYNC-4.4), and a newly linked account can take its history from the latest payload (SYNC-2.10). A `SimplefinError` of kind `refused` (403) sets `paused_reason = 'refused'`, and `payment-required` (402) sets `'payment'`, which a manual sync (**Try again**) clears when Bridge accepts the access URL again, since paying doesn't need a new setup token (decided 2026-11-21); any other failure fails the run and waits for the next scheduled one.
5. **Apply and finish**, in one database transaction (SYNC-4.8, `SimplefinData.completeRun`), so a failure part way leaves the bank accounts, the accounts and the run's payload as they were, and the run is failed on the way out:
   - Upsert `simplefin.connections` and `simplefin.accounts` from the payload, updating names and balances and clearing `missing_since` (SYNC-2.9). New accounts arrive Not set up.
   - For each linked bank account the sync returned (a missing one waits, SYNC-2.9), `applyPayload`: transform its transactions (skip pending ones and any with `posted` 0; date from `transacted_at`, else `posted`; skip dates before `sync_from` or after `DateTimeUtil.latestRecordDate()`), then look each up in `simplefin.transactions`. A new one goes through the rules and learning ([below](#rules-and-learning); until T8a, `categorize` in `bank-account-link-data.ts` leaves it Uncategorized), is inserted in `finance.transactions` with `adjusts_balance` false, and gets its mapping row. A known one updates its mapping row; when the bank's date, amount or description differs from the row's and its transaction is in this account and isn't split, the transaction's date, amount and original statement change too (SYNC-4.4). A known one whose transaction was deleted only updates its row. Corrections are rare, so they're written one at a time.
   - Record the balance as a set entry on `balance-date`'s day (ACCT-4.2), through the existing balance-history code so ACCT-5.7's shifting still applies.
   - Clear a `payment` pause, and finish the run with its payload, counts (accounts updated, transactions added and updated) and Bridge's messages, which releases the lock.

**Linking** (SYNC-2.3, 2.4) runs against the latest stored payload for that one bank account and never calls the SimpleFIN server, in one database transaction: set the link (only if it isn't linked, so two requests can't both win), turn off `adjusts_balance` on the account's existing transactions (ACCT-5.5), then `applyPayload` as a sync does: add the payload's transactions from `sync_from`, apply corrections to known ones, and record the bank's balance as a set entry, or for an account without balances backfill its history (SYNC-4.6). A transaction `simplefin.transactions` maps to another account (the bank account was linked there before) is added again and its row moves to the new one; one mapped to nothing (deleted) isn't. **Create new account** does the same in the transaction that creates the account, and the institution when no institution has the connection's name ignoring case, with `sync_from` the earliest date the bank returned.

**Connecting** (SYNC-1.1) first checks the key, that no sync is running and the quota, so a setup token is never used up for a sync that can't run. Then it claims the token, seals and stores the access URL (a first connection gets a random `schedule_minute`; connecting again keeps it, unpauses, and keeps the bank accounts and their links), and runs a sync with trigger `connect` so the bank accounts can be listed. A failed first sync still leaves the connection stored; the status's last run says what happened.

## Scheduling

`SyncScheduler` is built like `LogRetention`: started in `index.ts` once the server listens, an unref'd timer, stopped on shutdown, and never rejecting (a failure goes to the console and it looks again in 15 minutes, as it does while not connected). The day has four slots, `schedule_minute` and every 6 hours after it, by the wall clock in the server's time zone (`DateTimeUtil.atMinuteOfDay`; on the day the clocks go forward, a slot in the skipped hour is an hour later).

`SyncSchedule.plan` decides the next sync from the time, the schedule, when the access URL was claimed, when the latest scheduled run started (skipped ones included) and the latest slot this process has dealt with. Normally it's the next slot. If the latest slot passed after connecting with no scheduled run since it and this process didn't deal with it, it's a catch-up 2 minutes from now, unless the next slot is sooner (SYNC-3.2). A slot the database shows a run for is never run again, so restarts add nothing; a slot the process let pass with Automatic sync off isn't caught up either. (The first plan, "the last scheduled run started more than 6 hours ago", could have run a catch-up minutes before the next slot.) A timer that fires a moment early waits for its time.

Each slot reads `bankSyncAutomatic` and, if it's on, calls `SyncRunner.run(SyncTrigger.Scheduled)`, which refuses while paused and records a `skipped` run at the limit. Then it prunes payloads and plans the next.

With 4 scheduled runs, 16 of the 20 requests are left for Sync now and connecting.

## API

Under `/api/v1/bank-sync`, behind the usual auth; read-only tokens may only `GET`.

| Endpoint | What |
|---|---|
| `GET /` | `BankSyncStatus`: key configured, connected (and when, and the SimpleFIN server's `host`, read from the access URL, so never its credentials or path), paused reason, whether a sync is running, the last finished run, quota (`limit`, `remaining`, `availableAt`), `automatic` (the `bankSyncAutomatic` setting), `nextScheduledAt` (the next slot, while connected, unpaused and automatic), and `alerts`: SYNC-5.1's banner lines, worked out by `bankSyncAlerts` so the Dashboard and Bank Sync read the same. Automatic sync is saved through `PUT /api/v1/settings`. |
| `POST /connect` | `{ setupToken }`: claim, store, first sync. Also how Connect again works (SYNC-1.3), keeping links. |
| `DELETE /` | Disconnect (SYNC-1.4). 409 while a sync runs, 404 when not connected. |
| `GET /accounts` | SimpleFIN accounts with their connection, link and last-seen date. |
| `PUT /accounts/:id` | `{ action: 'link', accountId, syncFrom? }`, `{ action: 'create', name, type, institutionId \| institutionName, isHidden? }`, `{ action: 'ignore' }` or `{ action: 'unlink' }` (`BankAccountRequest`). Returns the bank account and how many transactions it added. 409 while a sync runs, for link and create. |
| `GET /accounts/:id/link-defaults?accountId=` | SYNC-2.4's default **Sync transactions from** for that account. |
| `POST /sync` | Sync now, and Try again while paused for payment; returns the run. 429 over the limit, 409 while one runs (`OperationStatus.Conflict`), 400 when not connected, without a key, or paused for another reason. |
| `GET /runs` | The last 10 runs (SYNC-3.7). |

`Account` says only whether it's manual (`isManual`, derived from the link). Manage Account's Bank sync section (ACCT-7.3) and Account Details' last sync (ACCT-2.6) read the linked bank account from `GET /accounts`, which gives each one's link, `syncFrom` and `lastSyncedAt` (when the latest successful sync that returned it finished), and link and unlink through the same `PUT`.

## Security

- The access URL never leaves the server: not in responses, logs, errors or the run payload (the client never puts it there). Only its host is shown, on Bank Sync's "Connected to *host*" line, through the status's `host`.
- The SimpleFIN server's messages are shown as plain text, labelled "SimpleFIN:" (SYNC-5.2), and never mixed with ours; our own failures are logged in full and stored on the run as a short reason.
- The claim posts to a URL the owner pasted, so it's limited to `https:`; that's the only request the server makes to a user-supplied address.

## Rules and learning

In `server/src/api/rules/`, in the `finance` schema:

| Table | What |
|---|---|
| `finance.rules` | `id`, `name` (unique ignoring case), `position` (list order, CAT-8.3). |
| `finance.rule_conditions` | `rule_id` (cascade), `field` (`original_statement`, `merchant`, `amount`, `account`), `operator` (`contains`, `equals`, `greater_than`, `less_than`), `text_value`, `amount_value` (positive), `direction` (`in`, `out`), `account_id` (FK to `accounts`, `ON DELETE RESTRICT`, CAT-8.8). |
| `finance.rule_actions` | `rule_id` (cascade), `type` (`set_category`, `set_merchant`), `category_id` (FK to `categories`, `ON DELETE RESTRICT`, CAT-8.8), `text_value`. |

Conditions and actions are child rows rather than JSON so the categories and accounts they name keep foreign keys. `field`, `operator` and `type` are shared enums behind `CHECK` constraints, so a new action (tags, hiding, notes) is a new enum value, a migration and a branch in the engine, without reshaping the tables.

`transactions` gains `category_rule_id` and `merchant_rule_id` (FK to `rules`, `ON DELETE SET NULL`) and `category_source` (`user`, `rule`, `learning`, null for Uncategorized), for CAT-8.6's notes and CAT-9.2's "categorized by the user". Editing the category sets `category_source` to `user` and clears `category_rule_id`; editing the merchant clears `merchant_rule_id`. Existing categorized transactions migrate as `user`.

`RuleEngine` is pure: given a transaction's fields, the ordered rules, which fields it may set (the category if it has none; the merchant only for an import or sync, CAT-8.4) and learning's statistics, it returns the new category and merchant and why. It walks the rules in order, matching each against the transaction as changed so far, and the first rule to set each field wins (CAT-8.3). Then, if the category is still unset and learning is on, learning picks one (CAT-9.3). Text matches ignore case. It's called by transaction create, CSV import (per row, in the import's database transaction), sync and linking (in theirs), and a rule's **Apply to existing** (CAT-8.5, that rule only). Rules and learning's statistics are loaded once per import or sync. The statistics (CAT-9.2) are one `GROUP BY` query: per lower-cased merchant, or original statement when the merchant is blank, the count of user-categorized, unsplit transactions per category.

API: `/api/v1/rules` with list, create, update, delete, `PUT /order` (the full ordered list of IDs), `GET /:id/matches` (CAT-8.5's counts) and `POST /:id/apply`. The Rules screen (`/settings/rules`) is an `<app-list>` with drag to reorder, and the rule form is a full page, since a rule has any number of conditions and actions.

## What the demo token showed

Tried 2026-11-21 (T2) with two demo tokens, recorded in `server/src/api/bank-sync/test-data/`, and with `SimplefinClient` itself against Bridge:

- **Versions.** Without `version`, Bridge answers in v1; with `version=2`, in v2. Both carry `payee` and `memo` on every transaction, so SYNC-4.2's merchant can come from `payee`. The client asks for v2 and still reads v1.
- **The window.** A request reaching back more than 44 days gets a `gen.api` entry in `errlist` (in v1, a string in `errors`): "Requested date range exceeds recommended range of 45 days. In the future, this may be capped." At 44 days there's none, so syncs ask for 44 (SYNC-3.6, decided 2026-11-21). Without `start-date`, Bridge returns only transactions from yesterday on, with an `x-api-message` saying so.
- **Claiming.** A claim answers 200 with the access URL as the body. Claiming again answers 403 "Forbidden (was it already claimed?)". Refreshing the developer guide gives a new demo token, so manual testing can claim as many as it needs; each demo access URL has Bridge's usual limits.
- **Refused credentials.** 403 with a v2-shaped body: `errlist: [{ code: "gen.auth", msg: "Forbidden" }]` and no accounts.
- **IDs.** The demo's transaction IDs are their timestamps, so the same ID appears in two accounts: transaction IDs are unique within an account only, as the protocol says. Account IDs contain spaces ("Demo Checking").
- **Dates.** Every demo transaction has `transacted_at` equal to `posted`, and some are up to 2 days in the future, which the transform's skip after `latestRecordDate()` leaves for a later sync.
- **Pending.** The demo returns no pending transactions, even with `pending=1`, so it can't show whether a pending transaction keeps its ID. The pending fixture is edited by hand, and `fake:pending` (T3) stands in until the live trial.
- **Payee, description and memo.** In the demo, `payee` is a clean name ("John's Fishin Shack"), `description` a short label ("Fishing bait") and `memo` reads like a bank statement ("JOHNS FISHIN SHACK BAIT"). SYNC-4.2 keeps `description` as Original Statement; the live trial checks which field holds the statement at real banks.

## To confirm

What only the owner's real banks can answer, in the live trial (T10):

- The sign of a credit card's and a loan's `balance`: Moped stores liabilities negative (APP-6.3). If Bridge reports them positive, flip by the account's Asset/Liability.
- Whether `description` or `memo` holds the bank's statement text (SYNC-4.2's Original Statement), and whether `payee` is a usable merchant.
- Whether pending transactions keep their ID when they post, and how their amounts change (decides SYNC-6.1's approach; T10 keeps the payloads, T11 studies them).
- What Bridge's quota warnings look like, to show them (SYNC-5.1). Not tried on the demo, since that means going past the limit on purpose; the window warning suggests a `gen.api` entry in `errlist`, which SYNC-5.2 shows as Bridge wrote it either way.
