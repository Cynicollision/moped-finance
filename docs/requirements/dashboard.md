# Dashboard and Net Worth (`DASH`)

The **Dashboard** entry in the navigation opens the Dashboard (`/dashboard`, page title "Dashboard"). It is the landing page after sign-in: the user's total position, how it has changed, and their open accounts grouped by kind.

The same value-history chart component is reused on Account Details (see ACCT-2.3 to ACCT-2.5).

## DASH-1 The user can see their overall financial position and how it is trending

| ID | Requirement | Status |
|---|---|---|
| DASH-1.1 | The Dashboard shall show a large current value with a chart of that value over time. The user can choose the **View Type**: *Net Worth* (default), *Total Assets* or *Total Liabilities*. | Implemented |
| DASH-1.2 | The user can choose the **Timeframe**: Past 30 Days (default), Past 60 Days, Past 90 Days, Past Year, Past 2 Years, Past 5 Years, Past 10 Years, Year To Date, All Time. Changing either choice shall refresh the chart. | Partial |
| DASH-1.3 | Beneath the value, the Dashboard shall show the change over the timeframe as an amount and a percentage of the starting value, followed by the timeframe's name ("- Past 30 Days", "- All Time"), with direction and favourable/unfavourable coloring (for liabilities, shrinking debt is favourable). | Implemented |
| DASH-1.4 | The chart shall have a point for every day in the timeframe: the sum, over the accounts included (assets only, liabilities only, or all for net worth), of each account's latest balance entry on or before that day. Accounts with no entry yet on a day add nothing. Hidden accounts are left out on every day (ACCT-1.9); closed accounts are included (ACCT-6.2). | Partial |
| DASH-1.5 | When there is no data for the selection the chart area shall say "No data available for the selected timeframe." with the hint "Try adjusting the timeframe or historical view type." | Implemented |
| DASH-1.6 | In the **Total Liabilities** view the headline value shall be negative (for example "-$132,920.89") while the **Total Liabilities** card below shows the same amount unsigned (DASH-2.4, DASH-2.5). Debt shrinking is shown green with a down arrow. | Implemented |
| DASH-1.7 | The headline value shall equal the chart's point for today and the matching card total (DASH-2.5). | Partial |
| DASH-1.8 | When the user has no accounts, the Dashboard shall say "Add an institution and its accounts to see your net worth here." with an **Add your first account** button that opens Add Account (ACCT-1.3), instead of an empty chart. | Planned |

## DASH-2 The user can see every account and its share of the total

| ID | Requirement | Status |
|---|---|---|
| DASH-2.1 | Below an **Accounts** heading, the Dashboard shall list accounts in groups (ACCT-1.2), in this order: **Cash**, **Investments**, **Real Estate**, **Other Assets**, **Credit Cards**, **Loans**. A group with no accounts shall not be shown. Within a group, accounts are sorted by name, ignoring case. | Partial |
| DASH-2.2 | Each group shall show its total and its change over the selected timeframe, as an amount and a percentage of the group's starting value, followed by the timeframe's name. The change is the group's balances at the end of the timeframe minus at the start, using each account's earliest and latest entry in it; accounts with no entries in the timeframe are left out. The change is colored favourable (green) or unfavourable (red) as in DASH-1.3: for example, Cash falling is red with a down arrow, while Credit Cards and Loans falling are green with a down arrow. | Implemented |
| DASH-2.3 | Each account in a group shall show its name, as a link to Account Details, and its current balance. | Implemented |
| DASH-2.4 | Liability balances (credit cards, loans) shall be displayed as positive amounts. | Implemented |
| DASH-2.5 | A **Total Assets** card shall show the sum of Cash, Investments, Real Estate and Other Assets. A **Total Liabilities** card shall show the sum of Credit Cards and Loans. Each shows its breakdown by group. | Partial |
| DASH-2.6 | Net worth shall be total assets minus the size of total liabilities. | Implemented |
| DASH-2.7 | Accounts whose group is not one of the five above shall be omitted from the lists and totals. | Retired (every account has a group from ACCT-1.2, ACCT-1.11) |
| DASH-2.8 | The **Total Assets** and **Total Liabilities** cards shall show only totals and their group breakdown, with no change over time, and account rows shall show only name and balance. | Implemented |
| DASH-2.9 | Hidden accounts (ACCT-1.9) shall be left out of the group lists, the group totals and changes, the cards, and the chart. | Planned |
| DASH-2.10 | Closed accounts (ACCT-6) shall be left out of the group lists. Their balances still count in the group changes, the cards and the chart for the dates they were open. | Planned |

## Known gaps

- **The chart adds up whatever exists on each date (DASH-1.4).** If account A has entries on the 1st and 15th and account B only on the 10th, the series has three points and the 1st and 10th omit the other account, so accounts updated on different days make the total jump.
- **Chart total and card totals can disagree (DASH-1.7).** The big number uses the accounts' current balances; the chart's last point is the sum for its last *date*. Carrying balances forward (DASH-1.4) fixes this.
- **Chart y-axis labels repeat** because they round to the nearest thousand or million (ACCT-2.12).
- **Hidden accounts** are included everywhere (DASH-2.9).
- **Groups are the old five (DASH-2.1, DASH-2.5).** Other Assets doesn't exist yet, Real Estate is listed after Loans, and accounts within a group appear in creation order.
- **Empty state (DASH-1.8).** A new user with no accounts sees an empty chart and no groups.
- **No 5- or 10-year timeframes (DASH-1.2, ACCT-2.4).** The API supports them; the selects don't offer them.

## Notes

- **Liabilities are stored as negative balances.** Account Details and the Total Liabilities headline show them negative, while the Dashboard's lists and cards use absolute values. The favourable/unfavourable logic, the Net Worth series (a plain sum of all balances) and transactions that adjust a balance (ACCT-5.4) depend on it, so a liability's balance is imported as a negative number (ACCT-3), while forms ask for the amount owed and store it negative (APP-6.3).
