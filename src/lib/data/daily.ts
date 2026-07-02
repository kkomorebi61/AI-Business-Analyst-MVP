/**
 * 日数据聚合模块（V1.1 时间范围分析）
 *
 * 数据源：sales_daily.json / crm_daily.json / channels_daily.json（各 30 天日数据）
 * 按 range(7/14/30) 取"最近 N 天"为当期、其前 N 天为上一期（环比）。
 * 30 天档因数据窗口仅 30 天 → 无上一期，hasComparison=false。
 */

import channelsDaily from "./channels_daily.json";
import crmDaily from "./crm_daily.json";
import salesDaily from "./sales_daily.json";

export type Range = 7 | 14 | 30;

export const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: "最近7天" },
  { value: 14, label: "最近14天" },
  { value: 30, label: "最近30天" },
];

export function rangeLabel(r: Range): string {
  return RANGES.find((x) => x.value === r)?.label ?? `最近${r}天`;
}

export function isRange(v: unknown): v is Range {
  return v === 7 || v === 14 || v === 30;
}

/* --------------------------------- Sales --------------------------------- */

interface DailySale {
  date: string;
  gmv: number;
  orders: number;
  profit: number;
  aov: number;
}

export interface PeriodMetrics {
  gmv: number;
  orders: number;
  profit: number;
  aov: number; // = gmv / orders
}

export interface SalesAggregate {
  range: Range;
  rangeLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics | null;
  delta: { gmv: number; orders: number; profit: number; aov: number } | null;
  daily: DailySale[]; // 当期日序列（供趋势图）
  hasComparison: boolean;
}

const SALES = (salesDaily as DailySale[]).slice().sort((a, b) =>
  a.date.localeCompare(b.date),
);

export function aggregateSales(range: Range): SalesAggregate {
  const n = SALES.length;
  const current = SALES.slice(n - range, n);
  const previousRows = SALES.slice(n - 2 * range, n - range);

  const currentM = sumMetrics(current);
  const previous =
    previousRows.length === range ? sumMetrics(previousRows) : null;

  const delta = previous
    ? {
        gmv: pct(currentM.gmv, previous.gmv),
        orders: pct(currentM.orders, previous.orders),
        profit: pct(currentM.profit, previous.profit),
        aov: pct(currentM.aov, previous.aov),
      }
    : null;

  return {
    range,
    rangeLabel: rangeLabel(range),
    current: currentM,
    previous,
    delta,
    daily: current,
    hasComparison: !!previous,
  };
}

function sumMetrics(rows: DailySale[]): PeriodMetrics {
  const gmv = sum(rows, "gmv");
  const orders = sum(rows, "orders");
  const profit = sum(rows, "profit");
  return { gmv, orders, profit, aov: orders ? gmv / orders : 0 };
}

/* -------------------------------- Channels ------------------------------- */

interface DailyChannel {
  date: string;
  channels: { channel: string; traffic: number; gmv: number; roi: number }[];
}

const CHANNEL_NAME: Record<string, string> = {
  Tmall: "天猫",
  JD: "京东",
  Xiaohongshu: "小红书",
};

export interface ChannelAggregate {
  channel: string;
  gmv: number;
  prevGmv: number | null;
  traffic: number;
  roi: number;
  gmvDelta: number | null;
}

const CHANNELS = (channelsDaily as DailyChannel[]).slice().sort((a, b) =>
  a.date.localeCompare(b.date),
);

export function aggregateChannels(range: Range): ChannelAggregate[] {
  const n = CHANNELS.length;
  const current = CHANNELS.slice(n - range, n);
  const previous = CHANNELS.slice(n - 2 * range, n - range);
  const hasPrev = previous.length === range;

  const names = Array.from(
    new Set(current.flatMap((d) => d.channels.map((c) => c.channel))),
  );

  return names.map((name) => {
    const cur = current.flatMap((d) =>
      d.channels.filter((c) => c.channel === name),
    );
    const gmv = sum(cur, "gmv");
    const traffic = sum(cur, "traffic");
    const roi = avg(cur, "roi");

    let prevGmv: number | null = null;
    let gmvDelta: number | null = null;
    if (hasPrev) {
      const prevRows = previous.flatMap((d) =>
        d.channels.filter((c) => c.channel === name),
      );
      if (prevRows.length) {
        prevGmv = sum(prevRows, "gmv");
        gmvDelta = pct(gmv, prevGmv);
      }
    }

    return {
      channel: CHANNEL_NAME[name] ?? name,
      gmv,
      prevGmv,
      traffic,
      roi,
      gmvDelta,
    };
  });
}

/* ---------------------------------- CRM ---------------------------------- */

interface DailyCrm {
  date: string;
  newMembers: number;
  activeMembers: number;
  repurchaseRate: number;
  ltv: number;
  churnRate: number;
}

export interface CrmAggregate {
  newMembers: number;
  activeMembers: number;
  repurchaseRate: number;
  prevRepurchaseRate: number | null;
  repurchaseDelta: number | null; // 百分点
  ltv: number;
  churnRate: number;
}

const CRM = (crmDaily as DailyCrm[]).slice().sort((a, b) =>
  a.date.localeCompare(b.date),
);

export function aggregateCrm(range: Range): CrmAggregate {
  const n = CRM.length;
  const current = CRM.slice(n - range, n);
  const previous = CRM.slice(n - 2 * range, n - range);

  const repurchaseRate = avg(current, "repurchaseRate");
  const prevRepurchaseRate =
    previous.length === range ? avg(previous, "repurchaseRate") : null;

  return {
    newMembers: sum(current, "newMembers"),
    activeMembers: Math.round(avg(current, "activeMembers")),
    repurchaseRate,
    prevRepurchaseRate,
    repurchaseDelta:
      prevRepurchaseRate !== null
        ? repurchaseRate - prevRepurchaseRate
        : null,
    ltv: Math.round(avg(current, "ltv")),
    churnRate: avg(current, "churnRate"),
  };
}

/* --------------------------------- utils --------------------------------- */

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

function avg<T>(rows: T[], key: keyof T): number {
  if (!rows.length) return 0;
  return sum(rows, key) / rows.length;
}

function pct(cur: number, prev: number): number {
  return prev ? ((cur - prev) / prev) * 100 : 0;
}
