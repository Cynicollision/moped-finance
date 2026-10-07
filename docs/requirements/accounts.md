# Accounts (`ACCT`)

An account is one balance the user tracks: a checking account, a credit card, a mortgage, a house. Its balance over time is its **balance history**, one entry per date. The current balance is the latest entry.

An account is **manual** or **connected**. A manual account's history comes from the user: a starting balance, **Update Balance**, balance-history imports, and transactions recorded with **Adjust balance** (ACCT-5). A connected account's history comes from bank sync through its institution (INST-2). Either way, Account Details shows a day-by-day balance, so a manual account looks and behaves like a connected one.

Screens: **Account Details** (`/accounts/:id`), **Add Account** (`/accounts/new`), **Edit Account**, **Import Balance History**. Accounts are listed on the **Institutions** page of Settings (INST-1) and the **Dashboard** (DASH).

## ACCT-1 The user can record the accounts they hold

| ID | Requirement | Status |
|---|---|---|
| ACCT-1.1 | An account shall have a name (required, 1 to 100 characters), an institution, a type (required, ACCT-1.2), and the flags **Hide Account** (ACCT-1.9) and **Hide from Spending** (ACCT-1.7). It is manual or connected (ACCT-4.3), and open or closed (ACCT-6). | Partial |
| ACCT-1.2 | The user shall choose an account's kind with a single **Type** field, listed under its groups in this order. The type decides the group, and the group decides whether the account is an Asset or a Liability; the form shows both read-only under the field ("Cash · Asset"). Types behave alike apart from their group and Asset/Liability. | Implemented |
| ACCT-1.3 | The user can add an account from the Institutions screen's **Add account** (INST-1.10), or from an institution card's **Add account** (INST-1.7), which selects that institution. The form asks for the **Institution** from a select of all institutions, sorted by name ignoring case. Its **Save Account** button stays disabled until the form is valid, and a missing name is flagged "Name is required". After saving, the app says "Account added" and opens the new account's Account Details; **Cancel** returns to the Institutions screen (asking first if the form was changed, APP-2.7). When there are no institutions, the screen says so and offers **Add institution**, which opens the Add Institution dialog (INST-1.4), instead of the form; the form appears once one is added. The added account is manual; accounts are connected from the institution (INST-2.3), so the form offers no "Connect" option. | Implemented |
| ACCT-1.4 | A new account shall default to type Checking, both flags off, **Starting Balance** 0 and **As of** today (ACCT-2.2). | Partial |
| ACCT-1.5 | The user can edit an account's name, type and flags from Account Details, then **Edit Account**. Saving returns to Account Details. For a manual account the form also offers **Institution**, a select of all institutions, so the account can move with its history and transactions. For a connected account the institution is shown read-only with "Disconnect this account to move it." (ACCT-4.5). Edit Account has no balance field; the balance changes through Update Balance (ACCT-2.2). | Partial |
| ACCT-1.6 | The user can delete an account with **Delete Account** at the end of the Account Details menu (APP-2.4), after confirming. Deleting an account shall also delete its balance history and its transactions, and then says "Account deleted" and opens the Dashboard. | Implemented |
| ACCT-1.7 | An account flagged **Hide from Spending** shall have its transactions left out of Spending totals (CASH-1.2). It still appears everywhere else. | Implemented |
| ACCT-1.8 | An account flagged **Retirement** shall show "(Retirement)" after its type on Account Details. | Retired (2026-10-07: Retirement is a group of types, ACCT-1.2, so retirement savings get their own total on the Dashboard without a flag) |
| ACCT-1.9 | An account flagged **Hide Account** shall be left out of everything except the Institutions screen and its own Account Details: the Dashboard's lists, totals and chart for every date (DASH-2.9), the Transactions list, search and filters (TXN-1.12), Spending (CASH-1.2), and the account choices in the transaction form (TXN-2.1). Hiding doesn't change the account's data or whether it's connected. | Partial |
| ACCT-1.10 | Every type in ACCT-1.2, credit cards included, shall be creatable and editable in the form. | Implemented |
| ACCT-1.11 | The server shall refuse an account whose type isn't one of ACCT-1.2's, or is missing. The group and Asset/Liability shall always agree with the type: they're worked out from it, and any sent with a request are ignored. | Implemented |
| ACCT-1.12 | The Institutions screen shall show a hidden account dimmed with a crossed-out eye icon, like an inactive category (CAT-1.4), and a closed account dimmed with a "Closed" label. Both open Account Details, where every action still works (for example **Download Balance History**). | Planned |

Account types for ACCT-1.2:

| Group | Asset or Liability | Types |
|---|---|---|
| Cash | Asset | Checking, Savings, Money Market, CD, Other Cash |
| Investments | Asset | Brokerage, HSA, 529, Other Investment |
| Retirement | Asset | 401(k), IRA, Roth IRA, Other Retirement |
| Real Estate | Asset | Primary Residence, Rental Property, Other Property |
| Other Assets | Asset | Vehicle, Other Asset |
| Credit Cards | Liability | Credit Card |
| Loans | Liability | Mortgage, HELOC, Auto Loan, Student Loan, Personal Loan, Other Loan |

Every group has an "Other" type, so anything that doesn't fit a named type still has a home (a 403(b) or pension is Other Retirement, crypto is Other Investment, PayPal or a prepaid card is Other Cash) and the list doesn't need to grow.

## ACCT-2 The user can see an account's balance and how it has changed

| ID | Requirement | Status |
|---|---|---|
| ACCT-2.1 | An account's current balance shall be its latest balance entry dated on or before today, or 0 if it has none. Entries can't be dated after today (APP-8.1), but any that predate that rule, or that the server's one day of slack lets in, are left out. | Implemented |
| ACCT-2.2 | The user can set a manual account's balance: a **Starting Balance** and **As of** date when adding it (ACCT-1.4), and **Update Balance** on Account Details' actions menu afterwards, which asks for a **Balance** and a **Date** (default today, not after today). Either one creates the entry for that date, or replaces the entry already there, as a *set* entry (ACCT-5.1). Entries on other dates don't change. | Partial |
| ACCT-2.3 | Account Details shall show the current balance, a chart of the balance over the selected timeframe, and the change over that timeframe as an amount and a percentage. For a liability, debt shrinking toward zero shall be shown as favourable (green, down arrow) and debt growing as unfavourable (red, up arrow). | Implemented |
| ACCT-2.4 | The timeframe shall be chosen as on the Dashboard (DASH-1.2), from the same row of buttons under the chart, counted back from today. The chart's title is "Current Balance" with no View Type menu. | Implemented |
| ACCT-2.5 | When there is no data for the timeframe the chart area shall say "No data available for the selected timeframe." | Implemented |
| ACCT-2.6 | Account Details shall show the institution's name, the account's type, whether it's **Manual** or **Connected** (ACCT-4.3), and "Balance as of *date*", the date of the current balance's entry. | Partial |
| ACCT-2.7 | Account Details shall list the account's 10 most recent transactions (date, merchant, category, amount, as in TXN-1.1 and TXN-1.9), newest first, or say "No transactions yet.". Selecting one opens it (TXN-2.2). A **Go To Transactions** button shall open the Transactions screen filtered to this account. | Implemented |
| ACCT-2.8 | Account Details shall have an actions menu with: Edit Account, Update Balance (manual accounts only, ACCT-2.2), Add Transaction, Import Transactions, Download Transactions, Import Balance History, Download Balance History, and Close Account or Reopen Account (ACCT-6). The transaction actions shall be scoped to this account. | Partial |
| ACCT-2.9 | Account Details shall show a liability's balance as a negative amount (for example "-$132,516.44" for the mortgage) and its change with the same favourable/unfavourable coloring as ACCT-2.3. The Dashboard shows the same balance unsigned (DASH-2.4). | Implemented |
| ACCT-2.10 | Account Details shall be titled with the account's name, below the Dashboard (APP-1.8), and, for an account with no transactions, an empty Recent Transactions table (header only) with the **Go To Transactions** button still shown. | Partial |
| ACCT-2.11 | The balance chart shall show a value for every day in the timeframe, carrying each entry forward until the next one, so an account updated now and then draws the same kind of line as one synced daily. Days before the account's first entry have no value. | Planned |
| ACCT-2.12 | The chart's axis labels shall be distinct: the y-axis shall use enough precision that neighbouring ticks never read the same (not "$34.3K, $34.3K, $34.2K"). | Implemented |
| ACCT-2.13 | Account Details shall have a **Balance History** section listing the account's entries, newest first, with date, balance, and whether each was set or adjusted (ACCT-5.1). For a manual account the user can edit an entry's balance or delete an entry, after confirming. An edited entry becomes a set entry. | Planned |

## ACCT-3 The user can move balance history in and out as CSV

| ID | Requirement | Status |
|---|---|---|
| ACCT-3.1 | **Download Balance History** shall produce a CSV named `Balances_<account name>_<timestamp>.csv` with the header `Date,AccountName,Balance` and one row per balance entry, newest first, with dates as YYYY-MM-DD and balances with two decimals, so the file re-imports unchanged. An account with no history shall produce the header only. | Implemented |
| ACCT-3.2 | **Import Balance History** shall accept a CSV with at least the columns `Date` and `Balance`. (The screen also lists `AccountName`; it is ignored.) | Implemented |
| ACCT-3.3 | The user chooses a CSV file with **Choose CSV File**, then **Validate Import** (disabled until a file is chosen), which checks the file without saving ("dry run"). When the file is clean, a **Confirm Import** panel says "This import will replace all existing balance history for this account between *start* and *end*.", shows "Days of history to import: N" and "Rows with errors: 0", and offers **Begin Import** and **Cancel**. N is the number of entries in the file, not the calendar days the range spans (a file with 2026-05-01 and 2026-05-03 says 2). | Implemented |
| ACCT-3.4 | The import shall be refused, with a message, when the file can't be parsed, has no data rows, lacks a required column, or contains any invalid row (ACCT-3.10). Nothing is saved from a file with an invalid row. A row-level error message shall name the row, counting the header as row 1 (for example "Row 4: Balance is required."). The server returns those messages. | Implemented |
| ACCT-3.5 | Confirming an import shall **replace** all existing balance entries for the account between the earliest and latest dates in the file, then insert the file's entries as set entries (ACCT-5.1), and show "Successfully imported N records." | Partial |
| ACCT-3.6 | The import shall only be allowed for an account the user owns. | Retired (one owner per instance, AUTH-7) |
| ACCT-3.7 | When validation finds errors, the screen shall show the server's summary ("Found errors in 1 of 3 rows.") under a "Validation Error:" heading, list each row-level message below it so the user can fix the file, and not offer **Begin Import**. | Implemented |
| ACCT-3.8 | The Import Balance History screen shall sit below the Dashboard and the account ("Dashboard / *account name*", APP-1.8) and state the expected columns ("Date, AccountName, Balance"). | Implemented |
| ACCT-3.9 | An account shall have at most one balance per date. The import shall refuse a file with two rows for the same date, reporting the later one (for example "Row 3: Duplicate date 2026-06-06"). | Implemented |
| ACCT-3.10 | Each row's **Date** and **Balance** shall be checked as in TXN-3.10 (Date as YYYY-MM-DD, M/D/YYYY or an ISO timestamp, and not after today, APP-8.1; Balance a number with at most two decimals and at most 9,999,999,999.99 either way), with every problem in a row reported in one message. The replacement in ACCT-3.5 happens in one database transaction, so a failure leaves the existing balances in place. | Implemented |
| ACCT-3.11 | Exporting an account's balance history and transactions (TXN-3.1), then importing both into another account, shall recreate its history there. This is how the user moves a connected account to another institution, or starts over at a new one: hide the old account (ACCT-1.9) so nothing is counted twice. | Partial |

## ACCT-4 The user can have balances kept up to date automatically

| ID | Requirement | Status |
|---|---|---|
| ACCT-4.1 | The user can refresh a connected account's balance and transactions from their bank on demand and on a schedule (see INST-2.1). | Planned |
| ACCT-4.2 | Each sync shall record the bank's balance as a set entry for that day (ACCT-5.1), replacing any entry already on that date. | Planned |
| ACCT-4.3 | An account shall be connected while it's linked to an account at its institution's bank connection (INST-2.3), and manual otherwise. The user doesn't choose this with a flag; the **Manual Account** checkbox is removed from the form. | Planned |
| ACCT-4.4 | A connected account shall not offer **Update Balance**, editing balance entries (ACCT-2.13) or **Adjust balance** on transactions (ACCT-5.5), because its balance comes from the bank. It can still import balance history, for example to backfill dates before it was connected. | Planned |
| ACCT-4.5 | The user can disconnect a single connected account from Account Details, after confirming. It becomes manual, keeping its balance history and transactions, and can later be linked again (INST-2.3). | Planned |

## ACCT-5 The user can keep a manual account's balance current by recording transactions

| ID | Requirement | Status |
|---|---|---|
| ACCT-5.1 | Each balance entry shall be either **set** (entered with Update Balance or as a starting balance, edited in Balance History, imported, or synced) or **adjusted** (created or changed only by transactions). A set entry is a checkpoint: a balance the user or the bank said was true on that date. | Planned |
| ACCT-5.2 | A transaction saved with **Adjust balance** (TXN-2.8) shall add its amount to every entry of its account from its date up to, but not including, the first set entry dated after it. If there's no entry on its date, one is created first as an adjusted entry, equal to the balance carried forward from the latest earlier entry (0 if none). An entry on the transaction's own date shifts even if it's a set entry. | Planned |
| ACCT-5.3 | Editing a transaction that adjusts the balance shall undo its effect and then apply the new one, so a change of amount, date, account or the Adjust balance option leaves the balances as if the transaction had been saved that way to begin with. Deleting it shall undo its effect. Both use ACCT-5.2's range as the entries stand at that moment. | Planned |
| ACCT-5.4 | Amounts are signed as for transactions (TXN): money out is negative. Because liability balances are negative (DASH notes), a $50 card purchase (-50) makes the card's balance 50 more negative, and a $200 payment (+200) makes it 200 less negative. | Planned |
| ACCT-5.5 | Only manual accounts can have transactions that adjust the balance. When a manual account becomes connected, balance entries its transactions already adjusted stay as they are. | Planned |
| ACCT-5.6 | A transaction's balance change and the balance entries it touches shall be saved together in one database transaction, or not at all. | Planned |

## ACCT-6 The user can close an account and keep its history

A closed account is one the user no longer has, such as a savings account they emptied. Its past still counts, unlike a hidden account (ACCT-1.9), which is left out of everything.

| ID | Requirement | Status |
|---|---|---|
| ACCT-6.1 | The user can close an account with **Close Account** on Account Details, after confirming. The dialog asks for a **Closed on** date (default today, not after today). If the balance on that date isn't 0, closing records a set entry of 0 on that date. A connected account is disconnected when it's closed (ACCT-4.5). | Planned |
| ACCT-6.2 | A closed account shall be left out of the Dashboard's account lists (DASH-2.10) and out of the account choices in the transaction form (TXN-2.1). Its past balances still count in the Dashboard's chart and totals, and its transactions still appear in the Transactions list and count in Spending. | Planned |
| ACCT-6.3 | Account Details shall show "Closed on *date*" for a closed account. The user can **Reopen Account**, which makes it open again without changing its balance history. | Planned |

## Known gaps

- **No starting balance (ACCT-1.4, ACCT-2.2).** Add Account doesn't ask for one and there's no Update Balance, so a new account shows $0.00 until history is imported.
- **Balance entries have no source (ACCT-5.1).** Every entry is effectively set; transactions don't touch balances yet.
- **Hide Account only affects Spending so far (ACCT-1.9).** Spending leaves hidden accounts out (CASH-1.2), but no other screen or total does, and the Institutions screen doesn't mark them.
- **No open or closed state (ACCT-1.1, ACCT-6).** Accounts can't be closed yet.
- **Manual vs. connected is a stored flag (ACCT-4.3).** The form no longer shows it and new accounts are saved manual, but it's still the `is_manual` column. Once connections exist, derive it from the link.
- **"Last updated" is the record's edit date (ACCT-2.6),** not the date of the latest balance, so it can be later than the newest balance.
- **Dry-run date range (ACCT-3.3).** A dry run with bad rows reports the date range of the valid rows only.

## Housekeeping

- The shared `AccountFields` type (`shared/finance/types/account.ts`) makes `isHidden`, `isManual` and `hideFromSpending` optional, and `Account` makes `balance` optional, though the columns are `NOT NULL` and the server always returns them. Make them required in responses so the client doesn't need `?? false`.

## Notes

- **Only the type is stored.** The group and Asset/Liability come from ACCT-1.2's table, kept once in shared code, so they can't disagree with the type. The API still returns them with each account, read-only. Adding or renaming a type is a schema change, since the stored values back a `CHECK` constraint.
- **Retirement is a group, not a flag (ACCT-1.8 retired).** The aim was to see retirement savings apart from other investments, which a group does on the Dashboard with no extra setting. The 2026-10-07 migration gave every flagged investment that wasn't a 401(k) or IRA the Other Retirement type, so it kept counting as retirement.
- **Why set entries are checkpoints (ACCT-5.2).** A set balance is one the user read off a statement or the bank reported, so it already includes the transactions before it. Shifting it for a backdated transaction would count that transaction twice. Stopping at the next set entry keeps each checkpoint true.
- **Hidden versus closed.** Hide an account to make it disappear, including its past (for example after moving its history to a new account, ACCT-3.11). Close an account that really ended, so past net worth stays right.
- **Moving accounts.** A manual account moves by changing its institution (ACCT-1.5). A connected one is disconnected first (ACCT-4.5), then moved, then linked at the new institution (INST-2.3); its history stays with it throughout. Export and re-import (ACCT-3.11) also works.
