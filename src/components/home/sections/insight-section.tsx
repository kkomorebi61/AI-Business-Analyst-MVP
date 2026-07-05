"use client";

import SectionHeading from "@/components/report/section-heading";
import FindingsSection from "@/components/report/findings-section";
import RiskSection from "@/components/report/risk-section";
import RecommendationsSection from "@/components/report/recommendations-section";
import type { Finding, Recommendation, Risk } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";

/**
 * 首页洞察三节（§5 关键发现 / §6 风险提示 / §7 行动建议）。
 * 数据来自 /api/dashboard 的默认概览洞察（runWorkflow overview 产出），
 * 直接复用报告页 Findings/Risk/Recommendations 组件（含 Evidence/根因/该指标如何计算）。
 * 空数组对应节自动隐藏（减少信息噪音）。
 */
export default function InsightSection({
  findings,
  risks,
  recommendations,
  onViewEvidence,
  onViewMetric,
}: {
  findings: Finding[];
  risks: Risk[];
  recommendations: Recommendation[];
  onViewEvidence: (t: Finding | Risk) => void;
  onViewMetric: (key: MetricKey) => void;
}) {
  return (
    <>
      {findings.length > 0 && (
        <section>
          <SectionHeading index="05" title="关键发现" subtitle="经营概览的核心洞察" />
          <FindingsSection
            findings={findings}
            onViewEvidence={onViewEvidence}
            onViewMetric={onViewMetric}
          />
        </section>
      )}

      {risks.length > 0 && (
        <section>
          <SectionHeading index="06" title="风险提示" subtitle="影响下期表现的重点风险" />
          <RiskSection
            risks={risks}
            onViewEvidence={onViewEvidence}
            onViewMetric={onViewMetric}
          />
        </section>
      )}

      {recommendations.length > 0 && (
        <section>
          <SectionHeading index="07" title="行动建议" subtitle="按预期收益与投入排序" />
          <RecommendationsSection recommendations={recommendations} />
        </section>
      )}
    </>
  );
}
