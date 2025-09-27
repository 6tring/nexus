import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import mappingRoutes from './routes/mappings.js';
import importRoutes from './routes/import.js';
import targetRoutes from './routes/targets.js';
import sourceRoutes from './routes/sources.js';

// Import controllers to set pool
import * as mappingController from './controllers/mappingController.js';
import * as importController from './controllers/importController.js';
import * as targetController from './controllers/targetController.js';
import * as sourceController from './controllers/sourceController.js';

dotenv.config();

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

// Pass pool to controllers
mappingController.setPool(pool);
importController.setPool(pool);
targetController.setPool(pool);
sourceController.setPool(pool);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test database connection
pool.query('SELECT NOW()')
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch(err => {
    console.error('Database connection error:', err);
    console.error('Please check your database configuration in .env file');
    process.exit(1);
  });

// Routes
app.use('/api/mappings', mappingRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api', importRoutes);  // import/export routes
app.use('/api/sources', sourceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});