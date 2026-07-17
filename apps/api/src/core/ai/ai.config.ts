export type ProviderName = 'groq' | 'openrouter' | 'cohere' | 'gemini' | 'ollama' | 'huggingface' | 'jina';

export const AI_CONFIG = {
  // Embeddings priority (Index 0 is primary, 1 is fallback, etc.)
  // WARNING: All providers here MUST output 768 dimensions to match the DB schema.
  embeddings: [
    // 'huggingface',
    // 'gemini',
    'ollama'
  ] as ProviderName[],

  // Chat Generation priority (Index 0 is primary, 1 is fallback, etc.)
  chat: [
    'groq',
    'openrouter',
    'cohere',
    'gemini',
    'ollama'
  ] as ProviderName[],

  // Reranking priority (Index 0 is primary, 1 is fallback, etc.)
  rerank: [
    'jina',
    'cohere'
  ] as ProviderName[]
};
