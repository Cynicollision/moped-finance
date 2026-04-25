-- Grounds Schema
CREATE SCHEMA IF NOT EXISTS grounds;

-- Locations
CREATE TABLE IF NOT EXISTS grounds.locations (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(50) NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL
);

-- Plant Varieties
CREATE TABLE IF NOT EXISTS grounds.plant_varieties (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(50) NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  common_name VARCHAR(100) NOT NULL,
  variety_name VARCHAR(100),
  brand_name VARCHAR(100),
  description TEXT,
  fertilizer_notes TEXT,
  pruning_notes TEXT,
  soil_notes TEXT,
  sunlight_notes TEXT,
  watering_notes TEXT
);

-- Plants
CREATE TABLE IF NOT EXISTS grounds.plants (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(50) NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  variety_id VARCHAR(50) REFERENCES grounds.plant_varieties(id) ON DELETE SET NULL,
  location_id VARCHAR(50) REFERENCES grounds.locations(id) ON DELETE SET NULL,
  planted_date DATE
);

-- Products
CREATE TABLE IF NOT EXISTS grounds.products (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(50) NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(100),
  care_task_type VARCHAR(50) NOT NULL,
  purpose_description TEXT,
  url TEXT
);

-- Care Tasks
CREATE TABLE IF NOT EXISTS grounds.care_tasks (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(50) NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  product_id VARCHAR(50) REFERENCES grounds.products(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  year VARCHAR(4),
  target_month VARCHAR(20),
  target_week INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  completed_date DATE,
  notes TEXT,
  is_annual_task BOOLEAN DEFAULT FALSE
);
