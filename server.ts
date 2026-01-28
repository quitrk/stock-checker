import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './lib/routes/auth.js';
import checklistRoutes from './lib/routes/checklist.js';
import watchlistRoutes from './lib/routes/watchlist.js';
import logoRoutes from './lib/routes/logo.js';
import catalystsRoutes from './lib/routes/catalysts.js';
import searchRoutes from './lib/routes/search.js';

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
app.route('/api/logo', logoRoutes);
app.route('/api/catalysts', catalystsRoutes);
app.route('/api/search', searchRoutes);

export default app;
