# Server

Layering and the database are described in [docs/architecture.md](../docs/architecture.md#server); test patterns are in [docs/testing.md](../docs/testing.md#server).

- A new finance domain follows the existing folders in `src/api/`: `*-schema.ts`, `*-data.ts`, `*-controller.ts`, `*-routes.ts`, `*-routes.spec.ts`, and an `index.ts` barrel. Register the router in `src/api/index.ts`, and add the table to `TestDatabaseUtil.clearFinanceData`.
- Table changes go in the Drizzle `*-schema.ts` (constraints and indexes included), followed by `npm run db:generate -- --name <what_changed>`; commit the migration it writes. Never edit a merged migration. New tables use `financeSchema`/`coreSchema` from `@server/data`, and new schema files must match a path in `drizzle.config.ts`. See [docs/development.md](../docs/development.md#changing-the-schema).
- New endpoints that the client calls also need types in `shared/` (contracts/types/enums), not server-only types.
- `npx tsc --noEmit` catches errors that ts-node in the dev container reports only at runtime.
