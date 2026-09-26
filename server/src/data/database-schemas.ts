import { pgSchema } from 'drizzle-orm/pg-core';

// Postgres schemas the tables live in. Exported so drizzle-kit includes CREATE SCHEMA in migrations.
export const coreSchema = pgSchema('core');
export const financeSchema = pgSchema('finance');
