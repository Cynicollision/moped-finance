# Categories and Category Groups (`CAT`)

Transactions and budget streams are classified with **categories**. Categories are organized into **category groups**, and each group has a **type** (Income, Expense or Transfer) that decides how its categories count in Budget and Cashflow. Expense categories also have a **necessity**, Essential or Discretionary, so the user can see how much of their spending they could cut. One built-in category, **Uncategorized**, holds transactions that haven't been given a category yet.

Screen: **Categories** (`/categories`). Creating and editing happen in dialogs on that screen.

## CAT-1 The user can organize categories into groups

| ID | Requirement | Status |
|---|---|---|
| CAT-1.1 | A category group shall have a name (required, at most 100 characters) and a type: **Income**, **Expense** or **Transfer**. The "Create Group" dialog labels the field **Type**, defaults it to Expense, and keeps **Save** disabled until a name is entered. | Implemented |
| CAT-1.2 | A category shall belong to exactly one group and have a name (required, at most 100 characters), an icon (required; free text, typically one emoji; labelled "Icon (Emoji)"), an **Active** flag (default on), and, in an Expense group, a necessity (CAT-3). | Partial |
| CAT-1.3 | The Categories screen shall show three sections, **Income**, **Expenses** and **Transfers**, below Uncategorized (CAT-5.4). Each lists the groups of that type, sorted by name, as cards headed by the group's name and an **Edit** link, containing the group's categories with their icon, name and a pencil (edit) button, and ending with a **Create Category** button. Within a group, active categories come first, then inactive ones, each sorted by name. | Partial |
| CAT-1.4 | An inactive category shall appear dimmed with a crossed-out eye icon. | Implemented |
| CAT-1.5 | A section with no groups shall say "No income groups found.", "No expense groups found." or "No transfer groups found." | Partial |
| CAT-1.6 | The user can create a group from the screen's menu (**Create Group**), choosing its name and type (default Expense). | Implemented |
| CAT-1.7 | The user can rename a group from its card (**Edit**). | Implemented |
| CAT-1.8 | The user can create a category from the screen's menu (**Create Category**), or from a group's **Create Category** button, which pre-selects that group. If no group exists, the app shall refuse with "Please create a group first." | Implemented |
| CAT-1.9 | The user can edit a category's name, icon, group, Active flag and necessity from its row. | Partial |
| CAT-1.10 | The user can delete a category (CAT-4.4) or an empty category group (CAT-1.15). | Partial |
| CAT-1.11 | Groups of class **Transfer** shall be shown and manageable on the Categories screen. | Retired (merged into CAT-1.3) |
| CAT-1.12 | Category group names shall be unique, ignoring case. Saving a duplicate shall be rejected with "A category group with that name already exists." | Implemented |
| CAT-1.13 | Category names shall be unique across all groups, ignoring case, so CSV import (TXN-3.4) matches exactly one category. Saving a duplicate shall be rejected with "A category with that name already exists." This includes the built-in "Uncategorized" (CAT-5.1). | Implemented |
| CAT-1.14 | A group's type shall be chosen when the group is created and can't be changed afterwards. A group created with the wrong type is fixed by creating one of the right type and moving its categories into it (CAT-1.16). | Partial |
| CAT-1.15 | The user can delete a group from its **Edit** dialog, after confirming, when it has no categories. A group that still has categories shall not be deleted: "Cannot delete a category group that still has categories." | Partial |
| CAT-1.16 | The user can move a category to any group, including a group of another type. Its transactions then count under the new type everywhere, past periods included; the transactions themselves don't change. | Implemented |
| CAT-1.17 | Moving a category into an Expense group from another type shall require choosing its necessity in the same dialog. Moving it out of Expense shall clear its necessity. | Planned |
| CAT-1.18 | A move that would change the type of a category used by a budget stream shall be refused with "This category is used in a budget stream, which must be deleted or assigned to a different category first." | Planned |
| CAT-1.19 | The group picker in the category dialogs shall list groups by type (Income, Expense, Transfer), then by name, each shown as "*group name* (*Type*)", for example "Housing (Expense)". | Partial |

## CAT-2 Categories drive how money is reported

| ID | Requirement | Status |
|---|---|---|
| CAT-2.1 | A budget stream's type (Income or Expense) shall be its category's type. Budget stream forms shall only offer active categories of the matching type; Transfer categories and Uncategorized can't have streams. See BUD-1.1 and BUD-1.3. | Partial |
| CAT-2.2 | Cashflow shall count categories of Income groups as income, ignore categories of Transfer groups, and count categories of Expense groups as expenses. Uncategorized amounts shall count by sign: money in as income, money out as expenses. See CASH-1.3. | Partial |
| CAT-2.3 | Budget and Cashflow shall show how expenses split between Essential and Discretionary (BUD-1.7, CASH-1.8). | Planned |

## CAT-3 The user can say which spending is essential

| ID | Requirement | Status |
|---|---|---|
| CAT-3.1 | Every Expense category shall have a necessity: **Essential** (spending needed to live and work, such as housing, utilities, groceries and insurance) or **Discretionary** (spending that could be cut, such as restaurants, entertainment and travel). Income and Transfer categories have no necessity. | Planned |
| CAT-3.2 | The category dialogs shall show a **Necessity** field only while an Expense group is selected. It shall be required, with no default, and **Save** shall stay disabled until it's chosen. | Planned |
| CAT-3.3 | The Categories screen shall show each expense category's necessity in its row. | Planned |
| CAT-3.4 | The server shall refuse an Expense category without a necessity, and an Income or Transfer category with one. | Planned |

## CAT-4 The user can retire categories they no longer use

A category the user has stopped using can be made **inactive**, which keeps it on past transactions, or **deleted**, which moves its transactions to another category.

| ID | Requirement | Status |
|---|---|---|
| CAT-4.1 | An inactive category shall not be offered when adding or editing a transaction or a budget stream. | Planned |
| CAT-4.2 | A transaction or budget stream that already has an inactive category shall keep it, and its edit form shall show it as the current value. | Planned |
| CAT-4.3 | An inactive category shall still appear on the Categories screen (CAT-1.4), in the Transactions filters, in Cashflow and in exports, and shall still be matched by transaction import (TXN-3.4). | Implemented |
| CAT-4.4 | The user can delete a category from its edit dialog. The confirmation shall say how many transactions use it and ask which category they should move to: **Uncategorized** (the default) or any other active category. Confirming shall move the transactions and delete the category together, or do neither. | Planned |
| CAT-4.5 | A category used by a budget stream shall not be deleted: "This category is used in a budget stream, which must be deleted or assigned to a different category first." | Planned |

## CAT-5 Transactions without a category are Uncategorized

| ID | Requirement | Status |
|---|---|---|
| CAT-5.1 | There shall always be exactly one built-in category, **Uncategorized** (icon ❓), in no group. It shall exist as soon as the database is created, before anyone registers. | Planned |
| CAT-5.2 | Every transaction shall have a category. A transaction saved without one, an imported row with a blank category (TXN-3.4), and a transaction whose category is deleted (CAT-4.4) get Uncategorized. | Planned |
| CAT-5.3 | Uncategorized can't be renamed, moved to a group, made inactive or deleted. The user can change its icon. | Planned |
| CAT-5.4 | The Categories screen shall show Uncategorized above the three sections, with its icon, name, an edit button (icon only), and the explanation "Transactions stay here until you or a rule gives them a category." | Planned |
| CAT-5.5 | When automatic categorization rules exist (CAT-8), a new or imported transaction that matches no rule and has no category shall get Uncategorized. | Planned |

## CAT-6 A new instance starts with a useful set of categories

| ID | Requirement | Status |
|---|---|---|
| CAT-6.1 | The Register screen shall ask how to start: **Start with default categories** (selected) or **Start empty**. See AUTH-2.9. | Planned |
| CAT-6.2 | **Start with default categories** shall create the groups and categories listed below when registration completes. **Start empty** shall create none, leaving only Uncategorized (CAT-5.1). | Planned |

Default categories (E = Essential, D = Discretionary):

| Group | Type | Categories |
|---|---|---|
| Income | Income | 💼 Paycheck, 💰 Bonus, 💸 Interest, 📊 Dividends, 🎁 Other Income |
| Housing | Expense | 🏠 Rent or Mortgage (E), ☂️ Home Insurance (E), 🔧 Home Maintenance (E), 🔨 Home Improvement (D) |
| Bills & Utilities | Expense | ⚡ Electric & Gas (E), 💧 Water & Sewer (E), 🌐 Internet (E), 📱 Phone (E) |
| Food | Expense | 🛒 Groceries (E), 🍽️ Restaurants (D), ☕ Coffee (D) |
| Transportation | Expense | ⛽ Fuel (E), 🚗 Car Payment (E), 🛡️ Auto Insurance (E), 🛠️ Auto Maintenance (E), 🚇 Parking & Transit (E), 🚕 Rideshare (D) |
| Health | Expense | 🩺 Medical (E), 💊 Pharmacy (E), 🏋️ Fitness (D) |
| Shopping | Expense | 🧻 Household Supplies (E), 👕 Clothing (D), 💻 Electronics (D), 🛍️ General Shopping (D) |
| Lifestyle | Expense | 🎬 Entertainment (D), 📺 Subscriptions (D), 🎨 Hobbies (D), ✈️ Travel (D), 💇 Personal Care (D) |
| Giving | Expense | 🎀 Gifts (D), ❤️ Charity (D) |
| Financial | Expense | 🏛️ Taxes (E), 🏦 Fees (E) |
| Transfers | Transfer | 💳 Credit Card Payment, 🔁 Account Transfer, 📈 Investment Contribution, 📉 Extra Loan Payment |

## CAT-7 The user can move categories in and out as CSV

| ID | Requirement | Status |
|---|---|---|
| CAT-7.1 | **Download Categories** (Categories screen menu) shall produce a CSV named `Categories_<timestamp>.csv` with the header `Type,Group,Name,Icon,Necessity,IsActive`, one row per category, ordered by type, group and name, so the file re-imports unchanged. Type is `Income`, `Expense` or `Transfer`; Necessity is `Essential`, `Discretionary` or blank. Uncategorized and groups with no categories are not included. | Planned |
| CAT-7.2 | **Import Categories** (Categories screen menu) shall accept a CSV with the columns from CAT-7.1, validate it without saving first, and let the user confirm only when the dry run found no errors, as transaction import does (TXN-3.2, TXN-3.3, TXN-3.7). It shall be all-or-nothing (TXN-3.9). | Planned |
| CAT-7.3 | Import shall only add. A row whose category name already exists (ignoring case, Uncategorized included) shall be skipped, not changed. The dry run shall report "Categories to create: N" and "Already exist (skipped): M". | Planned |
| CAT-7.4 | A row's group shall be found by name, ignoring case. A group that doesn't exist shall be created with the row's type. A row whose group exists with a different type is an error ("Row 5: Group 'Food' is an Expense group, not Income."). | Planned |
| CAT-7.5 | Each row shall be checked, with every problem in a row reported in one message: **Type** is required and one of the three types (any case); **Group** and **Name** are required, at most 100 characters; **Icon** is required, at most 50 characters; **Necessity** is required on Expense rows and must be blank on others; **IsActive** is true, false (any case) or blank (true). A second row with the same name as an earlier row is an error. | Planned |

## CAT-8 Transactions can be categorized automatically

| ID | Requirement | Status |
|---|---|---|
| CAT-8.1 | The user can define rules that give a transaction a category from its details (for example its merchant or original statement), applied when transactions are added or imported. | Planned |

## Known gaps

- **Transfer groups are invisible (CAT-1.3).** The screen only renders Income and Expenses, so a Transfer group and its categories never show, and can't be edited there. The category dialog's group picker does offer Transfer groups, so moving a category into one makes it disappear from the screen.
- **Group type can still be changed (CAT-1.14).** The Edit Group dialog offers **Type**, which reclassifies every category in the group at once.
- **The group picker isn't sorted (CAT-1.19)** and shows the type in lower case ("Income (income)").
- **No delete in the UI (CAT-1.10, CAT-1.15, CAT-4.4).** The API can delete a category, which leaves its transactions and budget streams with no category. Those transactions count as expenses in Cashflow but disappear from the Transactions list (TXN-1.11). The API already refuses to delete a group that has categories.
- **Inactive categories are still offered (CAT-4.1)** in the transaction form and budget stream dialog. The API can return active categories only, but nothing asks it to.
- **Uncategorized doesn't exist yet (CAT-5).** A transaction can have no category, and Cashflow labels those *Uncategorized* and counts them all as expenses. An instance that already has its own category named "Uncategorized" (the author's does) needs it merged into the built-in one when CAT-5 is built: its transactions move over and it's deleted. Transactions with no category move to it too.
- **The code still says "class".** The type is `CategoryClass` in `shared/` and the `category_class` column; rename them to type when this domain is built.
- **New users start empty (CAT-6).** The user must build the whole tree before they can add or import a transaction.

## Open questions

- **Automatic categorization rules (CAT-8).** What a rule matches (merchant contains, original statement, amount, account), which rule wins when several match, whether rules can be applied to existing transactions, and whether editing a transaction's category offers to create a rule.
- **Budgeting transfers.** Planned savings ("$500 a month to savings") are Transfer categories, which can't have budget streams (CAT-2.1). See BUD open questions.

## Notes

- The defaults (CAT-6.2) would be simplest to ship as a CSV in the CAT-7.1 format, loaded through the category import, so the list and the format can't drift apart.
- Type is looked up through the category's group whenever Budget or Cashflow runs, which is why moving a category (CAT-1.16) needs no change to its transactions.
