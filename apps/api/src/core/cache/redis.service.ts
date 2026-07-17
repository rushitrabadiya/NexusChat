import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});
