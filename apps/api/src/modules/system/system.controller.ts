import { Request, Response } from 'express';
import { redis } from '../../core/cache/redis.service';
import { documentQueue } from '../../core/queue/bullmq';
import { AiFactory } from '../../core/ai/ai.factory';
import { ApiKeyService } from './api-key.service';

export const getSystemStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    // Count total cached responses in Redis
    const keys = await redis.keys('chat:*');
    const cachedDataCount = keys.length;

    // Get queue counts from BullMQ
    const waitingCount = await documentQueue.getWaitingCount();
    const activeCount = await documentQueue.getActiveCount();

    // Total pending includes waiting and currently processing
    const pendingQueueCount = waitingCount + activeCount;

    return res.json({
      cachedDataCount,
      pendingQueueCount
    });
  } catch (error) {
    console.error('Failed to get system status:', error);
    return res.status(500).json({ error: 'Failed to retrieve system status' });
  }
};

export const getCachedQueries = async (req: Request, res: Response): Promise<any> => {
  try {
    const keys = await redis.keys('chat:*');

    if (keys.length === 0) return res.json([]);

    // Fetch TTL for all keys in a single pipeline request
    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.ttl(key));
    const ttls = await pipeline.exec();

    // Instead of raw MGET which can be large, just return metadata
    const queries = keys.map((key, index) => {
      const parts = key.split(':');
      const tenantId = parts[1];
      const encodedQuery = parts[2];

      let queryText = 'Unknown Query';
      try {
        if (encodedQuery) {
          queryText = Buffer.from(encodedQuery, 'base64').toString('utf8');
        }
      } catch (e) { }

      // Get TTL from pipeline result. Pipeline exec returns [[err, result], [err, result], ...]
      const ttl = ttls && ttls[index] ? (ttls[index][1] as number) : 0;

      return {
        key,
        tenantId,
        queryText,
        ttl
      };
    });

    // Sort descending by TTL (highest remaining TTL = newest query)
    queries.sort((a, b) => b.ttl - a.ttl);

    return res.json(queries);
  } catch (error) {
    console.error('Failed to get cached queries:', error);
    return res.status(500).json({ error: 'Failed to retrieve cached queries' });
  }
};

export const deleteCachedQuery = async (req: Request, res: Response): Promise<any> => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });

    await redis.del(key);
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete cached query:', error);
    return res.status(500).json({ error: 'Failed to delete cached query' });
  }
};

export const flushCache = async (req: Request, res: Response): Promise<any> => {
  try {
    const keys = await redis.keys('chat:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to flush cache:', error);
    return res.status(500).json({ error: 'Failed to flush cache' });
  }
};

export const getQueueJobs = async (req: Request, res: Response): Promise<any> => {
  try {
    const jobs = await documentQueue.getJobs(['waiting', 'active', 'delayed', 'failed']);

    const formattedJobs = jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      status: job.finishedOn ? 'completed' : (job.failedReason ? 'failed' : 'pending'),
      failedReason: job.failedReason
    }));

    return res.json(formattedJobs);
  } catch (error) {
    console.error('Failed to get queue jobs:', error);
    return res.status(500).json({ error: 'Failed to retrieve queue jobs' });
  }
};

export const deleteQueueJob = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const job = await documentQueue.getJob(id);
    if (job) {
      await job.remove();
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete queue job:', error);
    return res.status(500).json({ error: 'Failed to delete queue job' });
  }
};

export const flushQueue = async (req: Request, res: Response): Promise<any> => {
  try {
    await documentQueue.obliterate({ force: true });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to flush queue:', error);
    return res.status(500).json({ error: 'Failed to flush queue' });
  }
};

export const getApiQuotas = async (req: Request, res: Response): Promise<any> => {
  try {
    const factory = AiFactory.getInstance();
    const quotas = await factory.getAllQuotaStatuses();
    return res.json(quotas);
  } catch (error) {
    console.error('Failed to get API quotas:', error);
    return res.status(500).json({ error: 'Failed to retrieve API Quota status' });
  }
};

// ==========================================
// API Key Management Endpoints
// ==========================================

export const getApiKeys = async (req: Request, res: Response): Promise<any> => {
  try {
    const keys = await ApiKeyService.getAllKeys();
    return res.json(keys);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get API keys' });
  }
};

export const createApiKey = async (req: Request, res: Response): Promise<any> => {
  try {
    const key = await ApiKeyService.addKey(req.body);
    return res.status(201).json(key);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create API key' });
  }
};

export const deleteApiKey = async (req: Request, res: Response): Promise<any> => {
  try {
    await ApiKeyService.deleteKey(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete API key' });
  }
};

export const toggleApiKey = async (req: Request, res: Response): Promise<any> => {
  try {
    const { isActive } = req.body;
    const key = await ApiKeyService.toggleActive(req.params.id, isActive);
    return res.json(key);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to toggle API key' });
  }
};
