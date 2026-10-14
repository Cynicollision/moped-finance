# Budget (`BUD`)

The budget is a monthly plan: a list of **streams**, recurring planned income, expenses or savings, each tied to a category, with an amount and how often it recurs. Several streams can share a category, so the user can track individual subscriptions or bills. The screen totals them into monthly, quarterly and yearly figures so the user can see what they expect to earn, spend and save.

Budget and Spending (CASH) are separate features that each show a little of the other. Budget shows what was actually spent, to help set amounts (BUD-1.8). Spending shows what was budgeted next to the actuals for its period (CASH-1.10), or next to the average month over the past year (CASH-1.12).

Screen: **Budget** (`/budget`). Adding and editing happen in a side panel (a full-screen dialog on phones).

## BUD-1 The user can plan recurring income and expenses

| ID | Requirement | Status |
|---|---|---|
| BUD-1.1 | A budget stream shall have a name (required, at most 100 characters), a category (required), an amount (a number that is 0 or more), and a recurrence (**Monthly**, **Quarterly** or **Yearly**, default Monthly). Its type, **Income**, **Expense** or **Savings**, shall follow from its category's type: Income, Expense or Transfer (CAT-2.1). | Implemented |
| BUD-1.2 | The Budget screen shall show a summary card (BUD-1.6, BUD-1.10), then three sections, **Income**, **Expenses** and **Savings**, each headed by its total and an **Add** button, with a list of its streams (Name, Group, Category, Amount, Recurrence) and a row menu with **Edit** and **Delete**. On narrow screens (APP-7.1) the category and recurrence shall appear under the name, with the amount and menu beside it, and the group left out. A section with no streams says so ("No savings planned yet."). | Implemented |
| BUD-1.3 | The user can add a stream with a section's **Add** button (labelled "Add Income", "Add Expense" or "Add Savings" for screen readers), which opens an "Add Income" / "Add Expense" / "Add Savings" side panel on the right (full screen on phones, APP-2.6) with **Name\***, **Category\*** (a type-to-search list), **Amount\*** (default 0) and **Recurrence\*** (default Monthly), and **Cancel** / **Save** buttons; Save stays disabled until the form is valid. The section decides which categories are offered: those whose type gives the stream's type (BUD-1.1), active ones only (CAT-2.1, CAT-4.1). | Implemented |
| BUD-1.4 | The user can edit a stream from its row menu, in the same panel as BUD-1.3, and can delete one, after confirming, from its row menu or the panel's **Delete** button. Adding says "Income added", saving "Income saved" and deleting "Income deleted" (or Expense, or Savings; APP-2.8). | Implemented |
| BUD-1.5 | Streams in each section shall be ordered Monthly, then Quarterly, then Yearly; within a recurrence by group name, then category name. | Implemented |
| BUD-1.7 | Once any expense stream's category has a necessity (CAT-3.1), the screen shall show expenses split into **Essential**, **Discretionary** and **Unclassified** (CAT-2.3), for the chosen period (BUD-1.6). The Expenses section shall list its streams under a heading for each part that has streams, with that part's total, keeping BUD-1.5's order within each; the section's own total stays the combined one. | Implemented |
| BUD-1.8 | Once a category is chosen in the stream's panel, it shall say "You've averaged *$amount* a month in *category* over the past 12 months.", in whole dollars, with the same average as Spending's (CASH-1.12): the full months before the current one, at most 12, counting the transactions Spending counts. For an Income or Expense category it's the net (CASH-1.9); for a Transfer category, the money moved out of accounts only (the matching money in would cancel it). With fewer months of history it says so ("over the past 3 months"), and with none it says nothing. When the category has other streams, it shall add "Your other streams in *category* come to *$amount* a month." (the stream being edited isn't counted). | Planned |
| BUD-1.9 | Each section's list shall show, per category, the same 12-month average beside the streams' monthly total. | Retired (2026-10-14: moved to Spending as CASH-1.12; Budget lists streams, and a category can have several, so the average fits Spending's category rows better) |
| BUD-1.10 | The summary card shall lead with **Left over**: income minus expenses minus savings for the chosen period (BUD-1.6), in green, or in red with a "-" when negative. | Implemented |
| BUD-1.6 | The summary card shall have a **Monthly** / **Quarterly** / **Yearly** switch (default Monthly), and every total on the screen, the summary's **Income**, **Expenses** and **Savings** and each section's total, shall be for the chosen period, in whole dollars. Every stream is first converted to a monthly amount (quarterly divided by 3, yearly by 12); the quarterly total is 3 times the monthly total and the yearly total is 12 times it. | Implemented |

## Known gaps

- **No 12-month average in the stream panel yet (BUD-1.8).**

## Notes

- **Stream amounts are positive.** Unlike transactions, a stream's direction comes from its category's type, so amounts are entered and stored without a sign. Comparisons with actuals (BUD-1.8, CASH-1.10, CASH-1.12) use the size of the actual amount.
- **Sample data.** The seed data has 16 streams across monthly, quarterly and yearly recurrences, including two savings streams.
