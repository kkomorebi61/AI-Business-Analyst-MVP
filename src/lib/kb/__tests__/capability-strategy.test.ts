/**
 * Capability KB + Strategy Engine 单测（doc 16 §Matching Rules + doc 17 §Strategy Library）
 */
import { describe, expect, it } from "vitest";
import { gapAnalysis, matchCapabilities, topCapability, CAPABILITIES } from "../capability-kb";
import { matchStrategy, strategyEngine, STRATEGY_LIBRARY } from "@/lib/agents/strategy-engine";

describe("capability-kb · matchCapabilities", () => {
  it("复购率下降命中召回相关能力（doc 16 Rule 1）", () => {
    const m = matchCapabilities("复购率下降，用优惠券做会员召回");
    const names = m.map((x) => x.capability.capability);
    expect(names).toEqual(expect.arrayContaining(["生命周期标签", "优惠券管理"]));
    expect(m[0].score).toBeGreaterThan(0);
  });

  it("优惠券操作精准命中优惠券管理", () => {
    const top = topCapability("如何创建满300减50优惠券");
    expect(top?.capability.id).toBe("CRM_MARKETING_002");
  });

  it("全部能力为 Active 且有操作路径", () => {
    for (const c of CAPABILITIES) {
      expect(c.status).toBe("Active");
      expect(c.path.length).toBeGreaterThan(0);
      expect(c.owner).toBeTruthy();
    }
  });
});

describe("capability-kb · gapAnalysis", () => {
  it("已支持的问题 → supported=true（doc 16 Rule 2 复用）", () => {
    const g = gapAnalysis("如何配置自动营销流程");
    expect(g.supported).toBe(true);
    expect(g.matched.length).toBeGreaterThan(0);
  });

  it("未覆盖的问题 → supported=false + 缺口（doc 16 Rule 3 出 PRD）", () => {
    const g = gapAnalysis("帮我做一个老带新拼团分销功能");
    expect(g.supported).toBe(false);
    expect(g.gaps.length).toBeGreaterThan(0);
    expect(g.gaps.some((x) => x.includes("裂变"))).toBe(true);
  });
});

describe("strategy-engine · matchStrategy", () => {
  it("复购率下降 → 会员召回计划（doc 17 Scenario 1）", () => {
    const m = matchStrategy("复购率下降怎么办");
    expect(m?.scenario.id).toBe("S1_repurchase_decrease");
    expect(m?.scenario.strategy).toContain("召回");
  });

  it("企微触达率下降 → 导购任务激励（doc 17 Scenario 6）", () => {
    const m = matchStrategy("企微触达率下降怎么提升");
    expect(m?.scenario.id).toBe("S6_scrm_engagement_decline");
  });

  it("策略库覆盖 6 个零售场景（doc 17 verbatim）", () => {
    expect(STRATEGY_LIBRARY).toHaveLength(6);
  });
});

describe("strategy-engine · strategyEngine", () => {
  it("命中策略并解析能力（capabilityIds → 详情）", () => {
    const p = strategyEngine("如何提升复购率");
    expect(p.fallback).toBe(false);
    expect(p.capabilities.length).toBeGreaterThan(0);
    expect(p.capabilities.every((c) => c.path.includes(">"))).toBe(true);
  });

  it("未命中 → fallback 策略（不崩溃）", () => {
    const p = strategyEngine("如何提升火星基地产能");
    expect(p.fallback).toBe(true);
    expect(p.strategyName).toContain("待评估");
  });
});
