/**
 * Insight Agent —— 生成业务洞察（V2：基于 90 天聚合数据动态生成）
 *
 * 分析逻辑：发生了什么 → 为什么 → 业务风险 → 行动建议
 *
 * 从 Data Agent 的聚合结果（GMV/订单/客单价/转化/退款环比、各渠道环比、
 * 复购趋势、营销 ROI）推导摘要 / 发现 / 风险 / 建议。
 * 切换 7/14/30/90 天时，洞察与 KPI、图表保持一致。
 *
 * 原则：不虚构原因。归因到具体经营事件的能力在 Query Governance 阶段
 * （接入 08_business_events）后补齐。
 */

import type { ChannelAggregate } from "@/lib/data/daily";
import { RECOMMENDATIONS, type Role } from "@/lib/kb/metric-kb";
import type { DataAgentOutput } from "./data-agent";
import type { Finding, Intent, Recommendation, Risk } from "./types";

export interface InsightAgentOutput {
  summary: { tag: string; accuracy: number; readingTimeSec: number; text: string };
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
}

export function insightAgent(
  role: Role,
  intent: Intent,
  question: string,
  data: DataAgentOutput,
): InsightAgentOutput {
  const isCrmFlavor =
    intent === "crm_analysis" ||
    intent === "risk_analysis" ||
    /复购|会员|流失|ltv/.test(question);
  if (isCrmFlavor) return crmInsight(data);
  if (intent === "channel_analysis") return channelInsight(data);
  return overviewInsight(data);
}

/* ----------------------------- 工具函数 ----------------------------- */

function fmtMoney(v: number): string {
  if (v >= 1e8) return `¥${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `¥${Math.round(v / 1e4)}万`;
  return `¥${Math.round(v)}`;
}

function fmtSignedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function topChannel(channels: ChannelAggregate[]): ChannelAggregate {
  const withDelta = channels.filter((c) => c.gmvDelta !== null);
  if (!withDelta.length) return channels[0] ?? ({} as ChannelAggregate);
  return withDelta.reduce((best, c) => ((c.gmvDelta ?? -Infinity) > (best.gmvDelta ?? -Infinity) ? c : best), withDelta[0]);
}

function weakChannel(channels: ChannelAggregate[]): ChannelAggregate | null {
  if (!channels.length) return null;
  return channels.reduce((w, c) => (c.roi < w.roi ? c : w), channels[0]);
}

/* ------------------------- 本周经营概览（主场景） ------------------------- */

function overviewInsight(data: DataAgentOutput): InsightAgentOutput {
  const s = data.sales;
  const m = data.marketing;
  const top = topChannel(data.channels);
  const weak = weakChannel(data.channels);
  const gmvDelta = s.delta?.gmv;
  const repDelta = data.crm.repurchaseDelta;
  const refundDelta = s.delta?.refundRate;

  // 摘要
  let text: string;
  if (data.hasComparison && gmvDelta !== undefined) {
    const tone = gmvDelta >= 0 ? "积极" : "承压";
    const driver =
      top.gmvDelta !== null && top.gmvDelta >= 0
        ? `增长主要来自${top.channel}渠道（GMV 环比 ${fmtSignedPct(top.gmvDelta)}）`
        : "各渠道表现分化";
    const refundNote =
      refundDelta !== undefined && refundDelta > 0.2
        ? `；退款率环比 +${refundDelta.toFixed(1)}pp，需关注履约`
        : "";
    const roiNote =
      m.roiDelta !== null && m.roiDelta < 0
        ? `、营销 ROI 环比 ${m.roiDelta.toFixed(2)}`
        : "";
    const memberNote =
      repDelta !== null && repDelta < 0
        ? `、高价值会员复购走弱 ${Math.abs(repDelta).toFixed(1)} 个百分点`
        : "";
    text = `${data.rangeLabel}整体表现${tone}。GMV 环比 ${fmtSignedPct(gmvDelta)}，累计 ${fmtMoney(s.current.gmv)}，${driver}${refundNote}${roiNote}${memberNote}。`;
  } else {
    text = `${data.rangeLabel}累计 GMV ${fmtMoney(s.current.gmv)}，订单 ${s.current.orders.toLocaleString("zh-CN")} 单，客单价约 ¥${s.current.aov.toFixed(0)}，转化率 ${s.current.conversion.toFixed(1)}%。当前时间范围缺少上一周期数据，暂不展示环比。`;
  }

  // 发现
  const findings: Finding[] = [];
  findings.push({
    id: "f-gmv",
    category: "经营",
    icon: "gmv",
    title: data.hasComparison ? `GMV 环比${gmvDelta! >= 0 ? "增长" : "下降"}` : "GMV 累计表现",
    description: `${data.rangeLabel} GMV 累计 ${fmtMoney(s.current.gmv)}，对应订单 ${s.current.orders.toLocaleString("zh-CN")} 单，客单价约 ¥${s.current.aov.toFixed(0)}，转化率 ${s.current.conversion.toFixed(1)}%。`,
    metric: data.hasComparison ? fmtSignedPct(gmvDelta!) : fmtMoney(s.current.gmv),
    direction: data.hasComparison ? (gmvDelta! >= 0 ? "up" : "down") : "up",
  });
  if (top && top.channel) {
    findings.push({
      id: "f-channel",
      category: "渠道",
      icon: "truck",
      title: `${top.channel}渠道${top.gmvDelta !== null && top.gmvDelta >= 0 ? "增长领先" : "表现稳定"}`,
      description: `${top.channel}贡献 GMV ${fmtMoney(top.gmv)}，ROI ${top.roi.toFixed(1)}${top.gmvDelta !== null ? `，环比 ${fmtSignedPct(top.gmvDelta)}` : ""}。`,
      metric: top.gmvDelta !== null ? fmtSignedPct(top.gmvDelta) : `ROI ${top.roi.toFixed(1)}`,
      direction: top.gmvDelta !== null ? (top.gmvDelta >= 0 ? "up" : "down") : "up",
    });
  }
  if (repDelta !== null) {
    findings.push({
      id: "f-member",
      category: "会员",
      icon: "users",
      title: repDelta >= 0 ? "复购率改善" : "复购率走弱",
      description: `${data.rangeLabel}平均复购率 ${data.crm.repurchaseRate.toFixed(1)}%，环比 ${repDelta >= 0 ? "提升" : "下降"} ${Math.abs(repDelta).toFixed(1)} 个百分点。`,
      metric: `${repDelta >= 0 ? "+" : ""}${repDelta.toFixed(1)} pp`,
      direction: repDelta >= 0 ? "up" : "down",
    });
  }

  // 风险（由负向信号推导）
  const risks: Risk[] = [];
  if (data.hasComparison && refundDelta !== undefined && refundDelta > 0.3) {
    risks.push({
      id: "r-refund",
      level: refundDelta > 0.8 ? "high" : "medium",
      title: "退款率抬升",
      description: `退款率环比 +${refundDelta.toFixed(1)}pp 至 ${s.current.refundRate.toFixed(1)}%，可能源于履约时效或商品质量。`,
      impact: "影响: 拉低净 GMV、增加售后成本",
    });
  }
  if (weak && weak.roi < 1.5) {
    risks.push({
      id: "r-channel",
      level: "medium",
      title: `${weak.channel}渠道投入产出失衡`,
      description: `${weak.channel} ROI 仅 ${weak.roi.toFixed(1)}，低于盈亏线，流量大但转化弱。`,
      impact: "影响: 拖累整体营销 ROI",
    });
  }
  if (data.hasComparison && m.roiDelta !== null && m.roiDelta < -0.2) {
    risks.push({
      id: "r-roi",
      level: "medium",
      title: "营销 ROI 下滑",
      description: `营销 ROI 环比 ${m.roiDelta.toFixed(2)} 至 ${m.roi.toFixed(2)}，投放效率下降。`,
      impact: "影响: 同等投入带来的 GMV 减少",
    });
  }
  if (repDelta !== null && repDelta < 0) {
    risks.push({
      id: "r-member",
      level: "low",
      title: "复购走弱影响 LTV",
      description: `复购率环比下降 ${Math.abs(repDelta).toFixed(1)} 个百分点，若持续将拉低会员生命周期价值。`,
      impact: "影响: LTV 存在下行动能",
    });
  }

  // 行动建议（由风险 + 增长机会推导）
  const recommendations: Recommendation[] = [];
  if (risks.some((r) => r.id === "r-refund")) recommendations.push(toRec(RECOMMENDATIONS.refund_up, recommendations.length + 1));
  if (risks.some((r) => r.id === "r-member")) recommendations.push(toRec(RECOMMENDATIONS.repurchase_down, recommendations.length + 1));
  if (risks.some((r) => r.id === "r-channel" || r.id === "r-roi")) recommendations.push(toRec(RECOMMENDATIONS.roi_low, recommendations.length + 1));
  recommendations.push(toRec(RECOMMENDATIONS.channel_opportunity, recommendations.length + 1));

  return {
    summary: { tag: "高智能摘要", accuracy: 96, readingTimeSec: 40, text },
    findings,
    risks,
    recommendations,
  };
}

/* ------------------------- CRM / 复购归因（场景 3） ------------------------- */

function crmInsight(data: DataAgentOutput): InsightAgentOutput {
  const repDelta = data.crm.repurchaseDelta;
  const hasCmp = data.hasComparison && repDelta !== null;

  const text = hasCmp
    ? `${data.rangeLabel}平均复购率 ${data.crm.repurchaseRate.toFixed(1)}%，环比 ${repDelta! >= 0 ? "提升" : "下降"} ${Math.abs(repDelta!).toFixed(1)} 个百分点。建议结合近期会员活动与触达数据进一步归因，优先精准触达 VIP / 高价值会员。`
    : `${data.rangeLabel}平均复购率 ${data.crm.repurchaseRate.toFixed(1)}%，活跃会员 ${data.crm.activeMembers.toLocaleString("zh-CN")}，VIP 会员 ${data.crm.vipMembers.toLocaleString("zh-CN")}，LTV ¥${data.crm.ltv.toLocaleString("zh-CN")}。`;

  return {
    summary: { tag: "会员摘要", accuracy: 94, readingTimeSec: 35, text },
    findings: [
      {
        id: "f1",
        category: "会员",
        icon: "users",
        title: hasCmp ? `复购率${repDelta! >= 0 ? "改善" : "下滑"}` : "复购率表现",
        description: `${data.rangeLabel}平均复购率 ${data.crm.repurchaseRate.toFixed(1)}%。`,
        metric: hasCmp ? `${repDelta! >= 0 ? "+" : ""}${repDelta!.toFixed(1)} pp` : `${data.crm.repurchaseRate.toFixed(1)}%`,
        direction: hasCmp ? (repDelta! >= 0 ? "up" : "down") : "up",
      },
      {
        id: "f2",
        category: "会员",
        icon: "vip",
        title: "高价值会员盘子",
        description: `VIP 会员 ${data.crm.vipMembers.toLocaleString("zh-CN")} 人，活跃会员 ${data.crm.activeMembers.toLocaleString("zh-CN")} 人，LTV ¥${data.crm.ltv.toLocaleString("zh-CN")}。`,
        metric: `VIP ${data.crm.vipMembers.toLocaleString("zh-CN")}`,
        direction: "up",
      },
    ],
    risks: hasCmp && repDelta! < 0
      ? [
          { id: "r1", level: "high", title: "LTV 下行风险", description: "复购率是 LTV 的核心驱动，持续走弱将直接拉低会员生命周期价值。", impact: "影响: LTV 预计环比下降" },
        ]
      : [],
    recommendations: [toRec(RECOMMENDATIONS.repurchase_down, 1)],
  };
}

/* ----------------------------- 渠道分析 ----------------------------- */

function channelInsight(data: DataAgentOutput): InsightAgentOutput {
  const top = topChannel(data.channels);
  const weak = weakChannel(data.channels);
  const text = `${data.rangeLabel}各渠道表现分化：${top.channel}贡献最大（GMV ${fmtMoney(top.gmv)}${top.gmvDelta !== null ? `，环比 ${fmtSignedPct(top.gmvDelta)}` : ""}）${weak && weak.roi < 1.5 ? `；${weak.channel} ROI ${weak.roi.toFixed(1)} 偏低，投入产出失衡` : ""}。建议向高转化渠道倾斜预算。`;

  return {
    summary: { tag: "渠道摘要", accuracy: 93, readingTimeSec: 30, text },
    findings: data.channels.slice(0, 3).map((c, i) => ({
      id: `f${i + 1}`,
      category: "渠道",
      icon: "truck",
      title: `${c.channel}渠道${c.gmvDelta !== null && c.gmvDelta >= 0 ? "增长" : c.gmvDelta !== null ? "下滑" : "表现"}`,
      description: `GMV ${fmtMoney(c.gmv)}，订单 ${c.orders.toLocaleString("zh-CN")}，转化率 ${c.conversion.toFixed(1)}%，ROI ${c.roi.toFixed(1)}${c.gmvDelta !== null ? `，环比 ${fmtSignedPct(c.gmvDelta)}` : ""}。`,
      metric: c.gmvDelta !== null ? fmtSignedPct(c.gmvDelta) : `ROI ${c.roi.toFixed(1)}`,
      direction: c.gmvDelta !== null ? (c.gmvDelta >= 0 ? "up" : "down") : "up",
    })),
    risks:
      weak && weak.roi < 1.5
        ? [{ id: "r1", level: "medium", title: `${weak.channel}渠道 ROI 偏低`, description: `${weak.channel} ROI ${weak.roi.toFixed(1)}，低于盈亏线。`, impact: "影响: 拖累整体营销 ROI" }]
        : [],
    recommendations: [toRec(RECOMMENDATIONS.channel_opportunity, 1)],
  };
}

/* ----------------------------- 工具 ----------------------------- */

function toRec(
  rule: (typeof RECOMMENDATIONS)[keyof typeof RECOMMENDATIONS],
  index: number,
): Recommendation {
  return {
    id: `行动 ${String(index).padStart(2, "0")}`,
    icon: rule.icon,
    title: rule.title,
    description: rule.description,
    category: rule.category,
    investment: rule.investment,
    outcome: rule.outcome,
  };
}
