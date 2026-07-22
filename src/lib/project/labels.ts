/**
 * Project 状态 / Phase / 行业 / 可信度的中文标签与 UI 色值映射（纯函数 + 常量，可测试）。
 * 供 Workspace 与 Project 详情页共用，避免展示逻辑散落。
 */

import type {
  CredibilityLevel,
  ProjectIndustry,
  ProjectPhase,
  ProjectStatus,
} from "./types";

/** Phase 推进顺序（schema-design.md §3 状态机 happy path） */
export const PHASE_ORDER: ProjectPhase[] = [
  "PRE_A",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
];

export const PHASE_INDEX: Record<ProjectPhase, number> = Object.fromEntries(
  PHASE_ORDER.map((p, i) => [p, i]),
) as Record<ProjectPhase, number>;

/**
 * Phase 标签 —— 对齐原型 8 步咨询流程（A-H）。
 * PRE_A = 建项后未开始；A-H = 八个 Wizard 步骤；案例沉淀为项目完成后自动动作（不占步骤）。
 */
export const PHASE_LABEL: Record<ProjectPhase, string> = {
  PRE_A: "待开始",
  A: "业务背景",
  B: "数据采集",
  C: "数据体检",
  D: "经营诊断",
  E: "根因分析",
  F: "策略方案",
  G: "执行计划",
  H: "效果追踪",
};

/** Wizard 8 步元信息（驱动项目壳进度条与步骤面板）。no = 步骤序号 1-8。 */
export interface WizardStep {
  phase: ProjectPhase; // A-H
  no: number; // 1-8
  label: string; // 业务背景
  desc: string; // 这一步做什么
  engine?: string; // 将接入的现有引擎（占位标注用）
}

export const WIZARD_STEPS: WizardStep[] = [
  { phase: "A", no: 1, label: "业务背景", desc: "确认项目背景、行业、目标与分析视角" },
  { phase: "B", no: 2, label: "数据采集", desc: "A 问题驱动 / B 指标录入 / C 文件上传" },
  { phase: "C", no: 3, label: "数据体检", desc: "完整性 / 一致性 / 覆盖度 / 可信度评分", engine: "data-understanding" },
  { phase: "D", no: 4, label: "经营诊断", desc: "趋势、异常、健康度与 Top Findings", engine: "insight-agent" },
  { phase: "E", no: 5, label: "根因分析", desc: "问题树、贡献度与证据链", engine: "evidence-engine" },
  { phase: "F", no: 6, label: "策略方案", desc: "策略推荐、ROI 与优先级", engine: "strategy-engine" },
  { phase: "G", no: 7, label: "执行计划", desc: "Action Plan 任务拆解与分配", engine: "capability-kb" },
  { phase: "H", no: 8, label: "效果追踪", desc: "前后对比、ROI 与 Impact Report", engine: "comparison-engine" },
];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "草稿",
  active: "进行中",
  strategy_blocked: "策略受限",
  completed: "已完成",
  archived: "已归档",
};

/** status → badge 色（对齐 ui/badge variants） */
export const STATUS_BADGE: Record<
  ProjectStatus,
  "secondary" | "info" | "warning" | "success" | "outline"
> = {
  draft: "secondary",
  active: "info",
  strategy_blocked: "warning",
  completed: "success",
  archived: "outline",
};

export const INDUSTRY_LABEL: Record<ProjectIndustry, string> = {
  RETAIL: "零售",
  ECOMMERCE: "电商",
  BEAUTY: "美妆",
  FASHION: "服饰",
  FMCG: "快消",
  CUSTOM: "其它",
};

export const CREDIBILITY_LABEL: Record<CredibilityLevel, string> = {
  CREDIBLE: "可信",
  BASICALLY_CREDIBLE: "基本可信",
  CAUTIOUS: "谨慎参考",
  INSUFFICIENT: "数据不足",
};

/** 完整度（0–100）→ 可信度等级（schema-design.md §4.1 阈值，verbatim） */
export function credibilityFromCompleteness(pct: number): CredibilityLevel {
  if (pct >= 80) return "CREDIBLE";
  if (pct >= 50) return "BASICALLY_CREDIBLE";
  if (pct >= 30) return "CAUTIOUS";
  return "INSUFFICIENT";
}
