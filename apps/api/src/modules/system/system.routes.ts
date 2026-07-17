import { Router } from 'express';
import {
  getSystemStatus,
  getCachedQueries,
  deleteCachedQuery,
  flushCache,
  getQueueJobs,
  deleteQueueJob,
  flushQueue
} from './system.controller';

const router: Router = Router();

router.get('/status', getSystemStatus);

// Cache Management
router.get('/cache', getCachedQueries);
router.post('/cache/delete', deleteCachedQuery);
router.delete('/cache', flushCache);

// Queue Management
router.get('/queue', getQueueJobs);
router.delete('/queue/:id', deleteQueueJob);
router.delete('/queue', flushQueue);

export default router;
