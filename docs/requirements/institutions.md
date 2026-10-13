# Institutions (`INST`)

An institution is where accounts live (a bank, a brokerage, a lender). Accounts always belong to one; Add Account asks which (ACCT-1.3).

An institution is **manual** or **connected**. A connected institution has a bank connection (INST-2); a manual one doesn't. A connected institution can hold both connected accounts and manual ones, for example an account the bank doesn't return. A manual institution holds only manual accounts.

Screens, all pages of Settings: **Institutions** (`/settings/institutions`, listing institutions and their accounts; also in the profile menu, APP-1.5), and the **Add Institution** and **Edit Institution** dialogs (APP-2.6). Accounts are added from here (ACCT-1.3).

## INST-1 The user can keep a list of their institutions

| ID | Requirement | Status |
|---|---|---|
| INST-1.1 | The Institutions screen shall list every institution as a card, sorted by name ignoring case, showing its name, its account count ("1 account", "3 accounts"), and each of its accounts, sorted by name, with the account's type and a **View** button linking to the account. Hidden and closed accounts are listed and counted, and marked as in ACCT-1.12. | Implemented |
| INST-1.2 | An institution with no accounts shall show "No accounts found for this institution." | Implemented |
| INST-1.3 | When the user has no institutions, the screen shall show "You haven't added any institutions yet." with an **Add your first institution** button. | Implemented |
| INST-1.4 | The user can add an institution in the **Add Institution** dialog (INST-1.3, INST-1.10) by giving it a name. The name is required and at most 100 characters, and **Save** stays disabled until one is entered. Saving closes the dialog, says "Institution added" and refreshes the Institutions screen. | Implemented |
| INST-1.5 | Clicking an institution's name, or **Edit** in its card menu (INST-1.7), shall open the **Edit Institution** dialog. | Implemented |
| INST-1.6 | The user can rename an institution in the Edit Institution dialog. Saving closes it and says "Institution saved". | Implemented |
| INST-1.7 | Each institution card's menu shall offer **Edit** and **Add account**, which opens Add Account with that institution selected (ACCT-1.3), plus the connection actions in INST-2. | Implemented |
| INST-1.8 | The user can delete an institution with the Edit Institution dialog's **Delete** button (APP-2.4), after confirming. Deleting closes the dialog and says "Institution deleted". | Implemented |
| INST-1.9 | An institution that still has accounts cannot be deleted. The dialog's **Delete** button shall be disabled, with the note "To delete this institution, first delete its N accounts." ("1 account" for one), and the server shall reject the request with the same rule. | Implemented |
| INST-1.10 | The Institutions screen's header shall have an **Add account** button (ACCT-1.3) and a menu with **Add Institution**, which opens the Add Institution dialog, in addition to the per-card menus and the empty-state button (INST-1.3). | Implemented |
| INST-1.11 | Institution names shall be unique, ignoring case. Saving a duplicate shall be rejected with "An institution with that name already exists." (Numbered INST-1.10 before 2026-09-26, which duplicated the ID above.) | Implemented |

## INST-2 The user can have institution data kept up to date automatically

| ID | Requirement | Status |
|---|---|---|
| INST-2.1 | The user can link an institution to their bank and have its accounts and transactions sync on a schedule and on demand, using a service that costs nothing for a single user and needs no inbound connections (polling only). | Planned |
| INST-2.2 | A manual institution's card menu shall offer **Connect**; a connected institution's shall offer **Sync now**, **Reconnect** and **Disconnect**. A connected institution's card shall show "Connected" and when it last synced. | Planned |
| INST-2.3 | Connecting or reconnecting shall list the accounts the bank returns. For each one the user chooses **Create new account**, **Link to** one of the institution's manual accounts, or **Skip**. Create new is the default. A linked account becomes connected and keeps its balance history and transactions; from then on sync adds to them (ACCT-4.2). | Planned |
| INST-2.4 | A bank account can be linked to at most one of the user's accounts, and an account to at most one bank account. | Planned |
| INST-2.5 | **Disconnect** shall, after confirming, remove the bank connection and make every connected account at the institution manual, keeping their balance history and transactions. | Planned |
| INST-2.6 | A skipped bank account shall be offered again the next time the user reconnects. | Planned |
| INST-2.7 | Deleting a connected institution (INST-1.8) shall also remove its bank connection. | Planned |
| INST-2.8 | When a bank account is linked to an existing manual account that already has transactions or balance entries (INST-2.3), the user shall choose how the two histories combine: **Combine** (the default), **Use the bank's history**, or **Keep my history only**. The choice applies to both transactions and balance entries. | Planned |
| INST-2.9 | **Combine** shall keep each side's entries on dates the other side doesn't cover, and on the overlapping dates (from the later of the two earliest dates to the earlier of the two latest) keep only the winning side's, which the user picks: **Bank** (the default) or **Mine**. | Planned |
| INST-2.10 | **Use the bank's history** shall delete the account's existing transactions and balance entries and keep everything the bank returns. **Keep my history only** shall keep the existing ones and ignore the bank's history, so sync only adds what's new from the moment of linking. | Planned |
| INST-2.11 | Before the user confirms, the link dialog shall say, per linked account, how many transactions and balance entries will be removed and added. Confirming applies every account's choice in one database transaction, or none. | Planned |
| INST-2.12 | After linking, each sync shall add only transactions it hasn't added before, so repeated syncs never duplicate them. | Planned |

INST-2.1 comes from the "Automated bank sync" item in `TODO.md`; the constraints are the ones written there. Everything the user sees or decides about sync is a requirement here (INST-2) or in ACCT-4. How it's built (provider choice, link flow, token storage, how "added before" is recognized for INST-2.12) goes in `docs/integrations/bank-sync.md`, written when the provider is chosen.

## Housekeeping

- **Sync endpoints are stubs.** `POST /institutions/:id/sync` and `POST /accounts/:id/sync` (`syncInstitution` in `institution-controller.ts`, `syncAccount` in `account-controller.ts`) report success without doing anything, and nothing in the UI calls them. Until INST-2 is built, return a not-implemented result, then replace the skipped `xit('should return sync stub success')` in `institution-routes.spec.ts`.
