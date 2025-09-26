// Validation patterns for each domain type
const TARGET_PATTERNS = {
  account: /^ACC\d{3}$/,
  entity: /^ENT\d{3}$/,
  product: /^PROD\d{3}$/,
  department: /^DEPT\d{3}$/,
  location: /^LOC\d{3}$/
};

export function validateTarget(target, domain) {
  if (!target || target.trim() === '') {
    return { valid: true }; // Empty targets are allowed
  }
  
  const pattern = TARGET_PATTERNS[domain];
  if (!pattern) {
    return { valid: false, error: 'Invalid domain' };
  }
  
  if (!pattern.test(target)) {
    const prefix = domain.substring(0, 3).toUpperCase();
    if (domain === 'department') {
      return { valid: false, error: `Target must match format: DEPT### (e.g., DEPT001)` };
    }
    return { valid: false, error: `Target must match format: ${prefix}### (e.g., ${prefix}001)` };
  }
  
  return { valid: true };
}

export function validateSource(source) {
  if (!source || source.trim() === '') {
    return { valid: false, error: 'Source cannot be empty' };
  }
  if (source.length > 255) {
    return { valid: false, error: 'Source cannot exceed 255 characters' };
  }
  return { valid: true };
}