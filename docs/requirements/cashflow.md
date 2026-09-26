# Cashflow (`CASH`)

Cashflow shows what actually came in and went out over a calendar period, worked out from transactions: total income, total expenses, what was saved and at what rate, with a breakdown by category or by category group.

Screen: **Cashflow** (`/cashflow`).

## CASH-1 The user can see where their money came from and went

| ID | Requirement | Status |
|---|---|---|
| CASH-1.1 | The user can choose the period to view: a **Year** (from two years ago to next year, so 2024 to 2027 when the current year is 2026), a **Period** type (**Monthly**, **Quarterly**, **Yearly**), and, for Monthly, a **Month**, or, for Quarterly, a **Quarter** (Q1 to Q4). It shall open on the current year and month; switching to Quarterly selects the current quarter. | Implemented |
| CASH-1.2 | The figures shall be built from the sum of transaction amounts per category for every transaction dated within the chosen period (both ends included). Transactions in an account flagged **Hide from Cashflow**, or in a hidden account (ACCT-1.9), shall be left out. Transactions in closed accounts (ACCT-6) count. | Partial |
| CASH-1.3 | Amounts in categories of Income groups shall count as **income**, amounts in categories of Transfer groups shall be ignored, and amounts in categories of Expense groups shall count as **expenses**. Uncategorized amounts (CAT-5) shall count by sign: money in as income, money out as expenses. | Partial |
| CASH-1.4 | Four summary cards shall show, in whole dollars: **Income** (green); **Expenses** (as a positive number, red); **Total Savings** (income minus expenses, green when zero or more, red when negative, shown as "-$3,734"); **Savings Rate** (savings as a percentage of income, 0% when there is no income, in plain text without red/green coloring). | Implemented |
| CASH-1.5 | An **Income** card and an **Expenses** card shall list amounts, to the cent, by category (icon and name) or by category group (name only), largest amount first, in green for income and red for expenses. A single **Category / Group** toggle on each card switches *both* cards together. | Implemented |
| CASH-1.6 | Selecting a row shall open the Transactions screen pre-filtered to that category (or group) and to the period's first and last day (TXN-1.7); for example Q2 2026 opens with start 2026-04-01 and end 2026-06-30. Rows highlight on hover. The filtered list includes the refunds that were netted into the row's total (CASH open questions). | Implemented |
| CASH-1.7 | An empty card shall say "No income data for the selected period." or "No expense data for the selected period." | Implemented |
| CASH-1.8 | Cashflow shall show how the period's expenses split between **Essential** and **Discretionary** categories (CAT-3.1), as amounts and as shares of total expenses. | Planned |

## Known gaps

- **Uncategorized counts as expense regardless of sign (CASH-1.3).** Transactions with no category are all treated as expenses today.
- **Hidden accounts are counted (CASH-1.2).** Only **Hide from Cashflow** is checked today.
- **Hidden transactions are counted.** Transactions marked hidden are excluded from the Transactions list (TXN-1.8) but included in Cashflow. Whether that's right depends on the "what a hidden transaction means" decision in `TODO.md`.
- **Period boundaries and time zones.** Periods include the next period's first day west of UTC, and the browser and server can disagree about the as-of date east of UTC. `TODO.md` has the fix.
- **Year list is fixed** to a window of four years around the current one, so older data can't be viewed here (it can via the Transactions filters). The seed data starts in February 2024, so 2027 is offered and empty.
- **The Category/Group toggle is shared** by the Income and Expenses cards (CASH-1.5); switching it on one card changes the other, which isn't obvious from two separately labelled toggles.
- **Savings Rate isn't colored** although Total Savings is (CASH-1.4).
- **Income versus expense is decided in the browser.** The server returns totals per category and the screen applies CASH-1.3 using the categories and groups it has loaded.

## Open questions

- **Debt paydown.** Extra principal payments belong in a Transfer category (the defaults have *Extra Loan Payment*, CAT-6.2), so they don't count as spending. A regular mortgage payment is still one expense, although part of it is principal; separating that needs split transactions (`TODO.md`).
- **No budget comparison.** Cashflow doesn't show budget figures (BUD open questions).
- **Refunds net against their category.** A refund in an expense category reduces that category's total, and in Group view a group's total is the net of its categories. A category whose net turns positive is still reported as an expense of the same size (the screen takes absolute values). Decide whether that should show as income instead.

## Notes

- **Debug mode.** In development builds "current month" is May 2026 (APP-4.1).
- **Amount filter on the Transactions screen** compares signed values (TXN known gaps), which affects how a Cashflow drill-down feels only when the user adds their own filters.
