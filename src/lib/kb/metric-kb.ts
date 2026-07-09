/**
 * 指标知识库 V3（来源：02_Metric_KB（更新版） + 02A_Business_Metric_Dictionary +
 * 05 Mock Data + 10 Data Trust + 11 Query_Governance §6 Metric Mapping）
 *
 * V3 每个指标都补齐企业级可解释性（Explainability）元数据，对齐 02A 字典标准：
 *   metric_name / display_name / definition / business_meaning / formula /
 *   included_scope / excluded_scope / time_window / data_source / owner /
 *   update_frequency / related_metrics / analysis_rules / lineage / aliases / example
 *
 * 三类知识：
 *  1. ROLE_METRICS    —— 角色 → 关注指标
 *  2. METRIC_SPECS    —— 指标元数据（V3 标准）+ 归因拆解
 *  3. RECOMMENDATIONS —— 问题 → 推荐行动（Insight Agent 调用）
 *
 * 辅助：ALL_METRICS / searchMetrics / resolveMetricKey（供 Metric Definition Center
 * 与 Insight「该指标如何计算」入口使用）。
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
  | "totalMembers"
  | "roi"
  | "reachRate"
  | "replyRate"
  | "scrmConversion"
  | "couponRedemption"
  | "totalFriends"
  | "newFriends";

export type Role = "CEO" | "CRM_MANAGER" | "OPERATION_MANAGER";

export interface MetricSpec {
  key: MetricKey;
  metric_name: string; // 机器名（02A · Metric Name，如 gmv）
  name: string; // 中文名（Display Name）
  en: string; // 英文名（KPI 卡片副标题）
  role: Role[];
  definition: string; // 定义
  business_meaning: string; // 业务意义
  formula: string; // 公式
  /** 包含范围（02A · Included Scope） */
  included_scope: string[];
  /** 排除范围（02A · Excluded Scope） */
  excluded_scope: string[];
  /** 统计周期（02A · Time Window） */
  time_window: string[];
  data_source: string; // 展示用：OMS / CRM / CDP / Marketing Platform ...
  /** 规范化的源系统名（对齐 07_data_sources 注册表，用于计算 Data Trust） */
  source_keys: string[];
  owner: string;
  update_frequency: string; // 02A · Update Frequency
  related_metrics: MetricKey[];
  analysis_rules: string;
  /** 自然语言别名（11_Query_Governance §6 Metric Mapping：销售额→GMV） */
  aliases: string[];
  /** 示例取值（02A · Example） */
  example: string;
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
    "totalMembers",
    "reachRate",
    "replyRate",
    "scrmConversion",
    "couponRedemption",
    "totalFriends",
    "newFriends",
  ],
  OPERATION_MANAGER: ["roi", "conversion", "refundRate"],
};

export const METRIC_SPECS: Record<MetricKey, MetricSpec> = {
  gmv: {
    key: "gmv",
    metric_name: "gmv",
    name: "GMV",
    en: "Gross Merchandise Value",
    role: ["CEO"],
    definition: "统计周期内所有已支付订单金额总和",
    business_meaning: "衡量整体销售规模",
    formula: "SUM(paid_order_amount)",
    included_scope: ["已支付订单", "活动订单", "优惠券订单"],
    excluded_scope: ["已取消订单", "已退款订单", "测试订单"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "OMS",
    source_keys: ["OMS"],
    owner: "电商团队",
    update_frequency: "15分钟",
    related_metrics: ["orders", "aov", "conversion"],
    analysis_rules: "周环比增长低于 5% 触发预警",
    aliases: ["销售额", "成交额", "GMV", "营业额"],
    example: "最近7天 GMV ≈ ¥230万",
    breakdown: ["流量", "转化率", "客单价"],
    lineage: ["GMV", "订单事实表", "OMS", "数据仓库", "AI 分析"],
  },
  orders: {
    key: "orders",
    metric_name: "orders",
    name: "订单数",
    en: "Orders",
    role: ["CEO"],
    definition: "统计周期内有效订单数量",
    business_meaning: "衡量交易笔数与规模",
    formula: "COUNT(valid_order)",
    included_scope: ["已支付的有效订单"],
    excluded_scope: ["已取消订单", "已退款订单", "测试订单"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "OMS",
    source_keys: ["OMS"],
    owner: "电商团队",
    update_frequency: "15分钟",
    related_metrics: ["gmv", "aov", "conversion"],
    analysis_rules: "环比异常波动 > 20% 需排查",
    aliases: ["订单量", "订单数", "成交单数"],
    example: "最近7天订单 ≈ 12,400 单",
    breakdown: ["流量", "转化率"],
    lineage: ["订单事实表", "OMS", "数据仓库", "AI 分析"],
  },
  aov: {
    key: "aov",
    metric_name: "aov",
    name: "客单价",
    en: "Average Order Value",
    role: ["CEO"],
    definition: "平均每笔已支付订单金额",
    business_meaning: "衡量客单购买力与商品结构",
    formula: "GMV / Orders",
    included_scope: ["已支付订单"],
    excluded_scope: ["已取消订单", "已退款订单"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "OMS",
    source_keys: ["OMS"],
    owner: "电商团队",
    update_frequency: "15分钟",
    related_metrics: ["gmv", "orders"],
    analysis_rules: "连续下降需关注商品结构 / 组合",
    aliases: ["客单价", "平均订单价值", "AOV", "件单价"],
    example: "客单价 ≈ ¥185",
    breakdown: ["商品结构 / 组合"],
    lineage: ["GMV/订单", "订单事实表", "OMS", "数据仓库", "AI 分析"],
  },
  conversion: {
    key: "conversion",
    metric_name: "conversion_rate",
    name: "转化率",
    en: "Conversion Rate",
    role: ["CEO", "OPERATION_MANAGER"],
    definition: "成交订单数 / 访客数（近似）",
    business_meaning: "衡量流量到成交的转化效率",
    formula: "Buyers / Visitors",
    included_scope: ["成交访客", "去重 UV"],
    excluded_scope: ["爬虫 / 测试流量", "内部访问"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "OMS + CDP",
    source_keys: ["OMS", "CDP"],
    owner: "运营团队",
    update_frequency: "15分钟",
    related_metrics: ["gmv", "orders"],
    analysis_rules: "环比下降 > 1pp 排查落地页 / 商品 / 定价",
    aliases: ["转化率", "CVR", "访客转化率"],
    example: "转化率 ≈ 3.2%",
    breakdown: ["落地页", "商品", "定价"],
    lineage: ["转化率", "行为日志", "CDP", "OMS", "数据仓库", "AI 分析"],
  },
  refundRate: {
    key: "refundRate",
    metric_name: "refund_rate",
    name: "退款率",
    en: "Refund Rate",
    role: ["OPERATION_MANAGER"],
    definition: "退款订单金额占 GMV 比例",
    business_meaning: "衡量履约与商品质量风险",
    formula: "refund_amount / GMV",
    included_scope: ["已发起退款订单"],
    excluded_scope: ["仅咨询未退款订单"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "OMS",
    source_keys: ["OMS"],
    owner: "客服 / 电商团队",
    update_frequency: "15分钟",
    related_metrics: ["gmv"],
    analysis_rules: "环比上升 > 0.5pp 触发品控 / 履约排查",
    aliases: ["退款率", "退货率", "退单率"],
    example: "退款率 ≈ 1.4%",
    breakdown: ["商品质量", "履约时效", "库存缺货"],
    lineage: ["退款单", "OMS", "数据仓库", "AI 分析"],
  },
  newMembers: {
    key: "newMembers",
    metric_name: "new_members",
    name: "新增会员",
    en: "New Members",
    role: ["CRM_MANAGER"],
    definition: "周期内新注册会员数",
    business_meaning: "衡量获客能力",
    formula: "COUNT(new_member_id)",
    included_scope: ["完成注册的会员"],
    excluded_scope: ["测试账号", "已注销账号"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "CRM",
    source_keys: ["CRM"],
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["activeMembers"],
    analysis_rules: "环比下降需检查获客渠道结构",
    aliases: ["新增会员", "拉新", "新客", "新注册"],
    example: "最近7天新增 ≈ 2,300 人",
    breakdown: ["获客渠道结构"],
    lineage: ["会员注册", "CRM", "数据仓库", "AI 分析"],
  },
  activeMembers: {
    key: "activeMembers",
    metric_name: "active_members",
    name: "活跃会员",
    en: "Active Members",
    role: ["CRM_MANAGER"],
    definition: "周期内至少发生一次有效行为（登录、浏览、下单、活动参与）的会员数（周期指标，受时间筛选影响）",
    business_meaning: "衡量会员盘子的活跃度",
    formula: "MAX(daily_active_members) over window（窗口越长 ≥ 越短，恒满足 90天 ≥ 30天 ≥ 7天）",
    included_scope: ["有消费或互动行为的会员"],
    excluded_scope: ["沉默会员", "已流失会员"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "CRM + CDP",
    source_keys: ["CRM", "CDP"],
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["newMembers", "repurchaseRate"],
    analysis_rules: "下降需排查触达频次 / 活动参与",
    aliases: ["活跃会员", "活跃用户", "MAU"],
    example: "最近7天活跃会员 ≈ 5,600 人",
    breakdown: ["触达频次", "活动参与"],
    lineage: ["会员行为", "CDP", "CRM", "数据仓库", "AI 分析"],
  },
  repurchaseRate: {
    key: "repurchaseRate",
    metric_name: "repurchase_rate",
    name: "复购率",
    en: "Repurchase Rate",
    role: ["CRM_MANAGER"],
    definition: "周期内发生两次及以上购买行为的会员占比",
    business_meaning: "衡量会员忠诚度",
    formula: "repeat_buyers / buyers",
    included_scope: ["≥2 次购买的会员"],
    excluded_scope: ["仅浏览未购买", "仅首单会员"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "CRM",
    source_keys: ["CRM"],
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["ltv", "activeMembers"],
    analysis_rules: "连续下降 7 天触发复购归因分析",
    aliases: ["复购", "复购率", "Repurchase", "回购率"],
    example: "复购率 ≈ 28.5%",
    breakdown: ["高价值会员", "活动参与度", "触达"],
    lineage: ["复购率", "会员订单事实表", "CRM", "数据仓库", "AI 分析"],
  },
  ltv: {
    key: "ltv",
    metric_name: "ltv",
    name: "会员LTV",
    en: "Life-Time Value",
    role: ["CRM_MANAGER"],
    definition: "会员生命周期价值（存量指标，锚定近 90 天，不受时间筛选影响）",
    business_meaning: "衡量会员长期价值",
    formula: "Σ90天GMV / 平均活跃会员数",
    included_scope: ["活跃会员"],
    excluded_scope: ["已注销会员", "测试账号"],
    time_window: ["90天", "会员生命周期"],
    data_source: "CRM",
    source_keys: ["CRM"],
    owner: "CRM 团队",
    update_frequency: "每周",
    related_metrics: ["repurchaseRate", "aov"],
    analysis_rules: "LTV 下行需结合复购 / 客单价拆解",
    aliases: ["会员价值", "生命周期价值", "LTV", "客户终身价值"],
    example: "会员 LTV ≈ ¥2,639",
    breakdown: ["复购率", "客单价"],
    lineage: ["会员订单", "CRM", "数据仓库", "AI 分析"],
  },
  churnRate: {
    key: "churnRate",
    metric_name: "churn_rate",
    name: "流失率",
    en: "Churn Rate",
    role: ["CRM_MANAGER"],
    definition: "截至统计期末的近 90 天滚动流失率（存量指标，不受时间筛选影响）",
    business_meaning: "衡量会员流失风险",
    formula: "Σ90(churn_members) / Σ90(total_members)",
    included_scope: ["超过阈值未活跃的会员"],
    excluded_scope: ["新注册未满周期", "已注销会员"],
    time_window: ["90天滚动（快照）"],
    data_source: "CRM",
    source_keys: ["CRM"],
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["repurchaseRate", "activeMembers"],
    analysis_rules: "环比上升触发留存分析",
    aliases: ["流失率", "流失", "Churn"],
    example: "流失率 ≈ 0.5%",
    breakdown: ["触发留存分析"],
    lineage: ["会员状态", "CRM", "数据仓库", "AI 分析"],
  },
  vipMembers: {
    key: "vipMembers",
    metric_name: "vip_members",
    name: "VIP会员",
    en: "VIP Members",
    role: ["CRM_MANAGER"],
    definition: "截至统计期末的 VIP 分层会员数（存量指标，不受时间筛选影响）",
    business_meaning: "衡量高价值会员盘子规模",
    formula: "期末 vip_members（快照值）",
    included_scope: ["VIP 分层会员"],
    excluded_scope: ["普通会员", "测试账号"],
    time_window: ["期末快照"],
    data_source: "CRM",
    source_keys: ["CRM"],
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["totalMembers", "ltv"],
    analysis_rules: "VIP 盘子缩水需结合复购 / 流失重点关注",
    aliases: ["VIP", "高价值会员", "VIP会员数"],
    example: "VIP 会员 ≈ 2,886 人",
    breakdown: ["VIP 流失", "VIP 复购"],
    lineage: ["会员分层", "CRM", "数据仓库", "AI 分析"],
  },
  totalMembers: {
    key: "totalMembers",
    metric_name: "total_members",
    name: "会员总数",
    en: "Total Members",
    role: ["CRM_MANAGER"],
    definition: "截至统计期末的全部有效注册会员数（存量指标，不受时间筛选影响）",
    business_meaning: "衡量会员资产盘子规模",
    formula: "期末 total_members（快照值）",
    included_scope: ["所有有效注册会员"],
    excluded_scope: ["已注销会员", "测试账号"],
    time_window: ["期末快照"],
    data_source: "CRM",
    source_keys: ["CRM"],
    owner: "CRM 团队",
    update_frequency: "每日",
    related_metrics: ["vipMembers", "activeMembers", "churnRate"],
    analysis_rules: "增长停滞需排查获客渠道 / 流失结构",
    aliases: ["会员总数", "累计会员", "注册会员数"],
    example: "会员总数 ≈ 16,679 人",
    breakdown: ["新增会员", "流失会员"],
    lineage: ["会员注册", "CRM", "数据仓库", "AI 分析"],
  },
  roi: {
    key: "roi",
    metric_name: "roi",
    name: "ROI",
    en: "Return on Investment",
    role: ["CEO", "OPERATION_MANAGER"],
    definition: "营销投入产出比",
    business_meaning: "衡量营销投放效率",
    formula: "campaign_gmv / campaign_cost",
    included_scope: ["营销活动订单"],
    excluded_scope: ["自然订单", "非活动渠道订单"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "Marketing Platform + OMS",
    source_keys: ["Marketing Platform", "OMS"],
    owner: "营销团队",
    update_frequency: "每日",
    related_metrics: ["gmv"],
    analysis_rules: "ROI < 1 触发预警；连续下滑需复盘投放",
    aliases: ["ROI", "投资回报率", "投放产出比", "投产比"],
    example: "ROI ≈ 1.85",
    breakdown: ["投放成本", "转化效率"],
    lineage: ["ROI", "营销活动表", "Marketing Platform", "OMS", "数据仓库", "AI 分析"],
  },
  reachRate: {
    key: "reachRate",
    metric_name: "reach_rate",
    name: "触达率",
    en: "Reach Rate",
    role: ["CRM_MANAGER"],
    definition: "企微触达用户数占好友总数的比例",
    business_meaning: "衡量私域触达覆盖度与企微运营活跃度",
    formula: "Σreached_users / Σtotal_friends",
    included_scope: ["企微成功送达的触达消息覆盖用户"],
    excluded_scope: ["未送达", "退订用户"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "Enterprise WeChat",
    source_keys: ["Enterprise WeChat"],
    owner: "SCRM Team",
    update_frequency: "每日",
    related_metrics: ["replyRate", "scrmConversion"],
    analysis_rules: "环比下降 > 2pp 排查触达策略 / 好友质量",
    aliases: ["触达率", "企微触达率", "Reach"],
    example: "触达率 ≈ 20%",
    breakdown: ["触达策略", "好友质量", "时段"],
    lineage: ["企微触达", "Enterprise WeChat", "数据仓库", "AI 分析"],
  },
  replyRate: {
    key: "replyRate",
    metric_name: "reply_rate",
    name: "回复率",
    en: "Reply Rate",
    role: ["CRM_MANAGER"],
    definition: "触达用户中产生回复的比例",
    business_meaning: "衡量触达内容质量与用户互动意愿",
    formula: "Σreply_users / Σreached_users",
    included_scope: ["触达后产生任一回复的用户"],
    excluded_scope: ["仅送达未互动"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "Enterprise WeChat",
    source_keys: ["Enterprise WeChat"],
    owner: "SCRM Team",
    update_frequency: "每日",
    related_metrics: ["reachRate", "scrmConversion"],
    analysis_rules: "环比下降需复盘内容 / 话术 / 触达频次",
    aliases: ["回复率", "互动率", "Reply"],
    example: "回复率 ≈ 27%",
    breakdown: ["内容质量", "话术", "触达频次"],
    lineage: ["企微互动", "Enterprise WeChat", "数据仓库", "AI 分析"],
  },
  scrmConversion: {
    key: "scrmConversion",
    metric_name: "scrm_conversion_rate",
    name: "企微成交率",
    en: "SCRM Conversion",
    role: ["CRM_MANAGER"],
    definition: "企微触达用户中最终成交的比例（触达→成交端到端）",
    business_meaning: "衡量私域从触达到变现的端到端转化效率",
    formula: "Σconverted_users / Σreached_users",
    included_scope: ["触达后在统计期内成交的用户"],
    excluded_scope: ["仅咨询未成交", "自然成交未触达"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "Enterprise WeChat",
    source_keys: ["Enterprise WeChat"],
    owner: "SCRM Team",
    update_frequency: "每日",
    related_metrics: ["reachRate", "replyRate", "couponRedemption"],
    analysis_rules: "连续下降需结合回复率 / 话术 / 商品组合归因",
    aliases: ["企微成交率", "私域转化率", "触达成单率"],
    example: "企微成交率 ≈ 4%",
    breakdown: ["回复率", "话术", "商品组合"],
    lineage: ["企微成交", "Enterprise WeChat", "OMS", "数据仓库", "AI 分析"],
  },
  couponRedemption: {
    key: "couponRedemption",
    metric_name: "coupon_redemption_rate",
    name: "发券核销率",
    en: "Coupon Redemption",
    role: ["CRM_MANAGER"],
    definition: "已发放优惠券中被核销使用的比例",
    business_meaning: "衡量优惠券刺激转化的效率与发券精准度",
    formula: "Σcoupon_used / Σcoupon_sent",
    included_scope: ["已核销使用的优惠券"],
    excluded_scope: ["过期未用", "已作废"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "Enterprise WeChat",
    source_keys: ["Enterprise WeChat"],
    owner: "SCRM Team",
    update_frequency: "每日",
    related_metrics: ["scrmConversion"],
    analysis_rules: "环比下降 > 2pp 排查发券人群 / 券面 / 门槛",
    aliases: ["发券核销率", "核销率", "券核销", "Redemption"],
    example: "发券核销率 ≈ 30%",
    breakdown: ["发券人群", "券面 / 门槛", "有效期"],
    lineage: ["发券核销", "Enterprise WeChat", "数据仓库", "AI 分析"],
  },
  totalFriends: {
    key: "totalFriends",
    metric_name: "total_friends",
    name: "企微好友总数",
    en: "Total Friends",
    role: ["CRM_MANAGER"],
    definition: "企微好友盘子规模（期末值）",
    business_meaning: "衡量私域流量池规模与增长基础",
    formula: "期末 total_friends",
    included_scope: ["有效企微好友"],
    excluded_scope: ["已删除 / 拉黑好友"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "Enterprise WeChat",
    source_keys: ["Enterprise WeChat"],
    owner: "SCRM Team",
    update_frequency: "每日",
    related_metrics: ["newFriends", "reachRate"],
    analysis_rules: "增长停滞需排查加粉渠道 / 留存",
    aliases: ["企微好友", "好友总数", "私域用户数"],
    example: "企微好友 ≈ 28,069",
    breakdown: ["加粉渠道", "留存"],
    lineage: ["企微好友", "Enterprise WeChat", "数据仓库", "AI 分析"],
  },
  newFriends: {
    key: "newFriends",
    metric_name: "new_friends",
    name: "新增好友",
    en: "New Friends",
    role: ["CRM_MANAGER"],
    definition: "周期内新增企微好友数",
    business_meaning: "衡量私域获客能力与拉新速度",
    formula: "Σnew_friends",
    included_scope: ["周期内新添加的企微好友"],
    excluded_scope: ["已删除好友", "测试账号"],
    time_window: ["7天", "14天", "30天", "90天"],
    data_source: "Enterprise WeChat",
    source_keys: ["Enterprise WeChat"],
    owner: "SCRM Team",
    update_frequency: "每日",
    related_metrics: ["totalFriends"],
    analysis_rules: "环比下降需检查加粉渠道结构",
    aliases: ["新增好友", "新加粉", "拉新好友"],
    example: "最近7天新增 ≈ 800 人",
    breakdown: ["加粉渠道结构"],
    lineage: ["企微加粉", "Enterprise WeChat", "数据仓库", "AI 分析"],
  },
};

/** 全部指标（数组形式，固定顺序，供 Metric Definition Center 渲染） */
export const ALL_METRICS: MetricSpec[] = Object.values(METRIC_SPECS);

/** 角色中文标签 */
export const ROLE_LABELS: Record<Role, string> = {
  CEO: "CEO",
  CRM_MANAGER: "CRM 经理",
  OPERATION_MANAGER: "运营经理",
};

/**
 * 指标搜索（Metric Search，11_Query_Governance §6 Metric Mapping）。
 * 命中口径：metric_name / name / en / 别名 / 定义 / 业务意义（大小写不敏感）。
 * 返回带命中片段的结果，便于高亮。
 */
export interface MetricSearchHit {
  metric: MetricSpec;
  matchedField: string; // 命中的字段名（用于展示）
  matchedValue: string; // 命中的值
}

export function searchMetrics(query: string): MetricSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_METRICS.map((m) => ({ metric: m, matchedField: "全部", matchedValue: m.name }));

  const hits: MetricSearchHit[] = [];
  for (const m of ALL_METRICS) {
    const match = (field: string, value: string): MetricSearchHit | null =>
      value && value.toLowerCase().includes(q)
        ? { metric: m, matchedField: field, matchedValue: value }
        : null;
    const aliasHit = m.aliases.find((a) => a.toLowerCase().includes(q));

    const candidates: MetricSearchHit[] = [
      match("名称", m.name),
      aliasHit ? match("别名", aliasHit) : null,
      match("英文名", m.en),
      match("机器名", m.metric_name),
      match("定义", m.definition),
      match("业务意义", m.business_meaning),
    ].filter((c): c is MetricSearchHit => c !== null);

    if (candidates.length > 0) {
      // 名称/别名命中优先
      const prioritized =
        candidates.find((c) => c.matchedField === "名称" || c.matchedField === "别名") ??
        candidates[0];
      hits.push(prioritized);
    }
  }
  return hits;
}

/**
 * 从自然语言/Insight 文本解析出指标 key（供 Insight「该指标如何计算」入口）。
 * 优先匹配名称与别名，再退化为定义关键词。
 */
export function resolveMetricKey(text: string): MetricKey | null {
  const q = text.toLowerCase();
  if (!q) return null;
  // 精确/包含名称或别名
  for (const m of ALL_METRICS) {
    const names = [m.name, m.en, m.metric_name, ...m.aliases].map((s) => s.toLowerCase());
    if (names.some((n) => n && q.includes(n))) return m.key;
  }
  return null;
}

/* ----------------------------- 推荐行动知识 ----------------------------- */

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
  scrm_engage: {
    trigger: "scrm_engage",
    icon: "megaphone",
    category: "私域",
    investment: "低投入",
    outcome: "触达率 +2pp",
    title: "优化企微触达策略",
    description: "复盘触达时段 / 频次 / 人群分层，对高价值好友精准触达，提升触达率与回复率。",
  },
};
