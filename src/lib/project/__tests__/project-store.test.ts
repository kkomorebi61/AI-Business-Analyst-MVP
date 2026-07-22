import { describe, it, expect, afterEach } from "vitest";
import {
  advancePhase,
  countProjects,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  resetProjectStore,
  setCompleteness,
  touchProject,
  updatePhase,
  updateProject,
  updateStatus,
} from "@/lib/project/project-store";
import { credibilityFromCompleteness, PHASE_INDEX, PHASE_ORDER } from "@/lib/project/labels";
import type { Project } from "@/lib/project/types";

afterEach(() => resetProjectStore());

describe("Project Store · 创建 / 默认值", () => {
  it("createProject 空入参 → 合法默认项目（draft / PRE_A / CEO / RETAIL / 完整度 0）", () => {
    const p = createProject();
    expect(p.id).toMatch(/^proj-/);
    expect(p.status).toBe("draft");
    expect(p.currentPhase).toBe("PRE_A");
    expect(p.perspective).toBe("CEO");
    expect(p.industry).toBe("RETAIL");
    expect(p.dataCompletenessPct).toBe(0);
    expect(p.credibilityLevel).toBe("INSUFFICIENT");
    expect(p.name).toBeTruthy();
  });

  it("createProject 透传入参；getProject 取回一致", () => {
    const created = createProject({
      name: "GMV 下滑归因",
      industry: "ECOMMERCE",
      businessGoal: "找回增长",
      perspective: "CRM_MANAGER",
      ownerId: "u1",
    });
    const got = getProject(created.id)!;
    expect(got.name).toBe("GMV 下滑归因");
    expect(got.industry).toBe("ECOMMERCE");
    expect(got.businessGoal).toBe("找回增长");
    expect(got.perspective).toBe("CRM_MANAGER");
    expect(got.ownerId).toBe("u1");
  });

  it("createProject name 空白 → 用默认名（不落空串）", () => {
    const p = createProject({ name: "   " });
    expect(p.name).not.toBe("");
    expect(p.name.trim().length).toBeGreaterThan(0);
  });
});

describe("Project Store · 列表 / 计数", () => {
  it("初始为空", () => {
    expect(listProjects()).toHaveLength(0);
    expect(countProjects()).toBe(0);
  });

  it("listProjects 按活跃优先 + updatedAt 倒序，返回浅拷贝", () => {
    const a = createProject({ name: "a" });
    const b = createProject({ name: "b" });
    updateStatus(a.id, "completed");
    // b 仍 draft → 应排在 a（completed）之前
    const list = listProjects();
    expect(list.map((p) => p.id)).toEqual([b.id, a.id]);
    // 浅拷贝：改 list 不影响内存态
    list[0].name = "mutated";
    expect(getProject(b.id)!.name).toBe("b");
  });

  it("getProject 不存在 → null", () => {
    expect(getProject("proj-nope")).toBeNull();
  });
});

describe("Project Store · 更新 / 状态机", () => {
  it("updateProject 更新字段并刷新 updatedAt", () => {
    const p = createProject({ name: "x", businessGoal: "g" });
    const before = p.updatedAt;
    const updated = updateProject(p.id, {
      name: "y",
      businessGoal: "g2",
      industry: "BEAUTY",
      perspective: "OPERATION_MANAGER",
    })!;
    expect(updated.name).toBe("y");
    expect(updated.businessGoal).toBe("g2");
    expect(updated.industry).toBe("BEAUTY");
    expect(updated.perspective).toBe("OPERATION_MANAGER");
    expect(updated.updatedAt >= before).toBe(true);
  });

  it("updateProject 仅应用显式字段（未提供的 businessGoal 不被清空）", () => {
    const p = createProject({ businessGoal: "keep me" });
    const updated = updateProject(p.id, { name: "new" })!;
    expect(updated.businessGoal).toBe("keep me");
  });

  it("updateProject 不存在 → null", () => {
    expect(updateProject("proj-nope", { name: "x" })).toBeNull();
  });

  it("updateProject 非法 status → 抛错", () => {
    const p = createProject();
    expect(() => updateProject(p.id, { status: "frozen" as never })).toThrow();
  });

  it("updateProject 非法 phase → 抛错", () => {
    const p = createProject();
    expect(() => updateProject(p.id, { phase: "Z" as never })).toThrow();
  });

  it("进入流程（phase≥A）时 draft 自动转 active", () => {
    const p = createProject();
    expect(p.status).toBe("draft");
    const updated = updatePhase(p.id, "A")!;
    expect(updated.currentPhase).toBe("A");
    expect(updated.status).toBe("active");
  });

  it("updateStatus / updatePhase 便捷方法一致", () => {
    const p = createProject();
    updatePhase(p.id, "C");
    expect(getProject(p.id)!.currentPhase).toBe("C");
    updateStatus(p.id, "completed");
    expect(getProject(p.id)!.status).toBe("completed");
  });

  it("advancePhase 走 happy path；到 H 后原地不动", () => {
    const p = createProject();
    for (const phase of ["A", "B", "C", "D", "E", "F", "G", "H"] as const) {
      advancePhase(p.id);
      expect(getProject(p.id)!.currentPhase).toBe(phase);
    }
    advancePhase(p.id); // 已在 H
    expect(getProject(p.id)!.currentPhase).toBe("H");
  });

  it("updatePhase 允许回边（补数据回到 B）", () => {
    const p = createProject();
    updatePhase(p.id, "E");
    updatePhase(p.id, "B"); // 回边
    expect(getProject(p.id)!.currentPhase).toBe("B");
  });

  it("PHASE_ORDER 顺序自洽：索引单调", () => {
    expect(PHASE_ORDER[0]).toBe("PRE_A");
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe("H");
    expect(PHASE_INDEX.PRE_A).toBe(0);
    expect(PHASE_INDEX.H).toBe(PHASE_ORDER.length - 1);
  });
});

describe("Project Store · 完整度 / 可信度 / 硬门", () => {
  it("credibilityFromCompleteness 阈值：80/50/30", () => {
    expect(credibilityFromCompleteness(80)).toBe("CREDIBLE");
    expect(credibilityFromCompleteness(79)).toBe("BASICALLY_CREDIBLE");
    expect(credibilityFromCompleteness(50)).toBe("BASICALLY_CREDIBLE");
    expect(credibilityFromCompleteness(49)).toBe("CAUTIOUS");
    expect(credibilityFromCompleteness(30)).toBe("CAUTIOUS");
    expect(credibilityFromCompleteness(29)).toBe("INSUFFICIENT");
    expect(credibilityFromCompleteness(0)).toBe("INSUFFICIENT");
  });

  it("setCompleteness 派生可信度并钳制到 0–100", () => {
    const p = createProject();
    const u = setCompleteness(p.id, 150)!;
    expect(u.dataCompletenessPct).toBe(100);
    expect(u.credibilityLevel).toBe("CREDIBLE");
    const u2 = setCompleteness(p.id, -5)!;
    expect(u2.dataCompletenessPct).toBe(0);
  });

  it("硬门：完整度 <30% 且在 E 阶段 → status 转 strategy_blocked", () => {
    const p = createProject();
    updatePhase(p.id, "E"); // 进入流程 → active
    expect(getProject(p.id)!.status).toBe("active");
    const u = setCompleteness(p.id, 20)!;
    expect(u.status).toBe("strategy_blocked");
  });

  it("硬门不误触发：非 E 阶段或完整度 ≥30% 不改 status", () => {
    const p = createProject();
    updatePhase(p.id, "C");
    setCompleteness(p.id, 10);
    expect(getProject(p.id)!.status).toBe("active"); // C 阶段不受门控

    updatePhase(p.id, "E");
    setCompleteness(p.id, 45);
    expect(getProject(p.id)!.status).toBe("active"); // ≥30% 不拦
  });
});

describe("Project Store · 删除 / touch", () => {
  it("deleteProject 删除后取不到", () => {
    const p = createProject();
    expect(deleteProject(p.id).ok).toBe(true);
    expect(getProject(p.id)).toBeNull();
    expect(countProjects()).toBe(0);
  });

  it("deleteProject 不存在 → ok:false", () => {
    expect(deleteProject("proj-nope").ok).toBe(false);
  });

  it("touchProject 更新 lastOpenedAt 但不改变 updatedAt；不存在 → null", () => {
    const p = createProject();
    const beforeUpdate = p.updatedAt;
    const touched = touchProject(p.id)!;
    expect(touched.lastOpenedAt).toBeDefined();
    // updatedAt 不应被 touch 改变（仅 lastOpenedAt 变）
    expect(getProject(p.id)!.updatedAt).toBe(beforeUpdate);
    expect(touchProject("proj-nope")).toBeNull();
  });

  it("resetProjectStore 清空全部", () => {
    createProject();
    createProject();
    expect(countProjects()).toBe(2);
    resetProjectStore();
    expect(countProjects()).toBe(0);
  });
});

describe("Project Store · 返回值隔离", () => {
  it("createProject 返回的是拷贝，外部修改不影响内存态", () => {
    const p: Project = createProject({ name: "orig" });
    p.name = "tampered";
    expect(getProject(p.id)!.name).toBe("orig");
  });
});
