import { NextResponse } from "next/server";
import { isRange, type Range } from "@/lib/data/daily";
import { dataAgent } from "@/lib/agents/data-agent";
import { runWorkflow } from "@/lib/agents/workflow";
import { buildMetricEvidence } from "@/lib/agents/evidence-engine";
import { METRIC_SPECS, type Role } from "@/lib/kb/metric-kb";
import type { ChannelAggregate } from "@/lib/data/csv-engine";
import type { Evidence, Finding, KpiPoint, Recommendation, Risk } from "@/lib/agents/types";

/**
 * GET /api/dashboard?range=7|14|30|90&perspective=CEO|CRM_MANAGER|OPERATION_MANAGER
 *
 * 首页「业务驾驶舱」单一数据源：一次返回 7 节全部 L1 指标 + 默认概览洞察。
 *
 * 为什么需要它（区别于 /api/kpis 与 /api/analyze）：
 *   - /api/kpis 只返回 CEO 四件套（4 指标），覆盖不了会员/私域/渠道主题；
 *   - /api/analyze 是「先有提问再分析」，首页无提问时取不到默认洞察；
 *   - 本接口把 4 主题域 L1 指标 + 默认 overview 洞察打成一次响应，供首页 7 节直读。
 *
 * 纯 IA：复用 dataAgent（任意 metric key 组合 + 自动附 Trust）与 runWorkflow（overview），
 * 不新增任何计算逻辑、不改 Agent / 数据层。
 */

/* ------------------------------ 响应类型 ------------------------------ */

interface MetricSectionData {
  kpis: KpiPoint[];
  source: string; // 该主题域的源系统展示文案（Trust 行/节标题用）
  drillTo?: string; // 二级页路由（Drill-Down）
  /** §2 会员资产专用：期末快照日期，展示「截至 YYYY-MM-DD」 */
  asOf?: string;
}

export interface DashboardResponse {
  range: Range;
  rangeLabel: string;
  perspective: Role;
  sections: {
    overview: MetricSectionData; // §1 经营总览（周期指标 · 受时间筛选影响）
    membership: MetricSectionData; // §2 会员资产（存量指标 · 不受时间筛选影响）
    scrm: MetricSectionData; // §3 私域经营
    channels: { rows: ChannelAggregate[]; totalGmv: number }; // §4 渠道分析
  };
  insights: {
    // §5/§6/§7 默认概览洞察（runWorkflow overview 产出）
    summary: { tag: string; accuracy: number; readingTimeSec: number; text: string };
    findings: Finding[];
    risks: Risk[];
    recommendations: Recommendation[];
  };
  /** 每个 L1 指标的 Evidence（before→after）与数据血缘，供指标卡「查看依据」抽屉；
   *  SCRM 指标 evidence.items 可能为空（metricItem 暂未覆盖 SCRM key，已知 gap）。 */
  metricEvidence: Partial<Record<string, Evidence>>;
  metricLineage: Partial<Record<string, string[]>>;
}

/* ------------------------------ 入参校验 ------------------------------ */

const ROLES: Role[] = ["CEO", "CRM_MANAGER", "OPERATION_MANAGER"];
function parseRole(v: string | null): Role {
  return ROLES.includes(v as Role) ? (v as Role) : "CEO";
}

/* ------------------------------ 指标分组 ------------------------------ */

/** 首页 L1 指标全集（4 主题域）。dataAgent 按 key 取数并自动附 Trust。 */
const L1_METRICS = [
  // §1 经营总览（周期指标 · 受时间筛选影响）
  "gmv", "orders", "aov", "roi", "newMembers", "activeMembers", "repurchaseRate",
  // §2 会员资产（存量指标 · 不受时间筛选影响）
  "totalMembers", "vipMembers", "ltv", "churnRate",
  // §3 私域经营
  "totalFriends", "newFriends", "reachRate", "replyRate", "scrmConversion", "couponRedemption",
] as const;

function pick(kpis: KpiPoint[], keys: readonly string[]): KpiPoint[] {
  return keys.map((k) => kpis.find((p) => p.key === k)).filter((p): p is KpiPoint => !!p);
}

/** §1 经营总览：周期指标（随 range 窗口变化） */
const OVERVIEW_KEYS = ["gmv", "orders", "aov", "roi", "newMembers", "activeMembers", "repurchaseRate"] as const;
/** §2 会员资产：存量指标（快照，与 range 无关 —— VIP/LTV/流失率/会员总数不随时间筛选重算） */
const MEMBERSHIP_KEYS = ["totalMembers", "vipMembers", "ltv", "churnRate"] as const;
/** §3 私域经营 */
const SCRM_KEYS = ["totalFriends", "newFriends", "reachRate", "replyRate", "scrmConversion", "couponRedemption"] as const;

/* -------------------------------- 主流程 -------------------------------- */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rangeNum = Number(searchParams.get("range"));
  const range: Range = isRange(rangeNum) ? rangeNum : 7;
  const perspective = parseRole(searchParams.get("perspective"));

  // 1) 一次取齐 4 主题域全部 L1 指标（含 channels / totalGmv，均附 Trust）
  const all = dataAgent([...L1_METRICS], range);

  // 2) 默认概览洞察（§5/§6/§7）——复用现成 overview 工作流，随视角变化
  const overview = runWorkflow({ question: "本周业务表现如何？", perspective, range });

  // 3) 每个 L1 指标的 Evidence + 血缘（供指标卡「查看依据」）
  const metricEvidence: Record<string, Evidence> = {};
  const metricLineage: Record<string, string[]> = {};
  for (const k of L1_METRICS) {
    metricEvidence[k] = buildMetricEvidence([k], all);
    metricLineage[k] = METRIC_SPECS[k]?.lineage ?? [];
  }

  const body: DashboardResponse = {
    range,
    rangeLabel: all.rangeLabel,
    perspective,
    sections: {
      overview: { kpis: pick(all.kpis, OVERVIEW_KEYS), source: "OMS · CRM · Marketing Platform" },
      membership: {
        kpis: pick(all.kpis, MEMBERSHIP_KEYS),
        source: "CRM",
        drillTo: "/members",
        asOf: all.crm.asOf, // 期末快照日期 → 展示「截至 YYYY-MM-DD」
      },
      scrm: {
        kpis: pick(all.kpis, SCRM_KEYS),
        source: "Enterprise WeChat",
        drillTo: "/scrm",
      },
      channels: { rows: all.channels, totalGmv: all.sales.current.gmv },
    },
    insights: {
      summary: overview.summary,
      findings: overview.findings,
      risks: overview.risks,
      recommendations: overview.recommendations,
    },
    metricEvidence,
    metricLineage,
  };

  return NextResponse.json(body);
}
