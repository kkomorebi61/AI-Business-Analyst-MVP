import { NextResponse } from "next/server";
import { isRange, type Range } from "@/lib/data/daily";
import { routeQuery } from "@/lib/routing/router";
import { classifyRule } from "@/lib/routing/query-classifier";
import type { Role } from "@/lib/kb/metric-kb";

const ROLES: Role[] = ["CEO", "CRM_MANAGER", "OPERATION_MANAGER"];
function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

/**
 * POST /api/query —— AI 决策路由统一入口（doc 18 §Query Classifier + doc 15 §Cost Architecture）
 *
 * 入参：{ question: string; range?: 7|14|30|90; role?: "CEO"|"CRM_MANAGER"|"OPERATION_MANAGER" }
 * 出参：QueryResult { question, classification, routing, answer, cost }
 *
 * 链路：Question → QueryClassifier（Rule First + GLM 兜底）→ Router → 最优执行路径。
 * role 参与 doc 15 P3 缓存键（Question/Range/Role/Brand）并驱动 Insight 工作流 perspective。
 */
export async function POST(req: Request) {
  let body: { question?: string; range?: number; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "缺少 question 参数" }, { status: 400 });
  }

  const range: Range = isRange(body.range) ? body.range : 7;
  const role: Role | undefined = isRole(body.role) ? body.role : undefined;

  try {
    const result = await routeQuery({ question, range, role });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "路由执行失败" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/query?question=... —— 仅分类（Rule First，同步、零成本）。
 * 不取数、不调 LLM；用于前端「输入即显示将走哪条路径」的实时预览。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const question = (url.searchParams.get("question") ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "缺少 question 参数" }, { status: 400 });
  }
  return NextResponse.json(classifyRule(question));
}
