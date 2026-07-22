import { NextResponse } from "next/server";
import {
  deleteProject,
  getProject,
  touchProject,
  updateProject,
} from "@/lib/project/project-store";
import { clearProjectDatasets } from "@/lib/project/project-dataset-store";
import { deleteProjectTasks } from "@/lib/project/task-store";
import { clearActiveProject, getActiveProjectId } from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";
import type { UpdateProjectInput } from "@/lib/project/types";

export const dynamic = "force-dynamic";

/**
 * Project 单项 API（Phase 1）。
 *
 * GET   /api/projects/:id   → { project }（404 若不存在）；同时 touch lastOpenedAt（续作支持）
 * PATCH /api/projects/:id   → body UpdateProjectInput 子集（name/industry/businessGoal/
 *                             perspective/ownerId/status/phase）→ { project }
 * DELETE /api/projects/:id  → { ok: true }（404 若不存在）
 *
 * force-dynamic：读写进程内 globalStore，禁静态预渲染。
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  // 续作：打开即记录最近访问时间（不触发 updatedAt）
  const touched = touchProject(params.id) ?? project;
  return NextResponse.json({ project: touched });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: UpdateProjectInput;
  try {
    body = (await req.json()) as UpdateProjectInput;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!getProject(params.id)) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  try {
    const project = updateProject(params.id, body);
    return NextResponse.json({ project });
  } catch (e) {
    // 非法 status/phase 等
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "更新失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const res = deleteProject(params.id);
  if (!res.ok) {
    return NextResponse.json({ ok: false, reason: res.reason }, { status: 404 });
  }
  // 级联：清该项目数据集 + 任务；若它是当前激活项目 → 退出项目 + 清缓存
  clearProjectDatasets(params.id);
  deleteProjectTasks(params.id);
  if (getActiveProjectId() === params.id) {
    clearActiveProject();
    resetCache();
  }
  return NextResponse.json({ ok: true });
}
