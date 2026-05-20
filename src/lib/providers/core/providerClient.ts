import type { ProviderHealth } from "@/lib/providers/types";

export interface ProviderClientOptions {
  name: string;
  minIntervalMs?: number;
  cacheTtlMs?: number;
  retries?: number;
}

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const lastRun = new Map<string, number>();

export async function runProviderRequest<T>(
  key: string,
  options: ProviderClientOptions,
  request: () => Promise<T>
): Promise<{ data: T | null; health: ProviderHealth }> {
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return {
      data: cached.value as T,
      health: {
        name: options.name,
        status: "healthy",
        message: "Cache hit",
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }

  const previousRun = lastRun.get(key) ?? 0;
  if (options.minIntervalMs && now - previousRun < options.minIntervalMs) {
    return {
      data: null,
      health: {
        name: options.name,
        status: "fallback",
        message: "Rate limit guard aktiv",
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }

  lastRun.set(key, now);
  const retries = options.retries ?? 1;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const value = await request();
      cache.set(key, {
        value,
        expiresAt: now + (options.cacheTtlMs ?? 60000),
      });

      return {
        data: value,
        health: {
          name: options.name,
          status: "healthy",
          message: "Provider request lyckades",
          lastCheckedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (attempt === retries) {
        return {
          data: null,
          health: {
            name: options.name,
            status: "error",
            message: String(error),
            lastCheckedAt: new Date().toISOString(),
          },
        };
      }
    }
  }

  return {
    data: null,
    health: {
      name: options.name,
      status: "error",
      message: "Okänt providerfel",
      lastCheckedAt: new Date().toISOString(),
    },
  };
}
