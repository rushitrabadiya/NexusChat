export interface AiProvider {
  /**
   * Identifies the provider name (e.g., 'gemini', 'ollama')
   */
  name: string;

  /**
   * Generates a 1-3 word topic summary for the query
   */
  generateTopic(message: string): Promise<string>;

  /**
   * Generates a simple 'simple' | 'complex' intent classification
   */
  classifyIntent(message: string): Promise<'simple' | 'complex'>;

  /**
   * Streams the chat response back via chunks
   * Note: The embeddings and PGVector similarity search happens BEFORE this is called.
   * This simply handles the LLM generation.
   */
  streamChat(
    prompt: string,
    history: any[],
    onChunk: (chunk: string) => void
  ): Promise<string>;

  /**
   * Generates a single vector embedding for a query string
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generates a batch of vector embeddings for document chunks
   */
  generateEmbeddingsBatch(texts: string[]): Promise<number[][]>;

  /**
   * (Optional) Re-ranks a list of documents based on relevance to a query
   */
  rerank?(query: string, documents: string[], topN: number): Promise<string[]>;

  /**
   * (Optional) Returns the quota statuses for the provider's API keys
   */
  getQuotaStatuses?(): Promise<import('../utils/quota-tracker.util').QuotaStatus[]>;
}
