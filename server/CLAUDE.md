# Server

Layering, ownership checks and the database are described in [docs/architecture.md](../docs/architecture.md#server); test patterns are in [docs/testing.md](../docs/testing.md#server).

- A new finance domain follows the existing folders in `src/api/`: `*-schema.ts`, `*-data.ts`, `*-controller.ts`, `*-routes.ts`, `*-routes.spec.ts`, and an `index.ts` barrel. Register the router in `src/api/index.ts`, and add the table to `TestDatabaseUtil.clearFinanceData`.
- Table changes go in both `scripts/schema_*.sql` and the Drizzle `*-schema.ts`.
- New endpoints that the client calls also need types in `shared/` (contracts/types/enums), not server-only types.
- `npx tsc --noEmit` catches errors that ts-node in the dev container reports only at runtime.
