import "server-only";

import { cache } from "react";

import { Redis } from "@upstash/redis";

type CachedEnvelope<T> = {
  createdAt: string;
  payload: T;
};

export const getUpstashRedis = cache(() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({
    url,
    token,
  });
});

export function canUseUpstashRedis() {
  return getUpstashRedis() !== null;
}

export async function getCachedJson<T>(key: string): Promise<CachedEnvelope<T> | null> {
  const redis = getUpstashRedis();

  if (!redis) {
    return null;
  }

  try {
    const value = await redis.get<CachedEnvelope<T>>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function setCachedJson<T>(key: string, payload: T, ttlSeconds: number) {
  const redis = getUpstashRedis();

  if (!redis || ttlSeconds <= 0) {
    return;
  }

  try {
    await redis.set(
      key,
      {
        createdAt: new Date().toISOString(),
        payload,
      } satisfies CachedEnvelope<T>,
      {
        ex: ttlSeconds,
      },
    );
  } catch {
    return;
  }
}

export async function setLock(key: string, value: string, ttlSeconds: number) {
  const redis = getUpstashRedis();

  if (!redis) {
    return false;
  }

  try {
    const result = await redis.set(key, value, {
      nx: true,
      ex: ttlSeconds,
    });

    return result === "OK";
  } catch {
    return false;
  }
}

export async function releaseLock(key: string, value: string) {
  const redis = getUpstashRedis();

  if (!redis) {
    return;
  }

  try {
    const current = await redis.get<string>(key);

    if (current === value) {
      await redis.del(key);
    }
  } catch {
    return;
  }
}

export async function pushQueueItem(key: string, value: string) {
  const redis = getUpstashRedis();

  if (!redis) {
    return;
  }

  try {
    await redis.lpush(key, value);
  } catch {
    return;
  }
}

export async function popQueueItem(key: string) {
  const redis = getUpstashRedis();

  if (!redis) {
    return null;
  }

  try {
    const value = await redis.rpop<string>(key);
    return value ?? null;
  } catch {
    return null;
  }
}
