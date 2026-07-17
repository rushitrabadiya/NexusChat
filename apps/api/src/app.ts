import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import documentRoutes from './modules/document/document.routes';
import tenantRoutes from './modules/tenant/tenant.routes';
import chatRoutes from './modules/chat/chat.routes';
import systemRoutes from './modules/system/system.routes';
import { createWorker, metricsQueue } from './core/queue/bullmq';
import { documentProcessor } from './modules/document/document.worker';
import { crawlProcessor } from './modules/document/crawl.worker';
import { metricsProcessor } from './modules/system/metrics.worker';
import { prisma } from './core/db/prisma';
import { ApiKeyService } from './modules/system/api-key.service';

dotenv.config();

// Global Anti-Crash Handlers
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app: express.Application = express();

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased to 1000 to prevent annoying limits in dev
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use(globalLimiter);

app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/documents', documentRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/system', systemRoutes);

// Start background worker for document processing
createWorker('documentProcessing', documentProcessor);

// Start background worker for URL deep crawling
createWorker('crawlProcessing', crawlProcessor);

// Start background worker for usage metrics syncing
createWorker('metricsProcessing', metricsProcessor);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;

async function initializeDatabaseIndices() {
  try {
    console.log('[DB] Ensuring performance indexes exist...');

    // GIN Index for lightning fast Full-Text Search (BM25)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS documentchunk_content_idx 
      ON "DocumentChunk" USING GIN (to_tsvector('english', content));
    `);

    // HNSW Index for ultra-fast Vector Similarity Search
    // Requires pgvector >= 0.5.0. 'vector_cosine_ops' matches our <=> operator
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS documentchunk_embedding_idx 
      ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
    `);

    console.log('[DB] Performance indexes ready.');
  } catch (error: any) {
    console.warn('[DB] Could not create advanced indexes (may require pgvector update or already exist):', error.message);
  }
}

if (require.main === module) {
  initializeDatabaseIndices().then(async () => {
    // 1. Sync API Keys to Redis on startup
    await ApiKeyService.syncToRedis();

    // 2. Schedule the distributed BullMQ cron job to flush metrics every 1 minute
    await metricsQueue.add(
      'flushMetrics',
      {},
      { repeat: { pattern: '* * * * *' } }
    );

    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  });
}

export default app;
