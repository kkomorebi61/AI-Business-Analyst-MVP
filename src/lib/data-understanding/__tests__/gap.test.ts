import { describe, it, expect } from "vitest";
import { analyzeGaps, analyzableMetricKeys, isAnalyzable } from "@/lib/data-understanding/gap";
import type { DataSetType } from "@/lib/data-understanding/types";

const can = (gaps: ReturnType<typeof analyzeGaps>) => new Set(gaps.canAnalyze);

describe("gap · doc19 缺口分析（No Unsupported Analysis 基座）", () => {
  it("仅 OMS：GMV/订单可分析，LTV 与 ROI 为缺口", () => {
    const gaps = analyzeGaps(["oms"]);
    const c = can(gaps);
    expect(c.has("GMV")).toBe(true);
    expect(c.has("订单数")).toBe(true);
    const ltv = gaps.cannotAnalyze.find((g) => g.metric === "会员LTV");
    expect(ltv).toBeTruthy();
    expect(ltv!.reason).toContain("会员数据");
    expect(ltv!.recommendUpload).toBe("crm");
    const roi = gaps.cannotAnalyze.find((g) => g.metric === "ROI");
    expect(roi).toBeTruthy();
    expect(roi!.reason).toContain("营销成本");
    expect(roi!.recommendUpload).toBe("marketing");
  });

  it("OMS+Marketing：ROI 可分析；CRM/SCRM 指标为缺口", () => {
    const gaps = analyzeGaps(["oms", "marketing"]);
    expect(can(gaps).has("ROI")).toBe(true);
    expect(gaps.cannotAnalyze.some((g) => g.metric === "会员LTV")).toBe(true);
    expect(gaps.cannotAnalyze.some((g) => g.metric === "触达率")).toBe(true);
  });

  it("全集 {oms,crm,scrm,marketing}：全部可分析，无缺口", () => {
    const full: DataSetType[] = ["oms", "crm", "scrm", "marketing"];
    const gaps = analyzeGaps(full);
    expect(gaps.cannotAnalyze).toHaveLength(0);
    expect(gaps.canAnalyze.length).toBeGreaterThan(10);
  });

  it("analyzableMetricKeys / isAnalyzable 一致", () => {
    const keys = analyzableMetricKeys(["oms", "crm"]);
    expect(keys).toContain("ltv");
    expect(isAnalyzable("ltv", ["oms", "crm"])).toBe(true);
    expect(isAnalyzable("roi", ["oms", "crm"])).toBe(false); // 缺 marketing
  });
});
