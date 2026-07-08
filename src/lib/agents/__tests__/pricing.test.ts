import { describe, it, expect } from "vitest";
import { estimateCostYuan, PRICE_PER_1M_YUAN } from "../pricing";

describe("pricing · doc 15 平均成本 <¥0.05/问", () => {
  it("零 token → ¥0（rule 模式）", () => {
    expect(estimateCostYuan(0, 0)).toBe(0);
  });

  it("按「每 1M token」计价（默认 ¥1/1M in、¥1/1M out）", () => {
    expect(estimateCostYuan(1_000_000, 0)).toBeCloseTo(1, 5);
    expect(estimateCostYuan(1_000_000, 1_000_000)).toBeCloseTo(2, 5);
  });

  it("典型 Insight 叙事 800in/300out ≪ ¥0.05 目标", () => {
    const cost = estimateCostYuan(800, 300);
    expect(cost).toBeLessThan(0.05);
    expect(cost).toBeCloseTo(0.0011, 4);
  });

  it("默认单价为正数（可被 env 覆盖）", () => {
    expect(PRICE_PER_1M_YUAN.input).toBeGreaterThan(0);
    expect(PRICE_PER_1M_YUAN.output).toBeGreaterThan(0);
  });
});
