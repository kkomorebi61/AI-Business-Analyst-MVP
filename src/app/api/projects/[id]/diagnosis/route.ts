import { NextResponse } from "next/server";
import type { Range } from "@/lib/data/daily";
import { dailySeries } from "@/lib/data/csv-engine";
import {
  getActiveProjectId,
  getUnderstanding,
  setActiveProject,
} from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";
import { buildInsightCards } from "@/lib/agents/insight-format";
import { computeHealth } from "@/lib/agents/health-score";
import { runWorkflow } from "@/lib/agents/workflow";
import { METRIC_SPECS } from "@/lib/kb/metric-kb";
import { getSuccessDatasets } from "@/lib/project/project-dataset-store";
import { getProject, recomputeProjectCompleteness } from "@/lib/project/project-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/:id/diagnosis —— 经营诊断 V2（Step 4 / phase D）。
 *
 * 在项目数据上跑 runWorkflow（rule-first）+ 健康度 + Insight 卡 + 多指标趋势 + 问题树预览。
 * 自动激活该项目（若未激活），保证读到项目数据。返回结构供 Step4 面板渲染。
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  // 确保项目数据为当前分析源（项目页挂载已激活，这里兜底）
  if (getActiveProjectId() !== params.id) {
    const u = setActiveProject(params.id, getSuccessDatasets(params.id), project.name);
    recomputeProjectCompleteness(params.id, u.gaps);
    resetCache();
  }

  const range = parseRange(new URL(req.url).searchParams.get("range"));
  const result = runWorkflow({
    question: "最近经营表现如何？请给出健康度、关键发现与异常。",
    perspective: project.perspective,
    range,
  });

  const health = computeHealth(result.kpis, result.hasComparison);
  const insights = buildInsightCards(result.findings, result.risks);

  const days = dailySeries(range);
  const trend = {
    labels: days.map((d) => d.date),
    series: [
      { key: "gmv", label: "GMV", data: days.map((d) => d.gmv) },
      { key: "orders", label: "订单", data: days.map((d) => d.orders) },
      { key: "visitors", label: "访客", data: days.map((d) => d.visitors) },
      { key: "conversion", label: "转化率(%)", data: days.map((d) => d.conversion) },
      { key: "aov", label: "客单价", data: days.map((d) => d.aov) },
    ],
  };

  return NextResponse.json({
    range,
    rangeLabel: result.rangeLabel,
    anchor: getUnderstanding().latestDataDate,
    hasComparison: result.hasComparison,
    summary: result.summary.text,
    health,
    insights,
    kpis: result.kpis,
    trend,
    anomalies: result.governance.attributedEvents,
    anomaly: result.governance.anomaly,
    problemTree: buildProblemTree(result),
    governance: result.governance,
  });
}

function parseRange(v: string | null): Range {
  if (v === "14") return 14;
  if (v === "30") return 30;
  if (v === "90") return 90;
  return 7;
}

/**
 * 问题树预览（模块 5）：以当期核心问题（GMV 环比）为根，按 METRIC_SPECS.gmv.breakdown
 * 拆解到 订单/客单价/转化率，标注贡献与方向。点击进入根因分析（Step 5）。
 */
function buildProblemTree(
  result: ReturnType<typeof runWorkflow>,
): { text: string; pct?: string; depth: number; tone?: "blue" | "red" | "amber" }[] {
  const nodes: { text: string; pct?: string; depth: number; tone?: "blue" | "red" | "amber" }[] = [];
  const gmvKpi = result.kpis.find((k) => k.key === "gmv");
  const ordersKpi = result.kpis.find((k) => k.key === "orders");
  const aovKpi = result.kpis.find((k) => k.key === "aov");
  const convKpi = result.kpis.find((k) => k.key === "conversion");

  if (!gmvKpi || !result.hasComparison) {
    return [{ text: "暂无环比可比的核心问题（数据不足一个完整周期）", depth: 0, tone: "amber" }];
  }

  const root = gmvKpi.deltaPct < 0 ? `${gmvKpi.name} 环比 ${gmvKpi.deltaPct.toFixed(1)}%` : `${gmvKpi.name} 环比 +${gmvKpi.deltaPct.toFixed(1)}%（表现良好）`;
  nodes.push({ text: root, pct: pctOf(gmvKpi.deltaPct), depth: 0, tone: gmvKpi.deltaPct < 0 ? "red" : "blue" });

  const branches: { k: typeof gmvKpi | undefined; label: string }[] = [
    { k: ordersKpi, label: "订单量" },
    { k: aovKpi, label: "客单价" },
    { k: convKpi, label: "转化率" },
  ];
  for (const b of branches) {
    if (!b.k) continue;
    const tone = b.k.deltaPct < 0 ? "red" : "blue";
    nodes.push({
      text: `${b.label} ${b.k.deltaPct >= 0 ? "+" : ""}${b.k.deltaPct.toFixed(1)}${b.k.key === "conversion" ? "pp" : "%"}`,
      pct: pctOf(b.k.deltaPct),
      depth: 1,
      tone,
    });
  }
  // 复购/留存线索（若有）
  const repurchaseKpi = result.kpis.find((k) => k.key === "repurchaseRate");
  if (repurchaseKpi && repurchaseKpi.deltaPct < 0) {
    nodes.push({
      text: `复购率 ${repurchaseKpi.deltaPct.toFixed(1)}pp`,
      pct: pctOf(repurchaseKpi.deltaPct),
      depth: 1,
      tone: "amber",
    });
  }

  // 引用 breakdown 透传（供 UI 提示更深层根因入口）
  const breakdown = METRIC_SPECS.gmv.breakdown ?? [];
  if (breakdown.length) {
    nodes.push({ text: `可进一步拆解：${breakdown.join(" / ")}`, depth: 2 });
  }
  return nodes;
}

function pctOf(d: number): string {
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}
