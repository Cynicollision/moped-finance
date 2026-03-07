# Database Strategy

**Engine:** PostgreSQL 16
**Instance:** A single database instance is used for the entire application.

## Schema Management
Database schema is managed via raw SQL scripts for simplicity.
*   **Schema Definition:**
    *   `server/scripts/schema_core.sql`
    *   `server/scripts/schema_finance.sql`
*   **Initialization:** Managed by individual scripts per schema (e.g., `server/scripts/init-core-db.ts`).
*   **Seeding:** Managed by individual scripts per schema (e.g., `server/scripts/seed-finance-db.ts`).

### NPM Scripts
Common database operations are wrapped in NPM scripts within `server/package.json`. Run these from the `server/` directory.

Commands can be run for the entire database or targeted to specific schemas (e.g., `core`, `finance`).

| Command | Description | Global Example | Per-Schema Example |
| :--- | :--- | :--- | :--- |
| `db:reset` | Drops, initializes, and seeds. | `npm run db:reset` | `npm run db:reset:finance` |
| `db:init` | Applies the SQL schema. | `npm run db:init` | `npm run db:init:core` |
| `db:seed` | Runs the seeding script. | `npm run db:seed` | `npm run db:seed:finance` |
| `db:drop` | Drops schemas (Teardown). | `npm run db:drop` | `npm run db:drop:core` |

## Logical Separation via Schemas

To maintain clear separation of concerns between the different logical "apps" within the monolith, the database is organized into multiple schemas. This allows for both logical grouping of related tables and the ability to perform queries across different domains when necessary.

The primary schemas are:

*   **`core`**: Contains entities common to all application modules, such as `User`, `Log`, and `AsyncJob`.
*   **`finance`**: Contains entities for the Finance app, such as `Account`, `Transaction`, and `Category`.
*   **`grounds`**: Contains entities for the Grounds app, including `Location`, `Planting`, and `CareSchedule`.
*   **`home`**: Contains entities for the Home app, such as `Property` and `Mortgage`.

The detailed structure of the entities within these schemas is defined in the `logical.md` document.
