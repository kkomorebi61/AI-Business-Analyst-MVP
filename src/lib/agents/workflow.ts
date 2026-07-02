/**
 * Agent 工作流编排
 *
 *   提问 → Role → Intent → Metric → Data → Insight → AnalysisResult
 *
 * Sprint 1：规则引擎 + Mock（默认）。各 Agent 为纯函数，可独立测试。
 * 切换 ANALYST_AGENT_MODE=glm 后，可在保留签名的前提下把各步替换为 GLM 调用。
 */

import { type Range } from "@/lib/data/daily";
import type { Role } from "@/lib/kb/metric-kb";
import { dataAgent } from "./data-agent";
import { insightAgent } from "./insight-agent";
import { intentAgent } from "./intent-agent";
import { metricAgent } from "./metric-agent";
import { roleAgent } from "./role-agent";
import type { AnalysisResult, Intent } from "./types";

export interface WorkflowInput {
  question: string;
  /** 首页"视角"下拉的显式选择（可选） */
  perspective?: Role;
  /** 时间范围：7 / 14 / 30 天，默认 7 */
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
  // 3. Metric Agent
  const metric = metricAgent(role.role, intent.intent);
  // 4. Data Agent（按 range 聚合日数据）
  const data = dataAgent(metric.metrics, range);
  // 5. Insight Agent（基于聚合数据动态生成）
  const insight = insightAgent(role.role, intent.intent, question, data);

  return {
    question,
    perspective: role.role,
    range: data.range,
    rangeLabel: data.rangeLabel,
    title: titleFor(intent.intent, question),
    summary: insight.summary,
    kpis: data.kpis,
    findings: insight.findings,
    risks: insight.risks,
    recommendations: insight.recommendations,
    trend: data.trend,
    hasComparison: data.hasComparison,
    dataSources: data.sources.length,
    trace: {
      role: { role: role.role, reason: role.reason },
      intent: { intent: intent.intent, reason: intent.reason },
      metric: { metrics: metric.metrics },
      data: { sources: data.sources },
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
