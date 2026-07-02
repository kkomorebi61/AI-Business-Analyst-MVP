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

import type { AnomalyResult, GovernanceVerdict } from "@/lib/agents/types";
import type { InsightAgentOutput } from "@/lib/agents/insight-agent";
import { classifyAB, type ClassifyABResult } from "./classify";
import { assessCoverage, type CoverageAssessment } from "./coverage";
import { decideResponse } from "./risk";
import type { EventAttribution } from "@/lib/agents/types";

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
