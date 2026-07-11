import { NextResponse } from "next/server";
import {
  deleteDataset,
  getCurrentDatasetSummary,
  listDatasets,
  switchDataset,
} from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";

export const dynamic = "force-dynamic";

/**
 * Dataset Visibility —— 数据集管理 API。
 *
 * GET  /api/datasets            → { datasets: DatasetSummary[], current: DatasetSummary }
 * POST /api/datasets            → body { action: "switch" | "delete", id }
 *   - switch：切换 Active Dataset（同步 csv-engine Active Facts + 清查询缓存）
 *   - delete：删除数据集（不可删 sample、不可删当前 active）
 *
 * force-dynamic：读/写进程内 globalStore，禁静态预渲染。
 * 查询缓存清空放路由层（与 /api/upload 同口径），避免数据层反向依赖路由层。
 */
export async function GET() {
  return NextResponse.json({
    datasets: listDatasets(),
    current: getCurrentDatasetSummary(),
  });
}

export async function POST(req: Request) {
  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { action, id } = body;
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  if (action === "switch") {
    try {
      switchDataset(id);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "切换失败" },
        { status: 404 },
      );
    }
    resetCache(); // Active 已变，旧答案缓存失效
    return NextResponse.json({
      ok: true,
      current: getCurrentDatasetSummary(),
      datasets: listDatasets(),
    });
  }

  if (action === "delete") {
    const res = deleteDataset(id);
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: res.reason }, { status: 400 });
    }
    // active 未变（deleteDataset 拒删当前 active），无需 resetCache
    return NextResponse.json({
      ok: true,
      datasets: listDatasets(),
      current: getCurrentDatasetSummary(),
    });
  }

  return NextResponse.json({ error: "未知 action（支持 switch | delete）" }, { status: 400 });
}
