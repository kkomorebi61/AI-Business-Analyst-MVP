import { NextResponse } from "next/server";
import {
  addTask,
  deleteTask,
  generateTasks,
  listTasks,
  updateTask,
  type Task,
  type TaskStatus,
} from "@/lib/project/task-store";
import { getProject } from "@/lib/project/project-store";

export const dynamic = "force-dynamic";

/**
 * 项目任务 API（Step 7 / phase G · 执行计划）。
 * GET    → { tasks }
 * POST   → {action:"generate", strategy:{...}} 生成任务 ｜ {action:"add", task} 新增单条
 * PATCH  → {id, status?/owner?/deadline?/metric?} 更新
 * DELETE → {id} 删除
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  return NextResponse.json({ tasks: listTasks(params.id) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (body.action === "generate") {
    const s = body.strategy as {
      id: string;
      name: string;
      channel: string[];
      targetUser: string;
      expectedMetric: string[];
    };
    if (!s || !s.id) {
      return NextResponse.json({ error: "缺少 strategy 信息" }, { status: 400 });
    }
    const created = generateTasks(params.id, {
      strategyId: s.id,
      strategyName: s.name,
      channel: s.channel ?? [],
      targetUser: s.targetUser ?? "",
      expectedMetric: s.expectedMetric ?? [],
    });
    return NextResponse.json({ tasks: created, all: listTasks(params.id) }, { status: 201 });
  }

  if (body.action === "add") {
    const t = body.task as Partial<Task>;
    if (!t?.taskName) {
      return NextResponse.json({ error: "缺少 taskName" }, { status: 400 });
    }
    const created = addTask(params.id, {
      strategyId: t.strategyId ?? null,
      taskName: t.taskName,
      owner: t.owner ?? "—",
      system: t.system ?? "—",
      deadline: t.deadline ?? "T+7",
      metric: t.metric ?? "",
      status: (t.status as TaskStatus) ?? "todo",
    });
    return NextResponse.json({ task: created, all: listTasks(params.id) }, { status: 201 });
  }

  return NextResponse.json({ error: "未知 action" }, { status: 400 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  let body: { id?: string; status?: TaskStatus; owner?: string; deadline?: string; metric?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  const updated = updateTask(body.id, {
    status: body.status,
    owner: body.owner,
    deadline: body.deadline,
    metric: body.metric,
  });
  if (!updated) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }
  return NextResponse.json({ task: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  const ok = deleteTask(id);
  if (!ok) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, all: listTasks(params.id) });
}
