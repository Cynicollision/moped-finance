# Budget (`BUD`)

The budget is a list of **streams**: recurring planned income or expenses, each tied to a category, with an amount and how often it recurs. The screen totals them into monthly, quarterly and yearly figures so the user can see what they expect to earn and spend.

Screen: **Budget** (`/budget`). Adding and editing happen in a dialog.

## BUD-1 The user can plan recurring income and expenses

| ID | Requirement | Status |
|---|---|---|
| BUD-1.1 | A budget stream shall have a type (**Income** or **Expense**), a name (required, at most 100 characters), a category (required), an amount (a number that is 0 or more), and a recurrence (**Monthly**, **Quarterly** or **Yearly**, default Monthly). | Implemented |
| BUD-1.2 | The Budget screen shall show two cards, **Income** and **Expenses**, each with a table of its streams (Name, Group, Category, Amount, Recurrence) and a row menu with **Edit** and **Delete**. On handset-width screens the category, amount and recurrence shall appear under the name. | Implemented |
| BUD-1.3 | The user can add a stream with **Add Income** or **Add Expense**, which open an "Add Income" / "Add Expense" dialog with **Name\***, **Category\*** (a type-to-search list), **Amount\*** (default 0) and **Recurrence\*** (default Monthly), and **Cancel** / **Save** buttons; Save stays disabled until the form is valid. The stream's type is fixed by the button, and its category choices shall be limited to categories in groups of the matching class. | Implemented |
| BUD-1.4 | The user can edit a stream and can delete one after confirming. | Implemented |
| BUD-1.5 | Streams in each card shall be ordered Monthly, then Quarterly, then Yearly; within a recurrence by group name, then category name. | Implemented |
| BUD-1.6 | Each card shall show the section's **Monthly Total**, **Quarterly Total** and **Yearly Total**. Every stream is first converted to a monthly amount (quarterly divided by 3, yearly by 12); the quarterly total is 3 times the monthly total and the yearly total is 12 times it. | Implemented |

## Observations

- **An empty card shows only its header row.** With no expense streams the Expenses card shows Name/Group/Category/Amount/Recurrence headings over nothing, and $0.00 totals, with no "no streams yet" message (compare CAT-1.5 and INST-1.3).
- **The table is wider than the card.** At about 800 px with the side navigation open, the table runs past the card and the row menu (Edit/Delete) is only reachable by scrolling the page sideways (APP observations).
- **Sample data.** One stream exists: Paycheck, Income group, category Paychecks, $1,000.00 monthly, giving $3,000 quarterly and $12,000 yearly, against actual May 2026 paychecks of $4,934.54, so the budget and Cashflow visibly disagree with nothing to reconcile them.

- **Budget and Cashflow are unconnected.** The budget is a standalone plan. Nothing compares it with real transactions, and Cashflow doesn't show budget figures. The obvious next step is a budget-versus-actual view per category and period.
- **A stream's amount is always positive.** Its direction comes from its type, whereas transactions use signs. Any future comparison has to reconcile the two (CASH observations).
- **Category deleted, stream kept.** Deleting a category leaves the stream with no category; the table shows a blank group and category for it.
- **Ownership.** Deleting a stream doesn't verify the owner, and creating or editing one doesn't verify the category is the user's (AUTH-6.3, AUTH-6.4).
