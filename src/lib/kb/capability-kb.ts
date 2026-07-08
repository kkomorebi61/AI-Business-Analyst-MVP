/**
 * Capability Knowledge Base —— 能力知识库（doc 16_Capability_Knowledge_Base V1.0）
 *
 * 核心目标（doc 16 §Objective）：
 *   让 AI 理解企业「系统能力」，回答 6 个问题——
 *   有什么能力？谁支持？解决什么问题？如何操作？谁负责？是否有最佳实践？
 *
 * 解题链：Business Problem → Capability Discovery → Capability Matching → Execution
 *
 * 匹配规则（doc 16 §Capability Matching Rules）：
 *   Rule 1  业务问题优先匹配能力（复购率下降 → 标签/优惠券/自动营销/企微触达）
 *   Rule 2  优先复用现有能力，禁止直接推荐开发新功能
 *   Rule 3  仅当能力缺失时，才生成 PRD 建议（Gap Analysis）
 *
 * 设计原则：纯规则、关键词加权匹配（doc 15 Rule First / Knowledge First）。
 *           无需 LLM 即可定位能力；LLM 仅在「缺口已确认」后生成 PRD（Requirement Query）。
 */

/** 能力分类（doc 16 §Capability Categories） */
export type CapabilitySystem = "CRM" | "CDP" | "SCRM" | "OMS" | "ERP" | "Marketing Platform" | "Data Platform";

export interface Capability {
  id: string; // CRM_MEMBER_001
  system: CapabilitySystem;
  module: string; // 会员中心
  capability: string; // 会员查询
  businessGoal: string; // 查看会员信息
  scenarios: string[]; // 适用场景
  /** 业务问题匹配关键词（自然语言 → 能力，doc 16 Rule 1） */
  keywords: string[];
  input: string[];
  output: string[];
  /** 操作路径（doc 16 §Operation Path） */
  path: string[];
  owner: string;
  bestPractice: string[];
  related: string[]; // 相关能力 id
  status: "Active" | "Planned" | "Deprecated";
}

/* ------------------------------------------------------------------ *
 * CRM（doc 16 §CRM）
 * ------------------------------------------------------------------ */

const CRM_MEMBER_001: Capability = {
  id: "CRM_MEMBER_001",
  system: "CRM",
  module: "会员中心",
  capability: "会员查询",
  businessGoal: "查看会员信息",
  scenarios: ["会员运营", "客服查询", "导购服务"],
  keywords: ["会员查询", "会员档案", "会员信息", "会员等级", "会员积分", "查会员", "会员标签"],
  input: ["会员ID", "手机号", "会员名称"],
  output: ["会员档案", "会员等级", "会员积分", "会员标签"],
  path: ["CRM", "会员中心", "会员查询"],
  owner: "CRM运营",
  bestPractice: ["客户投诉处理", "会员服务"],
  related: ["CRM_MEMBER_002", "CRM_TAG_001"],
  status: "Active",
};

const CRM_MEMBER_002: Capability = {
  id: "CRM_MEMBER_002",
  system: "CRM",
  module: "会员中心",
  capability: "会员等级管理",
  businessGoal: "会员分层运营",
  scenarios: ["VIP管理", "会员成长体系"],
  keywords: ["会员等级", "会员分层", "成长体系", "VIP", "等级权益", "银卡", "金卡", "钻石", "会员成长"],
  input: ["消费金额", "成长值"],
  output: ["会员等级", "等级权益"],
  path: ["CRM", "会员中心", "会员等级"],
  owner: "CRM产品经理",
  bestPractice: ["银卡", "金卡", "钻石会员"],
  related: ["CRM_MEMBER_001"],
  status: "Active",
};

const CRM_TAG_001: Capability = {
  id: "CRM_TAG_001",
  system: "CRM",
  module: "标签中心",
  capability: "生命周期标签",
  businessGoal: "会员分层",
  scenarios: ["拉新", "促活", "召回", "流失预警"],
  keywords: ["生命周期", "生命周期标签", "新会员", "活跃会员", "沉睡会员", "流失会员", "会员分层", "召回", "流失预警"],
  input: ["会员行为", "订单数据"],
  output: ["生命周期标签"],
  path: ["CRM", "标签中心", "生命周期标签"],
  owner: "CRM运营",
  bestPractice: ["新会员", "活跃会员", "沉睡会员", "流失会员"],
  related: ["CRM_MARKETING_003", "CRM_MARKETING_002"],
  status: "Active",
};

const CRM_TAG_002: Capability = {
  id: "CRM_TAG_002",
  system: "CRM",
  module: "标签中心",
  capability: "RFM标签",
  businessGoal: "识别高价值会员",
  scenarios: ["精准营销", "会员分层"],
  keywords: ["RFM", "RFM模型", "高价值会员", "价值评分", "消费频次", "精准营销", "高价值", "价值分层"],
  input: ["消费频次", "消费金额", "最近购买时间"],
  output: ["RFM等级", "会员价值评分"],
  path: ["CRM", "标签中心", "RFM模型"],
  owner: "CRM运营",
  bestPractice: ["A类高价值会员", "B类成长会员", "C类低活跃会员"],
  related: ["CRM_MARKETING_001", "CRM_MARKETING_003"],
  status: "Active",
};

const CRM_MARKETING_001: Capability = {
  id: "CRM_MARKETING_001",
  system: "CRM",
  module: "营销中心",
  capability: "营销活动管理",
  businessGoal: "活动运营",
  scenarios: ["大促", "会员日", "新品上市"],
  keywords: ["营销活动", "活动管理", "大促", "会员日", "新品上市", "活动运营", "建活动", "创建活动", "活动规则"],
  input: ["人群包", "活动规则"],
  output: ["营销活动", "活动分析"],
  path: ["CRM", "营销中心", "活动管理"],
  owner: "CRM运营经理",
  bestPractice: ["双11", "618", "会员日"],
  related: ["CRM_MARKETING_002", "CRM_MARKETING_003"],
  status: "Active",
};

const CRM_MARKETING_002: Capability = {
  id: "CRM_MARKETING_002",
  system: "CRM",
  module: "营销中心",
  capability: "优惠券管理",
  businessGoal: "提升转化、促进复购",
  scenarios: ["会员召回", "促销活动"],
  keywords: ["优惠券", "券", "核销", "满减", "满300减50", "满500减80", "发券", "创建优惠券", "券核销", "促销"],
  input: ["优惠规则", "活动人群"],
  output: ["优惠券", "核销数据"],
  path: ["CRM", "营销中心", "优惠券中心"],
  owner: "CRM运营",
  bestPractice: ["满300减50", "满500减80"],
  related: ["CRM_MARKETING_001", "CRM_MARKETING_003"],
  status: "Active",
};

const CRM_MARKETING_003: Capability = {
  id: "CRM_MARKETING_003",
  system: "CRM",
  module: "自动营销",
  capability: "自动营销流程",
  businessGoal: "自动触达、自动转化",
  scenarios: ["欢迎流程", "生日关怀", "召回流程"],
  keywords: ["自动营销", "自动化", "欢迎流程", "生日关怀", "召回流程", "触发条件", "自动触达", "配置自动营销", "自动化流程"],
  input: ["触发条件"],
  output: ["自动触达任务"],
  path: ["CRM", "自动营销"],
  owner: "CRM运营",
  bestPractice: ["注册欢迎", "首购激励", "流失召回"],
  related: ["CRM_TAG_001", "CRM_MARKETING_002"],
  status: "Active",
};

/* ------------------------------------------------------------------ *
 * CDP（doc 16 §CDP）
 * ------------------------------------------------------------------ */

const CDP_PROFILE_001: Capability = {
  id: "CDP_PROFILE_001",
  system: "CDP",
  module: "用户画像",
  capability: "用户画像分析",
  businessGoal: "用户洞察",
  scenarios: ["精准营销", "用户研究"],
  keywords: ["用户画像", "画像", "用户洞察", "高价值画像", "潜力用户画像", "画像分析"],
  input: ["行为数据", "订单数据"],
  output: ["用户画像"],
  path: ["CDP", "用户画像中心"],
  owner: "数据运营",
  bestPractice: ["高价值用户画像", "潜力用户画像"],
  related: ["CDP_SEGMENT_001"],
  status: "Active",
};

const CDP_SEGMENT_001: Capability = {
  id: "CDP_SEGMENT_001",
  system: "CDP",
  module: "圈人中心",
  capability: "动态圈人",
  businessGoal: "精准人群运营",
  scenarios: ["营销活动", "标签运营"],
  keywords: ["圈人", "动态圈人", "人群包", "人群", "精准人群", "浏览未购买", "高价值沉睡", "圈选", "人群运营"],
  input: ["标签条件", "行为条件"],
  output: ["目标人群包"],
  path: ["CDP", "圈人中心"],
  owner: "CRM运营",
  bestPractice: ["近30天浏览未购买", "高价值沉睡会员"],
  related: ["CDP_PROFILE_001", "CRM_TAG_001"],
  status: "Active",
};

/* ------------------------------------------------------------------ *
 * SCRM（doc 16 §SCRM）
 * ------------------------------------------------------------------ */

const SCRM_WECHAT_001: Capability = {
  id: "SCRM_WECHAT_001",
  system: "SCRM",
  module: "企微好友",
  capability: "好友管理",
  businessGoal: "私域运营",
  scenarios: ["会员运营", "导购运营"],
  keywords: ["企微好友", "好友管理", "加企微", "私域", "好友档案", "加粉"],
  input: ["好友数据"],
  output: ["好友档案"],
  path: ["SCRM", "好友管理"],
  owner: "导购",
  bestPractice: ["会员加企微"],
  related: ["SCRM_TOUCH_001"],
  status: "Active",
};

const SCRM_TOUCH_001: Capability = {
  id: "SCRM_TOUCH_001",
  system: "SCRM",
  module: "触达中心",
  capability: "企微群发",
  businessGoal: "提升触达率",
  scenarios: ["活动通知", "会员召回", "新品上市"],
  keywords: ["企微群发", "企微触达", "群发", "触达", "企微消息", "活动通知", "企微内容", "社群"],
  input: ["人群包", "消息内容"],
  output: ["触达记录", "触达分析"],
  path: ["SCRM", "消息中心", "群发"],
  owner: "CRM运营",
  bestPractice: ["新品通知", "会员日提醒"],
  related: ["CRM_MARKETING_001", "CRM_MARKETING_003"],
  status: "Active",
};

const SCRM_TASK_001: Capability = {
  id: "SCRM_TASK_001",
  system: "SCRM",
  module: "任务中心",
  capability: "导购任务管理",
  businessGoal: "提升执行效率",
  scenarios: ["会员关怀", "活动跟进"],
  keywords: ["导购任务", "任务中心", "导购任务管理", "每日触达任务", "生日关怀任务", "任务管理", "导购"],
  input: ["任务规则"],
  output: ["任务记录", "完成率"],
  path: ["SCRM", "任务中心"],
  owner: "店长 / 导购",
  bestPractice: ["每日触达任务", "生日关怀任务"],
  related: ["SCRM_WECHAT_001", "SCRM_TOUCH_001"],
  status: "Active",
};

/* ------------------------------------------------------------------ *
 * OMS（doc 16 §OMS）
 * ------------------------------------------------------------------ */

const OMS_ORDER_001: Capability = {
  id: "OMS_ORDER_001",
  system: "OMS",
  module: "订单中心",
  capability: "订单查询",
  businessGoal: "订单分析",
  scenarios: ["经营分析", "客服查询"],
  keywords: ["订单查询", "查订单", "订单信息", "订单号", "订单中心"],
  input: ["订单号", "会员ID"],
  output: ["订单信息"],
  path: ["OMS", "订单中心"],
  owner: "运营",
  bestPractice: ["客服查单", "经营分析"],
  related: ["OMS_ORDER_002"],
  status: "Active",
};

const OMS_ORDER_002: Capability = {
  id: "OMS_ORDER_002",
  system: "OMS",
  module: "订单分析",
  capability: "GMV分析",
  businessGoal: "经营分析",
  scenarios: ["经营看板", "AI分析"],
  keywords: ["GMV分析", "GMV", "订单分析", "客单价", "经营看板"],
  input: ["订单事实表"],
  output: ["GMV", "订单数", "客单价"],
  path: ["OMS", "订单分析"],
  owner: "经营分析师",
  bestPractice: ["经营看板", "日报 / 周报"],
  related: ["OMS_ORDER_001"],
  status: "Active",
};

/** 全部能力（doc 16 verbatim） */
export const CAPABILITIES: Capability[] = [
  CRM_MEMBER_001,
  CRM_MEMBER_002,
  CRM_TAG_001,
  CRM_TAG_002,
  CRM_MARKETING_001,
  CRM_MARKETING_002,
  CRM_MARKETING_003,
  CDP_PROFILE_001,
  CDP_SEGMENT_001,
  SCRM_WECHAT_001,
  SCRM_TOUCH_001,
  SCRM_TASK_001,
  OMS_ORDER_001,
  OMS_ORDER_002,
];

/** 按 id 索引（供 related 关联解析） */
export const CAPABILITY_BY_ID: Record<string, Capability> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
);

/* ------------------------------------------------------------------ *
 * 能力匹配（doc 16 §Capability Matching Rules）
 * ------------------------------------------------------------------ */

export interface CapabilityMatch {
  capability: Capability;
  /** 命中关键词（可解释） */
  hitKeywords: string[];
  /** 命中数 → 排序权重 */
  score: number;
}

/**
 * 业务问题 → 能力匹配（doc 16 Rule 1）。
 * 关键词加权：capability 名命中 +3，businessGoal 命中 +2，keywords 命中 +1。
 * 纯规则、可单测（Rule First）。
 */
export function matchCapabilities(question: string): CapabilityMatch[] {
  const q = question.toLowerCase();
  const matches: CapabilityMatch[] = [];

  for (const cap of CAPABILITIES) {
    if (cap.status !== "Active") continue;
    const hits: string[] = [];
    let score = 0;

    if (cap.capability && q.includes(cap.capability.toLowerCase())) {
      score += 3;
      hits.push(cap.capability);
    }
    if (cap.businessGoal && q.includes(cap.businessGoal.toLowerCase())) {
      score += 2;
      hits.push(cap.businessGoal);
    }
    for (const kw of cap.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += 1;
        if (!hits.includes(kw)) hits.push(kw);
      }
    }
    if (score > 0) matches.push({ capability: cap, hitKeywords: hits, score });
  }

  return matches.sort((a, b) => b.score - a.score);
}

/** 取最佳匹配能力（doc 16 Rule 1：优先复用现有能力） */
export function topCapability(question: string): CapabilityMatch | null {
  const ranked = matchCapabilities(question);
  return ranked[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Gap Analysis（doc 16 §Capability Gap Analysis）
 * ------------------------------------------------------------------ */

export interface GapAnalysisResult {
  /** 系统是否已支持该业务问题（doc 16 §Capability Gap Analysis） */
  supported: boolean;
  /** 最佳匹配能力（supported=true 时非空） */
  matched: CapabilityMatch[];
  /** 缺口摘要 */
  summary: string;
  /** 缺失的能力点（supported=false 时产出，供 PRD） */
  gaps: string[];
}

/**
 * 能力缺口分析（doc 16 §Capability Gap Analysis）。
 *   命中能力（score≥阈值）→ supported=true → 走 Execution 路径（操作方案）
 *   未命中                → supported=false → 走 Requirement 路径（PRD 建议）
 *
 * Rule 2/3：优先复用现有能力；仅当能力缺失时生成 PRD。
 */
export function gapAnalysis(question: string, threshold = 2): GapAnalysisResult {
  const matched = matchCapabilities(question).filter((m) => m.score >= threshold);
  const supported = matched.length > 0;

  if (supported) {
    return {
      supported: true,
      matched,
      summary: `系统已支持：命中 ${matched.length} 个能力，优先复用现有能力（doc 16 Rule 2）`,
      gaps: [],
    };
  }

  // 能力缺口：抽取问题中的业务对象，给出缺口假设（供 LLM 生成 PRD）
  const gaps = inferGaps(question);
  return {
    supported: false,
    matched: [],
    summary: "当前系统能力库未覆盖该业务问题，触发 Gap Analysis → PRD 建议（doc 16 Rule 3）",
    gaps,
  };
}

/** 轻量缺口推断：从问题抽取业务对象关键词，作为 PRD 的功能点假设 */
function inferGaps(question: string): string[] {
  const gaps: string[] = [];
  if (/成长体系|成长值|升级规则/.test(question)) gaps.push("会员成长体系（成长值规则 / 升级 / 降级）");
  if (/积分|积分商城|积分兑换/.test(question)) gaps.push("积分体系（获取 / 兑换 / 过期）");
  if (/裂变|邀请|老带新|拼团/.test(question)) gaps.push("裂变营销（邀请有礼 / 拼团 / 分销）");
  if (/预测|预警模型|算法/.test(question)) gaps.push("AI 预测 / 预警能力（流失预测 / 销售预测）");
  if (gaps.length === 0) gaps.push("该业务诉求尚无对应系统能力，需评估新功能开发");
  return gaps;
}
