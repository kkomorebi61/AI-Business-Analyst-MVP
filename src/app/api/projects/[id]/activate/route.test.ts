import { describe, it, expect, afterEach } from "vitest";
import { POST } from "./route";
import { createProject, resetProjectStore } from "@/lib/project/project-store";
import { resetProjectDatasetStore } from "@/lib/project/project-dataset-store";
import { getActiveProjectId, resetDatasetStore } from "@/lib/data/dataset-store";
import { resetFacts } from "@/lib/data/csv-engine";
import { resetCache } from "@/lib/routing/cache";

afterEach(() => {
  resetProjectStore();
  resetProjectDatasetStore();
  resetDatasetStore();
  resetFacts();
  resetCache();
});

function activate(id: string): Promise<Response> {
  return POST(new Request(`http://localhost/api/projects/${id}/activate`, { method: "POST" }), {
    params: { id },
  });
}

describe("/api/projects/:id/activate · 幂等激活", () => {
  it("不存在项目 → 404", async () => {
    const res = await activate("nope");
    expect(res.status).toBe(404);
  });

  it("激活 → ok + understanding + activeProjectId===id（空项目也成立）", async () => {
    const p = createProject({ name: "t" });
    const res = await activate(p.id);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.understanding).toBeTruthy();
    expect(getActiveProjectId()).toBe(p.id);
  });

  it("重复激活 → alreadyActive true（幂等，不重算）", async () => {
    const p = createProject({ name: "t" });
    await activate(p.id);
    const res = await activate(p.id);
    const data = await res.json();
    expect(data.alreadyActive).toBe(true);
    expect(getActiveProjectId()).toBe(p.id);
  });
});
