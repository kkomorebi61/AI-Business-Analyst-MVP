import { describe, it, expect, afterEach } from "vitest";
import { dataAgent } from "@/lib/agents/data-agent";
import { setUploaded, resetDatasetStore } from "@/lib/data/dataset-store";
import { isActiveUploaded } from "@/lib/data/csv-engine";

afterEach(() => resetDatasetStore());

/** 造 7 天单渠道日表（gmv=参数/日） */
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
 * Single Source of Truth 守卫：Metric / Dashboard 引擎（dataAgent，被 /api/kpis 与
 * /api/dashboard 复用）必须读取 Active Dataset。上传后 GMV 来自上传数据，而非内置样本。
 * 防止日后有人把引擎接回静态数据。
 */
describe("Single Source of Truth · 引擎读 Active Dataset", () => {
  it("上传后 dataAgent(range=7) 的 GMV 来自上传数据，≠ 样本", () => {
    const sampleGmv = dataAgent(["gmv"], 7).sales.current.gmv;
    setUploaded([
      {
        name: "ch.csv",
        columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"],
        rows: rows7("111111"),
      },
    ]);
    expect(isActiveUploaded()).toBe(true);

    const up = dataAgent(["gmv"], 7);
    expect(up.sales.current.gmv).toBe(777777); // 7 × 111111
    expect(up.sales.current.gmv).not.toBe(sampleGmv);

    const gmvKpi = up.kpis.find((k) => k.key === "gmv")!;
    expect(gmvKpi.value).toBe("¥78万"); // 777777 → ¥78万（首页展示口径）
  });
});
