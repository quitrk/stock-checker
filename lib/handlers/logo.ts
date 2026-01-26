import { getCached, setCache, cacheKey } from '../services/CacheService.js';

export interface LogoResult {
  buffer: Buffer;
  contentType: string | null;
}

interface CachedLogo {
  data: string; // base64 encoded image data
  contentType: string | null;
}


export async function fetchLogo(symbol: string): Promise<LogoResult | null> {
  const upperSymbol = symbol.toUpperCase();
  const logoCacheKey = cacheKey('logo', upperSymbol);

  // Check cache first
  const cached = await getCached<CachedLogo>(logoCacheKey);
  if (cached) {
    console.log(`[Logo] Cache hit for ${upperSymbol}`);
    return {
      buffer: Buffer.from(cached.data, 'base64'),
      contentType: cached.contentType,
    };
  }

  const logoKitToken = process.env.LOGOKIT_TOKEN;
  if (!logoKitToken) {
    console.log('[Logo] No LOGOKIT_TOKEN configured');
    return null;
  }

  const logoUrl = `https://img.logokit.com/ticker/${upperSymbol}?token=${logoKitToken}`;

  try {
    const response = await fetch(logoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      console.log(`[Logo] Failed to fetch ${upperSymbol}: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');

    // Cache the logo
    const cacheData: CachedLogo = {
      data: buffer.toString('base64'),
      contentType,
    };
    await setCache(logoCacheKey, cacheData, 0);
    console.log(`[Logo] Cached ${upperSymbol}`);

    return { buffer, contentType };
  } catch (error) {
    console.log(`[Logo] Error fetching ${upperSymbol}:`, error);
    return null;
  }
}
