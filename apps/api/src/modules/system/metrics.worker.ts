import { Job } from 'bullmq';
import { ApiKeyService } from './api-key.service';

/**
 * BullMQ Processor for flushing Redis usage metrics to PostgreSQL.
 * This ensures that in a multi-instance backend, only one server flushes metrics at a time.
 */
export const metricsProcessor = async (job: Job) => {
  try {
    // console.log(`[MetricsWorker] Starting flush job ${job.id}`);
    await ApiKeyService.flushMetricsToDb();
    return { success: true };
  } catch (error) {
    console.error(`[MetricsWorker] Failed to flush metrics:`, error);
    throw error; // Let BullMQ handle retries
  }
};
