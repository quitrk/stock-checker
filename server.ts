import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './lib/routes/auth.js';
import checklistRoutes from './lib/routes/checklist.js';
import watchlistRoutes from './lib/routes/watchlist.js';

const app = new Hono();

app.use('/*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/checklist', checklistRoutes);
app.route('/api/watchlist', watchlistRoutes);

export default app;
