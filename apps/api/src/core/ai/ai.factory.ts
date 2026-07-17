import { AiProvider } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { CohereProvider } from './providers/cohere.provider';
import { HuggingFaceProvider } from './providers/huggingface.provider';
import { JinaProvider } from './providers/jina.provider';
import { AI_CONFIG, ProviderName } from './ai.config';

export class AiFactory {
  private static instance: AiFactory;
  private providers: Record<ProviderName, AiProvider>;

  private constructor() {
    this.providers = {
      gemini: new GeminiProvider(),
      ollama: new OllamaProvider(),
      groq: new GroqProvider(),
      openrouter: new OpenRouterProvider(),
      cohere: new CohereProvider(),
      huggingface: new HuggingFaceProvider(),
      jina: new JinaProvider()
    };
  }

  public static getInstance(): AiFactory {
    if (!AiFactory.instance) {
      AiFactory.instance = new AiFactory();
    }
    return AiFactory.instance;
  }

  /**
   * Executes an embedding operation by cascading through the AI_CONFIG.embeddings array.
   */
  async executeEmbedding<T>(operation: (provider: AiProvider) => Promise<T>): Promise<{ result: T, providerUsed: string }> {
    try {
      return this.executeChain(AI_CONFIG.embeddings, operation);
    } catch (error) {
      console.error(`[AiFactory] Fatal error executing embedding operation:`, error);
      throw error;
    }
  }

  /**
   * Executes a chat operation by cascading through the AI_CONFIG.chat array.
   */
  async executeChat<T>(operation: (provider: AiProvider) => Promise<T>): Promise<{ result: T, providerUsed: string }> {
    try {
      return this.executeChain(AI_CONFIG.chat, operation);
    } catch (error) {
      console.error(`[AiFactory] Fatal error executing chat operation:`, error);
      throw error;
    }
  }

  /**
   * Executes a rerank operation by cascading through the AI_CONFIG.rerank array.
   */
  async executeRerank<T>(operation: (provider: AiProvider) => Promise<T>): Promise<{ result: T, providerUsed: string }> {
    try {
      return this.executeChain(AI_CONFIG.rerank, operation);
    } catch (error) {
      console.error(`[AiFactory] Fatal error executing rerank operation:`, error);
      throw error;
    }
  }

  private async executeChain<T>(chain: ProviderName[], operation: (provider: AiProvider) => Promise<T>): Promise<{ result: T, providerUsed: string }> {
    try {
      let lastError: any;

      for (const providerName of chain) {
        const provider = this.providers[providerName];
        if (!provider) {
          console.warn(`[AiFactory] Provider ${providerName} is in config but not implemented.`);
          continue;
        }

        try {
          const result = await operation(provider);
          return { result, providerUsed: provider.name };
        } catch (error: any) {
          lastError = error;
          // If it's a rate limit or a "not supported" error, failover to the next in chain.
          // Otherwise, if it's a critical application error, we might want to throw it immediately.
          // For resilience, we'll log the warning and try the next one anyway.
          console.warn(`[AiFactory] Provider '${providerName}' failed. Cascading to next fallback...`, error.message);
        }
      }

      throw new Error(`[AiFactory] All AI providers in the fallback chain failed! Last error: ${lastError?.message}`);
    } catch (factoryError) {
      console.error(`[AiFactory] Fatal error executing provider chain:`, factoryError);
      throw factoryError;
    }
  }

  /**
   * Retrieves the current API Quota statuses for all configured providers.
   */
  async getAllQuotaStatuses() {
    try {
      const statuses = [];
      for (const provider of Object.values(this.providers)) {
        if (provider.getQuotaStatuses) {
          try {
            const providerStatuses = await provider.getQuotaStatuses();
            statuses.push(...providerStatuses);
          } catch (e) {
            console.warn(`[AiFactory] Failed to get quota status for ${provider.name}`, e);
          }
        }
      }
      return statuses;
    } catch (error) {
      console.error(`[AiFactory] Fatal error executing quota status operation:`, error);
      throw error;
    }
  }
}
