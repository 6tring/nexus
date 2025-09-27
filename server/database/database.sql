-- Database setup for Data Mapping Manager
-- Complete schema with source tracking
-- Run with: psql -U postgres -d your_database_name -f database.sql

-- Drop existing objects for clean setup
DROP VIEW IF EXISTS source_statistics CASCADE;
DROP TABLE IF EXISTS mappings CASCADE;
DROP TABLE IF EXISTS targets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create mappings table with all current columns
CREATE TABLE mappings (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(50) DEFAULT 'default',
  source VARCHAR(255) NOT NULL,  -- Entity/item name being mapped
  target VARCHAR(255),
  domain VARCHAR(50) NOT NULL CHECK (domain IN ('account', 'entity', 'product', 'department', 'location')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  data_source VARCHAR(255) DEFAULT 'manual',  -- Origin: manual, import_filename_timestamp, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create targets table
CREATE TABLE targets (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(50) DEFAULT 'default',
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(50) NOT NULL CHECK (domain IN ('account', 'entity', 'product', 'department', 'location')),
  UNIQUE(client_id, domain, code)
);

-- Create users table (for future authentication)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'editor'
);

-- Create all indexes
CREATE INDEX idx_mappings_client_domain ON mappings(client_id, domain);
CREATE INDEX idx_mappings_source ON mappings(source);
CREATE INDEX idx_mappings_target ON mappings(target);
CREATE INDEX idx_mappings_data_source ON mappings(data_source);
CREATE INDEX idx_targets_client_domain ON targets(client_id, domain);

-- Create source statistics view
CREATE VIEW source_statistics AS
SELECT 
    data_source,
    COUNT(*) as mapping_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM mappings
GROUP BY data_source
ORDER BY last_created DESC;

-- Insert sample targets (reference data)
INSERT INTO targets (client_id, code, name, domain) VALUES
  ('default', 'ACC001', 'Cash Account', 'account'),
  ('default', 'ACC002', 'Receivables Account', 'account'),
  ('default', 'ACC003', 'Payables Account', 'account'),
  ('default', 'ENT001', 'Corporate Entity', 'entity'),
  ('default', 'ENT002', 'Subsidiary A', 'entity'),
  ('default', 'PROD001', 'Product Line A', 'product'),
  ('default', 'PROD002', 'Product Line B', 'product'),
  ('default', 'DEPT001', 'Finance', 'department'),
  ('default', 'DEPT002', 'Operations', 'department'),
  ('default', 'LOC001', 'Headquarters', 'location'),
  ('default', 'LOC002', 'Branch Office', 'location');

-- Insert sample users
INSERT INTO users (email, role) VALUES
  ('admin@example.com', 'admin'),
  ('editor@example.com', 'editor');

-- Note: Not inserting sample mappings - let user import or create their own

-- Display setup summary
SELECT 'Database setup complete' as status;
SELECT 
  'Targets' as table_name, 
  COUNT(*) as record_count 
FROM targets
UNION ALL
SELECT 
  'Users' as table_name, 
  COUNT(*) as record_count 
FROM users;