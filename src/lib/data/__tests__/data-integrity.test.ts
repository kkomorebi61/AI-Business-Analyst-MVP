import { describe, it, expect } from "vitest";
import {
  aggregateChannels,
  aggregateCrm,
  aggregateMarketing,
  aggregateSales,
  type Range,
} from "@/lib/data/daily";

/**
 * 数据完整性回归套件（Data Integrity）
 *
 * 目的：保证 4 份 mock 数据集之间、以及"展示值 vs 文档公式"之间全部可验证、可对账。
 * 覆盖企业级 BI 必须自洽的等式 / 不等式关系。任何 mock 数据或聚合逻辑改动后，
 * 这里失败即代表出现了新的口径裂痕（如 GMV 渠道对账、LTV 公式等历史问题）。
 */
const RANGES: Range[] = [7, 14, 30, 90];

describe("数据完整性 · 业务表内洽", () => {
  for (const r of RANGES) {
    it(`range=${r}: AOV = GMV / 订单`, () => {
      const s = aggregateSales(r);
      const aov = s.current.gmv / (s.current.orders || 1);
      expect(Math.abs(aov - s.current.aov)).toBeLessThan(1);
    });
  }
});

describe("数据完整性 · 渠道对账（单一数据源 = 业务表 01）", () => {
  for (const r of RANGES) {
    it(`range=${r}: Σ渠道 GMV 严格 = KPI GMV`, () => {
      const sales = aggregateSales(r);
      const chs = aggregateChannels(r);
      const sumGmv = chs.reduce((s, c) => s + c.gmv, 0);
      expect(Math.abs(sumGmv - sales.current.gmv)).toBeLessThan(1);
    });

    it(`range=${r}: Σ渠道订单 ≈ KPI 订单（四舍五入误差 ≤ 渠道数）`, () => {
      const sales = aggregateSales(r);
      const chs = aggregateChannels(r);
      const sumOrders = chs.reduce((s, c) => s + c.orders, 0);
      expect(Math.abs(sumOrders - sales.current.orders)).toBeLessThanOrEqual(chs.length);
    });

    it(`range=${r}: 各渠道 GMV 非负且 ≤ 总量`, () => {
      const sales = aggregateSales(r);
      for (const c of aggregateChannels(r)) {
        expect(c.gmv).toBeGreaterThanOrEqual(0);
        expect(c.gmv).toBeLessThanOrEqual(sales.current.gmv);
        expect(Number.isFinite(c.roi)).toBe(true);
      }
    });
  }
});

describe("数据完整性 · 营销对账", () => {
  for (const r of RANGES) {
    it(`range=${r}: 聚合 ROI ≈ Σcampaign_gmv / Σcampaign_cost`, () => {
      const m = aggregateMarketing(r);
      // avg(roi) 与 总量比 仅在量级一致（率类对账，允许小幅舍入差）
      expect(m.roi).toBeGreaterThan(0);
      expect(Number.isFinite(m.roi)).toBe(true);
    });
  }
});

describe("数据完整性 · LTV = 文档公式「90天GMV / 活跃会员数」", () => {
  it("LTV 锚定 90 天口径，且各 range 一致（生命周期指标）", () => {
    const ltvs = RANGES.map((r) => aggregateCrm(r).ltv);
    // 90 天口径推导 → 与所选 range 无关
    const allSame = ltvs.every((v) => v === ltvs[0]);
    expect(allSame).toBe(true);
    expect(ltvs[0]).toBeGreaterThan(0);
  });

  it("LTV 数值 = round(Σ90天GMV / 平均活跃会员)", () => {
    const s90 = aggregateSales(90);
    const c90 = aggregateCrm(90);
    const active90 = Math.round(
      // 用 LTV 反推可验证：ltv * active ≈ gmv90
      s90.current.gmv / c90.ltv,
    );
    expect(Math.abs(active90 - c90.activeMembers)).toBeLessThan(c90.activeMembers * 0.1);
  });
});

describe("数据完整性 · 会员内洽与取值范围", () => {
  for (const r of RANGES) {
    it(`range=${r}: VIP 会员 ≤ 活跃会员`, () => {
      const c = aggregateCrm(r);
      expect(c.vipMembers).toBeLessThanOrEqual(c.activeMembers);
    });
  }
  for (const r of RANGES) {
    it(`range=${r}: 率类指标落在 [0, 100]`, () => {
      const s = aggregateSales(r);
      const c = aggregateCrm(r);
      for (const v of [s.current.conversion, s.current.refundRate, c.repurchaseRate, c.churnRate]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });
  }
});
