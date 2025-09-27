import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as importController from '../controllers/importController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);  // Fixed typo (was **dirname)

const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

const router = Router();

// Existing routes - maintained for backward compatibility
router.post('/import', upload.single('file'), importController.importCSV);
router.get('/export', importController.exportCSV);

// New audit-related routes for import batch management
router.get('/import/history', importController.getImportHistory);  // Get list of all import batches
router.get('/import/batch/:id', importController.getImportBatchDetails);  // Get specific batch details
router.delete('/import/batch/:id', importController.rollbackImportBatch);  // Rollback/delete import batch

export default router;