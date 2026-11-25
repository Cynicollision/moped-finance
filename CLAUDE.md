# Moped Finance

Self-hosted, single-user personal finance app: Angular client, Node/Express API, PostgreSQL. Packages: `client/`, `server/`, `shared/`.

Read the doc that fits the task before starting:

- [docs/architecture.md](docs/architecture.md): package layout, path aliases, server request flow, database, client structure
- [docs/development.md](docs/development.md): running the stack, database scripts, pre-PR checks
- [docs/testing.md](docs/testing.md): server (Jest + PGlite) and client (Vitest) test patterns
- [docs/deployment.md](docs/deployment.md): production status (not working yet)
- [docs/requirements/](docs/requirements/README.md): requirements by domain, with stable IDs
- [docs/planning/](docs/planning/roadmap.md): the roadmap (one line per milestone), the backlog, and one file per milestone in `milestones/` (`M02-bank-sync-and-categorization.md`): the plan, its tasks in order, decisions, progress notes and the outcome. The current one is [M02](docs/planning/milestones/M02-bank-sync-and-categorization.md)
- [docs/planning/milestones/M02-design.md](docs/planning/milestones/M02-design.md): how the milestone in progress is built (bank sync, rules). A milestone may have one such design doc beside its file while it's being built: read it before working on the milestone, correct it as the code proves it wrong, and fold what stays true into `architecture.md` when the milestone ships, deleting the doc

@docs/conventions.md

## Workflow

Where the workflow's pieces live:

- **Backlog**: [docs/planning/backlog.md](docs/planning/backlog.md)
- **Milestones**: [docs/planning/milestones/](docs/planning/milestones/); the current one is the one [the roadmap](docs/planning/roadmap.md) marks in progress
- **Specs**: [docs/requirements/](docs/requirements/README.md), and the milestone's design doc while there is one
- **Checks**: [docs/development.md](docs/development.md#before-opening-a-pr)
- **Upkeep**: [docs/development.md](docs/development.md#dependencies) (`npm outdated`, `npm audit --omit=dev` in `client/` and `server/`)
- **Try it**: [docs/development.md](docs/development.md#trying-a-change-in-the-app)

Rules for every change:

- Every change goes through a PR to `main`. Branch as `claude/<short-kebab-summary>`, keep branches short-lived, and open the PR with `gh pr create`.
- Before a PR, run the checks in [docs/development.md](docs/development.md#before-opening-a-pr). Report any failures in the PR description.
- When behavior changes, update the matching requirement in `docs/requirements/` (status or wording) in the same PR.
- Keep docs short and accurate. When code changes make a doc wrong, fix the doc in the same PR.

## Backlog

Planning lives in `docs/planning/`. `roadmap.md` has one line per milestone toward 1.0. `backlog.md` holds the work outside the milestone being built: an Inbox of things found but not sorted yet, items for milestones not planned yet, then Anytime, Parked and Ideas (its introduction says what each is for). The milestone being built has its own file in `milestones/`, which holds its tasks; work for it goes there.

- Delete a backlog item once it's done; git history is the changelog. A milestone task is ticked instead, with a *Changed while doing it* note in the PR that finishes it, and the file keeps the record.
- When you notice a bug, a deviation from standard practice, or other follow-up work that's out of scope for the current change, add it to the right milestone (its file's tasks, or its backlog section if it has no file yet) or to the backlog's Inbox, instead of fixing it on the side. Include file paths and what's wrong, and where you found it. Only the owner moves items out of the Inbox.
- Point at code by file and function or symbol name (`account-controller.ts`, `importBalanceHistory`), not line numbers, which go stale.
