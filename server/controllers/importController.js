import fs from 'fs/promises';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { validateTarget, checkDuplicate } from '../utils/validation.js';
import dotenv from 'dotenv';

dotenv.config();

let pool;

export function setPool(dbPool) {
  pool = dbPool;
}

export async function importCSV(req, res) {
  const client = await pool.connect();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Generate timestamp and include filename for this import batch
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .substring(0, 15); // Format: YYYYMMDD_HHMMSS
    
    // Get filename without extension
    const originalFilename = req.file.originalname || req.file.filename;
    const filenameWithoutExt = originalFilename.replace(/\.[^/.]+$/, "");
    const cleanFilename = filenameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Format: import_filename_YYYYMMDD_HHMMSS
    const dataSource = `import_${cleanFilename}_${timestamp}`;
    
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    const records = [];
    
    const parser = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    for await (const record of parser) {
      records.push(record);
    }
    
    await client.query('BEGIN');
    
    // Create import batch record if session context is available
    let importBatchId = null;
    if (req.setDbSessionContext) {
      // Set session context for audit logging
      await req.setDbSessionContext(client, {
        changeReason: `CSV import from ${originalFilename}`
      });
      
      // Create import batch record
      const batchResult = await client.query(`
        INSERT INTO import_batches (
          filename,
          file_size,
          total_rows,
          session_id,
          ip_address,
          status,
          created_at
        ) VALUES (
          $1, $2, $3, 
          current_session_id(), 
          current_ip_address(),
          'processing',
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `, [
        originalFilename,
        req.file.size || 0,
        records.length
      ]);
      
      importBatchId = batchResult.rows[0].id;
      
      // Set the import batch ID in session context
      await req.setDbSessionContext(client, {
        importBatchId: importBatchId,
        changeReason: `CSV import from ${originalFilename}`
      });
    }
    
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const errors = [];
    const duplicates = [];
    const importedMappingIds = [];
    
    for (const record of records) {
      const { source, target, domain, status = 'active' } = record;
      
      if (source && domain) {
        // Validate target format if provided
        if (target) {
          const validation = validateTarget(target, domain);
          if (!validation.valid) {
            errors.push(`Row ${records.indexOf(record) + 2}: ${validation.error} (source: ${source})`);
            skipped++;
            
            // Track skipped record in import batch
            if (importBatchId) {
              await client.query(`
                INSERT INTO import_batch_mappings (import_batch_id, mapping_id, action)
                SELECT $1, id, 'skipped'
                FROM mappings 
                WHERE client_id = $2 AND source = $3 AND domain = $4 AND deleted_at IS NULL
                LIMIT 1
              `, [importBatchId, process.env.CLIENT_ID || 'default', source, domain]);
            }
            continue;
          }
        }
        
        // Check for duplicate source/domain combination (excluding soft-deleted)
        const existingMapping = await client.query(
          'SELECT id FROM mappings WHERE client_id = $1 AND source = $2 AND domain = $3 AND deleted_at IS NULL',
          [process.env.CLIENT_ID || 'default', source, domain]
        );
        
        if (existingMapping.rows.length > 0) {
          // Update existing mapping if target is different
          const updateResult = await client.query(`
            UPDATE mappings 
            SET 
              target = $1,
              status = $2,
              data_source = $3,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = current_session_id(),
              import_batch_id = $4
            WHERE id = $5 AND (target IS DISTINCT FROM $1 OR status != $2)
            RETURNING id
          `, [
            target || null,
            status,
            dataSource,
            importBatchId,
            existingMapping.rows[0].id
          ]);
          
          if (updateResult.rows.length > 0) {
            updated++;
            importedMappingIds.push(updateResult.rows[0].id);
            
            // Track updated record in import batch
            if (importBatchId) {
              await client.query(`
                INSERT INTO import_batch_mappings (import_batch_id, mapping_id, action)
                VALUES ($1, $2, 'updated')
                ON CONFLICT (import_batch_id, mapping_id) DO UPDATE SET action = 'updated'
              `, [importBatchId, updateResult.rows[0].id]);
            }
          } else {
            duplicates.push(`${source} (${domain})`);
            skipped++;
            
            // Track skipped duplicate in import batch
            if (importBatchId) {
              await client.query(`
                INSERT INTO import_batch_mappings (import_batch_id, mapping_id, action)
                VALUES ($1, $2, 'skipped')
                ON CONFLICT (import_batch_id, mapping_id) DO UPDATE SET action = 'skipped'
              `, [importBatchId, existingMapping.rows[0].id]);
            }
          }
          continue;
        }
        
        // Insert new mapping with audit fields
        const insertQuery = `
          INSERT INTO mappings (
            client_id, source, target, domain, status, data_source, 
            created_at, updated_at, created_by, updated_by, import_batch_id
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, 
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
            current_session_id(), current_session_id(), $7
          )
          RETURNING id
        `;
        
        const result = await client.query(insertQuery, [
          process.env.CLIENT_ID || 'default',
          source,
          target || null,
          domain,
          status,
          dataSource,
          importBatchId
        ]);
        
        if (result.rowCount > 0) {
          imported++;
          importedMappingIds.push(result.rows[0].id);
          
          // Track created record in import batch
          if (importBatchId) {
            await client.query(`
              INSERT INTO import_batch_mappings (import_batch_id, mapping_id, action)
              VALUES ($1, $2, 'created')
            `, [importBatchId, result.rows[0].id]);
          }
        }
      } else {
        skipped++;
        errors.push(`Row ${records.indexOf(record) + 2}: Missing required fields (source or domain)`);
      }
    }
    
    // Update import batch record with final stats
    if (importBatchId) {
      const importDetails = {
        filename: originalFilename,
        dataSource: dataSource,
        errors: errors.slice(0, 100),  // Store first 100 errors
        duplicates: duplicates.slice(0, 100),  // Store first 100 duplicates
        timestamp: now.toISOString()
      };
      
      await client.query(`
        UPDATE import_batches 
        SET 
          imported_rows = $1,
          skipped_rows = $2,
          duplicate_rows = $3,
          error_rows = $4,
          import_details = $5,
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        imported,
        skipped,
        duplicates.length,
        errors.length - duplicates.length,
        JSON.stringify(importDetails),
        importBatchId
      ]);
    }
    
    await client.query('COMMIT');
    
    // Clean up uploaded file
    await fs.unlink(req.file.path);
    
    res.json({ 
      message: 'Import completed', 
      imported, 
      updated,  // Add updated count to response
      skipped,
      total: records.length,
      dataSource: dataSource,
      importBatchId: importBatchId,  // Include batch ID for reference
      importDate: now.toISOString(),
      duplicates: duplicates.length > 0 ? duplicates.slice(0, 10) : undefined,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      hasMoreDuplicates: duplicates.length > 10,
      hasMoreErrors: errors.length > 10
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing CSV:', error);
    
    // Mark import batch as failed if it exists
    if (importBatchId) {
      try {
        await pool.query(`
          UPDATE import_batches 
          SET status = 'failed', completed_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [importBatchId]);
      } catch (updateError) {
        console.error('Error updating import batch status:', updateError);
      }
    }
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({ error: 'Failed to import CSV' });
  } finally {
    client.release();
  }
}

export async function exportCSV(req, res) {
  try {
    const { domain, dataSource } = req.query;
    
    // Updated query to exclude soft-deleted records
    let query = 'SELECT source, target, domain, status FROM mappings WHERE client_id = $1 AND deleted_at IS NULL';
    const params = [process.env.CLIENT_ID || 'default'];
    let paramCount = 1;
    
    // Add data source filter if provided
    if (dataSource && dataSource !== 'all') {
      query += ` AND data_source = $${++paramCount}`;
      params.push(dataSource);
    }
    
    if (domain && domain !== 'all') {
      query += ` AND domain = $${++paramCount}`;
      params.push(domain);
    }
    
    query += ' ORDER BY domain, source';
    
    const result = await pool.query(query, params);
    
    // Generate filename with context
    let filename = 'mappings_export';
    if (dataSource && dataSource !== 'all') {
      // Clean the source name for filename
      const cleanSource = dataSource.replace(/[^a-zA-Z0-9_-]/g, '_');
      filename += `_${cleanSource}`;
    }
    if (domain && domain !== 'all') {
      filename += `_${domain}`;
    }
    const exportDate = new Date().toISOString().substring(0, 10);
    filename += `_${exportDate}.csv`;
    
    const csv = await new Promise((resolve, reject) => {
      stringify(result.rows, {
        header: true,
        columns: ['source', 'target', 'domain', 'status']
      }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting mappings:', error);
    res.status(500).json({ error: 'Failed to export mappings' });
  }
}

// NEW FUNCTION: Get import batch history
export async function getImportHistory(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        ib.*,
        COUNT(DISTINCT ibm.mapping_id) as total_mappings,
        COUNT(CASE WHEN ibm.action = 'created' THEN 1 END) as created_count,
        COUNT(CASE WHEN ibm.action = 'updated' THEN 1 END) as updated_count,
        COUNT(CASE WHEN ibm.action = 'skipped' THEN 1 END) as skipped_count
      FROM import_batches ib
      LEFT JOIN import_batch_mappings ibm ON ib.id = ibm.import_batch_id
      WHERE ib.deleted_at IS NULL
      GROUP BY ib.id
      ORDER BY ib.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
}

// NEW FUNCTION: Get specific import batch details
export async function getImportBatchDetails(req, res) {
  try {
    const { id } = req.params;
    
    // Get batch info
    const batchQuery = `
      SELECT * FROM import_batches WHERE id = $1 AND deleted_at IS NULL
    `;
    const batchResult = await pool.query(batchQuery, [id]);
    
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Import batch not found' });
    }
    
    // Get associated mappings
    const mappingsQuery = `
      SELECT 
        m.*,
        ibm.action as import_action
      FROM import_batch_mappings ibm
      JOIN mappings m ON ibm.mapping_id = m.id
      WHERE ibm.import_batch_id = $1
      ORDER BY m.domain, m.source
    `;
    const mappingsResult = await pool.query(mappingsQuery, [id]);
    
    res.json({
      batch: batchResult.rows[0],
      mappings: mappingsResult.rows
    });
  } catch (error) {
    console.error('Error fetching import batch details:', error);
    res.status(500).json({ error: 'Failed to fetch import batch details' });
  }
}

// NEW FUNCTION: Rollback/delete an import batch
export async function rollbackImportBatch(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    
    await client.query('BEGIN');
    
    // Set session context for audit logging if available
    if (req.setDbSessionContext) {
      await req.setDbSessionContext(client, {
        changeReason: `Rollback import batch ${id}`
      });
    }
    
    if (permanent) {
      // Hard delete all mappings from this batch
      const deleteResult = await client.query(`
        DELETE FROM mappings 
        WHERE import_batch_id = $1 
        RETURNING id
      `, [id]);
      
      // Delete the import batch record
      await client.query('DELETE FROM import_batches WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      res.json({
        message: 'Import batch permanently deleted',
        deletedMappings: deleteResult.rowCount
      });
    } else {
      // Soft delete - use the database function
      const result = await client.query('SELECT rollback_import_batch($1) as deleted_count', [id]);
      
      await client.query('COMMIT');
      res.json({
        message: 'Import batch rolled back',
        deletedMappings: result.rows[0].deleted_count,
        canRestore: true
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rolling back import batch:', error);
    res.status(500).json({ error: 'Failed to rollback import batch' });
  } finally {
    client.release();
  }
}