import { AiProvider } from './ai-provider.interface';

export class OllamaProvider implements AiProvider {
  name = 'ollama-fallback';
  private baseUrl = 'http://localhost:11434/api';
  // Model Configuration Options
  // private model = 'qwen2:0.5b'; // Extremely fast, lightweight model (0.5B) - Best for speed
  // private model = 'llama3.2:1b'; // Fast, lightweight LLaMA model (1B) - Good balance
  private model = 'llama3.2'; // Highly capable 3B/8B model for better reasoning - Slower on local hardware

  async generateTopic(message: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `Summarize the main topic of this query in 1 to 3 words. Title case it. Do not use punctuation. Query: "${message}"`,
          stream: false
        })
      });

      if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
      const data = await response.json();
      return data.response.trim();
    } catch (error) {
      console.error('[Ollama] Failed to generate topic:', error);
      throw error;
    }
  }

  async classifyIntent(query: string): Promise<'simple' | 'complex'> {
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `Classify the following user query as "simple" (requires factual lookup from documents) or "complex" (requires deep reasoning, summarization, or synthesis). Only output "simple" or "complex".\n\nQuery: ${query}`,
          stream: false
        })
      });

      if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
      const data = await response.json();
      const text = data.response.trim().toLowerCase();
      return text.includes('complex') ? 'complex' : 'simple';
    } catch (error) {
      console.error('[Ollama] Failed to classify intent:', error);
      throw error; // Let factory handle it
    }
  }

  async streamChat(prompt: string, history: any[], onChunk: (chunk: string) => void): Promise<string> {
    const systemInstruction = `
You are Antigravity RAG, an expert AI assistant.
CRITICAL INSTRUCTIONS:
- You must strictly answer questions based ONLY on the provided context.
- If the context does not contain the answer, politely decline.
- Maintain a helpful, highly professional tone.
- FORMATTING: Always format your answers beautifully using Markdown. Use tables when comparing data, use bullet points for lists, and use **bold text** to highlight key terms.
- CONCISENESS & TONE: Be extremely clean and direct. NEVER use generic, robotic introductory phrases like "Based on the provided documents". Speak confidently and naturally.
`;

    // Map history to Ollama format
    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.parts[0].text
      })),
      { role: 'user', content: prompt }
    ];

    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true
        })
      });

      if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
      if (!response.body) throw new Error('No response body from Ollama');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        // Ollama sends JSON strings separated by newlines
        const lines = chunkText.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              const text = parsed.message.content;
              fullResponse += text;
              onChunk(text);
            }
          } catch (e) {
            console.warn('Failed to parse Ollama chunk:', line);
          }
        }
      }

      return fullResponse;
    } catch (error) {
      console.error('[Ollama] Failed to stream chat:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama Embedding Error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('[Ollama] Failed to generate embedding:', error);
      throw error;
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          input: texts
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama Batch Embedding Error: ${response.status}`);
      }

      const data = await response.json();
      return data.embeddings;
    } catch (error) {
      console.error('[Ollama] Failed batch embedding:', error);
      throw error;
    }
  }
}
