# Transactions (`TXN`)

A transaction is one money movement on an account: a date, an amount (negative for money out, positive for money in), a merchant, and a category. Transactions feed Cashflow (CASH). On a manual account a transaction can also **adjust the balance** (ACCT-5); otherwise balances come only from balance history.

Screens: **Transactions** (`/transactions`), **Add Transaction**, **View Transaction**, **Edit Transaction**, **Import Transactions**. Account Details also shows recent transactions (ACCT-2.7).

## TXN-1 The user can find and review transactions

| ID | Requirement | Status |
|---|---|---|
| TXN-1.1 | The Transactions screen shall list transactions in a table with columns, in this order, **Date**, **Account**, **Merchant**, **Category** (icon and name) and **Amount**. The amount shall be shown without a sign: green for money in and the ordinary text color for money out (it is not red). Selecting a row opens that transaction (TXN-2.2). | Implemented |
| TXN-1.2 | The default order shall be newest first (Date, descending arrow). The user can sort by clicking the **Date**, **Account**, **Merchant**, **Category** and **Amount** column headers. Account and Category sort by name, ignoring case, with uncategorized transactions last in ascending order. Ties sort newest first. The first click on Merchant sorts A to Z; the first click on Amount sorts by the signed amount ascending, so the largest outflows come first. | Implemented |
| TXN-1.3 | The list shall load 25 transactions at a time, and a **Load More** button shall append the next 25 while more exist. | Implemented |
| TXN-1.4 | When nothing matches, the screen shall say "No transactions found". | Implemented |
| TXN-1.5 | A **Filters** panel, collapsed until opened, shall let the user narrow the list by: **Min Amount**, **Max Amount**, **Start Date**, **End Date**, **Group**, **Category**, **Account** (a select) and **Merchant**. Filters combine (all must match). **Apply Filters** runs the search and **Clear Filters** resets it. | Implemented |
| TXN-1.10 | The **End Date** filter shall start out set to today, and the list request sends it, so transactions dated after today are hidden until the user clears or changes it. **Clear Filters** puts End Date back to today rather than blank. Start Date starts empty. | Implemented |
| TXN-1.6 | The merchant filter shall match any merchant *containing* the text, ignoring case, and suggest merchants the user has used before. The category and group filters shall suggest matching names as the user types. | Implemented |
| TXN-1.7 | The screen shall accept pre-set filters from the link that opened it: account, category, group, start date and end date. Account Details' **Go To Transactions** and every row of Cashflow (CASH-1.6) use this. | Implemented |
| TXN-1.8 | Transactions marked **hidden** shall be left out of the list, search and Account Details' recent transactions. | Implemented |
| TXN-1.9 | On handset-width screens the category shall appear under the merchant instead of in its own column. | Implemented |
| TXN-1.11 | Every transaction shall appear in the list and search, including those in Uncategorized (CAT-5.2), which can be filtered for like any other category. | Partial |
| TXN-1.12 | Transactions in hidden accounts (ACCT-1.9) shall be left out of the list and search, and hidden accounts left out of the **Account** filter, unless the screen was opened filtered to that account (from its Account Details' **Go To Transactions**). Transactions in closed accounts (ACCT-6) are listed as usual. | Planned |

## TXN-2 The user can record and correct transactions by hand

| ID | Requirement | Status |
|---|---|---|
| TXN-2.1 | **Add Transaction** (from the Transactions menu or an account's menu) shall show a form with: **Amount** (required, defaults to 0), **Account** (required; a select of the user's open, unhidden accounts, sorted by name, plus the transaction's current account when editing; pre-selected when opened from an account), **Merchant** (text, at most 255 characters), **Original Statement** (text), **Category** (searchable by name), **Date** (date picker, required, defaults to today), **Notes**, and a **Hide Transaction** checkbox. | Partial |
| TXN-2.2 | **View Transaction** (breadcrumb "Transactions / Transaction Details") shall show, read-only and in this order: **Amount** (large, unsigned, colored as in TXN-1.1), **Account** (a link to Account Details), **Merchant**, **Original Statement**, **Category** (icon and name), **Date**, **Notes** ("-" when empty) and **Hidden** ("Yes" or "No"). A menu offers **Edit** and **Delete**. | Implemented |
| TXN-2.3 | **Edit Transaction** shall allow changing every field, including the account and amount. | Implemented |
| TXN-2.4 | The user can delete a transaction after confirming in a "Delete Transaction" dialog ("Are you sure you want to delete this transaction?", **Cancel** / **Delete**). | Implemented |
| TXN-2.5 | The server shall reject a new transaction for an account that doesn't exist ("Account not found."), or without a merchant. | Implemented |
| TXN-2.6 | The user shall be told which required fields are missing before saving (merchant and category included). | Partial |
| TXN-2.7 | The **Category** field shall default to Uncategorized (CAT-5.2) and offer only active categories (CAT-4.1), plus the transaction's current category when editing (CAT-4.2). | Planned |
| TXN-2.8 | For a manual account (ACCT-4.3), Add and Edit Transaction shall show an **Adjust balance** checkbox, checked by default on Add. Saving with it checked changes the account's balance history as in ACCT-5.2 and ACCT-5.3. The checkbox isn't shown for a connected account. | Planned |
| TXN-2.9 | View Transaction shall show **Adjusts balance** ("Yes" or "No") for a transaction in a manual account. | Planned |

## TXN-3 The user can move transactions in and out as CSV

| ID | Requirement | Status |
|---|---|---|
| TXN-3.1 | **Download Transactions** (Transactions menu, or an account's menu) shall produce a CSV named `Transactions_<timestamp>.csv`, or `Transactions_<account name>_<timestamp>.csv` for one account, with the header `Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden`, oldest first. Dates shall be written as YYYY-MM-DD and amounts with two decimals, so the file re-imports unchanged. It shall include hidden transactions and shall have only the header row when there are none. | Implemented |
| TXN-3.2 | **Import Transactions** shall accept a CSV with all eight columns from TXN-3.1 present (`Id` is not needed). A file missing any column shall be refused with "Missing required CSV headers: …" listing them (for example "OriginalStatement, IsHidden"). A file that can't be parsed or has no data rows shall also be refused. | Implemented |
| TXN-3.3 | The user chooses a CSV file with **Choose CSV File**, then **Validate Import**, which checks it without saving ("dry run"). When the file is clean, a **Confirm Import** panel says "Please review the validated results before finalizing the import.", shows "Transactions to create: N" and "Rows with errors: 0", and offers **Begin Import** and **Cancel**. The user can confirm only when the dry run found no errors. Confirming shall show "Successfully created N transactions." | Implemented |
| TXN-3.7 | When validation finds errors, the screen shall list each row's message so the user can fix the file (the server returns them, for example "Row 2: Category name 'Nope Category' not found." and "Row 3: Account name 'Nope Account' not found.", counting the header as row 1). Today the screen shows only a "Validation Error:" heading with the server's summary ("Found errors in 2 of 5 rows.") and no row messages, and no way to proceed. | Partial |
| TXN-3.8 | The Import Transactions screen shall list the columns the file must have. It currently says "Id, Date, AccountName, Merchant, CategoryName, Amount, Notes", which is wrong: `Id` isn't required, and `OriginalStatement` and `IsHidden` are (TXN-3.2). | Partial |
| TXN-3.4 | Each row's account shall be found by its **AccountName**, and its category by **CategoryName**, both ignoring case. A row whose account or category isn't found is an error ("Row 7: Category name 'X' not found."). A row with a blank category gets Uncategorized (CAT-5.2). | Partial |
| TXN-3.5 | When the import is started from an account (Account Details), every row shall go to that account regardless of its AccountName. An account that doesn't exist shall be refused ("Account not found."). | Implemented |
| TXN-3.6 | A blank Merchant is allowed by import. | Implemented |
| TXN-3.9 | An import shall be all-or-nothing. If any row has an error, nothing is saved: a confirmed import of such a file shall be refused with "Nothing was imported. Found errors in N of M rows." and the row messages. The rows are saved in one database transaction, so a failure part way through saves none of them. | Implemented |
| TXN-3.10 | Each row shall be checked, and every problem in a row reported in one message ("Row 4: Date '2026-02-30' is not a valid date. Amount 'abc' is not a number."). **Date** is required and must be a real calendar date written as YYYY-MM-DD, M/D/YYYY, or an ISO timestamp (its date part is used). **Amount** is required: a number with an optional sign, `$` and thousands separators, at most two decimal places, and at most 9,999,999,999.99 either way. **IsHidden** must be true, false (any case) or blank (false). **Merchant** is at most 255 characters. A row with the wrong number of columns is an error. | Implemented |
| TXN-3.11 | When the import targets a manual account (TXN-3.5), the screen shall offer **Adjust balances**, unchecked by default. With it checked, each imported transaction adjusts the balance as in ACCT-5.2, in the same database transaction as the import (TXN-3.9). Without it, imported transactions don't adjust balances, so a history imported alongside its balance history isn't counted twice (ACCT-3.11). | Planned |

## Known gaps

- **Import screen text and errors are wrong or missing (TXN-3.7, TXN-3.8).** A user following the on-screen column list gets "Missing required CSV headers: OriginalStatement, IsHidden" (as an error toast, since file-level problems are a 400), and a user whose file has bad rows gets no indication of which rows.
- **Transactions with no category are missing from the list (TXN-1.11).** The list only returns transactions that have a category, so one whose category was deleted through the API disappears from it (while still counting in Cashflow). CAT-5 removes the case.
- **A blank category fails import (TXN-3.4)** instead of going to Uncategorized.
- **Required fields (TXN-2.6).** The form only marks Account, Amount and Date as required. A missing Merchant or category fails at the server with a validation error toast rather than a message on the field.
- **Inactive categories are offered in the form (TXN-2.7).**
- **Every account is offered in the form (TXN-2.1),** in creation order, hidden ones included.
- **Hidden transactions can't be seen again.** The API supports including them, but the UI has no toggle, so a transaction marked hidden is invisible in the app (though still exported, and still counted in Cashflow). Part of the "what a hidden transaction means" decision in `TODO.md`.
- **Nothing tells the user which sign to use.** The Add and Edit forms show **Amount** as a bare number (default 0). Outflows are negative and inflows positive, but the list and view screens hide the sign, so the rule is only discoverable from the data. Part of the "sign conventions" decision in `TODO.md`.
- **Amount filters compare signed values,** so "Min Amount 100" finds income of 100 or more but no expenses; finding expenses over 100 means a maximum of -100. The table shows amounts unsigned, which makes this easy to trip over.
- **Future-dated transactions are hidden by default (TXN-1.10).** The pre-filled End Date silently excludes anything after today, with no visual hint besides the date field itself. **Clear Filters** re-applies it.
- **Import breadcrumb.** The screen reads "Accounts / Import Transactions" even when opened from the Transactions menu (APP known gaps).
- **No duplicate detection on import.** Importing the same file twice creates every transaction twice.

## Open questions

- **Should money out be red?** Cashflow colors expenses red, but the Transactions list and View Transaction show money out in the ordinary text color and only color money in (TXN-1.1).
- **Split transactions.** The data model has `isSplit` and `splitParentId`, and import writes `false`/blank, but there is no UI or behavior for splits (`TODO.md`).
- **Read-only fields for synced transactions.** Once bank sync exists, decide which fields of a bank-imported transaction can be edited. Today every field is editable (TXN-2.3).
