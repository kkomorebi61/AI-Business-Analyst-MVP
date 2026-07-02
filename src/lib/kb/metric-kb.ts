/**
 * 指标知识库（来源：02_Metric_KB.md）
 *
 * 三类知识：
 *  1. ROLE_METRICS    —— 角色 → 关注指标
 *  2. METRIC_SPECS    —— 指标定义 / 相关指标 / 归因拆解规则（X 下降 → 检查 Y）
 *  3. RECOMMENDATIONS —— 问题 → 推荐行动（Insight Agent 调用）
 *
 * 所有 Agent 的"判断"都来自这里，GLM 接入后可替换为模型生成，但知识结构不变。
 */

export type MetricKey =
  | "gmv"
  | "orders"
  | "profit"
  | "aov"
  | "newMembers"
  | "activeMembers"
  | "repurchaseRate"
  | "ltv"
  | "churnRate"
  | "traffic"
  | "ctr"
  | "cvr"
  | "roi";

export interface MetricSpec {
  key: MetricKey;
  name: string; // 中文名
  en: string; // 英文名（KPI 卡片副标题）
  role: Role[];
  definition?: string;
  related?: MetricKey[];
  /** 当该指标异常（下降/上升）时，应顺藤摸瓜检查的下游因子 */
  breakdown?: string[];
}

export type Role = "CEO" | "CRM_MANAGER" | "OPERATION_MANAGER";

/** 角色 → 关注指标（来源：01_Agent_Flow · Metric Agent） */
export const ROLE_METRICS: Record<Role, MetricKey[]> = {
  CEO: ["gmv", "orders", "profit", "aov"],
  CRM_MANAGER: [
    "newMembers",
    "activeMembers",
    "repurchaseRate",
    "ltv",
    "churnRate",
  ],
  OPERATION_MANAGER: ["traffic", "ctr", "cvr", "roi"],
};

export const METRIC_SPECS: Record<MetricKey, MetricSpec> = {
  gmv: {
    key: "gmv",
    name: "GMV",
    en: "Gross Merchandise Value",
    role: ["CEO"],
    definition: "商品交易总额",
    related: ["orders", "aov", "traffic", "cvr"],
    breakdown: ["流量 Traffic", "转化率 CVR", "客单价 AOV"],
  },
  orders: {
    key: "orders",
    name: "订单数",
    en: "Orders",
    role: ["CEO"],
    breakdown: ["流量", "转化率"],
  },
  profit: {
    key: "profit",
    name: "利润",
    en: "Profit",
    role: ["CEO"],
    related: ["gmv"],
    breakdown: ["营销成本占比", "履约/库存成本占比"],
  },
  aov: {
    key: "aov",
    name: "客单价",
    en: "Average Order Value",
    role: ["CEO"],
    breakdown: ["商品结构 / 组合"],
  },
  newMembers: {
    key: "newMembers",
    name: "新增会员",
    en: "New Members",
    role: ["CRM_MANAGER"],
    breakdown: ["获客渠道结构"],
  },
  activeMembers: {
    key: "activeMembers",
    name: "活跃会员",
    en: "Active Members",
    role: ["CRM_MANAGER"],
    breakdown: ["触达频次", "活动参与"],
  },
  repurchaseRate: {
    key: "repurchaseRate",
    name: "复购率",
    en: "Repurchase Rate",
    role: ["CRM_MANAGER"],
    breakdown: ["高价值会员", "活动参与度", "活跃会员"],
  },
  ltv: {
    key: "ltv",
    name: "会员LTV",
    en: "Life-Time Value",
    role: ["CRM_MANAGER"],
    related: ["repurchaseRate", "aov"],
    breakdown: ["复购率", "客单价"],
  },
  churnRate: {
    key: "churnRate",
    name: "流失率",
    en: "Churn Rate",
    role: ["CRM_MANAGER"],
    breakdown: ["触发留存分析"],
  },
  traffic: {
    key: "traffic",
    name: "流量",
    en: "Traffic",
    role: ["OPERATION_MANAGER"],
    breakdown: ["各渠道流量结构"],
  },
  ctr: {
    key: "ctr",
    name: "点击率",
    en: "Click-Through Rate",
    role: ["OPERATION_MANAGER"],
    breakdown: ["素材", "投放人群"],
  },
  cvr: {
    key: "cvr",
    name: "转化率",
    en: "Conversion Rate",
    role: ["OPERATION_MANAGER"],
    breakdown: ["落地页", "商品", "定价"],
  },
  roi: {
    key: "roi",
    name: "ROI",
    en: "Return on Investment",
    role: ["OPERATION_MANAGER"],
    breakdown: ["投放成本", "转化效率"],
  },
};

/** 推荐行动知识（来源：02_Metric_KB 的规则 + 截图中行动建议） */
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
    description: "向 4,200 名沉睡的 A 级会员发送个性化补购优惠，7 天内执行。",
  },
  profit_down: {
    trigger: "profit_down",
    icon: "lightbulb",
    category: "运营",
    investment: "中等投入",
    outcome: "每周 +¥36万 利润",
    title: "重新谈判渠道 B 履约",
    description: "梳理 Top 成本驱动因子，在下次促销前锁定新的 SLA。",
  },
  channel_opportunity: {
    trigger: "channel_opportunity",
    icon: "megaphone",
    category: "增长",
    investment: "低投入",
    outcome: "订单 +8%",
    title: "加码京东组合营销",
    description: "把表现不佳渠道的 15% 预算转入转化率 3.4% 的京东组合创意。",
  },
};
