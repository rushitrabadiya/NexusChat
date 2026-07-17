import { redis } from '../../cache/redis.service';

export interface KeyLimits {
  id: string; // The db id
  provider?: string;
  name?: string;
  key: string;
  limitRequestsMin?: number | null;
  limitRequestsHour?: number | null;
  limitRequestsDay?: number | null;
  limitRequestsMonth?: number | null;
  limitTokensMin?: number | null;
  limitTokensDay?: number | null;
}

export interface QuotaStatus {
  key: string; // Name of the key
  provider: string;
  limitType: 'MINUTE' | 'HOUR' | 'DAY' | 'MONTH';
  requestsRemaining: number;
  requestsLimit: number;
  resetsInSeconds: number;
}

export class QuotaTracker {
  private static getRedisKey(provider: string, apiKey: string, interval: string, type: 'req' | 'tok'): string {
    const hashedKey = Buffer.from(apiKey).toString('base64').substring(0, 16);
    return `quota:${provider}:${hashedKey}:${interval}:${type}`;
  }

  private static getMetricsKey(keyId: string): string {
    return `metrics:apikeys:${keyId}`;
  }

  private static getSecondsToNextHour(): number {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
    return Math.floor((nextHour.getTime() - now.getTime()) / 1000);
  }

  private static getSecondsToNextDay(): number {
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setUTCDate(now.getUTCDate() + 1);
    nextDay.setUTCHours(0, 0, 0, 0);
    return Math.floor((nextDay.getTime() - now.getTime()) / 1000);
  }

  private static getSecondsToNextMonth(): number {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setUTCMonth(now.getUTCMonth() + 1, 1);
    nextMonth.setUTCHours(0, 0, 0, 0);
    return Math.floor((nextMonth.getTime() - now.getTime()) / 1000);
  }

  /**
   * Records usage across all active horizons and returns the minimum requests remaining.
   * Also increments the persistent metrics hash.
   */
  static async recordUsage(provider: string, config: KeyLimits, tokens: number = 0): Promise<number> {
    const multi = redis.multi();

    // We will execute a bunch of INCR commands, then EXPIRE if they are newly created
    // But to know if we need to expire, we actually should use INCR and then EXPIRE
    // Instead of complex scripting, we can do INCR, and if it's 1, we set EXPIRE.

    // We increment metrics immediately
    redis.hincrby(this.getMetricsKey(config.id), 'requests', 1);
    if (tokens > 0) {
      redis.hincrby(this.getMetricsKey(config.id), 'tokens', tokens);
    }

    const checks = [
      { interval: 'min', limit: config.limitRequestsMin, ttl: 60, type: 'req' as const, amount: 1 },
      { interval: 'hour', limit: config.limitRequestsHour, ttl: this.getSecondsToNextHour(), type: 'req' as const, amount: 1 },
      { interval: 'day', limit: config.limitRequestsDay, ttl: this.getSecondsToNextDay(), type: 'req' as const, amount: 1 },
      { interval: 'month', limit: config.limitRequestsMonth, ttl: this.getSecondsToNextMonth(), type: 'req' as const, amount: 1 },
      { interval: 'min', limit: config.limitTokensMin, ttl: 60, type: 'tok' as const, amount: tokens },
      { interval: 'day', limit: config.limitTokensDay, ttl: this.getSecondsToNextDay(), type: 'tok' as const, amount: tokens },
    ];

    let minRemaining = Infinity;

    for (const check of checks) {
      if (check.limit && check.limit > 0 && check.amount > 0) {
        const rKey = this.getRedisKey(provider, config.key, check.interval, check.type);
        const currentUsage = await redis.incrby(rKey, check.amount);
        if (currentUsage === check.amount) {
          await redis.expire(rKey, check.ttl);
        }

        // If it's a request check, we return the remaining requests
        if (check.type === 'req') {
          const remaining = Math.max(0, check.limit - currentUsage);
          if (remaining < minRemaining) minRemaining = remaining;
        }
      }
    }

    return minRemaining === Infinity ? 999999 : minRemaining; // 999999 = essentially unlimited if no limits set
  }

  /**
   * Checks if ANY of the limits are exhausted.
   * Returns true if the key is fully valid and has remaining quota for all configured limits.
   */
  static async checkRemaining(provider: string, config: KeyLimits): Promise<boolean> {
    const checks = [
      { interval: 'min', limit: config.limitRequestsMin, type: 'req' as const },
      { interval: 'hour', limit: config.limitRequestsHour, type: 'req' as const },
      { interval: 'day', limit: config.limitRequestsDay, type: 'req' as const },
      { interval: 'month', limit: config.limitRequestsMonth, type: 'req' as const },
      { interval: 'min', limit: config.limitTokensMin, type: 'tok' as const },
      { interval: 'day', limit: config.limitTokensDay, type: 'tok' as const },
    ];

    for (const check of checks) {
      if (check.limit && check.limit > 0) {
        const rKey = this.getRedisKey(provider, config.key, check.interval, check.type);
        const usage = await redis.get(rKey);
        if (usage) {
          const used = parseInt(usage, 10);
          if (used >= check.limit) {
            return false; // Exhausted
          }
        }
      }
    }
    return true; // Good to go
  }

  /**
   * Force exhausts the lowest configured limit to instantly trigger a rotation.
   * This is used when the LLM provider hits us with an unexpected 429.
   */
  static async forceExhaust(provider: string, config: KeyLimits): Promise<void> {
    // If we get a 429, we usually assume the minute limit is what triggered it.
    // If no minute limit is configured, we fall back to hour, then day.
    let targetInterval = 'min';
    let targetLimit = config.limitRequestsMin;
    let targetTtl = 60;

    if (!targetLimit) {
      targetInterval = 'hour';
      targetLimit = config.limitRequestsHour;
      targetTtl = this.getSecondsToNextHour();
    }

    if (!targetLimit) {
      targetInterval = 'day';
      targetLimit = config.limitRequestsDay;
      targetTtl = this.getSecondsToNextDay();
    }

    if (targetLimit) {
      const rKey = this.getRedisKey(provider, config.key, targetInterval, 'req');
      await redis.setex(rKey, targetTtl, targetLimit);
    }
  }

  /**
   * Gathers status across the most strict horizon for UI reporting.
   */
  static async getStatus(provider: string, configs: KeyLimits[]): Promise<QuotaStatus[]> {
    const statuses: QuotaStatus[] = [];

    for (const config of configs) {
      // Find the most immediate limit (usually Min) to show on the UI.
      // If Min is exhausted, show Min. Otherwise show whatever is closest to exhaustion.

      const checks = [
        { interval: 'MINUTE', raw: 'min', limit: config.limitRequestsMin },
        { interval: 'HOUR', raw: 'hour', limit: config.limitRequestsHour },
        { interval: 'DAY', raw: 'day', limit: config.limitRequestsDay },
        { interval: 'MONTH', raw: 'month', limit: config.limitRequestsMonth },
      ];

      let mostUrgent: QuotaStatus | null = null;
      let minPercentage = Infinity;

      for (const check of checks) {
        if (check.limit && check.limit > 0) {
          const rKey = this.getRedisKey(provider, config.key, check.raw, 'req');
          const usage = await redis.get(rKey);
          const ttl = await redis.ttl(rKey);

          const used = usage ? parseInt(usage, 10) : 0;
          const remaining = Math.max(0, check.limit - used);
          const percentageRemaining = remaining / check.limit;

          if (percentageRemaining < minPercentage) {
            minPercentage = percentageRemaining;
            mostUrgent = {
              key: config.name || (config.key.substring(0, 8) + '***'),
              provider,
              limitType: check.interval as any,
              requestsRemaining: remaining,
              requestsLimit: check.limit,
              resetsInSeconds: ttl > 0 ? ttl : 0
            };
          }
        }
      }

      if (mostUrgent) {
        statuses.push(mostUrgent);
      } else {
        // If no limits exist, show unlimited
        statuses.push({
          key: config.name || (config.key.substring(0, 8) + '***'),
          provider,
          limitType: 'MINUTE',
          requestsRemaining: 999999,
          requestsLimit: 999999,
          resetsInSeconds: 0
        });
      }
    }

    return statuses;
  }
}
