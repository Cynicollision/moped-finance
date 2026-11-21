# M01 — Manual accounts

Status: released 2026-11-07 as v0.1.0

Written after the fact (2026-11-21) from the PR history, and kept light: M01 was planned in `TODO.md` and the requirements rather than in a file like this, so it has no task list or definition of done. Git history and the merged PRs have the detail.

# Plan

## Question

Can Moped Finance be a finished, self-hosted app for tracking every account, transaction and budget by hand, solid enough to run on the owner's home server as their only finance app?

## Scope

In: accounts and balances entered or imported by hand, transactions, categories, budget and spending, the Dashboard, settings and sign-in for a single owner, and a production image that runs on a home server.

Out: anything automatic. Bank sync and rules went to M02, real estate values to M03, and Tools, account details and demo mode's data to Unscheduled.

# Outcome

## Answer

Yes. v0.1.0 was tagged and published on 2026-11-07. It runs as a container on the owner's home server, over the LAN and HTTPS through a reverse proxy, and installs as an app on a phone.

## What was built

The app began in February 2026 as an earlier project, built with other AI tooling: about 115 commits of Angular client, Express API and Postgres, with institutions, accounts, the value-history chart and a demo-mode shell. On 2026-09-25 it was renamed Moped Finance and moved to Claude Code. From then to the release came 91 merged PRs ([#1](https://github.com/Cynicollision/moped-finance/pull/1) to [#93](https://github.com/Cynicollision/moped-finance/pull/93)):

- **Re-baseline** (late September): docs and requirements rewritten, with every open question decided on 2026-09-26 and the requirements made the backlog ([#13](https://github.com/Cynicollision/moped-finance/pull/13), [#14](https://github.com/Cynicollision/moped-finance/pull/14)). The app committed to a single owner ([#4](https://github.com/Cynicollision/moped-finance/pull/4)), the schema was cleaned up with migrations applied on startup ([#5](https://github.com/Cynicollision/moped-finance/pull/5), [#11](https://github.com/Cynicollision/moped-finance/pull/11)), and the server was hardened and moved to API tokens ([#7](https://github.com/Cynicollision/moped-finance/pull/7), [#15](https://github.com/Cynicollision/moped-finance/pull/15), [#16](https://github.com/Cynicollision/moped-finance/pull/16)).
- **Client foundation**: breakpoints and colour tokens, OnPush and signals, calendar dates as `YYYY-MM-DD` strings end to end, the app shell and navigation, and one pattern each for dialogs, loading, lists and money ([#17](https://github.com/Cynicollision/moped-finance/pull/17) to [#24](https://github.com/Cynicollision/moped-finance/pull/24)).
- **Features** (October): categories with types, necessity, Uncategorized as a state, icons and CSV import/export; account types and groups, carried-forward balances, set and adjusted entries, transactions that adjust balances, hidden and closed accounts; split transactions and import de-duplication; Budget and Spending with Left over, Savings and averages; Profile, Appearance (dark, light or matching the system), Change Password, sign-in lockout and password reset; registration with default categories.
- **Release readiness** (mid October to November): Node 24, Express 5, TypeScript 6 and Angular 22 ([#77](https://github.com/Cynicollision/moped-finance/pull/77) to [#81](https://github.com/Cynicollision/moped-finance/pull/81)); the repository made public under the MIT licence ([#76](https://github.com/Cynicollision/moped-finance/pull/76), [#85](https://github.com/Cynicollision/moped-finance/pull/85)); the image published to GHCR with wipe and sample-data commands ([#86](https://github.com/Cynicollision/moped-finance/pull/86)); backup and restore docs and log retention ([#90](https://github.com/Cynicollision/moped-finance/pull/90)); installing as an app ([#91](https://github.com/Cynicollision/moped-finance/pull/91)); a final tidy-up ([#92](https://github.com/Cynicollision/moped-finance/pull/92)).

At the tag: 236 commits, 20 server and 54 client spec files.

## What we learned

- **Requirements with stable IDs work as the backlog.** Naming tests and PRs after the IDs ([#51](https://github.com/Cynicollision/moped-finance/pull/51), [#52](https://github.com/Cynicollision/moped-finance/pull/52)) kept a long run of PRs traceable, and deciding every open question in one pass, before building, left the PRs nothing to wait on.
- **Calendar dates as strings** ([#19](https://github.com/Cynicollision/moped-finance/pull/19)), with tests run west of UTC, ended a whole class of off-by-one-day bugs.
- **The early production setup had never run.** Making the image real ([#8](https://github.com/Cynicollision/moped-finance/pull/8), [#86](https://github.com/Cynicollision/moped-finance/pull/86)) and using the app on the actual server and phone ([#75](https://github.com/Cynicollision/moped-finance/pull/75), [#87](https://github.com/Cynicollision/moped-finance/pull/87)) found problems no test did.
- **A flat `TODO.md` held one milestone's order but not its decisions and progress**, which ended up scattered across PR descriptions. That's why M02 has a file like this one.

## Follow-ups

- Bank sync through SimpleFIN Bridge, with rules and learning that categorize transactions: [M02](M02-bank-sync-and-categorization.md).
- Real estate values: M03, in `TODO.md`.
- Tools, account details and demo mode's data: `TODO.md`, Unscheduled.
