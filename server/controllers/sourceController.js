// sourceController.js - Handles data source management operations
let pool;

export const setPool = (dbPool) => {
  pool = dbPool;
};

// Get all unique data sources with statistics
export const getAllSources = async (req, res) => {
  try {
    // Use the source_statistics view for efficient retrieval
    const query = `
      SELECT 
        data_source,
        mapping_count,
        first_created,
        last_created
      FROM source_statistics
      ORDER BY last_created DESC
    `;
    
    const result = await pool.query(query);
    
    // Format the sources for frontend consumption
    const sources = result.rows.map(row => ({
      name: row.data_source,
      count: parseInt(row.mapping_count),
      firstCreated: row.first_created,
      lastCreated: row.last_created,
      displayName: formatSourceDisplayName(row.data_source)
    }));
    
    // Add an "All Sources" option at the beginning
    const allSourcesCount = sources.reduce((sum, source) => sum + source.count, 0);
    const allSources = {
      name: 'all',
      displayName: 'All Sources',
      count: allSourcesCount,
      firstCreated: sources.length > 0 ? sources[sources.length - 1].firstCreated : null,
      lastCreated: sources.length > 0 ? sources[0].lastCreated : null
    };
    
    res.json({
      sources: [allSources, ...sources],
      total: allSourcesCount
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch data sources' });
  }
};

// Clear all data (previously named clearSampleData)
export const clearSampleData = async (req, res) => {
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Delete ALL mappings (not just sample data)
    // Note: This deletes everything - use with caution
    const deleteQuery = `
      DELETE FROM mappings 
      RETURNING id
    `;
    
    const result = await pool.query(deleteQuery);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    res.json({
      message: 'All data cleared successfully',
      deletedCount: result.rowCount
    });
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error clearing all data:', error);
    res.status(500).json({ error: 'Failed to clear data' });
  }
};

// Get import history
export const getImportHistory = async (req, res) => {
  try {
    // Get all import sources with their statistics
    const query = `
      SELECT 
        data_source,
        mapping_count,
        first_created as import_date
      FROM source_statistics
      WHERE data_source LIKE 'import_%'
      ORDER BY first_created DESC
    `;
    
    const result = await pool.query(query);
    
    // Parse import sources to extract timestamps
    const imports = result.rows.map(row => {
      const timestamp = row.data_source.replace('import_', '');
      return {
        source: row.data_source,
        timestamp: timestamp,
        importDate: row.import_date,
        mappingCount: parseInt(row.mapping_count),
        displayName: formatImportDisplayName(timestamp)
      };
    });
    
    res.json({
      imports: imports,
      total: imports.length
    });
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
};

// Helper function to format source display names
function formatSourceDisplayName(source) {
  if (source === 'sample') {
    return 'Sample Data';
  } else if (source === 'manual') {
    return 'Manual Entry';
  } else if (source === 'api') {
    return 'API Import';
  } else if (source.startsWith('import_')) {
    // Extract filename and timestamp from format: import_filename_YYYYMMDD_HHMMSS
    const parts = source.replace('import_', '');
    return formatImportDisplayName(parts);
  }
  return source;
}

// Helper function to format import display names
function formatImportDisplayName(importString) {
  try {
    // Expected format: filename_YYYYMMDD_HHMMSS
    // Find the last occurrence of underscore followed by 8 digits (date)
    const dateMatch = importString.match(/_(\d{8}_\d{6})$/);
    
    if (dateMatch) {
      // Extract filename (everything before the date)
      const filename = importString.substring(0, importString.length - dateMatch[0].length);
      
      // Parse the date portion
      const datePart = dateMatch[1];
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);
      const hour = datePart.substring(9, 11);
      const minute = datePart.substring(11, 13);
      
      const date = new Date(year, month - 1, day, hour, minute);
      
      // Clean up the filename for display
      const displayName = filename.replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
      
      // Format: "Filename (Jan 15, 2:30 PM)"
      const dateOptions = { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      };
      
      return `${displayName} (${date.toLocaleDateString('en-US', dateOptions)})`;
    }
    
    // Fallback for old format (just timestamp)
    if (/^\d{8}_\d{6}$/.test(importString)) {
      const year = importString.substring(0, 4);
      const month = importString.substring(4, 6);
      const day = importString.substring(6, 8);
      
      const date = new Date(year, month - 1, day);
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      
      return `Import from ${date.toLocaleDateString('en-US', options)}`;
    }
    
    // If we can't parse it, just clean it up
    return importString.replace(/_/g, ' ');
  } catch (error) {
    return `Import: ${importString}`;
  }
}

// Delete a single data source
export const deleteSource = async (req, res) => {
  const { sourceName } = req.params;
  
  // Prevent deletion of protected sources
  if (!sourceName || sourceName === 'all' || sourceName === 'manual' || sourceName === 'sample') {
    return res.status(400).json({ 
      error: 'Cannot delete this data source type' 
    });
  }
  
  // Only allow deletion of import sources
  if (!sourceName.startsWith('import_')) {
    return res.status(400).json({ 
      error: 'Only imported data sources can be deleted individually' 
    });
  }
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Delete mappings for this specific source
    const deleteQuery = `
      DELETE FROM mappings 
      WHERE data_source = $1
      RETURNING id
    `;
    
    const result = await pool.query(deleteQuery, [sourceName]);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    res.json({
      message: 'Data source deleted successfully',
      deletedCount: result.rowCount,
      deletedSource: sourceName
    });
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error deleting data source:', error);
    res.status(500).json({ error: 'Failed to delete data source' });
  }
};

// Merge multiple sources into one
export const mergeSources = async (req, res) => {
  const { sourcesToMerge, targetSource, newSourceName } = req.body;
  
  if (!sourcesToMerge || !Array.isArray(sourcesToMerge) || sourcesToMerge.length < 2) {
    return res.status(400).json({ error: 'At least two sources must be selected for merging' });
  }
  
  if (!targetSource && !newSourceName) {
    return res.status(400).json({ error: 'Either target source or new source name must be provided' });
  }
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Determine the final source name
    const finalSource = newSourceName || targetSource;
    
    // Update all mappings from the sources to be merged
    const updateQuery = `
      UPDATE mappings 
      SET data_source = $1
      WHERE data_source = ANY($2::text[])
      RETURNING id
    `;
    
    const result = await pool.query(updateQuery, [finalSource, sourcesToMerge]);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    res.json({
      message: 'Sources merged successfully',
      mergedSource: finalSource,
      updatedCount: result.rowCount
    });
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error merging sources:', error);
    res.status(500).json({ error: 'Failed to merge sources' });
  }
};