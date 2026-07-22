/**
 * 字段规范（Field Spec）—— Data Collection Module V2 的「上传前字段规范提示」数据源。
 *
 * 每张可入库的事实表（FactTableKind：channel/member/scrm/events）一份规范：
 *  - 用途 purpose：上传这份数据能支撑哪些分析；
 *  - 必须字段 required / 推荐字段 recommended：均为 FIELD_ALIASES 的规范列名（中英文别名见 fact-table-builder）；
 *  - 缺少字段影响 missingImpact：缺这份数据会失去哪些指标（对齐 gap.ts SYSTEM_ADVICE）。
 *
 * 纯常量 + 纯函数，可单测；被 Step2「添加数据」弹窗与「字段规范提示」模块共用。
 * 防漂移：field-spec.test.ts 断言每个 required/recommended 都 ∈ FIELD_ALIASES[kind]。
 */

// 仅 type-only 引用 FactTableKind：避免把 fact-table-builder → csv-engine(fs) 拖进客户端 bundle。
// 防漂移断言由 field-spec.test.ts 在 node 环境直接 import FIELD_ALIASES 完成。
import type { FactTableKind } from "@/lib/data/fact-table-builder";

export interface FieldSpec {
  /** 数据类型中文名 */
  label: string;
  /** 用途：上传这份数据能做的分析 */
  purpose: string[];
  /** 必须字段（规范列名） */
  required: string[];
  /** 推荐字段（规范列名） */
  recommended: string[];
  /** 缺少这份数据的影响（失去的指标/分析） */
  missingImpact: string[];
}

export const FIELD_SPEC: Record<FactTableKind, FieldSpec> = {
  channel: {
    label: "渠道经营日表（订单/营销）",
    purpose: ["GMV 趋势", "订单量", "客单价（AOV）", "渠道贡献", "ROI"],
    required: ["date", "channel", "gmv", "orders"],
    recommended: [
      "visitors",
      "buyers",
      "marketing_cost",
      "refund_amount",
      "new_customers",
      "returning_customers",
    ],
    missingImpact: ["GMV", "订单数", "客单价", "ROI", "渠道贡献"],
  },
  member: {
    label: "会员运营日表",
    purpose: ["会员增长", "会员分层", "LTV（生命周期价值）", "复购分析"],
    required: ["date", "total_members", "new_members"],
    recommended: [
      "active_members",
      "vip_members",
      "buyers",
      "repeat_buyers",
      "churn_members",
    ],
    missingImpact: ["会员总数", "新增会员", "LTV", "复购率", "流失率"],
  },
  scrm: {
    label: "企微/私域日表",
    purpose: ["好友增长", "触达分析", "私域转化", "核销分析"],
    required: ["date", "total_friends", "new_friends"],
    recommended: [
      "consultants",
      "reached_users",
      "reply_users",
      "converted_users",
      "coupon_sent",
      "coupon_used",
    ],
    missingImpact: ["好友数", "触达率", "私域转化", "回复率", "核销率"],
  },
  events: {
    label: "业务事件表",
    purpose: ["外部事件归因", "异常解释（如大促/缺货/迁移）"],
    required: ["event_date", "event_name", "impact_direction"],
    recommended: ["event_type", "impact_level", "description", "event_id"],
    missingImpact: ["事件归因（仅辅助，不影响核心指标可分析性）"],
  },
};

/** 「添加数据」弹窗的类型选择项（顺序即展示顺序） */
export const INGEST_KINDS: { kind: FactTableKind; label: string }[] = (
  ["channel", "member", "scrm", "events"] as FactTableKind[]
).map((k) => ({ kind: k, label: FIELD_SPEC[k].label }));

/**
 * 给定某数据集已命中的规范字段，计算仍缺失的必须/推荐字段。
 * @param matched 该数据集命中的规范字段名（来自 schema.matchedByTable 展平）
 */
export function missingFields(
  kind: FactTableKind,
  matched: string[],
): { missingRequired: string[]; missingRecommended: string[] } {
  const spec = FIELD_SPEC[kind];
  const has = new Set(matched);
  return {
    missingRequired: spec.required.filter((f) => !has.has(f)),
    missingRecommended: spec.recommended.filter((f) => !has.has(f)),
  };
}

/** 把 schema.matchedByTable 展平为命中字段名数组（跨表） */
export function flattenMatched(
  matchedByTable: Partial<Record<FactTableKind, string[]>>,
): string[] {
  const out: string[] = [];
  for (const fields of Object.values(matchedByTable)) {
    if (fields) out.push(...fields);
  }
  return out;
}
