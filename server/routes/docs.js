import { Router } from 'express';

const router = Router();

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Data Mapping Manager API',
    version: '2.0.0',
    endpoints: {
      mappings: {
        base: '/api/mappings',
        operations: {
          'GET /': 'Get all mappings',
          'POST /': 'Create a new mapping',
          'PUT /bulk': 'Bulk update mappings',
          'PUT /:id': 'Update a mapping',
          'DELETE /:id': 'Delete a mapping (soft delete by default)',
          'POST /:id/restore': 'Restore a soft-deleted mapping',
          'GET /:id/history': 'Get audit history for a mapping',
          'GET /deleted': 'Get all deleted mappings'
        }
      },
      targets: {
        base: '/api/targets',
        operations: {
          'GET /': 'Get all targets'
        }
      },
      sources: {
        base: '/api/sources',
        operations: {
          'GET /': 'Get all data sources',
          'DELETE /:sourceName': 'Delete a data source',
          'POST /:sourceName/restore': 'Restore a deleted data source',
          'POST /merge': 'Merge multiple sources'
        }
      },
      import: {
        base: '/api',
        operations: {
          'POST /import': 'Import CSV file',
          'GET /export': 'Export mappings to CSV',
          'GET /import/history': 'Get import batch history',
          'GET /import/batch/:id': 'Get specific import batch details',
          'DELETE /import/batch/:id': 'Rollback/delete import batch'
        }
      },
      audit: {
        base: '/api/audit',
        operations: {
          'GET /logs': 'Get audit logs with filters',
          'GET /statistics': 'Get audit statistics',
          'GET /timeline': 'Get timeline view of changes',
          'GET /session/:sessionId': 'Get all changes from a session',
          'POST /rollback/:auditId': 'Rollback a specific change',
          'POST /cleanup': 'Clean up old audit logs (admin)'
        }
      },
      health: {
        base: '/api/health',
        operations: {
          'GET /': 'Health check endpoint'
        }
      }
    },
    features: {
      softDelete: 'Records are soft-deleted by default (marked as deleted, not removed)',
      auditTrail: 'All changes are logged with full before/after values',
      sessionTracking: 'Anonymous session tracking via cookies',
      importBatchTracking: 'CSV imports are tracked as batches with rollback support',
      rollbackSupport: 'Individual changes and entire import batches can be rolled back',
      changeReasons: 'Optional change reason can be provided for any modification'
    },
    queryParameters: {
      common: {
        limit: 'Number of records to return (default: 100)',
        offset: 'Number of records to skip for pagination',
        domain: 'Filter by domain (account, entity, product, department, location)',
        search: 'Search in source/target fields',
        status: 'Filter by status (active, inactive)'
      },
      audit: {
        table_name: 'Filter audit logs by table name',
        record_id: 'Filter audit logs by record ID',
        action: 'Filter by action (INSERT, UPDATE, DELETE)',
        session_id: 'Filter by session ID',
        start_date: 'Filter logs after this date (ISO format)',
        end_date: 'Filter logs before this date (ISO format)',
        days: 'Number of days to include in statistics (default: 30)'
      },
      deletion: {
        permanent: 'Set to "true" for permanent deletion instead of soft delete',
        changeReason: 'Reason for the change (stored in audit log)'
      }
    }
  });
});

export default router;