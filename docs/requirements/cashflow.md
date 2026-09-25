# Cashflow (`CASH`)

Cashflow shows what actually came in and went out over a calendar period, worked out from transactions: total income, total expenses, what was saved and at what rate, with a breakdown by category or by category group.

Screen: **Cashflow** (`/cashflow`).

## CASH-1 The user can see where their money came from and went

| ID | Requirement | Status |
|---|---|---|
| CASH-1.1 | The user can choose the period to view: a **Year** (from two years ago to next year, so 2024 to 2027 when the current year is 2026), a **Period** type (**Monthly**, **Quarterly**, **Yearly**), and, for Monthly, a **Month**, or, for Quarterly, a **Quarter** (Q1 to Q4). It shall open on the current year and month; switching to Quarterly selects the current quarter. | Implemented |
| CASH-1.2 | The figures shall be built from the sum of transaction amounts per category for every transaction dated within the chosen period (both ends included). Transactions in an account flagged **Hide from Cashflow** shall be left out. | Implemented |
| CASH-1.3 | Amounts in categories of Income groups shall count as **income**; amounts in categories of Transfer groups shall be ignored; everything else, including transactions with no known category (labeled *Uncategorized*), shall count as **expenses**. | Implemented |
| CASH-1.4 | Four summary cards shall show, in whole dollars: **Income** (green); **Expenses** (as a positive number, red); **Total Savings** (income minus expenses, green when zero or more, red when negative, shown as "-$3,734"); **Savings Rate** (savings as a percentage of income, 0% when there is no income, in plain text without red/green coloring). | Implemented |
| CASH-1.5 | An **Income** card and an **Expenses** card shall list amounts, to the cent, by category (icon and name) or by category group (name only), largest amount first, in green for income and red for expenses. A single **Category / Group** toggle on each card switches *both* cards together. | Implemented |
| CASH-1.6 | Selecting a row shall open the Transactions screen pre-filtered to that category (or group) and to the period's first and last day (TXN-1.7); for example Q2 2026 opens with start 2026-04-01 and end 2026-06-30. Rows highlight on hover. The filtered list includes the refunds that were netted into the row's total (CASH observations). | Implemented |
| CASH-1.7 | An empty card shall say "No income data for the selected period." or "No expense data for the selected period." | Implemented |

## Observations

- **Hidden transactions are counted.** Transactions marked hidden are excluded from the Transactions list (TXN-1.8) but *included* in Cashflow. If "hidden" is meant to mean "ignore in reports", this is a bug; if it just means "declutter the list", the two are consistent but invisible to the user.
- **Amounts are netted per category.** A refund in an expense category reduces that category's total. In Group view a group's total is the net of its categories. A category whose net turns positive is still reported as an expense of the same size (the screen takes absolute values).
- **Inputs to CASH-1.3 come from the client.** The server returns totals per category and the screen decides income vs. expense using the categories and groups it has loaded, so the rules in CAT-2.2 live in the browser.
- **Period boundaries and time zones.** The browser picks the first day of the period in local time and sends it to the server as a UTC calendar date; the server then works out the period's first and last day in *its* local time. In a time zone ahead of UTC the as-of date could land a day early and shift the boundaries. Not a problem if the browser and server share a zone with the user behind UTC, but not guaranteed.
- **No budget comparison.** Cashflow doesn't show budget figures (see BUD observations).
- **Year list is fixed** to a window of four years around the current one; older data can't be viewed here (it can via the Transactions filters). The sample data starts in February 2022, so 2022 and 2023 are unreachable in Cashflow while 2027 is offered and empty.
- **Mortgage principal counts as spending.** Only categories in Transfer groups are ignored (CASH-1.3), so "Mortgage - Extra Principal" ($5,200 in May 2026, $10,700 in Q2) and "Cash & ATM" are expenses, which is why the sample months show negative savings (May: income $5,021.75, expenses $8,756.01, savings -$3,734, rate -74%). If debt paydown should count as saving, its category needs to move to a Transfer group, or the rule needs to change. The figures do reconcile: the category rows sum exactly to the cards.
- **The Category/Group toggle is shared** by the Income and Expenses cards (CASH-1.5); switching it on one card changes the other, which isn't obvious from two separately labelled toggles.
- **Savings Rate isn't colored** although Total Savings is (CASH-1.4).
- **Debug mode.** In development builds "current month" is May 2026 (APP-4.1).
- **Amount filter on the Transactions screen** compares signed values (TXN observations), which affects how a Cashflow drill-down feels only when the user adds their own filters.
