/**
 * 日数据聚合模块（V1.1 → V2：90 天 · 多数据集）
 *
 * 数据源：src/lib/data/mock-data/01~04（90 天日数据，来源 05_Mock_Data_Design_V2.md）
 *   01_daily_business_metrics  经营（GMV/订单/客单价/转化率/退款率）
 *   02_daily_member_metrics    会员（新增/活跃/复购/LTV/流失/VIP）
 *   03_daily_marketing_metrics 营销（投放成本/带来 GMV/ROI）
 *   04_channel_metrics         渠道（5 渠道 × 90 天 = 450 行）
 *
 * 按 range(7/14/30/90) 取「最近 N 天」为当期、其前 N 天为上一期（环比）。
 * 90 天窗口下：7/14/30 天档均有上一期（hasComparison=true）；90 天档无上一期。
 *
 * 注：05 会员分层 / 06 SCRM 数据已在 mock-data/ 生成，待 Evidence / Governance 阶段接入。
 */

import businessDaily from "./mock-data/01_daily_business_metrics.json";
import memberDaily from "./mock-data/02_daily_member_metrics.json";
import marketingDaily from "./mock-data/03_daily_marketing_metrics.json";
import channelRows from "./mock-data/04_channel_metrics.json";

export type Range = 7 | 14 | 30 | 90;

export const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: "最近7天" },
  { value: 14, label: "最近14天" },
  { value: 30, label: "最近30天" },
  { value: 90, label: "最近90天" },
];

export function rangeLabel(r: Range): string {
  return RANGES.find((x) => x.value === r)?.label ?? `最近${r}天`;
}

export function isRange(v: unknown): v is Range {
  return v === 7 || v === 14 || v === 30 || v === 90;
}

/* --------------------------------- 工具 --------------------------------- */

/** 升序后切片：最近 range 行为当期，其前 range 行为上一期（不足则无上一期） */
function windowOf<T extends { date: string }>(rows: T[], range: Range) {
  const sorted = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  const current = sorted.slice(n - range, n);
  const previousRows = sorted.slice(n - 2 * range, n - range);
  const hasComparison = previousRows.length === range;
  return { current, previous: hasComparison ? previousRows : [], hasComparison };
}

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}
function avg<T>(rows: T[], key: keyof T): number {
  if (!rows.length) return 0;
  return sum(rows, key) / rows.length;
}
/** 相对变化率 %（金额 / 订单数等） */
function pct(cur: number, prev: number): number {
  return prev ? ((cur - prev) / prev) * 100 : 0;
}
/** 百分点差（rate 类指标：转化率 / 退款率 / 复购率 / ROI） */
function pp(cur: number, prev: number): number {
  return cur - prev;
}

/* --------------------------------- Sales -------------------------------- */

interface BizRow {
  date: string;
  gmv: number;
  orders: number;
  revenue: number;
  aov: number;
  conversion_rate: number;
  refund_rate: number;
}

export interface PeriodMetrics {
  gmv: number;
  orders: number;
  aov: number; // = gmv / orders
  conversion: number; // 转化率 %
  refundRate: number; // 退款率 %
}

export interface SalesAggregate {
  range: Range;
  rangeLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics | null;
  delta: {
    gmv: number;
    orders: number;
    aov: number;
    conversion: number;
    refundRate: number;
  } | null;
  daily: { date: string; gmv: number; orders: number }[];
  hasComparison: boolean;
}

const BIZ = businessDaily as BizRow[];

export function aggregateSales(range: Range): SalesAggregate {
  const { current, previous, hasComparison } = windowOf(BIZ, range);
  const c = sumBiz(current);
  const p = hasComparison ? sumBiz(previous) : null;
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
    daily: current.map((r) => ({ date: r.date, gmv: r.gmv, orders: r.orders })),
    hasComparison,
  };
}

function sumBiz(rows: BizRow[]): PeriodMetrics {
  const gmv = sum(rows, "gmv");
  const orders = sum(rows, "orders");
  return {
    gmv,
    orders,
    aov: orders ? gmv / orders : 0,
    conversion: avg(rows, "conversion_rate"),
    refundRate: avg(rows, "refund_rate"),
  };
}

/* -------------------------------- Channels ------------------------------ */

interface ChannelRow {
  date: string;
  channel: string;
  gmv: number;
  orders: number;
  conversion_rate: number;
  roi: number;
}

const CHANNEL_NAME: Record<string, string> = {
  "Private Traffic": "私域",
  Tmall: "天猫",
  JD: "京东",
  Xiaohongshu: "小红书",
  "Mini Program": "小程序",
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

const CHANNELS = channelRows as ChannelRow[];

export function aggregateChannels(range: Range): ChannelAggregate[] {
  const { current, previous, hasComparison } = windowOf(CHANNELS, range);
  const names = Array.from(new Set(current.map((r) => r.channel)));
  return names.map((name) => {
    const cur = current.filter((r) => r.channel === name);
    const gmv = sum(cur, "gmv");
    let prevGmv: number | null = null;
    let gmvDelta: number | null = null;
    if (hasComparison) {
      const prev = previous.filter((r) => r.channel === name);
      if (prev.length) {
        prevGmv = sum(prev, "gmv");
        gmvDelta = pct(gmv, prevGmv);
      }
    }
    return {
      channel: CHANNEL_NAME[name] ?? name,
      gmv,
      orders: sum(cur, "orders"),
      conversion: avg(cur, "conversion_rate"),
      roi: avg(cur, "roi"),
      prevGmv,
      gmvDelta,
    };
  });
}

/* ---------------------------------- CRM --------------------------------- */

interface MemberRow {
  date: string;
  active_members: number;
  new_members: number;
  repurchase_rate: number;
  ltv: number;
  churn_rate: number;
  vip_members: number;
}

export interface CrmAggregate {
  newMembers: number;
  activeMembers: number;
  repurchaseRate: number;
  prevRepurchaseRate: number | null;
  repurchaseDelta: number | null; // 百分点
  ltv: number;
  churnRate: number;
  vipMembers: number;
}

const MEMBERS = memberDaily as MemberRow[];

export function aggregateCrm(range: Range): CrmAggregate {
  const { current, previous, hasComparison } = windowOf(MEMBERS, range);
  const repurchaseRate = avg(current, "repurchase_rate");
  const prevRepurchaseRate = hasComparison ? avg(previous, "repurchase_rate") : null;
  return {
    newMembers: sum(current, "new_members"),
    activeMembers: Math.round(avg(current, "active_members")),
    repurchaseRate,
    prevRepurchaseRate,
    repurchaseDelta:
      prevRepurchaseRate !== null ? repurchaseRate - prevRepurchaseRate : null,
    ltv: Math.round(avg(current, "ltv")),
    churnRate: avg(current, "churn_rate"),
    vipMembers: Math.round(avg(current, "vip_members")),
  };
}

/* ------------------------------- Marketing ------------------------------ */

interface MarketingRow {
  date: string;
  campaign_cost: number;
  campaign_gmv: number;
  roi: number;
  sms_cost: number;
  push_cost: number;
  coupon_cost: number;
}

export interface MarketingAggregate {
  roi: number;
  campaignCost: number;
  campaignGmv: number;
  prevRoi: number | null;
  roiDelta: number | null; // 百分点
}

const MARKETING = marketingDaily as MarketingRow[];

export function aggregateMarketing(range: Range): MarketingAggregate {
  const { current, previous, hasComparison } = windowOf(MARKETING, range);
  const roi = avg(current, "roi");
  const prevRoi = hasComparison ? avg(previous, "roi") : null;
  return {
    roi,
    campaignCost: sum(current, "campaign_cost"),
    campaignGmv: sum(current, "campaign_gmv"),
    prevRoi,
    roiDelta: prevRoi !== null ? roi - prevRoi : null,
  };
}
