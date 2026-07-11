import { describe, it, expect, afterEach } from "vitest";
import {
  buildMetricEvidence,
  buildChannelEvidence,
} from "@/lib/agents/evidence-engine";
import { dataAgent } from "@/lib/agents/data-agent";
import {
  setUploaded,
  resetDatasetStore,
  getCurrentDatasetSummary,
} from "@/lib/data/dataset-store";

afterEach(() => resetDatasetStore());

/** 7 天单渠道日表（gmv/日 = 参数） */
function rows7(gmv: string) {
  const start = new Date("2026-06-24");
  return Array.from({ length: 7 }, (_, i) => {
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
}

/**
 * Dataset Visibility Task 13/14：每条 Evidence 都携带它计算时所用的数据集摘要，
 * 让「查看依据」可溯源到具体数据。防止 evidence-engine 以后漏填 dataset。
 */
describe("Evidence · 携带 Current Dataset（Dataset Visibility）", () => {
  it("buildMetricEvidence 带 current 数据集摘要（默认样本）", () => {
    const data = dataAgent(["gmv"], 7);
    const ev = buildMetricEvidence(["gmv"], data);
    expect(ev.dataset).toBeDefined();
    const current = getCurrentDatasetSummary();
    expect(ev.dataset!.datasetId).toBe(current.datasetId);
    expect(ev.dataset!.name).toBe(current.name);
    expect(ev.dataset!.sourceType).toBe("sample");
    // 是摘要而非完整记录：不含 facts / understanding
    expect(ev.dataset!).not.toHaveProperty("facts");
    expect(ev.dataset!).not.toHaveProperty("understanding");
  });

  it("上传后 buildMetricEvidence.dataset 跟随 active 数据集", () => {
    setUploaded([
      {
        name: "ch.csv",
        columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"],
        rows: rows7("111111"),
      },
    ]);
    const data = dataAgent(["gmv"], 7);
    const ev = buildMetricEvidence(["gmv"], data);
    expect(ev.dataset!.sourceType).toBe("upload");
    expect(ev.dataset!.datasetId).toBe(getCurrentDatasetSummary().datasetId);
  });

  it("buildChannelEvidence 同样带 current 数据集", () => {
    const data = dataAgent(["gmv"], 7);
    const ch = data.channels[0];
    const ev = buildChannelEvidence(ch);
    expect(ev.dataset).toBeDefined();
    expect(ev.dataset!.datasetId).toBe(getCurrentDatasetSummary().datasetId);
  });
});
