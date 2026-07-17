import { AiProvider } from './ai-provider.interface';
import { KeyRotator } from '../utils/key-rotator.util';

export class OpenRouterProvider implements AiProvider {
  name = 'openrouter';
  private rotator = new KeyRotator('OpenRouter');
  private baseUrl = 'https://openrouter.ai/api/v1';
  private model = 'meta-llama/llama-3.3-70b-instruct:free';

  async generateTopic(message: string): Promise<string> {
    try {
      return await this.rotator.executeWithRotation(50, async (key) => {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
            'X-Title': 'Antigravity RAG' // Required by OpenRouter
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: `Summarize the main topic of this query in 1 to 3 words. Title case it. Do not use punctuation. Query: "${message}"` }],
            temperature: 0.3
          })
        });

        if (!response.ok) throw new Error(`OpenRouter API Error: ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content.trim();
      });
    } catch (e) {
      console.warn("OpenRouter generateTopic failed, falling back to default.", e);
      return "General Search";
    }
  }

  async classifyIntent(message: string): Promise<'simple' | 'complex'> {
    try {
      return await this.rotator.executeWithRotation(50, async (key) => {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Antigravity RAG'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: `Classify the following user query as "simple" (requires factual lookup from documents) or "complex" (requires deep reasoning, summarization, or synthesis). Only output "simple" or "complex".\n\nQuery: ${message}` }],
            temperature: 0.1
          })
        });

        if (!response.ok) throw new Error(`OpenRouter API Error: ${response.status}`);
        const data = await response.json();
        const text = data.choices[0].message.content.trim().toLowerCase();
        return text.includes('complex') ? 'complex' : 'simple';
      });
    } catch (e) {
      return 'simple';
    }
  }

  async streamChat(prompt: string, history: any[], onChunk: (chunk: string) => void): Promise<string> {
    try {
      return await this.rotator.executeWithRotation(1000, async (key) => {
        const systemInstruction = `
You are Antigravity RAG, an expert AI assistant.
CRITICAL INSTRUCTIONS:
- You must strictly answer questions based ONLY on the provided context.
- If the context does not contain the answer, politely decline.
- Maintain a helpful, highly professional tone.
- FORMATTING: Always format your answers beautifully using Markdown. Use tables when comparing data, use bullet points for lists, and use **bold text** to highlight key terms.
- CONCISENESS & TONE: Be extremely clean and direct. NEVER use generic, robotic introductory phrases like "Based on the provided documents". Speak confidently and naturally.
- NEVER introduce yourself as an AI or language model. Do not say "As an AI language model..." or "I don't have personal opinions...". Just answer the question.
`;

        const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts[0].text
          })),
          { role: 'user', content: prompt }
        ];

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Antigravity RAG'
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            stream: true
          })
        });

        if (!response.ok) throw new Error(`OpenRouter API Error: ${response.status}`);
        if (!response.body) throw new Error('No response body from OpenRouter');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkText = decoder.decode(value, { stream: true });
          const lines = chunkText.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line === 'data: [DONE]') continue;
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                const text = parsed.choices[0]?.delta?.content || '';
                fullResponse += text;
                if (text) onChunk(text);
              } catch (e) {
                console.warn('Failed to parse OpenRouter chunk:', line);
              }
            }
          }
        }

        return fullResponse;
      });
    } catch (error) {
      console.error('[OpenRouterProvider] streamChat error:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('OpenRouter does not currently support embeddings reliably. Use Gemini, HuggingFace, or Ollama.');
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    throw new Error('OpenRouter does not currently support embeddings reliably. Use Gemini, HuggingFace, or Ollama.');
  }

  async getQuotaStatuses() {
    return await this.rotator.getQuotaStatuses();
  }
}
