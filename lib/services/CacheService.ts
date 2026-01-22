import { Redis } from '@upstash/redis';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

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
    return await client.get<T>(key);
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
}

export async function setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const expirySeconds = ttl ?? CACHE_TTL_SECONDS;
    await client.set(key, data, expirySeconds === 0 ? undefined : { ex: expirySeconds });
  } catch (error) {
    console.error('[Cache] Error writing cache:', error);
  }
}

export async function deleteCache(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    console.error('[Cache] Error deleting cache:', error);
  }
}

export function cacheKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier.toUpperCase()}`;
}
