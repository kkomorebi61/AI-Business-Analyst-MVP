import { describe, it, expect } from "vitest";
import {
  needsConfirmation,
  CONFIRM_TIERS,
  TIER_TOKEN_ESTIMATE,
} from "../cost-estimate";

describe("cost-estimate · doc 15 P10 高成本确认", () => {
  it("CONFIRM_TIERS = high + very_high（strategy / requirement）", () => {
    expect(CONFIRM_TIERS).toEqual(["high", "very_high"]);
  });

  it("needsConfirmation：仅 high/very_high 需确认", () => {
    expect(needsConfirmation("high")).toBe(true);
    expect(needsConfirmation("very_high")).toBe(true);
    expect(needsConfirmation("free")).toBe(false);
    expect(needsConfirmation("low")).toBe(false);
    expect(needsConfirmation("medium")).toBe(false);
  });

  it("TIER_TOKEN_ESTIMATE：档位越高 token 越多；free/low 为 0", () => {
    expect(TIER_TOKEN_ESTIMATE.free.total).toBe(0);
    expect(TIER_TOKEN_ESTIMATE.low.total).toBe(0);
    expect(TIER_TOKEN_ESTIMATE.medium.total).toBeLessThan(TIER_TOKEN_ESTIMATE.high.total);
    expect(TIER_TOKEN_ESTIMATE.high.total).toBeLessThan(TIER_TOKEN_ESTIMATE.very_high.total);
  });

  it("需确认档位的 label 含 K 级估算", () => {
    expect(TIER_TOKEN_ESTIMATE.high.label).toMatch(/K/);
    expect(TIER_TOKEN_ESTIMATE.very_high.label).toMatch(/K/);
  });
});
