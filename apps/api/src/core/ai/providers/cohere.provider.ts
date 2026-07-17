import { AiProvider } from './ai-provider.interface';
import { KeyRotator } from '../utils/key-rotator.util';

export class CohereProvider implements AiProvider {
  name = 'cohere';
  private rotator = new KeyRotator('Cohere');
  private baseUrl = 'https://api.cohere.com/v1';
  private model = 'command-r-08-2024'; // Highly optimized for RAG

  async generateTopic(message: string): Promise<string> {
    try {
      return await this.rotator.executeWithRotation(100, async (key) => {
        const response = await fetch(`${this.baseUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: this.model,
            message: `Summarize the main topic of this query in 1 to 3 words. Title case it. Do not use punctuation. Query: "${message}"`,
            temperature: 0.3
          })
        });

        if (!response.ok) throw new Error(`Cohere API Error: ${response.status}`);
        const data = await response.json();
        return data.text.trim();
      });
    } catch (e) {
      console.warn("Cohere generateTopic failed, falling back to default.", e);
      return "General Search";
    }
  }

  async classifyIntent(query: string): Promise<'simple' | 'complex'> {
    try {
      return await this.rotator.executeWithRotation(100, async (key) => {
        const response = await fetch(`${this.baseUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: this.model,
            message: `Classify the following user query as "simple" (requires factual lookup from documents) or "complex" (requires deep reasoning, summarization, or synthesis). Only output "simple" or "complex".\n\nQuery: ${query}`,
            temperature: 0.1
          })
        });

        if (!response.ok) throw new Error(`Cohere API Error: ${response.status}`);
        const data = await response.json();
        const text = data.text.trim().toLowerCase();
        return text.includes('complex') ? 'complex' : 'simple';
      });
    } catch (e) {
      return 'simple';
    }
  }

  async streamChat(prompt: string, history: any[], onChunk: (chunk: string) => void): Promise<string> {
    try {
      const preamble = `
You are Antigravity RAG, an expert AI assistant.
CRITICAL INSTRUCTIONS:
- You must strictly answer questions based ONLY on the provided context.
- If the context does not contain the answer, politely decline.
- Maintain a helpful, highly professional tone.
- FORMATTING: Always format your answers beautifully using Markdown. Use tables when comparing data, use bullet points for lists, and use **bold text** to highlight key terms.
- CONCISENESS & TONE: Be extremely clean and direct. NEVER use generic, robotic introductory phrases like "Based on the provided documents". Speak confidently and naturally.
- NEVER introduce yourself as an AI or language model. Do not say "As an AI language model..." or "I don't have personal opinions...". Just answer the question.
`;

      // Map Gemini history format to Cohere chat_history format
      const chat_history = history.map(msg => ({
        role: msg.role === 'model' ? 'CHATBOT' : 'USER',
        message: msg.parts[0].text
      }));

      return await this.rotator.executeWithRotation(1000, async (key) => {
        const response = await fetch(`${this.baseUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify({
            model: this.model,
            message: prompt,
            chat_history,
            preamble,
            stream: true
          })
        });

        if (!response.ok) throw new Error(`Cohere API Error: ${response.status}`);
        if (!response.body) throw new Error('No response body from Cohere');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkText = decoder.decode(value, { stream: true });
          const lines = chunkText.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.event_type === 'text-generation') {
                const text = parsed.text || '';
                fullResponse += text;
                if (text) onChunk(text);
              }
            } catch (e) {
              // Ignore parse errors on stream metadata
            }
          }
        }

        return fullResponse;
      });
    } catch (error) {
      console.error('[CohereProvider] streamChat error:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('Cohere embeddings are 1024d, which violates the 768d database schema. Use Gemini, HuggingFace, or Ollama.');
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    throw new Error('Cohere embeddings are 1024d, which violates the 768d database schema. Use Gemini, HuggingFace, or Ollama.');
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
            model: 'rerank-english-v3.0',
            query,
            documents,
            top_n: topN
          })
        });

        if (!response.ok) throw new Error(`Cohere Rerank API Error: ${response.status}`);
        const data = await response.json();

        // Cohere returns an array of results with { index, relevance_score }
        return data.results.map((r: any) => documents[r.index]);
      });
    } catch (error) {
      console.error('[CohereProvider] rerank error:', error);
      throw error;
    }
  }

  async getQuotaStatuses() {
    return await this.rotator.getQuotaStatuses();
  }
}
