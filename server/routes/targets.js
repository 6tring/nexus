import { Router } from 'express';
import * as targetController from '../controllers/targetController.js';

const router = Router();

router.get('/', targetController.getTargets);

export default router;