import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pg from 'pg';
import dotenv from 'dotenv';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import session middleware
import { sessionMiddleware, setPool as setSessionPool } from './middleware/sessionMiddleware.js';

// Import routes
import mappingRoutes from './routes/mappings.js';
import importRoutes from './routes/import.js';
import targetRoutes from './routes/targets.js';
import sourceRoutes from './routes/sources.js';
import auditRoutes from './routes/audit.js';
import docsRoutes from './routes/docs.js';

// Import controllers to set pool
import * as mappingController from './controllers/mappingController.js';
import * as importController from './controllers/importController.js';
import * as targetController from './controllers/targetController.js';
import * as sourceController from './controllers/sourceController.js';
import * as auditController from './controllers/auditController.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// PostgreSQL connection pool
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'data_mapping_manager_app_db',
  user: process.env.DB_USER || 'data_mapping_manager_app_admin',
  password: process.env.DB_PASSWORD || 'data',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Pass pool to all components that need it
mappingController.setPool(pool);
importController.setPool(pool);
targetController.setPool(pool);
sourceController.setPool(pool);
auditController.setPool(pool);
setSessionPool(pool);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Middleware - ORDER IS IMPORTANT
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply session middleware to all routes
app.use(sessionMiddleware);

// Test database connection
pool.query('SELECT NOW()')
  .then(() => {
    console.log('Database connected successfully');
    // Verify audit tables exist
    return pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_sessions', 'audit_log', 'import_batches', 'import_batch_mappings')
    `);
  })
  .then((result) => {
    const tables = result.rows.map(r => r.table_name);
    const requiredTables = ['user_sessions', 'audit_log', 'import_batches', 'import_batch_mappings'];
    const missingTables = requiredTables.filter(t => !tables.includes(t));
    
    if (missingTables.length === 0) {
      console.log('✓ Audit system tables verified');
    } else {
      console.warn('⚠ Some audit tables are missing. Please run the database.sql script.');
      console.warn('  Missing tables:', missingTables);
    }
  })
  .catch(err => {
    console.error('Database connection error:', err);
    console.error('Please check your database configuration in .env file');
    process.exit(1);
  });

// Routes
app.use('/api/mappings', mappingRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', importRoutes);
app.use('/api', docsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    session: req.session ? 'active' : 'inactive',
    database: pool.totalCount > 0 ? 'connected' : 'disconnected',
    auditEnabled: true
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    session: req.session?.sessionId,
    path: req.path,
    method: req.method
  });
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Something went wrong!',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (err) {
    console.error('Error closing database pool:', err);
  }
  
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS enabled for: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  console.log(`Audit trail: ENABLED`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

export default app;