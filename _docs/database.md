# Database Strategy

**Engine:** PostgreSQL 16
**Instance:** A single database instance is used for the entire application.

## Schema Management
Database schema is managed via raw SQL scripts for simplicity.
*   **Schema Definition:** `server/sql/schema.sql`
*   **Initialization:** `server/scripts/init-db.ts`
*   **Seeding:** Test data is loaded via `server/scripts/seed-db.ts`.

### NPM Scripts
Common database operations are wrapped in NPM scripts within `server/package.json`. Run these from the `server/` directory.

| Script | Description | Example |
| :--- | :--- | :--- |
| `npm run db:init` | Applies the SQL schema to the database. | `npm run db:init` |
| `npm run db:wipe` | Drops all schemas (Teardown). | `npm run db:wipe` |
| `npm run db:reset` | Wipes, initializes, and seeds the DB. | `npm run db:reset` |
| `npm run db:seed` | Runs the seeding script. | `npm run db:seed` |

## Logical Separation via Schemas

To maintain clear separation of concerns between the different logical "apps" within the monolith, the database is organized into multiple schemas. This allows for both logical grouping of related tables and the ability to perform queries across different domains when necessary.

The primary schemas are:

*   **`core`**: Contains entities common to all application modules, such as `User`, `Log`, and `AsyncJob`.
*   **`finance`**: Contains entities for the Finance app, such as `Account`, `Transaction`, and `Category`.
*   **`grounds`**: Contains entities for the Grounds app, including `Location`, `Planting`, and `CareSchedule`.
*   **`home`**: Contains entities for the Home app, such as `Property` and `Mortgage`.

The detailed structure of the entities within these schemas is defined in the `logical.md` document.
