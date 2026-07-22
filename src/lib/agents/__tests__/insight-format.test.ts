import { describe, it, expect } from "vitest";
import { buildInsightCards } from "@/lib/agents/insight-format";
import type { Finding, Risk } from "@/lib/agents/types";

describe("buildInsightCards · Insight 卡", () => {
  it("Risk → severity 取 level；confidence 由 coverage 派生", () => {
    const risks: Risk[] = [
      {
        id: "r1",
        level: "high",
        title: "复购率下滑",
        description: "近30天复购率下降",
        impact: "影响 GMV",
        evidence: { items: [], dataSources: ["CRM"], coverage: 85, healthStatus: "Healthy", lastUpdated: null },
      },
    ];
    const cards = buildInsightCards([], risks);
    expect(cards[0].kind).toBe("risk");
    expect(cards[0].severity).toBe("high");
    expect(cards[0].confidence).toBe("High");
    expect(cards[0].confidenceScore).toBe(85);
    expect(cards[0].nextSteps).toContain("进入根因分析");
  });

  it("Finding → 下滑=high / 上升=low", () => {
    const findings: Finding[] = [
      { id: "f1", category: "商品", icon: "gmv", title: "GMV下滑", description: "d", metric: "-18%", direction: "down" },
      { id: "f2", category: "商品", icon: "gmv", title: "订单上升", description: "d", metric: "+5%", direction: "up" },
    ];
    const cards = buildInsightCards(findings, []);
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(byId.f1.severity).toBe("high");
    expect(byId.f2.severity).toBe("low");
  });

  it("排序：severity high 优先；coverage<50 → Low", () => {
    const findings: Finding[] = [
      { id: "flow", category: "c", icon: "i", title: "t", description: "d", metric: "+1%", direction: "up", evidence: { items: [], dataSources: [], coverage: 30, healthStatus: "Healthy", lastUpdated: null } },
    ];
    const risks: Risk[] = [
      { id: "rhigh", level: "high", title: "t", description: "d", impact: "i" },
    ];
    const cards = buildInsightCards(findings, risks);
    expect(cards[0].id).toBe("rhigh"); // high 排前
    expect(cards.find((c) => c.id === "flow")!.confidence).toBe("Low");
  });

  it("confidence=null 当无 evidence", () => {
    const cards = buildInsightCards(
      [{ id: "f", category: "c", icon: "i", title: "t", description: "d", metric: "m", direction: "up" }],
      [],
    );
    expect(cards[0].confidence).toBeNull();
  });
});
