import { AiProvider } from './ai-provider.interface';
import { KeyRotator } from '../utils/key-rotator.util';

export class JinaProvider implements AiProvider {
  name = 'jina';
  private rotator = new KeyRotator('Jina');
  private baseUrl = 'https://api.jina.ai/v1';

  async generateTopic(message: string): Promise<string> {
    throw new Error('JinaProvider does not support generating topics.');
  }

  async classifyIntent(message: string): Promise<'simple' | 'complex'> {
    throw new Error('JinaProvider does not support intent classification.');
  }

  async streamChat(prompt: string, history: any[], onChunk: (chunk: string) => void): Promise<string> {
    throw new Error('JinaProvider does not support chat streaming.');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('JinaProvider embeddings are not supported in this architecture context.');
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    throw new Error('JinaProvider embeddings are not supported in this architecture context.');
  }

  async rerank(query: string, documents: string[], topN: number): Promise<string[]> {
    try {
      return await this.rotator.executeWithRotation(100, async (key) => {
        const response = await fetch(`${this.baseUrl}/rerank`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'jina-reranker-v2-base-multilingual',
            query,
            documents,
            top_n: topN
          })
        });

        if (!response.ok) throw new Error(`Jina API Error: ${response.status}`);
        const data = await response.json();

        // Jina returns an array of results with { index, relevance_score }
        return data.results.map((r: any) => documents[r.index]);
      });
    } catch (error) {
      console.error('[JinaProvider] rerank error:', error);
      throw error;
    }
  }

  async getQuotaStatuses() {
    return await this.rotator.getQuotaStatuses();
  }
}
