import { NextResponse } from "next/server";
import {
  getActiveProjectId,
  getUnderstanding,
  setActiveProject,
} from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";
import { getSuccessDatasets } from "@/lib/project/project-dataset-store";
import { getProject, recomputeProjectCompleteness } from "@/lib/project/project-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/:id/activate —— 激活项目（幂等）。
 *
 * 进入项目时调用：把该项目 success 数据集合并写入 csv-engine 单例，使项目内的诊断/
 * 查询/驾驶舱都读到项目数据（引擎零改动）。重复激活同项目为 no-op（不重算、不清缓存）。
 * 无 success 数据集 → 置空事实（诚实，不回落样本）。返回合并后的 understanding。
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  if (getActiveProjectId() === params.id) {
    return NextResponse.json({
      ok: true,
      alreadyActive: true,
      understanding: getUnderstanding(),
    });
  }

  const u = setActiveProject(params.id, getSuccessDatasets(params.id), project.name);
  recomputeProjectCompleteness(params.id, u.gaps);
  resetCache();
  return NextResponse.json({ ok: true, understanding: u });
}
