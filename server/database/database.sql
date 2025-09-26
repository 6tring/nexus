-- Database setup for Data Mapping Manager Lite
-- Run this file with: psql -U postgres -d mapping_manager_lite -f database.sql

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS mappings CASCADE;
DROP TABLE IF EXISTS targets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create mappings table
CREATE TABLE mappings (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(50) DEFAULT 'default',
  source VARCHAR(255) NOT NULL,
  target VARCHAR(255),
  domain VARCHAR(50) NOT NULL CHECK (domain IN ('account', 'entity', 'product', 'department', 'location')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
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

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'editor'
);

-- Create indexes for better performance
CREATE INDEX idx_mappings_client_domain ON mappings(client_id, domain);
CREATE INDEX idx_mappings_source ON mappings(source);
CREATE INDEX idx_mappings_target ON mappings(target);
CREATE INDEX idx_targets_client_domain ON targets(client_id, domain);

-- Insert sample data for testing
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

-- Insert sample mappings
INSERT INTO mappings (client_id, source, target, domain, status) VALUES
  ('default', 'Cash on Hand', 'ACC001', 'account', 'active'),
  ('default', 'Bank Balance', 'ACC001', 'account', 'active'),
  ('default', 'Customer Receivables', 'ACC002', 'account', 'active'),
  ('default', 'Vendor Payables', 'ACC003', 'account', 'active'),
  ('default', 'Main Company', 'ENT001', 'entity', 'active'),
  ('default', 'Sub Company A', 'ENT002', 'entity', 'active'),
  ('default', 'Widget Product', 'PROD001', 'product', 'active'),
  ('default', 'Gadget Product', 'PROD002', 'product', 'active'),
  ('default', 'Finance Dept', 'DEPT001', 'department', 'active'),
  ('default', 'Ops Department', 'DEPT002', 'department', 'active'),
  ('default', 'HQ Location', 'LOC001', 'location', 'active'),
  ('default', 'Branch 1', 'LOC002', 'location', 'active'),
  ('default', 'Unmapped Item 1', NULL, 'account', 'active'),
  ('default', 'Unmapped Item 2', NULL, 'entity', 'active'),
  ('default', 'Unmapped Item 3', NULL, 'product', 'active');

-- Insert a default user
INSERT INTO users (email, role) VALUES
  ('admin@example.com', 'admin'),
  ('editor@example.com', 'editor');

-- Display summary
SELECT 
  'Mappings' as table_name, 
  COUNT(*) as record_count 
FROM mappings
UNION ALL
SELECT 
  'Targets' as table_name, 
  COUNT(*) as record_count 
FROM targets
UNION ALL
SELECT 
  'Users' as table_name, 
  COUNT(*) as record_count 
FROM users;