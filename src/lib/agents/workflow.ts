/**
 * Agent 工作流编排（V1.1：接入 Query Governance）
 *
 *   提问 → Role → Intent → [门1: 分级 C 短路 + 演示开关]
 *        → Metric → Data → [门2: 异常暂停]
 *        → [门3: A/B 细化 + 事件归因 + 覆盖率 + 风险评估 + 响应策略]
 *        → AnalysisResult
 *
 * Sprint 1：规则引擎 + Mock（默认）。各 Agent 与 Governance 均为纯函数，可独立测试。
 * 切换 ANALYST_AGENT_MODE=glm 后，可在保留签名的前提下把各步替换为 GLM 调用。
 */

import { type Range, rangeLabel } from "@/lib/data/daily";
import type { Role } from "@/lib/kb/metric-kb";
import { dataAgent } from "./data-agent";
import { insightAgent } from "./insight-agent";
import { intentAgent } from "./intent-agent";
import { metricAgent } from "./metric-agent";
import { roleAgent } from "./role-agent";
import type { AnalysisResult, AnomalyResult, GovernanceVerdict, Intent } from "./types";
import { classifyAB, classifyQuery, type ClassifyCResult } from "@/lib/governance/classify";
import { detectAnomaly } from "@/lib/governance/anomaly";
import { attributeEvents } from "@/lib/governance/events";
import { assessCoverage } from "@/lib/governance/coverage";
import { ANOMALY_TEXT } from "@/lib/governance/risk";
import {
  applyStrategy,
  buildVerdict,
  collectMovements,
  demoOverride,
  enrichInsight,
} from "@/lib/governance";

export interface WorkflowInput {
  question: string;
  /** 首页"视角"下拉的显式选择（可选） */
  perspective?: Role;
  /** 时间范围：7 / 14 / 30 / 90 天，默认 7 */
  range?: Range;
}

const AGENT_MODE = (process.env.ANALYST_AGENT_MODE ?? "rule") as "rule" | "glm";

export function runWorkflow({ question, perspective, range = 7 }: WorkflowInput): AnalysisResult {
  // Sprint 1 固定走规则引擎；glm 分支为后续 Sprint 预留（见 llm-client.ts）。
  if (AGENT_MODE === "glm") {
    // 未来：委托给 glmRunWorkflow(question, perspective, range)，签名保持一致。
  }

  // 1. Role Agent
  const role = roleAgent({ question, perspective });
  // 2. Intent Agent
  const intent = intentAgent(question);

  // ── 门 1：能力边界（Class C 短路，不取数） ──
  const c = classifyQuery(question);
  if (c) {
    return refusedResult({ question, perspective: role.role, range, c, intent: intent.intent });
  }

  // 3. Metric Agent
  const metric = metricAgent(role.role, intent.intent);
  // 4. Data Agent（按 range 聚合日数据）
  const data = dataAgent(metric.metrics, range);

  // ── 门 2：异常数据（暂停 AI 分析，但保留 KPI/趋势 dashboard） ──
  const anomaly = detectAnomaly(data);
  if (anomaly.detected) {
    return suspendedResult({ question, perspective: role.role, data, anomaly, role, intent });
  }

  // 5. Insight Agent（基于聚合数据动态生成）
  const insight = insightAgent(role.role, intent.intent, question, data);

  // ── 门 3：事件归因 → A/B 细化 → 覆盖率 → 治理结论 → 响应策略 ──
  const movements = collectMovements(insight.findings, insight.risks);
  const daily = data.sales.daily;
  const windowStart = daily[0]?.date ?? "";
  const windowEnd = daily[daily.length - 1]?.date ?? "";
  const attributedEvents = attributeEvents({ movements, windowStart, windowEnd });
  const { findings, risks } = enrichInsight(insight.findings, insight.risks, attributedEvents);

  const ab = classifyAB(question, intent.intent);
  const citedSources = Array.from(
    new Set([...findings, ...risks].flatMap((t) => t.evidence?.dataSources ?? [])),
  );
  const coverage = assessCoverage(citedSources);
  const verdict = buildVerdict({
    ab,
    coverage,
    anomaly: { detected: false },
    attributedEvents,
    demo: demoOverride(question),
  });
  const applied = applyStrategy({ ...insight, findings, risks }, verdict);

  return {
    question,
    perspective: role.role,
    range: data.range,
    rangeLabel: data.rangeLabel,
    title: titleFor(intent.intent, question),
    summary: applied.summary,
    kpis: data.kpis,
    findings: applied.findings,
    risks: applied.risks,
    recommendations: applied.recommendations,
    trend: data.trend,
    channels: data.channels,
    totalGmv: data.sales.current.gmv,
    hasComparison: data.hasComparison,
    dataSources: data.sources.length,
    governance: verdict,
    trace: {
      role: { role: role.role, reason: role.reason },
      intent: { intent: intent.intent, reason: intent.reason },
      metric: { metrics: metric.metrics },
      data: { sources: data.sources },
      governance: {
        queryClass: verdict.queryClass,
        coverageLevel: verdict.coverageLevel,
        riskLevel: verdict.riskLevel,
        reasons: verdict.reasons,
      },
    },
  };
}

/* ----------------------------- 短路结果构造 ----------------------------- */

/** Class C：超出能力范围，拒绝回答（不取数） */
function refusedResult(args: {
  question: string;
  perspective: Role;
  range: Range;
  c: ClassifyCResult;
  intent: Intent;
}): AnalysisResult {
  const verdict: GovernanceVerdict = {
    queryClass: "C",
    coverageLevel: "Low",
    coverage: null,
    riskLevel: "high",
    responseStrategy: "refuse",
    requiredSources: [],
    missingSources: [],
    metricAvailable: false,
    reasons: [args.c.reason],
    mandatedText: args.c.mandatedText,
    banner: { title: "暂不支持", description: args.c.mandatedText },
    anomaly: { detected: false },
    attributedEvents: [],
  };
  return {
    question: args.question,
    perspective: args.perspective,
    range: args.range,
    rangeLabel: rangeLabel(args.range),
    title: "暂不支持的分析请求",
    summary: { tag: "暂不支持", accuracy: 0, readingTimeSec: 0, text: args.c.mandatedText },
    kpis: [],
    findings: [],
    risks: [],
    recommendations: [],
    trend: [],
    channels: [],
    totalGmv: 0,
    hasComparison: false,
    dataSources: 0,
    governance: verdict,
    trace: {
      role: { role: args.perspective, reason: "显式/默认视角" },
      intent: { intent: args.intent, reason: "Class C 短路" },
      metric: { metrics: [] },
      data: { sources: [] },
      governance: { queryClass: "C", coverageLevel: "Low", riskLevel: "high", reasons: [args.c.reason] },
    },
  };
}

/** 异常数据：暂停 AI 分析，保留 KPI / 趋势（dashboard 降级，doc 11 §10） */
function suspendedResult(args: {
  question: string;
  perspective: Role;
  data: ReturnType<typeof dataAgent>;
  anomaly: AnomalyResult;
  role: ReturnType<typeof roleAgent>;
  intent: ReturnType<typeof intentAgent>;
}): AnalysisResult {
  const { data, anomaly } = args;
  const metricLabel = anomaly.metric ?? "指标";
  const ratioLabel = anomaly.ratio ?? 0;
  const reason = `检测到异常数据（${metricLabel} 环比约 ${ratioLabel}×），暂停 AI 分析`;
  const verdict: GovernanceVerdict = {
    queryClass: "A",
    coverageLevel: "Low",
    coverage: null,
    riskLevel: "high",
    responseStrategy: "suspend",
    requiredSources: [],
    missingSources: [],
    metricAvailable: true,
    reasons: [reason],
    mandatedText: ANOMALY_TEXT,
    banner: { title: "数据异常", description: `${ANOMALY_TEXT}（${metricLabel} 环比约 ${ratioLabel}×）` },
    anomaly,
    attributedEvents: [],
  };
  return {
    question: args.question,
    perspective: args.perspective,
    range: data.range,
    rangeLabel: data.rangeLabel,
    title: "数据异常 · 暂停分析",
    summary: { tag: "数据异常", accuracy: 0, readingTimeSec: 0, text: ANOMALY_TEXT },
    kpis: data.kpis,
    findings: [],
    risks: [],
    recommendations: [],
    trend: data.trend,
    channels: data.channels,
    totalGmv: data.sales.current.gmv,
    hasComparison: data.hasComparison,
    dataSources: data.sources.length,
    governance: verdict,
    trace: {
      role: { role: args.role.role, reason: args.role.reason },
      intent: { intent: args.intent.intent, reason: args.intent.reason },
      metric: { metrics: [] },
      data: { sources: data.sources },
      governance: { queryClass: "A", coverageLevel: "Low", riskLevel: "high", reasons: [reason] },
    },
  };
}

function titleFor(intent: Intent, question: string): string {
  if (/复购/.test(question)) return "复购率下降原因分析";
  if (/渠道/.test(question)) return "渠道表现分析";
  switch (intent) {
    case "crm_analysis":
    case "risk_analysis":
      return "会员与复购分析";
    case "channel_analysis":
      return "渠道表现分析";
    default:
      return "本周表现报告";
  }
}
