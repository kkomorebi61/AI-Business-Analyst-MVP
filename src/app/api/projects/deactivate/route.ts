import { NextResponse } from "next/server";
import { clearActiveProject } from "@/lib/data/dataset-store";
import { resetCache } from "@/lib/routing/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/deactivate —— 退出项目，回到内置样本（沙盒）。
 *
 * 由独立沙盒页（/、/cockpit、/query）挂载时调用，确保这些页面始终读样本、不与项目数据串台。
 * 仅清 activeProjectId + projectMerge + 回落样本；不清沙盒已上传数据集（S.datasets 保留）。
 */
export async function POST() {
  clearActiveProject();
  resetCache();
  return NextResponse.json({ ok: true });
}
