# Moped Finance

A self-hosted, single-user personal finance app. It runs on a home server (a NAS or any Docker host on your network) and keeps your accounts, transactions, budget and spending in your own Postgres database.

> **Status:** early and under active development. The first release, v0.1 (manual accounts), is in progress and hasn't been deployed outside development yet. See the [roadmap](#roadmap).

## What it does

- **Accounts**: institutions and their accounts, assets and liabilities in groups (cash, investments, retirement, real estate, ...), with balances entered by hand or kept up to date by transactions, balance history imported from CSV, and closed or hidden accounts.
- **Transactions**: entered by hand or imported from CSV, split across categories, filtered and searched, and exported.
- **Categories**: income and expense categories in groups, marked essential or discretionary.
- **Budget**: recurring income and expenses, seen monthly, quarterly or yearly.
- **Spending**: what actually came in, went out and was saved in a period, against the budget.
- **Dashboard**: net worth and its history.
- **Settings**: light and dark themes, password, and API tokens for scripts.

## Roadmap

Each milestone ends with a tagged release; the details are in [TODO.md](TODO.md).

| Release | Milestone |
|---|---|
| v0.1 | **Initial release**: the core app with manual accounts, installable on a phone, with a demo mode |
| v0.2 | Automatic categorization: rules, and learning from your transactions |
| v0.3 | Tools: reports and a retirement tracker |
| v0.4 | Real estate values from an online estimate |
| v0.5 | Automated bank sync through [SimpleFIN Bridge](https://www.simplefin.org/) |

Version 1.0 is the release that finishes the last of these.

## Running it

- **Development:** Node.js 22 and Docker. See [docs/development.md](docs/development.md).
- **Self-hosting:** one Docker image plus Postgres, on a private network. See [docs/deployment.md](docs/deployment.md); it describes the intended setup, which hasn't been run on a real host yet.

Built with Angular, Node.js and Express, and PostgreSQL with Drizzle ORM.

## Docs

- [Development](docs/development.md): local setup, day-to-day commands, releases
- [Architecture](docs/architecture.md): packages, request flow, database
- [Testing](docs/testing.md)
- [Deployment](docs/deployment.md)
- [Code conventions](docs/conventions.md)
- [Requirements](docs/requirements/README.md): what the app does and will do, by domain
- [Backlog](TODO.md)

## Licence

[MIT](LICENSE)
