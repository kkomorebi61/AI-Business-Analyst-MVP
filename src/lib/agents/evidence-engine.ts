/**
 * Evidence Engine（V1.1 可信闭环）
 *
 * 为每条结论（Finding / Risk）生成数据依据：
 *   Evidence = items[metric before→after→change] + dataSources + coverage + healthStatus + lastUpdated
 *
 * - before/after/change 来自 Data Agent 的聚合（本期 vs 上一期；无上一期则 before=null）
 * - dataSources / coverage / healthStatus / lastUpdated 来自 Data Trust 注册表（07）
 *
 * 原则：数据事实优先，不虚构；无上一期时如实留空。
 */

import type { ChannelAggregate } from "@/lib/data/csv-engine";
import { trustForSources } from "@/lib/data/data-trust";
import { METRIC_SPECS, type MetricKey } from "@/lib/kb/metric-kb";
import type { DataAgentOutput } from "./data-agent";
import type { Evidence, EvidenceItem } from "./types";

/** 指标 → 源系统列表（解析 METRIC_SPECS.data_source，如 "OMS + CDP"） */
function metricSources(key: MetricKey): string[] {
  return METRIC_SPECS[key].data_source
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
}

function item(
  metric: string,
  before: number | null,
  after: number | null,
  change: number | null,
  changeKind: EvidenceItem["changeKind"],
  unit: string,
): EvidenceItem {
  return { metric, before, after, change, changeKind, unit };
}

/** 某指标的本期 / 上期 / 变化（无上一期时 before=null、change=null） */
export function metricItem(key: MetricKey, data: DataAgentOutput): EvidenceItem | null {
  const s = data.sales;
  const c = data.crm;
  const m = data.marketing;
  switch (key) {
    case "gmv":
      return item("GMV", s.previous?.gmv ?? null, s.current.gmv, s.delta?.gmv ?? null, "pct", "¥");
    case "orders":
      return item("订单数", s.previous?.orders ?? null, s.current.orders, s.delta?.orders ?? null, "pct", "");
    case "aov":
      return item("客单价", s.previous?.aov ?? null, s.current.aov, s.delta?.aov ?? null, "pct", "¥");
    case "conversion":
      return item("转化率", s.previous?.conversion ?? null, s.current.conversion, s.delta?.conversion ?? null, "pp", "%");
    case "refundRate":
      return item("退款率", s.previous?.refundRate ?? null, s.current.refundRate, s.delta?.refundRate ?? null, "pp", "%");
    case "repurchaseRate":
      return item("复购率", c.prevRepurchaseRate, c.repurchaseRate, c.repurchaseDelta, "pp", "%");
    case "roi":
      return item("ROI", m.prevRoi, m.roi, m.roiDelta, "pp", "");
    case "ltv":
      return item("会员LTV", null, c.ltv, null, "value", "¥");
    case "vipMembers":
      return item("VIP会员", null, c.vipMembers, null, "value", "");
    case "activeMembers":
      return item("活跃会员", null, c.activeMembers, null, "value", "");
    case "newMembers":
      return item("新增会员", null, c.newMembers, null, "value", "");
    case "churnRate":
      return item("流失率", null, c.churnRate, null, "pp", "%");
    default:
      return null;
  }
}

/** 一组指标 → Evidence */
export function buildMetricEvidence(keys: MetricKey[], data: DataAgentOutput): Evidence {
  const items = keys
    .map((k) => metricItem(k, data))
    .filter((x): x is EvidenceItem => x !== null);
  const sources = Array.from(new Set(keys.flatMap(metricSources)));
  const trust = trustForSources(sources);
  return {
    items,
    dataSources: trust.sources,
    coverage: trust.coverage,
    healthStatus: trust.healthStatus,
    lastUpdated: trust.lastUpdated,
  };
}

/** 单渠道 GMV 的 before → after（渠道 GMV 数据源 = OMS） */
export function buildChannelEvidence(ch: ChannelAggregate): Evidence {
  const trust = trustForSources(["OMS"]);
  return {
    items: [item(`${ch.channel} GMV`, ch.prevGmv, ch.gmv, ch.gmvDelta, "pct", "¥")],
    dataSources: trust.sources,
    coverage: trust.coverage,
    healthStatus: trust.healthStatus,
    lastUpdated: trust.lastUpdated,
  };
}
