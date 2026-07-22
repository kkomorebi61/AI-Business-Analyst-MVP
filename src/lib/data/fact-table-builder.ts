/**
 * Fact Table Builder（doc 19 §Upload Data · Data First 的取数链路入口）
 *
 * 职责：把用户上传的 CSV（DatasetFile[]，列名任意）归一为 csv-engine 的**规范事实表**
 * （Facts：channel / member / scrm / events）。一旦挂为 Active Dataset，所有指标即
 * 从此计算，**不再回落样本**。
 *
 * 本期口径（确认范围）：仅支持 **聚合日表形态**（03A，与内置样本同构：按日 × 渠道/会员/企微）。
 * 列名经字段别名（中英文 + 常见同义词）映射到规范字段；单元格值（¥/千分位/万/亿/%、
 * YYYY/M/D、渠道名变体）由 csv-engine 的 map* 统一解析。
 * 检测到 raw 事务表（order_id/member_id 流水）时不下发猜测聚合，仅置 rawDetected，
 * 供上传页提示「请按日聚合后上传」。
 *
 * 纯函数、无 fs（解析在 /api/upload 完成）。可单测。
 */

import type { DatasetFile } from "@/lib/data-understanding/types";
import {
  mapChannelRows,
  mapMemberRows,
  mapScrmRows,
  mapEventRows,
  type Facts,
} from "@/lib/data/csv-engine";

/** 列名归一化：小写、去空格/_/-（与 classify.ts 同口径，销售额 ≡ Sales ≡ sales_amount） */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

export type FactTableKind = "channel" | "member" | "scrm" | "events";

/** 规范字段 → 识别别名（中英文 + 同义词；norm 精确匹配） */
export const FIELD_ALIASES: Record<FactTableKind, Record<string, string[]>> = {
  channel: {
    date: ["date", "日期", "统计日期", "dt", "交易日", "order_date"],
    channel: ["channel", "渠道", "渠道名称", "channelname"],
    visitors: ["visitors", "访客数", "访客", "访客量", "uv", "流量"],
    buyers: ["buyers", "买家数", "下单人数", "成交买家", "支付买家数", "购买人数", "buyer_count", "purchaser_count"],
    orders: ["orders", "订单数", "订单量", "成交单数", "ordercount", "下单数", "订单"],
    gmv: ["gmv", "销售额", "成交额", "营业额", "sales", "revenue", "gmv金额"],
    refund_amount: ["refund_amount", "退款金额", "退款额", "退货金额"],
    marketing_cost: ["marketing_cost", "营销成本", "推广费", "投放花费", "广告费", "adcost", "marketing", "营销费用"],
    new_customers: ["new_customers", "新客数", "新增成交客户", "新客户数"],
    returning_customers: ["returning_customers", "老客数", "复购客户", "回头客"],
  },
  member: {
    date: ["date", "日期", "统计日期", "dt"],
    total_members: ["total_members", "会员总数", "累计会员", "注册会员数", "总会员数"],
    active_members: ["active_members", "活跃会员", "活跃用户", "mau", "日活"],
    new_members: ["new_members", "新增会员", "新会员", "拉新", "新注册"],
    vip_members: ["vip_members", "vip会员", "vip数", "高价值会员"],
    buyers: ["buyers", "购买会员", "成交会员", "下单会员"],
    repeat_buyers: ["repeat_buyers", "复购会员", "复购买家", "回购会员"],
    churn_members: ["churn_members", "流失会员", "流失用户", "churn"],
  },
  scrm: {
    date: ["date", "日期", "统计日期", "dt"],
    consultants: ["consultants", "顾问数", "导购数", "接待数"],
    total_friends: ["total_friends", "好友总数", "企微好友", "私域用户数", "好友数"],
    new_friends: ["new_friends", "新增好友", "新加粉", "拉新好友"],
    reached_users: ["reached_users", "触达用户", "触达人数", "送达用户"],
    reply_users: ["reply_users", "回复用户", "回复人数"],
    converted_users: ["converted_users", "成交用户", "转化用户", "成交人数"],
    coupon_sent: ["coupon_sent", "发券数", "发放券", "优惠券发放"],
    coupon_used: ["coupon_used", "核销券", "用券数", "优惠券核销"],
  },
  events: {
    event_id: ["event_id", "事件id"],
    event_date: ["event_date", "事件日期"],
    event_name: ["event_name", "事件名称"],
    event_type: ["event_type", "事件类型"],
    impact_direction: ["impact_direction", "影响方向"],
    impact_level: ["impact_level", "影响级别"],
    description: ["description", "描述", "说明"],
  },
};

/** raw 事务字段（出现即视为「原始流水」，非聚合日表） */
const RAW_FIELDS = [
  "order_id", "transaction_id", "member_id", "user_id", "customer_id",
  "order_amount", "sku", "category", "brand", "campaign",
  "click", "impression", "register_date", "birthday", "points",
  "friend_count", "message_count", "group_count", "employee_id",
];

/**
 * 各表的「核心字段」（排除 date / channel 等骨架列）。资格判定除命中数 ≥ MIN_FIELDS 外，
 * 还要求至少命中 1 个核心字段 —— 防止 raw 订单流（仅 order_date + channel）被误归 channel 表。
 */
const CORE_BY_KIND: Record<FactTableKind, string[]> = {
  channel: ["visitors", "buyers", "orders", "gmv", "refund_amount", "marketing_cost", "new_customers", "returning_customers"],
  member: ["total_members", "active_members", "new_members", "vip_members", "buyers", "repeat_buyers", "churn_members"],
  scrm: ["consultants", "total_friends", "new_friends", "reached_users", "reply_users", "converted_users", "coupon_sent", "coupon_used"],
  events: ["event_id", "event_name", "event_type", "impact_direction", "impact_level", "description"],
};

/** 判定某文件归属某类事实表，命中的规范字段数（≥ MIN 即达标） */
const MIN_FIELDS = 2;

/** 单个用户列名 → 某表的规范字段（norm 精确匹配；同一规范字段只占一次） */
function mapColumnsFor(
  columns: string[],
  aliases: Record<string, string[]>,
): { mapping: Map<string, string>; matched: Set<string> } {
  const mapping = new Map<string, string>();
  const matched = new Set<string>();
  for (const col of columns) {
    const ncol = norm(col);
    for (const [field, aliasList] of Object.entries(aliases)) {
      if (matched.has(field)) continue;
      if (aliasList.some((a) => norm(a) === ncol)) {
        mapping.set(col, field);
        matched.add(field);
        break;
      }
    }
  }
  return { mapping, matched };
}

/** 把用户行按映射重写为规范列名行（值原样透传，解析交给 map*） */
function toCanonicalRows(file: DatasetFile, mapping: Map<string, string>): Record<string, string>[] {
  const pairs = Array.from(mapping.entries()); // [userCol, canonical]
  return file.rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [userCol, canon] of pairs) out[canon] = row[userCol] ?? "";
    return out;
  });
}

export interface UploadDiagnostics {
  /** 是否检测到 raw 事务流水（需提示用户按日聚合后上传） */
  rawDetected: boolean;
  /** 未映射到任何规范字段的用户列名（引导用户改名重传） */
  unmappedColumns: string[];
  /** 各表入库行数 */
  rowsByTable: Record<string, number>;
  /** 命中的规范字段（按事实表分组；供字段规范提示与 schema 捕获） */
  matchedByTable: Partial<Record<FactTableKind, string[]>>;
}

export interface BuildResult {
  facts: Facts;
  diagnostics: UploadDiagnostics;
}

/**
 * 把上传文件构建为规范事实表。
 * 每个文件按字段命中数判定归属 channel/member/scrm/events 之一；命中不足 MIN_FIELDS
 * 的文件计入未识别列，并按是否含 raw 字段标记 rawDetected。
 */
export function buildFacts(files: DatasetFile[]): BuildResult {
  const facts: Facts = { channel: [], member: [], scrm: [], events: [] };
  const rowsByTable: UploadDiagnostics["rowsByTable"] = {};
  const matchedByTable: UploadDiagnostics["matchedByTable"] = {};
  const unmappedSet = new Set<string>();
  let rawDetected = false;

  for (const file of files) {
    // 各表命中情况
    const candidates = (Object.keys(FIELD_ALIASES) as FactTableKind[]).map((kind) => {
      const { mapping, matched } = mapColumnsFor(file.columns, FIELD_ALIASES[kind]);
      const hasCore = CORE_BY_KIND[kind].some((f) => matched.has(f));
      return { kind, mapping, matchedCount: matched.size, hasCore, matched: Array.from(matched) };
    });

    // 取命中最多、≥ MIN 且命中至少 1 个核心字段的表（优先非 events；events 仅当无业务表命中时考虑）
    const qualified = candidates
      .filter((c) => c.matchedCount >= MIN_FIELDS && c.hasCore)
      .sort((a, b) => {
        // events 表优先级最低（business_events 多为辅助归因）
        const rank = (k: FactTableKind) => (k === "events" ? 0 : 1);
        if (rank(a.kind) !== rank(b.kind)) return rank(b.kind) - rank(a.kind);
        return b.matchedCount - a.matchedCount;
      });

    const best = qualified[0];
    if (best) {
      // 该文件未命中（本表）的列 → 未识别
      for (const col of file.columns) {
        if (!best.mapping.has(col)) unmappedSet.add(col);
      }
      const rows = toCanonicalRows(file, best.mapping);
      switch (best.kind) {
        case "channel": facts.channel = facts.channel.concat(mapChannelRows(rows)); break;
        case "member": facts.member = facts.member.concat(mapMemberRows(rows)); break;
        case "scrm": facts.scrm = facts.scrm.concat(mapScrmRows(rows)); break;
        case "events": facts.events = facts.events.concat(mapEventRows(rows)); break;
      }
      rowsByTable[best.kind] = (rowsByTable[best.kind] ?? 0) + rows.length;
      // 累计该表命中的规范字段（去重），供字段规范提示与 schema 捕获
      const prev = matchedByTable[best.kind] ?? [];
      matchedByTable[best.kind] = Array.from(
        new Set([...prev, ...Array.from(best.matched)]),
      );
    } else {
      // 无任何表达标：全部列未识别；按 raw 字段判定 rawDetected
      for (const col of file.columns) unmappedSet.add(col);
      const normedCols = new Set(file.columns.map(norm));
      if (RAW_FIELDS.some((f) => normedCols.has(norm(f)))) rawDetected = true;
    }
  }

  return {
    facts,
    diagnostics: {
      rawDetected,
      unmappedColumns: Array.from(unmappedSet),
      rowsByTable,
      matchedByTable,
    },
  };
}
