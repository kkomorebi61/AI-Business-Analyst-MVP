/**
 * Query Classifier 测试（doc 18 §Success Criteria：分类准确率 > 90%、参数提取准确率 > 90%）
 *
 * 覆盖 doc 18 给出的全部示例 + 边界（歧义句、默认兜底）。
 * 纯规则路径（classifyRule），不依赖 LLM Key —— CI 确定性。
 */
import { describe, expect, it } from "vitest";
import {
  classifyRule,
  extractParams,
  parseTimeExpr,
  parseTimeComparison,
  parseCompareChannels,
} from "../query-classifier";
import type { QueryType } from "../types";

const CASES: { q: string; expect: QueryType }[] = [
  // Metric Query（聚合量取值）
  { q: "今天GMV是多少？", expect: "metric" },
  { q: "昨天订单数是多少？", expect: "metric" },
  { q: "当前会员数是多少？", expect: "metric" },
  { q: "最近7天企微好友总数", expect: "metric" },
  // Calculation Query（派生指标）
  { q: "ROI是多少？", expect: "calculation" },
  { q: "LTV是多少？", expect: "calculation" },
  { q: "复购率是多少？", expect: "calculation" },
  { q: "最近30天转化率多少", expect: "calculation" },
  // Insight Query（归因）
  { q: "为什么GMV下降？", expect: "insight" },
  { q: "为什么企微贡献下降？", expect: "insight" },
  { q: "为什么ROI下降？", expect: "insight" },
  { q: "复购率下降的原因是什么", expect: "insight" },
  // Strategy Query（经营改善）
  { q: "如何提升复购率？", expect: "strategy" },
  { q: "如何提升LTV？", expect: "strategy" },
  { q: "如何提升企微转化？", expect: "strategy" },
  { q: "复购率下降怎么办？", expect: "strategy" },
  // Execution Query（系统操作）
  { q: "如何创建优惠券？", expect: "execution" },
  { q: "如何配置自动营销？", expect: "execution" },
  { q: "如何创建会员标签？", expect: "execution" },
  { q: "在哪里创建优惠券", expect: "execution" },
  // Requirement Query（需求/PRD）
  { q: "系统不支持怎么办？", expect: "requirement" },
  { q: "帮我设计一个会员成长体系", expect: "requirement" },
  { q: "帮我生成PRD", expect: "requirement" },
];

describe("query-classifier · classifyRule", () => {
  for (const { q, expect: expected } of CASES) {
    it(`classify "${q}" → ${expected}`, () => {
      const c = classifyRule(q);
      expect(c.queryType, `${q} 应为 ${expected}，实际 ${c.queryType}（${c.reason}）`).toBe(expected);
      expect(c.by).toBe("rule");
      expect(c.confidence).toBeGreaterThan(0);
    });
  }

  it("分类准确率 > 90%（doc 18 成功标准）", () => {
    const correct = CASES.filter((c) => classifyRule(c.q).queryType === c.expect).length;
    const acc = correct / CASES.length;
    expect(acc).toBeGreaterThan(0.9);
  });

  it("未命中意图时兜底为 metric（SQL First，最小化 LLM）", () => {
    const c = classifyRule("看一下经营数据");
    expect(c.queryType).toBe("metric");
    expect(c.confidence).toBeLessThan(0.8); // 低置信（0.5）→ 可触发 GLM 兜底
  });
});

describe("query-classifier · extractParams（参数提取准确率 > 90%）", () => {
  it("抽取指标、时间范围、渠道、对比对象", () => {
    const p = extractParams("今天企微渠道GMV相比昨天增长多少");
    expect(p.metricKey).toBe("gmv");
    expect(p.channel).toBe("Enterprise WeChat");
    expect(p.compareTarget).toBe("yesterday");
  });

  it("抽取会员分群", () => {
    const p = extractParams("VIP会员复购率和普通会员对比");
    expect(p.segment).toEqual(expect.arrayContaining(["VIP", "Normal Member"]));
    expect(p.metricKey).toBe("repurchaseRate");
  });

  it("抽取时间范围 → range", () => {
    expect(extractParams("最近14天GMV").range).toBe(14);
    expect(extractParams("近30天复购率").range).toBe(30);
    expect(extractParams("最近90天表现").range).toBe(90);
    expect(extractParams("本周GMV").range).toBe(7);
  });

  it("抽取区域", () => {
    expect(extractParams("华东区域最近两周GMV").region).toBe("East China");
    expect(extractParams("华东区域最近两周GMV").range).toBe(14);
  });

  it("无明确参数时不报错", () => {
    const p = extractParams("经营情况怎么样");
    expect(p).toBeDefined();
  });
});

describe("query-classifier · Time Anchor 解析（doc18 §M2，禁系统时间）", () => {
  it("parseTimeExpr：今天 / 昨天 / 最近 N / 自定义区间", () => {
    expect(parseTimeExpr("今天GMV")).toEqual({ kind: "today" });
    expect(parseTimeExpr("昨天订单")).toEqual({ kind: "yesterday" });
    expect(parseTimeExpr("最近7天GMV")).toEqual({ kind: "relative", days: 7 });
    expect(parseTimeExpr("2026-06-01到2026-06-15 GMV")).toEqual({
      kind: "absolute",
      from: "2026-06-01",
      to: "2026-06-15",
    });
    // 中文日期（年默认数据年 2026）
    expect(parseTimeExpr("6月1日到6月15日GMV")).toEqual({
      kind: "absolute",
      from: "2026-06-01",
      to: "2026-06-15",
    });
  });

  it("parseTimeComparison：今天 vs 昨天（基线=昨天）", () => {
    expect(parseTimeComparison("今天和昨天GMV对比")).toEqual({
      baseline: { kind: "yesterday" },
      comparison: { kind: "today" },
    });
    expect(parseTimeComparison("最近7天GMV")).toBeUndefined();
  });

  it("parseCompareChannels：抽取 ≥2 渠道", () => {
    expect(parseCompareChannels("企业微信和小程序GMV对比")).toEqual(
      expect.arrayContaining(["Enterprise WeChat", "Mini Program"]),
    );
    expect(parseCompareChannels("GMV对比")).toEqual([]);
  });
});

describe("query-classifier · comparison / trend 分类（doc18 V2）", () => {
  it("时段对比 → comparison", () => {
    expect(classifyRule("今天和昨天GMV对比").queryType).toBe("comparison");
  });

  it("维度对比 → comparison（对比优先于取值）", () => {
    expect(classifyRule("企业微信和小程序GMV对比").queryType).toBe("comparison");
  });

  it("趋势 → trend", () => {
    expect(classifyRule("最近30天GMV趋势如何").queryType).toBe("trend");
    expect(classifyRule("GMV走势怎么样").queryType).toBe("trend");
  });
});
