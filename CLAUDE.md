# Moped Finance

Self-hosted, single-user personal finance app: Angular client, Node/Express API, PostgreSQL. Packages: `client/`, `server/`, `shared/`.

Read the doc that fits the task before starting:

- [docs/architecture.md](docs/architecture.md): package layout, path aliases, server request flow, database, client structure
- [docs/development.md](docs/development.md): running the stack, database scripts, pre-PR checks
- [docs/testing.md](docs/testing.md): server (Jest + PGlite) and client (Vitest) test patterns
- [docs/deployment.md](docs/deployment.md): production status (not working yet)
- [docs/requirements/](docs/requirements/README.md): requirements by domain, with stable IDs
- [docs/planning/](docs/planning/roadmap.md): the roadmap (one line per milestone), the backlog, and one file per milestone in `milestones/` (`M02-bank-sync-and-categorization.md`): the plan, its tasks in order, decisions, progress notes and the outcome. The current one is [M02](docs/planning/milestones/M02-bank-sync-and-categorization.md)
- [docs/planning/milestones/M02-design.md](docs/planning/milestones/M02-design.md): how the milestone in progress is built (bank sync, rules). Read it before working on the milestone

@docs/conventions.md

## Workflow

Where the workflow's pieces live:

- **Backlog**: [docs/planning/backlog.md](docs/planning/backlog.md); its introduction says what each section is for and how an item is written
- **Milestones**: [docs/planning/milestones/](docs/planning/milestones/); the current one is the one [the roadmap](docs/planning/roadmap.md) marks in progress, and the roadmap says how a milestone file and its design doc work
- **Specs**: [docs/requirements/](docs/requirements/README.md), and the milestone's design doc while there is one
- **Checks**: [docs/development.md](docs/development.md#before-opening-a-pr)
- **Upkeep**: [docs/development.md](docs/development.md#dependencies) (`npm outdated`, `npm audit --omit=dev` in `client/` and `server/`)
- **Try it**: [docs/development.md](docs/development.md#trying-a-change-in-the-app)
- **Second review**: `server/src/auth/` (sessions, API tokens, secrets), `server/src/api/bank-sync/` (SimpleFIN credentials and synced data), `server/migrations/`, and anything that computes, stores or imports money amounts or balances

Rules for every change:

- When behavior changes, update the matching requirement in `docs/requirements/` (status or wording) in the same PR.
