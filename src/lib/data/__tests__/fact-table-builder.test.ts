import { describe, it, expect, afterEach } from "vitest";
import {
  getFacts,
  setActiveFacts,
  resetFacts,
  aggregateSales,
  isActiveUploaded,
  availableDayCount,
} from "@/lib/data/csv-engine";
import { buildFacts } from "@/lib/data/fact-table-builder";
import {
  setUploaded,
  resetToSample,
  resetDatasetStore,
  getUnderstanding,
  isSample,
} from "@/lib/data/dataset-store";
import type { DatasetFile } from "@/lib/data-understanding/types";

/**
 * Fact Table Builder + Active Dataset 切换测试（Data First · 上传数据进计算链路）
 *
 * 覆盖：中英文列别名、¥/万/亿/千分位 解析、渠道归一化、部分数据集、raw 检测、
 *       未识别列、多文件；以及 Active Dataset 切换后指标确实来自上传（非样本）。
 */

// 每个用例后复位 Active Dataset，避免污染其它测试/文件
afterEach(() => {
  resetFacts();
  resetDatasetStore();
});

/** 造 N 天单渠道日表（gmv=1000/日） */
function dailyRows(days: number, from = "2026-06-20"): Record<string, string>[] {
  const start = new Date(from);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { date: iso, channel: "TMALL", gmv: "1000", orders: "10", visitors: "300", buyers: "9" };
  });
}

describe("Fact Table Builder · 列别名与值解析", () => {
  it("中文表头 + ¥/万/千分位 → 规范事实表", () => {
    const files: DatasetFile[] = [
      {
        name: "ch.csv",
        columns: ["日期", "渠道", "销售额", "订单数", "访客数", "购买人数"],
        rows: [
          { "日期": "2026-06-29", "渠道": "天猫", "销售额": "¥230万", "订单数": "1,234", "访客数": "5000", "购买人数": "160" },
        ],
      },
    ];
    const { facts, diagnostics } = buildFacts(files);
    expect(facts.channel).toHaveLength(1);
    expect(facts.channel[0].gmv).toBe(2_300_000); // ¥230万
    expect(facts.channel[0].orders).toBe(1234); // 1,234
    expect(facts.channel[0].visitors).toBe(5000);
    expect(facts.channel[0].channel).toBe("TMALL"); // 天猫 → TMALL
    expect(facts.channel[0].date).toBe("2026-06-29");
    expect(facts.member).toHaveLength(0);
    expect(diagnostics.rowsByTable.channel).toBe(1);
  });

  it("亿级 / 百分号 / 斜杠日期 解析", () => {
    const { facts } = buildFacts([
      {
        name: "ch.csv",
        columns: ["date", "channel", "gmv", "refund_amount", "refund_rate"],
        rows: [{ date: "2026/6/29", channel: "企微", gmv: "1.2亿", refund_amount: "3%", refund_rate: "3%" }],
      },
    ]);
    expect(facts.channel[0].gmv).toBe(120_000_000); // 1.2亿
    expect(facts.channel[0].refund_amount).toBe(3); // "3%" → 3（率列不被当指标，分量按数值）
    expect(facts.channel[0].channel).toBe("PRIVATE_TRAFFIC"); // 企微 → 私域
    expect(facts.channel[0].date).toBe("2026-06-29"); // YYYY/M/D → ISO
  });

  it("渠道名变体归一化（京东/小红书/线下门店）", () => {
    const { facts } = buildFacts([
      {
        name: "ch.csv",
        columns: ["date", "channel", "gmv"],
        rows: [
          { date: "2026-06-29", channel: "京东", gmv: "100" },
          { date: "2026-06-29", channel: "小红书", gmv: "100" },
          { date: "2026-06-29", channel: "线下门店", gmv: "100" },
        ],
      },
    ]);
    const keys = facts.channel.map((r) => r.channel).sort();
    expect(keys).toEqual(["JD", "OFFLINE_STORE", "XIAOHONGSHU"]);
  });

  it("OMS 列名 order_count/buyer_count → orders/buyers（不再被当未识别列丢弃）", () => {
    const { facts, diagnostics } = buildFacts([
      {
        name: "ch.csv",
        columns: ["date", "channel", "gmv", "order_count", "buyer_count"],
        rows: [{ date: "2026-06-29", channel: "TMALL", gmv: "1000", order_count: "10", buyer_count: "8" }],
      },
    ]);
    expect(facts.channel[0].orders).toBe(10); // order_count → orders（归一化命中）
    expect(facts.channel[0].buyers).toBe(8); // buyer_count → buyers
    expect(diagnostics.unmappedColumns).not.toContain("buyer_count");
    expect(diagnostics.unmappedColumns).not.toContain("order_count");
  });
});

describe("Fact Table Builder · 多文件 / 部分数据集 / 未识别列", () => {
  it("多文件分别入库 channel 与 member", () => {
    const files: DatasetFile[] = [
      { name: "ch.csv", columns: ["date", "channel", "gmv", "orders"], rows: [{ date: "2026-06-29", channel: "TMALL", gmv: "100", orders: "1" }] },
      { name: "mb.csv", columns: ["date", "total_members", "new_members"], rows: [{ date: "2026-06-29", total_members: "1000", new_members: "50" }] },
    ];
    const { facts, diagnostics } = buildFacts(files);
    expect(facts.channel).toHaveLength(1);
    expect(facts.member).toHaveLength(1);
    expect(facts.member[0].total_members).toBe(1000);
    expect(diagnostics.rowsByTable).toEqual({ channel: 1, member: 1 });
  });

  it("未识别列被收集到 diagnostics", () => {
    const { diagnostics } = buildFacts([
      {
        name: "ch.csv",
        columns: ["date", "channel", "gmv", "神秘字段A"],
        rows: [{ date: "2026-06-29", channel: "TMALL", gmv: "100", "神秘字段A": "x" }],
      },
    ]);
    expect(diagnostics.unmappedColumns).toContain("神秘字段A");
    expect(diagnostics.unmappedColumns).not.toContain("gmv");
  });
});

describe("Fact Table Builder · raw 事务流检测", () => {
  it("order_id/order_amount 流水 → rawDetected，不入库", () => {
    const { facts, diagnostics } = buildFacts([
      {
        name: "orders.csv",
        columns: ["order_id", "order_amount", "sku", "order_date"],
        rows: [
          { order_id: "1", order_amount: "100", sku: "S1", order_date: "2026-06-29" },
          { order_id: "2", order_amount: "200", sku: "S2", order_date: "2026-06-29" },
        ],
      },
    ]);
    expect(diagnostics.rawDetected).toBe(true);
    expect(facts.channel).toHaveLength(0); // 不猜测聚合
    expect(facts.member).toHaveLength(0);
  });
});

describe("Active Dataset · 切换后指标来自上传（非样本）", () => {
  it("setActiveFacts(buildFacts) 后 aggregateSales 反映上传值", () => {
    const sampleGmv = aggregateSales(90).current.gmv;
    expect(sampleGmv).toBeGreaterThan(0);

    const up = buildFacts([
      { name: "ch.csv", columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"], rows: dailyRows(10) },
    ]);
    setActiveFacts(up.facts);
    expect(isActiveUploaded()).toBe(true);

    // 上传 10 天 × ¥1000，最近 7 天 = ¥7000
    expect(aggregateSales(7).current.gmv).toBe(7000);
    // 全量口径也应是上传合计（10×1000=10000），而非样本
    expect(aggregateSales(90).current.gmv).toBe(10000);
    expect(aggregateSales(7).current.gmv).not.toBe(sampleGmv);

    resetFacts();
    expect(isActiveUploaded()).toBe(false);
    expect(aggregateSales(90).current.gmv).toBe(sampleGmv); // 回到样本
  });
});

describe("dataset-store · setUploaded / resetToSample 端到端", () => {
  it("setUploaded：理解结果标 upload + 诊断；指标来自上传", () => {
    const sampleGmv = aggregateSales(90).current.gmv;
    setUploaded([
      { name: "ch.csv", columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"], rows: dailyRows(10) },
    ]);
    expect(isSample()).toBe(false);
    expect(isActiveUploaded()).toBe(true);
    const u = getUnderstanding();
    expect(u.source).toBe("upload");
    expect(u.uploadDiagnostics).toBeDefined();
    expect(u.uploadDiagnostics?.rowsByTable.channel).toBe(10);
    expect(aggregateSales(7).current.gmv).toBe(7000);
    expect(aggregateSales(7).current.gmv).not.toBe(sampleGmv);
  });

  it("resetToSample：回到内置样本", () => {
    setUploaded([
      { name: "ch.csv", columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"], rows: dailyRows(10) },
    ]);
    const beforeReset = aggregateSales(7).current.gmv;
    const r = resetToSample();
    expect(r.source).toBe("sample");
    expect(isSample()).toBe(true);
    expect(isActiveUploaded()).toBe(false);
    expect(aggregateSales(7).current.gmv).not.toBe(beforeReset); // 数据源已切回样本
  });
});

describe("Active Dataset · 分析范围 = 上传范围（全量 = 上传天数）", () => {
  it("上传 N 天 → UnderstandingResult.dateRange = {min, max, dayCount=N}", () => {
    const u = setUploaded([
      { name: "ch.csv", columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"], rows: dailyRows(10) },
    ]);
    expect(u.dateRange).toEqual({ minDate: "2026-06-20", maxDate: "2026-06-29", dayCount: 10 });
    expect(u.latestDataDate).toBe("2026-06-29");
    expect(u.latestDataDate).toBe(u.dateRange.maxDate);
  });

  it("availableDayCount() = 上传天数（活跃事实表实时口径）", () => {
    setUploaded([
      { name: "ch.csv", columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"], rows: dailyRows(10) },
    ]);
    expect(availableDayCount()).toBe(10);
  });

  it("全量窗口只含上传的天数，不回落样本、不越界", () => {
    const sampleSpan = availableDayCount(); // 复位后 = 样本天数
    setUploaded([
      { name: "ch.csv", columns: ["date", "channel", "gmv", "orders", "visitors", "buyers"], rows: dailyRows(10) },
    ]);
    expect(availableDayCount()).toBe(10);
    expect(availableDayCount()).not.toBe(sampleSpan); // ≠ 样本范围

    // 即便请求「最近90天」(最大枚举窗口)，daily 序列也只有实际上传的 10 天 —— 分析范围 = 上传范围
    const a = aggregateSales(90);
    expect(a.daily).toHaveLength(10);
    expect(a.current.gmv).toBe(10000); // 10 × ¥1000
  });
});
