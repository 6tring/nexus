// Validation patterns for target codes
export const TARGET_PATTERNS = {
  account: /^ACC\d{3}$/,
  entity: /^ENT\d{3}$/,
  product: /^PROD\d{3}$/,
  department: /^DEPT\d{3}$/,
  location: /^LOC\d{3}$/
};

export function validateTarget(target, domain) {
  if (!target || target.trim() === '') {
    return { valid: true };
  }
  const pattern = TARGET_PATTERNS[domain];
  if (!pattern) {
    return { valid: false, error: 'Invalid domain' };
  }
  if (!pattern.test(target)) {
    return { valid: false, error: `Invalid format for ${domain}` };
  }
  return { valid: true };
}

export async function checkDuplicate(pool, clientId, source, domain, excludeId = null) {
  let query = 'SELECT id FROM mappings WHERE client_id = $1 AND source = $2 AND domain = $3';
  const params = [clientId, source, domain];
  
  if (excludeId) {
    query += ' AND id != $4';
    params.push(excludeId);
  }
  
  const result = await pool.query(query, params);
  return result.rows.length > 0;
}