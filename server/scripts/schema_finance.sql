-- Finance Schema
-- Keep in sync with the Drizzle definitions in server/src/api/**/*-schema.ts
-- (checked by server/src/data/schema-parity.spec.ts).
-- `date` columns are calendar dates with no time zone; timestamps are TIMESTAMPTZ.
CREATE SCHEMA IF NOT EXISTS finance;

-- Category Groups
CREATE TABLE IF NOT EXISTS finance.category_groups (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category_class VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  CONSTRAINT category_groups_category_class_check CHECK (category_class IN ('income', 'expense', 'transfer'))
);

CREATE UNIQUE INDEX IF NOT EXISTS category_groups_name_unique_idx ON finance.category_groups (lower(name));

-- Categories
CREATE TABLE IF NOT EXISTS finance.categories (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  group_id VARCHAR(50) NOT NULL CONSTRAINT categories_group_id_category_groups_id_fk REFERENCES finance.category_groups(id) ON DELETE RESTRICT,
  icon VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_idx ON finance.categories (lower(name));
CREATE INDEX IF NOT EXISTS categories_group_id_idx ON finance.categories (group_id);

-- Institutions
CREATE TABLE IF NOT EXISTS finance.institutions (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name VARCHAR(100) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS institutions_name_unique_idx ON finance.institutions (lower(name));

-- Accounts
CREATE TABLE IF NOT EXISTS finance.accounts (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  institution_id VARCHAR(50) NOT NULL CONSTRAINT accounts_institution_id_institutions_id_fk REFERENCES finance.institutions(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  account_category VARCHAR(50) NOT NULL,
  account_group VARCHAR(50) NOT NULL,
  account_type VARCHAR(50),
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_retirement BOOLEAN NOT NULL DEFAULT FALSE,
  hide_from_cashflow BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT accounts_account_category_check CHECK (account_category IN ('Asset', 'Liability')),
  CONSTRAINT accounts_account_group_check CHECK (account_group IN ('Cash', 'Credit Card', 'Investment', 'Real Estate', 'Loan')),
  CONSTRAINT accounts_account_type_check CHECK (account_type IN ('Brokerage', 'Checking', 'HSA', 'Primary Residence', '401k', 'IRA', 'Savings', 'Home Mortgage'))
);

CREATE INDEX IF NOT EXISTS accounts_institution_id_idx ON finance.accounts (institution_id);

-- Balance History
CREATE TABLE IF NOT EXISTS finance.balance_history (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  account_id VARCHAR(50) NOT NULL CONSTRAINT balance_history_account_id_accounts_id_fk REFERENCES finance.accounts(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  CONSTRAINT balance_history_account_id_date_unique UNIQUE (account_id, date)
);

CREATE INDEX IF NOT EXISTS balance_history_date_idx ON finance.balance_history (date);

-- Transactions
CREATE TABLE IF NOT EXISTS finance.transactions (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  account_id VARCHAR(50) NOT NULL CONSTRAINT transactions_account_id_accounts_id_fk REFERENCES finance.accounts(id) ON DELETE CASCADE,
  category_id VARCHAR(50) CONSTRAINT transactions_category_id_categories_id_fk REFERENCES finance.categories(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  merchant VARCHAR(255) NOT NULL,
  original_statement TEXT,
  notes TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  is_split BOOLEAN NOT NULL DEFAULT FALSE,
  split_parent_id VARCHAR(50) CONSTRAINT transactions_split_parent_id_transactions_id_fk REFERENCES finance.transactions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS transactions_date_idx ON finance.transactions (date);
CREATE INDEX IF NOT EXISTS transactions_account_id_date_idx ON finance.transactions (account_id, date);
CREATE INDEX IF NOT EXISTS transactions_category_id_idx ON finance.transactions (category_id);

-- Budget Streams
CREATE TABLE IF NOT EXISTS finance.budget_streams (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name VARCHAR(100) NOT NULL,
  category_id VARCHAR(50) CONSTRAINT budget_streams_category_id_categories_id_fk REFERENCES finance.categories(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  recurrence VARCHAR(50) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  CONSTRAINT budget_streams_type_check CHECK (type IN ('income', 'expense')),
  CONSTRAINT budget_streams_recurrence_check CHECK (recurrence IN ('Monthly', 'Quarterly', 'Yearly'))
);

CREATE INDEX IF NOT EXISTS budget_streams_category_id_idx ON finance.budget_streams (category_id);
