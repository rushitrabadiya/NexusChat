import { AiProvider } from './ai-provider.interface';
import { KeyRotator } from '../utils/key-rotator.util';

export class HuggingFaceProvider implements AiProvider {
  name = 'huggingface';
  private rotator = new KeyRotator('HuggingFace');
  private baseUrl = 'https://api-inference.huggingface.co/pipeline/feature-extraction';
  private model = 'jinaai/jina-embeddings-v2-base-en'; // Guaranteed 768 dimensions!

  async generateTopic(message: string): Promise<string> {
    throw new Error('HuggingFace provider is configured for embeddings only, not chat.');
  }

  async classifyIntent(query: string): Promise<'simple' | 'complex'> {
    throw new Error('HuggingFace provider is configured for embeddings only, not chat.');
  }

  async streamChat(prompt: string, history: any[], onChunk: (chunk: string) => void): Promise<string> {
    throw new Error('HuggingFace provider is configured for embeddings only, not chat.');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await this.rotator.executeWithRotation(100, async (key) => {
        const response = await fetch(`${this.baseUrl}/${this.model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({ inputs: text })
        });

        if (!response.ok) {
          // HF Inference API sometimes returns 503 while models are loading into memory
          if (response.status === 503) {
            throw new Error('429'); // Hack: force rotation/retry if model is cold loading
          }
          throw new Error(`HuggingFace API Error: ${response.status}`);
        }

        const data = await response.json();
        // Feature extraction sometimes wraps in outer arrays
        return Array.isArray(data[0]) ? data[0] : data;
      });
    } catch (error) {
      console.error('[HuggingFaceProvider] generateEmbedding error:', error);
      throw error;
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      return await this.rotator.executeWithRotation(texts.length * 100, async (key) => {
        const response = await fetch(`${this.baseUrl}/${this.model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({ inputs: texts })
        });

        if (!response.ok) {
          if (response.status === 503) {
            throw new Error('429');
          }
          throw new Error(`HuggingFace API Error: ${response.status}`);
        }

        const data = await response.json();
        return data;
      });
    } catch (error) {
      console.error('[HuggingFaceProvider] generateEmbeddingsBatch error:', error);
      throw error;
    }
  }

  async getQuotaStatuses() {
    return await this.rotator.getQuotaStatuses();
  }
}
