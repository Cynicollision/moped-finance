# Application Shell (`APP`)

Behavior that applies across the whole app: layout, navigation, feedback to the user, environments, and the branding. Cross-cutting quality requirements also live here for now (see the [README](README.md)).

## APP-1 The user can move around the app

| ID | Requirement | Status |
|---|---|---|
| APP-1.1 | Once signed in, the app shall show a side navigation with these entries, in this order: **Accounts**, **Transactions**, **Cashflow**, **Budget**, **Categories**, **Institutions**. The current section shall be highlighted. | Implemented |
| APP-1.2 | The side navigation shall be permanently visible on desktop-width screens. On handset-width screens it shall be hidden behind a menu button, open over the content, and close when an entry is chosen. | Implemented |
| APP-1.3 | On handset-width screens the label of the current top-level section shall appear next to the menu button. | Implemented |
| APP-1.4 | The bottom of the side navigation shall show a profile control with the user's initials and display name. Initials are the first letters of the first two words of the display name, or the first letter if there is only one word. | Implemented |
| APP-1.5 | The profile control shall open a menu with **Settings** and **Sign out** (see AUTH-4.1). | Partial |
| APP-1.6 | The landing page after sign-in, and the target of any unknown URL, shall be the Accounts summary (DASH). | Implemented |
| APP-1.7 | Signed-out visitors shall see no navigation or profile control, only the Login or Register screen. | Implemented |
| APP-1.8 | Screens below a top-level section (Account Details, Edit Account, Add Account, Import screens, View/Edit Transaction, Add/View/Edit Institution) shall show a breadcrumb trail above the content, and every crumb except the last shall be a link back. Top-level sections have none. | Implemented |
| APP-1.9 | The browser tab title shall name the current screen (for example "Dashboard", "Transactions", "Account Details", "Edit Institution"). | Implemented |
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

## Observations

- **Operational gaps before deployment.** The server has no health endpoint, doesn't shut down gracefully on `SIGTERM`, doesn't handle Postgres connection errors on idle clients, and accepts CSV uploads of any size. None of this is visible in normal use; `TODO.md` lists each under Server hardening. Promote to `APP` requirements if you want them tracked by ID.
- **Login and Register show no product name.** The side navigation header and browser tab say "Moped Finance" (APP-3.1), but the Login and Register screens have no product name at all.
- **Settings is a dead link** (APP-1.5). See the AUTH observations.
- **Demo mode is a shell.** Every request other than auth returns an empty list, so the finance screens render empty (APP-4.3).
- **Debug date leaks into behavior.** In development builds the *client* uses 2026-05-17 as today, while the *server* uses the real date for anything it computes on its own (for example a cashflow request with no as-of date). That's fine while the client always sends an as-of date, but it is a difference to keep in mind.
- **Success feedback is sparse.** Only imports announce success. Creating, saving and deleting records just navigate or refresh.
- **Sync UI.** A disabled "Connect via (Coming Soon)" button appears when adding an account (see INST-2 and ACCT-4). The label has a gap where the institution's name was probably meant to go.
- **Tab title flashes the app name.** On a full page load the tab reads "Moped Finance" until the screen finishes loading, then switches to the screen title alone (APP-1.9).
- **Breadcrumb roots aren't always right.** Import Transactions shows "Accounts / Import Transactions" even when it was opened from the Transactions menu, and its "Accounts" crumb isn't a link, unlike the other screens' trails.
- **Loading overlay confirmed.** Every navigation and every timeframe/filter change dims the screen behind a spinner (APP-2.1). Combined with the blurred backdrop it briefly shows a blank/zero state (for example an empty Budget or a $0.00 net worth) before data arrives, which can look like real data.
- **Layout at ~800 px.** With the side navigation visible in a window about 800 px wide, Budget and Categories scroll horizontally and the Budget row menu sits off-screen to the right. Worth a look at the breakpoint (APP-1.2, APP-2.5).
