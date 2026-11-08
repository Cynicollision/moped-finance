# Institutions (`INST`)

An institution is where accounts live (a bank, a brokerage, a lender). Accounts always belong to one; Add Account asks which (ACCT-1.3).

Institutions are how the user groups accounts, and nothing more: bank sync links accounts to bank accounts (SYNC-2), not institutions to banks, so an institution can hold connected and manual accounts alike. (Until 2026-11-07 an institution was manual or connected, with its own Connect, Sync now and Disconnect, INST-2.)

Screens, all pages of Settings: **Institutions and Accounts** (`/settings/institutions`, listing institutions and their accounts; called Institutions until 2026-10-15), and the **Add Institution** and **Edit Institution** dialogs (APP-2.6). Accounts are added from here (ACCT-1.3).

## INST-1 The user can keep a list of their institutions

| ID | Requirement | Status |
|---|---|---|
| INST-1.1 | The Institutions and Accounts screen shall list every institution as a card, sorted by name ignoring case, showing its name, its account count ("1 account", "3 accounts"), and each of its accounts, sorted by name, with the account's type and a **View** button linking to the account. Hidden and closed accounts are listed and counted, and marked as in ACCT-1.12. | Implemented |
| INST-1.2 | An institution with no accounts shall show "No accounts found for this institution." | Implemented |
| INST-1.3 | When the user has no institutions, the screen shall show "You haven't added any institutions yet." with an **Add your first institution** button. | Implemented |
| INST-1.4 | The user can add an institution in the **Add Institution** dialog (INST-1.3, INST-1.10) by giving it a name. The name is required and at most 100 characters, and **Save** stays disabled until one is entered. Saving closes the dialog, says "Institution added" and refreshes the Institutions and Accounts screen. | Implemented |
| INST-1.5 | Clicking an institution's name, or **Edit** in its card menu (INST-1.7), shall open the **Edit Institution** dialog. | Implemented |
| INST-1.6 | The user can rename an institution in the Edit Institution dialog. Saving closes it and says "Institution saved". | Implemented |
| INST-1.7 | Each institution card's menu shall offer **Edit** and **Add account**, which opens Add Account with that institution selected (ACCT-1.3). | Implemented |
| INST-1.8 | The user can delete an institution with the Edit Institution dialog's **Delete** button (APP-2.4), after confirming. Deleting closes the dialog and says "Institution deleted". | Implemented |
| INST-1.9 | An institution that still has accounts cannot be deleted. The dialog's **Delete** button shall be disabled, with the note "To delete this institution, first delete its N accounts." ("1 account" for one), and the server shall reject the request with the same rule. | Implemented |
| INST-1.10 | The Institutions and Accounts screen's header shall have a menu (⋮) with **Add Institution**, which opens the Add Institution dialog (INST-1.4), and **Add Account**, which opens Add Account (ACCT-1.3), in addition to the per-card menus (INST-1.7) and the empty-state button (INST-1.3). The header has no button of its own. | Implemented |
| INST-1.11 | Institution names shall be unique, ignoring case. Saving a duplicate shall be rejected with "An institution with that name already exists." (Numbered INST-1.10 before 2026-09-26, which duplicated the ID above.) | Implemented |
| INST-1.12 | A connected account (ACCT-4.3) shall be marked in its institution's card with a sync icon and "Synced". | Planned |

## INST-2 The user can have institution data kept up to date automatically

Retired 2026-11-07: bank sync is one SimpleFIN connection covering every bank, and links accounts to bank accounts rather than institutions to banks. Its requirements are now [SYNC](bank-sync.md) and ACCT-4.

| ID | Requirement | Status |
|---|---|---|
| INST-2.1 | The user can link an institution to their bank and have its accounts and transactions sync on a schedule and on demand. | Retired (SYNC-1, SYNC-3) |
| INST-2.2 | A manual institution's card menu shall offer **Connect**; a connected institution's shall offer **Sync now**, **Reconnect** and **Disconnect**. | Retired (one connection in Settings, SYNC-1; one Sync now, SYNC-3.3; INST-1.12 marks synced accounts) |
| INST-2.3 | Connecting or reconnecting shall list the accounts the bank returns, each to create, link or skip. | Retired (SYNC-2.1 to 2.4) |
| INST-2.4 | A bank account can be linked to at most one of the user's accounts, and an account to at most one bank account. | Retired (SYNC-2.5) |
| INST-2.5 | **Disconnect** shall make every connected account at the institution manual. | Retired (SYNC-1.4 for the whole connection, SYNC-2.7 per account) |
| INST-2.6 | A skipped bank account shall be offered again the next time the user reconnects. | Retired (Don't sync is remembered, SYNC-2.2) |
| INST-2.7 | Deleting a connected institution shall also remove its bank connection. | Retired (institutions have no connection) |
| INST-2.8 | Linking to an account with history shall offer **Combine**, **Use the bank's history** or **Keep my history only**. | Retired (a Sync transactions from date, SYNC-2.4; see SYNC Notes) |
| INST-2.9 | **Combine** shall keep each side's entries outside the overlap and the winning side's inside it. | Retired (as INST-2.8) |
| INST-2.10 | **Use the bank's history** and **Keep my history only**. | Retired (as INST-2.8) |
| INST-2.11 | The link dialog shall preview what each account's choice removes and adds. | Retired (as INST-2.8) |
| INST-2.12 | Each sync shall add only transactions it hasn't added before. | Retired (SYNC-4.1) |
