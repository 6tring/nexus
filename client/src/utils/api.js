const API_BASE = '/api';

export async function getMappings(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.domain) queryParams.append('domain', params.domain);
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  
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

export async function exportMappings(domain = null) {
  const queryParams = domain ? `?domain=${domain}` : '';
  const response = await fetch(`${API_BASE}/export${queryParams}`);
  if (!response.ok) throw new Error('Failed to export mappings');
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `mappings_${domain || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}