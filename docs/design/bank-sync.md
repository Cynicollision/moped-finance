# Bank sync design

How bank sync (requirements: [SYNC](../requirements/bank-sync.md), ACCT-4) is built. Written 2026-11-07 from the SimpleFIN spec, before any code; the first session confirms the open points against Bridge's demo token (see [To confirm](#to-confirm)) and corrects this doc.

## SimpleFIN in brief

Sources: the [protocol](https://www.simplefin.org/protocol.html) (v2, still a draft) and Bridge's [developer guide](https://beta-bridge.simplefin.org/info/developers).

- **Claiming.** A setup token is a Base64-encoded claim URL. `POST` to it (empty body) returns the access URL as the response body: `https://user:password@host/path`. A claim works once; a used or unknown token gets 403.
- **Fetching.** `GET <access URL>/accounts?version=2&start-date=<unix>` with HTTP Basic auth from the URL's credentials. Other parameters: `end-date` (exclusive), `pending=1` (pending transactions, off by default), `account=<id>` (repeatable), `balances-only=1`.
- **Response.** `errlist` (`{ code, msg, conn_id?, account_id? }`, codes `gen.*`, `con.*`, `act.*`), `connections` (`conn_id`, `name`, `org_id`, `org_url?`, `sfin_url`), `accounts` (`id`, `name`, `conn_id`, `currency`, `balance`, `available-balance?`, `balance-date`, `transactions?`, `extra?`). A transaction has `id`, `posted`, `amount`, `description`, `transacted_at?`, `pending?`, `extra?`. Amounts are numeric strings, positive for money in; timestamps are Unix seconds. v1 had an `org` object per account, `payee` and `memo` on transactions, and a plain `errors` list, which Bridge still uses for its own warnings.
- **IDs.** An account ID is unique within its connection; a transaction ID is unique within its account and never reused there. Neither is promised to be stable, and nothing says whether a pending transaction keeps its ID when it posts.
- **Bridge's limits.** About 24 requests a day, with separate allowances for all-accounts and per-account requests; going past the warning level disables the access URL. At most 90 days between `start-date` and `end-date`. History depth varies by bank. Bridge updates from banks about daily. 403 (revoked or wrong credentials) and 402 (payment required) are failures the user has to fix.

## Configuration

- **`ENCRYPTION_KEY`**: 32 random bytes, Base64 (`openssl rand -base64 32`). Read and checked at startup like `LOG_RETENTION_DAYS` (`LogRetention.retentionDaysFromEnvironment`): unset means bank sync is unavailable (SYNC-1.2); set but not 32 bytes stops the server, naming the variable. Not tied to bank sync by name, so later credentials (a property-data API key for Real estate values) use it too. Goes in `.env.example`, both compose files and `deployment.md`.
- **Encryption**: AES-256-GCM via `node:crypto`, a random 12-byte IV per value, stored as `v1.<iv>.<tag>.<ciphertext>` (Base64url) so the format can change later. A small `SecretBox` in `server/src/utility/` with `seal` and `open`; `open` failing (wrong key, tampering) is SYNC-1.3's "can't be decrypted". It protects backups and database dumps, not a compromised host, which has the key too.
- **Time zone**: transaction and balance dates come from Unix timestamps through the server's `TZ` (APP-5.6), with a `DateTimeUtil` helper turning an instant into a `CalendarDate`.

## Data model

New tables, in a new `server/src/api/bank-sync/` domain:

| Table | What |
|---|---|
| `core.bank_sync_access` | At most one row: `access_url` (sealed), `claimed_at`, `schedule_minute` (0 to 359, SYNC-3.1), `paused_reason` (null, `refused`, `undecryptable`; SYNC-1.3). Deleted on Disconnect. |
| `finance.bank_connections` | One row per SimpleFIN connection: `conn_id` (unique), `name`, `org_id`, `org_url`, `last_seen_at`. |
| `finance.bank_accounts` | One row per SimpleFIN account: `connection_id` (FK), `external_id` (unique with `connection_id`), `name`, `currency`, `balance`, `balance_date`, `available_balance`, `last_seen_at` (SYNC-2.9), `is_ignored` (Don't sync), `account_id` (nullable, unique, FK to `accounts` `ON DELETE SET NULL`, SYNC-2.5, 2.8), `sync_from` (date, SYNC-2.4). Linked is `account_id` not null; Not set up is neither linked nor ignored. |
| `finance.sync_runs` | One row per sync: `trigger` (`scheduled`, `manual`, `connect`), `started_at`, `requested_at` (set just before the request goes out, so a crash still counts it), `finished_at`, `status` (`running`, `succeeded`, `failed`, `skipped`), counts (accounts updated, transactions added and updated), `errors` (jsonb: Bridge's `errlist` and `errors`, and our own failure), `response` (jsonb, the parsed payload). |

Changes to existing tables:

- `accounts.is_manual` is dropped; connected means a `bank_accounts` row points at the account (ACCT-4.3).
- `transactions` gains `bank_account_id` (FK to `bank_accounts`, `ON DELETE SET NULL`) and `bank_transaction_id`, unique together. A synced transaction is one with `bank_transaction_id` set; TXN-2.12's read-only fields apply while its account is connected.
- `core.settings` gains `bankSyncAutomatic` (boolean, default true, SYNC-3.1), the settings pattern's job.
- `DatabaseErrorUtil` gets messages for the two unique keys in SYNC-2.5.

Disconnect deletes `bank_accounts` and `bank_connections`, which nulls `transactions.bank_account_id`. Linking the same bank account after connecting again can't then recognize old transactions by ID, but SYNC-2.4's default **Sync transactions from** date starts after them.

`sync_runs.response` keeps the latest successful payload for SYNC-2.10 and prunes the others after 30 days, on the log-retention timer. The payload holds what the database already holds, so it adds no new exposure, and keeping it means a transform bug can be fixed and re-run without spending Bridge's allowance.

## Code layout

All in `server/src/api/bank-sync/`:

| File | Job |
|---|---|
| `simplefin-client.ts` | The only code that talks to Bridge. `ISimplefinClient` with `claim(setupToken)` and `fetchAccounts(accessUrl, startDate)`. Uses `fetch`, which refuses URLs with credentials, so it strips them into an `Authorization: Basic` header. HTTPS only (a claim URL or access URL that isn't `https:` is refused), 60-second timeout, no retries. Parses the response with Zod, accepting v1 and v2 shapes, into our own `SimplefinAccountSet` type. Never logs URLs or bodies. |
| `bank-sync-schema.ts`, `bank-sync-data.ts` | The tables above and their queries. |
| `sync-quota.ts` | Counts `sync_runs.requested_at` in the last 24 hours against the cap of 20 (SYNC-3.4) and says when the next slot frees. |
| `sync-runner.ts` | One sync, the pipeline below. Used by the routes and the scheduler. |
| `sync-transform.ts` | Pure functions: a SimpleFIN account's transactions to new and changed Moped transactions, the balance entry, and the backfilled history (SYNC-4.6). Most of the unit tests go here. |
| `sync-scheduler.ts` | The timer (SYNC-3.1, 3.2). |
| `bank-sync-controller.ts`, `bank-sync-routes.ts` | The API. |

Tests use a fake `ISimplefinClient` returning fixtures recorded from the demo token (v2 and v1 shaped) in `server/src/api/bank-sync/test-data/`. CI never calls Bridge.

## The pipeline

`SyncRunner.run(trigger)`:

1. **Lock.** `pg_try_advisory_lock` on a fixed key; if it's taken, refuse with "A sync is already running." (SYNC-3.5). The lock also guards against two servers, should there ever be more than one.
2. **Quota.** If `SyncQuota` says no, a manual sync answers 429 with the time it frees up; a scheduled one records a `skipped` run (SYNC-3.4).
3. **Decrypt** the access URL; failing sets `paused_reason = 'undecryptable'` and stops.
4. **Request.** Insert the run with `requested_at`, then `fetchAccounts` with `start-date` 89 days before now (SYNC-3.6; one day's margin under Bridge's 90). Always the full window, rather than since the last sync: one request either way, it picks up corrections the bank makes later (SYNC-4.4), and a newly linked account can take its history from the latest payload (SYNC-2.10). 403 or 402 sets `paused_reason = 'refused'`; any other failure fails the run and waits for the next scheduled one.
5. **Store** the parsed payload on the run.
6. **Apply**, in one database transaction (SYNC-4.8):
   - Upsert `bank_connections` and `bank_accounts` from the payload, updating names, balances and `last_seen_at`. New bank accounts arrive Not set up.
   - For each linked bank account whose account is open and in USD: transform its transactions (skip pending ones and any with `posted` 0; date from `transacted_at`, else `posted`; skip dates before `sync_from` or after `DateTimeUtil.latestRecordDate()`), then look them up by `(bank_account_id, bank_transaction_id)`. New ones go through categorization (rules then learning, as in [rules.md](rules.md)) and are inserted with `adjusts_balance` false; known ones that aren't split get changed bank fields updated (SYNC-4.4).
   - Record the balance as a set entry on `balance-date`'s day (ACCT-4.2), through the existing balance-history code so ACCT-5.7's shifting still applies.
7. **Finish** the run with its status, counts and Bridge's messages, and release the lock.

Linking (SYNC-2.3, 2.4) runs step 6's per-account part against the latest stored payload for that one bank account, in the same database transaction as the link and turning off `adjusts_balance` on the account's existing transactions (ACCT-5.5), then backfills balances when the account had none (SYNC-4.6). It never calls Bridge.

**Connecting** (SYNC-1.1) claims the token, seals and stores the access URL with a random `schedule_minute`, then runs a sync with trigger `connect` so the bank accounts can be listed.

## Scheduling

`SyncScheduler` is built like `LogRetention`: started in `index.ts`, an unref'd timer, stopped on shutdown. The day has four slots, `schedule_minute` and every 6 hours after it, in the server's time zone. On start and after each run it sets a timer for the next slot. On start, if the last scheduled run started more than 6 hours ago (or there's none since connecting), it runs 2 minutes after startup instead, which covers SYNC-3.2 without ever running twice for one slot. Each slot checks `bankSyncAutomatic` and that the access isn't paused.

With 4 scheduled runs, 16 of the 20 requests are left for Sync now and connecting.

## API

Under `/api/v1/bank-sync`, behind the usual auth; read-only tokens may only `GET`.

| Endpoint | What |
|---|---|
| `GET /` | Status: key configured, connected, paused reason, Automatic sync, last run, quota (`remaining`, `availableAt`). |
| `POST /connect` | `{ setupToken }`: claim, store, first sync. Also how Connect again works (SYNC-1.3), keeping links. |
| `DELETE /` | Disconnect (SYNC-1.4). |
| `GET /accounts` | Bank accounts with their connection, link and last-seen date. |
| `PUT /accounts/:id` | `{ action: 'link', accountId, syncFrom }`, `{ action: 'create', name, type, institutionId \| institutionName, isHidden }`, `{ action: 'ignore' }` or `{ action: 'unlink' }`. |
| `POST /sync` | Sync now; returns the run. 429 over the limit, 409 while one runs. |
| `GET /runs` | The last 10 runs (SYNC-3.7). |

Unlinking from Manage Account (ACCT-4.5) calls the same `PUT` with the bank account's ID, which `GET /accounts/:id` (Account Details) returns with the account.

## Security

- The access URL never leaves the server: not in responses, logs, errors or the run payload (the client never puts it there).
- Bridge's messages are shown as plain text (SYNC-5.2) and never contain our errors; our own failures are logged in full and stored on the run as a short reason.
- The claim posts to a URL the owner pasted, so it's limited to `https:`; that's the only request the server makes to a user-supplied address.

## To confirm

With the demo token, before building on the shapes above:

- Which version Bridge returns by default and with `version=2`, and whether `payee` still comes through (SYNC-4.2's merchant).
- The sign of a credit card's and a loan's `balance`: Moped stores liabilities negative (APP-6.3). If Bridge reports them positive, flip by the account's Asset/Liability.
- Whether pending transactions keep their ID when they post (decides SYNC-6.1's approach).
- What Bridge's quota warnings look like in `errors`, to show them (SYNC-5.1).
- Whether the demo token can be claimed more than once (the protocol page and the guide disagree), for repeatable manual testing.
