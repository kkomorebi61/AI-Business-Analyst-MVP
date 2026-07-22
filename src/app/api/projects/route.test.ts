import { describe, it, expect, afterEach } from "vitest";
import { GET, POST } from "./route";
import { resetProjectStore, listProjects } from "@/lib/project/project-store";

/**
 * /api/projects 契约测。直接调用路由导出的 GET/POST（NextResponse 可在 node 环境解析）。
 * 覆盖：GET 空列表 / POST 创建（happy + 默认值 + 透传 + 参数校验）。
 */
afterEach(() => resetProjectStore());

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("/api/projects · 契约", () => {
  it("GET 空列表 → { projects: [] }", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.projects).toEqual([]);
  });

  it("GET 反映已创建项目", async () => {
    await post({ name: "A" });
    const data = await (await GET()).json();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe("A");
  });

  it("POST 创建 → 201 + project（含默认值 id/status/phase）", async () => {
    const res = await post({ name: "GMV 下滑归因", industry: "ECOMMERCE" });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.project.id).toMatch(/^proj-/);
    expect(data.project.name).toBe("GMV 下滑归因");
    expect(data.project.industry).toBe("ECOMMERCE");
    expect(data.project.status).toBe("draft");
    expect(data.project.currentPhase).toBe("PRE_A");
    // 已真正写入 store
    expect(listProjects()).toHaveLength(1);
  });

  it("POST 空对象 → 用默认值创建（可接受）", async () => {
    const res = await post({});
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.project.name).toBeTruthy();
  });

  it("POST 非 JSON body → 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST JSON 数组（非对象）→ 400", async () => {
    const res = await post([1, 2, 3]);
    expect(res.status).toBe(400);
  });
});
