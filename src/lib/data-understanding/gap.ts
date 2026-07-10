/**
 * Module 4 · Capability Gap Analysis（doc 19 §Module 4）+ Missing Data 基座
 *
 * 告诉用户「当前能分析什么 / 不能分析什么、为什么、缺什么」。
 * 一个指标可分析 ⇔ 它依赖的全部源系统都被已识别的数据类型覆盖。
 *
 * 源系统 → 数据类型映射（对齐 metric-kb.source_keys）：
 *   OMS → oms · CRM → crm · Marketing Platform → marketing · Enterprise WeChat → scrm
 *   CDP → 行为数据，本口径视为由 oms/crm 隐含覆盖（sample 的转化/活跃即由 OMS/CRM 推导）
 *
 * 本模块同时是 doc18 §Missing Data Checker 与全链路「No Unsupported Analysis」的数据来源：
 * 只有出现在 canAnalyze 里的指标，驾驶舱/问答才会输出，否则拦截并改述缺口。
 *
 * 纯函数、无 fs。
 */

import { METRIC_SPECS, type MetricKey } from "@/lib/kb/metric-kb";
import type { DataGap, DataSetType, GapAnalysis } from "./types";

/** 源系统 → 满足它所需的数据类型（CDP 由 oms/crm 隐含） */
function systemSatisfiedBy(system: string, detected: DataSetType[]): boolean {
  switch (system) {
    case "OMS":
      return detected.includes("oms");
    case "CRM":
      return detected.includes("crm");
    case "Marketing Platform":
      return detected.includes("marketing");
    case "Enterprise WeChat":
      return detected.includes("scrm");
    case "CDP":
      // 行为数据：OMS 访客/CRM 会员即可推导（sample 即如此）
      return detected.includes("oms") || detected.includes("crm");
    default:
      return false;
  }
}

/** 缺失系统 → 人话原因 + 推荐上传的数据类型 */
const SYSTEM_ADVICE: Record<string, { reason: string; recommendUpload: DataSetType }> = {
  OMS: { reason: "缺少订单数据（OMS）", recommendUpload: "oms" },
  CRM: { reason: "缺少会员数据（CRM）", recommendUpload: "crm" },
  "Marketing Platform": { reason: "缺少营销成本数据", recommendUpload: "marketing" },
  "Enterprise WeChat": { reason: "缺少企微/私域数据", recommendUpload: "scrm" },
  CDP: { reason: "缺少行为数据（CDP）", recommendUpload: "oms" },
};

/** 某指标是否可分析（全部源系统都被覆盖） */
export function isAnalyzable(key: MetricKey, detected: DataSetType[]): boolean {
  return METRIC_SPECS[key].source_keys.every((s) => systemSatisfiedBy(s, detected));
}

/** 可分析的指标 key 列表（供 Dashboard Generator / Classifier 缺失检查复用） */
export function analyzableMetricKeys(detected: DataSetType[]): MetricKey[] {
  return (Object.keys(METRIC_SPECS) as MetricKey[]).filter((k) => isAnalyzable(k, detected));
}

/** doc19 §Module 4 的缺口分析输出 */
export function analyzeGaps(detected: DataSetType[]): GapAnalysis {
  const canAnalyze: string[] = [];
  const cannotAnalyze: DataGap[] = [];

  for (const key of Object.keys(METRIC_SPECS) as MetricKey[]) {
    const spec = METRIC_SPECS[key];
    const missing = spec.source_keys.find((s) => !systemSatisfiedBy(s, detected));
    if (!missing) {
      canAnalyze.push(spec.name);
    } else {
      const advice = SYSTEM_ADVICE[missing] ?? { reason: `缺少 ${missing} 数据`, recommendUpload: "oms" as DataSetType };
      cannotAnalyze.push({
        metric: spec.name,
        reason: advice.reason,
        recommendUpload: advice.recommendUpload,
      });
    }
  }

  return { canAnalyze, cannotAnalyze };
}
