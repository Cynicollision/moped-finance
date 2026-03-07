-- Finance Schema
CREATE SCHEMA IF NOT EXISTS finance;

-- Finance Profiles
CREATE TABLE IF NOT EXISTS finance.profiles (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE IF NOT EXISTS finance.categories (
  id VARCHAR(50) PRIMARY KEY,
  profile_id VARCHAR(50) NOT NULL REFERENCES finance.profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  group_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Institutions
CREATE TABLE IF NOT EXISTS finance.institutions (
  id VARCHAR(50) PRIMARY KEY,
  profile_id VARCHAR(50) NOT NULL REFERENCES finance.profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Accounts
CREATE TABLE IF NOT EXISTS finance.accounts (
  id VARCHAR(50) PRIMARY KEY,
  profile_id VARCHAR(50) NOT NULL REFERENCES finance.profiles(id) ON DELETE CASCADE,
  institution_id VARCHAR(50) REFERENCES finance.institutions(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  subtype VARCHAR(50),
  is_hidden BOOLEAN DEFAULT FALSE,
  is_retirement BOOLEAN DEFAULT FALSE,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Balance History
CREATE TABLE IF NOT EXISTS finance.balance_history (
  id VARCHAR(50) PRIMARY KEY,
  account_id VARCHAR(50) NOT NULL REFERENCES finance.accounts(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE IF NOT EXISTS finance.transactions (
  id VARCHAR(50) PRIMARY KEY,
  account_id VARCHAR(50) NOT NULL REFERENCES finance.accounts(id) ON DELETE CASCADE,
  category_id VARCHAR(50) REFERENCES finance.categories(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  merchant VARCHAR(255),
  original_statement TEXT,
  notes TEXT,
  is_hidden BOOLEAN DEFAULT FALSE,
  is_split BOOLEAN DEFAULT FALSE,
  split_parent_id VARCHAR(50) REFERENCES finance.transactions(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);