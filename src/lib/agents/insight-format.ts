/**
 * Insight Card 格式化（经营诊断 V2 · 模块 2）。
 *
 * 把 insightAgent 产出的 Finding / Risk 整形为统一的「AI 关键发现」卡片，补齐 spec 要求的
 * 字段：业务影响 / 数据证据 / 影响程度(severity) / 可信度 / 下一步建议。
 *
 * Rule-First：severity 与 confidence 都由结构化字段派生，不调 LLM。
 *  - severity：Risk 取 level；Finding 取方向（下滑=high，上升=low）。
 *  - confidence：由 evidence.coverage 派生（≥80 High / 50–79 Medium / <50 Low，对齐 CoverageLevel）。
 *
 * 纯函数，可单测。
 */

import type { ConfidenceLevel } from "@/lib/data/data-trust";
import type { Evidence, Finding, Risk, RootCause } from "./types";

export type InsightSeverity = "high" | "medium" | "low";

export interface InsightCard {
  id: string;
  kind: "finding" | "risk";
  title: string;
  businessImpact: string;
  metricLabel: string;
  direction: "up" | "down";
  severity: InsightSeverity;
  confidence: ConfidenceLevel | null;
  confidenceScore: number | null;
  evidence?: Evidence;
  rootCause?: RootCause;
  nextSteps: string[];
}

function confFromCoverage(coverage: number | null | undefined): ConfidenceLevel | null {
  if (coverage == null) return null;
  if (coverage >= 80) return "High";
  if (coverage >= 50) return "Medium";
  return "Low";
}

export function buildInsightCards(findings: Finding[], risks: Risk[]): InsightCard[] {
  const cards: InsightCard[] = [];

  for (const r of risks) {
    cards.push({
      id: r.id,
      kind: "risk",
      title: r.title,
      businessImpact: r.impact || r.description,
      metricLabel: "",
      direction: "down",
      severity: r.level,
      confidence: confFromCoverage(r.evidence?.coverage),
      confidenceScore: r.evidence?.coverage ?? null,
      evidence: r.evidence,
      rootCause: r.rootCause,
      nextSteps: ["进入根因分析", "查看数据证据"],
    });
  }

  for (const f of findings) {
    cards.push({
      id: f.id,
      kind: "finding",
      title: f.title,
      businessImpact: f.description,
      metricLabel: f.metric,
      direction: f.direction,
      severity: f.direction === "down" ? "high" : "low",
      confidence: confFromCoverage(f.evidence?.coverage),
      confidenceScore: f.evidence?.coverage ?? null,
      evidence: f.evidence,
      rootCause: f.rootCause,
      nextSteps: ["进入根因分析"],
    });
  }

  // 排序：severity high→low；同档 risk 优先
  const rank: Record<InsightSeverity, number> = { high: 0, medium: 1, low: 2 };
  cards.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || (a.kind === "risk" ? -1 : 1),
  );
  return cards;
}
