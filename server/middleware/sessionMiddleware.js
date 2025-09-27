import crypto from 'crypto';

let pool = null;

// Set the database pool
export const setPool = (dbPool) => {
  pool = dbPool;
};

/**
 * Generates a unique session ID
 */
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Gets the client IP address from the request
 */
const getClientIp = (req) => {
  // Check for forwarded IP (when behind proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Check for real IP header
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  
  // Fall back to connection remote address
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.ip || 
         'unknown';
};

/**
 * Creates or updates a session in the database
 */
const upsertSession = async (sessionId, ipAddress, userAgent) => {
  if (!pool) {
    console.warn('Session middleware: Database pool not set');
    return;
  }

  try {
    await pool.query(
      `INSERT INTO user_sessions (session_id, ip_address, user_agent, last_activity) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (session_id) 
       DO UPDATE SET last_activity = CURRENT_TIMESTAMP`,
      [sessionId, ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Failed to upsert session:', error);
  }
};

/**
 * Session middleware that tracks user sessions and sets PostgreSQL session variables
 */
export const sessionMiddleware = async (req, res, next) => {
  try {
    // Get or create session ID from cookie
    let sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      sessionId = generateSessionId();
      // Set cookie that expires in 30 days
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    
    // Get client information
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Store in request object for use in controllers
    req.session = {
      sessionId,
      ipAddress,
      userAgent
    };
    
    // Update session in database
    await upsertSession(sessionId, ipAddress, userAgent);
    
    // Store session context setter function on request
    req.setDbSessionContext = async (client, additionalContext = {}) => {
      const queries = [
        `SET LOCAL app.session_id = '${sessionId}'`,
        `SET LOCAL app.ip_address = '${ipAddress}'`
      ];
      
      // Add optional context
      if (additionalContext.changeReason) {
        queries.push(`SET LOCAL app.change_reason = '${additionalContext.changeReason.replace(/'/g, "''")}'`);
      }
      
      if (additionalContext.importBatchId) {
        queries.push(`SET LOCAL app.import_batch_id = '${additionalContext.importBatchId}'`);
      }
      
      // Execute all SET commands
      for (const query of queries) {
        await client.query(query);
      }
    };
    
    // For non-transactional queries, provide a wrapper
    req.queryWithSession = async (queryText, params, additionalContext = {}) => {
      if (!pool) {
        throw new Error('Database pool not initialized');
      }
      
      const client = await pool.connect();
      try {
        // Start transaction
        await client.query('BEGIN');
        
        // Set session context
        await req.setDbSessionContext(client, additionalContext);
        
        // Execute the actual query
        const result = await client.query(queryText, params);
        
        // Commit transaction
        await client.query('COMMIT');
        
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    };
    
    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    // Continue even if session tracking fails
    next();
  }
};

/**
 * Middleware to handle change reasons (optional)
 * Can be used for specific routes that allow users to provide reasons for changes
 */
export const changeReasonMiddleware = (req, res, next) => {
  // Extract change reason from request body or query
  const changeReason = req.body?.changeReason || req.query?.changeReason;
  
  if (changeReason) {
    req.changeReason = changeReason;
  }
  
  next();
};

/**
 * Clean up old sessions (can be called periodically)
 */
export const cleanupOldSessions = async () => {
  if (!pool) {
    console.warn('Cannot cleanup sessions: Database pool not set');
    return;
  }
  
  try {
    const result = await pool.query(
      `DELETE FROM user_sessions 
       WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '30 days'`
    );
    
    console.log(`Cleaned up ${result.rowCount} old sessions`);
    return result.rowCount;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return 0;
  }
};

// Set up periodic cleanup (every 24 hours)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    cleanupOldSessions();
  }, 24 * 60 * 60 * 1000);
}

export default sessionMiddleware;