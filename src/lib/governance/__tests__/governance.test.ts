import { describe, it, expect } from "vitest";
import {
  demoOverride,
  buildVerdict,
  applyStrategy,
  collectMovements,
  enrichInsight,
} from "@/lib/governance";
import { classifyAB } from "@/lib/governance/classify";
import { assessCoverage } from "@/lib/governance/coverage";
import { ANOMALY_TEXT, HIGH_REFUSE_TEXT } from "@/lib/governance/risk";
import type { Finding, GovernanceVerdict, InsightAgentOutput } from "@/lib/agents/types";

/** 构造完整 GovernanceVerdict（applyStrategy 只读 responseStrategy / mandatedText） */
function verdict(over: Partial<GovernanceVerdict>): GovernanceVerdict {
  return {
    queryClass: "A",
    coverageLevel: "High",
    coverage: 90,
    riskLevel: "low",
    responseStrategy: "direct",
    requiredSources: ["OMS"],
    missingSources: [],
    metricAvailable: true,
    reasons: [],
    mandatedText: null,
    banner: { title: "直答", description: "" },
    anomaly: { detected: false },
    attributedEvents: [],
    ...over,
  };
}

describe("demoOverride (dev 演示开关)", () => {
  it("演示数据异常 → 注入异常", () => {
    expect(demoOverride("演示数据异常")?.anomaly?.detected).toBe(true);
  });
  it("演示低覆盖 → Low", () => {
    expect(demoOverride("演示低覆盖")?.coverage?.level).toBe("Low");
  });
  it("演示中等覆盖 → Medium", () => {
    expect(demoOverride("演示中等覆盖")?.coverage?.level).toBe("Medium");
  });
  it("普通问题 → null", () => {
    expect(demoOverride("本周GMV表现如何？")).toBeNull();
  });
});

describe("buildVerdict", () => {
  const abA = classifyAB("本周GMV表现如何？", "business_overview");
  const covHigh = assessCoverage(["OMS"]);

  it("A + High + 无异常 → direct / low", () => {
    const v = buildVerdict({ ab: abA, coverage: covHigh, anomaly: { detected: false }, attributedEvents: [] });
    expect(v.queryClass).toBe("A");
    expect(v.responseStrategy).toBe("direct");
    expect(v.riskLevel).toBe("low");
  });

  it("demo 异常 → suspend（覆盖真实输入）", () => {
    const v = buildVerdict({ ab: abA, coverage: covHigh, anomaly: { detected: false }, attributedEvents: [], demo: demoOverride("演示数据异常") });
    expect(v.responseStrategy).toBe("suspend");
    expect(v.mandatedText).toBe(ANOMALY_TEXT);
  });

  it("demo 低覆盖 → refuse", () => {
    const v = buildVerdict({ ab: abA, coverage: covHigh, anomaly: { detected: false }, attributedEvents: [], demo: demoOverride("演示低覆盖") });
    expect(v.responseStrategy).toBe("refuse");
    expect(v.coverageLevel).toBe("Low");
    expect(v.mandatedText).toBe(HIGH_REFUSE_TEXT);
  });
});

describe("applyStrategy", () => {
  const base: InsightAgentOutput = {
    summary: { tag: "高智能摘要", accuracy: 96, readingTimeSec: 40, text: "GMV 环比 +5%。" },
    findings: [{ id: "f1", category: "经营", icon: "gmv", title: "GMV 增长", description: "x", metric: "+5%", direction: "up" }],
    risks: [],
    recommendations: [],
  };

  it("direct → 原样保留 findings", () => {
    const r = applyStrategy(base, verdict({ responseStrategy: "direct" }));
    expect(r.findings).toHaveLength(1);
    expect(r.summary.text).toBe(base.summary.text);
  });

  it("partial + mandatedText → 文案前置于摘要", () => {
    const r = applyStrategy(base, verdict({ responseStrategy: "partial", mandatedText: "边界说明。" }));
    expect(r.summary.text.startsWith("边界说明。")).toBe(true);
    expect(r.findings).toHaveLength(1);
  });

  it("refuse → findings/risks/recs 清空，摘要=mandatedText", () => {
    const r = applyStrategy(base, verdict({ responseStrategy: "refuse", mandatedText: HIGH_REFUSE_TEXT }));
    expect(r.findings).toEqual([]);
    expect(r.risks).toEqual([]);
    expect(r.recommendations).toEqual([]);
    expect(r.summary.text).toBe(HIGH_REFUSE_TEXT);
  });
});

describe("collectMovements + enrichInsight", () => {
  const finding: Finding = {
    id: "f-gmv",
    category: "经营",
    icon: "gmv",
    title: "GMV 增长",
    description: "x",
    metric: "+20%",
    direction: "up",
    evidence: {
      items: [{ metric: "GMV", before: 100, after: 120, change: 20, changeKind: "pct", unit: "¥" }],
      dataSources: ["OMS"],
      coverage: 95,
      healthStatus: "Healthy",
      lastUpdated: "2026-07-01 07:30",
    },
  };

  it("collectMovements 从 Evidence before→after 推导方向", () => {
    const m = collectMovements([finding], []);
    expect(m).toContainEqual({ metric: "gmv", direction: "up" });
  });

  it("enrichInsight 挂上 lineage（GMV 血缘）", () => {
    const { findings } = enrichInsight([finding], [], []);
    expect(findings[0].lineage).toEqual(["GMV", "订单事实表", "OMS", "数据仓库", "AI 分析"]);
  });

  it("enrichInsight 命中事件时挂 rootCause", () => {
    const event = {
      event_name: "爆款新品上线",
      event_date: "2026-06-26",
      event_type: "Product" as const,
      direction: "Positive" as const,
      description: "GMV +18%。",
      matched_metrics: ["gmv" as const],
    };
    const { findings } = enrichInsight([finding], [], [event]);
    expect(findings[0].rootCause?.event.event_name).toBe("爆款新品上线");
  });

  it("enrichInsight 方向不一致时不挂 rootCause", () => {
    const event = {
      event_name: "库存缺货",
      event_date: "2026-05-07",
      event_type: "Supply Chain" as const,
      direction: "Negative" as const,
      description: "GMV -20%。",
      matched_metrics: ["gmv" as const],
    };
    const { findings } = enrichInsight([finding], [], [event]);
    expect(findings[0].rootCause).toBeUndefined();
  });
});
