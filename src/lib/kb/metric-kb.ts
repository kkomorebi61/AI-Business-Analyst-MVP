/**
 * 指标知识库 V2（来源：02_Metric_KB.md（更新版） + 05 Mock Data + 10 Data Trust）
 *
 * V2 每个指标都补齐企业级元数据：
 *   definition / business_meaning / formula / data_source / owner /
 *   update_frequency / related_metrics / analysis_rules / lineage
 *
 * 三类知识：
 *  1. ROLE_METRICS    —— 角色 → 关注指标
 *  2. METRIC_SPECS    —— 指标元数据（V2 标准）+ 归因拆解
 *  3. RECOMMENDATIONS —— 问题 → 推荐行动（Insight Agent 调用）
 *
 * 决策（§4.1 #3 / 方案 A）：数据集中无 profit 字段，profit 不作可计算 KPI；
 * 「为什么利润下降」归入 Query Governance 的 Class B 部分回答，不虚构。
 * CEO 关注指标改为 GMV / Orders / AOV / Conversion + ROI（全部有数据来源）。
 */

export type MetricKey =
  | "gmv"
  | "orders"
  | "aov"
  | "conversion"
  | "refundRate"
  | "newMembers"
  | "activeMembers"
  | "repurchaseRate"
  | "ltv"
  | "churnRate"
  | "vipMembers"
  | "roi";

export type Role = "CEO" | "CRM_MANAGER" | "OPERATION_MANAGER";

export interface MetricSpec {
  key: MetricKey;
  name: string; // 中文名
  en: string; // 英文名（KPI 卡片副标题）
  role: Role[];
  definition: string;
  business_meaning: string;
  formula: string;
  data_source: string; // OMS / CRM / CDP / Marketing Platform ...
  owner: string;
  update_frequency: string;
  related_metrics: MetricKey[];
  analysis_rules: string;
  /** 当该指标异常（下降/上升）时，应顺藤摸瓜检查的下游因子 */
  breakdown?: string[];
  /** 数据血缘：指标 → 事实表 → 源系统 → 数仓 → AI 分析 */
  lineage?: string[];
}

/** 角色 → 关注指标（来源：01_Agent_Flow · Metric Agent + 08 Master Prompt） */
export const ROLE_METRICS: Record<Role, MetricKey[]> = {
  CEO: ["gmv", "orders", "aov", "conversion", "roi"],
  CRM_MANAGER: [
    "newMembers",
    "activeMembers",
    "repurchaseRate",
    "ltv",
    "churnRate",
    "vipMembers",
  ],
  OPERATION_MANAGER: ["roi", "conversion", "refundRate"],
};

export const METRIC_SPECS: Record<MetricKey, MetricSpec> = {
  gmv: {
    key: "gmv",
    name: "GMV",
    en: "Gross Merchandise Value",
    role: ["CEO"],
    definition: "成交订单金额总和",
    business_meaning: "衡量整体销售规模",
    formula: "SUM(order_amount)",
    data_source: "OMS",
    owner: "电商团队",
    update_frequency: "每日",
    related_metrics: ["orders", "aov", "conversion"],
    analysis_rules: "周环比增长低于 5% 触发预警",
    breakdown: ["流量", "转化率", "客单价"],
    lineage: ["GMV", "订单事实表", "OMS", "数据仓库", "AI 分析"],
  },
  orders: {
    key: "orders",
    name: "订单数",
    en: "Orders",
    role: ["CEO"],
    definition: "成交订单笔数",
    business_meaning: "衡量交易笔数与规模",
    formula: "COUNT(order_id)",
    data_source: "OMS",
    owner: "电商团队",
    update_frequency: "每日",
    related_metrics: ["gmv", "aov", "conversion"],
    analysis_rules: "环比异常波动 > 20% 需排查",
    breakdown: ["流量", "转化率"],
    lineage: ["订单事实表", "OMS", "数据仓库", "AI 分析"],
  },
  aov: {
    key: "aov",
    name: "客单价",
    en: "Average Order Value",
    role: ["CEO"],
    definition: "平均每笔订单金额",
    business_meaning: "衡量客单购买力与商品结构",
    formula: "GMV / Orders",
    data_source: "OMS",
    owner: "电商团队",
    update_frequency: "每日",
    related_metrics: ["gmv", "orders"],
    analysis_rules: "连续下降需关注商品结构 / 组合",
    breakdown: ["商品结构 / 组合"],
    lineage: ["GMV/订单", "订单事实表", "OMS", "数据仓库", "AI 分析"],
  },
  conversion: {
    key: "conversion",
    name: "转化率",
    en: "Conversion Rate",
    role: ["CEO", "OPERATION_MANAGER"],
    definition: "成交订单数 / 访客数（近似）",
    business_meaning: "衡量流量到成交的转化效率",
    formula: "Orders / Traffic",
    data_source: "OMS + CDP",
    owner: "运营团队",
    update_frequency: "每日",
    related_metrics: ["gmv", "orders"],
    analysis_rules: "环比下降 > 1pp 排查落地页 / 商品 / 定价",
    breakdown: ["落地页", "商品", "定价"],
    lineage: ["转化率", "行为日志", "CDP", "OMS", "数据仓库", "AI 分析"],
  },
  refundRate: {
    key: "refundRate",
    name: "退款率",
    en: "Refund Rate",
    role: ["OPERATION_MANAGER"],
    definition: "退款订单金额占 GMV 比例",
    business_meaning: "衡量履约与商品质量风险",
    formula: "refund_amount / GMV",
    data_source: "OMS",
    owner: "客服 / 电商团队",
    update_frequency: "每日",
    related_metrics: ["gmv"],
    analysis_rules: "环比上升 > 0.5pp 触发品控 / 履约排查",
    breakdown: ["商品质量", "履约时效", "库存缺货"],
    lineage: ["退款单", "OMS", "数据仓库", "AI 分析"],
  },
  newMembers: {
    key: "newMembers",
    name: "新增会员",
    en: "New Members",
    role: ["CRM_MANAGER"],
    definition: "周期内新增会员数",
    business_meaning: "衡量获客能力",
    formula: "COUNT(new_member_id)",
    data_source: "CRM",
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["activeMembers"],
    analysis_rules: "环比下降需检查获客渠道结构",
    breakdown: ["获客渠道结构"],
    lineage: ["会员注册", "CRM", "数据仓库", "AI 分析"],
  },
  activeMembers: {
    key: "activeMembers",
    name: "活跃会员",
    en: "Active Members",
    role: ["CRM_MANAGER"],
    definition: "周期内有行为的活跃会员数",
    business_meaning: "衡量会员盘子的活跃度",
    formula: "COUNT(active_member_id)",
    data_source: "CRM + CDP",
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["newMembers", "repurchaseRate"],
    analysis_rules: "下降需排查触达频次 / 活动参与",
    breakdown: ["触达频次", "活动参与"],
    lineage: ["会员行为", "CDP", "CRM", "数据仓库", "AI 分析"],
  },
  repurchaseRate: {
    key: "repurchaseRate",
    name: "复购率",
    en: "Repurchase Rate",
    role: ["CRM_MANAGER"],
    definition: "30 天内再次购买用户占比",
    business_meaning: "衡量会员忠诚度",
    formula: "repeat_buyers / buyers",
    data_source: "CRM",
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["ltv", "activeMembers"],
    analysis_rules: "连续下降 7 天触发复购归因分析",
    breakdown: ["高价值会员", "活动参与度", "触达"],
    lineage: ["复购率", "会员订单事实表", "CRM", "数据仓库", "AI 分析"],
  },
  ltv: {
    key: "ltv",
    name: "会员LTV",
    en: "Life-Time Value",
    role: ["CRM_MANAGER"],
    definition: "会员生命周期价值",
    business_meaning: "衡量会员长期价值",
    formula: "AOV × 购买频次 × 生命周期",
    data_source: "CRM",
    owner: "CRM 团队",
    update_frequency: "每周",
    related_metrics: ["repurchaseRate", "aov"],
    analysis_rules: "LTV 下行需结合复购 / 客单价拆解",
    breakdown: ["复购率", "客单价"],
    lineage: ["会员订单", "CRM", "数据仓库", "AI 分析"],
  },
  churnRate: {
    key: "churnRate",
    name: "流失率",
    en: "Churn Rate",
    role: ["CRM_MANAGER"],
    definition: "周期内流失会员占比",
    business_meaning: "衡量会员流失风险",
    formula: "churned_members / total_members",
    data_source: "CRM",
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["repurchaseRate", "activeMembers"],
    analysis_rules: "环比上升触发留存分析",
    breakdown: ["触发留存分析"],
    lineage: ["会员状态", "CRM", "数据仓库", "AI 分析"],
  },
  vipMembers: {
    key: "vipMembers",
    name: "VIP会员",
    en: "VIP Members",
    role: ["CRM_MANAGER"],
    definition: "高价值（VIP）会员数",
    business_meaning: "衡量高价值会员盘子规模",
    formula: "COUNT(vip_member_id)",
    data_source: "CRM",
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["repurchaseRate", "ltv"],
    analysis_rules: "VIP GMV / 复购走弱需重点关注",
    breakdown: ["VIP 分层 GMV", "VIP 复购"],
    lineage: ["会员分层", "CRM", "数据仓库", "AI 分析"],
  },
  roi: {
    key: "roi",
    name: "ROI",
    en: "Return on Investment",
    role: ["CEO", "OPERATION_MANAGER"],
    definition: "营销投入产出比",
    business_meaning: "衡量营销投放效率",
    formula: "campaign_gmv / campaign_cost",
    data_source: "Marketing Platform + OMS",
    owner: "营销团队",
    update_frequency: "每日",
    related_metrics: ["gmv"],
    analysis_rules: "ROI < 1 触发预警；连续下滑需复盘投放",
    breakdown: ["投放成本", "转化效率"],
    lineage: ["ROI", "营销活动表", "Marketing Platform", "OMS", "数据仓库", "AI 分析"],
  },
};

/** 推荐行动知识（来源：02_Metric_KB 规则 + 截图行动建议，V2 对齐数据驱动触发） */
export interface RecommendationRule {
  trigger: string; // 触发场景标识
  icon: string;
  category: string;
  investment: "低投入" | "中等投入" | "高投入";
  outcome: string;
  title: string;
  description: string;
}

export const RECOMMENDATIONS: Record<string, RecommendationRule> = {
  repurchase_down: {
    trigger: "repurchase_down",
    icon: "target",
    category: "CRM",
    investment: "低投入",
    outcome: "+¥210万 GMV",
    title: "重新激活 A 级会员",
    description: "向沉睡的 A 级 / VIP 会员发送个性化补购优惠，结合近期会员活动精准触达。",
  },
  refund_up: {
    trigger: "refund_up",
    icon: "shield",
    category: "履约",
    investment: "中等投入",
    outcome: "退款率 -0.5pp",
    title: "排查退款抬升品类",
    description: "定位退款率上升的品类与履约环节，优先补货畅销品、修复履约时效。",
  },
  channel_opportunity: {
    trigger: "channel_opportunity",
    icon: "megaphone",
    category: "增长",
    investment: "低投入",
    outcome: "订单 +8%",
    title: "加码高转化渠道",
    description: "把低 ROI 渠道的部分预算转入转化率更高的渠道组合，提升整体营销 ROI。",
  },
  roi_low: {
    trigger: "roi_low",
    icon: "lightbulb",
    category: "运营",
    investment: "低投入",
    outcome: "ROI +0.3",
    title: "优化投放结构",
    description: "复盘各渠道投产比，削减 ROI<1 的投放，向高投产组合倾斜预算。",
  },
};
