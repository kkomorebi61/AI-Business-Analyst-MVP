import { describe, it, expect } from "vitest";
import { understand } from "@/lib/data-understanding/engine";
import type { DatasetFile } from "@/lib/data-understanding/types";

/** 构造带日期的样本事实表（列对齐内置 daily 聚合表） */
function datedFile(name: string, columns: string[], dates: string[]): DatasetFile {
  return {
    name,
    columns,
    rows: dates.map((d) => Object.fromEntries(columns.map((c) => [c, c === "date" ? d : "1"]))),
  };
}

const DATES = ["2026-06-28", "2026-06-29", "2026-06-30"];

const sampleFiles: DatasetFile[] = [
  datedFile(
    "daily_channel_metrics.csv",
    ["date", "channel", "visitors", "buyers", "orders", "gmv", "refund_amount", "marketing_cost", "new_customers", "returning_customers"],
    DATES,
  ),
  datedFile(
    "daily_member_metrics.csv",
    ["date", "total_members", "active_members", "new_members", "vip_members", "buyers", "repeat_buyers", "churn_members"],
    DATES,
  ),
  datedFile(
    "daily_scrm_metrics.csv",
    ["date", "consultants", "total_friends", "new_friends", "reached_users", "reply_users", "converted_users", "coupon_sent", "coupon_used"],
    DATES,
  ),
];

describe("engine · Data Understanding 编排（doc19）", () => {
  const u = understand({ source: "sample", files: sampleFiles });

  it("识别数据类型 {oms, crm, scrm, marketing}", () => {
    expect(u.classification.detected.sort()).toEqual(["crm", "marketing", "oms", "scrm"]);
  });

  it("场景 primary = 全渠道用户运营", () => {
    expect(u.scenario.primary).toBe("omnichannel");
  });

  it("latestDataDate = 数据最大日期（Date Anchor）", () => {
    expect(u.latestDataDate).toBe("2026-06-30");
  });

  it("全集数据无缺口（No Unsupported Analysis）", () => {
    expect(u.gaps.cannotAnalyze).toHaveLength(0);
  });

  it("dashboardSpec 含 经营总览/会员资产/私域经营 三节，且每节有可分析指标", () => {
    const ids = u.dashboardSpec.sections.map((s) => s.id);
    expect(ids).toEqual(["overview", "membership", "scrm"]);
    for (const s of u.dashboardSpec.sections) {
      expect(s.metrics.length).toBeGreaterThan(0);
    }
    expect(u.dashboardSpec.sections[0].metrics).toContain("gmv");
  });

  it("推荐分析覆盖各数据类型", () => {
    const types = new Set(u.recommendations.map((r) => r.dataType));
    expect(types.has("oms")).toBe(true);
    expect(types.has("crm")).toBe(true);
    expect(types.has("scrm")).toBe(true);
  });
});

describe("engine · 仅 OMS → 驾驶舱只生成经营总览、缺口含 LTV/ROI", () => {
  const u = understand({
    source: "upload",
    files: [
      datedFile("orders.csv", ["date", "gmv", "orders", "visitors", "buyers", "refund_amount"], DATES),
    ],
  });

  it("仅识别 oms", () => {
    expect(u.classification.detected).toEqual(["oms"]);
  });

  it("dashboardSpec 只有 overview 节", () => {
    expect(u.dashboardSpec.sections.map((s) => s.id)).toEqual(["overview"]);
  });

  it("LTV / ROI 在缺口中", () => {
    expect(u.gaps.cannotAnalyze.some((g) => g.metric === "会员LTV")).toBe(true);
    expect(u.gaps.cannotAnalyze.some((g) => g.metric === "ROI")).toBe(true);
  });
});
