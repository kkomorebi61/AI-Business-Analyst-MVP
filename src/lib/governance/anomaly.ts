/**
 * Query Governance —— 异常数据检测（doc 11 §10）
 *
 * 规则（spec 仅给 100× 示例、未给量化阈值 → 本模块定义阈值常量）：
 *  - 量级类指标（GMV / 订单 / ROI）：max(cur/prev, prev/cur) ≥ ANOMALY_RATIO 视为异常。
 *  - 率类指标（退款率）：除倍数外，额外要求绝对变动 ≥ RATE_ANOMALY_PP（防小基数误报）。
 *
 * 实测 mock 数据最大波动 GMV≈1.12×、退款 Δ≤0.24pp → 5× 阈值有 ~4.5× 余量，零误报；
 * spec 的 100× 示例可正常触发。阈值导出为常量，便于调整。
 */

import type { AnomalyResult } from "@/lib/agents/types";
import type { DataAgentOutput } from "@/lib/agents/data-agent";

/** 量级类指标的异常倍数阈值（max(cur/prev, prev/cur) ≥ 5） */
export const ANOMALY_RATIO = 5;
/** 率类指标的异常绝对变动阈值（百分点） */
export const RATE_ANOMALY_PP = 20;

interface Check {
  metric: string;
  cur: number;
  prev: number | null;
  kind: "vol" | "rate";
}

export function detectAnomaly(data: DataAgentOutput): AnomalyResult {
  // 无上一期无法计算倍数 → 不判定（range=90）
  if (!data.hasComparison) return { detected: false };

  const s = data.sales;
  const m = data.marketing;
  const checks: Check[] = [
    { metric: "GMV", cur: s.current.gmv, prev: s.previous?.gmv ?? null, kind: "vol" },
    { metric: "订单数", cur: s.current.orders, prev: s.previous?.orders ?? null, kind: "vol" },
    { metric: "退款率", cur: s.current.refundRate, prev: s.previous?.refundRate ?? null, kind: "rate" },
    { metric: "营销ROI", cur: m.roi, prev: m.prevRoi, kind: "vol" },
  ];

  for (const c of checks) {
    if (c.prev === null || c.prev === 0) continue;
    const ratio = Math.max(c.cur / c.prev, c.prev / c.cur);
    if (c.kind === "vol" && ratio >= ANOMALY_RATIO) {
      return { detected: true, metric: c.metric, ratio: Number(ratio.toFixed(1)) };
    }
    if (c.kind === "rate" && ratio >= ANOMALY_RATIO && Math.abs(c.cur - c.prev) >= RATE_ANOMALY_PP) {
      return { detected: true, metric: c.metric, ratio: Number(ratio.toFixed(1)) };
    }
  }
  return { detected: false };
}
