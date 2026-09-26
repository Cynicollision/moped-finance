# Institutions (`INST`)

An institution is where accounts live (a bank, a brokerage, a lender). Accounts always belong to one, so the user starts here when adding an account.

Screens: **Institutions** (`/institutions`), **Add Institution**, **View Institution**, **Edit Institution**.

## INST-1 The user can keep a list of their institutions

| ID | Requirement | Status |
|---|---|---|
| INST-1.1 | The Institutions screen shall list every institution as a card showing its name, its account count ("1 account", "3 accounts"), and each of its accounts with the account's type (or group, when it has no type) and a **View** button linking to the account. | Implemented |
| INST-1.2 | An institution with no accounts shall show "No accounts found for this institution." | Implemented |
| INST-1.3 | When the user has no institutions, the screen shall show "You haven't added any institutions yet." with an **Add your first institution** button. | Implemented |
| INST-1.4 | The user can add an institution by giving it a name. The name is required and at most 100 characters. Saving returns to the Institutions screen. | Implemented |
| INST-1.5 | Clicking an institution's name shall open a read-only View Institution screen (breadcrumb "Institutions / *name*") showing its name, with a menu to edit it. | Implemented |
| INST-1.10 | The Institutions screen shall have an **Add institution** button in its header, in addition to the per-card menus and the empty-state button (INST-1.3). | Implemented |
| INST-1.6 | The user can rename an institution from the Edit screen. Saving returns to the View screen. | Implemented |
| INST-1.7 | The card menu on the Institutions screen shall offer **Edit** and **Add account** (see ACCT-1.3). | Implemented |
| INST-1.8 | The user can delete an institution from a "Danger Zone" on the Edit screen, after confirming. | Implemented |
| INST-1.9 | An institution that still has accounts cannot be deleted. The Delete button shall be disabled with the explanation "Cannot delete this institution because it has N associated account(s). You must delete the associated accounts first.", and the server shall reject the request with the same rule. | Implemented |

## INST-2 The user can have institution data kept up to date automatically

| ID | Requirement | Status |
|---|---|---|
| INST-2.1 | The user can link an institution to their bank and have its accounts and transactions sync on a schedule and on demand, using a service that costs nothing for a single user and needs no inbound connections (polling only). | Planned |

INST-2.1 comes from the "Automated bank sync" item in `TODO.md`; the constraints are the ones written there. Detailed requirements belong in `docs/integrations/bank-sync.md` once the provider is chosen.

## Observations

- **Order is neither alphabetical nor by size.** Institutions (Bank of America, Charles Schwab, Fidelity, Optum, American Express, Chase, Citi, Zillow, AmeriHome, Ally) and the accounts inside each card (BofA Savings, BofA Checking, BofA Visa) appear in what looks like creation order. Say whether that is the intended order.
- **Verified:** INST-1.1, INST-1.7 (card menu offers **Edit** and **Add account**) and INST-1.9 (Delete disabled with the exact message "Cannot delete this institution because it has 3 associated account(s). You must delete the associated accounts first." for Bank of America).

- **Sync is a stub.** The API has a sync endpoint for institutions that reports success without doing anything, and nothing in the UI calls it. `TODO.md` already plans to make it return "not implemented".
- **Names needn't be unique.** Two institutions can share a name.
- **The database doesn't back up INST-1.9.** If an institution that accounts reference were deleted, the database would blank those accounts' institution rather than refuse, so the application-level check is the only thing preventing orphaned accounts.
