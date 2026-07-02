/**
 * Agent 工作流的共享类型。
 * 全链路：Role → Intent → Metric → Data → Insight → UI
 */

import type { Range } from "@/lib/data/daily";
import type { MetricKey, Role } from "@/lib/kb/metric-kb";
import type { MetricTrustInfo } from "@/lib/data/data-trust";

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
  /** V1.1：查询治理留痕（分级 / 覆盖率 / 风险 / 理由链） */
  governance?: {
    queryClass: QueryClass;
    coverageLevel: CoverageLevel;
    riskLevel: GovernanceRiskLevel;
    reasons: string[];
  };
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
  /** V3：该指标的数据可信度（10_Data_Trust_Layer），供 KPI 卡内联展示与详情抽屉 */
  trust?: MetricTrustInfo;
}

/* ---------- Evidence Engine（V1.1 可信闭环：每个结论都带数据依据） ---------- */

/** 单个指标的 before → after → change */
export interface EvidenceItem {
  metric: string; // GMV / 复购率 ...
  before: number | null; // 上一期值（无上一期时为 null）
  after: number | null; // 当期值
  change: number | null; // 变化量（见 changeKind）
  changeKind: "pct" | "pp" | "value"; // 相对% / 百分点 / 绝对值
  unit: string; // "¥" / "%" / ""
}

/** 一条结论（Finding / Risk）的数据依据 */
export interface Evidence {
  items: EvidenceItem[];
  dataSources: string[]; // ["OMS","CDP"] —— 引用的源系统
  coverage: number | null; // 0~100，来自 Data Trust 注册表
  healthStatus: string; // Healthy / Warning / Delayed / Error
  lastUpdated: string | null; // 最晚更新时间
}

/* ---------- Query Governance（V1.1：查询分级 / 覆盖率 / 风险 / 响应策略 / 事件归因） ---------- */
/* 来源：11_Query_Governance（§4 分级 / §6 覆盖率 / §7 风险 / §8 响应 / §10 异常） + 10_Data_Trust */

/** 查询分级（doc 11 §4）：A 直答 / B 部分回答 / C 不支持 */
export type QueryClass = "A" | "B" | "C";

/** 覆盖率等级（doc 11 §6 阈值，verbatim）：High ≥ 80 / Medium 50–<80 / Low < 50 */
export type CoverageLevel = "High" | "Medium" | "Low";

/** 治理风险等级（结论可信度风险，与单条 Risk.level 分离避免歧义） */
export type GovernanceRiskLevel = "low" | "medium" | "high";

/** 响应策略：决定 UI 展示与是否抑制结论 */
export type ResponseStrategy = "direct" | "partial" | "refuse" | "suspend";

/** 异常检测结果（doc 11 §10：异常数据暂停 AI 分析） */
export interface AnomalyResult {
  detected: boolean;
  metric?: string;
  ratio?: number;
}

/** 业务事件归因（来源：08_business_events.json） */
export interface EventAttribution {
  event_name: string;
  event_date: string; // YYYY-MM-DD
  event_type: "Marketing" | "Supply Chain" | "Member" | "Channel" | "Product";
  direction: "Positive" | "Negative";
  description: string;
  matched_metrics: MetricKey[]; // 该事件命中的异常指标
}

/** Finding / Risk 的可选根因（事件归因产出） */
export interface RootCause {
  event: EventAttribution;
  note: string; // 例如 "618 预热带动 GMV 环比 +30%"
}

/** 查询治理结论 —— 挂到 AnalysisResult.governance，UI 直读 */
export interface GovernanceVerdict {
  queryClass: QueryClass;
  coverageLevel: CoverageLevel;
  coverage: number | null; // 0~100，已引用源的平均覆盖
  riskLevel: GovernanceRiskLevel;
  responseStrategy: ResponseStrategy;
  requiredSources: string[]; // 本分析类型要求的源系统
  missingSources: string[]; // 缺失源（未接入或覆盖过低）
  metricAvailable: boolean; // 核心指标是否在指标库且有数据
  reasons: string[]; // 判定理由链（可解释 / trace）
  mandatedText: string | null; // 按策略填充的强制文案
  banner: { title: string; description: string }; // 顶部横幅
  anomaly: AnomalyResult;
  attributedEvents: EventAttribution[]; // 本周期内命中的业务事件
}

export interface Finding {
  id: string;
  category: string; // 商品 / 渠道 / 会员
  icon: string;
  title: string;
  description: string;
  metric: string; // +¥770万 GMV
  direction: "up" | "down";
  evidence?: Evidence; // V1.1：数据依据
  lineage?: string[]; // V1.1：数据血缘（METRIC_SPECS.lineage）
  rootCause?: RootCause; // V1.1：业务事件归因
}

export interface Risk {
  id: string;
  level: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string; // 影响: 预计每周减少利润 ¥48万
  evidence?: Evidence; // V1.1：数据依据
  lineage?: string[]; // V1.1：数据血缘
  rootCause?: RootCause; // V1.1：业务事件归因
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
  /** V1.1：查询治理结论（分级 / 覆盖率 / 风险 / 响应策略 / 事件归因） */
  governance: GovernanceVerdict;
  trace: AgentTrace;
}
