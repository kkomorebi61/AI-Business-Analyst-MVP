import { describe, it, expect } from "vitest";
import type { Range } from "@/lib/data/daily";
import {
  aggregateChannels,
  aggregateCrm,
  aggregateMarketing,
  aggregateSales,
  facts,
} from "@/lib/data/csv-engine";

/**
 * 数据完整性回归套件（Data Integrity · V3 / CSV 单一数据源）
 *
 * 数据源：项目根 data/*.csv（03A Schema）。GMV/订单仅存在于 daily_channel_metrics，
 * 故 Rule 1/2（总 GMV = Σ 渠道 GMV、总订单 = Σ 渠道订单）按构造成立 —— 这里做回归守护。
 * 同时直接在【原始事实表】上校验 Rule 3~8（购买≤访客、退款≤GMV、复购≤购买…），
 * 任何 CSV 重新生成或聚合逻辑改动后，此处失败即代表口径裂痕。
 */
const RANGES: Range[] = [7, 14, 30, 90];

describe("数据完整性 · 业务内洽", () => {
  for (const r of RANGES) {
    it(`range=${r}: AOV = GMV / 订单`, () => {
      const s = aggregateSales(r);
      const aov = s.current.gmv / (s.current.orders || 1);
      expect(Math.abs(aov - s.current.aov)).toBeLessThan(1);
    });
  }
});

describe("数据完整性 · 渠道对账（单一数据源 = daily_channel_metrics）", () => {
  for (const r of RANGES) {
    it(`range=${r}: Σ渠道 GMV = KPI GMV（Rule 1）`, () => {
      const sales = aggregateSales(r);
      const sumGmv = aggregateChannels(r).reduce((s, c) => s + c.gmv, 0);
      expect(Math.abs(sumGmv - sales.current.gmv)).toBeLessThan(1);
    });

    it(`range=${r}: Σ渠道订单 = KPI 订单（Rule 2）`, () => {
      const sales = aggregateSales(r);
      const sumOrders = aggregateChannels(r).reduce((s, c) => s + c.orders, 0);
      expect(Math.abs(sumOrders - sales.current.orders)).toBeLessThanOrEqual(6); // 各渠道整数取整误差
    });

    it(`range=${r}: 各渠道 GMV 非负、≤总量、ROI 有限`, () => {
      const sales = aggregateSales(r);
      for (const c of aggregateChannels(r)) {
        expect(c.gmv).toBeGreaterThanOrEqual(0);
        expect(c.gmv).toBeLessThanOrEqual(sales.current.gmv);
        expect(Number.isFinite(c.roi)).toBe(true);
      }
    });
  }
});

describe("数据完整性 · 营销对账（marketing_cost 落在渠道表，03A）", () => {
  for (const r of RANGES) {
    it(`range=${r}: ROI = ΣGMV / Σmarketing_cost，campaignGmv = 总GMV`, () => {
      const m = aggregateMarketing(r);
      const s = aggregateSales(r);
      expect(Math.abs(m.campaignGmv - s.current.gmv)).toBeLessThan(1);
      expect(m.campaignCost).toBeGreaterThan(0);
      expect(Math.abs(m.roi - s.current.gmv / m.campaignCost)).toBeLessThan(0.01);
      expect(m.roi).toBeGreaterThanOrEqual(3.5);
      expect(m.roi).toBeLessThanOrEqual(5.0);
    });
  }
});

describe("数据完整性 · LTV = 文档公式「90天GMV / 平均活跃会员」", () => {
  it("LTV 锚定 90 天口径，各 range 一致（生命周期指标）", () => {
    const ltvs = RANGES.map((r) => aggregateCrm(r).ltv);
    expect(ltvs.every((v) => v === ltvs[0])).toBe(true);
    expect(ltvs[0]).toBeGreaterThan(0);
  });

  it("LTV 数值 = round(Σ90天GMV / 平均活跃会员)", () => {
    const s90 = aggregateSales(90);
    const c90 = aggregateCrm(90);
    const active90 = Math.round(s90.current.gmv / c90.ltv);
    expect(Math.abs(active90 - c90.activeMembers)).toBeLessThan(c90.activeMembers * 0.1);
  });
});

describe("数据完整性 · 会员内洽与取值范围", () => {
  for (const r of RANGES) {
    it(`range=${r}: VIP 会员 ≤ 活跃会员`, () => {
      const c = aggregateCrm(r);
      expect(c.vipMembers).toBeLessThanOrEqual(c.activeMembers);
    });
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

describe("数据完整性 · 原始事实表 Rule 3~8（逐行）", () => {
  it("Rule 3: 购买人数 ≤ 访客数（渠道，逐行）", () => {
    for (const r of facts.channel) expect(r.buyers).toBeLessThanOrEqual(r.visitors);
  });
  it("Rule 8: 退款金额 ≤ GMV（渠道，逐行）", () => {
    for (const r of facts.channel) expect(r.refund_amount).toBeLessThanOrEqual(r.gmv);
  });
  it("隐含: 新客 + 老客 = 购买人数（渠道，逐行）", () => {
    for (const r of facts.channel) expect(r.new_customers + r.returning_customers).toBe(r.buyers);
  });
  it("Rule 4: 复购会员 ≤ 购买会员（会员，逐日）", () => {
    for (const r of facts.member) expect(r.repeat_buyers).toBeLessThanOrEqual(r.buyers);
  });
  it("Rule 5: VIP 会员 ≤ 总会员（会员，逐日）", () => {
    for (const r of facts.member) expect(r.vip_members).toBeLessThanOrEqual(r.total_members);
  });
  it("隐含: 购买会员 ≤ 活跃会员（会员，逐日）", () => {
    for (const r of facts.member) expect(r.buyers).toBeLessThanOrEqual(r.active_members);
  });
});
