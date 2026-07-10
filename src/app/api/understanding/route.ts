import { NextResponse } from "next/server";
import { getUnderstanding, getUploadedSummary, isSample } from "@/lib/data/dataset-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/understanding —— 当前数据理解结果（doc 19 Data Understanding Engine 输出）。
 *
 * 供 /upload 页、P2 动态驾驶舱、P3 Query Classifier 缺失检查读取。
 * force-dynamic：读进程内 globalStore，禁静态预渲染。
 */
export async function GET() {
  return NextResponse.json({
    understanding: getUnderstanding(),
    isSample: isSample(),
    uploaded: getUploadedSummary(),
  });
}
