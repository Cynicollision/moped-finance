# Moped Finance

Self-hosted, single-user personal finance app: Angular client, Node/Express API, PostgreSQL. Packages: `client/`, `server/`, `shared/`.

Read the doc that fits the task before starting:

- [docs/architecture.md](docs/architecture.md): package layout, path aliases, server request flow, database, client structure
- [docs/development.md](docs/development.md): running the stack, database scripts, pre-PR checks
- [docs/testing.md](docs/testing.md): server (Jest + PGlite) and client (Vitest) test patterns
- [docs/deployment.md](docs/deployment.md): production status (not working yet)
- [docs/requirements/](docs/requirements/README.md): requirements by domain, with stable IDs

@docs/conventions.md

## Workflow

- Every change goes through a PR to `main`. Branch as `claude/<short-kebab-summary>`, keep branches short-lived, and open the PR with `gh pr create`.
- Before a PR, run the checks in [docs/development.md](docs/development.md#before-opening-a-pr). Report any failures in the PR description.
- When behavior changes, update the matching requirement in `docs/requirements/` (status or wording) in the same PR.
- Keep docs short and accurate. When code changes make a doc wrong, fix the doc in the same PR.

## Backlog

`TODO.md` is the backlog, sectioned Now / Next / Later / Ideas.

- Delete an item once it's done; git history is the changelog.
- When you notice a bug, a deviation from standard practice, or other follow-up work that's out of scope for the current change, add it to the right section instead of fixing it on the side. Include file paths and what's wrong.
