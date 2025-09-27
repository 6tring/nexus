import { Router } from 'express';
import * as auditController from '../controllers/auditController.js';

const router = Router();

// Get audit logs with filters
router.get('/logs', auditController.getAuditLog);

// Get audit statistics
router.get('/statistics', auditController.getAuditStatistics);

// Get timeline view
router.get('/timeline', auditController.getTimeline);

// Get specific session information
router.get('/session/:sessionId', auditController.getSessionInfo);

// Rollback a specific change
router.post('/rollback/:auditId', auditController.rollbackChange);

// Admin: Cleanup old audit logs
router.post('/cleanup', auditController.cleanupAuditLogs);

export default router;