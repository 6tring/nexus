import pg from 'pg';
import { validateTarget } from '../utils/validation.js';
import dotenv from 'dotenv';

dotenv.config();

// Get pool from server context (we'll pass this in)
let pool;

export function setPool(dbPool) {
  pool = dbPool;
}

// Original function - now with soft delete support and audit columns
export async function getMappings(req, res) {
  try {
    const { domain, search, status, page = 1, limit = 100, dataSource } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT 
      id, client_id, source, target, domain, status, data_source, 
      created_at, updated_at, created_by, updated_by, import_batch_id
      FROM mappings 
      WHERE deleted_at IS NULL`; // Added soft delete filter
    
    const params = [];
    let paramCount = 0;

    // Add client_id filter (always filter by client)
    query += ` AND client_id = $${++paramCount}`;
    params.push(process.env.CLIENT_ID || 'default');

    // Add data source filter if provided and not 'all'
    if (dataSource && dataSource !== 'all') {
      query += ` AND data_source = $${++paramCount}`;
      params.push(dataSource);
    }

    if (domain && domain !== 'all') {
      query += ` AND domain = $${++paramCount}`;
      params.push(domain);
    }

    if (search) {
      query += ` AND (source ILIKE $${++paramCount} OR target ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (status) {
      query += ` AND status = $${++paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY domain, source LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

// Original function - now with session context for audit logging
export async function createMapping(req, res) {
  const client = await pool.connect();
  
  try {
    const { source, target, domain, status = 'active', data_source = 'manual', changeReason } = req.body;
    
    // Validate required fields
    if (!source || !domain) {
      return res.status(400).json({ error: 'Source and domain are required' });
    }
    
    // Validate the target format if provided
    if (target && target.trim() !== '') {
      const validation = validateTarget(target, domain);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Set session context for audit logging if available
    if (req.setDbSessionContext) {
      await req.setDbSessionContext(client, { changeReason });
    }
    
    // Check for duplicates (excluding soft-deleted)
    const duplicateCheck = await client.query(
      'SELECT id FROM mappings WHERE client_id = $1 AND source = $2 AND domain = $3 AND deleted_at IS NULL',
      [process.env.CLIENT_ID || 'default', source, domain]
    );
    
    if (duplicateCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Mapping already exists for this source and domain combination' });
    }
    
    // Insert new mapping with data_source and audit fields
    const insertQuery = `
      INSERT INTO mappings (
        client_id, source, target, domain, status, data_source, 
        created_at, updated_at, created_by, updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
        current_session_id(), current_session_id()
      )
      RETURNING *
    `;
    
    const result = await client.query(insertQuery, [
      process.env.CLIENT_ID || 'default',
      source,
      target || null,
      domain,
      status,
      data_source
    ]);
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  } finally {
    client.release();
  }
}

// Original function - now with session context for audit logging
export async function updateMapping(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { target, changeReason } = req.body;
    
    // Start transaction
    await client.query('BEGIN');
    
    // Set session context for audit logging if available
    if (req.setDbSessionContext) {
      await req.setDbSessionContext(client, { changeReason });
    }
    
    // Get the current mapping to find its domain (excluding soft-deleted)
    const currentMapping = await client.query(
      'SELECT domain, data_source FROM mappings WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL',
      [id, process.env.CLIENT_ID || 'default']
    );
    
    if (currentMapping.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    const domain = currentMapping.rows[0].domain;
    
    // Validate the target format if a target is provided
    if (target && target.trim() !== '') {
      const validation = validateTarget(target, domain);
      if (!validation.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: validation.error });
      }
    }
    
    // Update the mapping with audit fields
    const query = `
      UPDATE mappings 
      SET 
        target = $1, 
        updated_at = CURRENT_TIMESTAMP,
        updated_by = current_session_id()
      WHERE id = $2 AND client_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await client.query(query, [target, id, process.env.CLIENT_ID || 'default']);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Mapping not found or unauthorized' });
    }
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating mapping:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  } finally {
    client.release();
  }
}

// Original function - now with session context for audit logging
export async function bulkUpdate(req, res) {
  const client = await pool.connect();
  
  try {
    const { ids, target, changeReason } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Set session context for audit logging if available
    if (req.setDbSessionContext) {
      await req.setDbSessionContext(client, { 
        changeReason: changeReason || `Bulk update of ${ids.length} mappings` 
      });
    }
    
    // If target is provided and not empty, validate it
    if (target && target.trim() !== '') {
      // Get domains for all selected mappings to validate (excluding soft-deleted)
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const domainQuery = `
        SELECT DISTINCT domain 
        FROM mappings 
        WHERE client_id = $1 AND id IN (${placeholders}) AND deleted_at IS NULL
      `;
      
      const domainResult = await client.query(domainQuery, [process.env.CLIENT_ID || 'default', ...ids]);
      
      // Validate target against each domain
      for (const row of domainResult.rows) {
        const validation = validateTarget(target, row.domain);
        if (!validation.valid) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: `Invalid target format for domain '${row.domain}': ${validation.error}` 
          });
        }
      }
    }
    
    // Perform the update with audit fields
    const updatePlaceholders = ids.map((_, i) => `$${i + 3}`).join(',');
    const updateQuery = `
      UPDATE mappings 
      SET 
        target = $1, 
        updated_at = CURRENT_TIMESTAMP,
        updated_by = current_session_id()
      WHERE client_id = $2 AND id IN (${updatePlaceholders}) AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [target, process.env.CLIENT_ID || 'default', ...ids]);
    
    // Commit transaction
    await client.query('COMMIT');
    
    res.json({ 
      message: 'Bulk update successful',
      updated: result.rowCount, 
      mappings: result.rows 
    });
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error bulk updating mappings:', error);
    res.status(500).json({ error: 'Failed to bulk update mappings' });
  } finally {
    client.release();
  }
}

// Original function - modified to soft delete by default
export async function deleteMapping(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { permanent, changeReason } = req.query;
    
    // Start transaction
    await client.query('BEGIN');
    
    // Set session context for audit logging if available
    if (req.setDbSessionContext) {
      await req.setDbSessionContext(client, { 
        changeReason: changeReason || 'User deletion' 
      });
    }
    
    let result;
    
    if (permanent === 'true') {
      // Permanent delete (original behavior)
      const deleteQuery = 'DELETE FROM mappings WHERE id = $1 AND client_id = $2 RETURNING id';
      result = await client.query(deleteQuery, [id, process.env.CLIENT_ID || 'default']);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Mapping not found or unauthorized' });
      }
      
      await client.query('COMMIT');
      res.json({ message: 'Mapping deleted successfully', id: result.rows[0].id });
      
    } else {
      // Soft delete (new default behavior)
      const softDeleteQuery = `
        UPDATE mappings 
        SET 
          deleted_at = CURRENT_TIMESTAMP,
          deleted_by = current_session_id(),
          status = 'inactive',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = current_session_id()
        WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL
        RETURNING id
      `;
      
      result = await client.query(softDeleteQuery, [id, process.env.CLIENT_ID || 'default']);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Mapping not found, unauthorized, or already deleted' });
      }
      
      await client.query('COMMIT');
      res.json({ 
        message: 'Mapping deleted successfully', 
        id: result.rows[0].id,
        softDeleted: true 
      });
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  } finally {
    client.release();
  }
}

// NEW FUNCTION: Restore a soft-deleted mapping
export async function restoreMapping(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    // Start transaction
    await client.query('BEGIN');
    
    // Set session context for audit logging if available
    if (req.setDbSessionContext) {
      await req.setDbSessionContext(client, { 
        changeReason: 'Restore deleted mapping' 
      });
    }
    
    const restoreQuery = `
      UPDATE mappings 
      SET 
        deleted_at = NULL,
        deleted_by = NULL,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP,
        updated_by = current_session_id()
      WHERE id = $1 AND client_id = $2 AND deleted_at IS NOT NULL
      RETURNING *
    `;
    
    const result = await client.query(restoreQuery, [id, process.env.CLIENT_ID || 'default']);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Mapping not found, unauthorized, or not deleted' });
    }
    
    await client.query('COMMIT');
    res.json({ 
      message: 'Mapping restored successfully', 
      mapping: result.rows[0] 
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring mapping:', error);
    res.status(500).json({ error: 'Failed to restore mapping' });
  } finally {
    client.release();
  }
}

// NEW FUNCTION: Get mapping history from audit log
export async function getMappingHistory(req, res) {
  try {
    const { id } = req.params;
    
    // Verify the mapping belongs to this client
    const mappingCheck = await pool.query(
      'SELECT id FROM mappings WHERE id = $1 AND client_id = $2',
      [id, process.env.CLIENT_ID || 'default']
    );
    
    if (mappingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found or unauthorized' });
    }
    
    // Use the database function to get history
    const result = await pool.query(
      'SELECT * FROM get_mapping_history($1) ORDER BY created_at DESC',
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching mapping history:', error);
    res.status(500).json({ error: 'Failed to fetch mapping history' });
  }
}

// NEW FUNCTION: Get deleted mappings (for recovery interface)
export async function getDeletedMappings(req, res) {
  try {
    const { domain, search, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT 
      id, client_id, source, target, domain, status, data_source, 
      created_at, updated_at, deleted_at, deleted_by
      FROM mappings 
      WHERE deleted_at IS NOT NULL`;
    
    const params = [];
    let paramCount = 0;

    // Add client_id filter
    query += ` AND client_id = $${++paramCount}`;
    params.push(process.env.CLIENT_ID || 'default');

    if (domain && domain !== 'all') {
      query += ` AND domain = $${++paramCount}`;
      params.push(domain);
    }

    if (search) {
      query += ` AND (source ILIKE $${++paramCount} OR target ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY deleted_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deleted mappings:', error);
    res.status(500).json({ error: 'Failed to fetch deleted mappings' });
  }
}