import { describe, it, expect } from "vitest";
import { detectAnomaly, ANOMALY_RATIO } from "@/lib/governance/anomaly";
import type { DataAgentOutput } from "@/lib/agents/data-agent";

/** 构造 detectAnomaly 实际读取字段的假 DataAgentOutput（其余字段不影响判定） */
function fakeData(over: {
  hasComparison?: boolean;
  gmvC?: number;
  gmvP?: number;
  ordersC?: number;
  ordersP?: number;
  refundC?: number;
  refundP?: number;
  roi?: number;
  prevRoi?: number;
}): DataAgentOutput {
  return {
    hasComparison: over.hasComparison ?? true,
    sales: {
      current: { gmv: over.gmvC ?? 100, orders: over.ordersC ?? 10, aov: 0, conversion: 0, refundRate: over.refundC ?? 5 },
      previous: { gmv: over.gmvP ?? 100, orders: over.ordersP ?? 10, aov: 0, conversion: 0, refundRate: over.refundP ?? 5 },
    },
    marketing: { roi: over.roi ?? 2, prevRoi: over.prevRoi ?? 2 },
  } as unknown as DataAgentOutput;
}

describe("detectAnomaly", () => {
  it("阈值常量为 5×", () => {
    expect(ANOMALY_RATIO).toBe(5);
  });

  it("100× GMV 跳变 → 命中（spec 示例）", () => {
    const r = detectAnomaly(fakeData({ gmvC: 100, gmvP: 1 }));
    expect(r.detected).toBe(true);
    expect(r.metric).toBe("GMV");
    expect(r.ratio).toBe(100);
  });

  it("正常事件级波动（1.12×）→ 不命中", () => {
    const r = detectAnomaly(fakeData({ gmvC: 112, gmvP: 100 }));
    expect(r.detected).toBe(false);
  });

  it("无上一期（range=90）→ 不判定", () => {
    expect(detectAnomaly(fakeData({ hasComparison: false, gmvC: 999, gmvP: 1 })).detected).toBe(false);
  });

  it("率类指标需同时满足倍数与 ≥20pp：仅倍数不触发", () => {
    // 1% → 6% = 6×，但仅 5pp → 不算异常（防小基数误报）
    const r = detectAnomaly(fakeData({ refundC: 6, refundP: 1 }));
    expect(r.detected).toBe(false);
  });

  it("率类指标倍数 + ≥20pp → 命中", () => {
    // 1% → 25% ≈ 25× 且 24pp → 异常
    const r = detectAnomaly(fakeData({ refundC: 25, refundP: 1 }));
    expect(r.detected).toBe(true);
    expect(r.metric).toBe("退款率");
  });
});
