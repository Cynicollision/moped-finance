# Accounts Summary and Net Worth (`DASH`)

The **Accounts** entry in the navigation opens the summary page (`/summary`, page title "Dashboard"). It is the landing page after sign-in: the user's total position, how it has changed, and every account grouped by kind.

The same value-history chart component is reused on Account Details (see ACCT-2.3 to ACCT-2.5).

## DASH-1 The user can see their overall financial position and how it is trending

| ID | Requirement | Status |
|---|---|---|
| DASH-1.1 | The summary shall show a large current value with a chart of that value over time. The user can choose the **View Type**: *Net Worth* (default), *Total Assets* or *Total Liabilities*. | Implemented |
| DASH-1.2 | The user can choose the **Timeframe**: Past 30 Days (default), Past 60 Days, Past 90 Days, Past Year, Past 2 Years, Year To Date, All Time. Changing either choice shall refresh the chart. | Implemented |
| DASH-1.3 | Beneath the value, the summary shall show the change over the timeframe as an amount and a percentage of the starting value, followed by the timeframe's name ("- Past 30 Days", "- All Time"), with direction and favourable/unfavourable coloring (for liabilities, shrinking debt is favourable). | Implemented |
| DASH-1.4 | The chart series shall be, for each date with balance history, the sum of the balances recorded on that date across the user's accounts: assets only, liabilities only, or all accounts for net worth. | Implemented |
| DASH-1.5 | When there is no data for the selection the chart area shall say "No data available for the selected timeframe." with the hint "Try adjusting the timeframe or historical view type." | Implemented |
| DASH-1.6 | In the **Total Liabilities** view the headline value shall be negative (for example "-$132,920.89") while the **Total Liabilities** card below shows the same amount unsigned (DASH-2.4, DASH-2.5). Debt shrinking is shown green with a down arrow. | Implemented |

## DASH-2 The user can see every account and its share of the total

| ID | Requirement | Status |
|---|---|---|
| DASH-2.1 | Below an **Accounts** heading, the summary shall list accounts in groups, in this order: **Cash**, **Investments**, **Credit Cards**, **Loans**, **Real Estate**. A group with no accounts shall not be shown. | Implemented |
| DASH-2.2 | Each group shall show its total and its change over the selected timeframe, as an amount and a percentage of the group's starting value, followed by the timeframe's name. The change is the group's balances at the end of the timeframe minus at the start, using each account's earliest and latest entry in it; accounts with no entries in the timeframe are left out. The change is colored favourable (green) or unfavourable (red) as in DASH-1.3: for example, Cash falling is red with a down arrow, while Credit Cards and Loans falling are green with a down arrow. | Implemented |
| DASH-2.3 | Each account in a group shall show its name, as a link to Account Details, and its current balance. | Implemented |
| DASH-2.4 | Liability balances (credit cards, loans) shall be displayed as positive amounts. | Implemented |
| DASH-2.5 | A **Total Assets** card shall show the sum of Cash, Investments and Real Estate. A **Total Liabilities** card shall show the sum of Credit Cards and Loans. Each shows its breakdown by group. | Implemented |
| DASH-2.6 | Net worth shall be total assets minus the size of total liabilities. | Implemented |
| DASH-2.7 | Accounts whose group is not one of the five above shall be omitted from the lists and totals. | Implemented |
| DASH-2.8 | The **Total Assets** and **Total Liabilities** cards shall show only totals and their group breakdown, with no change over time, and account rows shall show only name and balance. | Implemented |

## Observations

- **Liabilities are stored as negative balances (confirmed).** Account Details shows the mortgage as "-$132,516.44" and the Total Liabilities chart headline is negative, while the summary lists and cards use absolute values. The favourable/unfavourable logic and the server's Net Worth series (a plain sum of all balances) depend on it. It should be stated as a rule for balance import (ACCT-3): a liability's balance must be imported as a negative number.
- **Chart y-axis labels repeat** because they round to the nearest thousand or million (ACCT observations); the net-worth axis reads "$1.1M" at every tick.
- **Order inside a group is unspecified.** Accounts appear neither alphabetically nor by balance in every group (Credit Cards read $129.61, $161.48, $42.53, $70.83), which looks like creation order. Say whether it should be by name or by balance.
- **The chart adds up whatever exists on each date.** If account A has an entry on the 1st and 15th and account B only on the 10th, the series has three points and the 1st and 10th omit the other account. It doesn't carry balances forward, so accounts updated on different days can make the total jump. This is the most likely cause of a "weird" net-worth line.
- **Chart total and card totals can disagree.** The big number uses the accounts' current balances; the chart's last point is the sum for its last *date*.
- **Timeframes.** The API also supports 5-year and 10-year windows; the UI doesn't offer them.
- **Hidden accounts** are included in totals (ACCT-1.9).
- **Nav label vs. page title.** The navigation says "Accounts" and the browser tab says "Dashboard".
- **Empty state.** A new user with no accounts sees an empty chart and no groups, with no prompt to add an institution.
