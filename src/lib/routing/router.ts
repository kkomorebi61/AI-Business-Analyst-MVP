/**
 * Query Router —— 决策路由（doc 18 §Execution Engine + doc 15 §Cost Architecture）
 *
 *   Question → QueryClassifier → Router.dispatch(queryType) → 最优执行路径 → QueryResult
 *
 * 路由表（doc 18 verbatim）：
 *   metric       → SQL Engine                         (cost 0)
 *   calculation  → Metric Engine                      (cost 0)
 *   insight      → Insight Engine + Evidence + GLM     (cost Medium)
 *   strategy     → Strategy Engine + Capability KB + GLM (cost High)
 *   execution    → Capability KB                      (cost ≈0)
 *   requirement  → Gap Analysis + LLM(Claude/GLM)     (cost Very High)
 *
 * 五条铁律的落点：每个 handler 先穷尽规则/SQL/知识库，最后才调用 LLM；
 *                RoutingTrace.ruleOrder 记录「为何不调用更贵的引擎」供可解释/审计。
 */

import { type Range } from "@/lib/data/daily";
import { rangeLabel } from "@/lib/data/daily";
import { METRIC_SPECS, type MetricKey, type Role } from "@/lib/kb/metric-kb";
import {
  aggregateCrm,
  aggregateMarketing,
  aggregateSales,
  aggregateScrm,
} from "@/lib/data/csv-engine";
import { runWorkflow } from "@/lib/agents/workflow";
import { isLlmEnabled, chat, pickModel } from "@/lib/agents/llm-client";
import { createCostAcc, type CostAcc } from "@/lib/agents/usage";
import { fillTemplate } from "@/lib/agents/prompt-templates";
import { strategyEngine } from "@/lib/agents/strategy-engine";
import { gapAnalysis, matchCapabilities, topCapability } from "@/lib/kb/capability-kb";
import { queryClassifier } from "./query-classifier";
import { getUnderstanding } from "@/lib/data/dataset-store";
import { isAnalyzable } from "@/lib/data-understanding/gap";
import { DATA_TYPE_LABELS } from "@/lib/data-understanding/recommend";
import type { DataSetType } from "@/lib/data-understanding/types";
import { resolveWindow, type ResolvedWindow, type TimeExpr, type TimeComparison } from "@/lib/data/time";
import {
  metricValue,
  formatMetricValue,
  compareWindows,
  compareChannels,
  trendPoints,
  type TrendPoint,
} from "./comparison-engine";
import { recordRequest } from "./cost-store";
import {
  COST_TIER_LABEL,
  QUERY_TYPE_COST,
  type CalculationAnswer,
  type ComparisonAnswer,
  type ExecutionAnswer,
  type InsightAnswer,
  type MetricAnswer,
  type MissingDataAnswer,
  type QueryAnswer,
  type QueryParams,
  type QueryResult,
  type QueryType,
  type RequirementAnswer,
  type RoutingTrace,
  type StrategyAnswer,
  type TrendAnswer,
} from "./types";
import {
  buildCacheKey,
  cacheGet,
  cachePut,
  CADENCE_TTL_MS,
  QUERY_TYPE_CADENCE,
} from "./cache";

export interface RouteInput {
  question: string;
  /** 显式时间范围（缺省由分类参数或 7 兜底） */
  range?: Range;
  /** 用户视角（doc 15 P3 缓存键 + Insight 工作流 perspective） */
  role?: Role;
}

/** 路由主入口（async：分类可能触发 GLM 兜底） */
export async function routeQuery(input: RouteInput): Promise<QueryResult> {
  const { question, role } = input;
  const acc = createCostAcc();

  // doc 15 P3 Cache First：先查缓存（Key = Question / Range / Role / Brand）
  // range 可能由分类参数细化，读/写都用 input.range ?? 7 兜底以稳定键
  const rangeHint: Range = input.range ?? 7;
  const cacheKey = buildCacheKey({ question, range: rangeHint, role });
  const cached = cacheGet<QueryResult>(cacheKey);
  if (cached.hit) {
    const result: QueryResult = {
      ...cached.value,
      routing: { ...cached.value.routing, cacheHit: true },
    };
    recordRequest({ cacheHit: true, llmRequests: 0, tokensIn: 0, tokensOut: 0 });
    return result;
  }

  const classification = await queryClassifier(question, acc);
  const range: Range = input.range ?? classification.params.range ?? 7;

  // Data First：一切时间基于「最新数据日期」（Date Anchor），缺数据由 detected 判定
  const understanding = getUnderstanding();
  const ctx: HandlerCtx = {
    question,
    range,
    params: classification.params,
    acc,
    role,
    anchor: understanding.latestDataDate,
    detected: understanding.classification.detected,
  };
  const { answer, trace } = await dispatch(classification.queryType, ctx);

  const summary = acc.summary();
  const costTier = QUERY_TYPE_COST[classification.queryType];
  const result: QueryResult = {
    question,
    classification,
    routing: { ...trace, tokensIn: summary.tokensIn, tokensOut: summary.tokensOut },
    answer,
    cost: { tier: costTier, estimate: COST_TIER_LABEL[costTier] },
    anchor: understanding.latestDataDate,
  };

  // 写缓存（按 QueryType 节奏定 TTL）+ 记成本事件
  cachePut(cacheKey, result, CADENCE_TTL_MS[QUERY_TYPE_CADENCE[classification.queryType]]);
  recordRequest({
    cacheHit: false,
    llmRequests: summary.llmRequests,
    tokensIn: summary.tokensIn,
    tokensOut: summary.tokensOut,
  });
  return result;
}

/* ------------------------------------------------------------------ *
 * 分发
 * ------------------------------------------------------------------ */

interface HandlerCtx {
  question: string;
  range: Range;
  params: QueryParams;
  /** 请求级成本累加器（handler 内 chat() 后累加 token，doc 15 §Cost Monitoring） */
  acc: CostAcc;
  /** 用户视角（Insight 工作流 perspective） */
  role?: Role;
  /** Date Anchor：最新数据日期（doc 18 §Time Anchor，禁用系统当前时间） */
  anchor: string;
  /** 当前已识别数据类型（Missing Data Gate 用，doc 18 §Missing Data Checker） */
  detected: DataSetType[];
}

async function dispatch(
  type: QueryResult["classification"]["queryType"],
  ctx: HandlerCtx,
): Promise<{ answer: QueryAnswer; trace: RoutingTrace }> {
  switch (type) {
    case "metric":
      return { answer: handleMetric(ctx), trace: traceFor("metric", false, null) };
    case "calculation":
      return { answer: handleCalculation(ctx), trace: traceFor("calculation", false, null) };
    case "execution":
      return { answer: handleExecution(ctx), trace: traceFor("execution", false, null) };
    case "insight": {
      const { answer, llmModel } = await handleInsight(ctx);
      return { answer, trace: traceFor("insight", Boolean(llmModel), llmModel) };
    }
    case "strategy": {
      const { answer, llmModel } = await handleStrategy(ctx);
      return { answer, trace: traceFor("strategy", Boolean(llmModel), llmModel) };
    }
    case "requirement": {
      const { answer, llmModel } = await handleRequirement(ctx);
      return { answer, trace: traceFor("requirement", Boolean(llmModel), llmModel) };
    }
    case "comparison":
      return { answer: handleComparison(ctx), trace: traceFor("comparison", false, null) };
    case "trend":
      return { answer: handleTrend(ctx), trace: traceFor("trend", false, null) };
  }
}

/* ------------------------------------------------------------------ *
 * Trace 构造（ruleOrder = 可解释决策链）
 * ------------------------------------------------------------------ */

function traceFor(
  type: QueryResult["classification"]["queryType"],
  llmUsed: boolean,
  llmModel: string | null,
): RoutingTrace {
  const base: Record<typeof type, { engines: string[]; ruleOrder: string[] }> = {
    metric: {
      engines: ["SQL Engine"],
      ruleOrder: [
        "① 规则命中取值诉求（confidence≥阈值，Rule First）",
        "② SQL Engine 直接聚合取数（doc 15 Principle 1：规则可解不用 LLM）",
        "③ 结构化指标，禁止 LLM 计算（doc 15 Principle 2）",
      ],
    },
    calculation: {
      engines: ["Metric Engine"],
      ruleOrder: [
        "① 规则命中派生指标（ROI/LTV/复购率…）",
        "② Metric Engine 按公式计算（cost 0，可审计）",
        "③ 禁止 LLM 计算业务指标（doc 15 Principle 2）",
      ],
    },
    insight: {
      engines: ["Insight Engine", "Evidence Engine", "GLM"],
      ruleOrder: [
        "① 规则命中归因诉求",
        "② Insight Engine + Evidence Engine 先取证（Evidence First）",
        "③ GLM 仅用于增强自然语言叙事（LLM Last）",
      ],
    },
    strategy: {
      engines: ["Strategy Engine", "Capability KB", "GLM"],
      ruleOrder: [
        "① 规则命中策略库（Knowledge First）",
        "② Capability KB 解析所需能力（doc 16 Rule 2：复用现有能力）",
        "③ GLM 仅增强策略叙事（LLM Last）",
      ],
    },
    execution: {
      engines: ["Capability KB"],
      ruleOrder: [
        "① 规则命中系统操作诉求",
        "② Capability KB 直答操作路径（Knowledge First，cost≈0）",
        "③ 无需 LLM（doc 15 Principle 8：知识库优先）",
      ],
    },
    requirement: {
      engines: ["Gap Analysis", "Claude"],
      ruleOrder: [
        "① 规则命中需求/方案诉求",
        "② Gap Analysis 检测能力缺口（doc 16 Rule 3：能力缺失才出 PRD）",
        "③ LLM 生成 PRD/方案（Claude/GLM，最高成本档）",
      ],
    },
    comparison: {
      engines: ["Window Engine"],
      ruleOrder: [
        "① 规则命中对比诉求（时段 / 维度，Rule First）",
        "② Window Engine 经 Date Anchor 解析双窗口 / 双渠道",
        "③ 纯聚合对比，禁止 LLM 计算（doc 18 §Comparison）",
      ],
    },
    trend: {
      engines: ["Window Engine"],
      ruleOrder: [
        "① 规则命中趋势诉求（Rule First）",
        "② Window Engine 按日聚合任意区间走势",
        "③ 纯聚合，禁止 LLM 计算（doc 18 §Trend）",
      ],
    },
  };
  const entry = base[type];
  return {
    queryType: type,
    engines: entry.engines,
    ruleOrder: entry.ruleOrder,
    costTier: QUERY_TYPE_COST[type],
    llmUsed,
    llmModel,
  };
}

/* ------------------------------------------------------------------ *
 * 指标取值工具（复用 csv-engine，SQL First）
 * ------------------------------------------------------------------ */

interface MetricFact {
  value: number;
  formatted: string;
  prev: number | null;
  prevFormatted: string | null;
  delta: number | null;
  /** 变化口径：pct 相对% / pp 百分点 / abs 绝对值 */
  changeKind: "pct" | "pp" | "abs";
}

/** 指标 → 等价 SQL（可解释 / 可审计） */
const SQL_FOR: Record<MetricKey, string> = {
  gmv: "SELECT SUM(gmv) FROM daily_channel_metrics WHERE date BETWEEN :start AND :end",
  orders: "SELECT SUM(orders) FROM daily_channel_metrics WHERE date BETWEEN :start AND :end",
  aov: "SELECT SUM(gmv)/SUM(orders) FROM daily_channel_metrics WHERE date BETWEEN :start AND :end",
  conversion: "SELECT SUM(buyers)/SUM(visitors)*100 FROM daily_channel_metrics WHERE date BETWEEN :start AND :end",
  refundRate: "SELECT SUM(refund_amount)/SUM(gmv)*100 FROM daily_channel_metrics WHERE date BETWEEN :start AND :end",
  newMembers: "SELECT SUM(new_members) FROM daily_member_metrics WHERE date BETWEEN :start AND :end",
  activeMembers: "SELECT MAX(active_members) FROM daily_member_metrics WHERE date BETWEEN :start AND :end",
  repurchaseRate: "SELECT SUM(repeat_buyers)/SUM(buyers)*100 FROM daily_member_metrics WHERE date BETWEEN :start AND :end",
  ltv: "SELECT SUM(gmv_90d)/AVG(active_members) — 90 天口径快照",
  churnRate: "SELECT SUM(churn_members)/SUM(total_members)*100 — 90 天滚动",
  vipMembers: "SELECT total_members_snapshot — 期末快照（不受时间筛选影响）",
  totalMembers: "SELECT total_members_snapshot — 期末快照（不受时间筛选影响）",
  roi: "SELECT SUM(gmv)/SUM(marketing_cost) FROM daily_channel_metrics WHERE date BETWEEN :start AND :end",
  reachRate: "SELECT SUM(reached_users)/SUM(total_friends)*100 FROM daily_scrm_metrics WHERE date BETWEEN :start AND :end",
  replyRate: "SELECT SUM(reply_users)/SUM(reached_users)*100 FROM daily_scrm_metrics WHERE date BETWEEN :start AND :end",
  scrmConversion: "SELECT SUM(converted_users)/SUM(reached_users)*100 FROM daily_scrm_metrics WHERE date BETWEEN :start AND :end",
  couponRedemption: "SELECT SUM(coupon_used)/SUM(coupon_sent)*100 FROM daily_scrm_metrics WHERE date BETWEEN :start AND :end",
  totalFriends: "SELECT total_friends_snapshot — 窗口末行（存量）",
  newFriends: "SELECT SUM(new_friends) FROM daily_scrm_metrics WHERE date BETWEEN :start AND :end",
};

function fmtMoney(v: number): string {
  if (v >= 1e8) return `¥${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `¥${Math.round(v / 1e4)}万`;
  return `¥${Math.round(v)}`;
}

function fmtMetric(key: MetricKey, v: number): string {
  const rateLike = ["conversion", "refundRate", "repurchaseRate", "churnRate", "reachRate", "replyRate", "scrmConversion", "couponRedemption"];
  if (rateLike.includes(key)) return `${v.toFixed(1)}%`;
  if (["roi"].includes(key)) return v.toFixed(2);
  if (["gmv", "aov", "ltv"].includes(key)) return fmtMoney(v);
  return v.toLocaleString("zh-CN");
}

/** 取单个指标的本期/上期/变化（复用 csv-engine 四张聚合） */
function metricFact(key: MetricKey, range: Range): MetricFact {
  const sales = aggregateSales(range);
  const crm = aggregateCrm(range);
  const mkt = aggregateMarketing(range);
  const scrm = aggregateScrm(range);

  const pick = (cur: number, prev: number | null, delta: number | null, changeKind: MetricFact["changeKind"]): MetricFact => ({
    value: cur,
    formatted: fmtMetric(key, cur),
    prev,
    prevFormatted: prev === null ? null : fmtMetric(key, prev),
    delta,
    changeKind,
  });

  switch (key) {
    case "gmv": return pick(sales.current.gmv, sales.previous?.gmv ?? null, sales.delta?.gmv ?? null, "pct");
    case "orders": return pick(sales.current.orders, sales.previous?.orders ?? null, sales.delta?.orders ?? null, "pct");
    case "aov": return pick(sales.current.aov, sales.previous?.aov ?? null, sales.delta?.aov ?? null, "pct");
    case "conversion": return pick(sales.current.conversion, sales.previous?.conversion ?? null, sales.delta?.conversion ?? null, "pp");
    case "refundRate": return pick(sales.current.refundRate, sales.previous?.refundRate ?? null, sales.delta?.refundRate ?? null, "pp");
    case "newMembers": return pick(crm.newMembers, null, null, "abs");
    case "activeMembers": return pick(crm.activeMembers, null, null, "abs");
    case "repurchaseRate": return pick(crm.repurchaseRate, crm.prevRepurchaseRate, crm.repurchaseDelta, "pp");
    case "ltv": return pick(crm.ltv, null, null, "abs");
    case "churnRate": return pick(crm.churnRate, null, null, "pp");
    case "vipMembers": return pick(crm.vipMembers, null, null, "abs");
    case "totalMembers": return pick(crm.totalMembers, null, null, "abs");
    case "roi": return pick(mkt.roi, mkt.prevRoi, mkt.roiDelta, "abs");
    case "reachRate": return pick(scrm.reachRate, scrm.prevReachRate, scrm.reachRateDelta, "pp");
    case "replyRate": return pick(scrm.replyRate, scrm.prevReplyRate, scrm.replyRateDelta, "pp");
    case "scrmConversion": return pick(scrm.scrmConversion, scrm.prevScrmConversion, scrm.scrmConversionDelta, "pp");
    case "couponRedemption": return pick(scrm.couponRedemption, scrm.prevCouponRedemption, scrm.couponRedemptionDelta, "pp");
    case "totalFriends": return pick(scrm.totalFriends, scrm.prevTotalFriends, scrm.totalFriendsDelta, "pct");
    case "newFriends": return pick(scrm.newFriends, scrm.prevNewFriends, scrm.newFriendsDelta, "pct");
  }
}

function fmtDelta(f: MetricFact): string | undefined {
  if (f.delta === null || f.delta === undefined) return undefined;
  const sign = f.delta > 0 ? "+" : "";
  if (f.changeKind === "pct") return `${sign}${f.delta.toFixed(1)}%`;
  if (f.changeKind === "pp") return `${sign}${f.delta.toFixed(1)}pp`;
  return `${sign}${f.delta.toFixed(2)}`;
}

/* ------------------------------------------------------------------ *
 * Data First 工具：Missing Data Gate + Time Anchor 窗口（doc 18 §M5 + doc 19 §M4）
 * ------------------------------------------------------------------ */

/** 率类指标（变化按百分点 pp，其余按相对 %） */
const RATE_LIKE_KEYS: MetricKey[] = [
  "conversion", "refundRate", "repurchaseRate", "churnRate",
  "reachRate", "replyRate", "scrmConversion", "couponRedemption",
];

/**
 * Missing Data Checker（doc 18 §M5 + doc 19 §M4）：指标依赖的源数据缺失时**不产出**。
 * 返回 MissingDataAnswer = 拦截并改述缺口；返回 null = 数据充足，放行。
 * 复用 Data Understanding 预计算的缺口（已含人话原因 + 推荐上传类型）。
 */
function missingDataGate(key: MetricKey, detected: DataSetType[]): MissingDataAnswer | null {
  if (isAnalyzable(key, detected)) return null;
  const spec = METRIC_SPECS[key];
  const gap = getUnderstanding().gaps.cannotAnalyze.find((g) => g.metric === spec.name);
  const reason = gap?.reason ?? `缺少 ${spec.source_keys.join("、")} 数据`;
  const recommendUpload = gap ? DATA_TYPE_LABELS[gap.recommendUpload] : "请上传对应业务数据";
  return { kind: "missing_data", metric: spec.name, reason, recommendUpload };
}

/** 本次查询的时间参数 → 具体日期窗口（一切基于 Date Anchor，禁用系统当前时间） */
function queryWindow(ctx: HandlerCtx): ResolvedWindow {
  const expr: TimeExpr = ctx.params.timeExpr ?? { kind: "relative", days: ctx.range };
  return resolveWindow(ctx.anchor, expr);
}

/** 是否为 Range(7/14/30/90) 表达不了的窗口（今天/昨天/自定义）→ 走 Window Engine */
function isWindowed(ctx: HandlerCtx): boolean {
  const k = ctx.params.timeExpr?.kind;
  return k === "today" || k === "yesterday" || k === "absolute";
}

/** Trend 摘要：窗口首尾对比（率类报 pp，其余报 %） */
function trendSummary(key: MetricKey, points: TrendPoint[]): string {
  if (points.length === 0) return "所选窗口内无数据";
  const first = points[0];
  const last = points[points.length - 1];
  if (RATE_LIKE_KEYS.includes(key)) {
    const pp = last.value - first.value;
    return `${first.formatted} → ${last.formatted}（${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp）`;
  }
  if (first.value === 0) return `起步为 0，最新 ${last.formatted}`;
  const chg = ((last.value - first.value) / first.value) * 100;
  return `${first.formatted} → ${last.formatted}（${chg > 0 ? "+" : ""}${chg.toFixed(1)}%）`;
}

/* ------------------------------------------------------------------ *
 * Handler: Metric Query → SQL Engine（Data First：Time Anchor + 缺数据拦截）
 * ------------------------------------------------------------------ */

function handleMetric(ctx: HandlerCtx): MetricAnswer | MissingDataAnswer {
  const key: MetricKey = ctx.params.metricKey ?? "gmv";
  const gate = missingDataGate(key, ctx.detected);
  if (gate) return gate;
  const spec = METRIC_SPECS[key];

  // 今天 / 昨天 / 自定义区间 → Window Engine 按锚点窗口取数（单点值，无环比）
  if (isWindowed(ctx)) {
    const win = queryWindow(ctx);
    const v = metricValue(key, win.from, win.to);
    return {
      kind: "metric",
      metric: spec.name,
      value: formatMetricValue(key, v),
      sql: SQL_FOR[key],
      sources: spec.source_keys,
      windowLabel: win.label,
    };
  }

  // 最近 N 天 → 复用既有 anchor-correct 取数（带环比 delta）
  const f = metricFact(key, ctx.range);
  return {
    kind: "metric",
    metric: spec.name,
    value: f.formatted,
    prev: f.prevFormatted ?? undefined,
    delta: fmtDelta(f),
    direction: (f.delta ?? 0) >= 0 ? "up" : "down",
    sql: SQL_FOR[key],
    sources: spec.source_keys,
    windowLabel: rangeLabel(ctx.range),
  };
}

/* ------------------------------------------------------------------ *
 * Handler: Calculation Query → Metric Engine（公式 + 依据）
 * ------------------------------------------------------------------ */

function handleCalculation(ctx: HandlerCtx): CalculationAnswer | MissingDataAnswer {
  const key: MetricKey = ctx.params.metricKey ?? "roi";
  const gate = missingDataGate(key, ctx.detected);
  if (gate) return gate;
  const spec = METRIC_SPECS[key];

  // 今天 / 昨天 / 自定义区间 → Window Engine 取数
  if (isWindowed(ctx)) {
    const win = queryWindow(ctx);
    const v = metricValue(key, win.from, win.to);
    return {
      kind: "calculation",
      metric: spec.name,
      formula: spec.formula,
      result: formatMetricValue(key, v),
      evidence: [
        { name: spec.name, value: formatMetricValue(key, v) },
        { name: "统计口径", value: spec.formula },
        { name: "统计周期", value: win.label },
      ],
      sql: SQL_FOR[key],
      sources: spec.source_keys,
      windowLabel: win.label,
    };
  }

  const f = metricFact(key, ctx.range);

  // Evidence：派生指标拆出主要计算分量（可审计）
  const evidence: { name: string; value: string }[] = [
    { name: spec.name, value: f.formatted },
    { name: "统计口径", value: spec.formula },
    { name: "统计周期", value: rangeLabel(ctx.range) },
  ];
  // ROI / AOV 额外暴露分量值
  if (key === "roi") {
    const mkt = aggregateMarketing(ctx.range);
    evidence.push({ name: "活动 GMV", value: fmtMoney(mkt.campaignGmv) });
    evidence.push({ name: "营销成本", value: fmtMoney(mkt.campaignCost) });
  } else if (key === "aov") {
    const sales = aggregateSales(ctx.range);
    evidence.push({ name: "GMV", value: fmtMoney(sales.current.gmv) });
    evidence.push({ name: "订单数", value: sales.current.orders.toLocaleString("zh-CN") });
  }

  return {
    kind: "calculation",
    metric: spec.name,
    formula: spec.formula,
    result: f.formatted,
    evidence,
    sql: SQL_FOR[key],
    sources: spec.source_keys,
  };
}

/* ------------------------------------------------------------------ *
 * Handler: Comparison Query → Window Engine（doc 18 §Comparison）
 * 时段对比（今天 vs 昨天）/ 维度对比（企业微信 vs 小程序）
 * ------------------------------------------------------------------ */

function handleComparison(ctx: HandlerCtx): ComparisonAnswer | MissingDataAnswer {
  const key: MetricKey = ctx.params.metricKey ?? "gmv";
  const gate = missingDataGate(key, ctx.detected);
  if (gate) return gate;
  const spec = METRIC_SPECS[key];

  // 维度对比：双渠道（企业微信 vs 小程序）
  const dims = ctx.params.compareChannels;
  if (dims && dims.length >= 2) {
    const win = queryWindow(ctx);
    const res = compareChannels(key, win.from, win.to, dims);
    return {
      kind: "comparison",
      metric: spec.name,
      mode: "dimension",
      channels: res.rows.map((r) => ({ channel: r.channel, formatted: r.formatted })),
      delta:
        res.delta === null
          ? undefined
          : `${res.delta > 0 ? "+" : ""}${res.delta.toFixed(1)}${RATE_LIKE_KEYS.includes(key) ? "pp" : "%"}`,
      direction: res.direction ?? undefined,
      windowLabel: win.label,
      sql: SQL_FOR[key],
    };
  }

  // 时段对比：基线 vs 对比窗口（今天 vs 昨天）
  const cmp: TimeComparison =
    ctx.params.comparison ?? { baseline: { kind: "yesterday" }, comparison: { kind: "today" } };
  const baseline = resolveWindow(ctx.anchor, cmp.baseline);
  const comparison = resolveWindow(ctx.anchor, cmp.comparison);
  const res = compareWindows(key, baseline, comparison);
  return {
    kind: "comparison",
    metric: spec.name,
    mode: "time",
    baseline: { label: res.baseline.label, formatted: res.baseline.formatted },
    comparison: { label: res.comparison.label, formatted: res.comparison.formatted },
    delta: res.deltaFormatted,
    direction: res.direction,
    windowLabel: `${res.baseline.label} vs ${res.comparison.label}`,
    sql: SQL_FOR[key],
  };
}

/* ------------------------------------------------------------------ *
 * Handler: Trend Query → Window Engine（doc 18 §Trend，任意区间走势）
 * ------------------------------------------------------------------ */

function handleTrend(ctx: HandlerCtx): TrendAnswer | MissingDataAnswer {
  const key: MetricKey = ctx.params.metricKey ?? "gmv";
  const gate = missingDataGate(key, ctx.detected);
  if (gate) return gate;
  const spec = METRIC_SPECS[key];
  const win = queryWindow(ctx);
  const points = trendPoints(key, win.from, win.to);
  return {
    kind: "trend",
    metric: spec.name,
    points: points.map((p) => ({ date: p.date, value: p.value, formatted: p.formatted })),
    summary: trendSummary(key, points),
    windowLabel: win.label,
    sql: SQL_FOR[key],
  };
}

/* ------------------------------------------------------------------ *
 * Handler: Execution Query → Capability KB
 * ------------------------------------------------------------------ */

function handleExecution(ctx: HandlerCtx): ExecutionAnswer {
  const top = topCapability(ctx.question);
  const cap = top?.capability ?? matchCapabilities(ctx.question)[0]?.capability;

  // 兜底：未命中能力 → 引导到最近能力分类
  if (!cap) {
    return {
      kind: "execution",
      system: "—",
      module: "未命中",
      capability: "未找到匹配能力",
      businessGoal: "请在 Capability KB 中补充该能力，或换个关键词描述操作目标",
      path: "—",
      steps: ["建议先到「指标中心 / 数据源」确认相关能力，或走「需求设计」提报新能力"],
      bestPractice: [],
      owner: "—",
    };
  }

  return {
    kind: "execution",
    system: cap.system,
    module: cap.module,
    capability: cap.capability,
    businessGoal: cap.businessGoal,
    path: cap.path.join(" > "),
    steps: cap.path.slice(1), // 去掉顶层系统名，作为操作步骤
    bestPractice: cap.bestPractice,
    owner: cap.owner,
  };
}

/* ------------------------------------------------------------------ *
 * Handler: Insight Query → Insight Engine + GLM
 * ------------------------------------------------------------------ */

async function handleInsight(ctx: HandlerCtx): Promise<{ answer: InsightAnswer; llmModel: string | null }> {
  // 复用既有完整工作流（Role→Intent→Metric→Data→Insight + Governance + Evidence）
  const analysis = runWorkflow({ question: ctx.question, range: ctx.range, perspective: ctx.role });

  let narrative: string | undefined;
  let llmModel: string | null = null;
  if (isLlmEnabled()) {
    try {
      const kpiDigest = analysis.kpis
        .map((k) => `${k.name} ${k.value}${k.deltaPct !== undefined ? `(${k.deltaPct > 0 ? "+" : ""}${k.deltaPct.toFixed(1)})` : ""}`)
        .join("；");
      const findingDigest = analysis.findings.map((f) => f.title).join("；");
      const tpl = fillTemplate("insightNarrative", {
        question: ctx.question,
        kpiDigest,
        findingDigest,
      });
      const llmResult = await chat({
        system: tpl.system,
        messages: [{ role: "user", content: tpl.user }],
        temperature: 0.3,
      });
      if (llmResult.usage) ctx.acc.add({ ...llmResult.usage, model: llmResult.model, tier: "medium" });
      narrative = llmResult.content;
      llmModel = llmResult.model;
    } catch {
      narrative = undefined; // LLM 失败 → 回退规则摘要
    }
  }

  return { answer: { kind: "insight", analysis, narrative }, llmModel };
}

/* ------------------------------------------------------------------ *
 * Handler: Strategy Query → Strategy Engine + Capability KB + GLM
 * ------------------------------------------------------------------ */

async function handleStrategy(ctx: HandlerCtx): Promise<{ answer: StrategyAnswer; llmModel: string | null }> {
  const payload = strategyEngine(ctx.question);

  let narrative: string | undefined;
  let llmModel: string | null = null;
  if (isLlmEnabled() && !payload.fallback) {
    try {
      const tpl = fillTemplate("strategyNarrative", {
        question: ctx.question,
        strategyName: payload.strategyName,
        targetAudience: payload.targetAudience.join("、"),
        channel: payload.channel.join("、"),
        capabilities: payload.capabilities.map((c) => c.capability).join("、"),
      });
      const llmResult = await chat({
        system: tpl.system,
        messages: [{ role: "user", content: tpl.user }],
        temperature: 0.3,
      });
      if (llmResult.usage) ctx.acc.add({ ...llmResult.usage, model: llmResult.model, tier: "medium" });
      narrative = llmResult.content;
      llmModel = llmResult.model;
    } catch {
      narrative = undefined;
    }
  }

  return {
    answer: {
      kind: "strategy",
      strategyName: payload.strategyName,
      businessObjective: payload.businessObjective,
      problem: payload.problem,
      rootCause: payload.rootCause,
      targetAudience: payload.targetAudience,
      channel: payload.channel,
      offer: payload.offer,
      expectedResult: payload.expectedResult,
      capabilities: payload.capabilities,
      narrative,
    },
    llmModel,
  };
}

/* ------------------------------------------------------------------ *
 * Handler: Requirement Query → Gap Analysis + LLM(Claude/GLM)
 * ------------------------------------------------------------------ */

async function handleRequirement(ctx: HandlerCtx): Promise<{ answer: RequirementAnswer; llmModel: string | null }> {
  const gap = gapAnalysis(ctx.question);
  const llmModel = isLlmEnabled() ? pickModel("high") : null;

  let prd: RequirementAnswer["prd"];
  if (isLlmEnabled()) {
    try {
      const tpl = fillTemplate("requirementPrd", {
        question: ctx.question,
        gaps: gap.gaps.join("；") || "无现成能力",
        matched: gap.matched.map((m) => m.capability.capability).join("、") || "无",
      });
      const llmResult = await chat({
        system: tpl.system,
        messages: [{ role: "user", content: tpl.user }],
        json: true,
        tier: "high", // doc 18：Requirement → Claude（高阶档，未配则 GLM-5.1）
        temperature: 0.3,
      });
      if (llmResult.usage) ctx.acc.add({ ...llmResult.usage, model: llmResult.model, tier: "high" });
      const { content, model } = llmResult;
      const parsed = JSON.parse(content) as Partial<RequirementAnswer["prd"]>;
      prd = {
        businessValue: parsed.businessValue ?? "（LLM 未返回业务价值）",
        featureProposals: parsed.featureProposals ?? gap.gaps,
        designOutline: parsed.designOutline ?? [],
      };
      return {
        answer: {
          kind: "requirement",
          supported: gap.supported,
          gapSummary: gap.summary,
          gaps: gap.gaps,
          prd,
        },
        llmModel: model,
      };
    } catch {
      prd = ruleBasedPrd(ctx.question, gap); // LLM 失败 → 规则骨架兜底
    }
  } else {
    prd = ruleBasedPrd(ctx.question, gap);
  }

  return {
    answer: {
      kind: "requirement",
      supported: gap.supported,
      gapSummary: gap.summary,
      gaps: gap.gaps,
      prd,
    },
    llmModel,
  };
}

/** LLM 不可用时的规则化 PRD 骨架（Rule First 兜底） */
function ruleBasedPrd(question: string, gap: ReturnType<typeof gapAnalysis>): RequirementAnswer["prd"] {
  return {
    businessValue: `围绕「${question.slice(0, 20)}」补齐能力缺口，提升对应业务闭环效率`,
    featureProposals: gap.gaps.length ? gap.gaps : ["待与业务方确认核心场景后拆解功能点"],
    designOutline: [
      "1. 明确业务目标与成功指标",
      "2. 梳理目标用户与核心场景",
      "3. 设计功能模块与数据流",
      "4. 定义 MVP 范围与上线节奏",
    ],
  };
}
