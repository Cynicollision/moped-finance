# Application Shell (`APP`)

Behavior that applies across the whole app: layout, navigation, feedback to the user, environments, and the branding. Cross-cutting quality requirements also live here for now (see the [README](README.md)).

## APP-1 The user can move around the app

| ID | Requirement | Status |
|---|---|---|
| APP-1.1 | Once signed in, the app shall show a side navigation with these entries, in this order: **Summary** (`/summary`, DASH), **Transactions**, **Cashflow**, **Budget**, **Categories**, **Accounts** (`/accounts`, the institutions and their accounts, INST-1). The current section shall be highlighted. | Partial |
| APP-1.2 | The side navigation shall be permanently visible on desktop-width screens. On handset-width screens it shall be hidden behind a menu button, open over the content, and close when an entry is chosen. | Implemented |
| APP-1.3 | On handset-width screens the label of the current top-level section shall appear next to the menu button. | Implemented |
| APP-1.4 | The bottom of the side navigation shall show a profile control with the user's initials and display name. Initials are the first letters of the first two words of the display name, or the first letter if there is only one word. | Implemented |
| APP-1.5 | The profile control shall open a menu with **Settings** and **Sign out** (see AUTH-4.1). | Partial |
| APP-1.6 | The landing page after sign-in, and the target of any unknown URL, shall be the Summary (DASH). | Implemented |
| APP-1.7 | Signed-out visitors shall see no navigation or profile control, only the Login or Register screen. | Implemented |
| APP-1.8 | Screens below a top-level section (Account Details, Edit Account, Add Account, Import screens, View/Edit Transaction, Add/View/Edit Institution) shall show a breadcrumb trail above the content, and every crumb except the last shall be a link back. Top-level sections have none. | Implemented |
| APP-1.9 | The browser tab title shall name the current screen (for example "Summary", "Transactions", "Account Details", "Edit Institution"). | Partial |
| APP-1.10 | The profile menu's **Sign out** entry shall be shown in a warning (red) color. | Implemented |

## APP-2 The user gets feedback on what the app is doing

| ID | Requirement | Status |
|---|---|---|
| APP-2.1 | While any request to the server is in flight, the app shall show a loading overlay. | Implemented |
| APP-2.2 | When a request fails, the app shall show an error message in a dismissible notification for 5 seconds. For client errors it shall use the server's message; if the server can't be reached it shall say "Network or server error encountered." | Implemented |
| APP-2.3 | After a successful bulk import (balances or transactions) the app shall show a success notification with the number of records created. | Implemented |
| APP-2.4 | Deleting an account, institution, transaction or budget stream shall first ask for confirmation in a dialog that names the action and can be cancelled. | Implemented |
| APP-2.5 | Screens shall adapt to handset-width viewports, for example by hiding secondary table columns and showing that detail under the primary column. | Implemented |

## APP-3 The app is identifiable as Moped Finance

| ID | Requirement | Status |
|---|---|---|
| APP-3.1 | The product name shown to the user (side navigation header, browser tab title) shall be **Moped Finance**. | Implemented |

## APP-4 Developers and demo audiences can run the app in other modes

| ID | Requirement | Status |
|---|---|---|
| APP-4.1 | **Debug mode** (development builds): the app shall treat "today" as a fixed date (2026-05-17) so date-based screens show stable data, and shall show a badge in the side navigation with that date as `YYYYMMDD`. | Implemented |
| APP-4.2 | **Demo mode** (demo build): the app shall run entirely in the browser with no backend, shall show a "Demo Mode" badge in the side navigation, and shall let any Login or Register submission succeed as a fixed "Demo User", remembering signed-in state in browser storage across reloads. | Partial |
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
| APP-5.7 | The server shall check every request's route parameters, query string and body before acting on it, and refuse an invalid one with a 400 naming each bad field (for example "Invalid Transaction request body: amount: Too big…"). Unknown filter or sort keys, unparseable dates, and amounts beyond 9,999,999,999.99 are refused rather than ignored or passed to the database. An update may send only the fields it changes; the rest keep their values. | Implemented |
| APP-5.8 | On startup, before accepting requests, the server shall bring the database schema up to date by applying any migrations it hasn't applied yet, creating every table on an empty database. Pending migrations shall apply all together or not at all; if they fail, or the database can't be reached, the server shall log the reason and exit with a non-zero status, leaving the database unchanged. | Implemented |

## Known gaps

- **Old navigation names (APP-1.1, APP-1.9).** The navigation says **Accounts** for the summary and **Institutions** for the institutions list, the institutions route is `/institutions`, and the summary's tab title is "Dashboard".
- **Settings is a dead link** (APP-1.5). See the AUTH known gaps.
- **Demo mode is a shell (APP-4.3).** Every request other than auth returns an empty list, so the finance screens render empty.
- **Login and Register show no product name.** The side navigation header and browser tab say "Moped Finance" (APP-3.1), but the Login and Register screens have no product name at all.
- **Success feedback is sparse.** Only imports announce success. Creating, saving and deleting records just navigate or refresh.
- **The loading overlay shows fake zeros (APP-2.1).** Every navigation and every timeframe or filter change dims the screen behind a spinner, and the blurred backdrop briefly shows an empty or zero state (an empty Budget, a $0.00 net worth) that looks like real data.
- **Layout at ~800 px.** With the side navigation visible in a window about 800 px wide, Budget and Categories scroll horizontally and the Budget row menu sits off-screen to the right (APP-1.2, APP-2.5).
- **Breadcrumb roots aren't always right.** Import Transactions shows "Accounts / Import Transactions" even when it was opened from the Transactions menu, and its "Accounts" crumb isn't a link, unlike the other screens' trails.
- **Tab title flashes the app name.** On a full page load the tab reads "Moped Finance" until the screen finishes loading, then switches to the screen title alone (APP-1.9).

## Notes

- **Debug date and the server.** In development builds the client uses 2026-05-17 as today, while the server uses the real date for anything it computes on its own (for example a cashflow request with no as-of date). That's fine while the client always sends an as-of date.
