# Budget (`BUD`)

The budget is a monthly plan: a list of **streams**, recurring planned income, expenses or savings, each tied to a category, with an amount and how often it recurs. Several streams can share a category, so the user can track individual subscriptions or bills. The screen totals them into monthly, quarterly and yearly figures so the user can see what they expect to earn, spend and save.

Budget and Cashflow (CASH) are separate features that each show a little of the other. Budget shows what was actually spent, to help set amounts (BUD-1.8, BUD-1.9). Cashflow shows what was budgeted next to the actuals for its period (CASH-1.10).

Screen: **Budget** (`/budget`). Adding and editing happen in a dialog.

## BUD-1 The user can plan recurring income and expenses

| ID | Requirement | Status |
|---|---|---|
| BUD-1.1 | A budget stream shall have a name (required, at most 100 characters), a category (required), an amount (a number that is 0 or more), and a recurrence (**Monthly**, **Quarterly** or **Yearly**, default Monthly). Its type, **Income**, **Expense** or **Savings**, shall follow from its category's type: Income, Expense or Transfer (CAT-2.1). | Partial |
| BUD-1.2 | The Budget screen shall show three cards, **Income**, **Expenses** and **Savings**, each with a table of its streams (Name, Group, Category, Amount, Recurrence) and a row menu with **Edit** and **Delete**. On narrow screens (APP-7.1) the category and recurrence shall appear under the name, with the amount and menu beside it, and the group left out. | Partial |
| BUD-1.3 | The user can add a stream with **Add Income**, **Add Expense** or **Add Savings**, which open an "Add Income" / "Add Expense" / "Add Savings" dialog with **Name\***, **Category\*** (a type-to-search list), **Amount\*** (default 0) and **Recurrence\*** (default Monthly), and **Cancel** / **Save** buttons; Save stays disabled until the form is valid. The button decides which categories are offered: active categories of the matching type only (CAT-2.1, CAT-4.1). | Partial |
| BUD-1.4 | The user can edit a stream from its row menu, and can delete one, after confirming, from its row menu or its dialog's **Delete** button. Saving says "Income saved" or "Expense saved", and deleting "Income deleted" or "Expense deleted" (APP-2.8). | Implemented |
| BUD-1.5 | Streams in each card shall be ordered Monthly, then Quarterly, then Yearly; within a recurrence by group name, then category name. | Implemented |
| BUD-1.7 | The Expenses card shall show its totals split into **Essential** and **Discretionary** (CAT-3.1), as well as combined. | Planned |
| BUD-1.8 | Once a category is chosen in the stream dialog, it shall say "You've averaged *$amount* a month in *category* over the past 12 months.", counting the 12 full months before the current one and the same transactions Cashflow counts (CASH-1.2). For an Expense category it's the net spending; for a Transfer category, the money moved out of accounts only (the matching money in would cancel it). | Planned |
| BUD-1.9 | Each card's table shall show, per category, the same 12-month average beside the streams' monthly total, so over- or under-budgeted categories stand out. | Planned |
| BUD-1.10 | Below the cards, the screen shall show the monthly **Left over**: income minus expenses minus savings, in red when negative. | Planned |
| BUD-1.6 | Each card shall show the section's **Monthly Total**, **Quarterly Total** and **Yearly Total**. Every stream is first converted to a monthly amount (quarterly divided by 3, yearly by 12); the quarterly total is 3 times the monthly total and the yearly total is 12 times it. | Implemented |

## Known gaps

- **Transfer categories can't have streams (BUD-1.1, BUD-1.2, BUD-1.3),** so there's no Savings card, and nothing shows actual spending (BUD-1.8, BUD-1.9) or what's left over (BUD-1.10).
- **A stream's type is stored separately from its category (BUD-1.1).** The two can disagree: moving a category to a group of another type leaves its streams under the old type.
- **An empty card shows only its header row.** With no expense streams the Expenses card shows Name/Group/Category/Amount/Recurrence headings over nothing, and $0.00 totals, with no "no streams yet" message (compare CAT-1.5 and INST-1.3).
- **Category deleted, stream kept.** Deleting a category through the API leaves the stream with no category, and the table shows a blank group and category for it. CAT-4.5 will block that delete instead.
- **Category ID isn't validated.** Saving a stream with a category ID that doesn't exist fails with a generic database error rather than a clear message.

## Notes

- **Stream amounts are positive.** Unlike transactions, a stream's direction comes from its category's type, so amounts are entered and stored without a sign. Comparisons with actuals (BUD-1.8, CASH-1.10) use the size of the actual amount.
- **Sample data.** The seed data has 14 streams across monthly, quarterly and yearly recurrences.
