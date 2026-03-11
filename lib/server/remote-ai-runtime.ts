import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

import { canUseUpstashRedis, getCachedJson, releaseLock, setCachedJson, setLock } from "./upstash-redis";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_MS = 400;
const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 3;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 30_000;
const DEFAULT_DEDUP_WAIT_MS = 4_000;
const DEFAULT_DEDUP_POLL_MS = 250;

type RemoteAiCallMetadata = Record<string, string | number | boolean | null | undefined>;

type RemoteAiConfig = {
  baseUrl: string;
  jwtSecret: string;
  issuer: string;
  audience: string;
  scope: string;
  timeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  circuitFailureThreshold: number;
  circuitCooldownMs: number;
  dedupWaitMs: number;
  dedupPollMs: number;
};

type RemoteAiCallOptions<TPayload> = {
  service: string;
  path: string;
  payload: TPayload;
  metadata?: RemoteAiCallMetadata;
  timeoutMs?: number;
};

type RemoteAiCallResult<TResult> = {
  payload: TResult;
  requestId: string;
};

type CircuitState = {
  failures: number;
  openedUntil: number;
};

class RemoteAiHandledError extends Error {
  alreadyRecorded: boolean;

  constructor(message: string, alreadyRecorded = false) {
    super(message);
    this.name = "RemoteAiHandledError";
    this.alreadyRecorded = alreadyRecorded;
  }
}

declare global {
  var __aiContestRemoteCircuits: Map<string, CircuitState> | undefined;
}

function getCircuitRegistry() {
  if (!globalThis.__aiContestRemoteCircuits) {
    globalThis.__aiContestRemoteCircuits = new Map<string, CircuitState>();
  }

  return globalThis.__aiContestRemoteCircuits;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const headerSegment = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function getRemoteAiConfig(): RemoteAiConfig | null {
  const baseUrl = process.env.NULL_TO_FULL_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const jwtSecret = process.env.NULL_TO_FULL_API_JWT_SECRET ?? "";

  if (!baseUrl || !jwtSecret) {
    return null;
  }

  return {
    baseUrl,
    jwtSecret,
    issuer: process.env.NULL_TO_FULL_API_JWT_ISSUER ?? "ai-contest.cloud",
    audience: process.env.NULL_TO_FULL_API_JWT_AUDIENCE ?? "null-to-full",
    scope: process.env.NULL_TO_FULL_API_SCOPE ?? "contest_strategy.generate",
    timeoutMs: Number(process.env.NULL_TO_FULL_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    maxAttempts: Math.max(1, Number(process.env.NULL_TO_FULL_API_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS)),
    retryBaseMs: Math.max(100, Number(process.env.NULL_TO_FULL_API_RETRY_BASE_MS ?? DEFAULT_RETRY_BASE_MS)),
    circuitFailureThreshold: Math.max(
      1,
      Number(process.env.NULL_TO_FULL_API_CIRCUIT_FAILURE_THRESHOLD ?? DEFAULT_CIRCUIT_FAILURE_THRESHOLD),
    ),
    circuitCooldownMs: Math.max(
      1000,
      Number(process.env.NULL_TO_FULL_API_CIRCUIT_COOLDOWN_MS ?? DEFAULT_CIRCUIT_COOLDOWN_MS),
    ),
    dedupWaitMs: Math.max(250, Number(process.env.NULL_TO_FULL_API_DEDUP_WAIT_MS ?? DEFAULT_DEDUP_WAIT_MS)),
    dedupPollMs: Math.max(100, Number(process.env.NULL_TO_FULL_API_DEDUP_POLL_MS ?? DEFAULT_DEDUP_POLL_MS)),
  };
}

function buildServiceToken(config: RemoteAiConfig) {
  const now = Math.floor(Date.now() / 1000);

  return signJwt(
    {
      iss: config.issuer,
      aud: config.audience,
      iat: now,
      nbf: now - 5,
      exp: now + 60,
      jti: randomUUID(),
      scope: config.scope,
    },
    config.jwtSecret,
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logRemoteAiEvent(
  level: "info" | "warn" | "error",
  event: string,
  service: string,
  requestId: string,
  metadata: RemoteAiCallMetadata = {},
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    service,
    requestId,
    ...Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)),
  };

  const line = `[remote-ai] ${JSON.stringify(payload)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

function isRetriableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function getCircuitState(service: string) {
  const registry = getCircuitRegistry();
  const existing = registry.get(service);

  if (existing && existing.openedUntil > 0 && existing.openedUntil <= Date.now()) {
    registry.set(service, { failures: 0, openedUntil: 0 });
    return registry.get(service)!;
  }

  if (existing) {
    return existing;
  }

  const initial = { failures: 0, openedUntil: 0 };
  registry.set(service, initial);
  return initial;
}

function markRemoteAiFailure(service: string, config: RemoteAiConfig) {
  const registry = getCircuitRegistry();
  const current = getCircuitState(service);
  const nextFailures = current.failures + 1;
  const nextState: CircuitState = {
    failures: nextFailures,
    openedUntil:
      nextFailures >= config.circuitFailureThreshold ? Date.now() + config.circuitCooldownMs : current.openedUntil,
  };

  registry.set(service, nextState);
  return nextState;
}

function resetRemoteAiCircuit(service: string) {
  getCircuitRegistry().set(service, { failures: 0, openedUntil: 0 });
}

function parseRemoteErrorDetail(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = body.detail;

    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail.trim();
    }
  }

  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildPayloadHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function getServiceCacheTtlSeconds(service: string) {
  if (service === "contest-strategy") {
    return Math.max(0, Number(process.env.REMOTE_AI_CACHE_STRATEGY_TTL_SECONDS ?? 21_600));
  }

  if (service.startsWith("contest-ideation:")) {
    return Math.max(0, Number(process.env.REMOTE_AI_CACHE_IDEATION_TTL_SECONDS ?? 1_800));
  }

  if (service === "contest-team:generate") {
    return Math.max(0, Number(process.env.REMOTE_AI_CACHE_TEAM_GENERATE_TTL_SECONDS ?? 1_800));
  }

  if (service === "contest-team:turn") {
    return Math.max(0, Number(process.env.REMOTE_AI_CACHE_TEAM_TURN_TTL_SECONDS ?? 120));
  }

  return 0;
}

function buildCacheKey(service: string, payloadHash: string) {
  return `remote-ai:response:${service}:${payloadHash}`;
}

function buildLockKey(service: string, payloadHash: string) {
  return `remote-ai:lock:${service}:${payloadHash}`;
}

async function waitForCachedResponse<TResult>(
  key: string,
  waitMs: number,
  pollMs: number,
): Promise<TResult | null> {
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline) {
    const cached = await getCachedJson<TResult>(key);
    if (cached?.payload) {
      return cached.payload;
    }

    await sleep(pollMs);
  }

  return null;
}

export function canUseRemoteAiService() {
  return getRemoteAiConfig() !== null;
}

export async function callRemoteAiService<TPayload, TResult>({
  service,
  path,
  payload,
  metadata = {},
  timeoutMs,
}: RemoteAiCallOptions<TPayload>): Promise<RemoteAiCallResult<TResult>> {
  const config = getRemoteAiConfig();

  if (!config) {
    throw new Error("Remote AI service is not configured.");
  }

  const circuitState = getCircuitState(service);
  const payloadHash = buildPayloadHash(payload);
  const cacheTtlSeconds = getServiceCacheTtlSeconds(service);
  const cacheKey = buildCacheKey(service, payloadHash);
  const lockKey = buildLockKey(service, payloadHash);
  const redisEnabled = canUseUpstashRedis();

  if (redisEnabled && cacheTtlSeconds > 0) {
    const cached = await getCachedJson<TResult>(cacheKey);

    if (cached?.payload) {
      const requestId = randomUUID();
      logRemoteAiEvent("info", "cache_hit", service, requestId, {
        ...metadata,
        cacheKey,
      });
      return {
        payload: cached.payload,
        requestId,
      };
    }
  }

  if (circuitState.openedUntil > Date.now()) {
    const requestId = randomUUID();
    logRemoteAiEvent("warn", "circuit_open", service, requestId, {
      ...metadata,
      retryAfterMs: circuitState.openedUntil - Date.now(),
    });
    throw new Error("Remote AI service circuit is temporarily open.");
  }

  const requestId = randomUUID();
  let lastError: Error | null = null;
  const lockTtlSeconds = Math.max(10, Math.ceil((timeoutMs ?? config.timeoutMs) / 1000) + 10);
  let lockOwner = false;

  if (redisEnabled) {
    lockOwner = await setLock(lockKey, requestId, lockTtlSeconds);

    if (!lockOwner) {
      logRemoteAiEvent("info", "dedup_wait", service, requestId, {
        ...metadata,
        cacheKey,
        waitMs: config.dedupWaitMs,
      });

      const awaited = await waitForCachedResponse<TResult>(cacheKey, config.dedupWaitMs, config.dedupPollMs);

      if (awaited) {
        logRemoteAiEvent("info", "dedup_cache_hit", service, requestId, {
          ...metadata,
          cacheKey,
        });
        return {
          payload: awaited,
          requestId,
        };
      }
    }
  }

  try {
    for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      logRemoteAiEvent("info", "request_start", service, requestId, {
        ...metadata,
        attempt,
        path,
      });

      try {
        const response = await fetch(`${config.baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${buildServiceToken(config)}`,
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "X-Client-Service": "ai-contest.cloud",
            "X-Remote-Service": service,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs ?? config.timeoutMs),
        });

        const durationMs = Date.now() - startedAt;

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { detail?: string } | null;
          const detail = parseRemoteErrorDetail(body, `Remote AI service failed with status ${response.status}.`);

          logRemoteAiEvent(isRetriableStatus(response.status) ? "warn" : "error", "request_failed", service, requestId, {
            ...metadata,
            attempt,
            path,
            status: response.status,
            durationMs,
            detail,
          });

          if (isRetriableStatus(response.status) && attempt < config.maxAttempts) {
            await sleep(config.retryBaseMs * attempt);
            continue;
          }

          const nextCircuit = markRemoteAiFailure(service, config);

          if (nextCircuit.openedUntil > Date.now()) {
            logRemoteAiEvent("warn", "circuit_tripped", service, requestId, {
              ...metadata,
              failureCount: nextCircuit.failures,
              cooldownMs: config.circuitCooldownMs,
            });
          }

          throw new RemoteAiHandledError(detail, true);
        }

        const json = (await response.json()) as TResult;
        resetRemoteAiCircuit(service);
        logRemoteAiEvent("info", "request_success", service, requestId, {
          ...metadata,
          attempt,
          path,
          durationMs,
          status: response.status,
        });

        if (redisEnabled && cacheTtlSeconds > 0) {
          await setCachedJson(cacheKey, json, cacheTtlSeconds);
          logRemoteAiEvent("info", "cache_store", service, requestId, {
            ...metadata,
            cacheKey,
            ttlSeconds: cacheTtlSeconds,
          });
        }

        return {
          payload: json,
          requestId,
        };
      } catch (error) {
        if (error instanceof RemoteAiHandledError && error.alreadyRecorded) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(serializeError(error));
        const durationMs = Date.now() - startedAt;

        logRemoteAiEvent("warn", "request_exception", service, requestId, {
          ...metadata,
          attempt,
          path,
          durationMs,
          detail: lastError.message,
        });

        if (attempt < config.maxAttempts) {
          await sleep(config.retryBaseMs * attempt);
          continue;
        }

        const nextCircuit = markRemoteAiFailure(service, config);

        if (nextCircuit.openedUntil > Date.now()) {
          logRemoteAiEvent("warn", "circuit_tripped", service, requestId, {
            ...metadata,
            failureCount: nextCircuit.failures,
            cooldownMs: config.circuitCooldownMs,
          });
        }
      }
    }
  } finally {
    if (redisEnabled && lockOwner) {
      await releaseLock(lockKey, requestId);
    }
  }

  throw lastError ?? new Error("Remote AI service failed.");
}

export function logRemoteAiFallback(service: string, error: unknown, metadata: RemoteAiCallMetadata = {}) {
  logRemoteAiEvent("warn", "fallback_to_local", service, randomUUID(), {
    ...metadata,
    detail: serializeError(error),
  });
}
