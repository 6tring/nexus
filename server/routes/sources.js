// sources.js - Routes for data source management
import express from 'express';
import * as sourceController from '../controllers/sourceController.js';

const router = express.Router();

// GET /api/sources - Get all data sources with statistics
router.get('/', sourceController.getAllSources);

// GET /api/sources/import-history - Get import history
router.get('/import-history', sourceController.getImportHistory);

// DELETE /api/sources/sample - Clear sample data
router.delete('/sample', sourceController.clearSampleData);

// DELETE /api/sources/:sourceName - Delete a specific data source
router.delete('/:sourceName', sourceController.deleteSource);

// POST /api/sources/merge - Merge multiple sources
router.post('/merge', sourceController.mergeSources);

export default router;