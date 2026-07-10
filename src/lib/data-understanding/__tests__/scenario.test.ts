import { describe, it, expect } from "vitest";
import { identifyScenario, SCENARIO_LABELS } from "@/lib/data-understanding/scenario";

describe("scenario · doc19 业务场景识别", () => {
  it("B: 仅 OMS → 经营分析", () => {
    const r = identifyScenario(["oms"]);
    expect(r.primary).toBe("operations");
  });

  it("A: CRM + OMS → 会员增长运营", () => {
    const r = identifyScenario(["crm", "oms"]);
    expect(r.primary).toBe("member_growth");
  });

  it("C: OMS + Marketing → ROI 分析", () => {
    const r = identifyScenario(["oms", "marketing"]);
    expect(r.primary).toBe("roi");
  });

  it("D: CRM + OMS + SCRM → 全渠道用户运营（覆盖最广，primary 优先）", () => {
    const r = identifyScenario(["crm", "oms", "scrm"]);
    expect(r.primary).toBe("omnichannel");
    expect(r.scenarios).toContain("member_growth"); // 同时命中 A
  });

  it("样本全集（含 marketing）仍以 omnichannel 为 primary", () => {
    const r = identifyScenario(["oms", "crm", "scrm", "marketing"]);
    expect(r.primary).toBe("omnichannel");
  });

  it("无 OMS 主数据 → custom 并说明", () => {
    const r = identifyScenario(["crm"]);
    expect(r.primary).toBe("custom");
    expect(r.reason).toBeTruthy();
  });

  it("SCENARIO_LABELS 完整", () => {
    expect(SCENARIO_LABELS.omnichannel).toBe("全渠道用户运营");
  });
});
