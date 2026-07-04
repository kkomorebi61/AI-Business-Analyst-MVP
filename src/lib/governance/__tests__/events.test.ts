import { describe, it, expect } from "vitest";
import { attributeEvents, resolveKey } from "@/lib/governance/events";

describe("resolveKey (中英展示名 → MetricKey 统一解析)", () => {
  it("英文事件名", () => {
    expect(resolveKey("GMV")).toBe("gmv");
    expect(resolveKey("Refund Rate")).toBe("refundRate");
    expect(resolveKey("Conversion Rate")).toBe("conversion");
    expect(resolveKey("VIP GMV")).toBe("vipMembers");
  });
  it("中文 Evidence 名", () => {
    expect(resolveKey("退款率")).toBe("refundRate");
    expect(resolveKey("复购率")).toBe("repurchaseRate");
    expect(resolveKey("订单数")).toBe("orders");
  });
  it("渠道证据「私域 GMV」→ gmv（正则回退）", () => {
    expect(resolveKey("私域 GMV")).toBe("gmv");
  });
  it("无对应指标 → null", () => {
    expect(resolveKey("Reach Rate")).toBeNull();
    expect(resolveKey("Reply Rate")).toBeNull();
  });
});

// CSV 事件（business_events.csv）：618预热 04-21 / 核心商品缺货 05-05 / VIP专属 05-18 /
//                                企微触达异常 06-01 / 新品上市 06-10 / 618大促 06-18
const JUNE = { windowStart: "2026-06-01", windowEnd: "2026-06-30" };

describe("attributeEvents (窗口 + 方向匹配)", () => {
  it("GMV 上涨 + 6 月窗口 → 命中新品上市 / 618大促（Positive↔up）", () => {
    const r = attributeEvents({ movements: [{ metric: "gmv", direction: "up" }], ...JUNE });
    const names = r.map((e) => e.event_name);
    expect(names).toContain("新品上市");
    expect(r.find((e) => e.event_name === "新品上市")?.matched_metrics).toContain("gmv");
  });

  it("复购下降 + 6 月窗口 → 命中企微触达异常（Negative↔down）", () => {
    const r = attributeEvents({ movements: [{ metric: "repurchaseRate", direction: "down" }], ...JUNE });
    expect(r.map((e) => e.event_name)).toContain("企微触达异常");
  });

  it("方向不一致 → 不匹配（GMV 下降 ≠ 新品上市 Positive）", () => {
    const r = attributeEvents({ movements: [{ metric: "gmv", direction: "down" }], ...JUNE });
    expect(r.map((e) => e.event_name)).not.toContain("新品上市");
  });

  it("事件不在窗口内 → 不匹配（6 月窗口不含 04-21 618预热）", () => {
    const r = attributeEvents({ movements: [{ metric: "gmv", direction: "up" }], ...JUNE });
    expect(r.map((e) => e.event_name)).not.toContain("618预热活动");
  });

  it("90 天窗口可命中多事件", () => {
    const r = attributeEvents({
      movements: [
        { metric: "gmv", direction: "up" },
        { metric: "repurchaseRate", direction: "down" },
      ],
      windowStart: "2026-04-01",
      windowEnd: "2026-06-30",
    });
    expect(r.length).toBeGreaterThanOrEqual(2);
  });
});
