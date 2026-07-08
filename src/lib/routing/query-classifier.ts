/**
 * Query Classifier —— 查询分类器（doc 18_Query_Classifier V2.0）
 *
 * 三层架构（doc 18 §Overall Architecture）：
 *   Layer 1  Intent Parser        NL → 6 类 QueryType
 *   Layer 2  Parameter Extractor  NL → { metric, timeRange, dimension, channel, segment, compareTarget }
 *   Layer 3  Query Classifier     QueryType → 执行引擎（由 Router 消费）
 *
 * 五条铁律落到分类器自身（doc 15 + doc 18 V2）：
 *   - Rule First：纯规则分类先行，置信度足够直接返回（by="rule"），cost=0
 *   - LLM Last：仅当规则置信度 < 阈值 且 GLM 可用时，才调用 GLM 辅助分类（by="llm"）
 *   - 测试与 CI 无 Key 时全程走规则，确定性可复现
 *
 * 与既有 Intent（业务域 sales/crm/channel）正交：本层回答「用户想干什么」。
 */

import type { Range } from "@/lib/data/daily";
import { resolveMetricKey, type MetricKey } from "@/lib/kb/metric-kb";
import { isLlmEnabled, chat } from "@/lib/agents/llm-client";
import type { CostAcc } from "@/lib/agents/usage";
import type { Classification, QueryParams, QueryType } from "./types";
import { QUERY_TYPES } from "./types";

/* ------------------------------------------------------------------ *
 * Layer 1 —— Intent Parser（规则优先）
 * ------------------------------------------------------------------ */

/** 需 LLM 公式计算的派生指标 → Calculation Query；其余聚合量 → Metric Query（doc 18） */
const CALCULATED_METRICS: MetricKey[] = [
  "roi",
  "ltv",
  "repurchaseRate",
  "conversion",
  "churnRate",
  "aov",
  "refundRate",
  "reachRate",
  "replyRate",
  "scrmConversion",
  "couponRedemption",
];

/** 各类别的规则（按优先级排序；越靠前越优先，避免歧义） */
interface Rule {
  type: QueryType;
  /** 命中即归类（正则） */
  patterns: RegExp[];
  /** 命中后置信度 */
  confidence: number;
  reason: string;
}

const RULES: Rule[] = [
  // 1) Requirement：明确的产物诉求（PRD / 方案 / 设计 / 需求 / 系统不支持）
  {
    type: "requirement",
    patterns: [
      /帮我(生成|写|做).*(PRD|需求文档|方案)/,
      /(生成|写|出).*(PRD|需求文档)/,
      /设计.*(体系|方案|系统|功能)/,
      /系统(不)?支持.{0,4}(怎么办|怎么(办|处理))/,
      /需求?(建议|设计|规划)/,
      /\bPRD\b/i,
    ],
    confidence: 0.9,
    reason: "命中需求/方案/PRD 诉求 → Requirement Query",
  },
  // 2) Execution：系统操作（如何创建/配置/操作/在哪里 + 能力词）
  {
    type: "execution",
    patterns: [
      /(如何|怎么|怎样|在哪里|在哪|哪里).{0,6}(创建|配置|设置|开通|建|操作|发|添加|新建)/,
      /(创建|配置|设置|开通|新建|添加).{0,4}(优惠券|活动|标签|人群|任务|流程|会员等级)/,
      /操作路径|怎么操作|在哪里.{0,4}(创建|配置|设置)/,
    ],
    confidence: 0.85,
    reason: "命中系统操作诉求 → Execution Query（Capability KB）",
  },
  // 3) Strategy：经营改善（如何提升/提高/优化/改善/怎么办 + 指标/问题）
  {
    type: "strategy",
    patterns: [
      /(如何|怎么|怎样).{0,4}(提升|提高|增加|改善|优化|拉高|做大)/,
      /(提升|提高|增加|改善|优化).*(复购|GMV|LTV|转化|客单|触达|留存|增长|ROI)/,
      /(复购率|GMV|LTV|转化率|客单价|触达率|留存率).{0,6}(下降|下滑|走低).{0,6}(怎么办|怎么(办|处理|解决)|对策)/,
      /有什么.{0,4}(策略|方案|办法|招)/,
    ],
    confidence: 0.85,
    reason: "命中经营改善诉求 → Strategy Query（Strategy Engine + Capability KB）",
  },
  // 4) Insight：归因分析（为什么 / 原因 / 归因 / 怎么回事）
  {
    type: "insight",
    patterns: [
      /为什么|原因|归因|怎么回事|为何/,
      /(为什么|为何).*(下降|上升|下滑|增长|变化|波动)/,
      /分析一下|帮我分析|深度分析/,
    ],
    confidence: 0.85,
    reason: "命中归因/分析诉求 → Insight Query（Insight Engine + GLM）",
  },
  // 5) Metric / Calculation：取值查询（X 是多少 / 怎么样 / 多少 / 目前 / 现在）
  {
    type: "metric", // 占位；命中后按指标类型二次判定 metric vs calculation
    patterns: [
      /(是多少|怎么样|怎样|多少|目前|现在|当前|累计|总共)/,
      /(GMV|订单数|订单量|会员数|好友数|新增|活跃).{0,6}(是多少|多少|怎么样)/,
    ],
    confidence: 0.8,
    reason: "命中取值诉求 → Metric/Calculation Query（SQL/Metric Engine）",
  },
];

/** 取值类命中后，按指标是否为派生量区分 Metric / Calculation */
function refineValueQuery(question: string): { type: QueryType; reason: string } {
  const key = resolveMetricKey(question);
  if (key && CALCULATED_METRICS.includes(key)) {
    return { type: "calculation", reason: `命中取值诉求且指标「${key}」为派生量 → Calculation Query（Metric Engine）` };
  }
  return { type: "metric", reason: "命中取值诉求，指标为聚合量 → Metric Query（SQL Engine）" };
}

/* ------------------------------------------------------------------ *
 * Layer 2 —— Parameter Extractor（doc 18 §Parameter Extractor）
 * ------------------------------------------------------------------ */

const RANGE_RULES: { re: RegExp; range: Range }[] = [
  { re: /近?7天|最近一周|本周|上一?周/, range: 7 },
  { re: /近?14天|两周|最近两周/, range: 14 },
  { re: /近?30天|本月|这个月|最近一月/, range: 30 },
  { re: /近?90天|三个月|本季|最近一季/, range: 90 },
];

const CHANNEL_RULES: { re: RegExp; channel: string }[] = [
  { re: /企微|企业微信|私域/, channel: "Enterprise WeChat" },
  { re: /小程序/, channel: "Mini Program" },
  { re: /天猫/, channel: "Tmall" },
  { re: /京东/, channel: "JD" },
  { re: /小红书/, channel: "Xiaohongshu" },
  { re: /门店|线下/, channel: "Offline Store" },
  { re: /\bAPP\b|应用端/, channel: "APP" },
];

const SEGMENT_RULES: { re: RegExp; segment: string }[] = [
  { re: /VIP|高价值/, segment: "VIP" },
  { re: /普通会员|普通用户/, segment: "Normal Member" },
  { re: /新会员|新客|新注册/, segment: "New Member" },
  { re: /沉睡/, segment: "Dormant Member" },
];

const COMPARE_RULES: { re: RegExp; target: string }[] = [
  { re: /相比?昨天|比昨天|环比昨天|今天对比/, target: "yesterday" },
  { re: /相比?上周|比上周|环比上周|本周对比/, target: "last_week" },
  { re: /相比?上月|比上月|环比上月|本月对比/, target: "last_month" },
];

/** 从 NL 抽取查询参数（纯规则，可单测） */
export function extractParams(question: string): QueryParams {
  const params: QueryParams = {};

  // 指标
  const metricKey = resolveMetricKey(question);
  if (metricKey) {
    params.metricKey = metricKey;
    params.metric = metricKey;
  }

  // 时间范围
  for (const { re, range } of RANGE_RULES) {
    if (re.test(question)) {
      params.range = range;
      params.timeRange = `last_${range}_days`;
      break;
    }
  }
  if (/今天|今日/.test(question)) params.timeRange = "today";
  else if (/昨天/.test(question)) params.timeRange = "yesterday";

  // 渠道
  for (const { re, channel } of CHANNEL_RULES) {
    if (re.test(question)) {
      params.channel = channel;
      params.dimension = "channel";
      break;
    }
  }

  // 会员分群
  const segs: string[] = [];
  for (const { re, segment } of SEGMENT_RULES) {
    if (re.test(question)) segs.push(segment);
  }
  if (segs.length) {
    params.segment = Array.from(new Set(segs));
    params.dimension = params.dimension ?? "member";
  }

  // 区域
  if (/华东|长三角/.test(question)) {
    params.region = "East China";
    params.dimension = params.dimension ?? "region";
  } else if (/华北|京津冀/.test(question)) {
    params.region = "North China";
    params.dimension = params.dimension ?? "region";
  } else if (/华南|粤港澳/.test(question)) {
    params.region = "South China";
    params.dimension = params.dimension ?? "region";
  }

  // 对比对象
  for (const { re, target } of COMPARE_RULES) {
    if (re.test(question)) {
      params.compareTarget = target;
      break;
    }
  }

  return params;
}

/* ------------------------------------------------------------------ *
 * Layer 3 —— 规则分类主入口（同步、纯函数）
 * ------------------------------------------------------------------ */

/** 纯规则分类（不调用 LLM）。测试与默认路径使用。 */
export function classifyRule(question: string): Classification {
  const params = extractParams(question);
  const text = question.toLowerCase();

  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(question) || re.test(text))) {
      if (rule.type === "metric") {
        const refined = refineValueQuery(question);
        return {
          queryType: refined.type,
          confidence: rule.confidence,
          params,
          reason: refined.reason,
          by: "rule",
        };
      }
      return {
        queryType: rule.type,
        confidence: rule.confidence,
        params,
        reason: rule.reason,
        by: "rule",
      };
    }
  }

  // 默认：通用经营问题 → 走取数概览（SQL First，避免无谓 LLM）
  const refined = refineValueQuery(question);
  return {
    queryType: refined.type,
    confidence: 0.5,
    params,
    reason: "未命中明确意图，默认走取数概览（Rule First，最小化 LLM）",
    by: "rule",
  };
}

/** 规则置信度低于此阈值时，考虑 GLM 辅助（doc 18 V2） */
const LLM_ASSIST_THRESHOLD = 0.6;

/* ------------------------------------------------------------------ *
 * LLM 辅助分类（doc 18 V2 · 低置信度回落）
 * ------------------------------------------------------------------ */

const CLASSIFY_SYSTEM = `你是 AI Business Analyst 的 Query Classifier。
只输出 JSON，字段：
{ "queryType": "metric"|"calculation"|"insight"|"strategy"|"execution"|"requirement",
  "confidence": 0~1,
  "reason": "一句话理由" }
分类定义：
- metric      指标查询（今天GMV是多少？订单数？会员数？）→ SQL 直答
- calculation 派生指标计算（ROI/LTV/复购率/转化率/客单价 是多少？）→ 公式计算
- insight     经营归因（为什么GMV下降？为什么复购走弱？）→ 归因分析
- strategy    经营改善（如何提升复购率？如何做大LTV？）→ 策略推荐
- execution   系统操作（如何创建优惠券？在哪里配置自动营销？）→ 操作指引
- requirement 需求设计（帮我生成PRD / 设计会员成长体系 / 系统不支持怎么办）→ PRD/方案
仅输出 JSON，不要任何解释。`;

interface LlmClassifyOutput {
  queryType: QueryType;
  confidence: number;
  reason: string;
}

async function llmClassify(question: string, acc?: CostAcc): Promise<LlmClassifyOutput | null> {
  if (!isLlmEnabled()) return null;
  try {
    const result = await chat({
      system: CLASSIFY_SYSTEM,
      messages: [{ role: "user", content: question }],
      json: true,
      temperature: 0,
    });
    if (result.usage) acc?.add({ ...result.usage, model: result.model, tier: "medium" });
    const parsed = JSON.parse(result.content) as Partial<LlmClassifyOutput>;
    if (!parsed.queryType || !QUERY_TYPES.includes(parsed.queryType)) return null;
    return {
      queryType: parsed.queryType,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
      reason: parsed.reason ?? "GLM 辅助分类",
    };
  } catch {
    return null; // GLM 不可用 / 解析失败 → 回退规则结果
  }
}

/* ------------------------------------------------------------------ *
 * 对外入口：Rule First + LLM Last
 * ------------------------------------------------------------------ */

/**
 * 查询分类（doc 18 §Query Classifier）。
 *   1) 规则先行；置信度 ≥ 阈值 → 直接返回（by="rule"，cost 0）
 *   2) 置信度 < 阈值 且 GLM 可用 → GLM 辅助分类（by="llm"）
 *   3) GLM 不可用 / 失败 → 返回规则结果（兜底，绝不抛错）
 */
export async function queryClassifier(question: string, acc?: CostAcc): Promise<Classification> {
  const rule = classifyRule(question);

  // 高置信度规则命中：直接返回（Rule First）
  if (rule.confidence >= LLM_ASSIST_THRESHOLD) {
    return rule;
  }

  // 低置信度：尝试 GLM 辅助
  const llm = await llmClassify(question, acc);
  if (llm) {
    return {
      queryType: llm.queryType,
      confidence: Math.max(rule.confidence, llm.confidence),
      params: rule.params, // 参数仍由规则抽取（确定性）
      reason: `${rule.reason} | GLM 辅助：${llm.reason}`,
      by: "llm",
    };
  }

  // 兜底：规则结果
  return rule;
}
