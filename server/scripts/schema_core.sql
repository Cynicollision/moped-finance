-- Core Schema
-- Keep in sync with the Drizzle definitions in server/src/auth/user-data.ts and server/src/logging/log-data.ts
-- (checked by server/src/data/schema-parity.spec.ts).
CREATE SCHEMA IF NOT EXISTS core;

-- Users Table
CREATE TABLE IF NOT EXISTS core.users (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  username VARCHAR(255) NOT NULL CONSTRAINT users_username_unique UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL
);

-- Log Table
CREATE TABLE IF NOT EXISTS core.logs (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(50) NOT NULL,
  level VARCHAR(50) NOT NULL,
  context VARCHAR(255) NOT NULL,
  message TEXT NOT NULL
);
