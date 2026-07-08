/**
 * Prompt Template —— doc 15 Principle 4 / Template First
 *
 * 标准问题优先模板化：周报 / 月报 / 经营汇报 / 活动复盘 等高频生成走
 * 「Prompt Template + 变量填充」，避免每次自由生成（降 Token + 提一致性）。
 *
 * 用法：
 *   const { system, user } = fillTemplate("insightNarrative", { question, kpiDigest, findingDigest });
 *   await chat({ system, messages: [{ role: "user", content: user }] });
 *
 * 三个 handler 叙事模板（insightNarrative / strategyNarrative / requirementPrd）
 * 与原内联 prompt 逐字等价 —— 抽取即重构，不改可观测行为。
 */

export type TemplateName =
  // 已接入 handler（从 router.ts 内联 prompt 抽取）
  | "insightNarrative"
  | "strategyNarrative"
  | "requirementPrd"
  // doc 15 P4 报告模板（数据 + 变量填充，供未来报告生成面复用）
  | "weeklyReport"
  | "monthlyReport"
  | "businessReview"
  | "campaignRetrospective";

export interface PromptTemplate {
  name: TemplateName;
  system: string;
  user: string;
  /** 必需变量名；缺失时 fillTemplate 抛错（ fail-fast，避免静默产出残缺文案） */
  vars: readonly string[];
}

export const TEMPLATES: Record<TemplateName, PromptTemplate> = {
  /* -------- handler 叙事（抽取自 router.ts，逐字等价） -------- */
  insightNarrative: {
    name: "insightNarrative",
    system:
      "你是经营分析师。基于给定的指标与发现，用 2-3 句中文给出洞察叙事（结论先行 + 关键风险 + 一个行动方向）。不要罗列数字。",
    user: "问题：{{question}}\n指标：{{kpiDigest}}\n发现：{{findingDigest}}",
    vars: ["question", "kpiDigest", "findingDigest"],
  },
  strategyNarrative: {
    name: "strategyNarrative",
    system:
      "你是经营策略顾问。基于给定策略与能力，用 3-4 句中文输出可执行建议（策略→人群→渠道→预期），口语化、可直接转达业务方。",
    user:
      "问题：{{question}}\n策略：{{strategyName}}\n人群：{{targetAudience}}\n渠道：{{channel}}\n能力：{{capabilities}}",
    vars: ["question", "strategyName", "targetAudience", "channel", "capabilities"],
  },
  requirementPrd: {
    name: "requirementPrd",
    system:
      "你是产品经理。基于业务诉求与能力缺口，输出 JSON：{ \"businessValue\": \"\", \"featureProposals\": [\"\"], \"designOutline\": [\"\"] }。" +
      "businessValue 一句话业务价值；featureProposals 3-5 个功能点；designOutline 3-5 条设计要点。仅输出 JSON。",
    user: "诉求：{{question}}\n能力缺口：{{gaps}}\n相关能力：{{matched}}",
    vars: ["question", "gaps", "matched"],
  },

  /* -------- doc 15 P4 报告模板（变量填充，降 Token + 一致性） -------- */
  weeklyReport: {
    name: "weeklyReport",
    system:
      "你是经营分析师。按周报模板输出结构化经营周报：总览→关键指标→亮点与风险→下周关注。基于给定变量填充，不要自由发挥指标口径。",
    user:
      "周期：{{range}}\nGMV：{{gmv}}\n订单数：{{orders}}\n核心亮点：{{highlights}}\n核心风险：{{risks}}",
    vars: ["range", "gmv", "orders", "highlights", "risks"],
  },
  monthlyReport: {
    name: "monthlyReport",
    system:
      "你是经营分析师。按月报模板输出经营月报：月度总览→环比表现→归因→下月策略。严格基于给定变量，口径与指标库一致。",
    user:
      "月份：{{month}}\nGMV：{{gmv}}\n环比：{{mom}}\n关键风险：{{keyRisks}}\n下月重点：{{nextFocus}}",
    vars: ["month", "gmv", "mom", "keyRisks", "nextFocus"],
  },
  businessReview: {
    name: "businessReview",
    system:
      "你是经营分析师。按经营汇报模板输出：本期结论→达成项→未达成项→风险→下期行动。结论先行，数字引自给定变量。",
    user:
      "汇报周期：{{period}}\n总体结论：{{summary}}\n达成项：{{wins}}\n未达成项：{{misses}}\n风险：{{risks}}\n下期行动：{{nextSteps}}",
    vars: ["period", "summary", "wins", "misses", "risks", "nextSteps"],
  },
  campaignRetrospective: {
    name: "campaignRetrospective",
    system:
      "你是营销分析师。按活动复盘模板输出：活动概述→效果指标→归因→经验沉淀→下次优化。基于给定变量，不杜撰数据。",
    user:
      "活动名称：{{campaign}}\n活动 GMV：{{gmv}}\nROI：{{roi}}\n关键经验：{{learnings}}\n下次优化方向：{{improvements}}",
    vars: ["campaign", "gmv", "roi", "learnings", "improvements"],
  },
};

/** 变量值：字符串（数组由调用方先 join，保证模板纯文本替换、可测试） */
export type TemplateVars = Record<string, string>;

/**
 * 用变量填充模板（doc 15 P4：Prompt Template + 变量填充）。
 *  - 缺失必需 var → 抛错（避免静默产出残缺文案）
 *  - 多余 var → 忽略（容忍）
 *  - 返回 { system, user }，直接喂给 chat()
 */
export function fillTemplate(
  name: TemplateName,
  vars: TemplateVars,
): { system: string; user: string } {
  const tpl = TEMPLATES[name];
  const missing = tpl.vars.filter((v) => !(v in vars) || vars[v] === undefined);
  if (missing.length) {
    throw new Error(`fillTemplate(${name}) 缺失变量：${missing.join(", ")}`);
  }
  const subst = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (m, key: string) => vars[key] ?? m);
  return { system: tpl.system, user: subst(tpl.user) };
}
