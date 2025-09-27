const API_BASE = '/api';

// ============= EXISTING FUNCTIONS (ENHANCED) =============

export async function getMappings(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.domain) queryParams.append('domain', params.domain);
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  // NEW: Add dataSource support
  if (params.dataSource) queryParams.append('dataSource', params.dataSource);
  
  const response = await fetch(`${API_BASE}/mappings?${queryParams}`);
  if (!response.ok) throw new Error('Failed to fetch mappings');
  return response.json();
}

export async function updateMapping(id, data) {
  const response = await fetch(`${API_BASE}/mappings/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update mapping');
  return response.json();
}

export async function bulkUpdateMappings(ids, data) {
  const response = await fetch(`${API_BASE}/mappings/bulk`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids, ...data }),
  });
  if (!response.ok) throw new Error('Failed to bulk update mappings');
  return response.json();
}

export async function getTargets(domain = null) {
  const queryParams = domain ? `?domain=${domain}` : '';
  const response = await fetch(`${API_BASE}/targets${queryParams}`);
  if (!response.ok) throw new Error('Failed to fetch targets');
  return response.json();
}

export async function importMappings(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to import file');
  return response.json();
}

export async function exportMappings(domain = null, dataSource = null) {
  const queryParams = new URLSearchParams();
  if (domain) queryParams.append('domain', domain);
  // NEW: Add dataSource support
  if (dataSource) queryParams.append('dataSource', dataSource);
  
  const queryString = queryParams.toString();
  const response = await fetch(`${API_BASE}/export${queryString ? `?${queryString}` : ''}`);
  if (!response.ok) throw new Error('Failed to export mappings');
  
  // Try to get filename from response headers
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `mappings_${domain || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
  if (contentDisposition) {
    const matches = contentDisposition.match(/filename="?([^"]+)"?/);
    if (matches && matches[1]) {
      filename = matches[1];
    }
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ============= NEW SOURCE-RELATED FUNCTIONS =============

// Fetch available data sources with statistics
export async function getSources() {
  try {
    const response = await fetch(`${API_BASE}/sources`);
    if (!response.ok) throw new Error('Failed to fetch sources');
    return response.json();
  } catch (error) {
    console.error('Error fetching sources:', error);
    // Return empty structure if API fails
    return { sources: [], total: 0 };
  }
}

// Fetch import history
export async function getImportHistory() {
  try {
    const response = await fetch(`${API_BASE}/sources/import-history`);
    if (!response.ok) throw new Error('Failed to fetch import history');
    return response.json();
  } catch (error) {
    console.error('Error fetching import history:', error);
    return { imports: [], total: 0 };
  }
}

// Clear sample data
export async function clearSampleData() {
  const response = await fetch(`${API_BASE}/sources/sample`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) throw new Error('Failed to clear sample data');
  return response.json();
}

// Delete a specific data source
export async function deleteSource(sourceName) {
  const response = await fetch(`${API_BASE}/sources/${encodeURIComponent(sourceName)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) throw new Error('Failed to delete data source');
  return response.json();
}

// Merge multiple sources
export async function mergeSources(sourcesToMerge, targetSource, newSourceName) {
  const response = await fetch(`${API_BASE}/sources/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourcesToMerge,
      targetSource,
      newSourceName,
    }),
  });
  
  if (!response.ok) throw new Error('Failed to merge sources');
  return response.json();
}

// ============= ALIAS FUNCTIONS FOR COMPATIBILITY =============
// These ensure any code using the new naming conventions will also work

export const fetchMappings = getMappings;
export const fetchSources = getSources;
export const fetchImportHistory = getImportHistory;
export const importCSV = importMappings;
export const exportCSV = exportMappings;