import { describe, it, expect, afterEach } from "vitest";
import type { DatasetFile } from "@/lib/data-understanding/types";
import {
  addProjectDataset,
  buildDatasetRecordFromIngest,
  clearProjectDatasets,
  deleteProjectDataset,
  getProjectDataset,
  getSuccessDatasets,
  hasSuccessDataset,
  listProjectDatasets,
  resetProjectDatasetStore,
} from "@/lib/project/project-dataset-store";

afterEach(() => resetProjectDatasetStore());

function chFile(days = 5, gmv = "1000"): DatasetFile {
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

function successRecordBody() {
  const { record } = buildDatasetRecordFromIngest("proj-A", [chFile()]);
  const { id: _id, projectId: _pid, uploadTime: _ut, ...body } = record;
  void _id;
  void _pid;
  void _ut;
  return body;
}

describe("project-dataset-store · CRUD + 隔离", () => {
  it("add + list：按上传时间倒序，summary 不含 files", () => {
    addProjectDataset("proj-A", { ...successRecordBody() });
    const list = listProjectDatasets("proj-A");
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("files");
    expect(list[0].projectId).toBe("proj-A");
    expect(list[0].ingestStatus).toBe("success");
  });

  it("getProjectDataset：跨项目隔离（proj-B 查 proj-A 的 id → null）", () => {
    const added = addProjectDataset("proj-A", { ...successRecordBody() });
    expect(getProjectDataset("proj-A", added.id)).not.toBeNull();
    expect(getProjectDataset("proj-B", added.id)).toBeNull();
  });

  it("delete：不存在 / 不属于 → 失败", () => {
    const added = addProjectDataset("proj-A", { ...successRecordBody() });
    expect(deleteProjectDataset("proj-A", "pds-nope").ok).toBe(false);
    expect(deleteProjectDataset("proj-B", added.id).ok).toBe(false);
    expect(deleteProjectDataset("proj-A", added.id).ok).toBe(true);
    expect(listProjectDatasets("proj-A")).toHaveLength(0);
  });

  it("getSuccessDatasets / hasSuccessDataset：只含 success", () => {
    addProjectDataset("proj-A", { ...successRecordBody() });
    const failed = buildDatasetRecordFromIngest("proj-A", []); // 空上传 → failed
    const { id: _i, projectId: _p, uploadTime: _u, ...failedBody } = failed.record;
    void _i;
    void _p;
    void _u;
    addProjectDataset("proj-A", failedBody);
    expect(getSuccessDatasets("proj-A")).toHaveLength(1);
    expect(hasSuccessDataset("proj-A")).toBe(true);
    expect(hasSuccessDataset("proj-B")).toBe(false);
  });

  it("clearProjectDatasets：仅清本项目", () => {
    addProjectDataset("proj-A", { ...successRecordBody() });
    addProjectDataset("proj-B", { ...successRecordBody() });
    expect(clearProjectDatasets("proj-A")).toBe(1);
    expect(listProjectDatasets("proj-A")).toHaveLength(0);
    expect(listProjectDatasets("proj-B")).toHaveLength(1);
  });
});

describe("buildDatasetRecordFromIngest · 失败矩阵", () => {
  it("成功：总行数>0 → success，保留 files，understanding 非 null", () => {
    const { record, understanding } = buildDatasetRecordFromIngest("p", [chFile()]);
    expect(record.ingestStatus).toBe("success");
    expect(record.recordCount).toBe(5);
    expect(record.files).toHaveLength(1);
    expect(record.schema.matchedByTable.channel).toContain("gmv");
    expect(understanding).not.toBeNull();
  });

  it("raw 事务流水（order_id/customer_id）→ failed「按日聚合」", () => {
    const raw: DatasetFile = {
      name: "orders.csv",
      columns: ["order_id", "customer_id", "order_amount", "order_date"],
      rows: [
        { order_id: "1", customer_id: "c1", order_amount: "99", order_date: "2026-06-20" },
      ],
    };
    const { record, understanding } = buildDatasetRecordFromIngest("p", [raw]);
    expect(record.ingestStatus).toBe("failed");
    expect(record.ingestError).toContain("按日聚合");
    expect(record.files).toEqual([]);
    expect(understanding).toBeNull();
  });

  it("空上传（无文件）→ failed「无有效数据行」", () => {
    const { record } = buildDatasetRecordFromIngest("p", []);
    expect(record.ingestStatus).toBe("failed");
    expect(record.ingestError).toContain("无有效数据行");
  });

  it("无规范字段（且非 raw）→ failed「未识别规范字段」", () => {
    const weird: DatasetFile = {
      name: "x.csv",
      columns: ["foo", "bar", "baz"],
      rows: [
        { foo: "1", bar: "2", baz: "3" },
        { foo: "4", bar: "5", baz: "6" },
      ],
    };
    const { record } = buildDatasetRecordFromIngest("p", [weird]);
    expect(record.ingestStatus).toBe("failed");
    expect(record.ingestError).toContain("未识别");
  });
});
