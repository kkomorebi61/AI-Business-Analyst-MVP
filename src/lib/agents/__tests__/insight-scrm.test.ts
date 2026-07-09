import { describe, it, expect } from "vitest";
import { intentAgent } from "@/lib/agents/intent-agent";
import { insightAgent } from "@/lib/agents/insight-agent";
import { dataAgent } from "@/lib/agents/data-agent";
import type { MetricKey } from "@/lib/kb/metric-kb";

const SCRM_KEYS: MetricKey[] = [
  "reachRate",
  "replyRate",
  "scrmConversion",
  "couponRedemption",
  "totalFriends",
  "newFriends",
];

describe("insight · SCRM 路由与叙事", () => {
  const data = dataAgent(SCRM_KEYS, 30);

  it("intentAgent 把企微/私域/触达/发券问题归为 scrm_analysis", () => {
    expect(intentAgent("企微触达率怎么样").intent).toBe("scrm_analysis");
    expect(intentAgent("私域好友增长情况").intent).toBe("scrm_analysis");
    expect(intentAgent("发券核销率多少").intent).toBe("scrm_analysis");
  });

  it("scrm_analysis → scrmInsight：summary 含企微、findings 全部「私域」类目且 evidence 非空", () => {
    const out = insightAgent("CRM_MANAGER", "scrm_analysis", "企微触达率怎么样", data);
    expect(out.summary.text).toContain("企微");
    expect(out.summary.tag).toBe("私域摘要");
    expect(out.findings.length).toBeGreaterThan(0);
    expect(out.findings.every((f) => f.category === "私域")).toBe(true);
    // 关键：触达率 finding 的 evidence 不再空（依赖 evidence-engine SCRM 覆盖）
    const reachItems = out.findings.find((f) => f.id === "f-scrm-reach")?.evidence?.items ?? [];
    expect(reachItems.length).toBeGreaterThan(0);
    expect(reachItems.some((i) => i.metric === "触达率")).toBe(true);
  });

  it("「企微触达率为什么下降」（why+decline → risk_analysis）经关键词仍路由到私域洞察", () => {
    const { intent } = intentAgent("企微触达率为什么下降");
    // intent 因 why+decline 落为 risk_analysis，但 insightAgent 关键词兜底走 scrmInsight
    const out = insightAgent("CRM_MANAGER", intent, "企微触达率为什么下降", data);
    expect(out.summary.text).toContain("企微");
    expect(out.findings.every((f) => f.category === "私域")).toBe(true);
  });

  it("非私域问句不被误判为 scrm_analysis（回归：GMV/复购问题不变道）", () => {
    expect(intentAgent("近 7 天 GMV 怎么样").intent).not.toBe("scrm_analysis");
    expect(intentAgent("复购率为什么下降").intent).not.toBe("scrm_analysis");
  });
});
