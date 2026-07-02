/**
 * Metric Agent —— 按角色自动选择指标
 *
 * 输入：角色（+ 意图）
 * 输出：关注的指标列表（来自指标知识库 ROLE_METRICS）
 *
 * 业务意图会微调：例如 channel_analysis 会补充 traffic/cvr/roi。
 */

import { METRIC_SPECS, ROLE_METRICS, type MetricKey, type Role } from "@/lib/kb/metric-kb";
import type { Intent } from "./types";

export interface MetricAgentOutput {
  metrics: MetricKey[];
}

export function metricAgent(role: Role, intent: Intent): MetricAgentOutput {
  let metrics = [...ROLE_METRICS[role]];

  // 意图微调：渠道/风险场景补充运营侧指标，保证可解释
  if (intent === "channel_analysis") {
    appendUnique(metrics, ["conversion", "roi", "refundRate"]);
  }
  if (intent === "risk_analysis") {
    appendUnique(metrics, ["refundRate", "churnRate", "repurchaseRate"]);
  }

  return { metrics };
}

function appendUnique(list: MetricKey[], add: MetricKey[]) {
  for (const m of add) if (!list.includes(m)) list.push(m);
}

/** 给 UI 层用的便捷映射：metricKey → 展示信息 */
export function metricSpec(key: MetricKey) {
  return METRIC_SPECS[key];
}
