/**
 * AI 决策路由体系 —— 共享类型（对齐 doc 18_Query_Classifier + doc 15_Cost_Principles）
 *
 * 设计目标：建立「问题分类 → 自动路由 → 最优执行路径」的企业级 AI 决策层。
 *
 * 与既有 Intent（业务域：sales/crm/channel…）正交：
 *   - Intent：回答「这是什么业务主题」
 *   - QueryType：回答「用户想干什么（看数 / 计算 / 归因 / 出策略 / 查操作 / 提需求 / 对比 / 趋势）」
 *
 * 五条铁律（doc 15）：Rule First · SQL First · Evidence First · Knowledge First · LLM Last
 * —— Router 必须先穷尽规则 / SQL / 知识库，最后才调用大模型。
 *
 * Data First 升级（doc 18 V2）：新增 comparison / trend 两类 + Time Anchor 任意时间窗口
 * + Missing Data 拦截（缺数据不产出，doc18 §Missing Data Checker）。
 */

import type { Range } from "@/lib/data/daily";
import type { TimeExpr, TimeComparison, ResolvedWindow } from "@/lib/data/time";
import type { MetricKey } from "@/lib/kb/metric-kb";
import type { AnalysisResult } from "@/lib/agents/types";

/* ------------------------------------------------------------------ *
 * Layer 1 / 3 —— Query Type（doc 18 §Query Classifier）
 * ------------------------------------------------------------------ */

/**
 * 查询类型（capability extension：在原 6 类上加 comparison / trend）。
 * 每类绑定固定执行路径与成本档（doc 18 §Cost Governance）。
 */
export type QueryType =
  | "metric" // 指标查询 → SQL Engine            · cost 0
  | "calculation" // 派生指标计算 → Metric Engine · cost 0
  | "insight" // 经营归因 → Insight Engine + GLM  · cost Medium
  | "strategy" // 策略建议 → Strategy Engine + Capability KB + GLM · cost High
  | "execution" // 系统操作 → Capability KB       · cost ≈0
  | "requirement" // 需求设计 → Gap Analysis + LLM · cost Very High
  | "comparison" // 对比分析 → Window Engine（时段/维度对比）· cost 0（doc18 V2）
  | "trend"; // 趋势分析 → Window Engine（任意区间走势）· cost 0（doc18 V2）

export const QUERY_TYPES: QueryType[] = [
  "metric",
  "calculation",
  "insight",
  "strategy",
  "execution",
  "requirement",
  "comparison",
  "trend",
];

/** 查询类型 → 中文标签 */
export const QUERY_TYPE_LABEL: Record<QueryType, string> = {
  metric: "指标查询",
  calculation: "指标计算",
  insight: "经营分析",
  strategy: "策略建议",
  execution: "系统操作",
  requirement: "需求设计",
  comparison: "对比分析",
  trend: "趋势分析",
};

/** 查询类型 → 执行引擎链（doc 18 §Execution Engine） */
export const QUERY_TYPE_ENGINE_CHAIN: Record<QueryType, string[]> = {
  metric: ["SQL Engine"],
  calculation: ["Metric Engine"],
  insight: ["Insight Engine", "Evidence Engine", "GLM"],
  strategy: ["Strategy Engine", "Capability KB", "GLM"],
  execution: ["Capability KB"],
  requirement: ["Gap Analysis", "Claude"],
  comparison: ["Window Engine"],
  trend: ["Window Engine"],
};

/* ------------------------------------------------------------------ *
 * Layer 2 —— Parameter Extractor（doc 18 §Parameter Extractor + Time Anchor）
 * ------------------------------------------------------------------ */

/**
 * 从自然语言抽取的查询参数。
 * 所有字段可选 —— 缺省由 Router 用默认值（range=7、无维度过滤）兜底。
 */
export interface QueryParams {
  /** 自然语言中的指标名（如 "GMV" / "复购率"） */
  metric?: string;
  /** 归一化到指标库的 MetricKey（resolveMetricKey 产出） */
  metricKey?: MetricKey;
  /** 时间范围原文（today / last_7_days …） */
  timeRange?: string;
  /** 归一化到 7/14/30/90 */
  range?: Range;
  /** doc18 Time Anchor：结构化时间表达（今天/昨天/最近N/自定义区间） */
  timeExpr?: TimeExpr;
  /** doc18 任意对比（时段对比 或 维度对比） */
  comparison?: TimeComparison;
  /** Router 经 Date Anchor 解析出的具体窗口（metric/trend 取数用） */
  window?: ResolvedWindow;
  /** Router 解析出的对比双窗口（comparison 时段对比用） */
  comparisonWindows?: { baseline: ResolvedWindow; comparison: ResolvedWindow };
  /** 业务维度（渠道 / 会员 / 区域 / 商品 / 活动） */
  dimension?: string;
  /** 渠道（APP / 小程序 / 企微 / 门店 …） */
  channel?: string;
  /** 维度对比时的多个渠道（企业微信 vs 小程序） */
  compareChannels?: string[];
  /** 会员分群（VIP / 普通会员 / 新会员 …） */
  segment?: string[];
  /** 区域（华东 / 华北 …） */
  region?: string;
  /** 对比对象（yesterday / last_week / 渠道 A …） */
  compareTarget?: string;
}

/* ------------------------------------------------------------------ *
 * Layer 3 —— Classification 产出
 * ------------------------------------------------------------------ */

export interface Classification {
  queryType: QueryType;
  /** 置信度 0~1。规则命中 ≥0.8；GLM 兜底取模型自评或 0.6 */
  confidence: number;
  params: QueryParams;
  reason: string;
  /** 判定来源：规则优先，低置信度才回落 LLM（doc 18 V2 + doc 15 Rule First） */
  by: "rule" | "llm";
}

/* ------------------------------------------------------------------ *
 * 成本治理（doc 18 §Cost Governance + doc 15 §Model Routing）
 * ------------------------------------------------------------------ */

/** 成本档：从 free（纯 SQL）到 very_high（PRD/方案设计） */
export type CostTier = "free" | "low" | "medium" | "high" | "very_high";

/** 查询类型 → 成本档（doc 18 §Cost Governance） */
export const QUERY_TYPE_COST: Record<QueryType, CostTier> = {
  metric: "free",
  calculation: "free",
  execution: "low",
  insight: "medium",
  strategy: "high",
  requirement: "very_high",
  comparison: "free",
  trend: "free",
};

export const COST_TIER_LABEL: Record<CostTier, string> = {
  free: "0（纯规则/SQL）",
  low: "≈0（知识库查询）",
  medium: "中（Insight + GLM）",
  high: "高（Strategy + GLM）",
  very_high: "很高（需求设计 + LLM）",
};

/* ------------------------------------------------------------------ *
 * 路由留痕（可解释：记录「为什么这么走」）
 * ------------------------------------------------------------------ */

export interface RoutingTrace {
  queryType: QueryType;
  /** 实际调用的引擎，按顺序 */
  engines: string[];
  /**
   * 命中的「Rule First」决策链 —— 每一步说明为何不调用更贵的引擎。
   * 例：["SQL 直答（指标可聚合）", "无需 LLM（结构化数据，doc 15 Principle 2）"]
   */
  ruleOrder: string[];
  costTier: CostTier;
  /** 是否最终触发了大模型（GLM / Claude） */
  llmUsed: boolean;
  /** 使用的 LLM 模型名（未用 LLM 时为 null） */
  llmModel: string | null;
  /** 本次请求输入 token（启用 LLM 时；rule 模式为 0 / 缺省） */
  tokensIn?: number;
  /** 本次请求输出 token */
  tokensOut?: number;
  /** 命中缓存（doc 15 P3；命中则未调用任何引擎） */
  cacheHit?: boolean;
}

/* ------------------------------------------------------------------ *
 * 各类 Answer（判别联合，Router 按类型产出对应结构）
 * ------------------------------------------------------------------ */

/** Metric Query → SQL Engine 产出 */
export interface MetricAnswer {
  kind: "metric";
  metric: string;
  value: string;
  prev?: string;
  delta?: string;
  direction?: "up" | "down";
  /** 等价 SQL（可解释 / 可审计，doc 15 §SQL First） */
  sql: string;
  sources: string[];
  /** Data First：本次取数的时间窗口（label，基于 Date Anchor） */
  windowLabel?: string;
}

/** Calculation Query → Metric Engine 产出 */
export interface CalculationAnswer {
  kind: "calculation";
  metric: string;
  /** 公式（doc 15 Principle 2：指标统一由 Metric Engine 计算） */
  formula: string;
  result: string;
  /** 计算依据（before / after / 变化），可审计 */
  evidence: { name: string; value: string }[];
  sql: string;
  sources: string[];
  windowLabel?: string;
}

/** Insight Query → Insight Engine 产出（直接复用既有 AnalysisResult） */
export interface InsightAnswer {
  kind: "insight";
  /** 复用既有 V1.1 完整分析产物（含 governance / evidence / trace） */
  analysis: AnalysisResult;
  /** GLM 增强的自然语言洞察（启用 LLM 时）；否则为规则摘要 */
  narrative?: string;
}

/** Strategy Query → Strategy Engine + Capability KB 产出 */
export interface StrategyAnswer {
  kind: "strategy";
  strategyName: string;
  businessObjective: string;
  problem: string;
  rootCause: string[];
  targetAudience: string[];
  channel: string[];
  offer: string[];
  expectedResult: string[];
  /** 命中的系统能力（Capability KB） */
  capabilities: { system: string; module: string; capability: string; path: string }[];
  /** GLM 增强的策略叙事（启用 LLM 时） */
  narrative?: string;
}

/** Execution Query → Capability KB 产出（操作路径 + 步骤 + 最佳实践） */
export interface ExecutionAnswer {
  kind: "execution";
  system: string;
  module: string;
  capability: string;
  businessGoal: string;
  /** 操作路径（doc 16 §Operation Path） */
  path: string;
  steps: string[];
  bestPractice: string[];
  owner: string;
}

/** Requirement Query → Gap Analysis + LLM 产出 */
export interface RequirementAnswer {
  kind: "requirement";
  /** 系统是否已支持（doc 16 §Capability Gap Analysis） */
  supported: boolean;
  gapSummary: string;
  /** 缺失的能力点 */
  gaps: string[];
  /** LLM 产出的 PRD / 方案骨架（doc 18 §Requirement Query Output） */
  prd: {
    businessValue: string;
    featureProposals: string[];
    designOutline: string[];
  };
}

/** Comparison Query → Window Engine 产出（doc18 V2 §Comparison，时段/维度对比） */
export interface ComparisonAnswer {
  kind: "comparison";
  metric: string;
  /** "time" 时段对比 / "dimension" 维度对比 */
  mode: "time" | "dimension";
  /** 时段对比：基线 vs 对比窗口 */
  baseline?: { label: string; formatted: string };
  comparison?: { label: string; formatted: string };
  /** 维度对比：各渠道值 */
  channels?: { channel: string; formatted: string }[];
  delta?: string;
  direction?: "up" | "down";
  windowLabel?: string;
  sql: string;
}

/** Trend Query → Window Engine 产出（doc18 V2 §Trend，任意区间走势） */
export interface TrendAnswer {
  kind: "trend";
  metric: string;
  points: { date: string; value: number; formatted: string }[];
  summary: string;
  windowLabel: string;
  sql: string;
}

/** Missing Data 拦截（doc18 §Missing Data Checker + doc19 §M4）：缺数据不产出 */
export interface MissingDataAnswer {
  kind: "missing_data";
  metric: string;
  reason: string;
  recommendUpload: string;
}

export type QueryAnswer =
  | MetricAnswer
  | CalculationAnswer
  | InsightAnswer
  | StrategyAnswer
  | ExecutionAnswer
  | RequirementAnswer
  | ComparisonAnswer
  | TrendAnswer
  | MissingDataAnswer;

/* ------------------------------------------------------------------ *
 * 统一返回
 * ------------------------------------------------------------------ */

export interface QueryResult {
  question: string;
  classification: Classification;
  routing: RoutingTrace;
  answer: QueryAnswer;
  /** 成本预估（可解释、可监控，doc 15 §Cost Monitoring） */
  cost: { tier: CostTier; estimate: string };
  /** Data First：本次回答所基于的 Date Anchor（最新数据日期） */
  anchor?: string;
}
