# Accounts (`ACCT`)

An account is one balance the user tracks. Its balance over time comes from **balance history** entries, and that is the *only* source of balances: transactions do not change an account's balance (see the observation below).

Screens: **Account Details** (`/accounts/:id`), **Add Account** (from an institution), **Edit Account**, **Import Balance History**.

## ACCT-1 The user can record the accounts they hold

| ID | Requirement | Status |
|---|---|---|
| ACCT-1.1 | An account shall have a name (required, 1 to 100 characters), an institution, an account category (**Asset** or **Liability**), a group, a type, and four flags: **Hide Account**, **Manual Account**, **Retirement Account**, **Hide from Cashflow**. | Implemented |
| ACCT-1.2 | The account form shall offer only valid combinations. The category limits the groups: Asset gives *Cash*, *Investment*, *Real Estate*; Liability gives *Credit Card*, *Loan*. The group limits the types: Cash gives *Checking*, *Savings*; Investment gives *401k*, *IRA*, *Brokerage*, *HSA*; Real Estate gives *Primary Residence*; Loan gives *Home Mortgage*. Changing category or group shall reset the dependent choice to the first valid option. | Implemented |
| ACCT-1.3 | The user can add an account to an institution (from the Institutions screen's **Add account**). The screen first asks "How would you like to add this account?"; **Add manually** is available and a disabled "Connect via (Coming Soon)" button is shown. The manual form is titled "Add Account to *institution name*". Its **Save Account** button stays disabled until the form is valid, and a missing name is flagged "Name is required". After saving, the app returns to the Institutions screen. | Implemented |
| ACCT-1.4 | New manual accounts shall default to: Asset, Cash, Checking, Manual on, other flags off, Balance 0. The add form marks Balance as required. | Implemented |
| ACCT-1.5 | The user can edit an account's name, category, group, type and four flags from Account Details, then **Edit Account**. Saving returns to Account Details. The institution can't be changed (the form has no institution field). Toggling **Manual Account** on shows a **Balance** field (see ACCT-2.2). | Implemented |
| ACCT-1.6 | The user can delete an account from a "Danger Zone" on the Edit screen, after confirming. Deleting an account shall also delete its balance history and its transactions. | Implemented |
| ACCT-1.7 | An account flagged **Hide from Cashflow** shall have its transactions left out of Cashflow totals (CASH-1.2). | Implemented |
| ACCT-1.8 | An account flagged **Retirement** shall show "(Retirement)" after its type on Account Details. | Implemented |
| ACCT-1.9 | An account flagged **Hide Account** shall be left out of account lists and totals. | Partial |
| ACCT-1.10 | A **Credit Card** account shall be creatable and editable in the form (ACCT-1.2 gives that group no types). The form marks **Type** as required and offers no options for it, so the type stays empty and **Save Account** stays disabled; a credit card can't currently be added through the UI. Confirmed on Add Account; Edit Account was not tried on a credit card. | Partial |

## ACCT-2 The user can see an account's balance and how it has changed

| ID | Requirement | Status |
|---|---|---|
| ACCT-2.1 | An account's current balance shall be the balance on its most recent balance-history date, or 0 if it has no history. | Implemented |
| ACCT-2.2 | For a manual account, the user can enter a balance in the account form, and that balance shall become the account's current balance. | Partial |
| ACCT-2.3 | Account Details shall show the current balance, a chart of the balance over the selected timeframe, and the change over that timeframe as an amount and a percentage. For a liability, debt shrinking toward zero shall be shown as favourable (green, down arrow) and debt growing as unfavourable (red, up arrow). | Implemented |
| ACCT-2.4 | The timeframe choices shall be Past 30 Days (default), Past 60 Days, Past 90 Days, Past Year, Past 2 Years, Year To Date and All Time, counted back from today. | Implemented |
| ACCT-2.5 | When there is no data for the timeframe the chart area shall say "No data available for the selected timeframe." | Implemented |
| ACCT-2.9 | Account Details shall show a liability's balance as a negative amount (for example "-$132,516.44" for the mortgage) and its change with the same favourable/unfavourable coloring as ACCT-2.3. The Accounts summary shows the same balance unsigned (DASH-2.4). | Implemented |
| ACCT-2.10 | Account Details shall show a breadcrumb "Accounts / *account name*" and, for an account with no transactions, an empty Recent Transactions table (header only) with the **Go To Transactions** button still shown. | Implemented |
| ACCT-2.6 | Account Details shall show the institution's name, the account's type (or group when it has no type), and the date it was last updated. | Implemented |
| ACCT-2.7 | Account Details shall list the account's 10 most recent transactions (date, merchant, category, amount), newest first. Selecting one opens it (TXN-2.2). A **Go To Transactions** button shall open the Transactions screen filtered to this account. | Implemented |
| ACCT-2.8 | Account Details shall have an actions menu with: Edit Account, Add Transaction, Import Transactions, Download Transactions, Import Balance History, Download Balance History. The transaction actions shall be scoped to this account. | Implemented |

## ACCT-3 The user can move balance history in and out as CSV

| ID | Requirement | Status |
|---|---|---|
| ACCT-3.1 | **Download Balance History** shall produce a CSV named `Balances_<account name>_<timestamp>.csv` with the header `Date,AccountName,Balance` and one row per balance entry. An account with no history shall produce the header only. | Implemented |
| ACCT-3.2 | **Import Balance History** shall accept a CSV with at least the columns `Date` and `Balance`. (The screen also lists `AccountName`; it is ignored.) | Implemented |
| ACCT-3.3 | The user chooses a CSV file with **Choose CSV File**, then **Validate Import** (disabled until a file is chosen), which checks the file without saving ("dry run"). When the file is clean, a **Confirm Import** panel says "This import will replace all existing balance history for this account between *start* and *end*.", shows "Days of history to import: N" and "Rows with errors: 0", and offers **Begin Import** and **Cancel**. N is the number of entries in the file, not the calendar days the range spans (a file with 2026-05-01 and 2026-05-03 says 2). | Implemented |
| ACCT-3.4 | The import shall be refused, with a message, when the file can't be parsed, is empty, lacks a required column, or contains any row with a missing Date or Balance. A row-level error message shall name the row, counting the header as row 1 (for example "Row 4: Date and Balance are required"). The server returns those messages. | Implemented |
| ACCT-3.7 | When validation finds errors, the screen shall list each row-level message so the user can fix the file, and shall not offer **Begin Import**. Today the confirm panel is correctly withheld, but the screen shows only a "Validation Error:" heading and the server's summary line (for example "Dry run: Will replace dates 2026-05-01 to 2026-05-03"); the row messages are never displayed and the summary line looks like a success message under an error heading. | Partial |
| ACCT-3.8 | The Import Balance History screen shall show a breadcrumb "Accounts / *account name* / Import Balance History" and state the expected columns ("Date, AccountName, Balance"). | Implemented |
| ACCT-3.5 | Confirming an import shall **replace** all existing balance entries for the account between the earliest and latest dates in the file, then insert the file's entries, and show "Successfully imported N records." | Implemented |
| ACCT-3.6 | The import shall only be allowed for an account the user owns. | Implemented |

## ACCT-4 The user can have balances kept up to date automatically

| ID | Requirement | Status |
|---|---|---|
| ACCT-4.1 | The user can refresh an account's balance from their bank on demand and on a schedule (see INST-2.1). | Planned |

## Observations

- **Credit cards can't be added (ACCT-1.10).** Every other group has at least one type, so the required Type field only blocks this one. The sample credit cards exist with no type and show their group ("Credit Card") where the type would be. Either give the group a type, or make Type optional when a group has none.
- **Institution can't be changed** after an account is created (ACCT-1.5); moving an account means deleting it, which also deletes its history and transactions (ACCT-1.6).
- **Chart axis labels lose precision.** On Account Details (and the summary chart) the y-axis rounds to thousands or millions, so neighbouring ticks repeat: "$34.3K, $34.3K, $34.3K, $34.2K, …" on a savings account, "$1.1M" six times on net worth. The line is right; the labels aren't readable.
- **Balance import dry-run screen** (ACCT-3.7): the same summary-under-"Validation Error" pattern appears on the Transactions import (see TXN-3.3). The dry run shows the range from the *valid* rows only; a file with one bad row still reports the range of the others.

- **Balance entered on the form is discarded (ACCT-2.2).** The form shows a Balance field for manual accounts, and the client sends it, but the server neither accepts nor stores it on create or edit. Balances only come from balance history, so a new account always shows $0.00 until history is imported. Either the field should write a balance-history entry, or it should be removed and manual balances entered another way (for example an "Update balance" action). This is the biggest functional gap in the domain.
- **Hide Account has no effect (ACCT-1.9).** The flag is saved and editable, but no screen or total filters hidden accounts out. Decide whether it should.
- **Manual vs. connected is only a flag.** *Manual* is a checkbox that also toggles the balance field. Nothing else depends on it yet; automated sync (ACCT-4.1) will need it to mean something.
- **Transactions never change balances.** Adding, importing or deleting a transaction leaves every balance and the net-worth chart untouched. This may be intended (balances are reported by the bank or entered), but it's the kind of rule worth stating explicitly if you keep it.
- **Import quirks.** A `Balance` that isn't a number is silently read as 0. A `Date` that isn't a valid date isn't reported as a row error; it makes the server fail with a generic 500 error. When a file fails to parse the server answers with success plus `isValidToImport: false` rather than an error status (`TODO.md` already lists this). Partial import (skip bad rows, import the rest) is an open decision in `TODO.md`; today one bad row blocks everything (ACCT-3.4).
- **Account "last updated"** reflects edits to the account record, not the date of the latest balance. In the sample data it reads "Jun 20, 2026" on accounts whose newest balance is from May 2026 (and which is later than the development build's fixed "today").
- **Sync is a stub** (see INST observations) and has no UI beyond the disabled button in ACCT-1.3.
- **Ownership.** Creating or editing an account doesn't check that the chosen institution is yours (AUTH-6.4).
