import pg from 'pg';
import { validateTarget } from '../utils/validation.js';
import dotenv from 'dotenv';

dotenv.config();

// Get pool from server context (we'll pass this in)
let pool;

export function setPool(dbPool) {
  pool = dbPool;
}

export async function getMappings(req, res) {
  try {
    const { domain, search, status, page = 1, limit = 100, dataSource } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, client_id, source, target, domain, status, data_source, created_at, updated_at FROM mappings WHERE 1=1';
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

export async function createMapping(req, res) {
  try {
    const { source, target, domain, status = 'active', data_source = 'manual' } = req.body;
    
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
    
    // Check for duplicates
    const duplicateCheck = await pool.query(
      'SELECT id FROM mappings WHERE client_id = $1 AND source = $2 AND domain = $3',
      [process.env.CLIENT_ID || 'default', source, domain]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Mapping already exists for this source and domain combination' });
    }
    
    // Insert new mapping with data_source
    const insertQuery = `
      INSERT INTO mappings (client_id, source, target, domain, status, data_source, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [
      process.env.CLIENT_ID || 'default',
      source,
      target || null,
      domain,
      status,
      data_source
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}

export async function updateMapping(req, res) {
  try {
    const { id } = req.params;
    const { target } = req.body;
    
    // Get the current mapping to find its domain
    const currentMapping = await pool.query(
      'SELECT domain, data_source FROM mappings WHERE id = $1 AND client_id = $2',
      [id, process.env.CLIENT_ID || 'default']
    );
    
    if (currentMapping.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    const domain = currentMapping.rows[0].domain;
    
    // Validate the target format if a target is provided
    if (target && target.trim() !== '') {
      const validation = validateTarget(target, domain);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }
    
    // Update the mapping (preserve data_source)
    const query = `
      UPDATE mappings 
      SET target = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 AND client_id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [target, id, process.env.CLIENT_ID || 'default']);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found or unauthorized' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating mapping:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
}

export async function bulkUpdate(req, res) {
  try {
    const { ids, target } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }
    
    // If target is provided and not empty, validate it
    if (target && target.trim() !== '') {
      // Get domains for all selected mappings to validate
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const domainQuery = `
        SELECT DISTINCT domain 
        FROM mappings 
        WHERE client_id = $1 AND id IN (${placeholders})
      `;
      
      const domainResult = await pool.query(domainQuery, [process.env.CLIENT_ID || 'default', ...ids]);
      
      // Validate target against each domain
      for (const row of domainResult.rows) {
        const validation = validateTarget(target, row.domain);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: `Invalid target format for domain '${row.domain}': ${validation.error}` 
          });
        }
      }
    }
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Perform the update (preserves data_source)
      const updatePlaceholders = ids.map((_, i) => `$${i + 3}`).join(',');
      const updateQuery = `
        UPDATE mappings 
        SET target = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE client_id = $2 AND id IN (${updatePlaceholders})
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [target, process.env.CLIENT_ID || 'default', ...ids]);
      
      // Commit transaction
      await pool.query('COMMIT');
      
      res.json({ 
        message: 'Bulk update successful',
        updated: result.rowCount, 
        mappings: result.rows 
      });
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error bulk updating mappings:', error);
    res.status(500).json({ error: 'Failed to bulk update mappings' });
  }
}

export async function deleteMapping(req, res) {
  try {
    const { id } = req.params;
    
    const deleteQuery = 'DELETE FROM mappings WHERE id = $1 AND client_id = $2 RETURNING id';
    const result = await pool.query(deleteQuery, [id, process.env.CLIENT_ID || 'default']);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found or unauthorized' });
    }
    
    res.json({ message: 'Mapping deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}