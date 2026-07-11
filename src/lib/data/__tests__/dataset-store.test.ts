import { describe, it, expect, afterEach } from "vitest";
import {
  setUploaded,
  resetDatasetStore,
  listDatasets,
  switchDataset,
  deleteDataset,
  getCurrentDataset,
  getCurrentDatasetSummary,
  isSample,
} from "@/lib/data/dataset-store";
import { isActiveUploaded } from "@/lib/data/csv-engine";

afterEach(() => resetDatasetStore());

function chFile(days = 5) {
  const start = new Date("2026-06-20");
  const rows = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      channel: "TMALL",
      gmv: "1000",
      orders: "10",
      visitors: "100",
      buyers: "9",
    };
  });
  return { name: "ch.csv", columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"], rows };
}

describe("Dataset Store · 多数据集 / Active / 切换 / 删除", () => {
  it("初始：仅 sample，且为 active", () => {
    const list = listDatasets();
    expect(list).toHaveLength(1);
    expect(list[0].datasetId).toBe("sample");
    expect(list[0].status).toBe("active");
    expect(isSample()).toBe(true);
    expect(getCurrentDataset().sourceType).toBe("sample");
  });

  it("上传 → 新数据集入集合并激活；sample 转为 archived", () => {
    setUploaded([chFile()]);
    const list = listDatasets();
    expect(list).toHaveLength(2);
    const active = list.find((d) => d.status === "active")!;
    expect(active.sourceType).toBe("upload");
    expect(isSample()).toBe(false);
    expect(isActiveUploaded()).toBe(true);
    expect(getCurrentDataset().datasetId).toBe(active.datasetId);
    // sample 不再 active
    expect(list.find((d) => d.datasetId === "sample")!.status).toBe("archived");
  });

  it("switchDataset('sample') → 切回样本，保留已上传数据集", () => {
    setUploaded([chFile()]);
    const uploadedId = getCurrentDataset().datasetId;
    switchDataset("sample");
    expect(isSample()).toBe(true);
    expect(isActiveUploaded()).toBe(false);
    expect(getCurrentDataset().datasetId).toBe("sample");
    // 上传数据集仍在集合里（archived）
    expect(listDatasets().some((d) => d.datasetId === uploadedId)).toBe(true);
  });

  it("switchDataset 到已上传数据集 → 重新激活，facts 跟随", () => {
    setUploaded([chFile()]); // 激活 uploaded
    const uploadedId = getCurrentDataset().datasetId;
    switchDataset("sample");
    expect(isSample()).toBe(true);
    switchDataset(uploadedId); // 切回
    expect(isSample()).toBe(false);
    expect(getCurrentDataset().datasetId).toBe(uploadedId);
  });

  it("deleteDataset 守卫：不可删 sample、不可删当前 active", () => {
    setUploaded([chFile()]);
    const uploadedId = getCurrentDataset().datasetId;
    expect(deleteDataset("sample").ok).toBe(false); // 不可删 sample
    expect(deleteDataset(uploadedId).ok).toBe(false); // 不可删当前 active
  });

  it("deleteDataset：切换后可删非 active 的上传数据集", () => {
    setUploaded([chFile()]);
    const uploadedId = getCurrentDataset().datasetId;
    switchDataset("sample");
    const res = deleteDataset(uploadedId);
    expect(res.ok).toBe(true);
    expect(listDatasets()).toHaveLength(1); // 只剩 sample
    expect(listDatasets()[0].datasetId).toBe("sample");
  });

  it("getCurrentDatasetSummary 不含 facts/understanding", () => {
    setUploaded([chFile()]);
    const s = getCurrentDatasetSummary();
    expect(s).not.toHaveProperty("facts");
    expect(s).not.toHaveProperty("understanding");
    expect(s.recordCount).toBe(5); // 5 天 × 1 渠道
    expect(s.datasetTypes).toEqual(["oms"]);
    expect(s.dateRange.dayCount).toBe(5);
  });
});
