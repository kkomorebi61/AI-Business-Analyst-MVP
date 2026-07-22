/**
 * Strategy Solution V2（Sprint 3 · 策略方案模块）。
 *
 * 在 V1 strategy-engine（关键词命中策略库 + Capability 解析）之上，产出 spec 要求的
 * Strategy Card：根因回顾 / 策略描述 / 目标人群 / 渠道 / 预计收益(ROI) / 风险 / 可信度 /
 * 优先级(P0-P2) / 能力映射(√/×) / 推荐依据。
 *
 * 原则：Rule-First + Knowledge-Based（不调 LLM 创造策略）。
 *  - 触发：按当期指标的「不利变化」匹配策略（复购↓→召回、客单价↓→组合购、流失↑→关怀…）。
 *  - ROI：规则估算 = 目标用户数 × 历史转化提升 × 客单价（区间 ±30%，标可信度）。
 *  - 优先级：Business Impact(lift) + 实施难度(能力缺口) + Data Confidence(trustScore)。
 *  - 能力映射：capabilityIds→√，capabilityGaps→×，可行性%。
 *
 * 纯函数，可单测。strategyEngine(question)（V1，router 用）保持不动。
 */

import { CAPABILITY_BY_ID } from "@/lib/kb/capability-kb";
import { metricTrustInfo, type ConfidenceLevel } from "@/lib/data/data-trust";
import type { MetricKey } from "@/lib/kb/metric-kb";
import { STRATEGY_LIBRARY, type StrategyScenario } from "./strategy-engine";
import type { KpiPoint } from "./types";

/** V2 场景增强（与 STRATEGY_LIBRARY 按 id 对齐；不动 V1 数据，降低回归风险） */
interface ScenarioV2 {
  problem_type: string;
  industry: string;
  expected_metric: string[];
  risk: string;
  /** 触发该策略的指标（其不利变化即触发） */
  triggerMetric: MetricKey;
  /** 越低越好的指标（如 churnRate：上升=坏） */
  lowerBetter?: boolean;
  /** 历史转化提升（ROI 估算用） */
  liftPct: number;
  /** 历史案例（推荐依据） */
  caseRef: string;
  /** ROI「目标用户数」基数指标 */
  targetUserMetric: MetricKey;
}

const V2: Record<string, ScenarioV2> = {
  S1_repurchase_decrease: {
    problem_type: "留存/复购",
    industry: "美妆/零售",
    expected_metric: ["复购率", "GMV"],
    risk: "过度触达致用户反感；优惠稀释毛利",
    triggerMetric: "repurchaseRate",
    liftPct: 0.05,
    caseRef: "美妆行业 VIP 召回（复购 +8%）",
    targetUserMetric: "vipMembers",
  },
  S2_member_growth_slowdown: {
    problem_type: "获客/增长",
    industry: "零售",
    expected_metric: ["新增会员", "拉新成本"],
    risk: "激励成本上升；新客质量参差",
    triggerMetric: "newMembers",
    liftPct: 0.03,
    caseRef: "小程序邀请有礼（新客 +12%）",
    targetUserMetric: "newMembers",
  },
  S3_churn_increase: {
    problem_type: "流失/留存",
    industry: "零售",
    expected_metric: ["流失率", "高价值留存"],
    risk: "关怀过度打扰；权益成本",
    triggerMetric: "churnRate",
    lowerBetter: true,
    liftPct: 0.04,
    caseRef: "高价值会员关怀（流失 -15%）",
    targetUserMetric: "vipMembers",
  },
  S4_aov_decrease: {
    problem_type: "客单价/连带",
    industry: "零售",
    expected_metric: ["客单价", "连带率"],
    risk: "组合购折扣拉低毛利",
    triggerMetric: "aov",
    liftPct: 0.06,
    caseRef: "美妆组合购（客单价 +10%）",
    targetUserMetric: "activeMembers",
  },
  S5_vip_contribution_decrease: {
    problem_type: "VIP/高价值",
    industry: "美妆/零售",
    expected_metric: ["VIP 复购", "VIP GMV 占比"],
    risk: "高端权益成本高；库存供给",
    triggerMetric: "vipMembers",
    liftPct: 0.07,
    caseRef: "美妆会员日（VIP GMV +9%）",
    targetUserMetric: "vipMembers",
  },
  S6_scrm_engagement_decline: {
    problem_type: "私域/触达",
    industry: "零售",
    expected_metric: ["触达率", "企微成交"],
    risk: "导购执行不一；内容同质化",
    triggerMetric: "reachRate",
    liftPct: 0.05,
    caseRef: "导购任务激励（触达 +18%）",
    targetUserMetric: "totalFriends",
  },
};

export type PriorityLevel = "P0" | "P1" | "P2";

export interface CapabilityItem {
  name: string;
  system: string;
  has: boolean;
}

export interface StrategyCard {
  id: string;
  scenarioId: string;
  problemType: string;
  industry: string;
  name: string;
  appliesTo: string;
  description: string;
  targetUser: string;
  channel: string[];
  expectedMetric: string[];
  expectedROI: { low: number; high: number; confidence: ConfidenceLevel };
  risk: string;
  credibility: ConfidenceLevel;
  credibilityScore: number;
  priority: { score: number; level: PriorityLevel };
  capabilityMapping: { items: CapabilityItem[]; feasibilityPct: number };
  evidence: string[];
  triggerMetric: MetricKey;
  triggerDelta: number;
  /** 效果追踪准备：Before / Target / After(open) */
  tracking: { before: string; target: string; metric: string };
}

export interface StrategyInput {
  kpis: KpiPoint[];
  hasComparison: boolean;
  /** 原始数值（ROI 估算用）：客单价 / 各类用户规模 */
  raw: Partial<Record<MetricKey, number>>;
}

const CONF_SCORE: Record<ConfidenceLevel, number> = {
  High: 90,
  Medium: 75,
  Low: 60,
  Caution: 40,
};

export function buildStrategies(input: StrategyInput): StrategyCard[] {
  const byKey = new Map(input.kpis.map((k) => [k.key, k]));
  const cards: StrategyCard[] = [];

  for (const sc of STRATEGY_LIBRARY) {
    const v = V2[sc.id];
    if (!v) continue;
    const kpi = byKey.get(v.triggerMetric);
    if (!kpi) continue;
    // 仅在「有环比且指标不利」时触发（避免对健康指标推荐策略）
    if (input.hasComparison) {
      const bad = v.lowerBetter ? kpi.direction === "up" : kpi.direction === "down";
      if (!bad) continue;
    }
    cards.push(buildCard(sc, v, kpi, input));
  }

  // GMV 下滑但无具体场景命中 → 兜底加召回策略（最常见根因）
  const gmv = byKey.get("gmv");
  if (
    input.hasComparison &&
    gmv &&
    gmv.direction === "down" &&
    !cards.some((c) => c.scenarioId === "S1_repurchase_decrease")
  ) {
    const sc = STRATEGY_LIBRARY.find((s) => s.id === "S1_repurchase_decrease")!;
    const v = V2[sc.id];
    const kpi = byKey.get("repurchaseRate") ?? gmv;
    cards.push(buildCard(sc, v, kpi, input));
  }

  cards.sort((a, b) => b.priority.score - a.priority.score);
  return cards;
}

function buildCard(
  sc: StrategyScenario,
  v: ScenarioV2,
  kpi: KpiPoint,
  input: StrategyInput,
): StrategyCard {
  const trust = metricTrustInfo(v.triggerMetric);
  const confidence = trust.confidence;
  const confScore = trust.trustScore;

  // ROI：目标用户数 × 历史转化提升 × 客单价（区间 ±30%）
  const users = input.raw[v.targetUserMetric] ?? input.raw.activeMembers ?? 0;
  const aov = input.raw.aov ?? 0;
  const roiMid = users * v.liftPct * aov;
  const expectedROI = {
    low: Math.round(roiMid * 0.7),
    high: Math.round(roiMid * 1.3),
    confidence,
  };

  // 能力映射：capabilityIds→√，capabilityGaps→×
  const items: CapabilityItem[] = [];
  for (const id of sc.capabilityIds) {
    const c = CAPABILITY_BY_ID[id];
    items.push({
      name: c ? c.capability : id,
      system: c ? c.system : "—",
      has: Boolean(c),
    });
  }
  for (const g of sc.capabilityGaps) {
    items.push({ name: g, system: "—", has: false });
  }
  const feasibilityPct = items.length
    ? Math.round((items.filter((i) => i.has).length / items.length) * 100)
    : 100;

  // 优先级
  const impact = Math.min(100, Math.round(v.liftPct * 1000)); // 0.05→50
  const difficulty = Math.min(100, sc.capabilityGaps.length * 25 + 20);
  const priorityScore = Math.round(
    impact * 0.5 + (100 - difficulty) * 0.3 + CONF_SCORE[confidence] * 0.2,
  );
  const level: PriorityLevel = priorityScore >= 75 ? "P0" : priorityScore >= 55 ? "P1" : "P2";

  const deltaLabel = `${kpi.deltaPct >= 0 ? "+" : ""}${kpi.deltaPct.toFixed(1)}${
    isRate(kpi.key) ? "pp" : "%"
  }`;

  return {
    id: `strat-${sc.id}`,
    scenarioId: sc.id,
    problemType: v.problem_type,
    industry: v.industry,
    name: sc.strategy,
    appliesTo: `针对「${sc.problem}」(${v.triggerMetric} ${deltaLabel})；根因：${sc.rootCause.slice(0, 2).join("、")}`,
    description: sc.expectedResult[0] ?? sc.strategy,
    targetUser: sc.targetAudience.join("、"),
    channel: sc.channel,
    expectedMetric: v.expected_metric,
    expectedROI,
    risk: v.risk,
    credibility: confidence,
    credibilityScore: confScore,
    priority: { score: priorityScore, level },
    capabilityMapping: { items, feasibilityPct },
    evidence: [
      `当前根因：${sc.problem}（${v.triggerMetric} ${deltaLabel}）`,
      `历史案例：${v.caseRef}`,
      `数据可信度：${confidence}（${confScore}）`,
    ],
    triggerMetric: v.triggerMetric,
    triggerDelta: kpi.deltaPct,
    tracking: {
      metric: v.expected_metric[0] ?? sc.problem,
      before: `${kpi.name} ${deltaLabel}`,
      target: `${v.expected_metric[0] ?? "目标指标"} +${(v.liftPct * 100).toFixed(0)}%`,
    },
  };
}

function isRate(key: MetricKey): boolean {
  return [
    "conversion",
    "refundRate",
    "repurchaseRate",
    "churnRate",
    "roi",
    "reachRate",
    "replyRate",
    "scrmConversion",
    "couponRedemption",
  ].includes(key);
}
