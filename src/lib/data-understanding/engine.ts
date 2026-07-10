/**
 * Data Understanding Engine —— 编排器（doc 19 Core Workflow）
 *
 * 输入：解析后的数据集（样本或上传）。
 * 流程：分类(M1) → 场景识别(M2) → 分析推荐(M3) → 缺口分析(M4) → 抽取 Date Anchor
 *       → 动态驾驶舱规格(M5)。
 * 输出：UnderstandingResult（喂给 /api/understanding、/upload、P2 动态驾驶舱、P3 缺失检查）。
 *
 * 纯函数、无 fs（读文件在 dataset-store / api/upload 服务端完成）。
 */

import type { MetricKey } from "@/lib/kb/metric-kb";
import { maxDateString } from "@/lib/data/time";
import { classify } from "./classify";
import { identifyScenario } from "./scenario";
import { recommend } from "./recommend";
import { analyzeGaps, analyzableMetricKeys } from "./gap";
import type {
  BusinessScenario,
  DashboardSpec,
  DataSetType,
  UnderstandingInput,
  UnderstandingResult,
} from "./types";

/** 日期型列名（raw + aggregated），用于抽取 Latest Data Date */
const DATE_COLUMNS = ["date", "order_date", "event_date", "register_date", "created_at", "dt"];

/** 从数据集中抽取最新日期（= Date Anchor） */
function extractLatestDate(input: UnderstandingInput): string {
  const dates: string[] = [];
  for (const f of input.files) {
    const dateKey = f.columns.find((c) => DATE_COLUMNS.includes(c.toLowerCase()));
    if (!dateKey) continue;
    for (const row of f.rows) dates.push(row[dateKey]);
  }
  return maxDateString(dates);
}

/* ----------------------- Module 5 · Dashboard Generator ----------------------- */
/*
 * 按场景动态生成首页节（doc19 §Module 5）。每节绑定一个数据类型 + 候选指标；
 * 只保留「该类型已识别 且 指标可分析（无缺口）」的指标 —— 落实 No Unsupported Analysis。
 */
interface SectionDef {
  id: string;
  title: string;
  requires: DataSetType;
  metrics: MetricKey[];
}

const SECTION_DEFS: SectionDef[] = [
  { id: "overview", title: "经营总览", requires: "oms", metrics: ["gmv", "orders", "aov", "roi"] },
  {
    id: "membership",
    title: "会员资产",
    requires: "crm",
    metrics: ["totalMembers", "newMembers", "ltv", "repurchaseRate", "vipMembers", "churnRate"],
  },
  {
    id: "scrm",
    title: "私域经营",
    requires: "scrm",
    metrics: ["totalFriends", "newFriends", "reachRate", "scrmConversion", "replyRate", "couponRedemption"],
  },
];

function generateDashboard(detected: DataSetType[], scenario: BusinessScenario): DashboardSpec {
  const analyzable = new Set<MetricKey>(analyzableMetricKeys(detected));
  const sections = SECTION_DEFS.filter((s) => detected.includes(s.requires)).map((s) => ({
    id: s.id,
    title: s.title,
    metrics: s.metrics.filter((m) => analyzable.has(m)),
  }));
  // 仅保留至少有 1 个可分析指标的节（避免空节）
  return { scenario, sections: sections.filter((s) => s.metrics.length > 0) };
}

/* -------------------------------- 编排 -------------------------------- */

export function understand(input: UnderstandingInput): UnderstandingResult {
  const classification = classify(input.files);
  const detected = classification.detected;
  const scenario = identifyScenario(detected);
  const recommendations = recommend(detected);
  const gaps = analyzeGaps(detected);
  const latestDataDate = extractLatestDate(input);
  const dashboardSpec = generateDashboard(detected, scenario.primary);

  return {
    source: input.source,
    classification,
    scenario,
    recommendations,
    gaps,
    latestDataDate,
    dashboardSpec,
  };
}
