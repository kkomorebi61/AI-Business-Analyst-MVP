/**
 * 高成本任务确认（doc 15 Principle 10 / Human Approval For Expensive Tasks）
 *
 * 触发任务：生成完整 PRD / 季度经营分析 / 策略报告 → 对应 QueryType requirement / strategy
 *           → CostTier very_high / high。
 * 弹窗文案：「预计消耗：XX Tokens / 确认执行？」
 *
 * 「XX Tokens」为 tier 估算（执行前无法精确），文案须标「预计」。
 */

import type { CostTier } from "./types";

/** 各档位 token 消耗估算（label 用于确认弹窗，须标「预计」） */
export const TIER_TOKEN_ESTIMATE: Record<
  CostTier,
  { tokensIn: number; tokensOut: number; total: number; label: string }
> = {
  free: { tokensIn: 0, tokensOut: 0, total: 0, label: "0（纯规则/SQL）" },
  low: { tokensIn: 0, tokensOut: 0, total: 0, label: "≈0（知识库）" },
  medium: { tokensIn: 800, tokensOut: 300, total: 1100, label: "≈1.1K" },
  high: { tokensIn: 1500, tokensOut: 600, total: 2100, label: "≈2.1K" },
  very_high: { tokensIn: 3000, tokensOut: 1500, total: 4500, label: "≈4.5K" },
};

/** doc 15 P10：需人工确认的成本档（strategy=high、requirement=very_high） */
export const CONFIRM_TIERS: readonly CostTier[] = ["high", "very_high"];

/** 是否需要执行前确认 */
export function needsConfirmation(tier: CostTier): boolean {
  return (CONFIRM_TIERS as readonly string[]).includes(tier);
}
