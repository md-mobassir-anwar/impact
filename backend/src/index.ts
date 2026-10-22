import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initializeDatabase, getDb } from './database';
import { isDemoDataLoaded, loadDemoData } from './services/demo-data';

import ordersRouter from './routes/orders';
import agentsRouter from './routes/agents';
import optimizationRouter from './routes/optimization';
import simulationRouter from './routes/simulation';
import analyticsRouter from './routes/analytics';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'RouteWise backend', timestamp: new Date().toISOString() });
});

// Mount route handlers
app.use('/api/orders', ordersRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/optimize', optimizationRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);

// Notification route aliases so both /api/notifications and /api/settings/notifications work
app.use('/api', settingsRouter);

// 404 handler for undefined routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled RouteWise server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Initialize database and optionally seed demo data if empty
const db = initializeDatabase();
if (!isDemoDataLoaded(db)) {
  const existingOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  if (existingOrders.count === 0) {
    loadDemoData(db);
    console.log('Seeded demo dataset for RouteWise');
  }
}

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`RouteWise backend running on port ${PORT}`);
  });
}

export default app;
