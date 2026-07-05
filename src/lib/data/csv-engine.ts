/**
 * CSV Metric Engine —— 单一数据源的指标计算层（V3 · 03A Schema）
 *
 * 权威数据源：项目根 data/ 下的 4 张 CSV 事实表（03A_Daily_Fact_Table_Schema）
 *   daily_channel_metrics.csv  渠道经营事实表（90 天 × 6 渠道）
 *   daily_member_metrics.csv   会员运营事实表（90 天）
 *   daily_scrm_metrics.csv     企微运营事实表（90 天）
 *   business_events.csv        经营事件表（供 Root Cause，由 governance 侧消费）
 *
 * 设计原则（03A）：
 *   - Single Source of Truth：结果指标（GMV/ROI/LTV/复购率…）一律不落盘，
 *     由本引擎对事实表做 SQL 式聚合得到（每函数标注等价 SQL）。
 *   - Rule 1/2 天然成立：总 GMV / 总订单 = Σ 渠道值（GMV 仅存在于渠道表，
 *     不存在第二份总量，故无需对账）。
 *
 * 本模块为「服务端专用」：顶部 import fs，禁止被客户端组件引用
 * （客户端只经 /api/kpis、/api/analyze 取聚合结果）。
 *
 * 对外导出的 4 个 aggregate 函数签名与返回结构，与旧 daily.ts 完全一致，
 * 故 dataAgent / workflow / UI 均无需改动（仅 import 路径切换）。
 */

import { readFileSync } from "fs";
import { join } from "path";
import { rangeLabel, type Range } from "@/lib/data/daily";

/* --------------------------------- CSV 解析 --------------------------------- */

/** 极简 RFC-4180 解析：支持引号字段、转义双引号、CRLF。返回 {列名:值} 数组。 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.length === header.length && r.some((x) => x !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const DATA_DIR = join(process.cwd(), "data");
function loadTable(name: string): Record<string, string>[] {
  return parseCsv(readFileSync(join(DATA_DIR, name), "utf-8"));
}

const num = (r: Record<string, string>, k: string) => Number(r[k] ?? 0);

/* --------------------------------- 事实表行 --------------------------------- */

interface ChannelFact {
  date: string;
  channel: string;
  visitors: number;
  buyers: number;
  orders: number;
  gmv: number;
  refund_amount: number;
  marketing_cost: number;
  new_customers: number;
  returning_customers: number;
}

interface MemberFact {
  date: string;
  total_members: number;
  active_members: number;
  new_members: number;
  vip_members: number;
  buyers: number;
  repeat_buyers: number;
  churn_members: number;
}

interface ScrmFact {
  date: string;
  consultants: number;
  total_friends: number;
  new_friends: number;
  reached_users: number;
  reply_users: number;
  converted_users: number;
  coupon_sent: number;
  coupon_used: number;
}

interface BusinessEventFact {
  event_id: string;
  event_date: string;
  event_name: string;
  event_type: string;
  impact_direction: string;
  impact_level: string;
  description: string;
}

/** 启动时一次性载入并缓存（服务端长驻内存）。 */
const CHANNEL_FACTS: ChannelFact[] = loadTable("daily_channel_metrics.csv").map((r) => ({
  date: r.date,
  channel: r.channel,
  visitors: num(r, "visitors"),
  buyers: num(r, "buyers"),
  orders: num(r, "orders"),
  gmv: num(r, "gmv"),
  refund_amount: num(r, "refund_amount"),
  marketing_cost: num(r, "marketing_cost"),
  new_customers: num(r, "new_customers"),
  returning_customers: num(r, "returning_customers"),
}));

const MEMBER_FACTS: MemberFact[] = loadTable("daily_member_metrics.csv").map((r) => ({
  date: r.date,
  total_members: num(r, "total_members"),
  active_members: num(r, "active_members"),
  new_members: num(r, "new_members"),
  vip_members: num(r, "vip_members"),
  buyers: num(r, "buyers"),
  repeat_buyers: num(r, "repeat_buyers"),
  churn_members: num(r, "churn_members"),
}));

const SCRM_FACTS: ScrmFact[] = loadTable("daily_scrm_metrics.csv").map((r) => ({
  date: r.date,
  consultants: num(r, "consultants"),
  total_friends: num(r, "total_friends"),
  new_friends: num(r, "new_friends"),
  reached_users: num(r, "reached_users"),
  reply_users: num(r, "reply_users"),
  converted_users: num(r, "converted_users"),
  coupon_sent: num(r, "coupon_sent"),
  coupon_used: num(r, "coupon_used"),
}));

const EVENT_FACTS: BusinessEventFact[] = loadTable("business_events.csv").map((r) => ({
  event_id: r.event_id,
  event_date: r.event_date,
  event_name: r.event_name,
  event_type: r.event_type,
  impact_direction: r.impact_direction,
  impact_level: r.impact_level,
  description: r.description,
}));

/** 暴露原始事实表（供 data-integrity 测试与未来 SQL 透传使用）。 */
export const facts = {
  channel: CHANNEL_FACTS,
  member: MEMBER_FACTS,
  scrm: SCRM_FACTS,
  events: EVENT_FACTS,
};

/* --------------------------------- 窗口工具 --------------------------------- */

/** 升序按日期排序后切片：最近 range 个日期 = 当期，其前 range 个日期 = 上一期。 */
function dateWindow<T extends { date: string }>(rows: T[], range: Range) {
  const dates = Array.from(new Set(rows.map((r) => r.date))).sort((a, b) => a.localeCompare(b));
  const n = dates.length;
  const currentDates = new Set(dates.slice(n - range, n));
  const previousDates = new Set(dates.slice(n - 2 * range, n - range));
  const hasComparison = dates.slice(n - 2 * range, n - range).length === range;
  const current = rows.filter((r) => currentDates.has(r.date));
  const previous = hasComparison ? rows.filter((r) => previousDates.has(r.date)) : [];
  return { current, previous, hasComparison, currentDates, dates };
}

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
const pct = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : 0);
const pp = (cur: number, prev: number) => cur - prev;

/** 渠道事实表按日聚合（6 渠道 → 1 行/日），供 Sales / Marketing / 趋势使用。 */
interface DayTotals {
  date: string;
  gmv: number;
  orders: number;
  visitors: number;
  buyers: number;
  refund: number;
  marketing: number;
}
function dailyTotals(rows: ChannelFact[]): DayTotals[] {
  const map = new Map<string, DayTotals>();
  for (const r of rows) {
    const d = map.get(r.date) ?? { date: r.date, gmv: 0, orders: 0, visitors: 0, buyers: 0, refund: 0, marketing: 0 };
    d.gmv += r.gmv;
    d.orders += r.orders;
    d.visitors += r.visitors;
    d.buyers += r.buyers;
    d.refund += r.refund_amount;
    d.marketing += r.marketing_cost;
    map.set(r.date, d);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

const DAY = dailyTotals(CHANNEL_FACTS);

/* ------------------------------- Sales 聚合 -------------------------------- */
/*
  GMV         SELECT SUM(gmv)     FROM daily_channel_metrics WHERE date BETWEEN ...
  Orders      SELECT SUM(orders)  FROM daily_channel_metrics WHERE date BETWEEN ...
  Conversion  SELECT SUM(buyers) / SUM(visitors)
  RefundRate  SELECT SUM(refund_amount) / SUM(gmv)
*/

export interface PeriodMetrics {
  gmv: number;
  orders: number;
  aov: number;
  conversion: number;
  refundRate: number;
}

export interface SalesAggregate {
  range: Range;
  rangeLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics | null;
  delta: { gmv: number; orders: number; aov: number; conversion: number; refundRate: number } | null;
  daily: { date: string; gmv: number; orders: number }[];
  hasComparison: boolean;
}

function periodOf(days: DayTotals[]): PeriodMetrics {
  const gmv = sum(days, (d) => d.gmv);
  const orders = sum(days, (d) => d.orders);
  const visitors = sum(days, (d) => d.visitors) || 1;
  const buyers = sum(days, (d) => d.buyers);
  return {
    gmv,
    orders,
    aov: orders ? gmv / orders : 0,
    conversion: (buyers / visitors) * 100,
    refundRate: gmv ? (sum(days, (d) => d.refund) / gmv) * 100 : 0,
  };
}

export function aggregateSales(range: Range): SalesAggregate {
  const n = DAY.length;
  const current = DAY.slice(n - range, n);
  const prevRows = DAY.slice(n - 2 * range, n - range);
  const hasComparison = prevRows.length === range;
  const c = periodOf(current);
  const p = hasComparison ? periodOf(prevRows) : null;
  return {
    range,
    rangeLabel: rangeLabel(range),
    current: c,
    previous: p,
    delta: p
      ? {
          gmv: pct(c.gmv, p.gmv),
          orders: pct(c.orders, p.orders),
          aov: pct(c.aov, p.aov),
          conversion: pp(c.conversion, p.conversion),
          refundRate: pp(c.refundRate, p.refundRate),
        }
      : null,
    daily: current.map((d) => ({ date: d.date, gmv: d.gmv, orders: d.orders })),
    hasComparison,
  };
}

/* ------------------------------ Channels 聚合 ------------------------------ */
/*
  渠道维度：GMV=SUM(gmv) / Orders=SUM(orders) / Conversion=SUM(buyers)/SUM(visitors)
            ROI = SUM(gmv) / SUM(marketing_cost)
  Rule 1/2：Σ 渠道 GMV = 总 GMV、Σ 渠道订单 = 总订单（同源，天然成立）。
*/

const CHANNEL_NAME: Record<string, string> = {
  PRIVATE_TRAFFIC: "私域",
  MINI_PROGRAM: "小程序",
  XIAOHONGSHU: "小红书",
  TMALL: "天猫",
  JD: "京东",
  OFFLINE_STORE: "线下门店",
};

export interface ChannelAggregate {
  channel: string;
  gmv: number;
  orders: number;
  conversion: number;
  roi: number;
  prevGmv: number | null;
  gmvDelta: number | null;
}

export function aggregateChannels(range: Range): ChannelAggregate[] {
  const { current, previous, hasComparison } = dateWindow(CHANNEL_FACTS, range);
  const names = Array.from(new Set(current.map((r) => r.channel)));
  return names.map((name) => {
    const cur = current.filter((r) => r.channel === name);
    const gmv = sum(cur, (r) => r.gmv);
    const orders = sum(cur, (r) => r.orders);
    const visitors = sum(cur, (r) => r.visitors) || 1;
    const mkt = sum(cur, (r) => r.marketing_cost) || 1;
    let prevGmv: number | null = null;
    let gmvDelta: number | null = null;
    if (hasComparison) {
      const prev = previous.filter((r) => r.channel === name);
      prevGmv = sum(prev, (r) => r.gmv);
      gmvDelta = pct(gmv, prevGmv);
    }
    return {
      channel: CHANNEL_NAME[name] ?? name,
      gmv,
      orders,
      conversion: (sum(cur, (r) => r.buyers) / visitors) * 100,
      roi: gmv / mkt,
      prevGmv,
      gmvDelta,
    };
  });
}

/* -------------------------------- CRM 聚合 --------------------------------- */
/*
  NewMembers / ActiveMembers / VIP  : 来自 daily_member_metrics
  RepurchaseRate = SUM(repeat_buyers) / SUM(buyers)
  ChurnRate      = SUM(churn_members) / SUM(total_members)
  LTV            = Σ90天 GMV / 平均活跃会员（生命周期口径，锚定 90 天，与 range 无关）
*/

export interface CrmAggregate {
  newMembers: number;
  activeMembers: number;
  repurchaseRate: number;
  prevRepurchaseRate: number | null;
  repurchaseDelta: number | null;
  ltv: number;
  churnRate: number;
  vipMembers: number;
}

function crmOf(rows: MemberFact[]) {
  const buyers = sum(rows, (r) => r.buyers) || 1;
  const total = sum(rows, (r) => r.total_members) || 1;
  return {
    newMembers: sum(rows, (r) => r.new_members),
    activeMembers: Math.round(sum(rows, (r) => r.active_members) / rows.length),
    repurchaseRate: (sum(rows, (r) => r.repeat_buyers) / buyers) * 100,
    churnRate: (sum(rows, (r) => r.churn_members) / total) * 100,
    vipMembers: Math.round(sum(rows, (r) => r.vip_members) / rows.length),
  };
}

export function aggregateCrm(range: Range): CrmAggregate {
  const { current, previous, hasComparison } = dateWindow(MEMBER_FACTS, range);
  const c = crmOf(current);
  const prevRepurchaseRate = hasComparison ? crmOf(previous).repurchaseRate : null;

  // LTV：90 天口径（单一数据源 = 渠道 GMV + 会员活跃）
  const n = DAY.length;
  const gmv90 = sum(DAY, (d) => d.gmv);
  const m90 = MEMBER_FACTS.length ? sum(MEMBER_FACTS, (r) => r.active_members) / MEMBER_FACTS.length || 1 : 1;
  const ltv = Math.round(gmv90 / m90);

  return {
    ...c,
    prevRepurchaseRate,
    repurchaseDelta: prevRepurchaseRate !== null ? c.repurchaseRate - prevRepurchaseRate : null,
    ltv,
  };
}

/* -------------------------------- SCRM 聚合 -------------------------------- */
/*
  企微运营事实表（daily_scrm_metrics）：
  ReachRate         SELECT SUM(reached_users) / SUM(total_friends)
  ReplyRate         SELECT SUM(reply_users)   / SUM(reached_users)
  ScrmConversion    SELECT SUM(converted_users) / SUM(reached_users)   触达→成交端到端
  CouponRedemption  SELECT SUM(coupon_used)   / SUM(coupon_sent)
  TotalFriends      期末值（窗口末行 total_friends，存量口径，非 Σ）
  NewFriends        SELECT SUM(new_friends)
*/

export interface ScrmAggregate {
  reachRate: number;
  replyRate: number;
  scrmConversion: number;
  couponRedemption: number;
  totalFriends: number;
  newFriends: number;
  prevReachRate: number | null;
  reachRateDelta: number | null; // pp
  prevReplyRate: number | null;
  replyRateDelta: number | null; // pp
  prevScrmConversion: number | null;
  scrmConversionDelta: number | null; // pp
  prevCouponRedemption: number | null;
  couponRedemptionDelta: number | null; // pp
  prevTotalFriends: number | null;
  totalFriendsDelta: number | null; // pct
  prevNewFriends: number | null;
  newFriendsDelta: number | null; // pct
}

/** 窗口末行（按日期升序）的 total_friends —— 存量口径，防误 Σ */
function lastFriends(rows: ScrmFact[]): number {
  if (!rows.length) return 0;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1].total_friends;
}

function scrmOf(rows: ScrmFact[]) {
  const reached = sum(rows, (r) => r.reached_users) || 1;
  const friends = sum(rows, (r) => r.total_friends) || 1;
  const sent = sum(rows, (r) => r.coupon_sent) || 1;
  return {
    reachRate: (reached / friends) * 100,
    replyRate: (sum(rows, (r) => r.reply_users) / reached) * 100,
    scrmConversion: (sum(rows, (r) => r.converted_users) / reached) * 100,
    couponRedemption: (sum(rows, (r) => r.coupon_used) / sent) * 100,
    totalFriends: lastFriends(rows),
    newFriends: sum(rows, (r) => r.new_friends),
  };
}

export function aggregateScrm(range: Range): ScrmAggregate {
  const { current, previous, hasComparison } = dateWindow(SCRM_FACTS, range);
  const c = scrmOf(current);
  const p = hasComparison ? scrmOf(previous) : null;
  return {
    ...c,
    prevReachRate: p?.reachRate ?? null,
    reachRateDelta: p ? c.reachRate - p.reachRate : null,
    prevReplyRate: p?.replyRate ?? null,
    replyRateDelta: p ? c.replyRate - p.replyRate : null,
    prevScrmConversion: p?.scrmConversion ?? null,
    scrmConversionDelta: p ? c.scrmConversion - p.scrmConversion : null,
    prevCouponRedemption: p?.couponRedemption ?? null,
    couponRedemptionDelta: p ? c.couponRedemption - p.couponRedemption : null,
    prevTotalFriends: p?.totalFriends ?? null,
    totalFriendsDelta: p ? pct(c.totalFriends, p.totalFriends) : null,
    prevNewFriends: p?.newFriends ?? null,
    newFriendsDelta: p ? pct(c.newFriends, p.newFriends) : null,
  };
}

/* ------------------------------ Marketing 聚合 ----------------------------- */
/*
  marketing_cost 现落在渠道事实表（03A）。ROI = SUM(gmv) / SUM(marketing_cost)。
*/

export interface MarketingAggregate {
  roi: number;
  campaignCost: number;
  campaignGmv: number;
  prevRoi: number | null;
  roiDelta: number | null;
}

export function aggregateMarketing(range: Range): MarketingAggregate {
  const n = DAY.length;
  const cur = DAY.slice(n - range, n);
  const prev = DAY.slice(n - 2 * range, n - range);
  const hasComparison = prev.length === range;

  const gmv = sum(cur, (d) => d.gmv);
  const cost = sum(cur, (d) => d.marketing) || 1;
  const roi = gmv / cost;

  let prevRoi: number | null = null;
  if (hasComparison) {
    const pGmv = sum(prev, (d) => d.gmv);
    const pCost = sum(prev, (d) => d.marketing) || 1;
    prevRoi = pGmv / pCost;
  }
  return {
    roi,
    campaignCost: sum(cur, (d) => d.marketing),
    campaignGmv: gmv,
    prevRoi,
    roiDelta: prevRoi !== null ? roi - prevRoi : null,
  };
}
