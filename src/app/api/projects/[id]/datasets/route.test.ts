import { describe, it, expect, afterEach } from "vitest";
import { GET, POST } from "./route";
import { DELETE } from "./[datasetId]/route";
import { createProject, resetProjectStore } from "@/lib/project/project-store";
import { listProjectDatasets, resetProjectDatasetStore } from "@/lib/project/project-dataset-store";
import { resetDatasetStore } from "@/lib/data/dataset-store";
import { resetFacts } from "@/lib/data/csv-engine";
import { resetCache } from "@/lib/routing/cache";

afterEach(() => {
  resetProjectStore();
  resetProjectDatasetStore();
  resetDatasetStore();
  resetFacts();
  resetCache();
});

const CH_CSV =
  "date,channel,gmv,orders,visitors,buyers\n" +
  Array.from({ length: 5 }, (_, i) => `2026-06-2${i},TMALL,1000,10,100,9`).join("\n");
const RAW_CSV = "order_id,customer_id,order_amount,order_date\n1,c1,99,2026-06-20";

function postForm(id: string, csv: string, name = "ch.csv"): Promise<Response> {
  const form = new FormData();
  form.append("files", new File([csv], name, { type: "text/csv" }));
  return POST(
    new Request(`http://localhost/api/projects/${id}/datasets`, { method: "POST", body: form }),
    { params: { id } },
  );
}

describe("/api/projects/:id/datasets · 契约", () => {
  it("GET 不存在项目 → 404", async () => {
    const res = await GET({} as Request, { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });

  it("GET 空项目 → datasets []", async () => {
    const p = createProject({ name: "t" });
    const res = await GET({} as Request, { params: { id: p.id } });
    expect(res.status).toBe(200);
    expect((await res.json()).datasets).toEqual([]);
  });

  it("POST 上传成功 → dataset.success + recordCount + understanding", async () => {
    const p = createProject({ name: "t" });
    const res = await postForm(p.id, CH_CSV);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.dataset.ingestStatus).toBe("success");
    expect(data.dataset.recordCount).toBe(5);
    expect(data.understanding).toBeTruthy();
  });

  it("POST raw 事务流水 → dataset.failed（含「按日聚合」）+ 入列表", async () => {
    const p = createProject({ name: "t" });
    const res = await postForm(p.id, RAW_CSV, "orders.csv");
    const data = await res.json();
    expect(data.dataset.ingestStatus).toBe("failed");
    expect(data.dataset.ingestError).toContain("按日聚合");
    expect(data.understanding).toBeNull();
    expect(listProjectDatasets(p.id)).toHaveLength(1); // failed 也持久化
  });

  it("DELETE → 删除并回填 datasets", async () => {
    const p = createProject({ name: "t" });
    await postForm(p.id, CH_CSV);
    const before = listProjectDatasets(p.id);
    expect(before).toHaveLength(1);
    const res = await DELETE({} as Request, {
      params: { id: p.id, datasetId: before[0].id },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).datasets).toEqual([]);
  });

  it("DELETE 不存在 → 404", async () => {
    const p = createProject({ name: "t" });
    const res = await DELETE({} as Request, {
      params: { id: p.id, datasetId: "pds-nope" },
    });
    expect(res.status).toBe(404);
  });
});
