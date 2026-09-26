# Budget (`BUD`)

The budget is a list of **streams**: recurring planned income or expenses, each tied to a category, with an amount and how often it recurs. The screen totals them into monthly, quarterly and yearly figures so the user can see what they expect to earn and spend.

Screen: **Budget** (`/budget`). Adding and editing happen in a dialog.

## BUD-1 The user can plan recurring income and expenses

| ID | Requirement | Status |
|---|---|---|
| BUD-1.1 | A budget stream shall have a name (required, at most 100 characters), a category (required), an amount (a number that is 0 or more), and a recurrence (**Monthly**, **Quarterly** or **Yearly**, default Monthly). Its type, **Income** or **Expense**, shall be its category's type (CAT-2.1). | Partial |
| BUD-1.2 | The Budget screen shall show two cards, **Income** and **Expenses**, each with a table of its streams (Name, Group, Category, Amount, Recurrence) and a row menu with **Edit** and **Delete**. On handset-width screens the category, amount and recurrence shall appear under the name. | Implemented |
| BUD-1.3 | The user can add a stream with **Add Income** or **Add Expense**, which open an "Add Income" / "Add Expense" dialog with **Name\***, **Category\*** (a type-to-search list), **Amount\*** (default 0) and **Recurrence\*** (default Monthly), and **Cancel** / **Save** buttons; Save stays disabled until the form is valid. The button decides which categories are offered: active categories of the matching type only (CAT-2.1, CAT-4.1). | Partial |
| BUD-1.4 | The user can edit a stream and can delete one after confirming. | Implemented |
| BUD-1.5 | Streams in each card shall be ordered Monthly, then Quarterly, then Yearly; within a recurrence by group name, then category name. | Implemented |
| BUD-1.7 | The Expenses card shall show its totals split into **Essential** and **Discretionary** (CAT-3.1), as well as combined. | Planned |
| BUD-1.6 | Each card shall show the section's **Monthly Total**, **Quarterly Total** and **Yearly Total**. Every stream is first converted to a monthly amount (quarterly divided by 3, yearly by 12); the quarterly total is 3 times the monthly total and the yearly total is 12 times it. | Implemented |

## Known gaps

- **A stream's type is stored separately from its category (BUD-1.1).** The two can disagree: moving a category to a group of another type leaves its streams under the old type.
- **An empty card shows only its header row.** With no expense streams the Expenses card shows Name/Group/Category/Amount/Recurrence headings over nothing, and $0.00 totals, with no "no streams yet" message (compare CAT-1.5 and INST-1.3).
- **The table is wider than the card.** At about 800 px with the side navigation open, the table runs past the card and the row menu (Edit/Delete) is only reachable by scrolling the page sideways (APP known gaps).
- **Category deleted, stream kept.** Deleting a category through the API leaves the stream with no category, and the table shows a blank group and category for it. CAT-4.5 will block that delete instead.
- **Category ID isn't validated.** Saving a stream with a category ID that doesn't exist fails with a generic database error rather than a clear message.

## Open questions

- **Budget versus actual.** The budget is a standalone plan. Nothing compares it with real transactions, and Cashflow doesn't show budget figures. The obvious next step is a budget-versus-actual view per category and period.
- **A stream's amount is always positive.** Its direction comes from its type, whereas transactions use signs. Any comparison with actual spending has to reconcile the two (CASH open questions).
- **Budgeting transfers.** Planned savings and extra debt payments ("$500 a month to savings") are Transfer categories, which can't have streams today (CAT-2.1). A third **Transfers** (or **Savings**) card would let the budget show income, minus expenses, minus planned saving.

## Notes

- **Sample data.** The seed data has 14 streams across monthly, quarterly and yearly recurrences.
