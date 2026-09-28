# Application Shell (`APP`)

Behavior that applies across the whole app: layout, navigation, feedback to the user, environments, and the branding. Cross-cutting quality requirements also live here for now (see the [README](README.md)).

## APP-1 The user can move around the app

| ID | Requirement | Status |
|---|---|---|
| APP-1.1 | Once signed in, the app shall show a navigation with these entries, in this order: **Dashboard** (`/dashboard`, DASH), **Transactions**, **Cashflow** and **Budget**. The current section shall be highlighted, including on the screens below it (Account Details and its screens are below Dashboard). Settings is reached from the profile menu (APP-1.5), not the navigation. | Implemented |
| APP-1.2 | The navigation shall follow the window width: below 600px a bar along the bottom of the screen, 600px to 839px a rail down the left side with each entry's icon above its label, and from 840px a side navigation headed by the product name. It is always visible. | Implemented |
| APP-1.3 | Every screen shall start with a header holding its title and, at the end of the row, its actions: a primary button and/or a menu. The title shall be in the same place and style on every screen, whether or not the screen has actions. Where the page area is narrower than 600px, a primary button shows only its icon. | Implemented |
| APP-1.4 | The profile control shall show the user's initials and, in the side navigation, their display name. Initials are the first letters of the first two words of the display name, or the first letter if there is only one word. It sits at the bottom of the side navigation or rail, and on phones at the end of every screen's header, since the bottom bar has no room for it. | Implemented |
| APP-1.5 | The profile control shall open a menu with **Institutions** (INST-1) and **Categories** (CAT-1), shortcuts to those Settings pages, then **Settings** (SET-1.1), then, after a divider, **Sign out** (AUTH-4.1). | Implemented |
| APP-1.6 | The landing page after sign-in, and the target of any unknown URL, shall be the Dashboard (DASH). | Implemented |
| APP-1.7 | Signed-out visitors shall see no navigation or profile control, only the Login or Register screen. | Implemented |
| APP-1.8 | A screen below another (Account Details, Edit Account, Add Account, the import screens, View/Add/Edit Transaction, Settings' pages) shall show, above its title, a trail of links to the screens it sits below, for example "Dashboard / *account name*" on Edit Account. Where the page area is narrower than 600px, the trail is replaced by a back arrow to the last of them. Import Transactions sits below the account it was opened from, or below Transactions when opened from there. Top-level screens have no trail. | Implemented |
| APP-1.9 | The browser tab title shall be the current screen's name, then the product name: "Dashboard · Moped Finance", "Edit Account · Moped Finance". Until the first screen loads it is "Moped Finance". | Implemented |
| APP-1.10 | The profile menu's **Sign out** entry shall be shown in a warning (red) color. | Implemented |

## APP-2 The user gets feedback on what the app is doing

| ID | Requirement | Status |
|---|---|---|
| APP-2.1 | There shall be no full-screen loading overlay. While a screen loads what it shows for the first time, it shall show grey placeholder shapes where the content will go, never zeros or an empty state that could pass for real data. When it reloads data already on screen (a new timeframe, period, filter or sort, or after a change), it shall keep that data on screen and show a thin progress bar under the page header until the new data arrives. While an action runs, its button shall be disabled and show a small spinner: Save and Create in forms and dialogs, **Validate Import** and **Begin Import**, **Load More**, **Login** and **Register**. | Implemented |
| APP-2.2 | When an action fails (a save, delete, import or sign-in), the app shall show an error message for 5 seconds, placed as in APP-2.8, with a **Close** button. For client errors it shall use the server's message; if the server can't be reached it shall say "Network or server error encountered." | Implemented |
| APP-2.3 | After a successful bulk import (balances or transactions) the app shall show a success notification with the number of records created. | Implemented |
| APP-2.4 | A record is deleted from the ⋮ menu of the screen showing it (**Delete Account** on Account Details, **Delete** on Transaction Details and a budget stream's row), or with a **Delete** button at the bottom left of its dialog (institution, category group, budget stream), shown in the error (red) color. Deleting shall first ask for confirmation in a dialog that names the action and can be cancelled, whose confirm button (Delete, Revoke) is also red. There are no separate "Danger Zone" sections. | Implemented |
| APP-2.5 | Screens shall adapt to the width available to them, for example by hiding secondary table columns and showing that detail under the primary column, and shall not scroll sideways at any window width. | Implemented |
| APP-2.6 | Records with few fields (institution, category, category group, budget stream) are added and edited in a dialog; records with many fields or their own address (account, transaction) and the imports are full pages. A form dialog shall fill the screen on phones, with its buttons in a bar at the bottom, and be up to 560px wide on larger screens. Its **Cancel** and main action (**Save**) sit at the bottom right, and **Delete**, when offered, at the bottom left. Esc, a click outside the dialog and its close button close it like **Cancel**. Confirmations stay small on every screen. | Implemented |
| APP-2.7 | Leaving a form with unsaved changes shall first ask "Discard changes?" ("Your changes haven't been saved.", **Keep editing** / **Discard**): closing a dialog in any way but saving, and leaving a full-page form (Add or Edit Account, Add or Edit Transaction) by **Cancel**, a link or the navigation. A form with no changes, or one just saved, closes or leaves without asking. | Implemented |
| APP-2.8 | Creating, saving or deleting a record shall be confirmed with a short message naming it, such as "Account added", "Transaction saved", "Group deleted" or "Token revoked", shown for 4 seconds at the bottom of the screen: centred on phones, above the bottom navigation, and at the bottom right on larger screens. Messages have no Undo. | Implemented |
| APP-2.9 | When a screen can't load what it shows, it shall say so in place of that content ("Couldn't load this", with the reason, such as "Network or server error encountered." or the server's message) with a **Retry** button that loads it again, rather than a passing notification over an empty screen. Where only part of a screen failed, such as the Dashboard's chart, only that part is replaced. | Implemented |

## APP-3 The app is identifiable as Moped Finance

| ID | Requirement | Status |
|---|---|---|
| APP-3.1 | The product name shown to the user (side navigation header, browser tab title, Login and Register screens) shall be **Moped Finance**. | Implemented |

## APP-4 Developers and demo audiences can run the app in other modes

| ID | Requirement | Status |
|---|---|---|
| APP-4.1 | **Debug mode** (development builds): the app shall treat "today" as a fixed date (2026-05-17) so date-based screens show stable data, and shall show a badge with that date as `YYYYMMDD`: beside the product name in the side navigation, or as an icon (the date on hover) at the top of the rail or in the page header on phones. | Implemented |
| APP-4.2 | **Demo mode** (demo build): the app shall run entirely in the browser with no backend, shall show a "Demo Mode" badge where APP-4.1 shows the debug badge, and shall let any Login or Register submission succeed as a fixed "Demo User", remembering signed-in state in browser storage across reloads. | Partial |
| APP-4.3 | In demo mode, finance screens shall be populated with realistic sample data and support the same create/edit/delete flows as the real app. | Planned |

## APP-5 The server runs unattended and fails safely

Cross-cutting requirements for a self-hosted box that restarts and updates without anyone watching.

| ID | Requirement | Status |
|---|---|---|
| APP-5.1 | The server shall keep running when the database restarts or drops connections, including when it can't write its own log entries, and shall serve requests again once the database is back. | Implemented |
| APP-5.2 | On `SIGTERM` or `SIGINT` the server shall stop accepting connections, let in-flight requests finish (for up to 25 seconds), then close its database connections and exit. | Implemented |
| APP-5.3 | `GET /health`, without signing in, shall return 200 `{"status":"ok"}` when the database is reachable, and 503 when it isn't (`database-unavailable`) or the server is shutting down (`shutting-down`). The production compose file uses it as the API container's health check. | Implemented |
| APP-5.4 | Uploads shall be limited to one file of at most 5 MB. A larger file shall be refused with 400 "File is too large (maximum 5 MB)." | Implemented |
| APP-5.5 | Error responses shall never contain database or internal error text. A request that refers to a record that doesn't exist, or deletes one that other records still need, shall get a 400 with a message naming it (for example "Category group not found." or "Cannot delete a category group that still has categories."). Malformed JSON shall get a 400. Anything else unexpected is a 500 "An unexpected error occurred". | Implemented |
| APP-5.6 | The server shall work out "today" and calendar-period boundaries in the time zone set by `TZ` (UTC if unset). | Implemented |
| APP-5.7 | The server shall check every request's route parameters, query string and body before acting on it, and refuse an invalid one with a 400 naming each bad field (for example "Invalid Transaction request body: amount: Too big…"). Unknown filter or sort keys, dates not written as a real YYYY-MM-DD date (a timestamp included), and amounts beyond 9,999,999,999.99 are refused rather than ignored or passed to the database. An update may send only the fields it changes; the rest keep their values. | Implemented |
| APP-5.8 | On startup, before accepting requests, the server shall bring the database schema up to date by applying any migrations it hasn't applied yet, creating every table on an empty database. Pending migrations shall apply all together or not at all; if they fail, or the database can't be reached, the server shall log the reason and exit with a non-zero status, leaving the database unchanged. | Implemented |
| APP-5.9 | Every response shall carry browser security headers: a Content-Security-Policy that runs scripts only from the app itself, and protection against framing, content-type sniffing and referrer leaks. Headers that need HTTPS (HSTS, `upgrade-insecure-requests`) shall be sent only when the app is served over HTTPS (`USE_HTTPS`), so it keeps working over plain HTTP. | Implemented |

## APP-6 Amounts read the same way everywhere

| ID | Requirement | Status |
|---|---|---|
| APP-6.1 | Red shall mean unfavourable: a value that's bad for the user, such as debt growing (DASH-1.3), negative savings (CASH-1.4) or spending over budget (CASH-1.10). A negative amount that's expected, such as a purchase, shall not be red. | Implemented |
| APP-6.2 | Transaction amounts (the Transactions list, View Transaction, Account Details' recent transactions) shall show money in with a "+" before the "$", in green, and money out with no sign, in the ordinary text color. | Implemented |
| APP-6.3 | Amounts shall be stored signed: money out and liability balances are negative. Forms shall not ask the user for a sign: transaction amounts use a Money out / Money in switch (TXN-2.13), and a liability's balance fields (starting balance, Update Balance, ACCT-2.2) ask for **Amount owed** as a positive number and store it negative. Budget amounts are positive, with direction from the category (BUD notes). CSV files keep signed amounts (TXN-3.10, ACCT-3.10). | Planned |

## APP-7 Lists work at any width

| ID | Requirement | Status |
|---|---|---|
| APP-7.1 | Lists of records (Transactions, Account Details' recent transactions, Budget, Cashflow) shall show columns under headings when the page area is at least 840px wide. Narrower, each row shall show its main text and its amount on the first line, with details in smaller text on a second line, and leave out the rest. A list shall never scroll sideways. | Implemented |
| APP-7.2 | A sortable list shall sort by its column headings when wide, with an arrow on the current one, and by a sort menu above the list when narrow. Choosing a new column sorts it in its natural direction; choosing the current one reverses it. | Implemented |

## Known gaps

- **Forms take signed amounts (APP-6.3).** Money out and liability balances must be typed as negative numbers.
- **Demo mode is a shell (APP-4.3).** Every request other than auth returns an empty list, so the finance screens render empty.

## Notes

- **Debug date and the server.** In development builds the client uses 2026-05-17 as today, while the server uses the real date for anything it computes on its own (for example a cashflow request with no as-of date). That's fine while the client always sends an as-of date.
