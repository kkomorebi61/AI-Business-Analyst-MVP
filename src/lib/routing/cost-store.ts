/**
 * 成本计数器（doc 15 §Cost Monitoring）—— 进程级聚合，供 /api/cost 与成本中心展示。
 *
 * 5 指标：请求量 / Token 消耗 / 缓存命中率 / 模型调用率 / 平均成本
 * 4 目标：缓存命中率>60% · 知识复用率>50% · LLM 调用率<30% · 单问平均成本<¥0.05
 *
 * globalThis guard：Next dev HMR 下保留单例（本仓库首次引入该模式）；
 * 测试用 resetCostStore() 清零。
 */

import { estimateCostYuan } from "@/lib/agents/pricing";

export interface CostCounters {
  /** 总请求数（含缓存命中） */
  totalRequests: number;
  /** 缓存命中数 */
  cacheHits: number;
  /** 触发过 LLM 的请求数 */
  llmRequests: number;
  tokensIn: number;
  tokensOut: number;
  costYuan: number;
}

/** doc 15 §Cost Monitoring 目标 */
export const COST_TARGETS = {
  cacheHitRate: 0.6,
  knowledgeReuseRate: 0.5,
  llmUsageRate: 0.3,
  avgCostYuan: 0.05,
} as const;

export interface CostSnapshot extends CostCounters {
  cacheHitRate: number;
  /** 知识复用率代理 = 未触发 LLM 的请求占比（rule/SQL/KB/缓存命中均计为复用） */
  knowledgeReuseRate: number;
  llmUsageRate: number;
  avgCostYuan: number;
  targets: typeof COST_TARGETS;
}

function fresh(): CostCounters {
  return { totalRequests: 0, cacheHits: 0, llmRequests: 0, tokensIn: 0, tokensOut: 0, costYuan: 0 };
}

const g = globalThis as unknown as { __ANALYST_COST__?: CostCounters };
g.__ANALYST_COST__ ??= fresh();
const C = g.__ANALYST_COST__!;

/** routeQuery 末尾调用一次，记录本次请求的成本事件 */
export function recordRequest(c: {
  cacheHit: boolean;
  /** 本次请求触发的 LLM 调用数（0/1/2） */
  llmRequests: number;
  tokensIn: number;
  tokensOut: number;
}): void {
  C.totalRequests += 1;
  if (c.cacheHit) C.cacheHits += 1;
  if (c.llmRequests > 0) C.llmRequests += 1;
  C.tokensIn += c.tokensIn;
  C.tokensOut += c.tokensOut;
  C.costYuan += estimateCostYuan(c.tokensIn, c.tokensOut);
}

export function getCostSnapshot(): CostSnapshot {
  const total = C.totalRequests || 1; // 无请求时避免除零，比率显示 0
  return {
    ...C,
    cacheHitRate: C.cacheHits / total,
    knowledgeReuseRate: (C.totalRequests - C.llmRequests) / total,
    llmUsageRate: C.llmRequests / total,
    avgCostYuan: C.costYuan / total,
    targets: COST_TARGETS,
  };
}

/** 测试用：清零计数器 */
export function resetCostStore(): void {
  Object.assign(C, fresh());
}
