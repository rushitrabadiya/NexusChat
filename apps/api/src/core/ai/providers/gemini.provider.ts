import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiProvider } from './ai-provider.interface';
import { KeyRotator } from '../utils/key-rotator.util';

export class GeminiProvider implements AiProvider {
  name = 'gemini';
  private rotator = new KeyRotator('GEMINI_API_KEY', 'Gemini');

  async generateTopic(message: string): Promise<string> {
    try {
      return await this.rotator.executeWithRotation(async (key) => {
        const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const prompt = `Summarize the main topic of this query in 1 to 3 words. Title case it. Do not use punctuation. Query: "${message}"`;
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      });
    } catch (e) {
      console.warn("Gemini generateTopic failed, falling back to default.", e);
      return "General Search";
    }
  }

  async classifyIntent(query: string): Promise<'simple' | 'complex'> {
    try {
      return await this.rotator.executeWithRotation(async (key) => {
        const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const prompt = `Classify the following user query as "simple" (requires factual lookup from documents) or "complex" (requires deep reasoning, summarization, or synthesis). Only output "simple" or "complex".\n\nQuery: ${query}`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        return text.includes('complex') ? 'complex' : 'simple';
      });
    } catch (e) {
      return 'simple';
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

    return await this.rotator.executeWithRotation(async (key) => {
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite', systemInstruction });
      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(prompt);

      let fullResponse = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        onChunk(chunkText);
      }

      return fullResponse;
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return await this.rotator.executeWithRotation(async (key) => {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-embedding-001" });
      const result = await model.embedContent({
        content: { parts: [{ text }], role: 'user' },
        // @ts-ignore - Using undocumented parameter to force 768 dimensions to match DB schema and Ollama
        outputDimensionality: 768
      });
      return result.embedding.values;
    });
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    // Doing sequentially to reuse fallback/retry logic
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }
}
