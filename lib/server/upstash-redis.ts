import "server-only";

import { cache } from "react";

import { Redis } from "@upstash/redis";

type CachedEnvelope<T> = {
  createdAt: string;
  payload: T;
};

export type RemoteAiCircuitState = {
  failures: number;
  openedUntil: number;
};

const REMOTE_AI_CIRCUIT_STATE_PREFIX = "remote-ai:circuit";

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

declare global {
  var __aiContestRemoteAiCircuits: Map<string, RemoteAiCircuitState> | undefined;
}

function getRemoteAiCircuitKey(service: string) {
  return `${REMOTE_AI_CIRCUIT_STATE_PREFIX}:${service}`;
}

function createRemoteAiCircuitState(): RemoteAiCircuitState {
  return {
    failures: 0,
    openedUntil: 0,
  };
}

function normalizeRemoteAiCircuitState(value: unknown): RemoteAiCircuitState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const { failures, openedUntil } = value as Partial<RemoteAiCircuitState>;

  if (typeof failures !== "number" || typeof openedUntil !== "number") {
    return null;
  }

  return {
    failures: Math.max(0, Math.floor(failures)),
    openedUntil: Math.max(0, Math.floor(openedUntil)),
  };
}

function getLocalRemoteAiCircuitRegistry() {
  globalThis.__aiContestRemoteAiCircuits ??= new Map<string, RemoteAiCircuitState>();
  return globalThis.__aiContestRemoteAiCircuits;
}

async function getLocalRemoteAiCircuitState(service: string) {
  const registry = getLocalRemoteAiCircuitRegistry();
  const existing = registry.get(service);

  if (existing && existing.openedUntil > 0 && existing.openedUntil <= Date.now()) {
    const resetState = createRemoteAiCircuitState();
    registry.set(service, resetState);
    return resetState;
  }

  if (existing) {
    return existing;
  }

  const initial = createRemoteAiCircuitState();
  registry.set(service, initial);
  return initial;
}

export async function getRemoteAiCircuitState(service: string): Promise<RemoteAiCircuitState> {
  const redis = getUpstashRedis();

  if (!redis) {
    return getLocalRemoteAiCircuitState(service);
  }

  const key = getRemoteAiCircuitKey(service);

  try {
    const value = await redis.get<RemoteAiCircuitState>(key);
    const state = normalizeRemoteAiCircuitState(value);

    if (!state) {
      return createRemoteAiCircuitState();
    }

    if (state.openedUntil > 0 && state.openedUntil <= Date.now()) {
      await resetRemoteAiCircuitState(service);
      return createRemoteAiCircuitState();
    }

    return state;
  } catch {
    return getLocalRemoteAiCircuitState(service);
  }
}

export async function setRemoteAiCircuitState(service: string, state: RemoteAiCircuitState) {
  const redis = getUpstashRedis();

  if (!redis) {
    getLocalRemoteAiCircuitRegistry().set(service, state);
    return;
  }

  try {
    await redis.set(getRemoteAiCircuitKey(service), {
      failures: Math.max(0, Math.floor(state.failures)),
      openedUntil: Math.max(0, Math.floor(state.openedUntil)),
    });
  } catch {
    getLocalRemoteAiCircuitRegistry().set(service, state);
  }
}

export async function resetRemoteAiCircuitState(service: string) {
  const redis = getUpstashRedis();

  if (!redis) {
    getLocalRemoteAiCircuitRegistry().set(service, createRemoteAiCircuitState());
    return;
  }

  try {
    await redis.del(getRemoteAiCircuitKey(service));
  } catch {
    getLocalRemoteAiCircuitRegistry().set(service, createRemoteAiCircuitState());
  }
}

export async function markRemoteAiCircuitFailure(
  service: string,
  failureThreshold: number,
  cooldownMs: number,
) {
  const current = await getRemoteAiCircuitState(service);
  const nextFailures = current.failures + 1;
  const nextState: RemoteAiCircuitState = {
    failures: nextFailures,
    openedUntil: nextFailures >= failureThreshold ? Date.now() + cooldownMs : current.openedUntil,
  };

  await setRemoteAiCircuitState(service, nextState);
  return nextState;
}

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
