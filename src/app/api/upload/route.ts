import { NextResponse } from "next/server";
import { parseCsvText } from "@/lib/data/csv-engine";
import { resetToSample, setUploaded } from "@/lib/data/dataset-store";
import type { DatasetFile } from "@/lib/data-understanding/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload —— Data First 入口（doc 19 §Upload Data）
 *
 * 两种动作（form 字段 action 区分）：
 *   - action="sample"（默认无文件）：重置为内置样本
 *   - 上传一个或多个 .csv：解析 → Data Understanding Engine → 设为活跃数据集
 *
 * 返回最新的 UnderstandingResult（分类 / 场景 / 推荐 / 缺口 / Date Anchor / dashboardSpec）。
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 multipart/form-data" }, { status: 400 });
  }

  // 动作：重置为样本
  if (form.get("action") === "sample") {
    return NextResponse.json(resetToSample());
  }

  const entries = form.getAll("files").filter((f): f is File => f instanceof File);
  if (entries.length === 0) {
    return NextResponse.json({ error: "未上传任何文件（或使用 action=sample 加载内置样本）" }, { status: 400 });
  }

  const files: DatasetFile[] = [];
  for (const f of entries) {
    const text = await f.text();
    const rows = parseCsvText(text);
    if (!rows.length) continue; // 跳过空文件
    const columns = Object.keys(rows[0]);
    files.push({ name: f.name, columns, rows });
  }

  if (!files.length) {
    return NextResponse.json({ error: "上传的 CSV 均无有效数据行" }, { status: 400 });
  }

  return NextResponse.json(setUploaded(files));
}
