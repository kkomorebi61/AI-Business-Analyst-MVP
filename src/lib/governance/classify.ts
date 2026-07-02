/**
 * Query Governance —— 查询分级（doc 11 §4）
 *
 * 两个阶段：
 *  1. classifyQuery(question)        门 1（取数前）：检测超能力类问题（预测 / 竞品）→ Class C 短路。
 *  2. classifyAB(question, intent)   门 3（取数后）：利润/成本 → Class B；
 *                                     否则按主题所需源系统 + 指标库命中 → A 或 B。
 *
 * 纯函数、确定性、可单测。
 */

import { getSource } from "@/lib/data/data-trust";
import type { Intent, QueryClass } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";

/** 源系统"缺失"判定（doc 11 §5）：未接入 OR 覆盖率 < 50（Low） */
const LOW_COVERAGE_THRESHOLD = 50;

function sourceMissing(system: string): boolean {
  const s = getSource(system);
  return !s || s.coverage < LOW_COVERAGE_THRESHOLD;
}

/* ------------------------------- Class C（门 1） ------------------------------- */

const PREDICTION_PATTERN = /预测|未来|下个?月|下季|明年|将会|预计.*趋势|会涨|会跌|会上升|会下降|forecast/i;
const COMPETITOR_PATTERN = /竞品|竞争对手|竞对|对手|市场份额对比/;

const REFUSE_PREDICTION_TEXT = "当前版本暂不支持预测能力";
const REFUSE_COMPETITOR_TEXT = "当前版本暂不支持竞品分析能力";

export interface ClassifyCResult {
  queryClass: "C";
  mandatedText: string;
  reason: string;
}

/** 取数前的能力边界检测；命中返回 Class C，否则 null（继续取数） */
export function classifyQuery(question: string): ClassifyCResult | null {
  if (PREDICTION_PATTERN.test(question)) {
    return { queryClass: "C", mandatedText: REFUSE_PREDICTION_TEXT, reason: "问题涉及预测/未来，超出当前能力范围" };
  }
  if (COMPETITOR_PATTERN.test(question)) {
    return { queryClass: "C", mandatedText: REFUSE_COMPETITOR_TEXT, reason: "问题涉及竞品/市场份额对比，超出当前能力范围" };
  }
  return null;
}

/* ------------------------------- Class A / B（门 3） ------------------------------- */

const PROFIT_PATTERN = /利润|毛利|净利|盈利|profit|成本|物流成本|仓储成本|营销成本|费用/;

/** 「为什么利润下降」的标准 Class B 文案（doc 11 §4 样板） */
export const PROFIT_B_TEXT =
  "目前仅基于订单与会员数据分析。尚未接入成本数据，因此无法确认利润下降的最终原因。";

type Topic = "gmv" | "roi" | "repurchase" | "crm" | "channel" | "overview";

/** 主题 → 必需源系统（doc 11 §5：缺必需源则禁出结论） */
const REQUIRED_SOURCES: Record<Topic, string[]> = {
  gmv: ["OMS"],
  roi: ["OMS", "Marketing Platform"],
  repurchase: ["CRM", "CDP"],
  crm: ["CRM"],
  channel: ["OMS"],
  overview: ["OMS"],
};

/** 主题 → 核心指标（null = 综合分析，默认可用） */
const TOPIC_METRIC: Record<Topic, MetricKey | null> = {
  gmv: "gmv",
  roi: "roi",
  repurchase: "repurchaseRate",
  crm: "repurchaseRate",
  channel: null,
  overview: null,
};

function topicOf(question: string, intent: Intent): Topic {
  if (/复购/.test(question)) return "repurchase";
  if (/会员|留存|流失|ltv|vip/i.test(question) || intent === "crm_analysis" || intent === "risk_analysis") return "crm";
  if (/roi|投产|投放/i.test(question)) return "roi";
  if (/渠道/.test(question) || intent === "channel_analysis") return "channel";
  if (/gmv|销售|订单|客单|成交/i.test(question) || intent === "sales_analysis") return "gmv";
  return "overview";
}

export interface ClassifyABResult {
  queryClass: Extract<QueryClass, "A" | "B">;
  topic: Topic;
  requiredSources: string[];
  missingSources: string[];
  metricAvailable: boolean;
  profitCase: boolean;
  reasons: string[];
}

/** 取数后的 A/B 细化：利润/成本 → B；否则按必需源缺失 → B，齐全 → A */
export function classifyAB(question: string, intent: Intent): ClassifyABResult {
  // 利润/成本：指标库无成本指标 + 成本源未接入 → Class B（doc 11 §4 样板）
  if (PROFIT_PATTERN.test(question)) {
    return {
      queryClass: "B",
      topic: "overview",
      requiredSources: [],
      missingSources: ["成本系统（营销 / 物流 / 仓储成本）"],
      metricAvailable: false,
      profitCase: true,
      reasons: ["利润/成本相关指标不在指标库", "成本数据源（营销/物流/仓储）尚未接入"],
    };
  }

  const topic = topicOf(question, intent);
  const requiredSources = REQUIRED_SOURCES[topic];
  const missingSources = requiredSources.filter(sourceMissing);
  const coreMetric = TOPIC_METRIC[topic];
  const metricAvailable = coreMetric !== null || topic === "overview" || topic === "channel";
  const queryClass: ClassifyABResult["queryClass"] =
    missingSources.length > 0 || !metricAvailable ? "B" : "A";
  const reasons =
    missingSources.length > 0
      ? [`必需源系统缺失：${missingSources.join("、")}`]
      : ["数据完整、指标存在、分析规则存在"];

  return { queryClass, topic, requiredSources, missingSources, metricAvailable, profitCase: false, reasons };
}
