import { describe, it, expect } from "vitest";
import {
  fillTemplate,
  TEMPLATES,
  type TemplateName,
} from "../prompt-templates";

describe("prompt-templates · doc 15 P4 Template First", () => {
  describe("fillTemplate 基础替换", () => {
    it("insightNarrative 三个变量全部填充", () => {
      const out = fillTemplate("insightNarrative", {
        question: "为什么 GMV 下降？",
        kpiDigest: "GMV ¥100万(-5.0%)",
        findingDigest: "渠道A下降",
      });
      expect(out.system).toBe(TEMPLATES.insightNarrative.system);
      expect(out.user).toBe(
        "问题：为什么 GMV 下降？\n指标：GMV ¥100万(-5.0%)\n发现：渠道A下降",
      );
    });

    it("strategyNarrative 含数组 join 后的变量", () => {
      const out = fillTemplate("strategyNarrative", {
        question: "复购下降怎么办",
        strategyName: "复购提升",
        targetAudience: "VIP、普通会员",
        channel: "企微、APP",
        capabilities: "自动化营销、人群圈选",
      });
      expect(out.user).toContain("人群：VIP、普通会员");
      expect(out.user).toContain("渠道：企微、APP");
      expect(out.user).toContain("能力：自动化营销、人群圈选");
    });

    it("requirementPrd system 含 JSON 骨架，逐字保留", () => {
      const out = fillTemplate("requirementPrd", {
        question: "生成 PRD",
        gaps: "无现成能力",
        matched: "无",
      });
      expect(out.system).toBe(TEMPLATES.requirementPrd.system);
      expect(out.system).toContain('"businessValue"');
      expect(out.user).toContain("能力缺口：无现成能力");
    });

    it("多余变量被容忍（不报错）", () => {
      const out = fillTemplate("insightNarrative", {
        question: "q",
        kpiDigest: "k",
        findingDigest: "f",
        extra: "ignored",
      });
      expect(out.user).toBe("问题：q\n指标：k\n发现：f");
    });
  });

  describe("缺失变量 fail-fast", () => {
    it("缺失任一必需变量 → 抛错并指出缺失项", () => {
      expect(() =>
        fillTemplate("insightNarrative", {
          question: "q",
          // kpiDigest / findingDigest 缺失
        }),
      ).toThrowError(/kpiDigest.*findingDigest|findingDigest.*kpiDigest/);
    });

    it("undefined 值视为缺失", () => {
      expect(() =>
        fillTemplate("strategyNarrative", {
          question: "q",
          strategyName: "s",
          targetAudience: "t",
          channel: "c",
          capabilities: undefined as unknown as string,
        }),
      ).toThrowError(/capabilities/);
    });
  });

  describe("doc 15 P4 报告模板可填充", () => {
    const reportCases: { name: TemplateName; vars: Record<string, string> }[] = [
      {
        name: "weeklyReport",
        vars: { range: "7", gmv: "¥100万", orders: "1万", highlights: "转化提升", risks: "退款升" },
      },
      {
        name: "monthlyReport",
        vars: { month: "2026-06", gmv: "¥3000万", mom: "+8%", keyRisks: "获客成本升", nextFocus: "复购" },
      },
      {
        name: "businessReview",
        vars: {
          period: "Q2", summary: "达标", wins: "GMV", misses: "利润",
          risks: "成本", nextSteps: "控本",
        },
      },
      {
        name: "campaignRetrospective",
        vars: { campaign: "618", gmv: "¥500万", roi: "3.2", learnings: "提前蓄水", improvements: "扩人群" },
      },
    ];

    for (const { name, vars } of reportCases) {
      it(`${name} 全变量填充后无残留 {{}}`, () => {
        const out = fillTemplate(name, vars);
        expect(out.user).not.toMatch(/\{\{|\}\}/);
        expect(out.system.length).toBeGreaterThan(0);
      });
    }
  });

  describe("模板自洽性", () => {
    it("每个模板的 vars 与 user 中的占位符一致", () => {
      for (const name of Object.keys(TEMPLATES) as TemplateName[]) {
        const tpl = TEMPLATES[name];
        const placeholders = Array.from(tpl.user.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]);
        expect(new Set(placeholders)).toEqual(new Set(tpl.vars));
      }
    });
  });
});
