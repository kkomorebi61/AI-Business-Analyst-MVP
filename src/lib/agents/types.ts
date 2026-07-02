/**
 * Agent 工作流的共享类型。
 * 全链路：Role → Intent → Metric → Data → Insight → UI
 */

import type { Range } from "@/lib/data/daily";
import type { MetricKey, Role } from "@/lib/kb/metric-kb";

export type Intent =
  | "business_overview"
  | "sales_analysis"
  | "crm_analysis"
  | "channel_analysis"
  | "risk_analysis";

/** 工作流每一步的"推理留痕"，用于调试与可解释性 */
export interface AgentTrace {
  role: { role: Role; reason: string };
  intent: { intent: Intent; reason: string };
  metric: { metrics: MetricKey[] };
  data: { sources: string[] };
}

/* ---------- Insight Agent 产出结构（对齐报告页各区） ---------- */

export interface KpiPoint {
  key: MetricKey;
  name: string; // GMV
  en: string; // Gross Merchandise Value
  value: string; // ¥4.28亿
  prevLabel: string; // 上周
  prevValue: string; // ¥3.81亿
  deltaPct: number; // 12.4
  direction: "up" | "down";
  icon: string; // 图标 key（UI 层映射 lucide）
}

export interface Finding {
  id: string;
  category: string; // 商品 / 渠道 / 会员
  icon: string;
  title: string;
  description: string;
  metric: string; // +¥770万 GMV
  direction: "up" | "down";
}

export interface Risk {
  id: string;
  level: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string; // 影响: 预计每周减少利润 ¥48万
}

export interface Recommendation {
  id: string; // 行动 01
  icon: string;
  title: string;
  description: string;
  category: string; // CRM
  investment: string; // 低投入
  outcome: string; // +¥210万 GMV
}

export interface AnalysisResult {
  question: string;
  perspective: Role;
  range: Range;
  rangeLabel: string;
  title: string; // 本周表现报告
  summary: {
    tag: string; // 高智能摘要
    accuracy: number; // 96
    readingTimeSec: number; // 45
    text: string;
  };
  kpis: KpiPoint[];
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  /** 当期日序列，供趋势图渲染 */
  trend: { date: string; gmv: number; orders: number }[];
  hasComparison: boolean; // 是否有上一期可比（30 天档为 false）
  dataSources: number; // 4
  trace: AgentTrace;
}
