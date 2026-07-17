import { Router } from 'express';
import {
  getSystemStatus,
  getCachedQueries,
  deleteCachedQuery,
  flushCache,
  getQueueJobs,
  deleteQueueJob,
  flushQueue,
  getApiQuotas,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  toggleApiKey
} from './system.controller';

const router: Router = Router();

// System Status
router.get('/status', getSystemStatus);

// Cache Management
router.get('/cache/queries', getCachedQueries);
router.delete('/cache/query', deleteCachedQuery);
router.delete('/cache', flushCache);

// Queue Management
router.get('/queue', getQueueJobs);
router.delete('/queue/:id', deleteQueueJob);
router.delete('/queue', flushQueue);

// API Quotas
router.get('/quotas', getApiQuotas);

// API Key Management (Database Configuration)
router.get('/apikeys', getApiKeys);
router.post('/apikeys', createApiKey);
router.delete('/apikeys/:id', deleteApiKey);
router.patch('/apikeys/:id/toggle', toggleApiKey);

export default router;
