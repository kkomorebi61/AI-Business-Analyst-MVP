import { describe, it, expect } from "vitest";
import { classifyQuery, classifyAB, PROFIT_B_TEXT } from "@/lib/governance/classify";

describe("classifyQuery (Class C 短路)", () => {
  it("预测类问题 → Class C + 预测文案", () => {
    const r = classifyQuery("预测下个月GMV会涨吗？");
    expect(r?.queryClass).toBe("C");
    expect(r?.mandatedText).toContain("预测");
  });

  it("竞品类问题 → Class C + 竞品文案", () => {
    const r = classifyQuery("和竞品相比市场份额如何？");
    expect(r?.queryClass).toBe("C");
    expect(r?.mandatedText).toContain("竞品");
  });

  it("正常业务问题 → null（继续取数）", () => {
    expect(classifyQuery("本周GMV表现如何？")).toBeNull();
    expect(classifyQuery("为什么利润下降？")).toBeNull();
  });
});

describe("classifyAB (Class A / B)", () => {
  it("利润/成本问题 → Class B（样板），profitCase=true，缺失成本源", () => {
    const r = classifyAB("为什么利润下降？", "business_overview");
    expect(r.queryClass).toBe("B");
    expect(r.profitCase).toBe(true);
    expect(r.metricAvailable).toBe(false);
    expect(r.missingSources.some((s) => /成本/.test(s))).toBe(true);
    expect(PROFIT_B_TEXT).toContain("尚未接入成本数据");
  });

  it("GMV 问题、必需源齐全 → Class A", () => {
    const r = classifyAB("本周GMV表现如何？", "business_overview");
    expect(r.queryClass).toBe("A");
    expect(r.requiredSources).toContain("OMS");
    expect(r.missingSources).toEqual([]);
  });

  it("复购主题 → 必需源 CRM + CDP", () => {
    const r = classifyAB("最近复购率怎么样？", "crm_analysis");
    expect(r.requiredSources).toEqual(["CRM", "CDP"]);
    expect(r.queryClass).toBe("A");
  });
});
