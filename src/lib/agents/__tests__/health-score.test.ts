import { describe, it, expect } from "vitest";
import { computeHealth } from "@/lib/agents/health-score";
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

describe("computeHealth · 经营健康度", () => {
  it("无环比 → 中性 70，状态 watch", () => {
    const h = computeHealth([kpi("gmv", 0, "up")], false);
    expect(h.score).toBe(70);
    expect(h.status).toBe("watch");
  });

  it("增长类上升 → 满分；状态 healthy", () => {
    const h = computeHealth(
      [kpi("gmv", 12, "up"), kpi("orders", 8, "up"), kpi("aov", 3, "up")],
      true,
    );
    expect(h.score).toBe(100);
    expect(h.status).toBe("healthy");
  });

  it("GMV 下滑 18% → 增长维度扣分，整体走低", () => {
    const h = computeHealth([kpi("gmv", -18, "down"), kpi("orders", -10, "down")], true);
    const growth = h.dimensions.find((d) => d.key === "growth")!;
    expect(growth.score).toBeLessThan(80);
    expect(growth.metrics).toHaveLength(2);
    expect(h.topRisks.some((t) => t.label === "增长能力")).toBe(true);
  });

  it("churnRate 方向翻转：下降=好（不扣分）", () => {
    const h = computeHealth([kpi("churnRate", -2, "down")], true);
    const retention = h.dimensions.find((d) => d.key === "retention")!;
    expect(retention.metrics.find((m) => m.key === "churnRate")!.score).toBe(100);
  });

  it("状态带：≥80 healthy / 60-79 watch / <60 risk", () => {
    const down = computeHealth(
      [kpi("gmv", -30, "down"), kpi("orders", -25, "down")],
      true,
    );
    expect(down.status).toBe("risk");
  });
});
