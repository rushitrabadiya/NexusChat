import { prisma } from '../../core/db/prisma';
import { redis } from '../../core/cache/redis.service';
import { CryptoUtil } from '../../core/security/crypto.util';

export interface ApiKeyPayload {
  provider: string;
  name: string;
  key: string;
  limitRequestsMin?: number | null;
  limitRequestsHour?: number | null;
  limitRequestsDay?: number | null;
  limitRequestsMonth?: number | null;
  limitTokensMin?: number | null;
  limitTokensDay?: number | null;
}

export class ApiKeyService {
  /**
   * Retrieves all API keys from the database.
   */
  static async getAllKeys() {
    return prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Adds a new API key and immediately syncs it to Redis.
   */
  static async addKey(payload: ApiKeyPayload) {
    const newKey = await prisma.apiKey.create({
      data: {
        provider: payload.provider.toUpperCase(),
        name: payload.name.trim(),
        key: CryptoUtil.encrypt(payload.key.trim()),
        isActive: true,
        limitRequestsMin: payload.limitRequestsMin,
        limitRequestsHour: payload.limitRequestsHour,
        limitRequestsDay: payload.limitRequestsDay,
        limitRequestsMonth: payload.limitRequestsMonth,
        limitTokensMin: payload.limitTokensMin,
        limitTokensDay: payload.limitTokensDay,
      }
    });

    await this.syncToRedis();
    return newKey;
  }

  /**
   * Deletes an API key and triggers a Redis sync.
   */
  static async deleteKey(id: string) {
    const deleted = await prisma.apiKey.delete({
      where: { id }
    });

    // Clear its quota tracking keys from Redis if needed, then sync
    const basePrefix = `quota:${deleted.provider.toLowerCase()}:${deleted.key}`;
    const keys = await redis.keys(`${basePrefix}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    await this.syncToRedis();
    return deleted;
  }

  /**
   * Toggles the active status of a key.
   */
  static async toggleActive(id: string, isActive: boolean) {
    const updated = await prisma.apiKey.update({
      where: { id },
      data: { isActive }
    });
    await this.syncToRedis();
    return updated;
  }

  /**
   * Syncs active API keys from PostgreSQL into Redis as JSON objects,
   * so the KeyRotator can access them in blazing fast memory without hitting PostgreSQL.
   */
  static async syncToRedis() {
    const activeKeys = await prisma.apiKey.findMany({
      where: { isActive: true }
    });

    // Group keys by provider
    const keysByProvider: Record<string, any[]> = {};
    for (const k of activeKeys) {
      const provider = k.provider.toLowerCase();
      if (!keysByProvider[provider]) {
        keysByProvider[provider] = [];
      }
      keysByProvider[provider].push({
        id: k.id,
        name: k.name,
        key: k.key, // Send encrypted key to Redis for safety
        limitRequestsMin: k.limitRequestsMin,
        limitRequestsHour: k.limitRequestsHour,
        limitRequestsDay: k.limitRequestsDay,
        limitRequestsMonth: k.limitRequestsMonth,
        limitTokensMin: k.limitTokensMin,
        limitTokensDay: k.limitTokensDay,
      });
    }

    // Save to Redis
    // We clear old provider lists first to ensure clean state
    const existingConfigKeys = await redis.keys('system:apikeys:*');
    if (existingConfigKeys.length > 0) {
      await redis.del(...existingConfigKeys);
    }

    for (const [provider, keys] of Object.entries(keysByProvider)) {
      await redis.set(`system:apikeys:${provider}`, JSON.stringify(keys));
    }

    console.log(`[ApiKeyService] Synced ${activeKeys.length} active keys to Redis.`);
  }

  /**
   * Flushes current usage counters from Redis back to PostgreSQL.
   * This is meant to be called by a periodic background worker (e.g. every 5 mins).
   */
  static async flushMetricsToDb() {
    const activeKeys = await prisma.apiKey.findMany({ where: { isActive: true } });

    for (const apiKey of activeKeys) {
      // In Redis, the total usage since last sync can be tracked in a specialized "metrics" hash.
      // We read it, add it to DB, and reset it in Redis.
      const metricsKey = `metrics:apikeys:${apiKey.id}`;
      const metrics = await redis.hgetall(metricsKey);

      if (metrics && (metrics.requests || metrics.tokens)) {
        const reqs = parseInt(metrics.requests || '0', 10);
        const toks = parseInt(metrics.tokens || '0', 10);

        if (reqs > 0 || toks > 0) {
          await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: {
              usageRequests: { increment: reqs },
              usageTokens: { increment: toks }
            }
          });

          // Clear the aggregated metrics so we don't double count
          await redis.del(metricsKey);
        }
      }
    }
  }
}
