import { Job } from 'bullmq';
import { prisma } from '../../core/db/prisma';
import { AiFactory } from '../../core/ai/ai.factory';
import { CheerioCrawler, Dataset, EnqueueStrategy } from 'crawlee';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { convert } from 'html-to-text';
import fs from 'fs';
import path from 'path';

export const crawlProcessor = async (job: Job) => {
  const { documentId, url, tenantId } = job.data;

  try {
    const document = await prisma.document.findUnique({ where: { id: documentId } });

    if (!document || document.status === "PROCESSING" || document.status === "COMPLETED") {
      console.log(`Document ${documentId} not found, or already processed/processing.`);
      return;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', error: null }
    });

    // Idempotency: Delete any existing chunks
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    });

    let extractedText = '';

    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: 50, // Limit deep crawl to 50 pages to prevent infinite loops
      async requestHandler({ request, $, enqueueLinks }) {
        console.log(`[Crawler] Processing ${request.url}...`);

        // Extract plain text from HTML, ignoring nav, footer, scripts, styles
        const html = $.html();
        const text = convert(html, {
          selectors: [
            { selector: 'nav', format: 'skip' },
            { selector: 'footer', format: 'skip' },
            { selector: 'script', format: 'skip' },
            { selector: 'style', format: 'skip' },
            { selector: 'img', format: 'skip' },
            { selector: 'a', options: { ignoreHref: true } }
          ]
        });

        if (text.trim().length > 0) {
          extractedText += `\n\n--- Source: ${request.url} ---\n\n${text}`;
        }

        // Deep crawl: Enqueue links strictly on the same domain
        await enqueueLinks({
          strategy: EnqueueStrategy.SameDomain
        });
      },
      failedRequestHandler({ request }) {
        console.warn(`[Crawler] Failed to scrape ${request.url}`);
      }
    });

    console.log(`[Crawler] Starting deep crawl for ${url}`);
    await crawler.run([url]);
    console.log(`[Crawler] Finished deep crawl. Extracted ${extractedText.length} characters.`);

    if (extractedText.length === 0) {
      throw new Error('No readable text found on the provided website.');
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(extractedText);

    const validChunks = chunks.map(c => {
      let cleanContent = c.replace(/\x00/g, '');
      return Buffer.from(cleanContent, 'utf8').toString('utf8');
    }).filter(c => c.trim().length > 0);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let lastProviderUsed = '';

    for (let i = 0; i < validChunks.length; i += 100) {
      if (i > 0 && lastProviderUsed !== 'ollama') {
        console.log(`Rate limit protection: Pausing for 60 seconds before processing chunk ${i}...`);
        await delay(10000);
      }

      const batch = validChunks.slice(i, i + 100);
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
            await delay(60000);
            retries++;
          } else {
            throw err;
          }
        }
      }

      if (!success || !embeddings.length) {
        throw new Error('Failed to generate embeddings after 3 retries.');
      }

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

  } catch (error: any) {
    console.error('Website crawling failed:', error);

    const safeErrorMessage = String(error.message || 'Unknown crawling error')
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
  } finally {
    // Automatically delete the crawlee storage folder to save disk space
    try {
      const storagePath = path.join(process.cwd(), 'storage');
      if (fs.existsSync(storagePath)) {
        fs.rmSync(storagePath, { recursive: true, force: true });
        console.log('[Crawler] Purged local storage cache to save space.');
      }
    } catch (e) {
      console.warn('[Crawler] Could not delete storage cache:', e);
    }
  }
};
