import { Hono } from 'hono';
import { fetchLogo } from '../handlers/logo.js';

const logo = new Hono();

// GET /api/logo/:symbol - Proxy logo from LogoKit
logo.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol');
  console.log(`[Logo Route] Fetching logo for: ${symbol}`);

  const result = await fetchLogo(symbol);

  if (!result) {
    // Return a transparent 1x1 PNG as fallback
    const transparent1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    return c.body(transparent1x1, 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    });
  }

  return c.body(result.buffer, 200, {
    'Content-Type': result.contentType || 'image/png',
    'Cache-Control': 'public, max-age=86400',
  });
});

export default logo;
