# Categories and Category Groups (`CAT`)

Transactions and budget streams are classified with **categories**. Categories are organized into **category groups**, and each group has a class (Income, Expense or Transfer) that decides how everything under it is treated in Budget and Cashflow.

Screen: **Categories** (`/categories`). Creating and editing happen in dialogs on that screen.

## CAT-1 The user can organize categories into groups

| ID | Requirement | Status |
|---|---|---|
| CAT-1.1 | A category group shall have a name (required, at most 100 characters) and a class: **Income**, **Expense** or **Transfer**. The dialog ("Create Group") labels the class field **Type**, defaults it to Expense, and keeps **Save** disabled until a name is entered. | Implemented |
| CAT-1.2 | A category shall belong to exactly one group and have a name (required, at most 100 characters), an icon (required; free text, typically one emoji; labelled "Icon (Emoji)"), and an **Active** flag (default on). The "Edit Category" dialog shows the group choice as "*group name* (*class*)", for example "Income (income)" or "Transfers (transfer)". | Implemented |
| CAT-1.3 | The Categories screen shall show two sections, **Income** and **Expenses**. Each lists the groups of that class, sorted by name, as cards headed by the group's name and an **Edit** link, containing the group's categories with their icon, name and a pencil (edit) button, and ending with a **Create Category** button. Within a group, active categories come first, then inactive ones, each sorted by name. | Implemented |
| CAT-1.4 | An inactive category shall appear dimmed with a crossed-out eye icon. | Implemented |
| CAT-1.5 | A section with no groups shall say "No income groups found." or "No expense groups found." | Implemented |
| CAT-1.6 | The user can create a group from the screen's menu (**Create Group**), choosing its name and class (default Expense). | Implemented |
| CAT-1.7 | The user can edit a group's name and class from its card (**Edit**). | Implemented |
| CAT-1.8 | The user can create a category from the screen's menu (**Create Category**), or from a group's **Create Category** button, which pre-selects that group. If no group exists, the app shall refuse with "Please create a group first." | Implemented |
| CAT-1.9 | The user can edit a category's name, icon, group and Active flag from its row. | Implemented |
| CAT-1.10 | The user can delete a category or a category group. | Partial |
| CAT-1.11 | Groups of class **Transfer** shall be shown and manageable on the Categories screen. | Partial |
| CAT-1.12 | Category group names shall be unique, ignoring case. Saving a duplicate shall be rejected with "A category group with that name already exists." | Implemented |
| CAT-1.13 | Category names shall be unique across all groups, ignoring case, so CSV import (TXN-3.4) matches exactly one category. Saving a duplicate shall be rejected with "A category with that name already exists." | Implemented |

## CAT-2 Categories drive how money is reported

| ID | Requirement | Status |
|---|---|---|
| CAT-2.1 | Budget streams shall only offer categories from groups of the matching class (Income streams: Income groups; Expense streams: Expense groups). See BUD-1.3. | Implemented |
| CAT-2.2 | Cashflow shall treat categories in Income groups as income, ignore categories in Transfer groups, and treat everything else as expenses. See CASH-1.3. | Implemented |

## Observations

- **Confirmed: Transfer groups are invisible (CAT-1.11).** The sample data has a "Transfers (transfer)" group. It appears only in the Edit Category group picker (and its categories, such as *Transfer*, *Credit Card Payment*, *Buy* and *Sell*, show on transactions), never on the Categories screen. Because that picker offers the Transfers group, the user can also move any category into it and watch it disappear from the screen.
- **The Edit Category group picker isn't sorted** (it lists Income, Auto & Transport, Pets, Food & Dining, … Transfers), unlike the screen, where groups are alphabetical.
- **"Uncategorized" is also a real category.** The sample data has an "❗Uncategorized" category in the *Other* group. Cashflow's separate *Uncategorized* label for transactions with no category (CASH-1.3) looks the same but is unrelated.
- **The inactive marker.** The first draft said inactive categories show a "Hidden Category" indicator; only the dimming and a crossed-out eye icon were visible, with no text or tooltip.

- **Transfer groups vanish (CAT-1.11).** The group dialog lets the user pick class *Transfer*, but the screen only renders Income and Expense sections, so a Transfer group, and its categories, immediately disappear from view and can't be edited. Yet Cashflow relies on Transfer groups to exclude things like credit-card payments and moves between accounts (CAT-2.2). The fix is probably a third **Transfers** section.
- **No delete in the UI (CAT-1.10).** The API can delete both, but the screen offers no button. Behavior if it did: deleting a group that still has categories would be refused by the database with an unfriendly error; deleting a category leaves its transactions and budget streams with no category. Those transactions would then count as *Uncategorized* expenses in Cashflow but would no longer appear in the Transactions list at all, because the list only returns transactions that have a category (see TXN observations).
- **"Inactive" only affects the Categories screen.** Inactive categories still appear in the transaction category pickers, filters and budget forms. The API can return active categories only, but nothing asks it to.
- **Moving a category between groups** changes its class, and therefore how its past transactions appear in Cashflow. That's expected but may be surprising.
- **New users start empty.** No default groups or categories are created; the user must build the whole tree before they can import or add a transaction.
