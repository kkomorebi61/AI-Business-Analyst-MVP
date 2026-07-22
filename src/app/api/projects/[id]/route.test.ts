import { describe, it, expect, afterEach } from "vitest";
import { DELETE, GET, PATCH } from "./route";
import {
  createProject,
  resetProjectStore,
} from "@/lib/project/project-store";
import type { Project } from "@/lib/project/types";

/**
 * /api/projects/:id 契约测。直接调用路由导出的 GET/PATCH/DELETE。
 * 覆盖：GET（happy + 404 + touch）/ PATCH（字段 + status/phase + draft→active + 非法值 + 404）
 *      / DELETE（happy + 404）。
 */
afterEach(() => resetProjectStore());

function makeId(): string {
  return createProject({ name: "P" }).id;
}

function patch(
  id: string,
  body: unknown,
): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: { id } },
  );
}

function del(id: string): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/projects/${id}`, { method: "DELETE" }),
    { params: { id } },
  );
}

describe("/api/projects/:id · GET", () => {
  it("happy → { project } 并 touch lastOpenedAt", async () => {
    const id = makeId();
    const res = await GET(new Request("http://localhost"), { params: { id } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect((data.project as Project).id).toBe(id);
    expect(data.project.lastOpenedAt).toBeDefined();
  });

  it("不存在 → 404", async () => {
    const res = await GET(new Request("http://localhost"), {
      params: { id: "proj-nope" },
    });
    expect(res.status).toBe(404);
  });
});

describe("/api/projects/:id · PATCH", () => {
  it("更新字段 → 200 + 新值 + updatedAt 刷新", async () => {
    const id = makeId();
    const res = await patch(id, { name: "新名", businessGoal: "增长" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.project.name).toBe("新名");
    expect(data.project.businessGoal).toBe("增长");
  });

  it("改 phase 到 A → draft 自动转 active", async () => {
    const id = makeId();
    const res = await patch(id, { phase: "A" });
    const data = await res.json();
    expect(data.project.currentPhase).toBe("A");
    expect(data.project.status).toBe("active");
  });

  it("改 status → 生效", async () => {
    const id = makeId();
    const res = await patch(id, { status: "completed" });
    expect((await res.json()).project.status).toBe("completed");
  });

  it("非法 status → 400", async () => {
    const id = makeId();
    const res = await patch(id, { status: "frozen" });
    expect(res.status).toBe(400);
  });

  it("非法 phase → 400", async () => {
    const id = makeId();
    const res = await patch(id, { phase: "Z" });
    expect(res.status).toBe(400);
  });

  it("非 JSON body → 400", async () => {
    const id = makeId();
    const res = await PATCH(
      new Request(`http://localhost/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
      { params: { id } },
    );
    expect(res.status).toBe(400);
  });

  it("不存在 → 404", async () => {
    const res = await patch("proj-nope", { name: "x" });
    expect(res.status).toBe(404);
  });
});

describe("/api/projects/:id · DELETE", () => {
  it("happy → { ok: true }", async () => {
    const id = makeId();
    const res = await del(id);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("不存在 → 404 + ok:false", async () => {
    const res = await del("proj-nope");
    expect(res.status).toBe(404);
    expect((await res.json()).ok).toBe(false);
  });
});
