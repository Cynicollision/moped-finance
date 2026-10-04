import { defineConfig } from 'drizzle-kit';

// drizzle-kit reads the Drizzle tables and writes SQL migrations to ./migrations (npm run db:generate).
// The server applies pending migrations on startup (DatabaseClient.migrate).
export default defineConfig({
    dialect: 'postgresql',
    schema: [
        './src/data/database-schemas.ts',
        './src/auth/*-data.ts',
        './src/logging/log-data.ts',
        './src/api/**/*-schema.ts'
    ],
    out: './migrations'
});
