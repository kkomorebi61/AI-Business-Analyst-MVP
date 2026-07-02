/**
 * Data Agent —— 从 V2 日数据按时间范围聚合取数
 *
 * 输入：Metric Agent 选出的指标 + 时间范围 range(7/14/30/90)
 * 输出：每个指标的 KPI（本期值 / 上一期 / 变化）+ 当期日序列（趋势图）+ 各域聚合（供 Insight）
 *
 * 数据源（V2 · 90 天）：01 经营 / 02 会员 / 03 营销 / 04 渠道（详见 daily.ts）
 * 源系统（Data Trust）：OMS / CRM / CDP / Marketing Platform
 */

import {
  aggregateChannels,
  aggregateCrm,
  aggregateMarketing,
  aggregateSales,
  type ChannelAggregate,
  type CrmAggregate,
  type MarketingAggregate,
  type Range,
  type SalesAggregate,
} from "@/lib/data/daily";
import { METRIC_SPECS, type MetricKey } from "@/lib/kb/metric-kb";
import { metricTrustInfo } from "@/lib/data/data-trust";
import type { KpiPoint } from "./types";

export interface DataAgentOutput {
  /** 源系统（用于 Data Trust 展示与 dataSources 计数） */
  sources: string[];
  range: Range;
  rangeLabel: string;
  hasComparison: boolean;
  kpis: KpiPoint[];
  trend: { date: string; gmv: number; orders: number }[];
  sales: SalesAggregate;
  channels: ChannelAggregate[];
  crm: CrmAggregate;
  marketing: MarketingAggregate;
}

/** 系统真实使用到的源系统（对齐 07_data_sources） */
const SOURCE_SYSTEMS = ["OMS", "CRM", "CDP", "Marketing Platform"];

export function dataAgent(metrics: MetricKey[], range: Range): DataAgentOutput {
  const sales = aggregateSales(range);
  const channels = aggregateChannels(range);
  const crm = aggregateCrm(range);
  const marketing = aggregateMarketing(range);

  const kpis = metrics
    .map((m) => buildKpi(m, sales, crm, channels, marketing))
    .filter((k): k is KpiPoint => k !== null)
    .map((k) => ({ ...k, trust: metricTrustInfo(k.key) }));
  const trend = sales.daily.map((d) => ({ date: d.date, gmv: d.gmv, orders: d.orders }));

  return {
    sources: SOURCE_SYSTEMS,
    range,
    rangeLabel: sales.rangeLabel,
    hasComparison: sales.hasComparison,
    kpis,
    trend,
    sales,
    channels,
    crm,
    marketing,
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
  marketing: MarketingAggregate,
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
    case "aov":
      return kpi(base, fmtMoney(sales.current.aov), cmp ? fmtMoney(sales.previous!.aov) : "—", sales.delta?.aov);
    case "conversion":
      return rateKpi(base, `${sales.current.conversion.toFixed(1)}%`, cmp ? `${sales.previous!.conversion.toFixed(1)}%` : "—", sales.delta?.conversion);
    case "refundRate":
      return rateKpi(base, `${sales.current.refundRate.toFixed(1)}%`, cmp ? `${sales.previous!.refundRate.toFixed(1)}%` : "—", sales.delta?.refundRate);
    case "repurchaseRate":
      return rateKpi(
        { ...base, name: "复购率" },
        `${crm.repurchaseRate.toFixed(1)}%`,
        crm.prevRepurchaseRate !== null ? `${crm.prevRepurchaseRate.toFixed(1)}%` : "—",
        crm.repurchaseDelta ?? undefined,
      );
    case "ltv":
      return { ...base, value: `¥${crm.ltv.toLocaleString("zh-CN")}`, prevValue: "—", deltaPct: 0, direction: "up" };
    case "newMembers":
      return { ...base, value: crm.newMembers.toLocaleString("zh-CN"), prevValue: "—", deltaPct: 0, direction: "up" };
    case "activeMembers":
      return { ...base, value: crm.activeMembers.toLocaleString("zh-CN"), prevValue: "—", deltaPct: 0, direction: "up" };
    case "churnRate":
      return { ...base, value: `${crm.churnRate.toFixed(1)}%`, prevValue: "—", deltaPct: 0, direction: "up" };
    case "vipMembers":
      return { ...base, value: crm.vipMembers.toLocaleString("zh-CN"), prevValue: "—", deltaPct: 0, direction: "up" };
    case "roi":
      return rateKpi(base, marketing.roi.toFixed(2), marketing.prevRoi !== null ? marketing.prevRoi.toFixed(2) : "—", marketing.roiDelta ?? undefined);
    default:
      return null;
  }
}

/** 金额/订单类指标：delta 为相对变化率 % */
function kpi(
  base: { key: MetricKey; name: string; en: string; prevLabel: string; icon: string },
  value: string,
  prevValue: string,
  deltaPct: number | undefined,
): KpiPoint {
  const d = deltaPct ?? 0;
  return { ...base, value, prevValue, deltaPct: d, direction: d >= 0 ? "up" : "down" };
}

/** rate 类指标（转化率/退款率/复购率/ROI）：delta 为百分点差 */
function rateKpi(
  base: { key: MetricKey; name: string; en: string; prevLabel: string; icon: string },
  value: string,
  prevValue: string,
  deltaPp: number | undefined,
): KpiPoint {
  const d = deltaPp ?? 0;
  return { ...base, value, prevValue, deltaPct: d, direction: d >= 0 ? "up" : "down" };
}

function iconOf(key: MetricKey): string {
  const map: Partial<Record<MetricKey, string>> = {
    gmv: "gmv",
    orders: "orders",
    aov: "aov",
    conversion: "conversion",
    refundRate: "refund",
    repurchaseRate: "repurchase",
    ltv: "ltv",
    newMembers: "members",
    activeMembers: "members",
    churnRate: "churn",
    vipMembers: "vip",
    roi: "roi",
  };
  return map[key] ?? "gmv";
}
