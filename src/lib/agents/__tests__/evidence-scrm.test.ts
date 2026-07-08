import { describe, it, expect } from "vitest";
import { dataAgent } from "@/lib/agents/data-agent";
import { buildMetricEvidence, metricItem } from "@/lib/agents/evidence-engine";
import type { MetricKey } from "@/lib/kb/metric-kb";

/** Phase 7 SCRM 接入的 6 个企微私域指标 —— 之前 metricItem 未覆盖、走 default 返回 null。 */
const SCRM_KEYS: MetricKey[] = [
  "reachRate",
  "replyRate",
  "scrmConversion",
  "couponRedemption",
  "totalFriends",
  "newFriends",
];

describe("evidence-engine · SCRM 6 key 覆盖", () => {
  // range=30 在 90 天数据集内有上一期，before/change 可比；率类/规模类口径差异也在此验证。
  const data = dataAgent(SCRM_KEYS, 30);

  it("metricItem 为 6 个 SCRM 指标全部产出 EvidenceItem（不再 null）", () => {
    for (const key of SCRM_KEYS) {
      const mi = metricItem(key, data);
      expect(mi, `metricItem("${key}") 不应回落到 null`).not.toBeNull();
      expect(mi!.metric).toBeTruthy();
      expect(mi!.after, `"${key}" 当期值不应为空`).not.toBeNull();
    }
  });

  it("率类(触达/回复/企微成交/发券核销) changeKind=pp unit=%；好友类(总数/新增) changeKind=pct unit=空", () => {
    const rateLike: MetricKey[] = ["reachRate", "replyRate", "scrmConversion", "couponRedemption"];
    const countLike: MetricKey[] = ["totalFriends", "newFriends"];
    for (const k of rateLike) {
      const mi = metricItem(k, data)!;
      expect(mi.changeKind).toBe("pp");
      expect(mi.unit).toBe("%");
    }
    for (const k of countLike) {
      const mi = metricItem(k, data)!;
      expect(mi.changeKind).toBe("pct");
      expect(mi.unit).toBe("");
    }
  });

  it("buildMetricEvidence 汇总 6 项，metric 标签与 02A 字典一致，且数据源含 Enterprise WeChat", () => {
    const ev = buildMetricEvidence(SCRM_KEYS, data);
    expect(ev.items).toHaveLength(6);
    expect(ev.items.map((i) => i.metric)).toEqual(
      expect.arrayContaining([
        "触达率",
        "回复率",
        "企微成交率",
        "发券核销率",
        "企微好友总数",
        "新增好友",
      ]),
    );
    expect(ev.dataSources).toContain("Enterprise WeChat");
  });

  it("before/change 口径随上一期存在性变化：range=30 有上一期 → before 非空", () => {
    for (const k of SCRM_KEYS) {
      const mi = metricItem(k, data)!;
      expect(mi.before, `"${k}" range=30 应有上一期值`).not.toBeNull();
    }
  });
});
