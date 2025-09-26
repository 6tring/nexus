import { Router } from 'express';
import * as mappingController from '../controllers/mappingController.js';

const router = Router();

router.get('/', mappingController.getMappings);
router.put('/bulk', mappingController.bulkUpdate);  // MUST be before /:id
router.put('/:id', mappingController.updateMapping);

export default router;