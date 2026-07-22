import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/project/project-store";
import type { CreateProjectInput } from "@/lib/project/types";

export const dynamic = "force-dynamic";

/**
 * Project 管理 API（Phase 1）。
 *
 * GET  /api/projects        → { projects: Project[] }
 * POST /api/projects        → body CreateProjectInput（均可选）→ { project: Project }
 *
 * force-dynamic：读/写进程内 globalStore，禁静态预渲染（与 /api/datasets 同口径）。
 */
export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(req: Request) {
  let body: Partial<CreateProjectInput>;
  try {
    body = (await req.json()) as Partial<CreateProjectInput>;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
  }

  const project = createProject({
    name: body.name,
    industry: body.industry,
    businessGoal: body.businessGoal,
    perspective: body.perspective,
    ownerId: body.ownerId,
    sourceCaseId: body.sourceCaseId,
  });
  return NextResponse.json({ project }, { status: 201 });
}
