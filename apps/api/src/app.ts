import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import documentRoutes from './modules/document/document.routes';
import tenantRoutes from './modules/tenant/tenant.routes';
import chatRoutes from './modules/chat/chat.routes';
import systemRoutes from './modules/system/system.routes';
import { createWorker } from './core/queue/bullmq';
import { documentProcessor } from './modules/document/document.worker';

dotenv.config();

const app: express.Application = express();

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}

export default app;
