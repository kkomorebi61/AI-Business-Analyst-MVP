/**
 * 请求级成本累加器（doc 15 §Cost Monitoring · Token 消耗采集）
 *
 * chat() 是 token 的唯一来源，但一次 routeQuery 可能触发最多 2 次调用
 * （分类器兜底 + handler 叙事）。用请求级累加器贯穿 routeQuery → queryClassifier / handlers，
 * 无全局「当前请求」、无 AsyncLocalStorage —— 纯对象，可被单测直接构造。
 */

import type { ChatUsage, ModelTier } from "./llm-client";
import { estimateCostYuan } from "./pricing";

/** 单次 LLM 调用的 token 计量（含模型名 / 档位，供汇总计价） */
export interface TokenUsage extends ChatUsage {
  model: string;
  tier: ModelTier;
}

export interface CostSummary {
  /** 本次请求触发的 LLM 调用次数（0 / 1 / 2） */
  llmRequests: number;
  tokensIn: number;
  tokensOut: number;
  costYuan: number;
  models: string[];
}

export interface CostAcc {
  readonly calls: ReadonlyArray<TokenUsage>;
  add(u: TokenUsage): void;
  summary(): CostSummary;
}

/** 创建一个请求级累加器（routeQuery 入口处构造） */
export function createCostAcc(): CostAcc {
  const calls: TokenUsage[] = [];
  return {
    get calls() {
      return calls;
    },
    add(u) {
      calls.push(u);
    },
    summary() {
      const tokensIn = calls.reduce((s, c) => s + c.prompt, 0);
      const tokensOut = calls.reduce((s, c) => s + c.completion, 0);
      return {
        llmRequests: calls.length,
        tokensIn,
        tokensOut,
        costYuan: estimateCostYuan(tokensIn, tokensOut),
        models: Array.from(new Set(calls.map((c) => c.model))),
      };
    },
  };
}
