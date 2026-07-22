import { NextResponse } from "next/server";
import { getActiveProjectId, setActiveProject } from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";
import {
  deleteProjectDataset,
  getSuccessDatasets,
  listProjectDatasets,
} from "@/lib/project/project-dataset-store";
import { getProject, recomputeProjectCompleteness } from "@/lib/project/project-store";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/projects/:id/datasets/:datasetId —— 删除项目内一份数据集。
 * 删除后若该项目激活 → 重新合并剩余 success 数据集 + 复算完整度 + resetCache。
 * 返回 { ok, datasets }（删除后最新列表），前端直接回填免二次请求。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; datasetId: string } },
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const res = deleteProjectDataset(params.id, params.datasetId);
  if (!res.ok) {
    return NextResponse.json({ ok: false, reason: res.reason }, { status: 404 });
  }

  if (getActiveProjectId() === params.id) {
    const u = setActiveProject(params.id, getSuccessDatasets(params.id), project.name);
    recomputeProjectCompleteness(params.id, u.gaps);
    resetCache();
  }

  return NextResponse.json({ ok: true, datasets: listProjectDatasets(params.id) });
}
