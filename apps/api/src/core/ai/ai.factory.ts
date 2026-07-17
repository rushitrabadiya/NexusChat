import { AiProvider } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { CohereProvider } from './providers/cohere.provider';
import { HuggingFaceProvider } from './providers/huggingface.provider';
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
      huggingface: new HuggingFaceProvider()
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
    return this.executeChain(AI_CONFIG.embeddings, operation);
  }

  /**
   * Executes a chat operation by cascading through the AI_CONFIG.chat array.
   */
  async executeChat<T>(operation: (provider: AiProvider) => Promise<T>): Promise<{ result: T, providerUsed: string }> {
    return this.executeChain(AI_CONFIG.chat, operation);
  }

  private async executeChain<T>(chain: ProviderName[], operation: (provider: AiProvider) => Promise<T>): Promise<{ result: T, providerUsed: string }> {
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
  }
}
