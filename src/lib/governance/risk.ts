/**
 * Query Governance —— 风险评估 + 响应策略（doc 11 §7–§8）
 *
 * decideResponse：综合 分级 / 覆盖率 / 异常 → 响应策略 + 风险等级 + 强制文案 + 横幅。
 * 优先级（doc 11 §3 流程）：
 *   异常 > B( Low→refuse, 否则 partial ) > A( Low→refuse, Medium→partial, High→direct )
 * 注：Class C 在工作流门 1 短路，不经过本函数；本函数覆盖异常 + A + B（含 demo 注入的异常）。
 */

import type {
  AnomalyResult,
  CoverageLevel,
  GovernanceRiskLevel,
  QueryClass,
  ResponseStrategy,
} from "@/lib/agents/types";
import { PROFIT_B_TEXT } from "./classify";

/** doc 11 规定的强制文案 */
export const ANOMALY_TEXT = "检测到异常数据。建议确认数据同步状态。暂停生成AI分析。";
export const HIGH_REFUSE_TEXT = "当前数据不足。无法生成可靠分析结果。";
export const MEDIUM_HINT = "当前分析基于部分数据完成。结果仅供参考。";
export const BOUNDARY_GENERIC = "部分维度数据缺失，以下为现有数据范围内的分析，结论存在边界。";

export interface ResponseDecision {
  strategy: ResponseStrategy;
  riskLevel: GovernanceRiskLevel;
  mandatedText: string | null;
  banner: { title: string; description: string };
}

export function decideResponse(args: {
  queryClass: Extract<QueryClass, "A" | "B">;
  coverageLevel: CoverageLevel;
  anomaly: AnomalyResult;
  profitCase: boolean;
}): ResponseDecision {
  const { queryClass, coverageLevel, anomaly, profitCase } = args;

  // 1. 异常数据 → 暂停（doc 11 §10）
  if (anomaly.detected) {
    const desc =
      anomaly.metric && anomaly.ratio
        ? `${ANOMALY_TEXT}（${anomaly.metric} 环比约 ${anomaly.ratio}×）`
        : ANOMALY_TEXT;
    return {
      strategy: "suspend",
      riskLevel: "high",
      mandatedText: ANOMALY_TEXT,
      banner: { title: "数据异常", description: desc },
    };
  }

  // 2. Class B（部分回答）
  if (queryClass === "B") {
    if (coverageLevel === "Low") {
      return { strategy: "refuse", riskLevel: "high", mandatedText: HIGH_REFUSE_TEXT, banner: { title: "数据不足", description: HIGH_REFUSE_TEXT } };
    }
    const text = profitCase ? PROFIT_B_TEXT : BOUNDARY_GENERIC;
    return {
      strategy: "partial",
      riskLevel: "medium",
      mandatedText: text,
      banner: { title: "部分回答", description: `${text} ${MEDIUM_HINT}` },
    };
  }

  // 3. Class A（直答）
  if (coverageLevel === "Low") {
    return { strategy: "refuse", riskLevel: "high", mandatedText: HIGH_REFUSE_TEXT, banner: { title: "数据不足", description: HIGH_REFUSE_TEXT } };
  }
  if (coverageLevel === "Medium") {
    return { strategy: "partial", riskLevel: "medium", mandatedText: null, banner: { title: "直答（覆盖中等）", description: MEDIUM_HINT } };
  }
  return { strategy: "direct", riskLevel: "low", mandatedText: null, banner: { title: "直答", description: "数据完整，结论可信" } };
}
