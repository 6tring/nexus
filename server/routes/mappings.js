import { Router } from 'express';
import * as mappingController from '../controllers/mappingController.js';

const router = Router();

// Existing routes - maintained for backward compatibility
router.get('/', mappingController.getMappings);
router.put('/bulk', mappingController.bulkUpdate);  // MUST be before /:id
router.put('/:id', mappingController.updateMapping);

// New audit-related routes
router.get('/deleted', mappingController.getDeletedMappings);  // Get soft-deleted mappings
router.post('/', mappingController.createMapping);  // Add POST route for creating mappings
router.delete('/:id', mappingController.deleteMapping);  // Add DELETE route (now does soft delete by default)
router.post('/:id/restore', mappingController.restoreMapping);  // Restore soft-deleted mapping
router.get('/:id/history', mappingController.getMappingHistory);  // Get audit history for a mapping

export default router;