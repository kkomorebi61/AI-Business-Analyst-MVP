/**
 * 缓存层（doc 15 Principle 3 / Cache First）
 *
 * Cache Key = Question / Time Range / User Role / Brand（doc 15 四组件）
 * TTL 按节奏：实时 5min / 日报 1h / 周报 6h / 月报 24h
 * 命中目标：Cache Hit Rate > 60%
 *
 * 进程内 Map + globalThis guard（Next dev HMR 下保留单例；本仓库首次引入该模式）。
 * 测试用 resetCache() 清零。
 */

import type { Range } from "@/lib/data/daily";
import type { QueryType } from "./types";

/** 单租户占位品牌（doc 15 Cache Key 第 4 组件 Brand；多品牌可由调用方覆盖） */
export const BRAND = "default";

export type CacheCadence = "realtime" | "daily" | "weekly" | "monthly";

/** QueryType → 节奏（doc 15 P3：实时指标 / 日报 / 周报 / 月报） */
export const QUERY_TYPE_CADENCE: Record<QueryType, CacheCadence> = {
  metric: "realtime",
  calculation: "realtime",
  insight: "daily",
  execution: "daily",
  strategy: "weekly",
  requirement: "monthly",
};

/** 节奏 → TTL（doc 15 P3 verbatim） */
export const CADENCE_TTL_MS: Record<CacheCadence, number> = {
  realtime: 5 * 60_000,
  daily: 60 * 60_000,
  weekly: 6 * 60 * 60_000,
  monthly: 24 * 60 * 60_000,
};

export interface CacheKeyParts {
  question: string;
  range: Range;
  role?: string;
  brand?: string;
}

/** 归一化问题：trim + 折叠空白 + 小写（让「GMV？ 」与「gmv?」命中同一条目） */
function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 构造缓存键（doc 15 P3：Question / Time Range / User Role / Brand） */
export function buildCacheKey(p: CacheKeyParts): string {
  return JSON.stringify({
    q: normalizeQuestion(p.question),
    r: p.range,
    role: p.role ?? "default",
    brand: p.brand ?? BRAND,
  });
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  size: number;
  /** 命中率（reads = hits + misses） */
  hitRate: number;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

const g = globalThis as unknown as {
  __ANALYST_CACHE__?: Map<string, Entry>;
  __ANALYST_CACHE_STATS__?: { hits: number; misses: number; sets: number };
};
g.__ANALYST_CACHE__ ??= new Map();
g.__ANALYST_CACHE_STATS__ ??= { hits: 0, misses: 0, sets: 0 };
const MAP = g.__ANALYST_CACHE__!;
const STATS = g.__ANALYST_CACHE_STATS__!;

export function cacheGet<T>(key: string): { hit: true; value: T } | { hit: false } {
  const e = MAP.get(key);
  if (!e) {
    STATS.misses += 1;
    return { hit: false };
  }
  if (Date.now() >= e.expiresAt) {
    MAP.delete(key);
    STATS.misses += 1;
    return { hit: false };
  }
  STATS.hits += 1;
  return { hit: true, value: e.value as T };
}

export function cachePut<T>(key: string, value: T, ttlMs: number): void {
  MAP.set(key, { value, expiresAt: Date.now() + ttlMs });
  STATS.sets += 1;
}

export function cacheStats(): CacheStats {
  const reads = STATS.hits + STATS.misses || 1;
  return {
    hits: STATS.hits,
    misses: STATS.misses,
    sets: STATS.sets,
    size: MAP.size,
    hitRate: STATS.hits / reads,
  };
}

/** 测试用：清空条目与计数 */
export function resetCache(): void {
  MAP.clear();
  Object.assign(STATS, { hits: 0, misses: 0, sets: 0 });
}
