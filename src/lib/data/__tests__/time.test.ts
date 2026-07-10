import { describe, it, expect } from "vitest";
import {
  addDays,
  isValidDate,
  maxDateString,
  resolveWindow,
  timeExprLabel,
  rangeToExpr,
} from "@/lib/data/time";

describe("time · 纯日期工具", () => {
  it("addDays 不读系统时钟，纯算术", () => {
    expect(addDays("2026-06-30", -1)).toBe("2026-06-29");
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01"); // 跨月
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31"); // 跨年
  });

  it("isValidDate", () => {
    expect(isValidDate("2026-06-30")).toBe(true);
    expect(isValidDate("2026-6-3")).toBe(false);
    expect(isValidDate("abc")).toBe(false);
  });

  it("maxDateString 取最大、忽略非法", () => {
    expect(maxDateString(["2026-06-01", "2026-06-30", "2026-06-15"])).toBe("2026-06-30");
    expect(maxDateString(["x", ""])).toBe("");
  });
});

describe("time · resolveWindow（一切基于 Anchor，禁系统时间）", () => {
  const anchor = "2026-06-30";
  it("today = anchor 当天", () => {
    expect(resolveWindow(anchor, { kind: "today" })).toMatchObject({ from: anchor, to: anchor });
  });
  it("yesterday = anchor-1", () => {
    expect(resolveWindow(anchor, { kind: "yesterday" })).toMatchObject({ from: "2026-06-29", to: "2026-06-29" });
  });
  it("relative 7 = 最近7天 [06-24, 06-30]", () => {
    expect(resolveWindow(anchor, { kind: "relative", days: 7 })).toMatchObject({
      from: "2026-06-24",
      to: "2026-06-30",
    });
  });
  it("absolute 自定义区间不依赖 anchor", () => {
    expect(resolveWindow(anchor, { kind: "absolute", from: "2026-06-01", to: "2026-06-15" })).toMatchObject({
      from: "2026-06-01",
      to: "2026-06-15",
    });
  });
  it("rangeToExpr 把旧 Range 映射为 relative", () => {
    expect(rangeToExpr(30)).toEqual({ kind: "relative", days: 30 });
  });
  it("timeExprLabel", () => {
    expect(timeExprLabel({ kind: "today" })).toBe("今天");
    expect(timeExprLabel({ kind: "relative", days: 14 })).toBe("最近 14 天");
  });
});
