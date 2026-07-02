/**
 * Data Trust 注册表（来源：07_data_sources.json）
 *
 * 提供源系统的可信信息：coverage / health_status / owner / update_time / freshness。
 * Evidence Engine（Phase 2）与 Data Trust Center（Phase 3）共用本模块。
 *
 * 说明：Mock 数据的"当前时间"取注册表中最晚的 update_time（演示口径），
 * 避免按真实时间计算导致全部源过期。
 */

import registry from "./mock-data/07_data_sources.json";

interface RegistryRow {
  source_system: string;
  update_time: string;
  health_status: string;
  coverage: number;
  owner: string;
}

export type Freshness = "Healthy" | "Warning" | "Delayed" | "Critical";

export interface SourceTrust extends RegistryRow {
  freshness: Freshness;
}

const REGISTRY = registry as RegistryRow[];

/** health 严重度排序（取最差者） */
const HEALTH_RANK: Record<string, number> = {
  Healthy: 0,
  Warning: 1,
  Delayed: 2,
  Error: 3,
  Critical: 3,
};

function parseTime(s: string): number {
  // "2026-07-01 07:30" → epoch ms
  return new Date(s.replace(" ", "T")).getTime();
}

/** Mock 口径的"现在" = 注册表中最晚更新时间 */
const NOW_MS = Math.max(...REGISTRY.map((r) => parseTime(r.update_time)));

/** 按 doc 10 规则计算时效性 */
export function freshnessOf(updateTime: string): Freshness {
  const mins = (NOW_MS - parseTime(updateTime)) / 60000;
  if (mins < 30) return "Healthy";
  if (mins <= 120) return "Warning";
  if (mins <= 1440) return "Delayed";
  return "Critical";
}

/** 全部源（含 freshness） */
export function listSources(): SourceTrust[] {
  return REGISTRY.map((r) => ({ ...r, freshness: freshnessOf(r.update_time) }));
}

export function getSource(system: string): SourceTrust | undefined {
  const row = REGISTRY.find((r) => r.source_system === system);
  return row ? { ...row, freshness: freshnessOf(row.update_time) } : undefined;
}

function worstHealth(systems: SourceTrust[]): string {
  if (!systems.length) return "Healthy";
  return systems.reduce((worst, s) => {
    const w = HEALTH_RANK[worst] ?? 0;
    const cur = HEALTH_RANK[s.health_status] ?? 0;
    return cur > w ? s.health_status : worst;
  }, "Healthy");
}

export interface TrustSummary {
  sources: string[];
  coverage: number | null;
  healthStatus: string;
  lastUpdated: string | null;
}

/**
 * 一组源系统的聚合可信信息（供 Evidence 引用）。
 * coverage = 引用源的平均覆盖；healthStatus = 最差健康度；lastUpdated = 最晚更新时间。
 */
export function trustForSources(systems: string[]): TrustSummary {
  const cited = systems
    .map(getSource)
    .filter((s): s is SourceTrust => Boolean(s));
  if (!cited.length) {
    return { sources: systems, coverage: null, healthStatus: "Healthy", lastUpdated: null };
  }
  const coverage = Math.round(cited.reduce((s, r) => s + r.coverage, 0) / cited.length);
  const lastUpdated = cited
    .map((r) => r.update_time)
    .sort()
    .slice(-1)[0];
  return {
    sources: cited.map((s) => s.source_system),
    coverage,
    healthStatus: worstHealth(cited),
    lastUpdated,
  };
}
