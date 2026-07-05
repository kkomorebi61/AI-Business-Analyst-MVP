import { describe, it, expect } from "vitest";
import { runWorkflow } from "@/lib/agents/workflow";

/**
 * AnalysisResult 渠道明细契约（V3 · 渠道 GMV 明细表）
 *
 * 守护「Σ 各渠道 GMV === 汇总 GMV」从数据层到 API 响应层的端到端一致性：
 * workflow 必须把 data.channels 与 data.sales.current.gmv 暴露到 AnalysisResult，
 * 且二者逐元相等（渠道明细表 channel-breakdown 的 ✓ 据此）。
 */
describe("AnalysisResult.channels / totalGmv 契约", () => {
  for (const range of [7, 30, 90] as const) {
    it(`range=${range}: channels 全 6 渠道，Σ === totalGmv（元级恒等）`, () => {
      const r = runWorkflow({ question: "各渠道表现如何？", range });
      expect(r.channels).toHaveLength(6);
      const sumGmv = r.channels.reduce((s, c) => s + c.gmv, 0);
      expect(r.totalGmv).toBeGreaterThan(0);
      expect(Math.round(sumGmv)).toBe(Math.round(r.totalGmv));
    });
  }

  it("overview 问题同样暴露 channels/totalGmv", () => {
    const r = runWorkflow({ question: "本周业务表现如何？", range: 7 });
    expect(r.channels.length).toBeGreaterThan(0);
    expect(r.totalGmv).toBeGreaterThan(0);
  });

  it("Class C 拒答：channels 为空、totalGmv 为 0", () => {
    // 竞品问题命中 Class C 短路 → refusedResult（不取数）
    const r = runWorkflow({ question: "和竞品对比市场份额", range: 7 });
    expect(r.governance.responseStrategy).toBe("refuse");
    expect(r.channels).toEqual([]);
    expect(r.totalGmv).toBe(0);
  });
});
