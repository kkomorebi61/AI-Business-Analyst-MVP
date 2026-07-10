import { NextResponse } from "next/server";
import { isRange, type Range } from "@/lib/data/daily";
import { dataAgent } from "@/lib/agents/data-agent";
import { runWorkflow } from "@/lib/agents/workflow";
import { buildMetricEvidence } from "@/lib/agents/evidence-engine";
import { METRIC_SPECS, type MetricKey, type Role } from "@/lib/kb/metric-kb";
import type { ChannelAggregate } from "@/lib/data/csv-engine";
import type { Evidence, Finding, KpiPoint, Recommendation, Risk } from "@/lib/agents/types";
import { getUnderstanding, isSample } from "@/lib/data/dataset-store";
import type { BusinessScenario, DataSetType, GapAnalysis } from "@/lib/data-understanding/types";
import { SCENARIO_LABELS } from "@/lib/data-understanding/scenario";

/**
 * GET /api/dashboard?range=7|14|30|90&perspective=CEO|CRM_MANAGER|OPERATION_MANAGER
 *
 * Data First（doc 19 §Module 5 Dashboard Generator）：首页节**由当前数据理解结果
 * 动态生成**——只返回「已识别数据类型 且 指标可分析（无缺口）」的节与指标
 * （No Unsupported Analysis：缺数据的指标不出现，改在 /upload 述缺口）。
 *
 * 仍复用 dataAgent（取数 + Trust）与 runWorkflow（默认概览洞察 = doc19 M6 主动发现，
 * 无需用户提问）。返回 Date Anchor、场景、已识别数据类型、缺口，供首页展示 Data First 上下文。
 */

export const dynamic = "force-dynamic";

/* ------------------------------ 响应类型 ------------------------------ */

export type SectionKind = "period" | "snapshot";

export interface MetricSectionData {
  id: string; // overview / membership / scrm
  title: string;
  subtitle: string;
  source: string;
  kind: SectionKind;
  kpis: KpiPoint[];
  asOf?: string; // snapshot 节：期末日期
  drillTo?: string;
}

export interface DashboardResponse {
  range: Range;
  rangeLabel: string;
  perspective: Role;
  /** 动态生成的节（仅含数据支撑的） */
  sections: MetricSectionData[];
  /** 渠道分析（OMS 存在时） */
  channels?: { rows: ChannelAggregate[]; totalGmv: number };
  insights: {
    summary: { tag: string; accuracy: number; readingTimeSec: number; text: string };
    findings: Finding[];
    risks: Risk[];
    recommendations: Recommendation[];
  };
  metricEvidence: Partial<Record<string, Evidence>>;
  metricLineage: Partial<Record<string, string[]>>;
  /* —— Data First 上下文 —— */
  /** Date Anchor：最新数据日期（一切时间口径基准） */
  anchor: string;
  scenario: { primary: BusinessScenario; label: string };
  detected: DataSetType[];
  gaps: GapAnalysis;
  isSample: boolean;
}

/* ------------------------------ 入参校验 ------------------------------ */

const ROLES: Role[] = ["CEO", "CRM_MANAGER", "OPERATION_MANAGER"];
function parseRole(v: string | null): Role {
  return ROLES.includes(v as Role) ? (v as Role) : "CEO";
}

function pick(kpis: KpiPoint[], keys: readonly MetricKey[]): KpiPoint[] {
  return keys.map((k) => kpis.find((p) => p.key === k)).filter((p): p is KpiPoint => !!p);
}

/** 节渲染元信息（kind / 来源 / 下钻）—— doc19 §Module 5 各场景节的固定属性 */
const SECTION_META: Record<
  string,
  { en: string; source: string; kind: SectionKind; drillTo?: string }
> = {
  overview: { en: "Business Overview", source: "OMS · CRM · Marketing Platform", kind: "period" },
  membership: { en: "Membership Assets", source: "CRM", kind: "snapshot", drillTo: "/members" },
  scrm: { en: "SCRM Performance", source: "Enterprise WeChat", kind: "period", drillTo: "/scrm" },
};
const SECTION_TITLE: Record<string, string> = {
  overview: "经营总览",
  membership: "会员资产",
  scrm: "私域经营",
};

/* -------------------------------- 主流程 -------------------------------- */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rangeNum = Number(searchParams.get("range"));
  const range: Range = isRange(rangeNum) ? rangeNum : 7;
  const perspective = parseRole(searchParams.get("perspective"));

  // 1) 当前数据理解（doc19 引擎）→ 动态驾驶舱规格 + 缺口
  const u = getUnderstanding();
  const spec = u.dashboardSpec;
  const detected = u.classification.detected;

  // 2) 只取「规格中存在」的指标（缺数据指标已被引擎剔除）
  const metricKeys = spec.sections.flatMap((s) => s.metrics);
  const all = dataAgent(metricKeys, range);

  // 3) 动态构建节（仅数据支撑者）
  const sections: MetricSectionData[] = spec.sections.map((s) => {
    const meta = SECTION_META[s.id] ?? { en: s.title, source: "", kind: "period" as SectionKind };
    const kpis = pick(all.kpis, s.metrics);
    const names = kpis.map((k) => k.name);
    return {
      id: s.id,
      title: SECTION_TITLE[s.id] ?? s.title,
      subtitle: `${meta.en} · ${meta.kind === "snapshot" ? "存量快照" : "周期指标"}（${names.join(" / ")}）`,
      source: meta.source,
      kind: meta.kind,
      kpis,
      asOf: s.id === "membership" ? all.crm.asOf : undefined,
      drillTo: meta.drillTo,
    };
  });

  // 4) 渠道分析（OMS 存在时）
  const channels = detected.includes("oms")
    ? { rows: all.channels, totalGmv: all.sales.current.gmv }
    : undefined;

  // 5) 默认概览洞察（doc19 M6 主动发现，复用 overview 工作流）
  const overview = runWorkflow({ question: "本周业务表现如何？", perspective, range });

  // 6) 各指标 Evidence + 血缘（供指标卡「查看依据」）
  const metricEvidence: Record<string, Evidence> = {};
  const metricLineage: Record<string, string[]> = {};
  for (const k of metricKeys) {
    metricEvidence[k] = buildMetricEvidence([k], all);
    metricLineage[k] = METRIC_SPECS[k]?.lineage ?? [];
  }

  const body: DashboardResponse = {
    range,
    rangeLabel: all.rangeLabel,
    perspective,
    sections,
    channels,
    insights: {
      summary: overview.summary,
      findings: overview.findings,
      risks: overview.risks,
      recommendations: overview.recommendations,
    },
    metricEvidence,
    metricLineage,
    anchor: u.latestDataDate,
    scenario: { primary: u.scenario.primary, label: SCENARIO_LABELS[u.scenario.primary] },
    detected,
    gaps: u.gaps,
    isSample: isSample(),
  };

  return NextResponse.json(body);
}
