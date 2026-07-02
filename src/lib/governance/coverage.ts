/**
 * Query Governance —— 覆盖率评估（doc 11 §6 + 10 §7）
 *
 * Coverage = 已接入分析维度 / 理论分析维度 × 100。
 * 本模块在「源系统粒度」上计算：trustForSources 取引用源的平均 coverage（每源 0~100），
 * 即每个引用源贡献其可用维度占比 —— 等价于 used / theoretical × 100。
 * 阈值（verbatim）：High ≥ 80 / Medium 50–<80 / Low < 50。
 */

import { trustForSources } from "@/lib/data/data-trust";
import type { CoverageLevel } from "@/lib/agents/types";

export function levelOf(coverage: number): CoverageLevel {
  if (coverage >= 80) return "High";
  if (coverage >= 50) return "Medium";
  return "Low";
}

export interface CoverageAssessment {
  coverage: number | null;
  level: CoverageLevel;
}

/** 一组引用源的覆盖率与等级（无引用源 → null / Low） */
export function assessCoverage(citedSources: string[]): CoverageAssessment {
  if (!citedSources.length) return { coverage: null, level: "Low" };
  const trust = trustForSources(citedSources);
  if (trust.coverage === null) return { coverage: null, level: "Low" };
  return { coverage: trust.coverage, level: levelOf(trust.coverage) };
}
