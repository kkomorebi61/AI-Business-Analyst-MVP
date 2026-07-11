import { describe, it, expect, afterEach } from "vitest";
import { GET, POST } from "./route";
import {
  setUploaded,
  resetDatasetStore,
  getCurrentDataset,
  type DatasetSummary,
} from "@/lib/data/dataset-store";
import {
  cachePut,
  cacheGet,
  resetCache,
  buildCacheKey,
  CADENCE_TTL_MS,
} from "@/lib/routing/cache";

/**
 * /api/datasets 契约测（Dataset Visibility Task 14）。
 * 直接调用路由导出的 GET/POST（NextResponse 可在 node 环境解析），不启服务器。
 * 覆盖：GET 形状 / POST switch（happy + 不存在 + 清缓存）/ delete 守卫 / delete happy / 参数校验。
 */
afterEach(() => {
  resetDatasetStore();
  resetCache();
});

function chFile(days = 5, gmv = "1000") {
  const start = new Date("2026-06-20");
  const rows = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      channel: "TMALL",
      gmv,
      orders: "10",
      visitors: "100",
      buyers: "9",
    };
  });
  return {
    name: "ch.csv",
    columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"],
    rows,
  };
}

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("/api/datasets · 契约", () => {
  it("GET → { datasets, current }；初始仅 sample 且为 current", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.datasets).toHaveLength(1);
    expect(data.datasets[0].datasetId).toBe("sample");
    expect(data.current.datasetId).toBe("sample");
    expect(data.current.status).toBe("active");
  });

  it("GET 上传后 → 2 个数据集，current 为上传项（types/recordCount 正确）", async () => {
    setUploaded([chFile()]);
    const data = await (await GET()).json();
    expect(data.datasets).toHaveLength(2);
    expect(data.current.sourceType).toBe("upload");
    expect(data.current.datasetTypes).toEqual(["oms"]);
    expect(data.current.recordCount).toBe(5); // 5 天 × 1 渠道
    expect(data.current.dateRange.dayCount).toBe(5);
  });

  it("POST switch → sample 切回，响应回填 datasets/current", async () => {
    setUploaded([chFile()]);
    const uploadedId = getCurrentDataset().datasetId;
    const res = await post({ action: "switch", id: "sample" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.current.datasetId).toBe("sample");
    // 上传项仍在列表（archived），未丢失
    expect(data.datasets.some((d: DatasetSummary) => d.datasetId === uploadedId)).toBe(true);
  });

  it("POST switch 不存在 id → 404 + error 文案", async () => {
    const res = await post({ action: "switch", id: "ds-does-not-exist" });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeTruthy();
  });

  it("POST switch 同步清空查询缓存（resetCache）", async () => {
    setUploaded([chFile()]);
    const key = buildCacheKey({ question: "gmv?", range: 7, role: "CEO" });
    cachePut(key, { answer: "cached" }, CADENCE_TTL_MS.realtime);
    expect(cacheGet(key).hit).toBe(true);

    const res = await post({ action: "switch", id: "sample" });
    expect(res.status).toBe(200);
    // Active 已变 → 旧答案缓存必须失效，否则会返回基于旧数据集的答案
    expect(cacheGet(key).hit).toBe(false);
  });

  it("POST delete 守卫：sample 与当前 active 不可删 → 400", async () => {
    setUploaded([chFile()]);
    const activeId = getCurrentDataset().datasetId;

    const delSample = await post({ action: "delete", id: "sample" });
    expect(delSample.status).toBe(400);
    expect((await delSample.json()).ok).toBe(false);

    const delActive = await post({ action: "delete", id: activeId });
    expect(delActive.status).toBe(400);
    expect((await delActive.json()).ok).toBe(false);
  });

  it("POST delete：切走后可删非 active 上传项", async () => {
    setUploaded([chFile()]);
    const uploadedId = getCurrentDataset().datasetId;
    await post({ action: "switch", id: "sample" }); // 先切走

    const res = await post({ action: "delete", id: uploadedId });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.datasets).toHaveLength(1);
    expect(data.datasets[0].datasetId).toBe("sample");
  });

  it("POST 参数校验：缺 id / 未知 action / 非 JSON body → 400", async () => {
    const noId = await post({ action: "switch" });
    expect(noId.status).toBe(400);

    const badAction = await post({ action: "frob", id: "sample" });
    expect(badAction.status).toBe(400);

    const badJson = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );
    expect(badJson.status).toBe(400);
  });
});
