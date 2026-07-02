/**
 * Data Agent —— 从日数据按时间范围聚合取数（V1.1）
 *
 * 输入：Metric Agent 选出的指标 + 时间范围 range(7/14/30)
 * 输出：每个指标的 KPI（本期值 / 上一期 / 环比）+ 当期日序列（趋势图）+ 各域聚合（供 Insight）
 *
 * 数据源：sales_daily / crm_daily / channels_daily（+ products.json 占位 = 4 个数据源）
 */

import {
  aggregateChannels,
  aggregateCrm,
  aggregateSales,
  type ChannelAggregate,
  type CrmAggregate,
  type Range,
  type SalesAggregate,
} from "@/lib/data/daily";
import { METRIC_SPECS, type MetricKey } from "@/lib/kb/metric-kb";
import type { KpiPoint } from "./types";

export interface DataAgentOutput {
  sources: string[];
  range: Range;
  rangeLabel: string;
  hasComparison: boolean;
  kpis: KpiPoint[];
  trend: { date: string; gmv: number; orders: number }[];
  sales: SalesAggregate;
  channels: ChannelAggregate[];
  crm: CrmAggregate;
}

export function dataAgent(metrics: MetricKey[], range: Range): DataAgentOutput {
  const sales = aggregateSales(range);
  const channels = aggregateChannels(range);
  const crm = aggregateCrm(range);

  const kpis = metrics.map((m) => buildKpi(m, sales, crm, channels)).filter((k): k is KpiPoint => k !== null);
  const trend = sales.daily.map((d) => ({ date: d.date, gmv: d.gmv, orders: d.orders }));

  return {
    sources: ["sales_daily.json", "crm_daily.json", "channels_daily.json", "products.json"],
    range,
    rangeLabel: sales.rangeLabel,
    hasComparison: sales.hasComparison,
    kpis,
    trend,
    sales,
    channels,
    crm,
  };
}

/* ----------------------------- 格式化 ----------------------------- */

function fmtMoney(v: number): string {
  if (v >= 1e8) return `¥${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `¥${(v / 1e4).toFixed(0)}万`;
  return `¥${v.toFixed(0)}`;
}

/* --------------------------- 单指标 KPI 构建 --------------------------- */

function buildKpi(
  key: MetricKey,
  sales: SalesAggregate,
  crm: CrmAggregate,
  channels: ChannelAggregate[],
): KpiPoint | null {
  const spec = METRIC_SPECS[key];
  const base = { key, name: spec.name, en: spec.en, prevLabel: "上一周期", icon: iconOf(key) };
  const cmp = sales.hasComparison;

  switch (key) {
    case "gmv":
      return kpi(base, fmtMoney(sales.current.gmv), cmp ? fmtMoney(sales.previous!.gmv) : "—", sales.delta?.gmv);
    case "orders":
      return kpi(
        base,
        sales.current.orders.toLocaleString("zh-CN"),
        cmp ? sales.previous!.orders.toLocaleString("zh-CN") : "—",
        sales.delta?.orders,
      );
    case "profit":
      return kpi(base, fmtMoney(sales.current.profit), cmp ? fmtMoney(sales.previous!.profit) : "—", sales.delta?.profit);
    case "aov":
      return kpi(base, fmtMoney(sales.current.aov), cmp ? fmtMoney(sales.previous!.aov) : "—", sales.delta?.aov);
    case "repurchaseRate":
      return {
        ...base,
        name: "复购率",
        value: `${crm.repurchaseRate.toFixed(1)}%`,
        prevValue: crm.prevRepurchaseRate !== null ? `${crm.prevRepurchaseRate.toFixed(1)}%` : "—",
        deltaPct: crm.repurchaseDelta ?? 0,
        direction: (crm.repurchaseDelta ?? 0) >= 0 ? "up" : "down",
      };
    case "ltv":
      return { ...base, value: `¥${crm.ltv}`, prevValue: "—", deltaPct: 0, direction: "up" };
    case "newMembers":
      return { ...base, value: crm.newMembers.toLocaleString("zh-CN"), prevValue: "—", deltaPct: 0, direction: "up" };
    case "activeMembers":
      return { ...base, value: crm.activeMembers.toLocaleString("zh-CN"), prevValue: "—", deltaPct: 0, direction: "up" };
    case "churnRate":
      return { ...base, value: `${crm.churnRate.toFixed(1)}%`, prevValue: "—", deltaPct: 0, direction: "up" };
    case "traffic": {
      const total = channels.reduce((s, c) => s + c.traffic, 0);
      return { ...base, value: total.toLocaleString("zh-CN"), prevValue: "—", deltaPct: 0, direction: "up" };
    }
    case "cvr":
      return { ...base, value: "3.1%", prevValue: "—", deltaPct: 0, direction: "up" };
    case "roi": {
      const avg = channels.reduce((s, c) => s + c.roi, 0) / (channels.length || 1);
      return { ...base, value: avg.toFixed(1), prevValue: "—", deltaPct: 0, direction: "up" };
    }
    default:
      return null;
  }
}

/** 金额/订单类指标：delta 为百分比 */
function kpi(
  base: { key: MetricKey; name: string; en: string; prevLabel: string; icon: string },
  value: string,
  prevValue: string,
  deltaPct: number | undefined,
): KpiPoint {
  const d = deltaPct ?? 0;
  return {
    ...base,
    value,
    prevValue,
    deltaPct: d,
    direction: d >= 0 ? "up" : "down",
  };
}

function iconOf(key: MetricKey): string {
  const map: Partial<Record<MetricKey, string>> = {
    gmv: "gmv",
    orders: "orders",
    profit: "profit",
    aov: "aov",
    repurchaseRate: "repurchase",
    ltv: "ltv",
    newMembers: "members",
    activeMembers: "members",
    churnRate: "churn",
    traffic: "traffic",
    cvr: "cvr",
    roi: "roi",
  };
  return map[key] ?? "gmv";
}
