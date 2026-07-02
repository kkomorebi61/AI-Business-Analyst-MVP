import { describe, it, expect } from "vitest";
import { assessCoverage, levelOf } from "@/lib/governance/coverage";

describe("levelOf (覆盖率阈值，verbatim 80/50)", () => {
  it("High ≥ 80", () => {
    expect(levelOf(80)).toBe("High");
    expect(levelOf(100)).toBe("High");
  });
  it("Medium 50–<80（含边界 50，不含 80）", () => {
    expect(levelOf(79.9)).toBe("Medium");
    expect(levelOf(50)).toBe("Medium");
  });
  it("Low < 50（不含 50）", () => {
    expect(levelOf(49.9)).toBe("Low");
    expect(levelOf(0)).toBe("Low");
  });
});

describe("assessCoverage", () => {
  it("引用 OMS → 来自注册表的真实覆盖率（High）", () => {
    const r = assessCoverage(["OMS"]);
    expect(r.coverage).toBe(95);
    expect(r.level).toBe("High");
  });

  it("多源平均：OMS(95)+CDP(88) → 92（High）", () => {
    const r = assessCoverage(["OMS", "CDP"]);
    expect(r.coverage).toBe(92);
    expect(r.level).toBe("High");
  });

  it("无引用源 → null / Low", () => {
    expect(assessCoverage([])).toEqual({ coverage: null, level: "Low" });
  });
});
