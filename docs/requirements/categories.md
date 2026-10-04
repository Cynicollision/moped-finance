# Categories and Category Groups (`CAT`)

Transactions and budget streams are classified with **categories**. Categories are organized into **category groups**, and each group has a **type** (Income, Expense or Transfer) that decides how its categories count in Budget and Spending. An Expense category can also have a **necessity**, Essential or Discretionary, so the user can see how much of their spending they could cut. It's optional: expense categories without one are **Unclassified**. One built-in category, **Uncategorized**, holds transactions that haven't been given a category yet.

Screens, both pages of Settings: **Categories** (`/settings/categories`, also in the profile menu, APP-1.5), where creating and editing happen in dialogs, and **Rules** (`/settings/rules`, CAT-8, listed in Settings and linked from the Categories menu).

## CAT-1 The user can organize categories into groups

| ID | Requirement | Status |
|---|---|---|
| CAT-1.1 | A category group shall have a name (required, at most 100 characters) and a type: **Income**, **Expense** or **Transfer**. The "Create Group" dialog labels the field **Type**, defaults it to Expense, and keeps **Save** disabled until a name is entered. | Implemented |
| CAT-1.2 | A category shall belong to exactly one group and have a name (required, at most 100 characters), an icon (required; free text, typically one emoji; labelled "Icon (Emoji)"), an **Active** flag (default on), and, in an Expense group, an optional necessity (CAT-3). | Implemented |
| CAT-1.3 | The Categories screen shall show three sections, **Income**, **Expenses** and **Transfers**, below Uncategorized (CAT-5.4). Each lists the groups of that type, sorted by name, as cards headed by the group's name and an **Edit** link, containing the group's categories with their icon, name and a pencil (edit) button, and ending with a **Create Category** button. Within a group, active categories come first, then inactive ones, each sorted by name. | Partial |
| CAT-1.4 | An inactive category shall appear dimmed with a crossed-out eye icon. | Implemented |
| CAT-1.5 | A section with no groups shall say "No income groups found.", "No expense groups found." or "No transfer groups found." | Implemented |
| CAT-1.6 | The user can create a group from the screen's menu (**Create Group**), choosing its name and type (default Expense). | Implemented |
| CAT-1.7 | The user can rename a group from its card (**Edit**). | Implemented |
| CAT-1.8 | The user can create a category from the screen's menu (**Create Category**), or from a group's **Create Category** button, which pre-selects that group. If no group exists, the app shall refuse with "Please create a group first." | Implemented |
| CAT-1.9 | The user can edit a category's name, icon, group, Active flag and necessity from its row. | Implemented |
| CAT-1.10 | The user can delete a category (CAT-4.4) or an empty category group (CAT-1.15). | Partial |
| CAT-1.11 | Groups of class **Transfer** shall be shown and manageable on the Categories screen. | Retired (merged into CAT-1.3) |
| CAT-1.12 | Category group names shall be unique, ignoring case. Saving a duplicate shall be rejected with "A category group with that name already exists." | Implemented |
| CAT-1.13 | Category names shall be unique across all groups, ignoring case, so CSV import (TXN-3.4) matches exactly one category. Saving a duplicate shall be rejected with "A category with that name already exists." This includes the built-in "Uncategorized" (CAT-5.1). | Implemented |
| CAT-1.14 | A group's type is chosen when the group is created, and can only be changed while the group has no categories, since it decides how they count. For a group with categories, the Edit Group dialog shall show the type read-only, and the server shall refuse a change: "A category group's type can't be changed while it has categories." A group of the wrong type is fixed by moving its categories into a group of the right type (CAT-1.16). | Implemented |
| CAT-1.15 | The user can delete a group with the **Delete** button of its **Edit** dialog (APP-2.4), after confirming, when it has no categories. For a group that still has categories, Delete shall be disabled, with one note covering this and CAT-1.14: "To change the type or delete this group, first move or delete its N categories." ("1 category" for one). The server shall refuse: "Cannot delete a category group that still has categories." | Implemented |
| CAT-1.16 | The user can move a category to any group, including a group of another type. Its transactions then count under the new type everywhere, past periods included; the transactions themselves don't change. | Implemented |
| CAT-1.17 | Moving a category into an Expense group from another type shall offer its necessity in the same dialog (CAT-3.2). Moving it out of Expense shall clear its necessity, in the dialog and on the server. | Implemented |
| CAT-1.18 | Moving a category used by a budget stream to a group of another type shall move its streams with it: they take the new type (BUD-1.1) and show in that section of the Budget screen. | Implemented |
| CAT-1.19 | The group picker in the category dialogs shall list groups by type (Income, Expense, Transfer), then by name, each shown as "*group name* (*Type*)", for example "Housing (Expense)". | Implemented |

## CAT-2 Categories drive how money is reported

| ID | Requirement | Status |
|---|---|---|
| CAT-2.1 | A budget stream's type shall follow from its category's type: Income, Expense, or Savings for a Transfer category. Budget stream forms shall only offer active categories of the matching type; Uncategorized can't have streams. See BUD-1.1 and BUD-1.3. | Implemented |
| CAT-2.2 | Spending shall count categories of Income groups as income, ignore categories of Transfer groups, and count categories of Expense groups as expenses. Uncategorized amounts shall count by sign: money in as income, money out as expenses. See CASH-1.3. | Implemented |
| CAT-2.3 | Budget and Spending shall show how expenses split between **Essential**, **Discretionary** and **Unclassified** (BUD-1.7, CASH-1.8). Unclassified is expense categories with no necessity, and on Spending also Uncategorized money out (CASH-1.3). It shows only when it has an amount. | Implemented |

## CAT-3 The user can say which spending is essential

| ID | Requirement | Status |
|---|---|---|
| CAT-3.1 | An Expense category can have a necessity: **Essential** (spending needed to live and work, such as housing, utilities, groceries and insurance) or **Discretionary** (spending that could be cut, such as restaurants, entertainment and travel). It's optional; without one the category is Unclassified (CAT-2.3). Income and Transfer categories have no necessity. | Implemented |
| CAT-3.2 | The category dialogs shall show a **Necessity** field only while an Expense group is selected, offering **Not set** (the default for a new category), **Essential** and **Discretionary**, with the hint "Essential: needed to live and work. Discretionary: could be cut." | Implemented |
| CAT-3.3 | The Categories screen shall show an expense category's necessity in its row ("Essential" or "Discretionary"), and nothing when it has none. | Implemented |
| CAT-3.4 | The server shall refuse a necessity on an Income or Transfer category: "Only expense categories can have a necessity." An Expense category may have none. | Implemented |

## CAT-4 The user can retire categories they no longer use

A category the user has stopped using can be made **inactive**, which keeps it on past transactions, or **deleted**, which moves its transactions to another category.

| ID | Requirement | Status |
|---|---|---|
| CAT-4.1 | An inactive category shall not be offered when adding or editing a transaction or a budget stream. | Implemented |
| CAT-4.2 | A transaction or budget stream that already has an inactive category shall keep it, and its edit form shall show it as the current value. | Implemented |
| CAT-4.3 | An inactive category shall still appear on the Categories screen (CAT-1.4), in the Transactions filters, in Spending and in exports, and shall still be matched by transaction import (TXN-3.4). | Implemented |
| CAT-4.4 | The user can delete a category from its edit dialog. The confirmation shall say how many transactions use it and ask which category they should move to: **Uncategorized** (the default) or any other active category. Confirming shall move the transactions and delete the category together, or do neither. | Planned |
| CAT-4.5 | A category used by a budget stream shall not be deleted: "This category is used in a budget stream, which must be deleted or assigned to a different category first." | Implemented |

## CAT-5 Transactions without a category are Uncategorized

| ID | Requirement | Status |
|---|---|---|
| CAT-5.1 | There shall always be exactly one built-in category, **Uncategorized** (icon ❓), in no group. It shall exist as soon as the database is created, before anyone registers. | Planned |
| CAT-5.2 | Every transaction shall have a category. A transaction saved without one, an imported row with a blank category (TXN-3.4), and a transaction whose category is deleted (CAT-4.4) get Uncategorized. | Planned |
| CAT-5.3 | Uncategorized can't be renamed, moved to a group, made inactive or deleted. The user can change its icon. | Planned |
| CAT-5.4 | The Categories screen shall show Uncategorized above the three sections, with its icon, name, an edit button (icon only), and the explanation "Transactions stay here until you or a rule gives them a category." | Planned |
| CAT-5.5 | A new, imported or synced transaction with no category that neither learning (CAT-9) nor a rule (CAT-8) categorizes shall get Uncategorized. | Planned |

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
| CAT-7.1 | **Download Categories** (Categories screen menu) shall produce a CSV named `Categories_<timestamp>.csv` with the header `Type,Group,Name,Icon,Necessity,IsActive`, one row per category, ordered by type, group and name, so the file re-imports unchanged. Type is `Income`, `Expense` or `Transfer`; Necessity is `Essential`, `Discretionary` or blank (always blank outside Expense). Uncategorized and groups with no categories are not included. | Planned |
| CAT-7.2 | **Import Categories** (Categories screen menu) shall accept a CSV with the columns from CAT-7.1, validate it without saving first, and let the user confirm only when the dry run found no errors, as transaction import does (TXN-3.2, TXN-3.3, TXN-3.7). It shall be all-or-nothing (TXN-3.9). | Planned |
| CAT-7.3 | Import shall only add. A row whose category name already exists (ignoring case, Uncategorized included) shall be skipped, not changed. The dry run shall report "Categories to create: N" and "Already exist (skipped): M". | Planned |
| CAT-7.4 | A row's group shall be found by name, ignoring case. A group that doesn't exist shall be created with the row's type. A row whose group exists with a different type is an error ("Row 5: Group 'Food' is an Expense group, not Income."). | Planned |
| CAT-7.5 | Each row shall be checked, with every problem in a row reported in one message: **Type** is required and one of the three types (any case); **Group** and **Name** are required, at most 100 characters; **Icon** is required, at most 50 characters; **Necessity** is blank or one of the two values (any case) on Expense rows, and must be blank on others; **IsActive** is true, false (any case) or blank (true). A second row with the same name as an earlier row is an error. | Planned |

## CAT-8 Transactions can be categorized automatically

| ID | Requirement | Status |
|---|---|---|
| CAT-8.1 | The user can define rules that give a transaction a category from its details. A rule has a name (required, at most 100 characters), the category it sets (an active category), and one or more criteria from: **Original Statement** (*contains* or *is exactly* a term), **Merchant** (*contains* or *is exactly* a term) and **Amount** (*greater than*, *less than* or *equal to* an amount, entered as a positive number beside a **Money out** / **Money in** switch as in TXN-2.13). | Planned |
| CAT-8.2 | A rule shall match a transaction, in any account, only when every criterion it has matches. Text criteria ignore case. An Amount criterion matches only transactions in its direction, then compares their size, so "Money out, greater than 100" matches a $150 purchase but not a $150 deposit. | Planned |
| CAT-8.3 | The Rules screen shall list the rules in order, showing each one's criteria and category, with add, edit, delete (after confirming) and reorder. When several rules match, the first in the list wins. | Planned |
| CAT-8.4 | Rules shall be applied to a transaction that's added without a chosen category, imported with a blank category (TXN-3.4), or synced (INST-2). They never replace a category the user chose or that the import file gave. | Planned |
| CAT-8.5 | Saving a rule shall offer to apply it to the existing Uncategorized transactions it matches, saying how many ("Apply to 12 uncategorized transactions"). | Planned |
| CAT-8.6 | View Transaction shall say how an automatic category was set: "Categorized by rule *rule name*" or "Categorized by learning" (CAT-9). The note goes away once the user changes the category. | Planned |
| CAT-8.7 | Rules and learning shall categorize only transactions that aren't split (TXN-4). | Planned |

## CAT-9 The app can learn categories from the user's own transactions

| ID | Requirement | Status |
|---|---|---|
| CAT-9.1 | The Rules screen shall have a **Learn from my transactions** switch, off by default. | Planned |
| CAT-9.2 | While it's on, a transaction that CAT-8.4 would categorize shall first get the category the user most often gave transactions with the same merchant (ignoring case), or, if the merchant is blank, the same original statement. It's used only when at least 3 such transactions were categorized by the user (not by rules or learning) and at least 80% of them have that category. | Planned |
| CAT-9.3 | Rules run after learning, and a matching rule replaces the learned category, so the user's own rules always win. | Planned |
| CAT-9.4 | Learning shall run inside the app on the instance's own data; no transaction data is sent anywhere. | Planned |

## Known gaps

- **No automatic categorization (CAT-8, CAT-9).** Every transaction's category is chosen by hand or given in the import file.
- **No category delete in the UI (CAT-1.10, CAT-4.4).** Groups can be deleted (CAT-1.15), categories can't. The API can delete a category, which leaves its transactions with no category (it refuses when a budget stream uses it, CAT-4.5). Those transactions count as expenses in Spending but disappear from the Transactions list (TXN-1.11). The API already refuses to delete a group that has categories.
- **Uncategorized doesn't exist yet (CAT-5)**, so the Categories screen starts with the Income section (CAT-1.3, CAT-5.4). A transaction can have no category; Spending labels those *Uncategorized* and counts them by sign (CASH-1.3). An instance that already has its own category named "Uncategorized" (the author's does) needs it merged into the built-in one when CAT-5 is built: its transactions move over and it's deleted. Transactions with no category move to it too.
- **New users start empty (CAT-6).** The user must build the whole tree before they can add or import a transaction.

## Notes

- The defaults (CAT-6.2) would be simplest to ship as a CSV in the CAT-7.1 format, loaded through the category import, so the list and the format can't drift apart.
- Type is looked up through the category's group whenever Budget or Spending runs, which is why moving a category (CAT-1.16) needs no change to its transactions.
