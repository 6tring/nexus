// auditController.js - Handles audit trail operations and history management
import dotenv from 'dotenv';

dotenv.config();

let pool;

export function setPool(dbPool) {
  pool = dbPool;
}

// Get complete audit log with optional filters
export async function getAuditLog(req, res) {
  try {
    const { 
      table_name, 
      record_id, 
      action, 
      session_id,
      start_date,
      end_date,
      limit = 100,
      offset = 0 
    } = req.query;
    
    let query = `
      SELECT 
        al.*,
        us.ip_address as session_ip,
        us.created_at as session_start
      FROM audit_log al
      LEFT JOIN user_sessions us ON al.session_id = us.session_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (table_name) {
      query += ` AND al.table_name = $${++paramCount}`;
      params.push(table_name);
    }
    
    if (record_id) {
      query += ` AND al.record_id = $${++paramCount}`;
      params.push(record_id);
    }
    
    if (action) {
      query += ` AND al.action = $${++paramCount}`;
      params.push(action);
    }
    
    if (session_id) {
      query += ` AND al.session_id = $${++paramCount}`;
      params.push(session_id);
    }
    
    if (start_date) {
      query += ` AND al.created_at >= $${++paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND al.created_at <= $${++paramCount}`;
      params.push(end_date);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM audit_log al
      WHERE 1=1
    `;
    
    const countParams = [];
    paramCount = 0;
    
    if (table_name) {
      countQuery += ` AND table_name = $${++paramCount}`;
      countParams.push(table_name);
    }
    
    if (record_id) {
      countQuery += ` AND record_id = $${++paramCount}`;
      countParams.push(record_id);
    }
    
    if (action) {
      countQuery += ` AND action = $${++paramCount}`;
      countParams.push(action);
    }
    
    if (session_id) {
      countQuery += ` AND session_id = $${++paramCount}`;
      countParams.push(session_id);
    }
    
    if (start_date) {
      countQuery += ` AND created_at >= $${++paramCount}`;
      countParams.push(start_date);
    }
    
    if (end_date) {
      countQuery += ` AND created_at <= $${++paramCount}`;
      countParams.push(end_date);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
}

// Get audit statistics
export async function getAuditStatistics(req, res) {
  try {
    const { days = 30 } = req.query;
    
    const statsQuery = `
      WITH date_range AS (
        SELECT CURRENT_TIMESTAMP - INTERVAL '1 day' * $1 as start_date
      )
      SELECT 
        -- Total changes
        COUNT(*) as total_changes,
        
        -- Changes by action
        COUNT(CASE WHEN action = 'INSERT' THEN 1 END) as inserts,
        COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) as updates,
        COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deletes,
        
        -- Changes by table
        COUNT(CASE WHEN table_name = 'mappings' THEN 1 END) as mapping_changes,
        
        -- Active sessions
        COUNT(DISTINCT session_id) as unique_sessions,
        
        -- Most active session
        MODE() WITHIN GROUP (ORDER BY session_id) as most_active_session,
        
        -- Date range
        MIN(created_at) as earliest_change,
        MAX(created_at) as latest_change
        
      FROM audit_log, date_range
      WHERE created_at >= date_range.start_date
    `;
    
    const result = await pool.query(statsQuery, [days]);
    
    // Get changes by day
    const dailyQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as changes,
        COUNT(DISTINCT session_id) as sessions
      FROM audit_log
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    
    const dailyResult = await pool.query(dailyQuery, [days]);
    
    res.json({
      summary: result.rows[0],
      daily: dailyResult.rows
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
}

// Rollback a specific change using audit log
export async function rollbackChange(req, res) {
  const { auditId } = req.params;
  const client = await pool.connect();
  
  try {
    // Get the audit record
    const auditQuery = `
      SELECT * FROM audit_log 
      WHERE id = $1
    `;
    const auditResult = await client.query(auditQuery, [auditId]);
    
    if (auditResult.rows.length === 0) {
      return res.status(404).json({ error: 'Audit record not found' });
    }
    
    const auditRecord = auditResult.rows[0];
    
    // Only allow rollback of UPDATE and DELETE operations
    if (auditRecord.action === 'INSERT') {
      return res.status(400).json({ 
        error: 'Cannot rollback INSERT operations. Use delete instead.' 
      });
    }
    
    await client.query('BEGIN');
    
    // Set session context for the rollback operation
    if (req.setDbSessionContext) {
      await req.setDbSessionContext(client, {
        changeReason: `Rollback to audit #${auditId}`
      });
    }
    
    if (auditRecord.table_name === 'mappings') {
      if (auditRecord.action === 'DELETE') {
        // Restore deleted record
        const oldValues = auditRecord.old_values;
        
        // Check if record still exists
        const checkQuery = `
          SELECT id FROM mappings WHERE id = $1
        `;
        const checkResult = await client.query(checkQuery, [auditRecord.record_id]);
        
        if (checkResult.rows.length > 0) {
          return res.status(400).json({ 
            error: 'Record already exists. Cannot restore.' 
          });
        }
        
        // Build INSERT query from old values
        const insertQuery = `
          INSERT INTO mappings (
            id, client_id, source, target, domain, status, 
            data_source, created_at, updated_at, created_by, updated_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 
            $7, $8, CURRENT_TIMESTAMP, $9, current_session_id()
          )
          RETURNING *
        `;
        
        const values = [
          oldValues.id,
          oldValues.client_id || process.env.CLIENT_ID || 'default',
          oldValues.source,
          oldValues.target,
          oldValues.domain,
          oldValues.status || 'active',
          oldValues.data_source || 'manual',
          oldValues.created_at,
          oldValues.created_by
        ];
        
        const result = await client.query(insertQuery, values);
        
        await client.query('COMMIT');
        
        res.json({
          message: 'Record restored successfully',
          action: 'RESTORE',
          record: result.rows[0]
        });
        
      } else if (auditRecord.action === 'UPDATE') {
        // Rollback to previous values
        const oldValues = auditRecord.old_values;
        
        const updateQuery = `
          UPDATE mappings 
          SET 
            source = $1,
            target = $2,
            domain = $3,
            status = $4,
            data_source = $5,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = current_session_id()
          WHERE id = $6
          RETURNING *
        `;
        
        const values = [
          oldValues.source,
          oldValues.target,
          oldValues.domain,
          oldValues.status,
          oldValues.data_source,
          auditRecord.record_id
        ];
        
        const result = await client.query(updateQuery, values);
        
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ 
            error: 'Record not found. May have been deleted.' 
          });
        }
        
        await client.query('COMMIT');
        
        res.json({
          message: 'Changes rolled back successfully',
          action: 'UPDATE',
          record: result.rows[0]
        });
      }
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Rollback not implemented for table: ${auditRecord.table_name}` 
      });
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rolling back change:', error);
    res.status(500).json({ error: 'Failed to rollback change' });
  } finally {
    client.release();
  }
}

// Get session information
export async function getSessionInfo(req, res) {
  try {
    const { sessionId } = req.params;
    
    // Get session details
    const sessionQuery = `
      SELECT * FROM user_sessions 
      WHERE session_id = $1
    `;
    const sessionResult = await pool.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get all changes made in this session
    const changesQuery = `
      SELECT 
        al.*,
        CASE 
          WHEN al.table_name = 'mappings' THEN m.source
          ELSE NULL
        END as record_name
      FROM audit_log al
      LEFT JOIN mappings m ON al.table_name = 'mappings' AND al.record_id = m.id
      WHERE al.session_id = $1
      ORDER BY al.created_at DESC
    `;
    const changesResult = await pool.query(changesQuery, [sessionId]);
    
    res.json({
      session: sessionResult.rows[0],
      changes: changesResult.rows,
      changeCount: changesResult.rows.length
    });
  } catch (error) {
    console.error('Error fetching session info:', error);
    res.status(500).json({ error: 'Failed to fetch session information' });
  }
}

// Clean up old audit logs (admin function)
export async function cleanupAuditLogs(req, res) {
  try {
    const { retentionDays = 180 } = req.body;
    
    // Validate retention days
    if (retentionDays < 30) {
      return res.status(400).json({ 
        error: 'Retention period must be at least 30 days' 
      });
    }
    
    // Call the cleanup function
    const result = await pool.query(
      'SELECT cleanup_old_audit_logs($1) as deleted_count',
      [retentionDays]
    );
    
    res.json({
      message: 'Audit logs cleaned up successfully',
      deletedCount: result.rows[0].deleted_count,
      retentionDays: retentionDays
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({ error: 'Failed to cleanup audit logs' });
  }
}

// Get timeline view of all system changes
export async function getTimeline(req, res) {
  try {
    const { 
      start_date,
      end_date,
      limit = 50,
      offset = 0 
    } = req.query;
    
    let query = `
      SELECT 
        al.id,
        al.table_name,
        al.record_id,
        al.action,
        al.changed_fields,
        al.change_reason,
        al.created_at,
        al.session_id,
        al.ip_address,
        us.user_agent,
        CASE 
          WHEN al.table_name = 'mappings' THEN 
            COALESCE(
              (al.new_values->>'source')::text,
              (al.old_values->>'source')::text
            )
          ELSE NULL
        END as record_display_name,
        CASE 
          WHEN al.table_name = 'mappings' THEN 
            (al.new_values->>'domain')::text
          ELSE NULL
        END as record_domain
      FROM audit_log al
      LEFT JOIN user_sessions us ON al.session_id = us.session_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (start_date) {
      query += ` AND al.created_at >= $${++paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND al.created_at <= $${++paramCount}`;
      params.push(end_date);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Format timeline entries
    const timeline = result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      type: row.action.toLowerCase(),
      table: row.table_name,
      recordId: row.record_id,
      recordName: row.record_display_name || `${row.table_name} #${row.record_id}`,
      domain: row.record_domain,
      changedFields: row.changed_fields,
      changeReason: row.change_reason,
      session: {
        id: row.session_id,
        ip: row.ip_address,
        userAgent: row.user_agent
      }
    }));
    
    res.json({
      timeline: timeline,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
}