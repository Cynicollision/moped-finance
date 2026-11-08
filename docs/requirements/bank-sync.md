# Bank Sync (`SYNC`)

Bank sync keeps connected accounts' transactions and balances up to date from [SimpleFIN Bridge](https://beta-bridge.simplefin.org) (decided 2026-10-15). The user links their banks in Bridge, not in this app, and gives the app one connection that covers all of them. Bridge returns every **bank account** it holds for the user, grouped by **connection** (one sign-in at one bank). The user links each bank account to one of their accounts, creates a new account for it, or chooses not to sync it.

Screens: **Bank Sync** (`/settings/bank-sync`, a page of Settings, SET-1.1), where the user connects, sees how syncing is going and links bank accounts; and the **Bank sync** section of Manage Account (ACCT-7.3), which links or unlinks one account. How it's built is in [v0.2-design.md](../v0.2-design.md) until v0.2 ships.

## SYNC-1 The user can connect the app to SimpleFIN Bridge

| ID | Requirement | Status |
|---|---|---|
| SYNC-1.1 | **Bank Sync** shall let the user connect by pasting a SimpleFIN **setup token**. The server shall exchange it for an access URL straight away, store that encrypted (SYNC-1.2), and show the bank accounts Bridge returns (SYNC-2.1). No screen, API or log shall show the access URL. A token that Bridge refuses shall be rejected with "SimpleFIN Bridge didn't accept this setup token. It may have been used already: if you didn't use it, disable it in Bridge, since someone else may have claimed it." | Planned |
| SYNC-1.2 | The access URL shall be stored encrypted with a key from the server's `ENCRYPTION_KEY` environment variable. Without the variable, **Bank Sync** shall say "Bank sync needs an encryption key. Set ENCRYPTION_KEY on the server and restart it." and offer nothing else. A value that isn't a valid key shall stop the server from starting, with a message naming the variable. | Planned |
| SYNC-1.3 | When Bridge refuses the stored access URL (revoked, or the subscription lapsed), or it can't be decrypted because the key changed, syncing shall pause and **Bank Sync** shall say why, with **Connect again**, which takes a new setup token. Links are kept while paused, so connecting again resumes syncing every bank account Bridge still returns. | Planned |
| SYNC-1.4 | Once connected, **Bank Sync** shall offer **Disconnect**, which after confirming ("Disconnect bank sync? Your N synced accounts become manual and keep their history.", **Cancel** / **Disconnect**) deletes the access URL and the list of bank accounts, and makes every connected account manual, keeping its balance history and transactions. | Planned |
| SYNC-1.5 | The connection is set in Settings only, not in the server's environment (see Notes). | Planned |

## SYNC-2 The user chooses which bank accounts sync into which accounts

| ID | Requirement | Status |
|---|---|---|
| SYNC-2.1 | **Bank Sync** shall list every bank account from the latest sync, grouped under its connection's name, showing its name, balance and what it's linked to: **Not set up**, **Don't sync**, or one of the user's accounts. Each row offers **Link to an account**, **Create new account**, **Don't sync** and, when linked, **Unlink**. | Planned |
| SYNC-2.2 | A bank account the user hasn't set up yet shall be shown as **Not set up**, listed first and highlighted. **Don't sync** is remembered, so the bank account isn't offered as new again; the user can change it at any time. | Planned |
| SYNC-2.3 | **Create new account** shall ask for the account's **Name** (default the bank account's name, at most 100 characters), **Type** (required, with no default, since Bridge doesn't say), **Institution** (default the institution whose name matches the connection's, ignoring case, or a new institution with the connection's name, created on save) and **Hide Account**. The new account is connected straight away (SYNC-4.1, SYNC-4.6). | Planned |
| SYNC-2.4 | **Link to an account** shall offer the open accounts that aren't linked to another bank account, at any institution, and ask **Sync transactions from**, defaulting to the day after the account's latest transaction, or for an account without transactions the earliest date Bridge returned. Bank transactions dated before it are never added. The account's existing transactions and balance entries are kept. Linking turns off **Adjust balance** on the account's transactions (ACCT-5.5). | Planned |
| SYNC-2.5 | A bank account shall be linked to at most one account, and an account to at most one bank account; the server refuses otherwise ("That bank account is already linked to another account.", "This account is already linked to a bank account."). | Planned |
| SYNC-2.6 | Only bank accounts in US dollars can be linked. Others are listed with "Only accounts in US dollars can be synced." and no link actions. | Planned |
| SYNC-2.7 | **Unlink**, here or on Manage Account (ACCT-4.5), shall after confirming make the account manual, keeping its balance history and transactions, and set the bank account back to **Not set up**. Linking the same bank account again never adds a transaction twice (SYNC-4.1). | Planned |
| SYNC-2.8 | Closing a connected account (ACCT-6.1) shall unlink it, and deleting one (ACCT-1.6) shall too. Either way its bank account goes back to **Not set up**. Reopening an account doesn't link it again. | Planned |
| SYNC-2.9 | A linked bank account that the latest sync didn't return shall be shown as "Missing from SimpleFIN since *date*"; its account keeps its link, but nothing syncs into it until Bridge returns the bank account again. | Planned |
| SYNC-2.10 | Linking, creating and unlinking shall work from the bank accounts the latest sync returned, without asking Bridge again, so they never count against Bridge's limits (SYNC-3.4). | Planned |

## SYNC-3 Sync runs on a schedule and on demand, within Bridge's limits

| ID | Requirement | Status |
|---|---|---|
| SYNC-3.1 | While connected, the server shall sync automatically 4 times a day, 6 hours apart, at a minute past the hour chosen at random when the user connects (for example 5:17, 11:17, 17:17 and 23:17). There's no setting for how often. **Bank Sync** shall offer **Automatic sync** (on by default) to pause it. | Planned |
| SYNC-3.2 | The schedule shall survive restarts: a sync that came due while the server was down runs within a few minutes of it starting, and a restart never adds an extra sync. | Planned |
| SYNC-3.3 | **Bank Sync** shall offer **Sync now**. It's disabled while a sync is running, and while the limit in SYNC-3.4 is reached, with "Available again at *time*". When it finishes, the screen says what the sync added. | Planned |
| SYNC-3.4 | The server shall send Bridge at most 20 account requests in any 24 hours, counting every request, whatever started it, and refuse a sync that would go over ("Bank sync has reached its limit for today. Available again at *time*."). A scheduled sync that would go over is skipped. Bridge allows 24 a day and disables access that goes beyond it, so the margin is deliberate. | Planned |
| SYNC-3.5 | Only one sync shall run at a time; one started while another is running is refused ("A sync is already running."). | Planned |
| SYNC-3.6 | Each sync shall be one request for every bank account, asking for the last 90 days of transactions, the most Bridge returns at once. | Planned |
| SYNC-3.7 | **Bank Sync** shall show when the last sync ran and whether it succeeded, and list the last 10 syncs with when each ran, whether it was scheduled or on demand, its result, and how many transactions it added. | Planned |

## SYNC-4 A sync records transactions and balances in connected accounts

| ID | Requirement | Status |
|---|---|---|
| SYNC-4.1 | For each connected account, a sync shall add the bank's transactions it hasn't added before, recognized by the bank's transaction ID, dated on or after the account's **Sync transactions from** date (SYNC-2.4). Repeated syncs never duplicate a transaction, and one the user deleted is never added again (TXN-2.12). | Planned |
| SYNC-4.2 | A synced transaction's **Date** shall be the day the bank says it happened, or failing that the day it posted, in the server's time zone (APP-5.6). **Amount** is the bank's (money in positive, APP-6.3), **Original Statement** the bank's description as given, and **Merchant** the bank's payee if it gives one, or else its description (trimmed, at most 255 characters), before rules (CAT-8.4). It doesn't adjust the balance (ACCT-5.5). | Planned |
| SYNC-4.3 | New synced transactions shall be categorized by rules and learning (CAT-8.4, CAT-9) in the same sync; the rest are Uncategorized (CAT-5.5). | Planned |
| SYNC-4.4 | When the bank changes a transaction sync added before, sync shall update its date, amount and original statement, unless it's split (TXN-4.8). It never changes the merchant, category, notes or Hide Transaction, and never deletes a transaction the bank stops returning. | Planned |
| SYNC-4.5 | Each sync shall record each connected account's balance as in ACCT-4.2. | Planned |
| SYNC-4.6 | When an account with no balance entries is linked or created (SYNC-2.3, SYNC-2.4), its balance history shall be filled in backward from the bank's balance through the transactions just added: a set entry (ACCT-5.1) at the end of each day with transactions, and one on the day before the earliest, so its chart covers the days the bank returned. | Planned |
| SYNC-4.7 | Pending transactions shall not be added; a transaction is added once it has posted. | Planned |
| SYNC-4.8 | Everything one sync changes shall be saved in one database transaction, or nothing. | Planned |

## SYNC-5 The user hears about sync problems

| ID | Requirement | Status |
|---|---|---|
| SYNC-5.1 | The Dashboard and **Bank Sync** shall show a banner, linking to Bank Sync, while: the last sync failed; Bridge reported a problem with a connection or bank account (for example a bank that needs signing in again in Bridge); syncing is paused (SYNC-1.3); there are bank accounts not set up (SYNC-2.2, "2 new bank accounts found"); or, while connected and with Automatic sync on, no sync has succeeded for 48 hours. It goes away once the cause is gone. | Planned |
| SYNC-5.2 | Messages from Bridge shall be shown as Bridge wrote them, as plain text. | Planned |

## SYNC-6 Pending transactions (later)

Not part of v0.2 (decided 2026-11-07); `TODO.md` lists it under Unscheduled.

| ID | Requirement | Status |
|---|---|---|
| SYNC-6.1 | Synced accounts shall show the bank's pending transactions, marked **Pending**, and replace each with the posted transaction once it posts, even if the bank gives it a new ID. Pending transactions aren't counted in Spending. | Planned |

## Notes

- **Why the connection isn't an environment variable (SYNC-1.5).** A setup token works once: the app has to exchange it for the access URL, which is the real credential. Pasting the token into Settings does that in one step; an environment variable would mean exchanging it by hand. Bridge can revoke the access URL at any time, after which the user connects again with a new token.
- **Why the key is an environment variable (SYNC-1.2).** Encryption only helps if the key isn't stored next to what it protects. The likely leak is a database backup, which would hold both if the key were in the database. Losing the key costs little: connect again with a new setup token from Bridge.
- **Accounts link to bank accounts, not institutions to connections.** A connection is one sign-in, so two sign-ins at one bank (personal and business, say) are two connections, and an institution is just how the user groups accounts. A connected account can move to another institution like any account (ACCT-1.5). Until 2026-11-07, INST-2 had institutions connect, reconnect and disconnect one by one.
- **Why a "Sync transactions from" date rather than merging histories.** Bridge returns at most 90 days, while a manual account may have years of history from CSV imports. Bank CSVs rarely describe a transaction exactly as Bridge does, so overlapping histories can't be matched reliably (TXN-3.12); starting the synced history the day after the existing one avoids duplicates without a merge. It replaced INST-2.8 to 2.11's Combine / Use the bank's history / Keep my history only.
- **Why there's one sync for everything.** One request returns every bank account, and Bridge updates from the banks about once a day, so syncing one account or institution on its own would only use up the daily allowance. Sync now fetches what Bridge has; it doesn't make Bridge contact the bank.
