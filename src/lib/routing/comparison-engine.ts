/**
 * 任意时间窗口引擎 + 对比引擎（doc 18 V2 §Time Anchor + §Comparison）。
 *
 * 既有 csv-engine 的 aggregate* 只支持「最近 N 天（从末尾切片）」；doc18 要求支持
 * 「任意时间范围（今天/昨天/自定义区间）」与「任意对比（时段 / 维度）」。
 * 本模块基于 csv-engine 暴露的 facts，按 [from,to] 过滤行计算指标值，
 * 服务 comparison / trend / 任意窗口取值。一切窗口由 Date Anchor（resolveWindow）解析。
 *
 * 纯函数、无 fs（facts 由 csv-engine 载入）。可单测。
 */

import { getFacts, type ChannelFact } from "@/lib/data/csv-engine";
import type { MetricKey } from "@/lib/kb/metric-kb";
import type { ResolvedWindow } from "@/lib/data/time";

const inWin = (d: string, from: string, to: string) => d >= from && d <= to;
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/** NL 渠道名（CHANNEL_RULES 产出）→ 事实表 channel key */
const CHANNEL_KEY: Record<string, string> = {
  "Enterprise WeChat": "PRIVATE_TRAFFIC", // 企微/私域
  "Mini Program": "MINI_PROGRAM",
  Tmall: "TMALL",
  JD: "JD",
  Xiaohongshu: "XIAOHONGSHU",
  "Offline Store": "OFFLINE_STORE",
};

/**
 * 任意 [from,to] 窗口的指标数值。
 * period 指标按窗口聚合；snapshot 指标取窗口末值（存量口径）。
 */
export function metricValue(key: MetricKey, from: string, to: string): number {
  const f = getFacts();
  const ch = f.channel.filter((r) => inWin(r.date, from, to));
  const mb = f.member.filter((r) => inWin(r.date, from, to));
  const sc = f.scrm.filter((r) => inWin(r.date, from, to));

  switch (key) {
    case "gmv":
      return sum(ch, (r) => r.gmv);
    case "orders":
      return sum(ch, (r) => r.orders);
    case "aov": {
      const g = sum(ch, (r) => r.gmv);
      const o = sum(ch, (r) => r.orders);
      return o ? g / o : 0;
    }
    case "conversion": {
      const b = sum(ch, (r) => r.buyers);
      const v = sum(ch, (r) => r.visitors) || 1;
      return (b / v) * 100;
    }
    case "refundRate": {
      const rf = sum(ch, (r) => r.refund_amount);
      const g = sum(ch, (r) => r.gmv) || 1;
      return (rf / g) * 100;
    }
    case "newMembers":
      return sum(mb, (r) => r.new_members);
    case "activeMembers":
      return mb.length ? Math.max(...mb.map((r) => r.active_members)) : 0;
    case "repurchaseRate": {
      const rb = sum(mb, (r) => r.repeat_buyers);
      const b = sum(mb, (r) => r.buyers) || 1;
      return (rb / b) * 100;
    }
    case "roi": {
      const g = sum(ch, (r) => r.gmv);
      const c = sum(ch, (r) => r.marketing_cost) || 1;
      return g / c;
    }
    case "reachRate": {
      const reached = sum(sc, (r) => r.reached_users);
      const fr = sum(sc, (r) => r.total_friends) || 1;
      return (reached / fr) * 100;
    }
    case "replyRate": {
      const rep = sum(sc, (r) => r.reply_users);
      const reached = sum(sc, (r) => r.reached_users) || 1;
      return (rep / reached) * 100;
    }
    case "scrmConversion": {
      const conv = sum(sc, (r) => r.converted_users);
      const reached = sum(sc, (r) => r.reached_users) || 1;
      return (conv / reached) * 100;
    }
    case "couponRedemption": {
      const used = sum(sc, (r) => r.coupon_used);
      const sent = sum(sc, (r) => r.coupon_sent) || 1;
      return (used / sent) * 100;
    }
    case "newFriends":
      return sum(sc, (r) => r.new_friends);
    // snapshot：取窗口末行（升序末位）
    case "totalMembers":
      return mb.length ? mb[mb.length - 1].total_members : 0;
    case "vipMembers":
      return mb.length ? mb[mb.length - 1].vip_members : 0;
    case "totalFriends":
      return sc.length ? sc[sc.length - 1].total_friends : 0;
    // ltv / churnRate 为 90 天口径快照，不按任意窗口重算
    case "ltv":
    case "churnRate":
      return 0;
    default:
      return 0;
  }
}

const RATE_LIKE: MetricKey[] = [
  "conversion",
  "refundRate",
  "repurchaseRate",
  "churnRate",
  "reachRate",
  "replyRate",
  "scrmConversion",
  "couponRedemption",
];

export function formatMetricValue(key: MetricKey, v: number): string {
  if (RATE_LIKE.includes(key)) return `${v.toFixed(1)}%`;
  if (key === "roi") return v.toFixed(2);
  if (key === "gmv" || key === "aov" || key === "ltv") {
    if (v >= 1e8) return `¥${(v / 1e8).toFixed(2)}亿`;
    if (v >= 1e4) return `¥${Math.round(v / 1e4)}万`;
    return `¥${Math.round(v)}`;
  }
  return v.toLocaleString("zh-CN");
}

/** 指标在「相对% / 百分点 / 绝对」上的变化口径 */
function changeKindOf(key: MetricKey): "pct" | "pp" {
  return RATE_LIKE.includes(key) ? "pp" : "pct";
}

/** 两段时间窗口对比（doc18 Type C 时段对比） */
export interface WindowValue {
  label: string;
  from: string;
  to: string;
  value: number;
  formatted: string;
}

export interface ComparisonResult {
  metric: MetricKey;
  baseline: WindowValue;
  comparison: WindowValue;
  delta: number;
  deltaFormatted: string;
  direction: "up" | "down";
  changeKind: "pct" | "pp";
}

export function compareWindows(
  key: MetricKey,
  baseline: ResolvedWindow,
  comparison: ResolvedWindow,
): ComparisonResult {
  const bv = metricValue(key, baseline.from, baseline.to);
  const cv = metricValue(key, comparison.from, comparison.to);
  const kind = changeKindOf(key);
  const delta = kind === "pp" ? cv - bv : bv ? ((cv - bv) / bv) * 100 : 0;
  const sign = delta > 0 ? "+" : "";
  return {
    metric: key,
    baseline: { ...baseline, value: bv, formatted: formatMetricValue(key, bv) },
    comparison: { ...comparison, value: cv, formatted: formatMetricValue(key, cv) },
    delta,
    deltaFormatted: `${sign}${delta.toFixed(1)}${kind === "pp" ? "pp" : "%"}`,
    direction: delta >= 0 ? "up" : "down",
    changeKind: kind,
  };
}

/** 两渠道对比（doc18 Type C 维度对比）—— 按 NL 渠道名映射到事实表 key */
export interface ChannelValue {
  channel: string;
  value: number;
  formatted: string;
}

export function compareChannels(
  key: MetricKey,
  from: string,
  to: string,
  channels: string[],
): { rows: ChannelValue[]; delta: number | null; direction: "up" | "down" | null } {
  const rows: ChannelValue[] = channels.map((c) => {
    const factKey = CHANNEL_KEY[c] ?? c;
    const ch = getFacts().channel.filter((r) => r.channel === factKey && inWin(r.date, from, to));
    const v = channelMetric(key, ch);
    return { channel: c, value: v, formatted: formatMetricValue(key, v) };
  });
  if (rows.length === 2) {
    const kind = changeKindOf(key);
    const delta = kind === "pp" ? rows[1].value - rows[0].value : rows[0].value ? ((rows[1].value - rows[0].value) / rows[0].value) * 100 : 0;
    return { rows, delta, direction: delta >= 0 ? "up" : "down" };
  }
  return { rows, delta: null, direction: null };
}

/** 单渠道事实行的指标值（对比维度用） */
function channelMetric(key: MetricKey, ch: ChannelFact[]): number {
  switch (key) {
    case "gmv":
      return sum(ch, (r) => r.gmv);
    case "orders":
      return sum(ch, (r) => r.orders);
    case "aov": {
      const g = sum(ch, (r) => r.gmv);
      const o = sum(ch, (r) => r.orders);
      return o ? g / o : 0;
    }
    case "conversion": {
      const b = sum(ch, (r) => r.buyers);
      const v = sum(ch, (r) => r.visitors) || 1;
      return (b / v) * 100;
    }
    case "refundRate": {
      const rf = sum(ch, (r) => r.refund_amount);
      const g = sum(ch, (r) => r.gmv) || 1;
      return (rf / g) * 100;
    }
    case "roi": {
      const g = sum(ch, (r) => r.gmv);
      const c = sum(ch, (r) => r.marketing_cost) || 1;
      return g / c;
    }
    default:
      return 0;
  }
}

/** 趋势序列（按日）：窗口内每个日期的指标值（doc18 Type B 趋势分析） */
export interface TrendPoint {
  date: string;
  value: number;
  formatted: string;
}

export function trendPoints(key: MetricKey, from: string, to: string): TrendPoint[] {
  // GMV / 订单 / 客单价 / 转化 / 退款 / ROI 走渠道日聚合；会员/私域走各自日表
  const dates = Array.from(
    new Set(
      getFacts().channel
        .map((r) => r.date)
        .filter((d) => inWin(d, from, to)),
    ),
  ).sort();
  return dates.map((d) => {
    const v = metricValue(key, d, d);
    return { date: d, value: v, formatted: formatMetricValue(key, v) };
  });
}
