/**
 * 经营健康度（Health Score）—— 经营诊断 V2 · 模块 1。
 *
 * 把当期 KPI 的环比变化（rule-first，非 LLM）汇总为综合健康分 0–100 + 健康/关注/风险，
 * 分 4 个维度：增长能力 / 转化效率 / 用户留存 / 营销效率。
 *
 * 评分规则（MVP，可解释）：
 *  - 无环比（snapshot）→ 中性 70；
 *  - 有利方向（增长类上升 / churnRate 下降）→ 100；
 *  - 不利方向 → max(15, 100 − |Δ|×2)（变化越大扣分越多）。
 * 维度分 = 该维度内可用指标的均分；综合分 = 维度分按权重加权（仅含有指标的维度）。
 * 状态：≥80 健康 / 60–79 关注 / <60 风险。
 *
 * 纯函数，可单测。
 */

import type { MetricKey } from "@/lib/kb/metric-kb";
import type { KpiPoint } from "./types";

export type HealthStatus = "healthy" | "watch" | "risk";

export interface HealthMetric {
  key: MetricKey;
  name: string;
  deltaPct: number;
  direction: "up" | "down";
  score: number;
}

export interface HealthDimension {
  key: string;
  label: string;
  weight: number;
  score: number;
  metrics: HealthMetric[];
}

export interface HealthScore {
  score: number;
  status: HealthStatus;
  dimensions: HealthDimension[];
  topRisks: { label: string; reason: string }[];
}

/** 「越低越好」的指标（其方向语义需翻转） */
const LOWER_BETTER = new Set<MetricKey>(["churnRate"]);

const DIMENSIONS: { key: string; label: string; weight: number; metrics: MetricKey[] }[] = [
  {
    key: "growth",
    label: "增长能力",
    weight: 0.3,
    metrics: ["gmv", "orders", "aov", "newMembers", "newFriends"],
  },
  {
    key: "conversion",
    label: "转化效率",
    weight: 0.2,
    metrics: ["conversion", "scrmConversion", "replyRate", "couponRedemption"],
  },
  {
    key: "retention",
    label: "用户留存",
    weight: 0.3,
    metrics: ["repurchaseRate", "ltv", "activeMembers", "churnRate", "vipMembers", "totalMembers"],
  },
  { key: "marketing", label: "营销效率", weight: 0.2, metrics: ["roi"] },
];

function metricScore(k: KpiPoint, hasComparison: boolean): number {
  if (!hasComparison) return 70; // 无环比：中性
  const lowerBetter = LOWER_BETTER.has(k.key);
  const good = lowerBetter ? k.direction === "down" : k.direction === "up";
  if (good) return 100;
  return Math.max(15, Math.round(100 - Math.abs(k.deltaPct) * 2));
}

export function computeHealth(kpis: KpiPoint[], hasComparison: boolean): HealthScore {
  const byKey = new Map(kpis.map((k) => [k.key, k]));

  const dimensions: HealthDimension[] = DIMENSIONS.map((d) => {
    const metrics: HealthMetric[] = d.metrics
      .filter((m) => byKey.has(m))
      .map((m) => {
        const k = byKey.get(m)!;
        return {
          key: k.key,
          name: k.name,
          deltaPct: k.deltaPct,
          direction: k.direction,
          score: metricScore(k, hasComparison),
        };
      });
    const score = metrics.length
      ? Math.round(metrics.reduce((s, x) => s + x.score, 0) / metrics.length)
      : 70;
    return { key: d.key, label: d.label, weight: d.weight, score, metrics };
  });

  const weightedDims = dimensions.filter((d) => d.metrics.length);
  const totalWeight = weightedDims.reduce((s, d) => s + d.weight, 0) || 1;
  const score = Math.round(
    weightedDims.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight,
  );
  const status: HealthStatus = score >= 80 ? "healthy" : score >= 60 ? "watch" : "risk";

  // topRisks：维度分 < 75 时，取该维度最差指标作为风险点
  const topRisks: HealthScore["topRisks"] = [];
  for (const d of dimensions) {
    if (d.metrics.length && d.score < 75) {
      const worst = [...d.metrics].sort((a, b) => a.score - b.score)[0];
      topRisks.push({
        label: d.label,
        reason: `${worst.name} ${worst.deltaPct >= 0 ? "+" : ""}${worst.deltaPct.toFixed(1)}（评分 ${worst.score}）`,
      });
    }
  }

  return { score, status, dimensions, topRisks };
}
