/**
 * Project 领域模型（AI Business Consulting OS V2.0 · Phase 1）。
 *
 * Project 是咨询工作流的聚合根：一次「业务问题 → 诊断 → 策略 → 执行 → 追踪 → 沉淀」
 * 的完整咨询 engagements 都挂在一个 Project 下（schema-design.md）。
 *
 * 全链路：Phase A 问题理解 → B 数据准备 → C 诊断 → D 根因 → E 策略 → F 执行 → G 追踪 → H 案例。
 * 本 Phase 1 仅落地 Project 实体本身（CRUD + 状态机字段）；各 Phase 产物（Problem/Dataset/Insight
 * /RootCause/Strategy/Task/Result/Case）在后续阶段接入，挂在 Project 下。
 *
 * 设计决策（Phase 1）：
 *  - 持久化 = 进程内 globalStore（对齐 dataset-store / csv-engine，零额外依赖、HMR 安全）；
 *    后续可整体替换为 SQLite+Prisma，引擎层无感（仓库接口已收敛在本模块）。
 *  - perspective 复用现有 Role（CEO/CRM/运营），与 role-agent / 路由层同一口径。
 *  - credibility 在本阶段先占位（默认 INSUFFICIENT），Step5 数据体检接入后由完整度派生。
 */

import type { Role } from "@/lib/kb/metric-kb";

/** Project 生命周期状态（正交于 currentPhase；schema-design.md §3） */
export type ProjectStatus =
  | "draft" // 草稿：刚创建，未真正进入分析
  | "active" // 进行中：处于 A–H 某 Phase
  | "strategy_blocked" // 被门控：数据完整度 <30%，禁止生成策略（回 B 补数据）
  | "completed" // 已完成：跑到 H 产 Case（可选发布）
  | "archived"; // 归档：不再活跃，保留可查

/**
 * 咨询流程 Phase（schema-design.md §3 状态机）。
 *  PRE_A = 建项后、未确认问题；A–H = 八个咨询阶段。
 */
export type ProjectPhase = "PRE_A" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

/** 行业（对齐 Industry KB；MVP 先支持零售/电商两类，其余占位） */
export type ProjectIndustry =
  | "RETAIL"
  | "ECOMMERCE"
  | "BEAUTY"
  | "FASHION"
  | "FMCG"
  | "CUSTOM";

/** 分析可信度（由数据完整度派生，贯穿所有结论；schema-design.md §4.1） */
export type CredibilityLevel =
  | "CREDIBLE" // ≥80%
  | "BASICALLY_CREDIBLE" // 50–79%
  | "CAUTIOUS" // 30–49%
  | "INSUFFICIENT"; // <30%

/** Project 实体（聚合根） */
export interface Project {
  id: string;
  name: string;
  industry: ProjectIndustry;
  businessGoal: string;
  status: ProjectStatus;
  currentPhase: ProjectPhase;
  /** 负责人（MVP 无用户体系，存显示名/id 占位） */
  ownerId: string | null;
  /** 分析视角，复用 Role（CEO / CRM_MANAGER / OPERATION_MANAGER） */
  perspective: Role;
  /** 数据完整度 0–100（Step5 接入后由 Dataset 健康 × DataRequirement 槽计算） */
  dataCompletenessPct: number;
  /** 分析可信度（由 dataCompletenessPct 派生） */
  credibilityLevel: CredibilityLevel;
  /** 若由「复用案例」创建，记录来源 Case id */
  sourceCaseId: string | null;
  createdAt: string;
  updatedAt: string;
  /** 最近打开时间，支持「再次打开继续分析」（原则 7） */
  lastOpenedAt: string;
}

/** 创建项目入参（均为可选，缺省由系统补默认） */
export interface CreateProjectInput {
  name?: string;
  industry?: ProjectIndustry;
  businessGoal?: string;
  perspective?: Role;
  ownerId?: string;
  sourceCaseId?: string;
}

/** 修改项目入参（任意子集；status/phase 走状态机校验） */
export interface UpdateProjectInput {
  name?: string;
  industry?: ProjectIndustry;
  businessGoal?: string;
  perspective?: Role;
  ownerId?: string;
  status?: ProjectStatus;
  /** 手动设置 Phase（含回边，如补数据回到 B） */
  phase?: ProjectPhase;
}
