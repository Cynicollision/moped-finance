# Moped Finance Requirements

This folder captures what Moped Finance does today, and what it is planned to do, as numbered requirements grouped by domain. The initial set was written by reading the running app and its code, not from a design brief, so it describes current behavior. Where current behavior looks unintentional or incomplete, the domain file says so under **Observations** instead of silently making it a requirement.

## Domains

| Prefix | Domain | File |
|---|---|---|
| `APP` | Application shell, navigation, feedback, demo mode | [app.md](app.md) |
| `AUTH` | Registration, login, sessions, data isolation | [auth.md](auth.md) |
| `INST` | Institutions | [institutions.md](institutions.md) |
| `ACCT` | Accounts, balances, balance-history import/export | [accounts.md](accounts.md) |
| `DASH` | Accounts summary, net worth and value-history chart | [dashboard.md](dashboard.md) |
| `CAT` | Categories and category groups | [categories.md](categories.md) |
| `TXN` | Transactions, import/export | [transactions.md](transactions.md) |
| `BUD` | Budget (recurring income and expense streams) | [budget.md](budget.md) |
| `CASH` | Cashflow (actual income, expenses, savings for a period) | [cashflow.md](cashflow.md) |

## Verification against the running app

The drafts were refined on 2026-09-25 by walking the running app (development build, so "today" is 2026-05-17) as a signed-in user with the sample data set, plus dry-run CSV imports. Nothing was saved, deleted or imported. Where the app disagreed with a draft, the requirement now states the observed behavior and the difference is called out in the domain's Observations.

Covered: Accounts summary, Account Details and its menus, Edit Account, Add Account, Institutions (list, view, edit, delete rule), Transactions (list, filters, sorting, add form, view, delete dialog, import validation), Cashflow (all periods, Category/Group toggle, drill-down), Budget (screen and add dialog), Categories (screen and dialogs), the profile menu, and the handset-width navigation.

Not exercised, so still as first drafted from the code: Login and Register screens (the session was already signed in and Sign out was left alone), demo mode, saving any form, confirming an import, downloading CSVs, and the API-only rules (AUTH-3.4 to AUTH-3.5, AUTH-5.1, ownership checks).

## Numbering

Requirements come in two levels, and the ID tells you which:

| Level | ID format | Example | What it is |
|---|---|---|---|
| Business requirement (BR) | `DOMAIN-n` | `AUTH-2` | An outcome the user needs, in plain language. Says *what and why*, not how. |
| Functional requirement (FR) | `DOMAIN-n.m` | `AUTH-2.3` | A specific, testable behavior of the system that supports its business requirement. |

Rules:

- IDs are **stable**. Never renumber. New requirements take the next free number in their domain (or the next `.m` under their BR), even if that leaves the file out of topical order.
- A removed requirement keeps its ID with status `Retired` and a one-line reason, so references in code comments, tests, commits and TODO items don't dangle.
- Reference requirements by ID from other contexts: test names (`AUTH-2.2 rejects mismatched passwords`), commit messages, TODO items, PR descriptions.
- Cross-domain references use the full ID (`see TXN-3.2`).
- Cross-cutting quality requirements (security, performance, accessibility) go under `APP` for now. If they grow, split out an `NFR` domain.

## Status

| Status | Meaning |
|---|---|
| `Implemented` | Works as written today. |
| `Partial` | Some of it works; the gap is described in the domain's Observations. Where the app shows a control that doesn't fully work (a field that isn't saved, a flag nothing reads), the requirement states the intent the UI implies. Confirm or reword those. |
| `Planned` | Not built, and already on the backlog in `TODO.md`. Ideas that aren't on the backlog are listed under a domain's Observations until you decide to adopt them. |
| `Retired` | No longer applies. Kept for reference. |

## Writing style

- Functional requirements are one behavior each, phrased "The system shall …" or "The user can …", and specific enough that a test could pass or fail against them.
- Quote exact UI text and limits (field lengths, default values) where they matter.
- Describe behavior, not implementation. Code file names and function names belong in Observations at most, since they drift.

## Terms

| Term | Meaning |
|---|---|
| Institution | A bank, brokerage, lender, or other place that holds accounts. |
| Account | A single balance the user tracks: a checking account, credit card, mortgage, property, and so on. |
| Category (account) | `Asset` or `Liability`. Determines which totals an account contributes to. |
| Group (account) | `Cash`, `Investment`, `Real Estate`, `Credit Card`, `Loan`. |
| Balance history | Dated balance entries for an account. An account's current balance is its latest entry. |
| Category group / category | Two-level classification of transactions. A category group has a class (`Income`, `Expense`, `Transfer`) and contains categories. |
| Budget stream | A recurring planned income or expense amount tied to a category. |
| Cashflow | Actual income and expenses for a calendar period, aggregated from transactions. |

Note that "category" is overloaded: accounts have a *category* (Asset/Liability) and transactions have a *category* (Groceries, Salary, …). Requirements say "account category" for the former and "category" for the latter.
