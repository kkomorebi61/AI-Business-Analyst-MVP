import { describe, it, expect } from "vitest";
import { buildStrategies } from "@/lib/agents/strategy-v2";
import type { KpiPoint } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";

function kpi(key: MetricKey, deltaPct: number, direction: "up" | "down"): KpiPoint {
  return {
    key,
    name: key,
    en: key,
    value: "1",
    prevLabel: "上一周期",
    prevValue: "1",
    deltaPct,
    direction,
    icon: "gmv",
  };
}

describe("buildStrategies · Strategy V2", () => {
  it("复购率下滑 → 召回策略卡（priority/ROI/能力映射齐全）", () => {
    const cards = buildStrategies({
      kpis: [kpi("repurchaseRate", -8, "down"), kpi("gmv", -10, "down")],
      hasComparison: true,
      raw: { aov: 300, vipMembers: 1000 },
    });
    const s1 = cards.find((c) => c.scenarioId === "S1_repurchase_decrease");
    expect(s1).toBeTruthy();
    expect(s1!.priority.level).toMatch(/P[012]/);
    expect(s1!.expectedROI.low).toBeLessThanOrEqual(s1!.expectedROI.high);
    expect(s1!.expectedROI.high).toBeGreaterThan(0);
    expect(s1!.capabilityMapping.items.length).toBeGreaterThan(0);
    expect(s1!.capabilityMapping.feasibilityPct).toBeGreaterThanOrEqual(0);
    expect(s1!.evidence.length).toBeGreaterThan(0);
  });

  it("指标全上升 + 有环比 → 不触发干预策略（无召回卡）", () => {
    const cards = buildStrategies({
      kpis: [kpi("gmv", 10, "up"), kpi("repurchaseRate", 3, "up")],
      hasComparison: true,
      raw: {},
    });
    expect(
      cards.find((c) => c.scenarioId === "S1_repurchase_decrease"),
    ).toBeUndefined();
  });

  it("排序：priority score 降序", () => {
    const cards = buildStrategies({
      kpis: [kpi("aov", -10, "down"), kpi("repurchaseRate", -8, "down"), kpi("gmv", -12, "down")],
      hasComparison: true,
      raw: { aov: 300, vipMembers: 1000, activeMembers: 2000 },
    });
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].priority.score).toBeGreaterThanOrEqual(cards[i].priority.score);
    }
  });

  it("无环比 → 仍产卡（不要求 bad，中性推荐）", () => {
    const cards = buildStrategies({
      kpis: [kpi("repurchaseRate", 0, "up")],
      hasComparison: false,
      raw: { aov: 300, vipMembers: 500 },
    });
    expect(cards.length).toBeGreaterThan(0);
  });
});
