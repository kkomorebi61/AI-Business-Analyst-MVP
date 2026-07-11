/**
 * Router 测试（doc 18 路由表 + doc 15 成本治理 + Rule First）
 *
 * 无 ANALYST_LLM_API_KEY → 全程规则路径，routing.llmUsed=false（确定性）。
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { routeQuery } from "../router";
import { QUERY_TYPE_COST, type QueryType } from "../types";
import { resetCostStore, getCostSnapshot } from "../cost-store";
import { resetCache } from "../cache";
import { setUploaded, resetDatasetStore } from "@/lib/data/dataset-store";
import type { DatasetFile } from "@/lib/data-understanding/types";

const ROUTE_CASES: { q: string; type: QueryType }[] = [
  { q: "最近7天GMV是多少？", type: "metric" },
  { q: "ROI是多少？", type: "calculation" },
  { q: "为什么GMV下降？", type: "insight" },
  { q: "如何提升复购率？", type: "strategy" },
  { q: "如何创建优惠券？", type: "execution" },
  { q: "帮我生成PRD", type: "requirement" },
];

// routeQuery 会写入进程级成本计数器与缓存，每个用例前清零避免互相污染
beforeEach(() => {
  resetCostStore();
  resetCache();
});

describe("router · 分发正确性", () => {
  for (const { q, type } of ROUTE_CASES) {
    it(`"${q}" → ${type}`, async () => {
      const r = await routeQuery({ question: q });
      expect(r.classification.queryType).toBe(type);
      expect(r.answer.kind).toBe(type);
      expect(r.routing.queryType).toBe(type);
    });
  }
});

describe("router · 成本治理（doc 18 §Cost Governance）", () => {
  for (const { q, type } of ROUTE_CASES) {
    it(`"${type}" costTier = ${QUERY_TYPE_COST[type]}`, async () => {
      const r = await routeQuery({ question: q });
      expect(r.cost.tier).toBe(QUERY_TYPE_COST[type]);
      expect(r.routing.costTier).toBe(QUERY_TYPE_COST[type]);
    });
  }

  it("metric / calculation 零成本，不调用 LLM（Rule First）", async () => {
    for (const q of ["最近7天GMV是多少？", "ROI是多少？"]) {
      const r = await routeQuery({ question: q });
      expect(r.routing.llmUsed).toBe(false);
      expect(r.routing.llmModel).toBeNull();
      expect(r.cost.tier).toBe("free");
    }
  });

  it("execution 走知识库，不调用 LLM", async () => {
    const r = await routeQuery({ question: "如何创建优惠券？" });
    expect(r.routing.llmUsed).toBe(false);
    expect(r.cost.tier).toBe("low");
  });
});

describe("router · Rule First 决策链（可解释）", () => {
  it("每个路由结果都带非空 ruleOrder（为何不调用更贵引擎）", async () => {
    for (const { q } of ROUTE_CASES) {
      const r = await routeQuery({ question: q });
      expect(r.routing.ruleOrder.length).toBeGreaterThan(0);
      expect(r.routing.engines.length).toBeGreaterThan(0);
    }
  });

  it("metric 路径只含 SQL Engine，无 GLM", async () => {
    const r = await routeQuery({ question: "最近7天GMV是多少？" });
    expect(r.routing.engines).toEqual(["SQL Engine"]);
    expect(r.routing.engines).not.toContain("GLM");
  });
});

describe("router · 答案结构", () => {
  it("MetricAnswer 带等价 SQL 与数值（可审计）", async () => {
    const r = await routeQuery({ question: "最近7天GMV是多少？" });
    if (r.answer.kind !== "metric") throw new Error("应 为 metric");
    expect(r.answer.metric).toBe("GMV");
    expect(r.answer.value).toBeTruthy();
    expect(r.answer.sql).toContain("SELECT");
    expect(r.answer.sources).toContain("OMS");
  });

  it("CalculationAnswer 带公式与依据", async () => {
    const r = await routeQuery({ question: "ROI是多少？" });
    if (r.answer.kind !== "calculation") throw new Error("应 为 calculation");
    expect(r.answer.metric).toBe("ROI");
    expect(r.answer.formula).toBeTruthy();
    expect(r.answer.evidence.length).toBeGreaterThan(0);
  });

  it("ExecutionAnswer 带操作路径与步骤（Capability KB）", async () => {
    const r = await routeQuery({ question: "如何创建优惠券？" });
    if (r.answer.kind !== "execution") throw new Error("应 为 execution");
    expect(r.answer.system).toBe("CRM");
    expect(r.answer.path).toContain("优惠券中心");
    expect(r.answer.steps.length).toBeGreaterThan(0);
    expect(r.answer.owner).toBeTruthy();
  });

  it("InsightAnswer 复用完整 AnalysisResult（含 governance / evidence）", async () => {
    const r = await routeQuery({ question: "为什么GMV下降？" });
    if (r.answer.kind !== "insight") throw new Error("应 为 insight");
    expect(r.answer.analysis.governance).toBeDefined();
    expect(r.answer.analysis.findings.length + r.answer.analysis.risks.length).toBeGreaterThan(0);
  });

  it("StrategyAnswer 命中策略库并解析能力（Knowledge First）", async () => {
    const r = await routeQuery({ question: "如何提升复购率？" });
    if (r.answer.kind !== "strategy") throw new Error("应 为 strategy");
    expect(r.answer.strategyName).toContain("召回");
    expect(r.answer.capabilities.length).toBeGreaterThan(0);
    expect(r.answer.capabilities.some((c) => c.capability.includes("券") || c.capability.includes("营销"))).toBe(true);
  });

  it("RequirementAnswer 触发 Gap Analysis + PRD（无 Key 时规则兜底）", async () => {
    const r = await routeQuery({ question: "帮我设计一个会员成长体系" });
    if (r.answer.kind !== "requirement") throw new Error("应 为 requirement");
    expect(r.answer.prd).toBeDefined();
    expect(r.answer.prd.featureProposals.length).toBeGreaterThan(0);
  });
});

describe("router · 显式 range 透传", () => {
  it("传入 range=30 影响取数周期", async () => {
    const r = await routeQuery({ question: "GMV是多少？", range: 30 });
    if (r.answer.kind !== "metric") throw new Error("应 为 metric");
    // 30 天口径下 GMV 一定大于 7 天口径（同源递增窗口）
    const r7 = await routeQuery({ question: "GMV是多少？", range: 7 });
    if (r7.answer.kind !== "metric") throw new Error("应 为 metric");
    const parse = (s: string) => Number(s.replace(/[^\d.]/g, "")) * (s.includes("亿") ? 1e8 : s.includes("万") ? 1e4 : 1);
    expect(parse(r.answer.value)).toBeGreaterThanOrEqual(parse(r7.answer.value));
  });
});

describe("router · 成本核算（doc 15 §Cost Monitoring）", () => {
  it("rule 模式零 token：routing.tokensIn / tokensOut = 0", async () => {
    const r = await routeQuery({ question: "最近7天GMV是多少？" });
    expect(r.routing.tokensIn).toBe(0);
    expect(r.routing.tokensOut).toBe(0);
  });

  it("每请求记一次成本事件：totalRequests 递增、rule 模式 llmRequests/tokens=0", async () => {
    await routeQuery({ question: "最近7天GMV是多少？" });
    await routeQuery({ question: "ROI是多少？" });
    const snap = getCostSnapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.llmRequests).toBe(0);
    expect(snap.tokensIn).toBe(0);
    expect(snap.avgCostYuan).toBe(0);
  });
});

describe("router · 缓存（doc 15 P3 Cache First）", () => {
  it("同一问题二次请求命中：routing.cacheHit=true，内容一致", async () => {
    const r1 = await routeQuery({ question: "最近7天GMV是多少？" });
    expect(r1.routing.cacheHit).toBeFalsy();
    const r2 = await routeQuery({ question: "最近7天GMV是多少？" });
    expect(r2.routing.cacheHit).toBe(true);
    if (r1.answer.kind === "metric" && r2.answer.kind === "metric") {
      expect(r2.answer.value).toBe(r1.answer.value);
    }
  });

  it("不同 role → 独立缓存条目（同 role 二次才命中）", async () => {
    await routeQuery({ question: "为什么GMV下降？", role: "CEO" });
    const r2 = await routeQuery({ question: "为什么GMV下降？", role: "CRM_MANAGER" });
    expect(r2.routing.cacheHit).toBeFalsy();
    const r3 = await routeQuery({ question: "为什么GMV下降？", role: "CRM_MANAGER" });
    expect(r3.routing.cacheHit).toBe(true);
  });

  it("缓存命中计入成本计数器 cacheHits", async () => {
    await routeQuery({ question: "ROI是多少？" });
    await routeQuery({ question: "ROI是多少？" });
    const snap = getCostSnapshot();
    expect(snap.cacheHits).toBe(1);
    expect(snap.totalRequests).toBe(2);
  });
});

describe("router · comparison / trend（doc18 V2 · 任意时间与对比）", () => {
  beforeEach(() => {
    resetCache();
    resetCostStore();
  });

  it("时段对比（今天 vs 昨天）→ ComparisonAnswer(time)", async () => {
    const r = await routeQuery({ question: "今天和昨天GMV对比" });
    expect(r.classification.queryType).toBe("comparison");
    expect(r.answer.kind).toBe("comparison");
    if (r.answer.kind === "comparison") {
      expect(r.answer.mode).toBe("time");
      expect(r.answer.baseline?.formatted).toBeTruthy();
      expect(r.answer.comparison?.formatted).toBeTruthy();
      expect(r.answer.delta).toBeTruthy();
      expect(r.cost.tier).toBe("free");
    }
  });

  it("维度对比（企微 vs 小程序）→ ComparisonAnswer(dimension)", async () => {
    const r = await routeQuery({ question: "企业微信和小程序GMV对比" });
    expect(r.answer.kind).toBe("comparison");
    if (r.answer.kind === "comparison") {
      expect(r.answer.mode).toBe("dimension");
      expect(r.answer.channels).toHaveLength(2);
    }
  });

  it("趋势 → TrendAnswer（带走势点 + 摘要）", async () => {
    const r = await routeQuery({ question: "最近30天GMV趋势如何" });
    expect(r.classification.queryType).toBe("trend");
    expect(r.answer.kind).toBe("trend");
    if (r.answer.kind === "trend") {
      expect(r.answer.points.length).toBeGreaterThan(0);
      expect(r.answer.summary).toBeTruthy();
      expect(r.answer.windowLabel).toContain("2026");
    }
  });

  it("自定义区间（2026-06-01 到 06-15）取数", async () => {
    const r = await routeQuery({ question: "2026-06-01到2026-06-15的GMV是多少？" });
    if (r.answer.kind === "metric") {
      expect(r.answer.windowLabel).toContain("2026-06-01");
    } else if (r.answer.kind === "calculation") {
      expect(r.answer.windowLabel).toContain("2026-06-01");
    }
  });

  it("result 带 Date Anchor（最新数据日期，非系统今天）", async () => {
    const r = await routeQuery({ question: "最近7天GMV是多少？" });
    expect(r.anchor).toBe("2026-06-29");
  });
});

/**
 * 仅 OMS 的聚合日表（缺 CRM / Marketing）→ 用于 Missing Data Gate，
 * 同时验证「上传数据进计算链路」：GMV 必须来自此夹具（¥7000）而非内置样本（约 ¥230万）。
 */
const OMS_ONLY: DatasetFile[] = [
  {
    name: "daily_orders.csv",
    columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"],
    rows: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-06-${23 + i}`,
      channel: "TMALL",
      gmv: "1000",
      orders: "10",
      visitors: "300",
      buyers: "9",
    })),
  },
];

describe("router · Missing Data Gate（doc18 §M5 + doc19 §M4，缺数据不产出）", () => {
  beforeEach(() => {
    resetCache();
    resetCostStore();
    resetDatasetStore();
    setUploaded(OMS_ONLY); // 仅识别为 oms → 缺 CRM / Marketing
  });
  afterEach(() => {
    resetDatasetStore(); // 恢复内置样本，避免污染其它用例
  });

  it("缺会员数据时 LTV 查询被拦截 → MissingDataAnswer", async () => {
    const r = await routeQuery({ question: "LTV是多少？" });
    expect(r.answer.kind).toBe("missing_data");
    if (r.answer.kind === "missing_data") {
      expect(r.answer.metric).toMatch(/LTV/);
      expect(r.answer.reason).toContain("会员");
      expect(r.answer.recommendUpload).toContain("CRM");
    }
  });

  it("缺营销成本时 ROI 查询被拦截", async () => {
    const r = await routeQuery({ question: "ROI是多少？" });
    expect(r.answer.kind).toBe("missing_data");
    if (r.answer.kind === "missing_data") {
      expect(r.answer.reason).toContain("营销");
    }
  });

  it("OMS 可分析的指标不被拦截，且 GMV 来自上传数据（非样本）", async () => {
    const r = await routeQuery({ question: "最近7天GMV是多少？" });
    expect(r.answer.kind).toBe("metric");
    if (r.answer.kind === "metric") {
      // 上传夹具 = 7 天 × ¥1000 = ¥7000；内置样本同口径约 ¥230万 —— 断言 7000 即证明已切换为上传数据
      const parse = (s: string) =>
        Number(s.replace(/[^\d.]/g, "")) * (s.includes("亿") ? 1e8 : s.includes("万") ? 1e4 : 1);
      expect(parse(r.answer.value)).toBe(7000);
    }
  });
});
