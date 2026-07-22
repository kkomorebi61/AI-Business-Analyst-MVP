/**
 * Project 仓库（服务端进程内，globalStore 模式，仿 dataset-store.ts / cost-store.ts）。
 *
 * Phase 1：项目制工作单元的增删改查 + 状态机字段。无 DB、无落盘（对齐 MVP 范围）；
 * HMR 下 globalThis guard 保单例。后续替换为 SQLite+Prisma 时，仅需把本文件实现换成
 * 数据库读写，上层（API / 引擎）签名不变。
 *
 * 状态机（schema-design.md §3）：
 *  - status：draft → active → (strategy_blocked) → completed → archived
 *  - currentPhase：PRE_A → A → … → H（advancePhase 走 happy path；updatePhase 允许手动回边）
 *  - 数据完整度 <30% 时由调用方置 strategy_blocked（门控逻辑在 Step5/策略阶段接入）。
 */

import type { Role } from "@/lib/kb/metric-kb";
import type { GapAnalysis } from "@/lib/data-understanding/types";
import {
  credibilityFromCompleteness,
  PHASE_INDEX,
  PHASE_ORDER,
} from "./labels";
import type {
  CreateProjectInput,
  Project,
  ProjectIndustry,
  ProjectPhase,
  ProjectStatus,
  UpdateProjectInput,
} from "./types";

interface Store {
  projects: Map<string, Project>;
}

const g = globalThis as unknown as { __ANALYST_PROJECTS__?: Store };
g.__ANALYST_PROJECTS__ ??= { projects: new Map() };
const S = g.__ANALYST_PROJECTS__!;

/* ------------------------------- 内部工具 ------------------------------- */

const DEFAULT_PERSPECTIVE: Role = "CEO";
const DEFAULT_INDUSTRY: ProjectIndustry = "RETAIL";

function newId(): string {
  return `proj-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

const STATUS_VALUES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "draft",
  "active",
  "strategy_blocked",
  "completed",
  "archived",
]);

const PHASE_VALUES: ReadonlySet<ProjectPhase> = new Set(PHASE_ORDER);

function isStatus(v: unknown): v is ProjectStatus {
  return typeof v === "string" && STATUS_VALUES.has(v as ProjectStatus);
}

function isPhase(v: unknown): v is ProjectPhase {
  return typeof v === "string" && PHASE_VALUES.has(v as ProjectPhase);
}

/* --------------------------------- 读取 --------------------------------- */

/** 单个项目（不存在返回 null） */
export function getProject(id: string): Project | null {
  return S.projects.get(id) ?? null;
}

/**
 * 项目列表（按 updatedAt 倒序；活跃项目优先于已完成/归档）。
 * 返回浅拷贝，避免调用方误改内存态。
 */
export function listProjects(): Project[] {
  return Array.from(S.projects.values())
    .slice()
    .sort((a, b) => {
      const aActive = a.status === "draft" || a.status === "active" ? 0 : 1;
      const bActive = b.status === "draft" || b.status === "active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .map((p) => ({ ...p }));
}

/** 项目总数 */
export function countProjects(): number {
  return S.projects.size;
}

/* --------------------------------- 写入 --------------------------------- */

/** 创建项目（缺省字段补默认；初始 status=draft / phase=PRE_A / 完整度=0） */
export function createProject(input: CreateProjectInput = {}): Project {
  const ts = nowIso();
  const project: Project = {
    id: newId(),
    name: input.name?.trim() || `新项目 · ${ts.slice(0, 10)}`,
    industry: input.industry ?? DEFAULT_INDUSTRY,
    businessGoal: input.businessGoal?.trim() ?? "",
    status: "draft",
    currentPhase: "PRE_A",
    ownerId: input.ownerId ?? null,
    perspective: input.perspective ?? DEFAULT_PERSPECTIVE,
    dataCompletenessPct: 0,
    credibilityLevel: credibilityFromCompleteness(0),
    sourceCaseId: input.sourceCaseId ?? null,
    createdAt: ts,
    updatedAt: ts,
    lastOpenedAt: ts,
  };
  S.projects.set(project.id, project);
  return { ...project };
}

/**
 * 更新项目字段（含 status/phase 状态机字段）。
 *  - 仅应用 input 中显式提供的字段；
 *  - status/phase 非法值抛错（由 API 层兜底转 400）；
 *  - 任何更新都刷新 updatedAt。
 * 返回更新后的项目（不存在返回 null）。
 */
export function updateProject(
  id: string,
  input: UpdateProjectInput,
): Project | null {
  const p = S.projects.get(id);
  if (!p) return null;

  if (input.name !== undefined) p.name = input.name.trim() || p.name;
  if (input.industry !== undefined) p.industry = input.industry;
  if (input.businessGoal !== undefined) p.businessGoal = input.businessGoal.trim();
  if (input.perspective !== undefined) p.perspective = input.perspective;
  if (input.ownerId !== undefined) p.ownerId = input.ownerId;

  if (input.status !== undefined) {
    if (!isStatus(input.status)) {
      throw new Error(`非法 status：${String(input.status)}`);
    }
    p.status = input.status;
  }
  if (input.phase !== undefined) {
    if (!isPhase(input.phase)) {
      throw new Error(`非法 phase：${String(input.phase)}`);
    }
    p.currentPhase = input.phase;
    // 一旦进入流程（≥A），草稿自动转 active
    if (p.status === "draft" && PHASE_INDEX[p.currentPhase] >= PHASE_INDEX.A) {
      p.status = "active";
    }
  }

  p.updatedAt = nowIso();
  return { ...p };
}

/** 便捷：仅改 status */
export function updateStatus(id: string, status: ProjectStatus): Project | null {
  return updateProject(id, { status });
}

/** 便捷：仅改 phase（手动，含回边） */
export function updatePhase(id: string, phase: ProjectPhase): Project | null {
  return updateProject(id, { phase });
}

/** 推进到下一 Phase（happy path；已在 H 则原地不动） */
export function advancePhase(id: string): Project | null {
  const p = S.projects.get(id);
  if (!p) return null;
  const idx = PHASE_INDEX[p.currentPhase];
  const next = PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
  return updateProject(id, { phase: next });
}

/** 记录最近打开（续作支持；不触发 updatedAt，仅刷 lastOpenedAt） */
export function touchProject(id: string): Project | null {
  const p = S.projects.get(id);
  if (!p) return null;
  p.lastOpenedAt = nowIso();
  return { ...p };
}

/** 删除项目 */
export function deleteProject(id: string): { ok: boolean; reason?: string } {
  if (!S.projects.delete(id)) return { ok: false, reason: "项目不存在" };
  return { ok: true };
}

/**
 * 写入数据完整度（0–100）并派生可信度。
 * Step5 数据体检接入后由其调用；Phase 1 暴露以便测试与后续接线。
 */
export function setCompleteness(id: string, pct: number): Project | null {
  const p = S.projects.get(id);
  if (!p) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  p.dataCompletenessPct = clamped;
  p.credibilityLevel = credibilityFromCompleteness(clamped);
  // <30% → 策略阶段门控：置 strategy_blocked（schema-design.md §3 硬门）
  if (clamped < 30 && p.status === "active" && p.currentPhase === "E") {
    p.status = "strategy_blocked";
  }
  p.updatedAt = nowIso();
  return { ...p };
}

/**
 * 据数据缺口复算项目完整度（可分析指标占比）→ 派生可信度。
 * 由项目上传/删除/激活后调用（数据完整度 = 可分析指标覆盖率）。
 */
export function recomputeProjectCompleteness(
  projectId: string,
  gaps: GapAnalysis,
): Project | null {
  const total = gaps.canAnalyze.length + gaps.cannotAnalyze.length;
  const pct = total === 0 ? 0 : Math.round((gaps.canAnalyze.length / total) * 100);
  return setCompleteness(projectId, pct);
}

/** 测试用：清空全部项目 */
export function resetProjectStore(): void {
  S.projects = new Map();
}
