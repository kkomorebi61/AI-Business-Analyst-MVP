import { NextResponse } from "next/server";
import { isRange, type Range } from "@/lib/data/daily";
import { dataAgent } from "@/lib/agents/data-agent";
import type { KpiPoint } from "@/lib/agents/types";

/**
 * GET /api/kpis?range=7|14|30|90
 * 首页 KPI 仪表盘的数据来源。
 *
 * 为什么走 API 而不是在客户端直接聚合：
 * daily.ts 顶层静态 import 了 4 个 90 天 mock JSON（经营/会员/营销/渠道，
 * 合计 ~111KB，其中渠道表 64KB）。若 KpiSidebar 在客户端调用 dataAgent，
 * 这 4 份数据会被打进客户端 bundle（首页 First Load 多出 ~29KB gzip）。
 * 下沉到 API 后，重数据留在服务端，客户端只拿到 ~400B 的 KPI 结果。
 *
 * 出参：{ kpis: KpiPoint[]; rangeLabel: string }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rangeNum = Number(searchParams.get("range"));
  const range: Range = isRange(rangeNum) ? rangeNum : 7;

  const { kpis, rangeLabel } = dataAgent(
    ["gmv", "orders", "aov", "conversion"],
    range,
  );

  const body: { kpis: KpiPoint[]; rangeLabel: string } = { kpis, rangeLabel };
  return NextResponse.json(body);
}
