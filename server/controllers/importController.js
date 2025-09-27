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
    
    let imported = 0;
    let skipped = 0;
    const errors = [];
    const duplicates = [];
    
    for (const record of records) {
      const { source, target, domain, status = 'active' } = record;
      
      if (source && domain) {
        // Validate target format if provided
        if (target) {
          const validation = validateTarget(target, domain);
          if (!validation.valid) {
            errors.push(`Row ${records.indexOf(record) + 2}: ${validation.error} (source: ${source})`);
            skipped++;
            continue;
          }
        }
        
        // Check for duplicate source/domain combination
        const isDuplicate = await checkDuplicate(
          pool,
          process.env.CLIENT_ID || 'default',
          source,
          domain
        );
        
        if (isDuplicate) {
          duplicates.push(`${source} (${domain})`);
          skipped++;
          continue;
        }
        
        // Insert with data_source and created_at
        const query = `
          INSERT INTO mappings (client_id, source, target, domain, status, data_source, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        
        const result = await client.query(query, [
          process.env.CLIENT_ID || 'default',
          source,
          target || null,
          domain,
          status,
          dataSource  // Set the import timestamp as data source
        ]);
        
        if (result.rowCount > 0) imported++;
      } else {
        skipped++;
        errors.push(`Row ${records.indexOf(record) + 2}: Missing required fields (source or domain)`);
      }
    }
    
    await client.query('COMMIT');
    
    // Clean up uploaded file
    await fs.unlink(req.file.path);
    
    res.json({ 
      message: 'Import completed', 
      imported, 
      skipped,
      total: records.length,
      dataSource: dataSource,  // Include the source identifier in response
      importDate: now.toISOString(),
      duplicates: duplicates.length > 0 ? duplicates.slice(0, 10) : undefined,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      hasMoreDuplicates: duplicates.length > 10,
      hasMoreErrors: errors.length > 10
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing CSV:', error);
    
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
    
    let query = 'SELECT source, target, domain, status FROM mappings WHERE client_id = $1';
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