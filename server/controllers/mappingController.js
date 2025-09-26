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
    const { domain, search, status, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM mappings WHERE 1=1';
    const params = [];
    let paramCount = 0;

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

    query += ` ORDER BY id LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function updateMapping(req, res) {
  try {
    const { id } = req.params;
    const { target } = req.body;
    
    // Get the current mapping to find its domain
    const currentMapping = await pool.query(
      'SELECT domain FROM mappings WHERE id = $1',
      [id]
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
    
    // Update the mapping
    const query = `
      UPDATE mappings 
      SET target = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `;
    
    const result = await pool.query(query, [target, id]);
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
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const domainQuery = `
        SELECT DISTINCT domain 
        FROM mappings 
        WHERE id IN (${placeholders})
      `;
      
      const domainResult = await pool.query(domainQuery, ids);
      
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
    
    // Perform the update
    const updatePlaceholders = ids.map((_, i) => `$${i + 2}`).join(',');
    const updateQuery = `
      UPDATE mappings 
      SET target = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id IN (${updatePlaceholders})
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [target, ...ids]);
    res.json({ updated: result.rowCount, mappings: result.rows });
  } catch (error) {
    console.error('Error bulk updating mappings:', error);
    res.status(500).json({ error: 'Failed to bulk update mappings' });
  }
}