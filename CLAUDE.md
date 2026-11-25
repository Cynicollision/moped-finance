# Moped Finance

Self-hosted, single-user personal finance app: Angular client, Node/Express API, PostgreSQL. Packages: `client/`, `server/`, `shared/`.

Read the doc that fits the task before starting:

- [docs/architecture.md](docs/architecture.md): package layout, path aliases, server request flow, database, client structure
- [docs/development.md](docs/development.md): running the stack, database scripts, pre-PR checks
- [docs/testing.md](docs/testing.md): server (Jest + PGlite) and client (Vitest) test patterns
- [docs/deployment.md](docs/deployment.md): production status (not working yet)
- [docs/requirements/](docs/requirements/README.md): requirements by domain, with stable IDs
- [docs/milestones/](docs/milestones/README.md): one file per milestone (`M02-bank-sync-and-categorization.md`): the plan, its tasks in order, decisions, progress notes and the outcome. The current one is [M02](docs/milestones/M02-bank-sync-and-categorization.md)
- [docs/milestones/M02-design.md](docs/milestones/M02-design.md): how the milestone in progress is built (bank sync, rules). A milestone may have one such design doc beside its file while it's being built: read it before working on the milestone, correct it as the code proves it wrong, and fold what stays true into `architecture.md` when the milestone ships, deleting the doc

@docs/conventions.md

## Workflow

Where the workflow's pieces live (the user-level `/next` skill reads this list):

- **Backlog**: [TODO.md](TODO.md)
- **Milestones**: [docs/milestones/](docs/milestones/README.md); the current one is the one `TODO.md`'s table marks in progress
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

`TODO.md` is the high-level backlog: one line per milestone toward 1.0, items for milestones not planned yet, then Unscheduled, with Ideas last. The milestone being built has its own file in `docs/milestones/`, which holds its tasks; work for it goes there. The `/next` skill (user-level, in `~/.claude/skills/next/`) runs a session's worth of either: candidates, questions, plan, then one PR at a time.

- Delete a `TODO.md` item once it's done; git history is the changelog. A milestone task is ticked instead, with a *Changed while doing it* note in the PR that finishes it, and the file keeps the record.
- When you notice a bug, a deviation from standard practice, or other follow-up work that's out of scope for the current change, add it to the right milestone (its file's tasks, or its `TODO.md` section if it has no file yet) or to Unscheduled, instead of fixing it on the side. Include file paths and what's wrong.
- Point at code by file and function or symbol name (`account-controller.ts`, `importBalanceHistory`), not line numbers, which go stale.
