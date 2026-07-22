import { NextResponse } from "next/server";
import { dataAgent } from "@/lib/agents/data-agent";
import { buildStrategies } from "@/lib/agents/strategy-v2";
import {
  getActiveProjectId,
  getUnderstanding,
  setActiveProject,
} from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";
import type { MetricKey } from "@/lib/kb/metric-kb";
import { getSuccessDatasets } from "@/lib/project/project-dataset-store";
import { getProject, recomputeProjectCompleteness } from "@/lib/project/project-store";

export const dynamic = "force-dynamic";

/** 策略触发 + ROI 估算所需的指标 */
const METRICS: MetricKey[] = [
  "gmv",
  "orders",
  "aov",
  "repurchaseRate",
  "churnRate",
  "vipMembers",
  "newMembers",
  "reachRate",
  "totalFriends",
  "activeMembers",
];

/**
 * GET /api/projects/:id/strategy —— 策略方案 V2（Step 6 / phase F）。
 * 在项目数据上按指标不利变化匹配策略库 → Strategy Card（优先级/ROI/能力映射/可信度）。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  if (getActiveProjectId() !== params.id) {
    const u = setActiveProject(params.id, getSuccessDatasets(params.id), project.name);
    recomputeProjectCompleteness(params.id, u.gaps);
    resetCache();
  }

  const data = dataAgent(METRICS, 7);
  const strategies = buildStrategies({
    kpis: data.kpis,
    hasComparison: data.hasComparison,
    raw: {
      aov: data.sales.current.aov,
      activeMembers: data.crm.activeMembers,
      vipMembers: data.crm.vipMembers,
      newMembers: data.crm.newMembers,
      totalFriends: data.scrm.totalFriends,
    },
  });

  return NextResponse.json({
    strategies,
    hasComparison: data.hasComparison,
    rangeLabel: data.rangeLabel,
    anchor: getUnderstanding().latestDataDate,
  });
}
