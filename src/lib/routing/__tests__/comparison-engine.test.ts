/**
 * Comparison Engine 测试（doc 18 V2 §Time Anchor + §Comparison + §Trend）
 *
 * 任意窗口取数 / 时段对比 / 维度对比 / 走势。基于内置样本：
 *   daily_channel_metrics date 2026-04-01 ~ 2026-06-29（anchor = 06-29），
 *   6 渠道 PRIVATE_TRAFFIC / MINI_PROGRAM / TMALL / JD / XIAOHONGSHU / OFFLINE_STORE。
 * 纯聚合、确定性。
 */
import { describe, expect, it } from "vitest";
import {
  metricValue,
  formatMetricValue,
  compareWindows,
  compareChannels,
  trendPoints,
} from "../comparison-engine";

describe("comparison-engine · metricValue（任意窗口取数，doc18 §Time Anchor）", () => {
  it("单日 GMV > 0（anchor 当天 6 渠道求和）", () => {
    expect(metricValue("gmv", "2026-06-29", "2026-06-29")).toBeGreaterThan(0);
  });

  it("宽窗口 GMV ≥ 窄窗口 GMV（同源递增窗口）", () => {
    const narrow = metricValue("gmv", "2026-06-29", "2026-06-29");
    const wide = metricValue("gmv", "2026-06-01", "2026-06-29");
    expect(wide).toBeGreaterThanOrEqual(narrow);
  });

  it("样本范围之外的窗口 = 0（不计入）", () => {
    expect(metricValue("gmv", "2025-01-01", "2025-01-02")).toBe(0);
  });
});

describe("comparison-engine · formatMetricValue", () => {
  it("率类 → 百分号", () => {
    expect(formatMetricValue("conversion", 12.34)).toBe("12.3%");
  });
  it("金额 → 万 / 亿", () => {
    expect(formatMetricValue("gmv", 50000)).toBe("¥5万");
    expect(formatMetricValue("gmv", 1.2e8)).toBe("¥1.20亿");
  });
  it("整数 → 千分位", () => {
    expect(formatMetricValue("orders", 1234)).toBe("1,234");
  });
});

describe("comparison-engine · compareWindows（时段对比，doc18 Type C）", () => {
  it("产出基线 / 对比值 + delta + direction", () => {
    const res = compareWindows(
      "gmv",
      { from: "2026-06-28", to: "2026-06-28", label: "昨天" },
      { from: "2026-06-29", to: "2026-06-29", label: "今天" },
    );
    expect(res.baseline.value).toBeGreaterThanOrEqual(0);
    expect(res.comparison.value).toBeGreaterThan(0);
    expect(["up", "down"]).toContain(res.direction);
    expect(res.deltaFormatted).toMatch(/%$/);
  });
});

describe("comparison-engine · compareChannels（维度对比，doc18 Type C）", () => {
  it("两渠道各产一行，顺序保留，含 delta", () => {
    const res = compareChannels("gmv", "2026-06-01", "2026-06-29", [
      "Enterprise WeChat",
      "Mini Program",
    ]);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].channel).toBe("Enterprise WeChat");
    expect(res.rows[1].channel).toBe("Mini Program");
    expect(res.delta).not.toBeNull();
  });
});

describe("comparison-engine · trendPoints（任意区间走势，doc18 Type B）", () => {
  it("区间内每日一点、日期升序、值非空", () => {
    const pts = trendPoints("gmv", "2026-06-20", "2026-06-29");
    expect(pts).toHaveLength(10);
    expect(pts[0].date).toBe("2026-06-20");
    expect(pts.at(-1)!.date).toBe("2026-06-29");
    expect(pts.every((p) => p.value > 0)).toBe(true);
  });
});
