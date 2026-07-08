import { describe, it, expect } from "vitest";
import { createCostAcc } from "../usage";

describe("usage · 请求级成本累加器", () => {
  it("空累加器 summary 全零", () => {
    const s = createCostAcc().summary();
    expect(s.llmRequests).toBe(0);
    expect(s.tokensIn).toBe(0);
    expect(s.tokensOut).toBe(0);
    expect(s.costYuan).toBe(0);
    expect(s.models).toEqual([]);
  });

  it("累加多次调用：token 与调用数汇总", () => {
    const acc = createCostAcc();
    acc.add({ prompt: 100, completion: 50, total: 150, model: "glm-5.1", tier: "medium" });
    acc.add({ prompt: 200, completion: 80, total: 280, model: "glm-5.1", tier: "high" });
    const s = acc.summary();
    expect(s.llmRequests).toBe(2);
    expect(s.tokensIn).toBe(300);
    expect(s.tokensOut).toBe(130);
    expect(s.models).toEqual(["glm-5.1"]);
  });

  it("不同模型名去重收集", () => {
    const acc = createCostAcc();
    acc.add({ prompt: 10, completion: 5, total: 15, model: "glm-5.1", tier: "medium" });
    acc.add({ prompt: 10, completion: 5, total: 15, model: "claude-x", tier: "high" });
    expect(acc.summary().models.sort()).toEqual(["claude-x", "glm-5.1"]);
  });

  it("calls 只读可见", () => {
    const acc = createCostAcc();
    acc.add({ prompt: 1, completion: 1, total: 2, model: "m", tier: "medium" });
    expect(acc.calls.length).toBe(1);
    expect(acc.calls[0].total).toBe(2);
  });
});
