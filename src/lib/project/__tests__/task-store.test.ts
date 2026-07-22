import { describe, it, expect, afterEach } from "vitest";
import {
  addTask,
  deleteProjectTasks,
  deleteTask,
  generateTasks,
  listTasks,
  resetTaskStore,
  updateTask,
} from "@/lib/project/task-store";

afterEach(() => resetTaskStore());

const BODY = {
  strategyId: null,
  taskName: "t",
  owner: "o",
  system: "s",
  deadline: "T+3",
  metric: "m",
  status: "todo" as const,
};

describe("task-store · CRUD + 生成", () => {
  it("add + list（按时间）", () => {
    const t = addTask("p1", { ...BODY });
    expect(listTasks("p1")).toHaveLength(1);
    expect(t.status).toBe("todo");
    expect(t.projectId).toBe("p1");
  });

  it("list 跨项目隔离", () => {
    addTask("p1", { ...BODY });
    addTask("p2", { ...BODY });
    expect(listTasks("p1")).toHaveLength(1);
    expect(listTasks("p2")).toHaveLength(1);
  });

  it("updateTask 改状态", () => {
    const t = addTask("p1", { ...BODY });
    const u = updateTask(t.id, { status: "done" });
    expect(u?.status).toBe("done");
    expect(listTasks("p1")[0].status).toBe("done");
  });

  it("deleteTask + deleteProjectTasks", () => {
    const t = addTask("p1", { ...BODY });
    addTask("p2", { ...BODY });
    expect(deleteTask(t.id)).toBe(true);
    expect(deleteTask("nope")).toBe(false);
    expect(deleteProjectTasks("p2")).toBe(1);
    expect(listTasks("p1")).toHaveLength(0);
  });

  it("generateTasks：每策略 ≥4 条任务", () => {
    const created = generateTasks("p1", {
      strategyId: "S1",
      strategyName: "召回",
      channel: ["企业微信", "短信"],
      targetUser: "VIP",
      expectedMetric: ["复购率"],
    });
    expect(created.length).toBeGreaterThanOrEqual(4);
    expect(listTasks("p1").length).toBe(created.length);
    expect(created.every((t) => t.strategyId === "S1")).toBe(true);
  });
});
