import { Queue, Worker, Processor } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

export const documentQueue = new Queue('documentProcessing', { connection });

export const createWorker = (queueName: string, processor: Processor) => {
  return new Worker(queueName, processor, { connection });
};
