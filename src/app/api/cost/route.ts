import { NextResponse } from "next/server";
import { getCostSnapshot } from "@/lib/routing/cost-store";

/** 强制动态：读取进程内实时计数器，禁用静态预渲染 */
export const dynamic = "force-dynamic";

/**
 * GET /api/cost —— doc 15 §Cost Monitoring 成本快照
 * 返回 5 指标（请求量 / Token 消耗 / 缓存命中率 / 模型调用率 / 平均成本）+ 4 目标。
 */
export async function GET() {
  return NextResponse.json(getCostSnapshot());
}
