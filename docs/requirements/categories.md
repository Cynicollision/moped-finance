# Categories and Category Groups (`CAT`)

Transactions and budget streams are classified with **categories**. Categories are organized into **category groups**, and each group has a **type** (Income, Expense or Transfer) that decides how its categories count in Budget and Spending. An Expense category can also have a **necessity**, Essential or Discretionary, so the user can see how much of their spending they could cut. It's optional: expense categories without one are **Unclassified**. A transaction with no category is **Uncategorized**: a state rather than a category, so it has no group, type or necessity.

Screens, all pages of Settings: **Categories** (`/settings/categories`, also in the profile menu, APP-1.5), where creating and editing happen in dialogs, **Import Categories** (`/settings/categories/import`, CAT-7.2), and **Rules** (`/settings/rules`, CAT-8, listed in Settings and linked from the Categories menu).

## CAT-1 The user can organize categories into groups

| ID | Requirement | Status |
|---|---|---|
| CAT-1.1 | A category group shall have a name (required, at most 100 characters) and a type: **Income**, **Expense** or **Transfer**. The "Create Group" dialog labels the field **Type**, defaults it to Expense, and keeps **Save** disabled until a name is entered. | Implemented |
| CAT-1.2 | A category shall belong to exactly one group and have a name (required, at most 100 characters), an optional icon, an **Active** flag (default on), and, in an Expense group, an optional necessity (CAT-3). The icon is one emoji, chosen with the emoji picker (CAT-1.20); the server shall refuse anything else ("home", or two emoji) with a 400. A category without an icon is shown by its name alone. | Implemented |
| CAT-1.3 | The Categories screen shall show three sections, **Income**, **Expenses** and **Transfers**. Each lists the groups of that type, sorted by name, as cards headed by the group's name and an **Edit** link, containing the group's categories with their icon (if any), name and a pencil (edit) button, and ending with a **Create Category** button. Within a group, active categories come first, then inactive ones, each sorted by name. | Implemented |
| CAT-1.4 | An inactive category shall appear dimmed with a crossed-out eye icon. | Implemented |
| CAT-1.5 | A section with no groups shall say "No income groups found.", "No expense groups found." or "No transfer groups found." | Implemented |
| CAT-1.6 | The user can create a group from the screen's menu (**Create Group**), choosing its name and type (default Expense). | Implemented |
| CAT-1.7 | The user can rename a group from its card (**Edit**). | Implemented |
| CAT-1.8 | The user can create a category from the screen's menu (**Create Category**), or from a group's **Create Category** button, which pre-selects that group. If no group exists, the app shall refuse with "Please create a group first." | Implemented |
| CAT-1.9 | The user can edit a category's name, icon, group, Active flag and necessity from its row. | Implemented |
| CAT-1.10 | The user can delete a category (CAT-4.4) or an empty category group (CAT-1.15). | Implemented |
| CAT-1.11 | Groups of class **Transfer** shall be shown and manageable on the Categories screen. | Retired (merged into CAT-1.3) |
| CAT-1.12 | Category group names shall be unique, ignoring case. Saving a duplicate shall be rejected with "A category group with that name already exists." | Implemented |
| CAT-1.13 | Category names shall be unique across all groups, ignoring case, so CSV import (TXN-3.4) matches exactly one category. Saving a duplicate shall be rejected with "A category with that name already exists." No category can be named Uncategorized (CAT-5.3). | Implemented |
| CAT-1.14 | A group's type is chosen when the group is created, and can only be changed while the group has no categories, since it decides how they count. For a group with categories, the Edit Group dialog shall show the type read-only, and the server shall refuse a change: "A category group's type can't be changed while it has categories." A group of the wrong type is fixed by moving its categories into a group of the right type (CAT-1.16). | Implemented |
| CAT-1.15 | The user can delete a group with the **Delete** button of its **Edit** dialog (APP-2.4), after confirming, when it has no categories. For a group that still has categories, Delete shall be disabled, with one note covering this and CAT-1.14: "To change the type or delete this group, first move or delete its N categories." ("1 category" for one). The server shall refuse: "Cannot delete a category group that still has categories." | Implemented |
| CAT-1.16 | The user can move a category to any group, including a group of another type. Its transactions then count under the new type everywhere, past periods included; the transactions themselves don't change. | Implemented |
| CAT-1.17 | Moving a category into an Expense group from another type shall offer its necessity in the same dialog (CAT-3.2). Moving it out of Expense shall clear its necessity, in the dialog and on the server. | Implemented |
| CAT-1.18 | Moving a category used by a budget stream to a group of another type shall move its streams with it: they take the new type (BUD-1.1) and show in that section of the Budget screen. | Implemented |
| CAT-1.19 | The group picker in the category dialogs shall list groups by type (Income, Expense, Transfer), then by name, each shown as "*group name* (*Type*)", for example "Housing (Expense)". | Implemented |
| CAT-1.20 | The category dialogs shall choose the icon with an emoji picker, opened from the **Icon** field (in a popover beside the field on wider screens, in a bottom sheet on phones): the standard emoji set except flags (which Chrome and Edge on Windows can't display), grouped as on a phone keyboard, with a search box that has focus when it opens, usable from the keyboard alone, and colored to match the app. The field can also remove the icon. | Implemented |

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
| CAT-4.4 | The user can delete a category with the **Delete** button of its edit dialog (APP-2.4). When transactions use it (hidden ones included, and each part of a split transaction that does, TXN-4), the confirmation shall say how many ("12 transactions use 🏠 Rent. Choose a category to move them to.") and offer **Move transactions to**: **Uncategorized** (the default) or any other active category, under its group as in CAT-1.19. When none do, it shall just ask "Delete 🏠 Rent? No transactions use it." Confirming shall move the transactions and delete the category together, or do neither, and then says "Category deleted". | Implemented |
| CAT-4.5 | A category used by a budget stream shall not be deleted. Its edit dialog's **Delete** shall be disabled, with the note "To delete this category, first delete its N budget streams or assign them to another category." ("its 1 budget stream or assign it" for one), and the server shall refuse: "This category is used in a budget stream, which must be deleted or assigned to a different category first." | Implemented |

## CAT-5 Transactions without a category are Uncategorized

| ID | Requirement | Status |
|---|---|---|
| CAT-5.1 | A transaction with no category is **Uncategorized**. It's a state, not a category: it has no group, type or necessity, can't have budget streams, and isn't listed on the Categories screen. Spending counts it by sign (CASH-1.3). | Implemented |
| CAT-5.2 | A transaction saved without a category, an imported row whose category is blank, "Uncategorized" or not one of the user's categories (TXN-3.4), and a transaction whose category is deleted (CAT-4.4) are Uncategorized. | Implemented |
| CAT-5.3 | No category can be named Uncategorized (ignoring case and surrounding spaces). Creating or renaming one shall be refused with "Uncategorized is reserved for transactions without a category." | Implemented |
| CAT-5.4 | Wherever a transaction's category is shown (the Transactions list, a transaction's details, Spending), an uncategorized one shall read "Uncategorized". The Transactions Category filter and the transaction form's Category field shall offer Uncategorized as a choice (TXN-1.11, TXN-2.7). | Implemented |
| CAT-5.5 | A new, imported or synced transaction with no category that neither learning (CAT-9) nor a rule (CAT-8) categorizes shall be Uncategorized. | Planned |
| CAT-5.6 | An instance that has a category named Uncategorized from before CAT-5 shall have it converted on upgrade: its transactions become Uncategorized and it's deleted, unless a budget stream uses it. | Implemented |

## CAT-6 A new instance starts with a useful set of categories

| ID | Requirement | Status |
|---|---|---|
| CAT-6.1 | The Register screen shall ask how to start: **Start with default categories** (selected) or **Start empty**. See AUTH-2.9. | Planned |
| CAT-6.2 | **Start with default categories** shall create the groups and categories listed below when registration completes. **Start empty** shall create none. | Planned |

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
| CAT-7.1 | **Download Categories** (Categories screen menu) shall produce a CSV named `Categories_<timestamp>.csv` with the header `Type,Group,Name,Icon,Necessity,IsActive`, one row per category, ordered by type (Income, Expense, Transfer), then group and name ignoring case, so the file re-imports unchanged. Type is `Income`, `Expense` or `Transfer`; Necessity is `Essential`, `Discretionary` or blank (always blank outside Expense). Groups with no categories are not included, and with no categories the file is the header only. | Implemented |
| CAT-7.2 | **Import Categories** (Categories screen menu) shall open a screen below Settings and Categories that lists the columns from CAT-7.1, accepts a CSV with all of them, validates it without saving first, and lets the user confirm only when the dry run found no errors, as transaction import does (TXN-3.2, TXN-3.3, TXN-3.7). It shall be all-or-nothing: the new groups and categories are saved in one database transaction (TXN-3.9). Confirming says "Successfully created N categories and M groups." ("and M groups" left out when there are none) and returns to Categories. The screen notes that import only adds (CAT-7.3) and creates missing groups (CAT-7.4). | Implemented |
| CAT-7.3 | Import shall only add. A row whose category name already exists (ignoring case) shall be skipped, not changed, and one named Uncategorized is an error (CAT-5.3). The dry run's confirm panel shall show "Groups to create: N", "Categories to create: N", "Already exist (skipped): M" and "Rows with errors: 0", then the new groups with their types ("New groups: Pets (Expense), Side Income (Income)") and the skipped names ("Skipped: Coffee, Groceries, Rent"), each list showing the first ten and "and N more". When every category already exists it shall say "Every category in the file already exists, so importing won't change anything." | Implemented |
| CAT-7.4 | A row's group shall be found by name, ignoring case. A group that doesn't exist shall be created with the row's type, spelled as the first row that names it, and only when at least one of its rows creates a category, so an import never leaves an empty group. A row whose group exists with a different type is an error ("Row 5: Group 'Food' is an Expense group, not Income."), as is a row giving a new group a different type from an earlier row ("Row 6: Group 'Pets' is an Expense group in row 2, not Income."). | Implemented |
| CAT-7.5 | Every row shall be checked, including rows that will be skipped, with every problem in a row reported in one message: **Type** is required and one of the three types (any case); **Group** and **Name** are required, at most 100 characters; **Icon** is blank or one emoji (CAT-1.2); **Necessity** is blank or one of the two values (any case) on Expense rows, and must be blank on others; **IsActive** is true, false (any case) or blank (true). A second row with the same name as an earlier row is an error ("Row 6: Name 'Coffee' is already in row 3."). | Implemented |

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
- **New users start empty (CAT-6).** The user builds every group and category by hand or imports them (CAT-7); until then, every transaction is Uncategorized.

## Notes

- The emoji picker is emoji-picker-element, which shows the device's own emoji (no images) and hides emoji the device can't display. Its data (`client/public/emoji/data.json`) is served by the app, which makes no third-party requests. It's generated from emoji-picker-element-data by `npm run emoji-data` in `client/`, which leaves out the Flags group: Chrome and Edge on Windows have no flag emoji and show each flag as two letters. The picker always shows a tab per group, so the field hides the empty Flags tab.
- The defaults (CAT-6.2) would be simplest to ship as a CSV in the CAT-7.1 format, loaded through the category import, so the list and the format can't drift apart.
- Type is looked up through the category's group whenever Budget or Spending runs, which is why moving a category (CAT-1.16) needs no change to its transactions.
