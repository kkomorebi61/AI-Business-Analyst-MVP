/**
 * Intent Agent —— 识别业务意图
 *
 * 输入：自然语言提问
 * 输出：business_overview | sales_analysis | crm_analysis | scrm_analysis | channel_analysis | risk_analysis
 *
 * 规则：按关键词权重命中；"为什么…下降"类问题映射到对应域并以 risk 倾向。
 */

import type { Intent } from "./types";

const RULES: { intent: Intent; words: string[] }[] = [
  { intent: "scrm_analysis", words: ["企微", "私域", "触达", "好友", "发券", "核销"] },
  { intent: "crm_analysis", words: ["复购", "会员", "ltv", "流失", "留存", "活跃"] },
  { intent: "channel_analysis", words: ["渠道", "天猫", "京东", "小红书", "对比 q"] },
  { intent: "sales_analysis", words: ["gmv", "销售", "订单", "利润", "客单价", "下降", "上升", "为什么"] },
  { intent: "business_overview", words: ["经营", "业务", "表现", "整体", "怎么样", "情况", "本周", "本周业务"] },
];

export interface IntentAgentOutput {
  intent: Intent;
  reason: string;
}

export function intentAgent(question: string): IntentAgentOutput {
  const text = question.toLowerCase();

  // "为什么 X 下降" → 归属对应业务域 + 风险倾向
  const isWhy = text.includes("为什么") || text.includes("原因");
  const isDecline = text.includes("下降") || text.includes("下滑") || text.includes("降低");

  for (const { intent, words } of RULES) {
    if (words.some((w) => text.includes(w))) {
      if (isWhy && isDecline) {
        return {
          intent: "risk_analysis",
          reason: `识别到归因提问（为什么 + 下降），结合命中的${intent}线索定位为风险归因`,
        };
      }
      return { intent, reason: `命中关键词：${intent}` };
    }
  }

  return {
    intent: "business_overview",
    reason: "未命中特定意图，默认经营概览",
  };
}
