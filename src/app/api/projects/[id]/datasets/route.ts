import { NextResponse } from "next/server";
import { parseCsvText } from "@/lib/data/csv-engine";
import { getActiveProjectId, setActiveProject } from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";
import type { DatasetFile } from "@/lib/data-understanding/types";
import {
  addProjectDataset,
  buildDatasetRecordFromIngest,
  getSuccessDatasets,
  listProjectDatasets,
} from "@/lib/project/project-dataset-store";
import { getProject, recomputeProjectCompleteness } from "@/lib/project/project-store";

export const dynamic = "force-dynamic";

/**
 * 项目数据集 API（Sprint 1 · Data Collection V2）。
 *
 * GET  /api/projects/:id/datasets  → { datasets: ProjectDatasetSummary[] }（404 项目不存在）
 * POST /api/projects/:id/datasets  → multipart files：解析 → 入库工厂（成功/失败矩阵）→ 持久化。
 *        成功且当前项目激活 → 合并复算 + 复算完整度 + resetCache。
 *        失败（raw/空/无规范字段）同样持久化为 failed 记录（200），前端展示原因 + 重新上传。
 *
 * force-dynamic：读写进程内 globalStore。缓存清空放路由层（键不含项目/数据集标识）。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  return NextResponse.json({ datasets: listProjectDatasets(params.id) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 multipart/form-data" }, { status: 400 });
  }

  const entries = form.getAll("files").filter((f): f is File => f instanceof File);
  const files: DatasetFile[] = [];
  for (const f of entries) {
    const text = await f.text();
    const rows = parseCsvText(text);
    if (!rows.length) continue; // 跳过空文件
    files.push({ name: f.name, columns: Object.keys(rows[0]), rows });
  }

  // 入库工厂：返回 success/failed 记录 +（成功时）understanding
  const outcome = buildDatasetRecordFromIngest(params.id, files);
  const { id: _id, projectId: _pid, uploadTime: _ut, ...recBody } = outcome.record;
  void _id;
  void _pid;
  void _ut;
  const saved = addProjectDataset(params.id, recBody);

  // 成功 + 当前项目激活 → 合并复算 understanding + 复算完整度 + 清缓存
  let understanding = outcome.understanding;
  if (saved.ingestStatus === "success" && getActiveProjectId() === params.id) {
    understanding = setActiveProject(
      params.id,
      getSuccessDatasets(params.id),
      project.name,
    );
    recomputeProjectCompleteness(params.id, understanding.gaps);
    resetCache();
  }

  return NextResponse.json({ dataset: saved, understanding }, { status: 201 });
}
