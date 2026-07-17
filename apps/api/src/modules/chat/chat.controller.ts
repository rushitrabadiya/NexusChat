import { Request, Response } from 'express';
import { prisma } from '../../core/db/prisma';
import { AiFactory } from '../../core/ai/ai.factory';
import { OllamaProvider } from '../../core/ai/providers/ollama.provider';
import { redis } from '../../core/cache/redis.service';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export const streamChat = async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { message, chatSessionId } = req.body;

  if (!tenantId || !message) {
    return res.status(400).json({ error: 'Tenant ID and message are required' });
  }

  try {
    let session;
    if (chatSessionId) {
      session = await prisma.chatSession.findUnique({ where: { id: chatSessionId } });
      if (!session || session.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
    } else {
      session = await prisma.chatSession.create({
        data: {
          tenantId,
          title: message.substring(0, 50)
        }
      });
    }

    await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: 'USER',
        content: message
      }
    });


    // FAST CACHE CHECK
    const cacheKey = `chat:${tenantId}:${Buffer.from(message.toLowerCase().trim()).toString('base64')}`;
    const cachedResponse = await redis.get(cacheKey);

    if (cachedResponse) {
      const parsedCache = JSON.parse(cachedResponse);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      res.write(`data: ${JSON.stringify({ type: 'session', sessionId: session.id })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'model', model: parsedCache.modelUsed + ' (cached)' })}\n\n`);

      // Simulate streaming the cached chunk instantly
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: parsedCache.content })}\n\n`);

      if (parsedCache.sources && parsedCache.sources.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'sources', sources: parsedCache.sources })}\n\n`);
      }

      await prisma.chatMessage.create({
        data: {
          chatSessionId: session.id,
          role: 'AI',
          content: parsedCache.content,
          modelUsed: parsedCache.modelUsed + ' (cached)',
          sources: parsedCache.sources
        }
      });

      res.write('data: [DONE]\n\n');
      return res.end();
    }

    let chunks: any[] = [];
    try {
      const embeddingResult = await AiFactory.getInstance().executeEmbedding(provider => provider.generateEmbedding(message));
      const embedding = embeddingResult.result;
      chunks = await prisma.$queryRaw`
        SELECT dc.id, dc.content, 1 - (dc.embedding <=> ${embedding}::vector) as similarity, d.filename as source
        FROM "DocumentChunk" dc
        JOIN "Document" d ON dc."documentId" = d.id
        WHERE dc."tenantId" = ${tenantId}
        ORDER BY dc.embedding <=> ${embedding}::vector
        LIMIT 15;
      `;
    } catch (e: any) {
      console.warn("[Embeddings] Failed to fetch embeddings from Ollama, proceeding in Local Mode without RAG context...", e.message);
    }

    // let cleanTopic = 'Result';
    // try {
    //   const topicResult = await AiFactory.getInstance().execute(provider => provider.generateTopic(message));
    //   cleanTopic = topicResult.result;
    // } catch (error) {
    //   console.warn("Failed to generate topic with AI, falling back to default.");
    // }

    const uniqueSources = Array.from(new Set(chunks.map(c => c.source).filter(Boolean)));
    // const sourcesWithTopic = uniqueSources.map(source => `${cleanTopic} | ${source}`);
    const contextText = chunks.map(c => `[Source Document: ${c.source}]\n${c.content}`).join('\n\n---\n\n');

    const history = await prisma.chatMessage.findMany({
      where: { chatSessionId: session.id },
      orderBy: { createdAt: 'asc' }
    });

    const formattedHistory = history.map(msg => ({
      role: msg.role === 'USER' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const prompt = `---CONTEXT---\n${contextText}\n\n---USER INPUT---\n${message}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ type: 'session', sessionId: session.id })}\n\n`);

    // if (sourcesWithTopic.length > 0) {
    //   res.write(`data: ${JSON.stringify({ type: 'sources', sources: sourcesWithTopic })}\n\n`);
    // }

    let fullResponse = '';
    let usedModel = 'gemini';

    try {
      const result = await AiFactory.getInstance().executeChat(async (provider) => {
        // Send the actual provider name to the UI right before streaming begins
        res.write(`data: ${JSON.stringify({ type: 'model', model: provider.name })}\n\n`);

        return provider.streamChat(prompt, formattedHistory.slice(0, -1), (chunkText) => {
          fullResponse += chunkText;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
        });
      });
      usedModel = result.providerUsed;
    } catch (error: unknown) {
      console.error(error);
      throw error;
    }

    await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: 'AI',
        content: fullResponse,
        modelUsed: usedModel,
        sources: uniqueSources,
        // sources: sourcesWithTopic
      }
    });

    // Save to Redis Cache (expire in 24 hours)
    await redis.setex(cacheKey, 86400, JSON.stringify({
      content: fullResponse,
      modelUsed: usedModel,
      // sources: sourcesWithTopic
      sources: uniqueSources,
    }));

    // Send sources only AFTER the response finishes streaming
    if (uniqueSources.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'sources', sources: uniqueSources })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error(error);

    let errorMessage = 'Chat processing failed. Please try again.';
    let isRateLimit = false;

    if (error.status === 429 || error.message?.includes('429')) {
      errorMessage = 'Rate limit exceeded. The model is currently experiencing high demand. Please try again in a minute.';
      isRateLimit = true;
    }

    if (!res.headersSent) {
      return res.status(isRateLimit ? 429 : 500).json({ error: errorMessage, isRateLimit });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage, isRateLimit })}\n\n`);
      res.end();
    }
  }
};

export const getChatSessions = async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(400).json({ error: 'Tenant ID is required' });

  try {
    const sessions = await prisma.chatSession.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
    return res.json(sessions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
};

export const getChatMessages = async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { id } = req.params;

  if (!tenantId) return res.status(400).json({ error: 'Tenant ID is required' });

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id, tenantId }
    });
    if (!session) return res.status(404).json({ error: 'Chat session not found' });

    const messages = await prisma.chatMessage.findMany({
      where: { chatSessionId: id },
      orderBy: { createdAt: 'asc' }
    });
    return res.json(messages);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
};
