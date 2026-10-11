import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireEnv } from "@/lib/env";

const BASE_URL = "https://v3.football.api-sports.io";

export const TTL = {
  leagues: 7 * 24 * 3600,
  standings: 6 * 3600,
  fixturesDay: 3600,
  seasonResults: 6 * 3600,
  h2h: 7 * 24 * 3600,
  injuries: 3 * 3600,
  odds: 3 * 3600,
  results: 15 * 60,
} as const;

interface ApiEnvelope<T> {
  errors: unknown;
  results: number;
  paging?: { current: number; total: number };
  response: T;
}

/** Keš unutar istog procesa (štedi i upite prema bazi). */
const memory = new Map<string, { data: unknown; expires: number }>();

function cacheKey(path: string, params: Record<string, string | number>): string {
  const qs = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${path}?${qs}`;
}

function hasErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors as object).length > 0;
  return true;
}

export class ApiFootballError extends Error {}

async function fetchJson<T>(path: string, params: Record<string, string | number>): Promise<ApiEnvelope<T>> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { "x-apisports-key": requireEnv("API_FOOTBALL_KEY") },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiFootballError(`API-Football ${path}: HTTP ${res.status}`);
  const body = (await res.json()) as ApiEnvelope<T>;
  if (hasErrors(body.errors)) {
    throw new ApiFootballError(`API-Football ${path}: ${JSON.stringify(body.errors)}`);
  }
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  if (remaining !== null) console.info(`[api-football] ${path} – preostalo dnevnih poziva: ${remaining}`);
  return body;
}

/**
 * GET prema API-Footballu s keširanjem u memoriji i u tablici api_cache.
 * Za paginirane endpointe skuplja sve stranice (najviše `maxPages`).
 */
export async function apiGet<T>(
  path: string,
  params: Record<string, string | number>,
  ttlSeconds: number,
  opts: { fresh?: boolean; maxPages?: number } = {},
): Promise<T[]> {
  const key = cacheKey(path, params);
  const now = Date.now();

  if (!opts.fresh) {
    const mem = memory.get(key);
    if (mem && mem.expires > now) return mem.data as T[];
    const [row] = await db().select().from(schema.apiCache).where(eq(schema.apiCache.key, key)).limit(1);
    if (row && row.expiresAt.getTime() > now) {
      memory.set(key, { data: row.data, expires: row.expiresAt.getTime() });
      return row.data as T[];
    }
  }

  const first = await fetchJson<T[]>(path, params);
  let items = first.response ?? [];
  const totalPages = Math.min(first.paging?.total ?? 1, opts.maxPages ?? 1);
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchJson<T[]>(path, { ...params, page });
    items = items.concat(next.response ?? []);
  }

  const expiresAt = new Date(now + ttlSeconds * 1000);
  memory.set(key, { data: items, expires: expiresAt.getTime() });
  await db()
    .insert(schema.apiCache)
    .values({ key, data: items, expiresAt })
    .onConflictDoUpdate({ target: schema.apiCache.key, set: { data: items, expiresAt } });
  return items;
}
