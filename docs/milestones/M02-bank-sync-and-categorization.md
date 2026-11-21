# M02 — Bank sync and categorization

Status: in progress. Release: v0.2.0. Next task: T3.

# Plan

## Question

Can Moped keep the owner's real accounts up to date on its own, with new transactions arriving categorized?

"Yes" means: on the owner's server, connected to their real banks through SimpleFIN Bridge for at least a week, every connected account's balance agrees with its bank after each day's syncs, no bank transaction is missing or added twice, and the owner's routine work is only setting up new bank accounts and categorizing what rules and learning left. The share of synced transactions that arrive categorized is measured and written in the Outcome. A guess to beat: two in three by the end of the week, after writing rules for what the first days left Uncategorized. "Not yet" is an answer too, if the Outcome says what broke and what to change.

## Scope

In:

- Requirements: [SYNC](../requirements/bank-sync.md) 1 to 5, ACCT-4 and ACCT-7, CAT-5.5, CAT-8 and CAT-9, and the rows of other domains the tasks below name (ACCT-1.3, 1.5, 1.6, 2.2, 2.6, 2.8, 5.5, 6.1, 6.3; APP-2.4, 2.6; INST-1.12; SET-1.1; TXN-2.12, 4.8).
- The design in [M02-design.md](M02-design.md): the `simplefin` schema, the client, the sync pipeline, the scheduler, the rules tables and `RuleEngine`.
- A fake Bridge for development (T3), so everything up to the live trial is built and tried without a Bridge subscription.
- A live trial on the owner's server with their real banks (T10), and the fixes it leads to.
- Pending transactions (SYNC-6): explored with what the trial records about each bank, then built if matching them to their posted transactions proves reliable, or left for later with the findings written down (T11, decision 9).
- Folding the design into `architecture.md` and releasing v0.2.0.

Out (and where it goes instead):

- Account details such as APY, credit limit or interest rate. `TODO.md`, Unscheduled.
- Matching the two sides of a transfer, and tags as a rule action. `TODO.md`, Ideas.
- Any provider but SimpleFIN Bridge, and any bank account not in US dollars (SYNC-2.6 lists them, unlinkable).
- Webhooks or an external scheduler: polling inside the server only (decided 2026-11-07).
- Real estate values. v0.3.

## Decisions taken in this plan

Made 2026-11-21 to keep the plan concrete; each is cheap to change before its task starts.

1. **Three documents, three jobs.** The requirements say what the app does, `M02-design.md` how this milestone builds it, and this file what to build in what order and how it went. `TODO.md` keeps one line for the milestone and points here. Decisions that change behaviour go in the requirement; ones about the code go in the design doc; ones about the plan go here.
2. **No Bridge subscription until T10.** Everything before it talks to one of three stand-ins:
   - **Recorded fixtures** for tests and CI: responses from Bridge's demo token in `server/src/api/bank-sync/test-data/` (the demo has no pending transactions, so that fixture is edited by hand). CI never calls Bridge.
   - **The fake Bridge** (T3) for development: made-up banks whose transactions grow day by day, and scenarios for each fault the app has to handle.
   - **The demo token** for trying the real client against Bridge itself: Bridge's [developer guide](https://beta-bridge.simplefin.org/info/developers) offers a demo setup token without an account. Each one can be claimed once, and refreshing the page gives a new one. Its access URL has Bridge's usual limits, so it's for a handful of requests, not daily development.
3. **The fake Bridge is an in-process `ISimplefinClient`, not a fake HTTP server.** A server would exercise the HTTP code, but it would need an exception to the client's HTTPS-only rule. The HTTP code is covered by unit tests against the fixtures (with `fetch` stubbed) and by the demo token instead.
4. **Manage Account goes first** (T1): it needs no bank sync, and it gives linking a home (ACCT-7.3).
5. **Rules and learning come after sync** (T8, T9) though they need nothing from it, so their screens can be tried on synced transactions. Whichever of T6 and T8a lands second connects sync to `RuleEngine`; until then sync leaves new transactions Uncategorized.
6. **Rules are split in advance** into T8a (tables, engine, API, applied on add, import and sync) and T8b (the screens). `category_source` and the rule columns on `transactions` come with T8a, since the engine already says why it set a field; T9 adds learning and View Transaction's notes (CAT-8.6).
7. **The live trial runs on the owner's own instance**, with its real history, so linking (SYNC-2.4) is tried on accounts with years of imported transactions. It runs `main`'s image (`sha-<commit>`) after a [backup](../deployment.md#backup-and-restore), since migrations only go forward and restoring the backup is the way back.
8. **One release at the end.** Nothing from this milestone is released before v0.2.0. A v0.1 fix needed once T4 has put half-built bank sync on screen is released as v0.1.x from a branch off the `v0.1.0` tag, and merged into `main` too.
9. **Pending transactions: gather evidence from the start, decide at T11.** What decides the approach is how the owner's banks behave: whether a pending transaction keeps its ID when it posts, how often its amount changes (tips, fuel and hotel holds), and how long it stays pending. So from T4 every sync asks Bridge for pending transactions too (`pending=1`, in the same single request) and stores them with the payload, while SYNC-4.7 still keeps them out of the accounts. The live trial's stored payloads are then the evidence. T11 is the gate: build it in this milestone if matching works for every bank in that evidence, otherwise write down why and leave SYNC-6 for later.

## How to work on a task

1. Read `CLAUDE.md`, this file, `M02-design.md` and the task's requirements, including the rows they point to in other domains.
2. Branch `claude/<short-kebab-summary>` from an up-to-date `main`. One PR per task. If a task turns out to be more than one session, split it here (T5a, T5b) before opening the first PR, rather than leaving a half-finished one.
3. Name tests after their requirement IDs. Bank sync tests use the fake client or the recorded fixtures.
4. Try anything the browser shows in the app, from T4 on with the fake Bridge (`SIMPLEFIN_FAKE=true`, T3).
5. In the PR: tick the task, add a *Changed while doing it* note under it (what differed from the plan, what was added, and in bold what a later task must now do), update requirement statuses, and correct `M02-design.md` where the code proved it wrong.
6. Run the checks in [development.md](../development.md#before-opening-a-pr), open the PR, and let the owner review and merge it before starting the next task.

## Tasks

Each task is about one session and ends in a merged PR with green checks.

- [x] **T1 — Manage Account.** ACCT-7 (all but 7.3's bank sync section), ACCT-1.5, 1.6, 2.2, 2.8, 6.1, 6.3; APP-2.4, 2.6. Replace Edit Account (`account-form`, `edit-account.component`) with the sectioned Manage Account page (Details with its own Save, then Close or delete) and add the Update balance dialog; Close, Reopen and Delete leave Account Details' menu. The Bank sync section is left out until T5, since the Bank Sync page it links to comes with T4. Update `conventions.md`'s **Create and edit** rule (an account's Close and Delete live in Manage Account's last section, not the ⋮ menu) and the Edit Account mentions in APP-1.8, 1.9, 2.7 and 6.3.
  *Done when:* an account's details are edited, its balance updated, and it's closed, reopened and deleted from the new places in the app, each with its message; leaving Details with unsaved changes asks first; the old route redirects or is gone and nothing links to it.
  *Changed while doing it:* Edit Account's files became Manage Account's (`manage-account.component`), and `/accounts/:id/edit` redirects to `/manage`. **Reopen account** now asks first, since ACCT-7.2 gives every section action its own confirmation, and closing and reopening stay on Manage Account (both written into ACCT-7.4). Update balance (`update-balance-dialog.component`) sends only `balanceEntry`, so `FinanceService.saveAccount` takes a partial request; the server needed no change, only a test. The account form keeps its balance field for Add Account alone, with the liability sign helpers in `account-balance.ts`. `danger-button` gained outlined-button colours for Delete account. **T5 must add the Bank sync section between Details and Close or delete (ACCT-7.1 and 7.3 stay Partial and Planned until then), and the unlink on close and delete (ACCT-1.6, 6.1 stay Partial).**

- [x] **T2 — SimpleFIN client, fixtures and the encryption key.** Claim a demo token (decision 2) and record its responses, with `version=2` and without, and with `pending=1`, as fixtures in `server/src/api/bank-sync/test-data/`; the access URL itself isn't committed. Work through the design's **To confirm** list with them and fix the design and SYNC-4.2 to match; what only real banks can answer (the sign of a card's and a loan's balance, pending IDs) waits for T10, and the design says so. Build `simplefin-client.ts` (`ISimplefinClient`: claim, fetch, Zod parsing of v1 and v2 into `SimplefinAccountSet`, credentials moved to a Basic header, HTTPS only, 60-second timeout, nothing logged) and `SecretBox` with `ENCRYPTION_KEY` (startup check, `.env.example`, both compose files, `deployment.md`).
  *Done when:* the client's tests parse every fixture and refuse malformed ones, stub `fetch` to check the request (URL, header, no credentials in the URL) and the 402, 403 and timeout paths; `SecretBox` round-trips and refuses a wrong key and a tampered value; the server refuses to start with a bad `ENCRYPTION_KEY`, naming it; the To confirm list has answers or a task that will answer it.
  *Changed while doing it:* Bridge now warns about any request reaching back more than 44 days ("exceeds recommended range of 45 days ... may be capped"), so SYNC-3.6 asks for 44 days rather than 89 (decided 2026-11-21), and a created account's backfilled history covers 44 days. The demo returns no pending transactions even with `pending=1`, so the pending fixture is edited by hand (the fixtures' README says which). Parsing went into its own `simplefin-response.ts`; `SimplefinAccountSet` is plain JSON with Unix-second timestamps, so a run can store it, and collects Bridge's `errlist`, `errors` and `x-api-message` as `messages`. Failures are a `SimplefinError` with a `kind` and a message safe to log. The design's findings are under **What the demo token showed**, and its To confirm list now holds only what T10 answers (liability signs, statement field, pending IDs, quota warnings). `docker-compose.prod.yml` needed no change, since it passes `.env` through; `docker-compose.yml` sets a fixed development key. SYNC-1.2 is Partial: the startup check is built, Bank Sync's message isn't. **T3's fake must answer in v2's shape with `payee` and `memo`, and `fake:warning` should send a `gen.api` entry in `errlist`. T4 must keep the `SecretBox` that `index.ts` now only checks, map `refused` and `payment-required` to `paused_reason = 'refused'`, pass `fetchAccounts` a start 44 days back, and finish SYNC-1.2.**

- [ ] **T3 — Fake Bridge for development.** A `FakeSimplefinClient` in `server/src/api/bank-sync/fake/`, used by tests too. In development, `SIMPLEFIN_FAKE=true` (set in `docker-compose.yml`) makes the server claim any setup token starting `fake` with the fake, choosing a scenario by the rest of the token (`fake`, `fake:corrections`), and pass any other token to the real client, so the demo token still works. The server refuses to start with it in production, and logs a warning when it's on. Its banks mirror the seed data's (Harbor Community Bank's Everyday Checking and High-Yield Savings, Summit Credit Union's Rewards Visa, Lakeside Home Loans' Mortgage), so a database loaded by `db:seed` has accounts to link, plus one bank account the seed doesn't have (for **Create new account**) and one in Canadian dollars (SYNC-2.6). Transactions are generated from a fixed seed for every day up to the server's today, with merchants like the seed data's, so the same day always gives the same payload and each new day adds a few. A first set of scenarios, which the task may change: `fake` (healthy), `fake:v1` (v1-shaped), `fake:corrections` (the bank changes a few-days-old transaction's amount and description, SYNC-4.4), `fake:new-account` (a bank account appears after the first sync), `fake:missing` (a linked one disappears, SYNC-2.9), `fake:attention` (an `errlist` entry asking to sign in again at one bank, SYNC-5.1), `fake:warning` (Bridge's quota warning in `errors`), `fake:refused` and `fake:payment` (403 and 402 on fetch, SYNC-1.3), `fake:down` (a timeout) and `fake:pending` (pending transactions that post a few days later: some with the same ID, some with a new one, one with a tip added, one that disappears without posting; for SYNC-4.7 now and T11 later). Our own quota (SYNC-3.4) applies to the fake too, so it gets exercised. A **Bank sync in development** section in `development.md`: the fake, the demo token, and what each is for.
  *Done when:* every scenario's payload passes T2's parser, the same day gives the same payload in a test, and the server refuses to start with the fake on in production.

- [ ] **T4 — Connect.** SYNC-1, SYNC-3.3 to 3.7 (Sync now, the quota, the lock, the 44-day request, run history), and SYNC-2.1, 2.2, 2.6, 2.9's list of bank accounts: the `simplefin` schema's `access`, `connections`, `accounts` and `sync_runs` tables, `SyncRunner` up to storing the payload, pending transactions included (decision 9), and the bank accounts (it writes nothing to `finance` yet), the API's status, connect, disconnect, accounts, sync and runs endpoints, the Bank Sync page, and Bank Sync in SET-1.1's list. `TestDatabaseUtil` clears the new schema; `DatabaseErrorUtil` gets messages for its keys.
  *Done when:* in the app with the fake, connecting with `fake` lists the bank accounts under their connections with Not set up first and the Canadian one unlinkable; Sync now adds a run to the list; `fake:refused` pauses syncing and **Connect again** resumes it; Disconnect empties the schema; tests show the 21st request in 24 hours refused, a second sync while one runs refused, and no response, log entry or stored run containing the access URL.

- [ ] **T5 — Link.** SYNC-2.3 to 2.5, 2.7, 2.8, 2.10; ACCT-4.3 (drop `is_manual`, derive Connected from the link), 4.5, 7.3; ACCT-1.3's pointer to Bank Sync, ACCT-2.6, ACCT-5.5, INST-1.12. Linking and creating apply the latest stored payload's transactions to that one account (SYNC-4.1, 4.2, 4.6) without calling Bridge, so this task builds `sync-transform.ts` and `simplefin.transactions` too.
  *Done when:* in the app, the seeded Everyday Checking links to the fake's, **Sync transactions from** defaults to the day after its latest transaction, and only later bank transactions are added, with Adjust balance turned off on the account's existing ones; **Create new account** on the new bank account gives an account whose chart covers the days the bank returned; tests show that unlinking and linking again adds nothing twice, that closing and deleting an account unlink it, that the two unique links are refused with their messages, and the transform's date, amount, merchant and statement rules (SYNC-4.2).

- [ ] **T6 — Sync writes.** SYNC-4.3 to 4.5, 4.7, 4.8; ACCT-4.1, 4.2, 4.4; TXN-2.12 (read-only fields; deleting is remembered), TXN-4.8. Each sync adds and updates transactions and records balances for every linked account, in one database transaction. Categorization calls a hook that does nothing until T8a (decision 5).
  *Done when:* syncing `fake` on several days (the clock moved with `DateTimeUtil.setClock`) adds each day's transactions once; `fake:pending` adds none of its pending transactions, and each one once it posts; `fake:corrections` updates the date, amount and statement but not the merchant, category or notes, and leaves a split transaction alone; a deleted synced transaction isn't added again; a database failure part way through leaves nothing changed (a trigger test, as in the import tests); a connected account refuses Update balance and Adjust balance with ACCT-4.4's message; Edit Transaction shows a synced transaction's fields read-only.

- [ ] **T7 — Schedule and alerts.** SYNC-3.1, 3.2 (`SyncScheduler`, the `bankSyncAutomatic` setting) and SYNC-5 (the banner on the Dashboard and Bank Sync). Prune old `sync_runs` payloads on the log-retention timer, keeping the latest successful one.
  *Done when:* tests of the next-slot calculation cover the four daily slots, catching up after the server was down, never running twice for one slot across a restart, and skipping when over the quota, paused or with Automatic sync off; in the app, `fake:attention`, `fake:refused`, `fake:new-account` and a failed sync each show their banner, which goes once the cause is gone; a test shows payloads older than 30 days pruned except the latest successful one.

- [ ] **T8a — Rules: tables, engine and API.** CAT-8.1 to 8.5 and 8.7, 8.8 (server side), CAT-5.5: `finance.rules`, `rule_conditions`, `rule_actions`, and `category_source`, `category_rule_id` and `merchant_rule_id` on `transactions` (existing categorized ones migrate as `user`); the pure `RuleEngine`; `/api/v1/rules` with reorder, matches and apply; rules applied on transaction create, CSV import and sync.
  *Done when:* the engine's tests include CAT-8.3's renamed-merchant chain and CAT-8.2's direction example; an import with blank categories comes back categorized while one with categories is untouched; a merchant typed on create isn't renamed; deleting a category or account a rule uses is refused with CAT-8.8's message; a sync of `fake` categorizes what a rule matches.

- [ ] **T8b — Rules: screens.** CAT-8.1, 8.3, 8.5, 8.8 (client side); SET-1.1's Rules: the Rules screen (`/settings/rules`, an `<app-list>` with drag to reorder), the rule form as a full page with any number of conditions and actions, the offer to apply a saved rule to existing transactions with its counts, and the category and account delete confirmations naming the rules that use them.
  *Done when:* in the app, a rule written for one of the fake bank's merchants renames and categorizes the next sync's matches, and **Apply to existing** categorizes the earlier ones with the counts it offered; reordering changes which of two overlapping rules wins.

- [ ] **T9 — Learning.** CAT-9, CAT-8.6: the **Learn from my transactions** switch (`categorizationLearning`, off by default), learning's statistics query, learning in `RuleEngine` after the rules, and View Transaction saying how a category or merchant was set.
  *Done when:* tests cover CAT-9.2's thresholds (3 transactions, 80%), ignoring transactions categorized by rules or learning and split ones, and rules winning over learning; in the app, View Transaction shows each note and drops it once the user changes that field.

- [ ] **T10 — Live trial.** Needs the Bridge subscription (about $15 a year), bought any time before. On the owner's server (decision 7): back up, run `main`'s image with T1 to T9 merged, set `ENCRYPTION_KEY`, connect with a real setup token, and link each account, checking **Sync transactions from** against its imported history. Then for at least 7 days: compare each connected account's balance with the bank's own site, look for missing or doubled transactions against the bank's list, write rules for what arrives Uncategorized, and keep the figures: requests a day, sync duration, payload size, the share of synced transactions categorized each day. Answer the design's To confirm list (liability signs, which field holds the statement, payees, quota warnings). For T11, note for each bank whether its transactions arrive pending at all, and keep the trial's payloads: copy them from `simplefin.sync_runs` to the development machine, outside the repository, since they're the owner's data. Each fix is its own PR (T10a, T10b, ...), listed here.
  *Done when:* 7 days in a row end with every difference from the banks explained or fixed, and the figures are written under this task.

- [ ] **T11 — Pending transactions: explore, then build or defer.** SYNC-6, and SYNC-4.7 and TXN-2.12, which change if it's built. Decision 9's gate.
  - **Explore** (T11a: docs and a local script only). Go through the trial's payloads bank by bank (the demo token has no pending transactions): does a pending transaction keep its ID when it posts; if not, what identifies it (same account and amount within a few days, a description that starts the same); how often the amount changes and by how much; how long transactions stay pending; how many vanish without posting. Write the findings into SYNC-6's Notes and a pending section with the matching rule into `M02-design.md`. Write SYNC-6's remaining sub-requirements, deciding: where pending transactions show (the Transactions list and Account Details, marked **Pending**) and where they don't (Spending and budgets; they never adjust a balance, which comes from the bank anyway); whether rules and learning categorize them, and whether a category or notes the user gives one carry over to its posted transaction; what happens to one that vanishes; and the new wording of SYNC-4.7 and TXN-2.12.
  - **Decide**, with the owner. Build if the matching rule, run over the trial's payloads by the local script, pairs every posted transaction with its pending one or finds it new, with nothing doubled and nothing lost. Otherwise mark SYNC-6 for later with the reason, put a pending item back in `TODO.md`'s Unscheduled, and record it in Changes to the plan.
  - **Build** (T11b, if decided): the pending mark on transactions and in `simplefin.transactions`, the matching in `sync-transform.ts`, and the screens. The fake gains a scenario for each pattern the trial found.
  *Done when:* either SYNC-6 is built, with tests for every pattern found and a few days on the owner's server in which every pending transaction was replaced once by its posted one; or the findings and the reason for waiting are in SYNC-6 and `TODO.md`.

- [ ] **T12 — Close and release.** Read the requirements, `M02-design.md` and `deployment.md` against the code and fix every mismatch. Fold what stays true from the design into `architecture.md` (a Bank sync section beside Request flow, the `simplefin` schema under Database, the SimpleFIN notes, rules, and pending transactions if built), and delete the design doc and its links (`CLAUDE.md`, SYNC's and CAT-8's introductions, this file's). Fill in the Outcome, mark the milestone released in `TODO.md` and the [milestones list](README.md), set the version to 0.2.0 ([development.md](../development.md#releases)), and after the merge tag and publish v0.2.0. The next milestone's file is written in its own planning session, as this one was.
  *Done when:* the definition of done below is fully ticked and v0.2.0 is published.

## Definition of done

- [ ] Every sub-requirement the tasks name is `Implemented`, or `Retired` or moved to a later milestone with the reason in its row and in Changes to the plan; the domains' Known gaps say nothing about bank sync or rules that isn't true.
- [ ] In development, with the fake Bridge: connect, link, create, ignore, unlink, Sync now, disconnect and connect again work in the app, and each fault scenario shows what SYNC-1.3 and SYNC-5 say it should.
- [ ] Tests show that repeated and overlapping syncs never add a transaction twice, a deleted one never comes back, a bank's correction updates only what SYNC-4.4 allows, and a failed sync changes nothing.
- [ ] Tests show the server never sends Bridge more than 20 requests in 24 hours, whatever starts them, and never runs two syncs at once.
- [ ] Tests show the access URL in no response, log entry or stored run, and stored only sealed.
- [ ] CI never calls Bridge.
- [ ] The live trial (T10) ran for at least 7 days with the owner's real banks, and its figures are in this file.
- [ ] Pending transactions (T11) are built and tried on the owner's server, or the findings and the reason for waiting are in SYNC-6 and `TODO.md`.
- [ ] `architecture.md` describes bank sync and rules as built; `M02-design.md` is gone and nothing links to it; `deployment.md` covers `ENCRYPTION_KEY` and connecting.
- [ ] v0.2.0 is tagged and published; the Outcome below is filled in; `TODO.md` and the milestones list say released.

# Outcome

*(Filled in when the milestone closes.)*

## Answer

## What was built

## What we learned

## Changes to the plan

## Follow-ups
