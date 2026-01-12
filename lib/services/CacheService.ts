import { Redis } from '@upstash/redis';

const CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('[Cache] Upstash credentials not configured, caching disabled');
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get<T>(key);
    if (data) {
      console.log(`[Cache] HIT: ${key}`);
      return data;
    }
    console.log(`[Cache] MISS: ${key}`);
    return null;
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, data, { ex: CACHE_TTL_SECONDS });
    console.log(`[Cache] SET: ${key} (TTL: ${CACHE_TTL_SECONDS}s)`);
  } catch (error) {
    console.error('[Cache] Error writing cache:', error);
  }
}

export function cacheKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier.toUpperCase()}`;
}
