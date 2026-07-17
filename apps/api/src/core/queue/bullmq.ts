import { Queue, Worker, Processor } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

export const documentQueue = new Queue('documentProcessing', { connection });
export const crawlQueue = new Queue('crawlProcessing', { connection });
export const metricsQueue = new Queue('metricsProcessing', { connection });

export const createWorker = (queueName: string, processor: Processor) => {
  const worker = new Worker(queueName, processor, { connection });
  
  worker.on('error', err => {
    console.error(`[BullMQ Worker Error] ${queueName}:`, err);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`[BullMQ Job Failed] ${queueName} Job ${job?.id}:`, err);
  });

  return worker;
};
