import { describe, it, expect, beforeEach } from "vitest";
import {
  recordRequest,
  getCostSnapshot,
  resetCostStore,
  COST_TARGETS,
} from "../cost-store";

describe("cost-store · doc 15 §Cost Monitoring", () => {
  beforeEach(() => resetCostStore());

  it("初始快照全零、含 4 目标", () => {
    const s = getCostSnapshot();
    expect(s.totalRequests).toBe(0);
    expect(s.cacheHits).toBe(0);
    expect(s.targets.cacheHitRate).toBe(COST_TARGETS.cacheHitRate);
    expect(s.targets.llmUsageRate).toBe(COST_TARGETS.llmUsageRate);
    expect(s.targets.knowledgeReuseRate).toBe(COST_TARGETS.knowledgeReuseRate);
    expect(s.targets.avgCostYuan).toBe(COST_TARGETS.avgCostYuan);
  });

  it("recordRequest 累加请求量与 token", () => {
    recordRequest({ cacheHit: false, llmRequests: 1, tokensIn: 800, tokensOut: 300 });
    recordRequest({ cacheHit: false, llmRequests: 0, tokensIn: 0, tokensOut: 0 });
    const s = getCostSnapshot();
    expect(s.totalRequests).toBe(2);
    expect(s.llmRequests).toBe(1);
    expect(s.tokensIn).toBe(800);
    expect(s.tokensOut).toBe(300);
  });

  it("缓存命中计入 cacheHits，且不计为 LLM 请求", () => {
    recordRequest({ cacheHit: true, llmRequests: 0, tokensIn: 0, tokensOut: 0 });
    recordRequest({ cacheHit: false, llmRequests: 0, tokensIn: 0, tokensOut: 0 });
    const s = getCostSnapshot();
    expect(s.cacheHits).toBe(1);
    expect(s.cacheHitRate).toBeCloseTo(0.5, 5);
  });

  it("比率：llmUsageRate / knowledgeReuseRate / avgCostYuan", () => {
    // 4 请求：1 命中缓存 + 1 触发 LLM(1M in) + 2 rule
    recordRequest({ cacheHit: true, llmRequests: 0, tokensIn: 0, tokensOut: 0 });
    recordRequest({ cacheHit: false, llmRequests: 1, tokensIn: 1_000_000, tokensOut: 0 });
    recordRequest({ cacheHit: false, llmRequests: 0, tokensIn: 0, tokensOut: 0 });
    recordRequest({ cacheHit: false, llmRequests: 0, tokensIn: 0, tokensOut: 0 });
    const s = getCostSnapshot();
    expect(s.totalRequests).toBe(4);
    expect(s.llmUsageRate).toBeCloseTo(0.25, 5); // 1/4
    expect(s.knowledgeReuseRate).toBeCloseTo(0.75, 5); // (4-1)/4
    expect(s.avgCostYuan).toBeCloseTo(0.25, 5); // ¥1 / 4
  });

  it("resetCostStore 清零", () => {
    recordRequest({ cacheHit: false, llmRequests: 1, tokensIn: 100, tokensOut: 50 });
    resetCostStore();
    expect(getCostSnapshot().totalRequests).toBe(0);
    expect(getCostSnapshot().tokensIn).toBe(0);
  });
});
