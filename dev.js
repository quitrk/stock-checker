import { serve } from '@hono/node-server';
import app from './server.js';
var port = 3002;
console.log("API server running at http://localhost:".concat(port));
console.log("Cache: ".concat(process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis enabled' : 'disabled (no credentials)'));
serve({ fetch: app.fetch, port: port });
