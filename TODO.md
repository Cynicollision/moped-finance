# TODO / Backlog

Work items and ideas, grouped by priority. Move items up or down as priorities change; delete them once done (git history is the changelog).

- **Now**: re-establishing a solid baseline. Do these before new feature work.
- **Next**: hardening and finishing the core app (manual entry, import/export).
- **Later**: bigger features that need design first.
- **Ideas**: unsorted thoughts, not yet committed to.

---

## Now

### Rename to Moped Finance
Do this before writing the new docs and CLAUDE.md files, so they use the new name from the start.

Naming conventions by context:

| Context | Name |
|---|---|
| Display name (UI title, README, docs) | Moped Finance |
| GitHub repo | `moped-finance` |
| Docker image | `ghcr.io/cynicollision/moped-finance` (GHCR requires lowercase) |
| Compose containers | `moped-finance-db`, `moped-finance-api` |
| npm packages | `moped-finance-client`, `moped-finance-server` |
| Angular project | `moped-finance` (also changes the build output to `client/dist/moped-finance`) |
| Postgres database / user examples | `moped_finance` (underscores, so identifiers don't need quoting) |
| Browser storage keys | `moped_finance_*` |

- [ ] Final check: `git grep -i -E "home[-_ ]?lab"` returns nothing. Only `_docs/` and `GEMINI.md` remain; both go away with the Docs and Claude Code setup items.

### Production build
The production setup was written but never run; only the dev compose stack (API with nodemon hot reload + Postgres) has been used and is verified working. The production image builds but doesn't start: `docker build .` then `docker run` fails with `Cannot find module '/app/server/dist/index.js'`.
- [ ] `CMD ["node", "dist/index.js"]` (and `main` in `server/package.json`) is wrong: because the server imports `../shared`, tsc emits to `dist/server/index.js` and `dist/shared/`.
- [ ] The `@server/*` / `@shared/*` path aliases aren't rewritten in the compiled output, so `node dist/server/index.js` fails with `Cannot find module '@server/api'`. Rewrite them at build time (e.g. `tsc-alias`) or bundle the server (e.g. esbuild).
- [ ] Static files don't line up: Angular's application builder writes to `dist/moped-finance/browser/`, the Dockerfile copies `dist/moped-finance` to `server/public` (so `index.html` ends up in `server/public/browser/`), and Express serves `path.join(__dirname, 'public')`, which resolves to `dist/server/public`. Pick one location and make all three agree.
- [ ] The client hardcodes `apiUrl: 'http://localhost:3000'` in both `environment.ts` (production) and `environment.development.ts`, so a production browser would call its own machine. Use relative URLs (`apiUrl: ''`) so the app talks to the origin that served it, and in development route through the dev-server proxy. `client/proxy.conf.json` exists but is unused, and it only covers `/api` while auth is mounted at `/auth`. With same-origin requests the server-side CORS setup can likely go.
- [ ] Add a CI smoke test: build the image, start it, and check that `/` returns `index.html`.

### Tests
- [ ] Fix the client test `App > should render sidenav container` in `client/src/app/app.spec.ts`. The hand-rolled Router mock is missing `createUrlTree`; use `provideRouter([])` instead of mocking `Router`.

### CI
- [ ] Add client tests (`ng test --watch=false`) to `.github/workflows/ci.yml`.
- [ ] Add a server type-check (`tsc --noEmit`) and a client production build (`ng build`) to CI.

### Claude Code setup
- [ ] Add a root `CLAUDE.md`: purpose, package layout, path aliases, commands, definition of done, conventions (`./../` imports, `else`/`catch` on a new line, `EntityId`, `DateTimeUtil`).
- [ ] Add `server/CLAUDE.md`: route → controller → data → schema layering, `OperationHandler`/`Result`, ownership checks, PGlite test pattern.
- [ ] Add `client/CLAUDE.md`: component conventions, signals, `DateProviderService`, Vitest patterns, and the rule that every new API call also needs a demo interceptor handler.
- [ ] Add `.claude/settings.json` (permission allowlist for test/build/docker/git commands, deny reading `.env`); add `.claude/settings.local.json` and `CLAUDE.local.md` to `.gitignore`.
- [ ] Add project skills: `new-finance-resource`, `verify`, `backlog` (and `schema-change` once migrations exist).
- [ ] Remove `GEMINI.md` and `.agents/`.

### GitHub
- [ ] Install the GitHub CLI and authenticate (`winget install GitHub.cli`, then `gh auth login`).
- [ ] Optional: install the Claude GitHub App (`/install-github-app` from a `claude` terminal session).
- [ ] Protect `main`: require CI to pass; work on feature branches through PRs.

### Docs
- [ ] Rename `_docs/` to `docs/` and rewrite everything from the actual code. The current docs are outdated: nonexistent `server/src/core` and `server/src/finance` paths, "grounds"/"home" schemas, a missing `logical.md`, and tests described as mocking the data layer.
- [ ] Write `README.md` (currently just a title).
- [ ] Write `docs/requirements.md`, `architecture.md`, `data-model.md`, `development.md`, `testing.md`, and `deployment.md`.
- [ ] Deployment docs should describe a generic "private-network Docker host" workflow, not a specific NAS vendor. Merge `build.md` and `nas-deployment.md` into it.

### Cleanup
- [x] Delete the committed `scratch/refactor-tests.js`.

---

## Next

### Data & deployment
- [ ] Add database migrations (e.g. drizzle-kit). Schema is currently applied with `CREATE TABLE IF NOT EXISTS` scripts, which can't upgrade an existing production database.
- [ ] Give production a working database init/seed path. `ts-node` isn't in the production image, so the documented `docker exec ... ts-node` commands don't work. Options: compile scripts into the image, or run migrations on startup.
- [ ] Remove the hardcoded bootstrap admin password hash (`admin`/`admin123`) from the deployment docs; replace it with a safe first-user bootstrap.
- [ ] Document backup and restore for the Postgres volume.
- [ ] Re-enable the commented-out GHCR build-and-push job in CI (or decide on another way to deliver images).

### Security & auth
- [ ] Use a persistent session store (e.g. `connect-pg-simple`). The default in-memory store logs everyone out on every restart.
- [ ] Fail startup in production if `SESSION_SECRET` is unset; don't fall back to `'dev-secret-key'` (`server/index.ts`).
- [ ] Single-user app: disable or lock down `POST /auth/register` after the first user exists (and hide the register page).

### Correctness
- [ ] `syncAccount` and `syncInstitution` are stubs that return success (`account-controller.ts:95`, `institution-controller.ts:80`). Until real sync exists, return a not-implemented result and hide/disable the sync UI. Then replace the skipped `xit('should return sync stub success')` in `institution-routes.spec.ts`.
- [ ] Balance CSV import returns `Result.success` when parsing fails; it should be a bad request (`account-controller.ts:145`).
- [ ] Decide whether balance/transaction imports allow partial success (`account-controller.ts:220`, `:240`; `transaction-controller.ts:211`).
- [ ] Bulk insert for transaction import instead of row-by-row (`transaction-controller.ts:198`).

### Testing
- [ ] Frontend coverage: services (`api`, `finance`, `auth`, `modal`, `notification`), `auth.guard`, the demo interceptor, and key components (summary, transactions, imports).
- [ ] Make server "now" injectable (via `DateTimeUtil`) so date-based logic is deterministic in tests.
- [ ] `TestExpressUtil.createMockLogger` should mock `IAppLogger`, not `AppLogger` (`server/src/utility/testing/express-util.ts:23`).

### Tooling
- [ ] Install Prettier (already configured in `client/package.json` but not a dependency) and apply it to both packages.
- [ ] Add ESLint (angular-eslint on the client, typescript-eslint on the server) and run it in CI.

### Code cleanup
- [ ] Decide whether to keep or remove the unused Gemini gateway (`server/src/gateways/`) and its `GEMINI_*` env vars.

---

## Later

### Automated bank sync
Manual entry and import/export come first. Constraints for when this gets picked up:
- **No paid subscription.** It must fit a single user on a free tier (or use a free alternative). Check the current terms before building anything.
- **Polling only.** The host isn't reachable from the internet, so no webhooks. Sync on a schedule and/or on demand.
- [ ] Write `docs/integrations/bank-sync.md` before coding: provider choice and cost, link flow, encrypted storage of access tokens, cursor-based incremental sync, mapping provider items/accounts to institutions/accounts, de-duplicating against CSV imports, and sandbox → production.
- [ ] Implement behind the existing sync endpoints.

---

## Ideas

<!-- Unsorted ideas go here. -->
