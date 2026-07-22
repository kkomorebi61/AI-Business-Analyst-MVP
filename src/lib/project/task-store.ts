/**
 * Task Store —— 执行计划任务（Sprint 3 · 策略→执行）。
 *
 * 策略被「采用」后，由 generateTasks 从策略的渠道/人群/指标派生 Action Plan 任务
 * （Task：task/owner/system/deadline/metric/status）。进程内 globalStore（无 DB、HMR guard）。
 * 效果追踪（Before/Target/After）由 StrategyCard.tracking 承载，本表追踪执行状态。
 */

export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  projectId: string;
  strategyId: string | null;
  taskName: string;
  owner: string;
  system: string;
  deadline: string; // T+3 等
  metric: string; // 目标/验收口径
  status: TaskStatus;
  createdAt: string;
}

interface Store {
  tasks: Map<string, Task>;
}

const g = globalThis as unknown as { __ANALYST_TASKS__?: Store };
g.__ANALYST_TASKS__ ??= { tasks: new Map() };
const S = g.__ANALYST_TASKS__!;

function newId(): string {
  return `task-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function listTasks(projectId: string): Task[] {
  return Array.from(S.tasks.values())
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => ({ ...t }));
}

export function addTask(
  projectId: string,
  rec: Omit<Task, "id" | "projectId" | "createdAt">,
): Task {
  const t: Task = { ...rec, id: newId(), projectId, createdAt: new Date().toISOString() };
  S.tasks.set(t.id, t);
  return { ...t };
}

export function updateTask(
  id: string,
  patch: Partial<Pick<Task, "status" | "owner" | "deadline" | "metric">>,
): Task | null {
  const t = S.tasks.get(id);
  if (!t) return null;
  Object.assign(t, patch);
  return { ...t };
}

export function deleteTask(id: string): boolean {
  return S.tasks.delete(id);
}

/** 删除某项目的全部任务（项目删除级联用） */
export function deleteProjectTasks(projectId: string): number {
  let n = 0;
  for (const [id, t] of Array.from(S.tasks.entries())) {
    if (t.projectId === projectId) {
      S.tasks.delete(id);
      n++;
    }
  }
  return n;
}

/** 测试用：清空全部 */
export function resetTaskStore(): void {
  S.tasks = new Map();
}

/**
 * Task Generator：从采用的策略派生 Action Plan 任务（模板化、可改）。
 * 每条策略 → 人群准备 + 渠道触达 + 优惠配置 + 效果复盘。
 */
export function generateTasks(
  projectId: string,
  input: {
    strategyId: string;
    strategyName: string;
    channel: string[];
    targetUser: string;
    expectedMetric: string[];
  },
): Task[] {
  const metricLabel = input.expectedMetric[0] ?? input.strategyName;
  const owners = ["CRM 运营", "营销运营", "数据分析"];
  void owners;
  const created: Task[] = [];

  created.push(
    addTask(projectId, {
      strategyId: input.strategyId,
      taskName: `创建目标人群（${input.targetUser || "目标人群"}）`,
      owner: "CRM 运营",
      system: "会员中心",
      deadline: "T+3",
      metric: `生成${input.targetUser || "目标"}人群名单`,
      status: "todo",
    }),
  );

  for (const ch of input.channel.slice(0, 2)) {
    created.push(
      addTask(projectId, {
        strategyId: input.strategyId,
        taskName: `配置${ch}触达任务`,
        owner: "营销运营",
        system: ch,
        deadline: "T+5",
        metric: "触达率 > 80%",
        status: "todo",
      }),
    );
  }

  created.push(
    addTask(projectId, {
      strategyId: input.strategyId,
      taskName: "配置优惠 / 权益",
      owner: "营销运营",
      system: "营销中心",
      deadline: "T+7",
      metric: `提升${metricLabel}`,
      status: "todo",
    }),
  );

  created.push(
    addTask(projectId, {
      strategyId: input.strategyId,
      taskName: "效果复盘",
      owner: "数据分析",
      system: "BI",
      deadline: "T+14",
      metric: `${metricLabel} 前后对比`,
      status: "todo",
    }),
  );

  return created;
}
