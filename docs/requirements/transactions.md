# Transactions (`TXN`)

A transaction is one money movement on an account: a date, an amount (negative for money out, positive for money in), a merchant, and a category. Transactions feed Cashflow (CASH); they do not change account balances (see the [ACCT observations](accounts.md#observations)).

Screens: **Transactions** (`/transactions`), **Add Transaction**, **View Transaction**, **Edit Transaction**, **Import Transactions**. Account Details also shows recent transactions (ACCT-2.7).

## TXN-1 The user can find and review transactions

| ID | Requirement | Status |
|---|---|---|
| TXN-1.1 | The Transactions screen shall list transactions in a table with columns, in this order, **Date**, **Account**, **Merchant**, **Category** (icon and name) and **Amount**. The amount shall be shown without a sign: green for money in and the ordinary text color for money out (it is not red). Selecting a row opens that transaction (TXN-2.2). | Implemented |
| TXN-1.2 | The default order shall be newest first (Date, descending arrow). The user can sort by clicking column headers: **Date**, **Merchant** and **Amount** work; **Account** and **Category** look sortable but leave the order unchanged (newest first). The first click on Merchant sorts A to Z; the first click on Amount sorts by the signed amount ascending, so the largest outflows come first. | Partial |
| TXN-1.3 | The list shall load 25 transactions at a time, and a **Load More** button shall append the next 25 while more exist. | Implemented |
| TXN-1.4 | When nothing matches, the screen shall say "No transactions found". | Implemented |
| TXN-1.5 | A **Filters** panel, collapsed until opened, shall let the user narrow the list by: **Min Amount**, **Max Amount**, **Start Date**, **End Date**, **Group**, **Category**, **Account** (a select) and **Merchant**. Filters combine (all must match). **Apply Filters** runs the search and **Clear Filters** resets it. | Implemented |
| TXN-1.10 | The **End Date** filter shall start out set to today, and the list request sends it, so transactions dated after today are hidden until the user clears or changes it. **Clear Filters** puts End Date back to today rather than blank. Start Date starts empty. | Implemented |
| TXN-1.6 | The merchant filter shall match any merchant *containing* the text, ignoring case, and suggest merchants the user has used before. The category and group filters shall suggest matching names as the user types. | Implemented |
| TXN-1.7 | The screen shall accept pre-set filters from the link that opened it: account, category, group, start date and end date. Account Details' **Go To Transactions** and every row of Cashflow (CASH-1.6) use this. | Implemented |
| TXN-1.8 | Transactions marked **hidden** shall be left out of the list, search and Account Details' recent transactions. | Implemented |
| TXN-1.9 | On handset-width screens the category shall appear under the merchant instead of in its own column. | Implemented |

## TXN-2 The user can record and correct transactions by hand

| ID | Requirement | Status |
|---|---|---|
| TXN-2.1 | **Add Transaction** (from the Transactions menu or an account's menu) shall show a form with: **Amount** (required, defaults to 0), **Account** (required; a select of the user's accounts, pre-selected when opened from an account), **Merchant** (text, at most 255 characters), **Original Statement** (text), **Category** (searchable by name), **Date** (date picker, required, defaults to today), **Notes**, and a **Hide Transaction** checkbox. | Implemented |
| TXN-2.2 | **View Transaction** (breadcrumb "Transactions / Transaction Details") shall show, read-only and in this order: **Amount** (large, unsigned, colored as in TXN-1.1), **Account** (a link to Account Details), **Merchant**, **Original Statement**, **Category** (icon and name), **Date**, **Notes** ("-" when empty) and **Hidden** ("Yes" or "No"). A menu offers **Edit** and **Delete**. | Implemented |
| TXN-2.3 | **Edit Transaction** shall allow changing every field, including the account and amount. | Implemented |
| TXN-2.4 | The user can delete a transaction after confirming in a "Delete Transaction" dialog ("Are you sure you want to delete this transaction?", **Cancel** / **Delete**). | Implemented || TXN-2.5 | The server shall reject a new transaction for an account the user doesn't own ("Invalid account specified."), or without a merchant. | Implemented |
| TXN-2.6 | The user shall be told which required fields are missing before saving (merchant and category included). | Partial |

## TXN-3 The user can move transactions in and out as CSV

| ID | Requirement | Status |
|---|---|---|
| TXN-3.1 | **Download Transactions** (Transactions menu, or an account's menu) shall produce a CSV named `Transactions_<timestamp>.csv`, or `Transactions_<account name>_<timestamp>.csv` for one account, with the header `Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden`, oldest first. It shall include hidden transactions and shall have only the header row when there are none. | Implemented |
| TXN-3.2 | **Import Transactions** shall accept a CSV with all eight columns from TXN-3.1 present (`Id` is not needed). A file missing any column shall be refused with "Missing required CSV headers: …" listing them (for example "OriginalStatement, IsHidden"). | Implemented |
| TXN-3.3 | The user chooses a CSV file with **Choose CSV File**, then **Validate Import**, which checks it without saving ("dry run"). When the file is clean, a **Confirm Import** panel says "Please review the validated results before finalizing the import.", shows "Transactions to create: N" and "Rows with errors: 0", and offers **Begin Import** and **Cancel**. The user can confirm only when the dry run found no errors. Confirming shall show "Successfully created N transactions." | Implemented |
| TXN-3.7 | When validation finds errors, the screen shall list each row's message so the user can fix the file (the server returns them, for example "Row 2: Category name 'Nope Category' not found." and "Row 3: Account name 'Nope Account' not found.", counting the header as row 1). Today the screen shows only a "Validation Error:" heading with the summary "Dry run: Created 0 transactions." and no row messages, and no way to proceed. | Partial |
| TXN-3.8 | The Import Transactions screen shall list the columns the file must have. It currently says "Id, Date, AccountName, Merchant, CategoryName, Amount, Notes", which is wrong: `Id` isn't required, and `OriginalStatement` and `IsHidden` are (TXN-3.2). | Partial |
| TXN-3.4 | Each row's account shall be found by its **AccountName**, and its category by **CategoryName**, both ignoring case. A row whose account or category isn't found, or whose category is blank, is an error ("Row 7: Category name 'X' not found."). | Implemented |
| TXN-3.5 | When the import is started from an account (Account Details), every row shall go to that account regardless of its AccountName. | Implemented |
| TXN-3.6 | A blank Merchant is allowed by import; `IsHidden` is true only for the text "true" (any case); an `Amount` that isn't a number is read as 0. | Implemented |

## Observations

- **Money out isn't red.** Cashflow colors expenses red, but the Transactions list and View Transaction show money out in the ordinary text color and only color money in (TXN-1.1). Decide whether outflows should be red too.
- **Nothing tells the user which sign to use.** The Add and Edit forms show **Amount** as a bare number (default 0). Outflows are negative and inflows positive, but the list and view screens hide the sign, so the rule is only discoverable from the data.
- **Future-dated transactions are hidden by default (TXN-1.10).** The pre-filled End Date silently excludes anything after today, and there is no visual hint besides the date field itself. **Clear Filters** re-applies it.
- **Import screen text and errors are wrong or missing (TXN-3.7, TXN-3.8).** A user following the on-screen column list gets "Missing required CSV headers: OriginalStatement, IsHidden", and a user whose file has a bad account or category name gets no indication of which rows.
- **Import breadcrumb.** The screen reads "Accounts / Import Transactions" even when opened from the Transactions menu (APP observations).
- **The Merchant filter's suggestions** come from merchants the user has already used (verified: typing "AMAZ" offers Amazon, Amazon Market, Amazon Market Ry, Amazon Ret).

- **Uncategorized transactions vanish.** The list and search only return transactions that have a category (an inner join), so a transaction whose category was deleted no longer appears anywhere in the UI. It still appears in the CSV export (with a blank category) and counts in Cashflow as *Uncategorized*. The form doesn't require a category (TXN-2.6), and the server accepts a blank one, so the same can happen at creation.
- **Hidden transactions can't be seen again.** The API supports including them, but the UI has no toggle, so a transaction marked hidden is invisible in the app (though still exported, and still counted in Cashflow, see CASH observations). Once hidden there's no in-app way to un-hide it short of knowing its URL.
- **Sorting is only partly wired (TXN-1.2).** The Category and Account column headers look sortable but the server only sorts by date, amount and merchant; the other headers quietly fall back to newest-first.
- **Required fields (TXN-2.6).** The form only marks Account, Amount and Date as required. A missing Merchant fails at the server with a generic error toast; a missing category is accepted (see above).
- **Amount filters compare signed values,** so "Min Amount 100" finds income of 100 or more but no expenses; finding expenses over 100 means a maximum of -100. The table shows amounts unsigned, which makes this easy to trip over.
- **Bad dates crash import.** A `Date` that isn't a valid date makes the server fail with a generic error rather than reporting the row.
- **Import isn't atomic.** Rows insert one at a time; the dry-run gate is what protects the user. `TODO.md` lists bulk insert and the partial-success decision.
- **Account and category IDs on save aren't fully checked (AUTH-6.4):** categories on create and update, and the account on update.
- **Split transactions.** The data model has `isSplit` and `splitParentId`, and import writes `false`/blank, but there is no UI or behavior for splits.
- **No duplicate detection on import.** Importing the same file twice creates every transaction twice. (`TODO.md` mentions de-duplicating for bank sync; nothing exists for CSV.)
- **The Edit form's leftover reasoning** about which fields should be read-only for bank-imported transactions is a design question for when sync exists: today every field is editable (TXN-2.3).
