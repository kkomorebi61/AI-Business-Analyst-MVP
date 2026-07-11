import { describe, it, expect } from "vitest";
import type { Range } from "@/lib/data/daily";
import { aggregateScrm, getFacts, type ScrmFact } from "@/lib/data/csv-engine";

/**
 * SCRM（企微运营）聚合回归套件 · 03A SQL 口径
 *
 * 数据源：data/daily_scrm_metrics.csv（90 行）。生成器逻辑：
 *   reach_rate∈[0.15,0.25]（异常段×0.70）/ reply_rate∈[0.20,0.35]（异常段×0.80）
 *   converted = reply × U(0.10,0.20) / coupon_used = coupon_sent × U(0.25,0.35)
 *   total_friends 单调递增（存量）
 *
 * 守护：公式实现正确、取值落在业务区间、环比窗口（7/14/30 有、90 无）、
 *       totalFriends 为期末存量（非 Σ）且窗口右端固定 → 各 range 一致。
 */
const RANGES: Range[] = [7, 14, 30, 90];
const CMP_RANGES: Range[] = [7, 14, 30]; // 90 天为全量窗口，无上一期

/** getFacts().scrm 已按日期升序；当期 = 最后 range 行（与 dateWindow 当期一致） */
const currentRows = (range: Range) => getFacts().scrm.slice(-range);

describe("SCRM 聚合 · 公式正确性（对齐 03A SQL 口径）", () => {
  const sum = (key: keyof ScrmFact) =>
    currentRows(7).reduce((s, r) => s + (r[key] as number), 0);

  it("reachRate = Σreached_users / Σtotal_friends", () => {
    const a = aggregateScrm(7);
    const expected = (sum("reached_users") / sum("total_friends")) * 100;
    expect(Math.abs(a.reachRate - expected)).toBeLessThan(0.01);
  });

  it("replyRate = Σreply_users / Σreached_users", () => {
    const a = aggregateScrm(7);
    const expected = (sum("reply_users") / sum("reached_users")) * 100;
    expect(Math.abs(a.replyRate - expected)).toBeLessThan(0.01);
  });

  it("scrmConversion = Σconverted_users / Σreached_users（触达→成交端到端）", () => {
    const a = aggregateScrm(7);
    const expected = (sum("converted_users") / sum("reached_users")) * 100;
    expect(Math.abs(a.scrmConversion - expected)).toBeLessThan(0.01);
  });

  it("couponRedemption = Σcoupon_used / Σcoupon_sent", () => {
    const a = aggregateScrm(7);
    const expected = (sum("coupon_used") / sum("coupon_sent")) * 100;
    expect(Math.abs(a.couponRedemption - expected)).toBeLessThan(0.01);
  });

  it("newFriends = Σnew_friends（当期累计）", () => {
    const a = aggregateScrm(7);
    expect(a.newFriends).toBe(sum("new_friends"));
  });

  it("totalFriends = 窗口末行（存量口径，非 Σ）", () => {
    const a = aggregateScrm(7);
    const rows = currentRows(7);
    const last = rows[rows.length - 1].total_friends;
    expect(a.totalFriends).toBe(last);
    // 防误聚合：Σ 会远大于末行
    const sumFriends = rows.reduce((s, r) => s + r.total_friends, 0);
    expect(a.totalFriends).toBeLessThan(sumFriends);
  });
});

describe("SCRM 聚合 · 取值合理区间", () => {
  for (const r of RANGES) {
    it(`range=${r}: 比率指标落在业务合理区间`, () => {
      const a = aggregateScrm(r);
      expect(a.reachRate).toBeGreaterThan(5);
      expect(a.reachRate).toBeLessThan(35);
      expect(a.replyRate).toBeGreaterThan(10);
      expect(a.replyRate).toBeLessThan(45);
      expect(a.scrmConversion).toBeGreaterThan(0.5);
      expect(a.scrmConversion).toBeLessThan(15);
      expect(a.couponRedemption).toBeGreaterThan(15);
      expect(a.couponRedemption).toBeLessThan(50);
    });

    it(`range=${r}: 规模指标合理（有限、正值）`, () => {
      const a = aggregateScrm(r);
      expect(Number.isFinite(a.totalFriends)).toBe(true);
      expect(a.totalFriends).toBeGreaterThan(15000);
      expect(a.totalFriends).toBeLessThan(35000);
      expect(a.newFriends).toBeGreaterThan(0);
    });
  }
});

describe("SCRM 聚合 · 环比窗口", () => {
  for (const r of CMP_RANGES) {
    it(`range=${r}: 有上一期，所有 prev/delta 非 null`, () => {
      const a = aggregateScrm(r);
      expect(a.prevReachRate).not.toBeNull();
      expect(a.reachRateDelta).not.toBeNull();
      expect(a.prevReplyRate).not.toBeNull();
      expect(a.replyRateDelta).not.toBeNull();
      expect(a.prevScrmConversion).not.toBeNull();
      expect(a.scrmConversionDelta).not.toBeNull();
      expect(a.prevCouponRedemption).not.toBeNull();
      expect(a.couponRedemptionDelta).not.toBeNull();
      expect(a.prevTotalFriends).not.toBeNull();
      expect(a.totalFriendsDelta).not.toBeNull();
      expect(a.prevNewFriends).not.toBeNull();
      expect(a.newFriendsDelta).not.toBeNull();
    });

    it(`range=${r}: totalFriends 期末 > 上期末期（好友单调递增）`, () => {
      const a = aggregateScrm(r);
      expect(a.totalFriends).toBeGreaterThan(a.prevTotalFriends!);
    });
  }

  it("range=90: 全量窗口无上一期，prev/delta 均为 null", () => {
    const a = aggregateScrm(90);
    expect(a.prevReachRate).toBeNull();
    expect(a.reachRateDelta).toBeNull();
    expect(a.prevReplyRate).toBeNull();
    expect(a.replyRateDelta).toBeNull();
    expect(a.prevScrmConversion).toBeNull();
    expect(a.scrmConversionDelta).toBeNull();
    expect(a.prevCouponRedemption).toBeNull();
    expect(a.couponRedemptionDelta).toBeNull();
    expect(a.prevTotalFriends).toBeNull();
    expect(a.totalFriendsDelta).toBeNull();
    expect(a.prevNewFriends).toBeNull();
    expect(a.newFriendsDelta).toBeNull();
  });
});

describe("SCRM 聚合 · totalFriends 跨 range 一致（窗口右端固定）", () => {
  it("各 range 的 totalFriends 相等（= 数据集末行，期末存量）", () => {
    const t7 = aggregateScrm(7).totalFriends;
    const t14 = aggregateScrm(14).totalFriends;
    const t30 = aggregateScrm(30).totalFriends;
    const t90 = aggregateScrm(90).totalFriends;
    const last = getFacts().scrm[getFacts().scrm.length - 1].total_friends;
    expect(t7).toBe(last);
    expect(t14).toBe(last);
    expect(t30).toBe(last);
    expect(t90).toBe(last);
  });
});
