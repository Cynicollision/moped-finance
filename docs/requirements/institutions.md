# Institutions (`INST`)

An institution is where accounts live (a bank, a brokerage, a lender). Accounts always belong to one, so the user starts here when adding an account.

An institution is **manual** or **connected**. A connected institution has a bank connection (INST-2); a manual one doesn't. A connected institution can hold both connected accounts and manual ones, for example an account the bank doesn't return. A manual institution holds only manual accounts.

Screens: **Accounts** (`/accounts`, listing institutions and their accounts), **Add Institution**, **View Institution**, **Edit Institution**.

## INST-1 The user can keep a list of their institutions

| ID | Requirement | Status |
|---|---|---|
| INST-1.1 | The Accounts screen shall list every institution as a card, sorted by name ignoring case, showing its name, its account count ("1 account", "3 accounts"), and each of its accounts, sorted by name, with the account's type and a **View** button linking to the account. Hidden and closed accounts are listed and counted, and marked as in ACCT-1.12. | Partial |
| INST-1.2 | An institution with no accounts shall show "No accounts found for this institution." | Implemented |
| INST-1.3 | When the user has no institutions, the screen shall show "You haven't added any institutions yet." with an **Add your first institution** button. | Implemented |
| INST-1.4 | The user can add an institution by giving it a name. The name is required and at most 100 characters. Saving returns to the Accounts screen. | Implemented |
| INST-1.5 | Clicking an institution's name shall open a read-only View Institution screen (breadcrumb "Accounts / *name*") showing its name and whether it's manual or connected, with a menu to edit it. | Partial |
| INST-1.6 | The user can rename an institution from the Edit screen. Saving returns to the View screen. | Implemented |
| INST-1.7 | The card menu on the Accounts screen shall offer **Edit** and **Add account** (see ACCT-1.3), plus the connection actions in INST-2. | Implemented |
| INST-1.8 | The user can delete an institution from a "Danger Zone" on the Edit screen, after confirming. | Implemented |
| INST-1.9 | An institution that still has accounts cannot be deleted. The Delete button shall be disabled with the explanation "Cannot delete this institution because it has N associated account(s). You must delete the associated accounts first.", and the server shall reject the request with the same rule. | Implemented |
| INST-1.10 | The Accounts screen shall have an **Add institution** button in its header, in addition to the per-card menus and the empty-state button (INST-1.3). | Implemented |
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

INST-2.1 comes from the "Automated bank sync" item in `TODO.md`; the constraints are the ones written there. Provider details (link flow, token storage, incremental sync) belong in `docs/integrations/bank-sync.md` once the provider is chosen.

## Known gaps

- **The screen is still called Institutions (INST-1.1).** The navigation entry, route (`/institutions`), page title and breadcrumbs say "Institutions"; they become **Accounts** (APP-1.1).
- **Order (INST-1.1).** Institutions, and the accounts inside each card, appear in creation order.
- **Hidden and closed accounts aren't marked (INST-1.1).**

## Housekeeping

- **Sync endpoints are stubs.** `POST /institutions/:id/sync` and `POST /accounts/:id/sync` (`syncInstitution` in `institution-controller.ts`, `syncAccount` in `account-controller.ts`) report success without doing anything, and nothing in the UI calls them. Until INST-2 is built, return a not-implemented result, then replace the skipped `xit('should return sync stub success')` in `institution-routes.spec.ts`.

## Open questions

- **Duplicates when linking (INST-2.3).** Linking a manual account that already has hand-entered or imported transactions means sync may bring the same transactions again. Decide how they're matched (date, amount, merchant) in `docs/integrations/bank-sync.md`, together with de-duplicating against CSV imports.
