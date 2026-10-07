# Dashboard and Net Worth (`DASH`)

The **Dashboard** entry in the navigation opens the Dashboard (`/dashboard`, page title "Dashboard"). It is the landing page after sign-in: the user's total position, how it has changed, and their open accounts grouped by kind.

The same value-history chart component is reused on Account Details (see ACCT-2.3 to ACCT-2.5).

## DASH-1 The user can see their overall financial position and how it is trending

| ID | Requirement | Status |
|---|---|---|
| DASH-1.1 | The Dashboard shall show a large current value with a chart of that value over time. The chart's title is the **View Type** and opens a menu to change it: *Net Worth* (default), *Total Assets* or *Total Liabilities*. | Implemented |
| DASH-1.2 | The user can choose the **Timeframe** from a row of buttons under the chart, shortest first: **30D** (Past 30 Days, the default), **60D**, **90D**, **YTD** (Year To Date), **1Y**, **2Y**, **5Y**, **10Y** and **All** (All Time). Each button's accessible name is the full name. On phones the row spans the card. Changing the View Type or Timeframe shall refresh the chart. | Implemented |
| DASH-1.3 | Beneath the value, the Dashboard shall show the change over the timeframe as an amount and a percentage of the starting value, followed by the timeframe's name ("- Past 30 Days", "- All Time"), with direction and favourable/unfavourable coloring (for liabilities, shrinking debt is favourable). | Implemented |
| DASH-1.4 | The chart shall have a point for every day in the timeframe: the sum, over the accounts included (assets only, liabilities only, or all for net worth), of each account's latest balance entry on or before that day. Accounts with no entry yet on a day add nothing. The line steps as in ACCT-2.11. Hidden accounts are left out on every day (ACCT-1.9); closed accounts are included (ACCT-6.2). | Partial |
| DASH-1.5 | When there is no data for the selection the chart area shall say "No data available for the selected timeframe." with the hint "Try adjusting the timeframe or historical view type." | Implemented |
| DASH-1.6 | In the **Total Liabilities** view the headline value shall be negative (for example "-$132,920.89") while the **Total Liabilities** line below shows the same amount unsigned (DASH-2.4, DASH-2.5). Debt shrinking is shown green with a down arrow. | Implemented |
| DASH-1.7 | The headline value shall equal the chart's point for today and the matching section total (DASH-2.5). | Implemented |
| DASH-1.8 | When the user has no accounts, the Dashboard shall say "Add an institution and its accounts to see your net worth here." with an **Add your first account** button that opens Add Account (ACCT-1.3), instead of an empty chart. | Implemented |

## DASH-2 The user can see every account and its share of the total

| ID | Requirement | Status |
|---|---|---|
| DASH-2.1 | Below the chart, the Dashboard shall list accounts in two sections, **Assets** and **Liabilities**, each in groups (ACCT-1.2) in this order: Assets has **Cash**, **Investments**, **Retirement**, **Real Estate** and **Other Assets**; Liabilities has **Credit Cards** and **Loans**. The sections are stacked on narrow screens and side by side from the expanded width (840px of page area) up. A group with no accounts shall not be shown, nor a section with no groups. Within a group, accounts are sorted by name, ignoring case. | Implemented |
| DASH-2.2 | Each group shall show its total and its change over the selected timeframe, as an amount and a percentage of the group's starting value, followed by the timeframe's name. The change is measured as the chart's is (DASH-1.3), on the group's daily total (DASH-1.4): today's total minus the total on the group's first day in the timeframe, which is the timeframe's first day, or the first day one of its accounts has an entry if that's later. An account with no entry yet on that first day adds nothing to it. The change is colored favourable (green) or unfavourable (red) as in DASH-1.3: for example, Cash falling is red with a down arrow, while Credit Cards and Loans falling are green with a down arrow. | Implemented |
| DASH-2.3 | Each account in a group shall show its name, as a link to Account Details, and its current balance. | Implemented |
| DASH-2.4 | Liability balances (credit cards, loans) shall be displayed as positive amounts. | Implemented |
| DASH-2.5 | Each section shall end with its total: **Total Assets**, the sum of the asset groups, and **Total Liabilities**, the sum of the liability groups. There are no separate total cards; the group totals above already break each section down. | Implemented |
| DASH-2.6 | Net worth shall be total assets minus the size of total liabilities. | Implemented |
| DASH-2.7 | Accounts whose group is not one of the five above shall be omitted from the lists and totals. | Retired (every account has a group from ACCT-1.2, ACCT-1.11) |
| DASH-2.8 | The section totals (DASH-2.5) shall show no change over time, and account rows shall show only name and balance; only groups show a change (DASH-2.2). | Implemented |
| DASH-2.9 | Hidden accounts (ACCT-1.9) shall be left out of the group lists, the group totals and changes, the section totals, and the chart. | Planned |
| DASH-2.10 | Closed accounts (ACCT-6) shall be left out of the group lists. Their balances still count in the group changes, the section totals and the chart for the dates they were open. | Planned |

## Known gaps

- **Hidden accounts** are included everywhere (DASH-1.4, DASH-2.9).

## Notes

- **Liabilities are stored as negative balances.** Account Details and the Total Liabilities headline show them negative, while the Dashboard's lists and totals use absolute values. The favourable/unfavourable logic, the Net Worth series (a plain sum of all balances) and transactions that adjust a balance (ACCT-5.4) depend on it, so a liability's balance is imported as a negative number (ACCT-3), while forms ask for the amount owed and store it negative (APP-6.3).
