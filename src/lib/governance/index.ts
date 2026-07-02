/**
 * Query Governance —— 编排入口
 *
 * 工作流（workflow.ts）按以下顺序调用本模块：
 *   门 1：classifyQuery（C 短路） + demoOverride（演示开关）
 *   门 2：detectAnomaly（异常短路）
 *   门 3：classifyAB → enrichInsight(事件归因) → assessCoverage → buildVerdict → applyStrategy
 *
 * 本文件提供：demoOverride / buildVerdict / applyStrategy。
 * enrichInsight + attributeEvents 见 events.ts（事件归因，Commit 2）。
 */

import type {
  AnomalyResult,
  EventAttribution,
  Finding,
  GovernanceVerdict,
  Risk,
  RootCause,
} from "@/lib/agents/types";
import { METRIC_SPECS } from "@/lib/kb/metric-kb";
import type { InsightAgentOutput } from "@/lib/agents/insight-agent";
import { classifyAB, type ClassifyABResult } from "./classify";
import { assessCoverage, type CoverageAssessment } from "./coverage";
import { decideResponse } from "./risk";
import { resolveKey, type Movement } from "./events";

/* ----------------------------- 演示开关（dev only） ----------------------------- */
// mock 数据覆盖率全 High、波动 ≤1.12×，异常 / Medium / Low 横幅无法被真实问题触发。
// 以下关键词在 rule 模式强制注入对应裁决，便于在浏览器演示全部横幅状态。数据文件不动。

export interface DemoOverride {
  anomaly?: AnomalyResult;
  coverage?: { coverage: number; level: CoverageAssessment["level"] };
}

export function demoOverride(question: string): DemoOverride | null {
  if (/演示数据异常/.test(question)) {
    return { anomaly: { detected: true, metric: "GMV（演示）", ratio: 100 } };
  }
  if (/演示低覆盖/.test(question)) {
    return { coverage: { coverage: 35, level: "Low" } };
  }
  if (/演示中等覆盖/.test(question)) {
    return { coverage: { coverage: 65, level: "Medium" } };
  }
  return null;
}

/* ----------------------------- 组装治理结论 ----------------------------- */

export function buildVerdict(args: {
  ab: ClassifyABResult;
  coverage: CoverageAssessment;
  anomaly: AnomalyResult;
  attributedEvents: EventAttribution[];
  demo?: DemoOverride | null;
}): GovernanceVerdict {
  // 演示开关覆盖异常 / 覆盖率输入
  const anomaly = args.demo?.anomaly ?? args.anomaly;
  const coverage: CoverageAssessment = args.demo?.coverage
    ? { coverage: args.demo.coverage.coverage, level: args.demo.coverage.level }
    : args.coverage;

  const decision = decideResponse({
    queryClass: args.ab.queryClass,
    coverageLevel: coverage.level,
    anomaly,
    profitCase: args.ab.profitCase,
  });

  const reasons = [
    ...args.ab.reasons,
    `覆盖率 ${coverage.coverage === null ? "未知" : `${coverage.coverage}%`}（${coverage.level}）`,
    `响应策略：${decision.strategy}`,
  ];

  return {
    queryClass: args.ab.queryClass,
    coverageLevel: coverage.level,
    coverage: coverage.coverage,
    riskLevel: decision.riskLevel,
    responseStrategy: decision.strategy,
    requiredSources: args.ab.requiredSources,
    missingSources: args.ab.missingSources,
    metricAvailable: args.ab.metricAvailable,
    reasons,
    mandatedText: decision.mandatedText,
    banner: decision.banner,
    anomaly,
    attributedEvents: args.attributedEvents,
  };
}

/* ----------------------------- 按策略变换 Insight ----------------------------- */

export type StrategizedInsight = Pick<
  InsightAgentOutput,
  "summary" | "findings" | "risks" | "recommendations"
>;

export function applyStrategy(insight: InsightAgentOutput, verdict: GovernanceVerdict): StrategizedInsight {
  switch (verdict.responseStrategy) {
    case "direct":
      return {
        summary: insight.summary,
        findings: insight.findings,
        risks: insight.risks,
        recommendations: insight.recommendations,
      };
    case "partial": {
      const prefix = verdict.mandatedText ? `${verdict.mandatedText} ` : "";
      return {
        summary: { ...insight.summary, text: `${prefix}${insight.summary.text}` },
        findings: insight.findings,
        risks: insight.risks,
        recommendations: insight.recommendations,
      };
    }
    case "refuse":
    case "suspend": {
      const tag = verdict.responseStrategy === "suspend" ? "数据异常" : "暂不支持";
      return {
        summary: { ...insight.summary, tag, text: verdict.mandatedText ?? insight.summary.text },
        findings: [],
        risks: [],
        recommendations: [],
      };
    }
  }
}

/* ----------------------------- 事件归因富化（Commit 2） ----------------------------- */
// 给每条 Finding / Risk 挂上 lineage（数据血缘）与 rootCause（业务事件），
// 均通过 evidence.items 的展示名解析到 MetricKey，再查 METRIC_SPECS / 已归因事件。
// insight-agent 保持纯函数不动，全部富化集中在此。

function directionsOf(target: Finding | Risk): Movement[] {
  const moves: Movement[] = [];
  const fallback = (target as { direction?: "up" | "down" }).direction ?? null;
  for (const it of target.evidence?.items ?? []) {
    const k = resolveKey(it.metric);
    if (!k) continue;
    const fromBA =
      it.before != null && it.after != null ? (it.after >= it.before ? "up" : "down") : null;
    const dir = fromBA ?? fallback;
    if (dir) moves.push({ metric: k, direction: dir });
  }
  return moves;
}

/** 从 Finding/Risk 的 Evidence 推导本周期发生变动的指标（供 attributeEvents 匹配） */
export function collectMovements(findings: Finding[], risks: Risk[]): Movement[] {
  return [...findings, ...risks].flatMap(directionsOf);
}

function directionMatchesMove(move: Movement["direction"], dir: EventAttribution["direction"]): boolean {
  return (dir === "Positive" && move === "up") || (dir === "Negative" && move === "down");
}

function findRootCause(target: Finding | Risk, events: EventAttribution[]): RootCause | undefined {
  const dirs = directionsOf(target);
  const keys = new Set(dirs.map((d) => d.metric));
  for (const e of events) {
    const overlap = e.matched_metrics.filter((k) => keys.has(k));
    if (!overlap.length) continue;
    const dirOk = overlap.some((k) => {
      const d = dirs.find((x) => x.metric === k)?.direction;
      return d ? directionMatchesMove(d, e.direction) : false;
    });
    if (dirOk) {
      return { event: e, note: `${e.event_name}（${e.event_date}）：${e.description}` };
    }
  }
  return undefined;
}

function lineageOf(target: Finding | Risk): string[] | undefined {
  const first = target.evidence?.items?.[0];
  if (!first) return undefined;
  const k = resolveKey(first.metric);
  if (!k) return undefined;
  return METRIC_SPECS[k]?.lineage;
}

/** 给 Finding/Risk 挂 lineage + rootCause（基于已归因事件） */
export function enrichInsight(
  findings: Finding[],
  risks: Risk[],
  attributedEvents: EventAttribution[],
): { findings: Finding[]; risks: Risk[] } {
  const enrich = <T extends Finding | Risk>(t: T): T => ({
    ...t,
    lineage: lineageOf(t) ?? t.lineage,
    rootCause: findRootCause(t, attributedEvents) ?? t.rootCause,
  });
  return { findings: findings.map(enrich), risks: risks.map(enrich) };
}
