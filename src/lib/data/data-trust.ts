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
import { METRIC_SPECS, type MetricKey } from "@/lib/kb/metric-kb";

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

/* ------------------------------------------------------------------ *
 * 单指标可信度（来源：10_Data_Trust_Layer §10 Trust Score + §11 Levels）
 *
 * Trust Score = Coverage×40% + Freshness×30% + Health×20% + Completeness×10%
 * 分级：≥90 High / 75-89 Medium / 60-74 Low / <60 Caution
 * ------------------------------------------------------------------ */

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Caution";

export interface MetricTrustInfo {
  /** 引用的源系统（规范化名） */
  sources: string[];
  /** 覆盖率（引用源平均，0~100） */
  coverage: number | null;
  /** 最差健康度（Healthy/Warning/Delayed/Critical） */
  health: string;
  /** 最晚更新时间（注册表口径） */
  lastUpdated: string | null;
  /** 时效性等级 */
  freshness: Freshness;
  /** 综合可信度评分 0~100 */
  trustScore: number;
  /** 可信度分级 */
  confidence: ConfidenceLevel;
  /** 源完整度 0~100（必需源是否均已接入注册表） */
  completeness: number;
}

/** Freshness → 0~100 分（doc 10 §5） */
const FRESHNESS_SCORE: Record<Freshness, number> = {
  Healthy: 100,
  Warning: 90,
  Delayed: 70,
  Critical: 40,
};

/** health_status → 0~100 分（doc 10 §7） */
const HEALTH_SCORE: Record<string, number> = {
  Healthy: 100,
  Warning: 80,
  Delayed: 60,
  Error: 30,
  Critical: 30,
};

/** 综合分 → 分级（doc 10 §11） */
export function confidenceOf(score: number): ConfidenceLevel {
  if (score >= 90) return "High";
  if (score >= 75) return "Medium";
  if (score >= 60) return "Low";
  return "Caution";
}

/**
 * 计算单个指标的可信度。
 * 以 METRIC_SPECS[key].source_keys 为必需源，聚合覆盖率 / 健康 / 时效 / 完整度。
 */
export function metricTrustInfo(key: MetricKey): MetricTrustInfo {
  const spec = METRIC_SPECS[key];
  const required = spec.source_keys;
  const summary = trustForSources(required);

  const coverage = summary.coverage ?? 0;
  const freshness = required.every((s) => getSource(s))
    ? worstFreshness(required.map((s) => getSource(s)!))
    : "Critical";
  const healthScore = HEALTH_SCORE[summary.healthStatus] ?? 100;
  const completeness = required.length
    ? Math.round((required.filter((s) => getSource(s)).length / required.length) * 100)
    : 100;

  const trustScore = Math.round(
    coverage * 0.4 +
      FRESHNESS_SCORE[freshness] * 0.3 +
      healthScore * 0.2 +
      completeness * 0.1,
  );

  return {
    sources: summary.sources,
    coverage: summary.coverage,
    health: summary.healthStatus,
    lastUpdated: summary.lastUpdated,
    freshness,
    trustScore,
    confidence: confidenceOf(trustScore),
    completeness,
  };
}

/** 取一组源中最差时效性 */
function worstFreshness(systems: SourceTrust[]): Freshness {
  const RANK: Record<Freshness, number> = { Healthy: 0, Warning: 1, Delayed: 2, Critical: 3 };
  if (!systems.length) return "Healthy";
  return systems.reduce((worst, s) => {
    const w = RANK[worst] ?? 0;
    const cur = RANK[s.freshness] ?? 0;
    return cur > w ? s.freshness : worst;
  }, "Healthy" as Freshness);
}
