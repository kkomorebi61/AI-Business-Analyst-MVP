import { describe, it, expect } from "vitest";
import {
  decideResponse,
  ANOMALY_TEXT,
  HIGH_REFUSE_TEXT,
  MEDIUM_HINT,
} from "@/lib/governance/risk";

const noAnomaly = { detected: false } as const;

describe("decideResponse 决策表", () => {
  it("异常数据 → suspend（最高优先级）", () => {
    const r = decideResponse({ queryClass: "A", coverageLevel: "High", anomaly: { detected: true, metric: "GMV", ratio: 100 }, profitCase: false });
    expect(r.strategy).toBe("suspend");
    expect(r.riskLevel).toBe("high");
    expect(r.mandatedText).toBe(ANOMALY_TEXT);
  });

  it("Class B + Low → refuse", () => {
    const r = decideResponse({ queryClass: "B", coverageLevel: "Low", anomaly: noAnomaly, profitCase: false });
    expect(r.strategy).toBe("refuse");
    expect(r.mandatedText).toBe(HIGH_REFUSE_TEXT);
  });

  it("Class B + High + 利润 → partial，带 PROFIT_B 文案 + MEDIUM_HINT", () => {
    const r = decideResponse({ queryClass: "B", coverageLevel: "High", anomaly: noAnomaly, profitCase: true });
    expect(r.strategy).toBe("partial");
    expect(r.mandatedText).toContain("尚未接入成本数据");
    expect(r.banner.description).toContain(MEDIUM_HINT);
  });

  it("Class A + Low → refuse", () => {
    expect(decideResponse({ queryClass: "A", coverageLevel: "Low", anomaly: noAnomaly, profitCase: false }).strategy).toBe("refuse");
  });

  it("Class A + Medium → partial（mandatedText=null，banner 带 MEDIUM_HINT）", () => {
    const r = decideResponse({ queryClass: "A", coverageLevel: "Medium", anomaly: noAnomaly, profitCase: false });
    expect(r.strategy).toBe("partial");
    expect(r.mandatedText).toBeNull();
    expect(r.banner.description).toBe(MEDIUM_HINT);
  });

  it("Class A + High → direct", () => {
    const r = decideResponse({ queryClass: "A", coverageLevel: "High", anomaly: noAnomaly, profitCase: false });
    expect(r.strategy).toBe("direct");
    expect(r.riskLevel).toBe("low");
  });
});
