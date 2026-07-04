/**
 * Query Governance —— 业务事件归因（doc 11 + 05 Mock Data V2「经营剧情」）
 *
 * 数据源：data/business_events.csv（03A Schema · 6 条事件：
 *   618预热 / 核心商品缺货 / VIP专属 / 企微触达异常 / 新品上市 / 618大促）。
 * 规则（05）：所有异常波动必须能追溯到对应经营事件，禁止出现无原因异常。
 *
 * CSV（03A）只给 event_type / impact_direction / description，不含 impact_metrics。
 * 故由 event_type 确定性地派生受影响指标（impact_metrics，英文展示名），
 * 并把 CSV 的枚举（MARKETING/POSITIVE…）映射到归因层使用的展示枚举。
 *
 * 匹配条件（三者同时满足）：
 *   1. 事件 event_date 落在当前时间窗口 [windowStart, windowEnd] 内；
 *   2. 事件 impact_metrics 与异常指标存在交集；
 *   3. 方向一致（Positive↔up / Negative↔down）—— 防止把正向事件错配到负向波动。
 *
 * 注：事件 impact_metrics 用英文展示名（"Refund Rate"），Evidence 项用中文展示名（"退款率"），
 * 故用统一的 DISPLAY_TO_KEY 解析到 MetricKey 后再比对。
 */

import { facts } from "@/lib/data/csv-engine";
import type { MetricKey } from "@/lib/kb/metric-kb";
import type { EventAttribution } from "@/lib/agents/types";

interface BusinessEvent {
  event_date: string;
  event_name: string;
  event_type: "Marketing" | "Supply Chain" | "Member" | "Channel" | "Product";
  impact_metrics: string[];
  impact_direction: "Positive" | "Negative";
  description: string;
}

/** CSV event_type → 归因层展示分类（EventAttribution.event_type 枚举） */
const TYPE_TO_DISPLAY: Record<string, BusinessEvent["event_type"]> = {
  MARKETING: "Marketing",
  PROMOTION: "Marketing",
  INVENTORY: "Supply Chain",
  PRODUCT: "Product",
  CRM: "Member",
  SCRM: "Member",
};

/** CSV event_type → 受影响指标（英文展示名，经 resolveKey 解析为 MetricKey） */
const TYPE_TO_IMPACT: Record<string, string[]> = {
  MARKETING: ["GMV", "Orders", "Conversion Rate"],
  PROMOTION: ["GMV", "Orders"],
  INVENTORY: ["GMV", "Orders"],
  PRODUCT: ["GMV", "Orders", "Conversion Rate"],
  CRM: ["Repurchase Rate", "VIP GMV"],
  SCRM: ["Conversion Rate", "Repurchase Rate"],
};

/** 由 CSV 事实行构造归因用事件（单一数据源 = business_events.csv） */
const EVENTS: BusinessEvent[] = facts.events.map((e) => ({
  event_date: e.event_date,
  event_name: e.event_name,
  event_type: TYPE_TO_DISPLAY[e.event_type] ?? "Marketing",
  impact_metrics: TYPE_TO_IMPACT[e.event_type] ?? ["GMV"],
  impact_direction: e.impact_direction === "POSITIVE" ? "Positive" : "Negative",
  description: e.description,
}));

/** 展示名 → MetricKey（英文事件名 + 中文 Evidence 名统一映射） */
const DISPLAY_TO_KEY: Record<string, MetricKey> = {
  // 英文（08_business_events.impact_metrics）
  GMV: "gmv",
  Orders: "orders",
  AOV: "aov",
  ROI: "roi",
  LTV: "ltv",
  "Conversion Rate": "conversion",
  "Refund Rate": "refundRate",
  "Repurchase Rate": "repurchaseRate",
  "VIP GMV": "vipMembers",
  // 中文（evidence-engine.metricItem）
  订单数: "orders",
  客单价: "aov",
  转化率: "conversion",
  退款率: "refundRate",
  复购率: "repurchaseRate",
  会员LTV: "ltv",
  VIP会员: "vipMembers",
  // GMV / ROI 中英同名，已在上方覆盖
};

/** 把任意展示名解析为 MetricKey（精确命中优先；渠道证据如「私域 GMV」回退正则） */
export function resolveKey(display: string): MetricKey | null {
  if (DISPLAY_TO_KEY[display]) return DISPLAY_TO_KEY[display];
  if (/GMV/i.test(display)) return "gmv";
  if (/LTV/i.test(display)) return "ltv";
  return null;
}

export interface Movement {
  metric: MetricKey;
  direction: "up" | "down";
}

function inWindow(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function directionMatches(move: Movement["direction"], dir: BusinessEvent["impact_direction"]): boolean {
  return (dir === "Positive" && move === "up") || (dir === "Negative" && move === "down");
}

/**
 * 在当前窗口内，找出与异常指标（movements）匹配的业务事件。
 * windowStart/windowEnd 取自当期日序列的首/末日（YYYY-MM-DD）。
 */
export function attributeEvents(args: {
  movements: Movement[];
  windowStart: string;
  windowEnd: string;
}): EventAttribution[] {
  const { movements, windowStart, windowEnd } = args;
  const movedKeys = new Set(movements.map((m) => m.metric));
  const result: EventAttribution[] = [];

  for (const e of EVENTS) {
    if (!inWindow(e.event_date, windowStart, windowEnd)) continue;
    const eventKeys = e.impact_metrics
      .map(resolveKey)
      .filter((k): k is MetricKey => k !== null);

    const matched_metrics: MetricKey[] = [];
    for (const k of eventKeys) {
      if (!movedKeys.has(k)) continue;
      const move = movements.find((m) => m.metric === k);
      if (move && directionMatches(move.direction, e.impact_direction)) {
        matched_metrics.push(k);
      }
    }
    if (matched_metrics.length > 0) {
      result.push({
        event_name: e.event_name,
        event_date: e.event_date,
        event_type: e.event_type,
        direction: e.impact_direction,
        description: e.description,
        matched_metrics,
      });
    }
  }
  return result;
}
