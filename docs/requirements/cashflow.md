# Cashflow (`CASH`)

Cashflow shows what actually came in and went out over a calendar period, worked out from transactions: total income, total expenses, what was saved and at what rate, with a breakdown by category or by category group.

Screen: **Cashflow** (`/cashflow`).

## CASH-1 The user can see where their money came from and went

| ID | Requirement | Status |
|---|---|---|
| CASH-1.1 | The user can choose the period to view: a **Year** (from two years ago to next year, so 2024 to 2027 when the current year is 2026), a **Period** type (**Monthly**, **Quarterly**, **Yearly**), and, for Monthly, a **Month**, or, for Quarterly, a **Quarter** (Q1 to Q4). It shall open on the current year and month; switching to Quarterly selects the current quarter. | Implemented |
| CASH-1.2 | The figures shall be built from the sum of transaction amounts per category for every transaction dated within the chosen period (both ends included). Transactions in an account flagged **Hide from Cashflow**, or in a hidden account (ACCT-1.9), and hidden transactions (TXN-1.8), shall be left out. Transactions in closed accounts (ACCT-6) count. | Partial |
| CASH-1.3 | Amounts in categories of Income groups shall count as **income**, amounts in categories of Transfer groups shall be ignored, and amounts in categories of Expense groups shall count as **expenses**. Uncategorized amounts (CAT-5) shall count by sign: money in as income, money out as expenses. | Partial |
| CASH-1.4 | Four summary cards shall show, in whole dollars: **Income** (green); **Expenses** (as a positive number, in the ordinary text color, APP-6.1); **Total Savings** (income minus expenses, green when zero or more, red when negative, shown as "-$3,734"); **Savings Rate** (savings as a percentage of income, 0% when there is no income, in plain text without red/green coloring). | Partial |
| CASH-1.5 | An **Income** card and an **Expenses** card shall list amounts, to the cent, by category (icon and name) or by category group (name only), largest amount first, in green for income and the ordinary text color for expenses (APP-6.1). A single **Category / Group** toggle on each card switches *both* cards together. | Partial |
| CASH-1.6 | Selecting a row shall open the Transactions screen pre-filtered to that category (or group) and to the period's first and last day (TXN-1.7); for example Q2 2026 opens with start 2026-04-01 and end 2026-06-30. Rows highlight on hover. The filtered list includes the refunds that were netted into the row's total (CASH open questions). | Implemented |
| CASH-1.7 | An empty card shall say "No income data for the selected period." or "No expense data for the selected period." | Implemented |
| CASH-1.8 | Cashflow shall show how the period's expenses split between **Essential** and **Discretionary** categories (CAT-3.1), as amounts and as shares of total expenses. | Planned |
| CASH-1.9 | A category whose net for the period runs against its type (an Expense category whose refunds exceed its spending, or an Income category that's net money out) shall be shown as a negative amount in its card (for example "-$20.00" under Expenses) and reduce that card's total. The same applies to a group in Group view. | Partial |
| CASH-1.10 | In the Income and Expenses cards, a category with budget streams (BUD) shall show its budget for the period next to the actual amount, with the difference ("$40 under", "$25 over"). The period's budget is the streams' monthly total times the months in the period (1, 3 or 12). Over budget on an expense, or under on income, is shown in red. In Group view a group's budget is the sum of its categories'. | Planned |
| CASH-1.11 | The **Income** and **Expenses** summary cards (CASH-1.4) shall show the period's budgeted total beneath the actual one, when any streams of that type exist. | Planned |

## Known gaps

- **Expenses are red (CASH-1.4, CASH-1.5)**, against APP-6.1.
- **Net refunds show as spending (CASH-1.9).** The screen takes absolute values, so an expense category that's net money in is reported as an expense of the same size.
- **No budget figures (CASH-1.10, CASH-1.11).**
- **Uncategorized counts as expense regardless of sign (CASH-1.3).** Transactions with no category are all treated as expenses today.
- **Hidden accounts are counted (CASH-1.2).** Only **Hide from Cashflow** is checked today.
- **Hidden transactions are counted (CASH-1.2).** They're excluded from the Transactions list (TXN-1.8) but included in Cashflow.
- **Period boundaries and time zones.** Periods include the next period's first day west of UTC, and the browser and server can disagree about the as-of date east of UTC. `TODO.md` has the fix.
- **Year list is fixed** to a window of four years around the current one, so older data can't be viewed here (it can via the Transactions filters). The seed data starts in February 2024, so 2027 is offered and empty.
- **The Category/Group toggle is shared** by the Income and Expenses cards (CASH-1.5); switching it on one card changes the other, which isn't obvious from two separately labelled toggles.
- **Savings Rate isn't colored** although Total Savings is (CASH-1.4).
- **Income versus expense is decided in the browser.** The server returns totals per category and the screen applies CASH-1.3 using the categories and groups it has loaded.

## Notes

- **Savings budgets aren't compared here.** Cashflow ignores Transfer categories (CASH-1.3), so Savings streams (BUD-1.2) only appear on the Budget screen.
- **Debt paydown.** A regular loan payment is one expense, even though part of it reduces the loan. An extra principal payment can be split off (TXN-4) into a Transfer category such as *Extra Loan Payment* (CAT-6.2), so it doesn't count as spending.
- **Debug mode.** In development builds "current month" is May 2026 (APP-4.1).
- **Amount filter on the Transactions screen** compares signed values (TXN known gaps), which affects how a Cashflow drill-down feels only when the user adds their own filters.
