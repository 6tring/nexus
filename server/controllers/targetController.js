let pool;

export function setPool(dbPool) {
  pool = dbPool;
}

export async function getTargets(req, res) {
  try {
    const { domain } = req.query;
    
    let query = 'SELECT * FROM targets';
    const params = [];
    
    if (domain && domain !== 'all') {
      query += ' WHERE domain = $1';
      params.push(domain);
    }
    
    query += ' ORDER BY code';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
}