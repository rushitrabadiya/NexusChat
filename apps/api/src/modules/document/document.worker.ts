import { Job } from 'bullmq';
import { prisma } from '../../core/db/prisma';
import { AiFactory } from '../../core/ai/ai.factory';
import { OllamaProvider } from '../../core/ai/providers/ollama.provider';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export const documentProcessor = async (job: Job) => {
  const { documentId, filePath, fileType, tenantId } = job.data;

  try {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', error: null }
    });

    // Idempotency: Delete any existing chunks for this document in case of a retry
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    });

    let extractedText = '';
    const fileBuffer = fs.readFileSync(filePath);

    if (fileType === 'application/pdf') {
      const data = await pdfParse(fileBuffer);
      extractedText = data.text;
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const data = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = data.value;
    } else if (fileType === 'application/json') {
      const data = JSON.parse(fileBuffer.toString());
      extractedText = JSON.stringify(data);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    const chunkSize = 1000;
    const overlap = 200;
    const chunks: string[] = [];

    let i = 0;
    while (i < extractedText.length) {
      chunks.push(extractedText.substring(i, i + chunkSize));
      i += chunkSize - overlap;
    }

    const validChunks = chunks.map(c => {
      let cleanContent = c.replace(/\x00/g, '');
      return Buffer.from(cleanContent, 'utf8').toString('utf8');
    }).filter(c => c.trim().length > 0);

    // Helper to pause execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let lastProviderUsed = '';

    // Process in batches of 100 to avoid Gemini 15 RPM free tier rate limits
    for (let i = 0; i < validChunks.length; i += 100) {
      // Only pause if we previously used a cloud provider that requires rate limiting (Gemini)
      if (i > 0 && lastProviderUsed !== 'ollama') {
        console.log(`Rate limit protection: Pausing for 60 seconds before processing chunk ${i}...`);
        await delay(10000);
      }

      const batch = validChunks.slice(i, i + 100);
      console.log(`Processing batch ${i} to ${i + batch.length} of ${validChunks.length}`);

      let embeddings: number[][] = [];
      let success = false;
      let retries = 0;

      while (!success && retries < 3) {
        try {
          const embeddingsResult = await AiFactory.getInstance().executeEmbedding(provider => provider.generateEmbeddingsBatch(batch));
          embeddings = embeddingsResult.result;
          lastProviderUsed = embeddingsResult.providerUsed;
          success = true;
        } catch (err: any) {
          if (err.status === 429 || err.message?.includes('429') || err.message?.includes('Quota')) {
            console.log(`Global rate limit hit (429)! Pausing for 60s before retrying batch ${i}...`);
            await delay(60000);
            retries++;
          } else {
            throw err;
          }
        }
      }

      if (!success || !embeddings.length) {
        throw new Error('Failed to generate embeddings after 3 retries due to Google rate limits.');
      }

      // Execute all inserts concurrently for massive speedup without breaking Prisma's array binding
      await Promise.all(
        batch.map((content, j) => {
          const embedding = embeddings[j];
          return prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (id, "documentId", "tenantId", content, embedding, "createdAt")
            VALUES (gen_random_uuid(), ${documentId}, ${tenantId}, ${content}, ${embedding}::vector, now())
          `;
        })
      );
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'COMPLETED' }
    });

    fs.unlinkSync(filePath);

  } catch (error: any) {
    console.error('Document processing failed:', error);

    // Sanitize the error message just in case it contains the broken text that caused the crash
    const safeErrorMessage = String(error.message || 'Unknown processing error')
      .replace(/[\x00\uD800-\uDFFF]/g, '')
      .substring(0, 500);

    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          error: safeErrorMessage
        }
      });
    } catch (fallbackError) {
      console.error('Failed to update document status to FAILED:', fallbackError);
    }
  }
};
