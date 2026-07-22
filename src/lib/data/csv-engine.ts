/**
 * CSV Metric Engine —— Active Dataset 的指标计算层（V4 · 03A Schema + Data First）
 *
 * 权威数据源 = **Active Dataset（活跃数据集）**：
 *   - 默认为内置样本（项目根 data/ 下 4 张 CSV 事实表，满足 No Empty Dashboard）；
 *   - /upload 上传后由 Fact Table Builder 构建为规范事实表，挂为活跃，替换样本。
 *   一切指标（GMV/ROI/LTV/复购率…）一律从 Active Dataset 聚合得到，**禁止再用样本兜底**。
 *
 * 设计原则（03A / Data First）：
 *   - Single Source of Truth：结果指标不落盘，由本引擎对事实表做 SQL 式聚合（每函数标注等价 SQL）。
 *   - Rule 1/2 天然成立：总 GMV / 总订单 = Σ 渠道值（GMV 仅存在于渠道表）。
 *   - aggregate* 对外签名与返回结构**不变** → dataAgent / workflow / UI 无需改动；
 *     切换数据源只发生在本模块内部（getFacts()），对上层透明。
 *
 * 本模块为「服务端专用」：顶部 import fs，禁止被客户端组件引用
 * （客户端只经 /api/kpis、/api/analyze 取聚合结果）。
 */

import { readFileSync } from "fs";
import { join } from "path";
import { rangeLabel, type Range } from "@/lib/data/daily";

/* --------------------------------- CSV 解析 --------------------------------- */

/**
 * 公开解析入口：供 /api/upload 解析用户上传 CSV、dataset-store 解析内置样本复用。
 * （Data First 升级：同一份 RFC-4180 解析器服务「样本」与「上传」两条数据源。）
 */
export function parseCsvText(text: string): Record<string, string>[] {
  return parseCsv(text);
}

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

/* ----------------------------- 值解析（样本 + 上传共用） ----------------------------- */
/*
 * map* 行映射函数对「样本」（规范列名、纯数字）与「上传」（经 Fact Table Builder
 * 归一为规范列名，但单元格可能带 ¥/千分位/万/亿/%）统一用下面三个解析器。
 * 样本的干净值经这些解析器后保持不变（passthrough），故历史数值/回归恒等不受影响。
 */

/** 数值解析：去 ¥/$/￥/千分位/空格/%；识别中文量级后缀「万」「亿」；非法/空 → 0。 */
export function parseNumber(s: string | undefined): number {
  if (s == null) return 0;
  let t = String(s).trim();
  if (!t) return 0;
  let mult = 1;
  if (/亿$/.test(t)) {
    mult = 1e8;
    t = t.slice(0, -1);
  } else if (/万$/.test(t)) {
    mult = 1e4;
    t = t.slice(0, -1);
  }
  t = t.replace(/[¥$￥,\s%]/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n * mult : 0;
}

/** 日期解析：YYYY/M/D 或 YYYY-M-D → YYYY-MM-DD；无法识别 → 原值透传（样本本即 ISO）。 */
export function parseDateCell(s: string | undefined): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return t;
}

const CANONICAL_CHANNEL_KEYS = new Set([
  "PRIVATE_TRAFFIC",
  "MINI_PROGRAM",
  "XIAOHONGSHU",
  "TMALL",
  "JD",
  "OFFLINE_STORE",
]);

/** NL 渠道名变体 → 事实表 channel key；已是规范 key 或未识别 → 原值透传。 */
const CHANNEL_KEY_VARIANTS: [RegExp, string][] = [
  [/私域|企微|wechat|private/i, "PRIVATE_TRAFFIC"],
  [/小程序|mini\s*program/i, "MINI_PROGRAM"],
  [/小红书|xiaohongshu|xhs|red/i, "XIAOHONGSHU"],
  [/天猫|tmall/i, "TMALL"],
  [/京东|\bjd\b/i, "JD"],
  [/线下|门店|offline|store/i, "OFFLINE_STORE"],
];

export function normalizeChannelKey(s: string | undefined): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  if (CANONICAL_CHANNEL_KEYS.has(t)) return t;
  for (const [re, key] of CHANNEL_KEY_VARIANTS) if (re.test(t)) return key;
  return t;
}

/* --------------------------------- 事实表行 --------------------------------- */

export interface ChannelFact {
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

export interface MemberFact {
  date: string;
  total_members: number;
  active_members: number;
  new_members: number;
  vip_members: number;
  buyers: number;
  repeat_buyers: number;
  churn_members: number;
}

export interface ScrmFact {
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

export interface BusinessEventFact {
  event_id: string;
  event_date: string;
  event_name: string;
  event_type: string;
  impact_direction: string;
  impact_level: string;
  description: string;
}

/** 规范事实表集合 = Active Dataset 的全部数据。 */
export interface Facts {
  channel: ChannelFact[];
  member: MemberFact[];
  scrm: ScrmFact[];
  events: BusinessEventFact[];
}

/**
 * 行映射（规范列名行 → 强类型事实行）。样本与上传共用：
 *  - 样本：loadTable 直接产出规范列名行；
 *  - 上传：Fact Table Builder 先把用户列名归一为规范列名，再交由此处解析值。
 */
export function mapChannelRows(rows: Record<string, string>[]): ChannelFact[] {
  return rows.map((r) => ({
    date: parseDateCell(r.date),
    channel: normalizeChannelKey(r.channel),
    visitors: parseNumber(r.visitors),
    buyers: parseNumber(r.buyers),
    orders: parseNumber(r.orders),
    gmv: parseNumber(r.gmv),
    refund_amount: parseNumber(r.refund_amount),
    marketing_cost: parseNumber(r.marketing_cost),
    new_customers: parseNumber(r.new_customers),
    returning_customers: parseNumber(r.returning_customers),
  }));
}

export function mapMemberRows(rows: Record<string, string>[]): MemberFact[] {
  return rows.map((r) => ({
    date: parseDateCell(r.date),
    total_members: parseNumber(r.total_members),
    active_members: parseNumber(r.active_members),
    new_members: parseNumber(r.new_members),
    vip_members: parseNumber(r.vip_members),
    buyers: parseNumber(r.buyers),
    repeat_buyers: parseNumber(r.repeat_buyers),
    churn_members: parseNumber(r.churn_members),
  }));
}

export function mapScrmRows(rows: Record<string, string>[]): ScrmFact[] {
  return rows.map((r) => ({
    date: parseDateCell(r.date),
    consultants: parseNumber(r.consultants),
    total_friends: parseNumber(r.total_friends),
    new_friends: parseNumber(r.new_friends),
    reached_users: parseNumber(r.reached_users),
    reply_users: parseNumber(r.reply_users),
    converted_users: parseNumber(r.converted_users),
    coupon_sent: parseNumber(r.coupon_sent),
    coupon_used: parseNumber(r.coupon_used),
  }));
}

export function mapEventRows(rows: Record<string, string>[]): BusinessEventFact[] {
  return rows.map((r) => ({
    event_id: r.event_id ?? "",
    event_date: parseDateCell(r.event_date),
    event_name: r.event_name ?? "",
    event_type: r.event_type ?? "",
    impact_direction: r.impact_direction ?? "",
    impact_level: r.impact_level ?? "",
    description: r.description ?? "",
  }));
}

/* ----------------------------- Active Dataset 状态 ----------------------------- */
/*
 * 进程内可切换的活跃事实表（globalThis guard 保 HMR 单例）。null = 使用惰性构建的内置样本。
 * 切换入口 setActiveFacts/resetFacts 供 dataset-store 在 /upload 时调用。
 */

interface DatasetStore {
  active: Facts | null;
}

const g = globalThis as unknown as { __ANALYST_FACTS__?: DatasetStore };
g.__ANALYST_FACTS__ ??= { active: null };
const F = g.__ANALYST_FACTS__!;

let sampleCache: Facts | null = null;

/** 内置样本 = 4 张 CSV 事实表（惰性构建，进程内只算一次）。 */
function buildSampleFacts(): Facts {
  return {
    channel: mapChannelRows(loadTable("daily_channel_metrics.csv")),
    member: mapMemberRows(loadTable("daily_member_metrics.csv")),
    scrm: mapScrmRows(loadTable("daily_scrm_metrics.csv")),
    events: mapEventRows(loadTable("business_events.csv")),
  };
}

/** 当前活跃事实表：上传数据优先，否则惰性构建内置样本。 */
export function getFacts(): Facts {
  return F.active ?? (sampleCache ??= buildSampleFacts());
}

/** 内置样本事实表（与当前激活无关；供 Dataset Visibility 展示样本元信息） */
export function getSampleFacts(): Facts {
  return sampleCache ?? (sampleCache = buildSampleFacts());
}

/** 上传成功后挂为活跃（替换样本，成为唯一分析源）。 */
export function setActiveFacts(facts: Facts): void {
  F.active = facts;
}

/** 重置回内置样本。 */
export function resetFacts(): void {
  F.active = null;
}

/** 是否正在使用用户上传数据（非样本）。 */
export function isActiveUploaded(): boolean {
  return F.active !== null;
}

/**
 * 活跃数据集的可分析天数 = 渠道/会员/企微三表去重日期数（实时读 Active Facts）。
 * 这是「分析范围」的实际上限：上传多少天，就是多少天。与 UnderstandingResult.dateRange.dayCount
 * 同义，但读的是规范化后的活跃事实表（随时反映 setActiveFacts / resetFacts 的结果）。
 */
export function availableDayCount(): number {
  const f = getFacts();
  const dates = new Set<string>();
  for (const r of f.channel) dates.add(r.date);
  for (const r of f.member) dates.add(r.date);
  for (const r of f.scrm) dates.add(r.date);
  return dates.size;
}

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

/** 渠道事实表按日聚合（多渠道 → 1 行/日），供 Sales / Marketing / 趋势使用。 */
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
  const day = dailyTotals(getFacts().channel);
  const n = day.length;
  const current = day.slice(n - range, n);
  const prevRows = day.slice(n - 2 * range, n - range);
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

/**
 * 当期多指标日序列（经营诊断 V2 · 指标趋势：GMV / Orders / Users / Conversion / AOV）。
 * 基于 dailyTotals（含 visitors/buyers），逐日派生转化率与客单价。不改动 aggregateSales。
 */
export interface DayMetric {
  date: string;
  gmv: number;
  orders: number;
  visitors: number; // Users
  buyers: number;
  conversion: number; // %
  aov: number;
}

export function dailySeries(range: Range): DayMetric[] {
  const day = dailyTotals(getFacts().channel);
  const n = day.length;
  const current = day.slice(n - range, n);
  return current.map((d) => ({
    date: d.date,
    gmv: d.gmv,
    orders: d.orders,
    visitors: d.visitors,
    buyers: d.buyers,
    conversion: d.visitors ? (d.buyers / d.visitors) * 100 : 0,
    aov: d.orders ? d.gmv / d.orders : 0,
  }));
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
  const { current, previous, hasComparison } = dateWindow(getFacts().channel, range);
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
  指标分两类（避免时间维度导致的数据认知错误）：

  一、周期指标（Period · 受时间筛选影响，随 range 窗口变化）：
    NewMembers      SELECT SUM(new_members)
    ActiveMembers   周期内至少发生一次有效行为（登录/浏览/下单/活动参与）的会员数
                    = MAX(daily_active_members) over window
                    窗口越长 ⊇ 越短，MAX 单调不减 → 恒满足 90天 ≥ 30天 ≥ 7天
                    （历史 bug：原取窗口日均，导致 7天 > 90天 的反逻辑）
    RepurchaseRate  SELECT SUM(repeat_buyers) / SUM(buyers)

  二、存量指标（Snapshot · 不受时间筛选影响，锚定「期末 / 近 90 天」）：
    AsOf            期末日期（最新一行 date）→ 展示「截至 YYYY-MM-DD」
    TotalMembers    期末 total_members（快照存量）
    VipMembers      期末 vip_members（快照存量）
    LTV             Σ90天GMV / 平均活跃会员（生命周期口径，锚定 90 天）
    ChurnRate       Σ90(churn_members) / Σ90(total_members)（90 天滚动流失率）

  快照指标一律不随 7/14/30/90 时间筛选器重新计算 —— 否则 VIP/LTV/流失率会
  随窗口摆动，违背「存量指标」的统计含义。
*/

export interface CrmAggregate {
  /* —— 周期指标（受时间筛选影响）—— */
  newMembers: number;
  activeMembers: number;
  repurchaseRate: number;
  prevRepurchaseRate: number | null;
  repurchaseDelta: number | null;
  /* —— 存量指标（快照，不受时间筛选影响）—— */
  asOf: string; // 期末日期 YYYY-MM-DD
  totalMembers: number; // 期末会员总数
  vipMembers: number; // 期末 VIP 会员数
  ltv: number; // 90 天口径 LTV
  churnRate: number; // 90 天滚动流失率
}

/** 周期聚合（当期 / 上一期切片）—— 仅周期指标 */
function crmPeriod(rows: MemberFact[]) {
  const buyers = sum(rows, (r) => r.buyers) || 1;
  return {
    newMembers: sum(rows, (r) => r.new_members),
    activeMembers: rows.length ? Math.max(...rows.map((r) => r.active_members)) : 0,
    repurchaseRate: (sum(rows, (r) => r.repeat_buyers) / buyers) * 100,
  };
}

/** 存量快照（与 range 无关）：锚定期末 + 近 90 天。range 切换不会改变返回值。 */
function crmSnapshot(): {
  asOf: string;
  totalMembers: number;
  vipMembers: number;
  ltv: number;
  churnRate: number;
} {
  const member = getFacts().member;
  const day = dailyTotals(getFacts().channel);
  // 期末 = 最新日期那一行（按 date 排序取末位，防御性排序，文件本身已升序）
  const sorted = [...member].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  if (!latest) return { asOf: "", totalMembers: 0, vipMembers: 0, ltv: 0, churnRate: 0 };

  const gmv90 = sum(day, (d) => d.gmv);
  const m90 = member.length ? sum(member, (r) => r.active_members) / member.length || 1 : 1;
  const total90 = sum(member, (r) => r.total_members) || 1;

  return {
    asOf: latest.date,
    totalMembers: latest.total_members,
    vipMembers: latest.vip_members,
    ltv: Math.round(gmv90 / m90),
    churnRate: (sum(member, (r) => r.churn_members) / total90) * 100,
  };
}

export function aggregateCrm(range: Range): CrmAggregate {
  const { current, previous, hasComparison } = dateWindow(getFacts().member, range);
  const p = crmPeriod(current);
  const prevRepurchaseRate = hasComparison ? crmPeriod(previous).repurchaseRate : null;

  return {
    ...p,
    prevRepurchaseRate,
    repurchaseDelta: prevRepurchaseRate !== null ? p.repurchaseRate - prevRepurchaseRate : null,
    ...crmSnapshot(),
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
  const { current, previous, hasComparison } = dateWindow(getFacts().scrm, range);
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
  const day = dailyTotals(getFacts().channel);
  const n = day.length;
  const cur = day.slice(n - range, n);
  const prev = day.slice(n - 2 * range, n - range);
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
