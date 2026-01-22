import { serve } from '@hono/node-server';
import app from './server.js';

const port = 3002;

console.log(`API server running at http://localhost:${port}`);
console.log(`Cache: ${process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis enabled' : 'disabled (no credentials)'}`);

serve({ fetch: app.fetch, port });
