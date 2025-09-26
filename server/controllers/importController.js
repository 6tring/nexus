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
        
        const query = `
          INSERT INTO mappings (client_id, source, target, domain, status)
          VALUES ($1, $2, $3, $4, $5)
        `;
        
        const result = await client.query(query, [
          process.env.CLIENT_ID || 'default',
          source,
          target || null,
          domain,
          status
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
    const { domain } = req.query;
    
    let query = 'SELECT source, target, domain, status FROM mappings';
    const params = [];
    
    if (domain && domain !== 'all') {
      query += ' WHERE domain = $1';
      params.push(domain);
    }
    
    query += ' ORDER BY domain, source';
    
    const result = await pool.query(query, params);
    
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
    res.setHeader('Content-Disposition', `attachment; filename="mappings_export.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting mappings:', error);
    res.status(500).json({ error: 'Failed to export mappings' });
  }
}