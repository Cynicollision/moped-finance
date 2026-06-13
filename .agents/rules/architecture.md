# Architecture Rules

Define your specific architectural guidelines here. 

## Structure & Namespaces

- **`@shared`**: This namespace and folder (`/shared`) is strictly for types, enums, contracts, and utilities that can be used by *both* the client and server. This allows for using the exact same types on both sides of the app, ensuring consistency and improving compatibility between the Angular client app and the Node/Express server.

### Server Architecture
- **`@server-core`** (`server/src/core/`): This namespace contains foundational server-level concerns (e.g., database configuration, logging, authentication, common data access utilities, API handlers, and test utilities). It provides the building blocks for the domain models and remains independent of any specific business logic.
- **Finance Domain Models** (`server/src/finance/`): Contains the business logic, API routes, and data access layers for the Finance app. It is divided into feature-based sub-domains (e.g., `accounts`, `budget`, `categories`, `institutions`, `transactions`).

#### The Route -> Controller -> Data Access Pattern
Within each domain model (like `accounts`), the architecture strictly follows a layered pattern to separate concerns:
1. **Routes (`*-routes.ts`)**: The entry point for HTTP requests. It handles Express route definitions, parameter extraction, and delegates the actual processing to the controller.
2. **Controller (`*-controller.ts`)**: The core business logic layer. It receives data from the routes, enforces rules, and coordinates with the data access layer. It generally returns standardized operation results (e.g., `OperationResult`) rather than raw HTTP responses.
3. **Data Access (`*-data.ts`)**: The layer solely responsible for database interactions. It implements interfaces (e.g., `IFinanceAccountData` extending `IOwnedResourceData`) that provide CRUD operations.
4. **Schema (`*-schema.ts`)**: Defines the database tables, relationships, and validation schemas (e.g., Zod) that represent the actual Postgres schema.

## Data Fetching & ORM
- **Database**: PostgreSQL is the primary database.
- **ORM**: The server utilizes **Drizzle ORM** (`drizzle-orm/node-postgres`) for all database interactions.
- **Validation**: Schema definitions utilize Drizzle's pg-core along with `drizzle-zod` to automatically generate `zod` schemas for inserts and updates (e.g., `createInsertSchema`).
- **Data Access Layer Details**: The `*-data.ts` classes inject a `NodePgDatabase` instance to construct type-safe SQL queries, handle subqueries, and map Drizzle row results to the `@shared` application types.
