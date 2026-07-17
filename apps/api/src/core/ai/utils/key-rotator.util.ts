export class KeyRotator {
  private keys: string[];
  private currentIndex: number = 0;
  private providerName: string;

  constructor(envPrefix: string, providerName: string) {
    this.providerName = providerName;
    this.keys = Object.keys(process.env)
      .filter(k => k.startsWith(envPrefix) && process.env[k])
      .map(k => process.env[k] as string);

    if (this.keys.length === 0) {
      console.warn(`[KeyRotator] No API keys found for ${providerName} (Prefix: ${envPrefix}). API calls will fail unless the provider is local.`);
      this.keys = ['']; // Fallback empty key to prevent immediate crashing if unused
    }
  }

  /**
   * Executes an API call, automatically rotating through all available keys if a 429 Rate Limit occurs.
   * Throws an error if all keys are exhausted or if a non-429 error occurs.
   */
  async executeWithRotation<T>(operation: (key: string) => Promise<T>): Promise<T> {
    let attempts = 0;
    let lastError: any;

    while (attempts < this.keys.length) {
      try {
        const currentKey = this.keys[this.currentIndex];
        return await operation(currentKey);
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.status === 429 || error.message?.includes('429');

        if (isRateLimit) {
          console.warn(`[${this.providerName}] Rate limit hit on key index ${this.currentIndex}. Rotating...`);
          this.currentIndex = (this.currentIndex + 1) % this.keys.length;
          attempts++;
        } else {
          // If it's not a rate limit error, fail immediately (e.g., Auth error, Bad Request)
          throw error;
        }
      }
    }

    throw new Error(`[${this.providerName}] All API keys exhausted due to rate limits. Last Error: ${lastError?.message}`);
  }
}
