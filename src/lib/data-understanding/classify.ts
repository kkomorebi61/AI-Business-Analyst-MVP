/**
 * Module 1 · Data Classification（doc 19 §Module 1）
 *
 * 按字段签名识别上传/样本数据的类型（CRM / OMS / Marketing / SCRM / Product）。
 *
 * 识别口径兼容两类形态：
 *  ① doc19 的 raw 事务字段（order_id / member_id / campaign …）；
 *  ② 本项目既有的 daily 聚合事实表字段（gmv / total_members / total_friends …）。
 * 故内置样本（聚合事实表）与用户上传的 raw CSV 均可正确分类。
 *
 * 纯函数、无 fs，可单测。
 */

import type { DataClassification, DataSetType, DatasetFile, DetectedDataset } from "./types";

/** 字段名归一化：小写、去 _/-/空格（order_amount ≡ orderamount ≡ Order Amount） */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

interface Signature {
  type: DataSetType;
  /** 命中即认定的最少字段数（marketing 仅需 1：营销本质就是花费列） */
  min: number;
  fields: string[];
}

/**
 * 字段签名表（doc19 raw 字段 + 本项目聚合字段并集）。
 * 特意排除过于通用的词（如 cost / sales / conversion 单独出现），避免误判。
 */
const SIGNATURES: Signature[] = [
  {
    type: "oms",
    min: 2,
    fields: [
      // raw（doc19）
      "order_id", "order_amount", "order_date",
      // aggregated（本项目）
      "gmv", "orders", "visitors", "buyers", "refund_amount", "new_customers", "returning_customers",
    ],
  },
  {
    type: "crm",
    min: 2,
    fields: [
      // raw
      "member_id", "member_level", "register_date", "birthday", "points",
      // aggregated
      "total_members", "active_members", "new_members", "vip_members", "churn_members", "repeat_buyers", "ltv",
    ],
  },
  {
    type: "marketing",
    min: 1, // 营销本质 = 投放花费列，单列即可认定
    fields: ["marketing_cost", "campaign", "coupon_cost", "click", "impression"],
  },
  {
    type: "scrm",
    min: 2,
    fields: [
      // raw
      "friend_count", "message_count", "group_count", "conversion_count", "employee_id",
      // aggregated
      "total_friends", "new_friends", "reached_users", "reply_users", "converted_users", "coupon_sent", "coupon_used", "consultants",
    ],
  },
  {
    type: "product",
    min: 2,
    fields: ["sku", "category", "brand", "inventory"],
  },
];

/** 单个签名对一组列名的命中字段 */
function matches(columns: string[], sig: Signature): string[] {
  const normed = new Set(columns.map(norm));
  return sig.fields.filter((f) => normed.has(norm(f)));
}

/**
 * 分类整个数据集：每个类型在全部文件里命中的字段并集；
 * 命中数 ≥ min 即判定该类型存在。
 */
export function classify(files: DatasetFile[]): DataClassification {
  const allColumns = files.flatMap((f) => f.columns);
  const totalRows = files.reduce((s, f) => s + f.rows.length, 0);

  const perType: DetectedDataset[] = [];
  for (const sig of SIGNATURES) {
    const matched = matches(allColumns, sig);
    if (matched.length >= sig.min) {
      perType.push({
        type: sig.type,
        matchedFields: matched,
        rowCount: totalRows,
        columns: Array.from(new Set(allColumns)),
      });
    }
  }

  return {
    detected: perType.map((p) => p.type),
    perType,
  };
}

/** 单文件的预测类型（命中数最高且 ≥ min）；用于调试/展示 */
export function classifyFile(file: DatasetFile): DataSetType | null {
  let best: { type: DataSetType; n: number } | null = null;
  for (const sig of SIGNATURES) {
    const n = matches(file.columns, sig).length;
    if (n >= sig.min && (!best || n > best.n)) best = { type: sig.type, n };
  }
  return best?.type ?? null;
}
