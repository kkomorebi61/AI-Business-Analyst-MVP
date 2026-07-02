import { NextResponse } from "next/server";
import { isRange, type Range } from "@/lib/data/daily";
import { runWorkflow } from "@/lib/agents/workflow";
import type { Role } from "@/lib/kb/metric-kb";

/**
 * POST /api/analyze
 * 入参：{ question: string; perspective?: Role; range?: 7|14|30|90 }
 * 出参：AnalysisResult（Role→Intent→Metric→Data→Insight 工作流产物）
 */
export async function POST(req: Request) {
  let body: { question?: string; perspective?: Role; range?: number };
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
  const result = runWorkflow({ question, perspective: body.perspective, range });
  return NextResponse.json(result);
}
