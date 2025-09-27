-- Unified Database Schema for Data Mapping Manager with Audit Trail
-- Complete schema including audit logging, import history, and soft deletes
-- Run with: psql -U postgres -d your_database_name -f database.sql

-- =====================================================
-- CLEAN SLATE - DROP EXISTING OBJECTS
-- =====================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS import_batch_summary CASCADE;
DROP VIEW IF EXISTS active_mappings CASCADE;
DROP VIEW IF EXISTS source_statistics CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_mapping_history CASCADE;
DROP FUNCTION IF EXISTS rollback_mapping CASCADE;
DROP FUNCTION IF EXISTS soft_delete_mapping CASCADE;
DROP FUNCTION IF EXISTS restore_mapping CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_audit_logs CASCADE;
DROP FUNCTION IF EXISTS audit_trigger_function CASCADE;
DROP FUNCTION IF EXISTS current_session_id CASCADE;
DROP FUNCTION IF EXISTS current_ip_address CASCADE;
DROP FUNCTION IF EXISTS current_change_reason CASCADE;
DROP FUNCTION IF EXISTS current_import_batch_id CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS audit_mappings_trigger ON mappings;

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS import_batch_mappings CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS mappings CASCADE;
DROP TABLE IF EXISTS import_batches CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS targets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- SESSION AND AUDIT INFRASTRUCTURE
-- =====================================================

-- Session tracking table (since we don't have auth yet)
CREATE TABLE user_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import batch history table (created before mappings since mappings references it)
CREATE TABLE import_batches (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    file_size INTEGER,
    total_rows INTEGER,
    imported_rows INTEGER,
    skipped_rows INTEGER,
    duplicate_rows INTEGER,
    error_rows INTEGER,
    import_details JSONB, -- Detailed info about what was imported
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rolled_back')),
    deleted_at TIMESTAMP, -- For soft delete
    deleted_by VARCHAR(100), -- Session that deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE SET NULL
);

-- =====================================================
-- CORE BUSINESS TABLES
-- =====================================================

-- Users table (for future authentication)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'editor'
);

-- Targets table (reference data)
CREATE TABLE targets (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(50) DEFAULT 'default',
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(50) NOT NULL CHECK (domain IN ('account', 'entity', 'product', 'department', 'location')),
    UNIQUE(client_id, domain, code)
);

-- Main mappings table with audit columns
CREATE TABLE mappings (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(50) DEFAULT 'default',
    source VARCHAR(255) NOT NULL,  -- Entity/item name being mapped
    target VARCHAR(255),
    domain VARCHAR(50) NOT NULL CHECK (domain IN ('account', 'entity', 'product', 'department', 'location')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    data_source VARCHAR(255) DEFAULT 'manual',  -- Origin: manual, import_filename_timestamp, etc.
    
    -- Audit columns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),  -- Session ID that created
    updated_by VARCHAR(100),  -- Session ID that last updated
    deleted_at TIMESTAMP,     -- Soft delete timestamp
    deleted_by VARCHAR(100),  -- Session that deleted
    import_batch_id INTEGER REFERENCES import_batches(id) ON DELETE SET NULL
);

-- =====================================================
-- AUDIT TABLES
-- =====================================================

-- Main audit log table for all changes
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[], -- Array of field names that changed
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    change_reason TEXT, -- Optional reason for change
    import_batch_id INTEGER, -- Link to import batch if applicable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE SET NULL,
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL
);

-- Link between import batches and created/updated mappings
CREATE TABLE import_batch_mappings (
    id SERIAL PRIMARY KEY,
    import_batch_id INTEGER NOT NULL,
    mapping_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('created', 'updated', 'skipped')),
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (mapping_id) REFERENCES mappings(id) ON DELETE CASCADE,
    UNIQUE(import_batch_id, mapping_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Mappings indexes
CREATE INDEX idx_mappings_client_domain ON mappings(client_id, domain);
CREATE INDEX idx_mappings_source ON mappings(source);
CREATE INDEX idx_mappings_target ON mappings(target);
CREATE INDEX idx_mappings_data_source ON mappings(data_source);
CREATE INDEX idx_mappings_deleted ON mappings(deleted_at);
CREATE INDEX idx_mappings_import_batch ON mappings(import_batch_id);

-- Targets indexes
CREATE INDEX idx_targets_client_domain ON targets(client_id, domain);

-- Audit log indexes
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_session ON audit_log(session_id);
CREATE INDEX idx_audit_log_import_batch ON audit_log(import_batch_id);

-- Import batch indexes
CREATE INDEX idx_import_batches_status ON import_batches(status);
CREATE INDEX idx_import_batches_deleted ON import_batches(deleted_at);

-- Import batch mappings indexes
CREATE INDEX idx_import_batch_mappings_batch ON import_batch_mappings(import_batch_id);
CREATE INDEX idx_import_batch_mappings_mapping ON import_batch_mappings(mapping_id);

-- =====================================================
-- AUDIT TRIGGER FUNCTIONS
-- =====================================================

-- Function to get current session ID (will be set by application)
CREATE OR REPLACE FUNCTION current_session_id() RETURNS VARCHAR(100) AS $$
BEGIN
    RETURN current_setting('app.session_id', true);
END;
$$ LANGUAGE plpgsql;

-- Function to get current IP address (will be set by application)
CREATE OR REPLACE FUNCTION current_ip_address() RETURNS VARCHAR(45) AS $$
BEGIN
    RETURN current_setting('app.ip_address', true);
END;
$$ LANGUAGE plpgsql;

-- Function to get current change reason (optional, set by application)
CREATE OR REPLACE FUNCTION current_change_reason() RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.change_reason', true);
END;
$$ LANGUAGE plpgsql;

-- Function to get current import batch ID (set during imports)
CREATE OR REPLACE FUNCTION current_import_batch_id() RETURNS INTEGER AS $$
DECLARE
    batch_id TEXT;
BEGIN
    batch_id := current_setting('app.import_batch_id', true);
    IF batch_id IS NULL OR batch_id = '' THEN
        RETURN NULL;
    END IF;
    RETURN batch_id::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Main audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
    old_values JSONB;
    new_values JSONB;
    changed_fields TEXT[];
    field_name TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Determine the action and set values accordingly
    IF TG_OP = 'DELETE' THEN
        old_values := to_jsonb(OLD);
        new_values := NULL;
        
        -- Record in audit log
        INSERT INTO audit_log (
            table_name, 
            record_id, 
            action, 
            old_values, 
            new_values,
            session_id,
            ip_address,
            change_reason,
            import_batch_id
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            TG_OP,
            old_values,
            new_values,
            current_session_id(),
            current_ip_address(),
            current_change_reason(),
            current_import_batch_id()
        );
        
        RETURN OLD;
        
    ELSIF TG_OP = 'UPDATE' THEN
        old_values := to_jsonb(OLD);
        new_values := to_jsonb(NEW);
        
        -- Find changed fields
        changed_fields := ARRAY[]::TEXT[];
        FOR field_name IN SELECT jsonb_object_keys(old_values) LOOP
            old_val := old_values->>field_name;
            new_val := new_values->>field_name;
            IF old_val IS DISTINCT FROM new_val THEN
                changed_fields := array_append(changed_fields, field_name);
            END IF;
        END LOOP;
        
        -- Only log if there are actual changes
        IF array_length(changed_fields, 1) > 0 THEN
            INSERT INTO audit_log (
                table_name, 
                record_id, 
                action, 
                old_values, 
                new_values,
                changed_fields,
                session_id,
                ip_address,
                change_reason,
                import_batch_id
            ) VALUES (
                TG_TABLE_NAME,
                NEW.id,
                TG_OP,
                old_values,
                new_values,
                changed_fields,
                current_session_id(),
                current_ip_address(),
                current_change_reason(),
                current_import_batch_id()
            );
        END IF;
        
        -- Update the updated_by field if it exists
        IF TG_TABLE_NAME = 'mappings' THEN
            NEW.updated_by := current_session_id();
            NEW.updated_at := CURRENT_TIMESTAMP;
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'INSERT' THEN
        new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (
            table_name, 
            record_id, 
            action, 
            old_values, 
            new_values,
            session_id,
            ip_address,
            change_reason,
            import_batch_id
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            TG_OP,
            NULL,
            new_values,
            current_session_id(),
            current_ip_address(),
            current_change_reason(),
            current_import_batch_id()
        );
        
        -- Set the created_by field if it exists
        IF TG_TABLE_NAME = 'mappings' THEN
            NEW.created_by := current_session_id();
            NEW.import_batch_id := current_import_batch_id();
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Create audit trigger for mappings table
CREATE TRIGGER audit_mappings_trigger
AFTER INSERT OR UPDATE OR DELETE ON mappings
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get mapping history
CREATE OR REPLACE FUNCTION get_mapping_history(mapping_id INTEGER)
RETURNS TABLE (
    audit_id INTEGER,
    action VARCHAR,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    session_id VARCHAR,
    ip_address VARCHAR,
    change_reason TEXT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id as audit_id,
        audit_log.action,
        audit_log.old_values,
        audit_log.new_values,
        audit_log.changed_fields,
        audit_log.session_id,
        audit_log.ip_address,
        audit_log.change_reason,
        audit_log.created_at
    FROM audit_log
    WHERE table_name = 'mappings' 
    AND record_id = mapping_id
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback a specific mapping to a previous state
CREATE OR REPLACE FUNCTION rollback_mapping(mapping_id INTEGER, audit_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    audit_record RECORD;
    old_data JSONB;
BEGIN
    -- Get the audit record
    SELECT * INTO audit_record 
    FROM audit_log 
    WHERE id = audit_id 
    AND table_name = 'mappings' 
    AND record_id = mapping_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get the old values to restore
    old_data := audit_record.old_values;
    
    IF old_data IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Set the change reason for the rollback
    PERFORM set_config('app.change_reason', 
        'Rollback to audit #' || audit_id, false);
    
    -- Update the mapping with old values
    UPDATE mappings SET
        source = (old_data->>'source')::VARCHAR,
        target = (old_data->>'target')::VARCHAR,
        domain = (old_data->>'domain')::VARCHAR,
        status = (old_data->>'status')::VARCHAR,
        data_source = (old_data->>'data_source')::VARCHAR
    WHERE id = mapping_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to soft delete mappings
CREATE OR REPLACE FUNCTION soft_delete_mapping(mapping_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE mappings 
    SET 
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = current_session_id(),
        status = 'inactive'
    WHERE id = mapping_id 
    AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to restore soft-deleted mappings
CREATE OR REPLACE FUNCTION restore_mapping(mapping_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE mappings 
    SET 
        deleted_at = NULL,
        deleted_by = NULL,
        status = 'active'
    WHERE id = mapping_id 
    AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback entire import batch
CREATE OR REPLACE FUNCTION rollback_import_batch(batch_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Soft delete all mappings from this import batch
    UPDATE mappings 
    SET 
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = current_session_id(),
        status = 'inactive'
    WHERE import_batch_id = batch_id 
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Update import batch status
    UPDATE import_batches 
    SET 
        status = 'rolled_back',
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = current_session_id()
    WHERE id = batch_id;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 180)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean up old sessions
    DELETE FROM user_sessions 
    WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR EASIER QUERYING
-- =====================================================

-- View for active mappings (not soft-deleted)
CREATE OR REPLACE VIEW active_mappings AS
SELECT * FROM mappings 
WHERE deleted_at IS NULL;

-- View for source statistics (updated to exclude soft-deleted)
CREATE OR REPLACE VIEW source_statistics AS
SELECT 
    data_source,
    COUNT(*) as mapping_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM mappings
WHERE deleted_at IS NULL
GROUP BY data_source
ORDER BY last_created DESC;

-- View for import batch summary
CREATE OR REPLACE VIEW import_batch_summary AS
SELECT 
    ib.*,
    COUNT(ibm.id) as total_mappings,
    COUNT(CASE WHEN ibm.action = 'created' THEN 1 END) as created_count,
    COUNT(CASE WHEN ibm.action = 'updated' THEN 1 END) as updated_count,
    COUNT(CASE WHEN ibm.action = 'skipped' THEN 1 END) as skipped_count
FROM import_batches ib
LEFT JOIN import_batch_mappings ibm ON ib.id = ibm.import_batch_id
WHERE ib.deleted_at IS NULL
GROUP BY ib.id;

-- =====================================================
-- INITIAL DATA
-- =====================================================

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
    ('data_mapping_manager_app_admin', 'admin');

-- =====================================================
-- SETUP SUMMARY
-- =====================================================

SELECT 'Database setup complete with audit trail' as status;

-- Display table counts
SELECT 
    'Tables Created' as category,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Display created objects summary
WITH object_counts AS (
    SELECT 'Tables' as object_type, COUNT(*) as count
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    UNION ALL
    SELECT 'Views' as object_type, COUNT(*) as count
    FROM information_schema.views 
    WHERE table_schema = 'public'
    UNION ALL
    SELECT 'Functions' as object_type, COUNT(*) as count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    UNION ALL
    SELECT 'Triggers' as object_type, COUNT(*) as count
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
)
SELECT * FROM object_counts ORDER BY object_type;

-- Show sample data counts
SELECT 
    'Targets' as table_name, 
    COUNT(*) as sample_records 
FROM targets
UNION ALL
SELECT 
    'Users' as table_name, 
    COUNT(*) as sample_records 
FROM users
ORDER BY table_name;