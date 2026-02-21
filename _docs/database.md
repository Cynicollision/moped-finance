# Database Strategy

**Engine:** PostgreSQL 16
**Instance:** A single database instance is used for the entire application.

## Logical Separation via Schemas

To maintain clear separation of concerns between the different logical "apps" within the monolith, the database is organized into multiple schemas. This allows for both logical grouping of related tables and the ability to perform queries across different domains when necessary.

The primary schemas are:

*   **`core`**: Contains entities common to all application modules, such as `User`, `Log`, and `AsyncJob`.
*   **`finance`**: Contains entities for the Finance app, such as `Account`, `Transaction`, and `Category`.
*   **`grounds`**: Contains entities for the Grounds app, including `Location`, `Planting`, and `CareSchedule`.
*   **`home`**: Contains entities for the Home app, such as `Property` and `Mortgage`.

The detailed structure of the entities within these schemas is defined in the `logical.md` document.
