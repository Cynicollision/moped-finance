# Moped Finance Requirements

This folder is Moped Finance's requirements: what it does and what it's planned to do, as numbered requirements grouped by domain. It's also the feature backlog: every `Planned` or `Partial` sub-requirement is work to do. `TODO.md` holds the rest (technical work, tooling, security hardening, and decisions not yet written up as requirements).

The first set was written by reading the running app and its code, so domains not yet revisited still mostly describe current behavior. Categories (`CAT`), Institutions (`INST`), Accounts (`ACCT`) and the Summary (`DASH`) have been reworked into the intended design. Every domain's open questions were decided on 2026-09-26 and written up as requirements, so what's left in each Known gaps is work, not decisions.

## Domains

| Prefix | Domain | File |
|---|---|---|
| `APP` | Application shell, navigation, feedback, demo mode | [app.md](app.md) |
| `AUTH` | Registration, login, sessions, single owner, API tokens | [auth.md](auth.md) |
| `SET` | The Settings screen, profile, appearance | [settings.md](settings.md) |
| `INST` | Institutions, manual and connected, and the Accounts screen that lists them | [institutions.md](institutions.md) |
| `ACCT` | Accounts, balances, balance-history import/export | [accounts.md](accounts.md) |
| `DASH` | Summary, net worth and value-history chart | [dashboard.md](dashboard.md) |
| `CAT` | Categories and category groups | [categories.md](categories.md) |
| `TXN` | Transactions, import/export | [transactions.md](transactions.md) |
| `BUD` | Budget (recurring income and expense streams) | [budget.md](budget.md) |
| `CASH` | Cashflow (actual income, expenses, savings for a period) | [cashflow.md](cashflow.md) |

## Verification against the running app

The drafts were refined on 2026-09-25 by walking the running app (development build, so "today" is 2026-05-17) as a signed-in user with the sample data set, plus dry-run CSV imports. Nothing was saved, deleted or imported. Where the app disagreed with a draft, the requirement now states the observed behavior and the difference is called out in the domain's Known gaps.

Covered: Accounts summary, Account Details and its menus, Edit Account, Add Account, Institutions (list, view, edit, delete rule), Transactions (list, filters, sorting, add form, view, delete dialog, import validation), Cashflow (all periods, Category/Group toggle, drill-down), Budget (screen and add dialog), Categories (screen and dialogs), the profile menu, and the handset-width navigation.

Not exercised, so still as first drafted from the code: Login and Register screens (the session was already signed in and Sign out was left alone), demo mode, saving any form, confirming an import, downloading CSVs, and the API-only rules (AUTH-3.4 to AUTH-3.5, AUTH-5.1).

## Numbering

Requirements come in two levels, and the ID tells you which:

| Level | ID format | Example | What it is |
|---|---|---|---|
| Requirement | `DOMAIN-n` | `AUTH-2` | An outcome the user needs, in plain language. Says *what and why*, not how. It's the heading of a table. |
| Sub-requirement | `DOMAIN-n.m` | `AUTH-2.3` | A specific, testable behavior that supports its requirement. It's a row in that table, with a status. |

Rules:

- IDs are **stable**. Never renumber. New requirements take the next free number in their domain (or the next `.m` under their requirement), even if that leaves the file out of topical order.
- A removed sub-requirement keeps its ID with status `Retired` and a one-line reason, so references in code comments, tests, commits and TODO items don't dangle.
- Reference requirements by ID from other contexts: test names (`AUTH-2.2 rejects mismatched passwords`), commit messages, TODO items, PR descriptions.
- Cross-domain references use the full ID (`see TXN-3.2`).
- Cross-cutting quality requirements (security, performance, accessibility) go under `APP` for now. If they grow, split out an `NFR` domain.

## Status

| Status | Meaning |
|---|---|
| `Implemented` | Works as written today. |
| `Partial` | Some of it works; the domain's **Known gaps** says what doesn't. When a decision changes existing behavior, the sub-requirement is reworded to the new behavior and marked `Partial` until it's built. |
| `Planned` | Decided, not built. |
| `Retired` | No longer applies. Kept for reference. |

## Domain files

Each domain file has an introduction, then one table per requirement, then up to four sections:

- **Known gaps**: where the app falls short of a sub-requirement or of standard practice, with enough detail to fix it.
- **Housekeeping**: code cleanup in the domain that no requirement asks for (dead fields, stubs, workarounds to remove). Cross-cutting technical work stays in `TODO.md`.
- **Open questions**: things not decided yet. Once decided, they become sub-requirements (or `TODO.md` items for technical work) and leave this list.
- **Notes**: context that isn't a requirement, such as design reasoning or facts about the data.

## Writing style

- Sub-requirements are one behavior each, phrased "The system shall …" or "The user can …", and specific enough that a test could pass or fail against them.
- Quote exact UI text and limits (field lengths, default values) where they matter.
- Describe behavior, not implementation. Code file names and function names belong in Known gaps at most, since they drift.

## Terms

| Term | Meaning |
|---|---|
| Institution | A bank, brokerage, lender, or other place that holds accounts. |
| Account | A single balance the user tracks: a checking account, credit card, mortgage, property, and so on. |
| Type (account) | What kind of account it is: Checking, Credit Card, Mortgage, and so on (ACCT-1.2). Decides the group. |
| Group (account) | `Cash`, `Investments`, `Real Estate`, `Other Assets`, `Credit Cards`, `Loans`. Decides the account category. |
| Category (account) | `Asset` or `Liability`. Determines which totals an account contributes to. |
| Manual / connected | A connected institution has a bank connection; a connected account is linked to an account at it and gets its balances and transactions from sync. Everything else is manual (INST-2, ACCT-4). |
| Balance history | Dated balance entries for an account, at most one per date. An account's current balance is its latest entry on or before today. |
| Set / adjusted entry | A set balance entry is one the user entered or imported, or sync recorded; it's a checkpoint. An adjusted entry exists only because of transactions that adjust the balance (ACCT-5.1). |
| Hidden account | Left out of everything but the Accounts screen and its own details, past included (ACCT-1.9). |
| Closed account | No longer held: off the Summary lists, but its past still counts (ACCT-6). |
| Category group / category | Two-level classification of transactions and budget streams. A category group has a type (`Income`, `Expense`, `Transfer`) and contains categories. |
| Necessity | Whether an expense category is `Essential` or `Discretionary`. |
| Uncategorized | The built-in category for transactions that haven't been given one. |
| Budget stream | A recurring planned income or expense amount tied to a category. |
| Cashflow | Actual income and expenses for a calendar period, aggregated from transactions. |

Note that "category" is overloaded: accounts have a *category* (Asset/Liability) and transactions have a *category* (Groceries, Salary, …). Requirements say "account category" for the former and "category" for the latter.
