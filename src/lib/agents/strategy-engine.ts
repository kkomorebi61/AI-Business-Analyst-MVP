/**
 * Strategy Engine —— 经营策略引擎（doc 17_AI_Strategy_Engine V1.0）
 *
 * 职责（doc 17 §Strategy Engine）：发现问题后，自动推荐最优经营策略。
 *   负责：决策建议（Strategy → Audience → Channel → Expected Result → Capability Mapping）
 *   不负责：执行 / 系统操作（交给 Execution Agent + Capability KB）
 *
 * 标准策略框架（doc 17 §Strategy Framework）：
 *   Problem → Root Cause → Strategy → Target Audience → Channel
 *          → Expected Result → Capability Mapping
 *
 * 零售策略库（doc 17 §Retail Strategy Library，6 个场景 verbatim）。
 *
 * 设计原则：纯规则匹配（doc 15 Rule First / Knowledge First）。
 *           Strategy Engine 先用规则库命中策略 + Capability KB 解析能力；
 *           仅在需要自然语言叙事时调用 GLM（doc 18 Strategy Query 链路）。
 */

import { CAPABILITY_BY_ID, type Capability } from "@/lib/kb/capability-kb";

export interface StrategyScenario {
  id: string;
  /** 业务问题（doc 17 §Business Problem） */
  problem: string;
  /** 触发关键词（自然语言 → 场景匹配） */
  triggerKeywords: string[];
  /** 触发条件（doc 17 §Trigger） */
  triggerCondition: string;
  /** 根因（doc 17 §Root Cause） */
  rootCause: string[];
  /** 推荐策略（doc 17 §Recommended Strategy） */
  strategy: string;
  /** 目标人群（doc 17 §Target Audience） */
  targetAudience: string[];
  /** 推荐渠道（doc 17 §Channel） */
  channel: string[];
  /** 优惠 / 权益 */
  offer: string[];
  /** 预期结果（doc 17 §Expected Result） */
  expectedResult: string[];
  /** 能力映射：已落库的能力 id（doc 17 §Capability Mapping） */
  capabilityIds: string[];
  /** 能力映射：策略需要但能力库尚未覆盖的项（→ 缺口，doc 16 Rule 3） */
  capabilityGaps: string[];
}

/* ------------------------------------------------------------------ *
 * 零售策略库（doc 17 §Retail Strategy Library，6 场景 verbatim）
 * ------------------------------------------------------------------ */

const SCENARIOS: StrategyScenario[] = [
  {
    id: "S1_repurchase_decrease",
    problem: "复购率下降",
    triggerKeywords: ["复购率", "复购", "回购", "复购下降", "复购率下降"],
    triggerCondition: "30天复购率下降 > 10%",
    rootCause: ["沉睡会员增加", "触达减少", "优惠吸引力下降", "竞争活动增加"],
    strategy: "会员召回计划",
    targetAudience: ["60天未购买会员", "90天未购买会员", "高价值沉睡会员"],
    channel: ["企业微信", "短信", "App Push"],
    offer: ["满300减50", "专属补购优惠"],
    expectedResult: ["复购率提升 3%-5%", "GMV 增长", "LTV 增长"],
    capabilityIds: ["CRM_TAG_001", "CRM_MARKETING_001", "CRM_MARKETING_002", "SCRM_TOUCH_001"],
    capabilityGaps: [],
  },
  {
    id: "S2_member_growth_slowdown",
    problem: "会员增长放缓",
    triggerKeywords: ["会员增长", "新增会员", "拉新", "增长放缓", "获客", "新增下降"],
    triggerCondition: "新增会员下降 > 15%",
    rootCause: ["拉新渠道枯竭", "激励力度不足", "注册转化低"],
    strategy: "拉新裂变 / 邀请有礼",
    targetAudience: ["潜在用户", "老会员"],
    channel: ["小程序", "企业微信", "社交媒体"],
    offer: ["邀请有礼", "会员注册奖励"],
    expectedResult: ["新增会员回升", "拉新成本下降"],
    capabilityIds: ["CRM_MEMBER_001", "CRM_MARKETING_002"],
    capabilityGaps: ["邀请裂变（老带新）", "积分中心"], // doc 17 列出但能力库未覆盖 → 缺口
  },
  {
    id: "S3_churn_increase",
    problem: "会员流失增加",
    triggerKeywords: ["流失", "流失率", "流失增加", "会员流失", "留存"],
    triggerCondition: "流失会员增长 > 20%",
    rootCause: ["缺乏关怀", "权益感知弱", "竞品分流"],
    strategy: "流失预警计划 / 会员关怀活动",
    targetAudience: ["高价值会员", "VIP 会员"],
    channel: ["企业微信", "短信"],
    offer: ["专属优惠", "生日关怀"],
    expectedResult: ["流失率回落", "高价值会员留存提升"],
    capabilityIds: ["CRM_TAG_001", "CRM_MARKETING_003", "CRM_MARKETING_002", "SCRM_TOUCH_001"],
    capabilityGaps: [],
  },
  {
    id: "S4_aov_decrease",
    problem: "客单价下降",
    triggerKeywords: ["客单价", "客单", "件单价", "客单价下降", "AOV"],
    triggerCondition: "客单价环比下降",
    rootCause: ["商品结构变化", "促销拉低单价", "组合推荐缺失"],
    strategy: "组合购 / 加价购 / 套餐推荐",
    targetAudience: ["全部成交会员"],
    channel: ["APP", "小程序", "门店"],
    offer: ["组合购优惠", "加价购权益", "会员专属权益"],
    expectedResult: ["客单价提升", "连带率提升"],
    capabilityIds: ["CRM_MARKETING_001", "CRM_MARKETING_002"],
    capabilityGaps: ["商品推荐引擎", "套餐/组合购引擎"],
  },
  {
    id: "S5_vip_contribution_decrease",
    problem: "VIP 贡献下降",
    triggerKeywords: ["VIP", "VIP贡献", "高价值会员贡献", "会员日"],
    triggerCondition: "VIP 贡献占比下降",
    rootCause: ["权益同质化", "缺乏专属活动", "高端货品供给不足"],
    strategy: "VIP 专属活动 / 会员日",
    targetAudience: ["VIP 会员", "高价值会员"],
    channel: ["企业微信", "门店"],
    offer: ["高端权益", "积分兑换", "会员日专属"],
    expectedResult: ["VIP 复购提升", "VIP GMV 占比回升"],
    capabilityIds: ["CRM_MEMBER_002", "CRM_MARKETING_001"],
    capabilityGaps: ["积分中心"],
  },
  {
    id: "S6_scrm_engagement_decline",
    problem: "企微触达率下降",
    triggerKeywords: ["企微触达", "触达率", "企微", "触达下降", "社群"],
    triggerCondition: "企微触达率环比下降",
    rootCause: ["导购执行弱", "内容质量低", "触达频次不当"],
    strategy: "导购任务激励 / 企微内容优化 / 社群运营",
    targetAudience: ["企微好友", "导购"],
    channel: ["企业微信"],
    offer: ["导购激励", "自动提醒"],
    expectedResult: ["触达率回升", "企微成交率提升"],
    capabilityIds: ["SCRM_WECHAT_001", "SCRM_TOUCH_001", "SCRM_TASK_001"],
    capabilityGaps: ["导购助手 / 智能话术"],
  },
];

/* ------------------------------------------------------------------ *
 * 策略匹配（Rule First）
 * ------------------------------------------------------------------ */

export interface StrategyMatch {
  scenario: StrategyScenario;
  hitKeywords: string[];
  score: number;
}

/** 问题 → 最佳策略场景（关键词加权） */
export function matchStrategy(question: string): StrategyMatch | null {
  const q = question.toLowerCase();
  let best: StrategyMatch | null = null;

  for (const sc of SCENARIOS) {
    const hits = sc.triggerKeywords.filter((k) => q.includes(k.toLowerCase()));
    if (hits.length === 0) continue;
    // 问题名完整命中加权
    const score = hits.length + (q.includes(sc.problem) ? 2 : 0);
    if (!best || score > best.score) best = { scenario: sc, hitKeywords: hits, score };
  }

  return best;
}

/* ------------------------------------------------------------------ *
 * 策略产出（含能力解析 + 缺口）
 * ------------------------------------------------------------------ */

export interface ResolvedCapability {
  system: string;
  module: string;
  capability: string;
  path: string;
}

export interface StrategyPayload {
  strategyName: string;
  businessObjective: string;
  problem: string;
  rootCause: string[];
  targetAudience: string[];
  channel: string[];
  offer: string[];
  expectedResult: string[];
  /** 已落库的能力（从 capabilityIds 解析，doc 17 §Capability Mapping） */
  capabilities: ResolvedCapability[];
  /** 策略需要但能力库未覆盖（→ Gap，供 Requirement Query） */
  capabilityGaps: string[];
  /** 触发条件（可解释） */
  triggerCondition: string;
  /** 未命中策略库时的兜底标记 */
  fallback: boolean;
}

/**
 * 策略引擎主入口：问题 → 策略 + 能力映射。
 * 命中策略库 → 返回结构化策略（能力从 Capability KB 解析）；
 * 未命中 → 返回兜底「待人工评估」策略（fallback=true）。
 */
export function strategyEngine(question: string): StrategyPayload {
  const match = matchStrategy(question);

  if (!match) {
    return {
      strategyName: "待评估（无历史策略命中）",
      businessObjective: "需结合数据与业务进一步诊断，沉淀为新策略",
      problem: question,
      rootCause: ["当前策略库未覆盖该问题，建议先做 Insight 归因"],
      targetAudience: [],
      channel: [],
      offer: [],
      expectedResult: [],
      capabilities: [],
      capabilityGaps: [],
      triggerCondition: "—",
      fallback: true,
    };
  }

  const sc = match.scenario;
  const capabilities = resolveCapabilities(sc.capabilityIds);
  const objective = sc.expectedResult[0] ?? sc.strategy;

  return {
    strategyName: sc.strategy,
    businessObjective: objective,
    problem: sc.problem,
    rootCause: sc.rootCause,
    targetAudience: sc.targetAudience,
    channel: sc.channel,
    offer: sc.offer,
    expectedResult: sc.expectedResult,
    capabilities,
    capabilityGaps: sc.capabilityGaps,
    triggerCondition: sc.triggerCondition,
    fallback: false,
  };
}

/** capabilityIds → 能力详情（关联 Capability KB） */
function resolveCapabilities(ids: string[]): ResolvedCapability[] {
  return ids
    .map((id) => CAPABILITY_BY_ID[id])
    .filter((c): c is Capability => Boolean(c))
    .map((c) => ({
      system: c.system,
      module: c.module,
      capability: c.capability,
      path: c.path.join(" > "),
    }));
}

/** 暴露策略库（供文档 / 测试 / 未来策略管理页使用） */
export const STRATEGY_LIBRARY: StrategyScenario[] = SCENARIOS;
