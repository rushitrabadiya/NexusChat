import { QuotaTracker, QuotaStatus, KeyLimits } from './quota-tracker.util';
import { redis } from '../../cache/redis.service';
import { CryptoUtil } from '../../security/crypto.util';

export class KeyRotator {
  private currentIndex: number = 0;
  private providerName: string;

  constructor(providerName: string) {
    this.providerName = providerName.toLowerCase();
  }

  /**
   * Fetches the dynamic configuration for this provider from Redis (which is synced from DB)
   */
  private async getConfigs(): Promise<KeyLimits[]> {
    const raw = await redis.get(`system:apikeys:${this.providerName}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as KeyLimits[];
    } catch (e) {
      console.error(`[KeyRotator] Failed to parse configs for ${this.providerName}`);
      return [];
    }
  }

  /**
   * Gets the quota status for all keys configured in this rotator
   */
  async getQuotaStatuses(): Promise<QuotaStatus[]> {
    const configs = await this.getConfigs();
    if (configs.length === 0) return [];
    return await QuotaTracker.getStatus(this.providerName, configs);
  }

  /**
   * Executes an API call, preemptively checking Redis quotas and automatically rotating 
   * through all available keys if a local quota is exhausted or if a 429 Rate Limit occurs.
   * estimatedTokens can be passed to check and deduct against token-based rate limits.
   */
  async executeWithRotation<T>(estimatedTokens: number = 0, operation: (key: string) => Promise<T>): Promise<T> {
    try {
      const configs = await this.getConfigs();

      if (configs.length === 0) {
        throw new Error(`[${this.providerName}] No API keys found in Database. Please configure them in the Admin Dashboard.`);
      }

      let attempts = 0;
      let lastError: any;

      while (attempts < configs.length) {
        // Ensure current index is in bounds (in case keys were deleted)
        this.currentIndex = this.currentIndex % configs.length;
        const currentConfig = configs[this.currentIndex];

        // PREEMPTIVE CHECK: Do we have enough quota in Redis across all intervals?
        const isAvailable = await QuotaTracker.checkRemaining(this.providerName, currentConfig);

        if (!isAvailable) {
          console.log(`[${this.providerName}] Local quota preemptively exhausted for key ${currentConfig.key.substring(0, 5)}***. Rotating...`);
          this.currentIndex = (this.currentIndex + 1) % configs.length;
          attempts++;
          continue; // Skip the API call entirely and try the next key
        }

        try {
          // Record the usage BEFORE making the call (optimistic tracking)
          await QuotaTracker.recordUsage(this.providerName, currentConfig, estimatedTokens);

          // Decrypt the key right before handing it to the AI model
          const plainTextKey = CryptoUtil.decrypt(currentConfig.key);

          return await operation(plainTextKey);
        } catch (error: any) {
          lastError = error;
          const isRateLimit = error.status === 429 || error.message?.includes('429');

          if (isRateLimit) {
            console.warn(`[${this.providerName}] ACTUAL API Rate limit hit on key ${currentConfig.key.substring(0, 5)}***. Forcing local quota sync to 0...`);

            // As requested by the user: if the API hits us with a 429, we force our local Redis tracker to 0
            await QuotaTracker.forceExhaust(this.providerName, currentConfig);

            this.currentIndex = (this.currentIndex + 1) % configs.length;
            attempts++;
          } else {
            // If it's not a rate limit error, fail immediately (e.g., Auth error, Bad Request)
            throw error;
          }
        }
      }

      throw new Error(`[${this.providerName}] All API keys exhausted due to rate limits. Last Error: ${lastError?.message}`);
    } catch (globalError) {
      console.error(`[KeyRotator] Fatal error in executeWithRotation for ${this.providerName}:`, globalError);
      throw globalError;
    }
  }
}
