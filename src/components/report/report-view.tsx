"use client";

import { useCallback, useEffect, useState } from "react";
import ReportHeader from "./report-header";
import SummarySection from "./summary-section";
import KpiCards from "./kpi-cards";
import FindingsSection from "./findings-section";
import RiskSection from "./risk-section";
import RecommendationsSection from "./recommendations-section";
import ReportFooter from "./report-footer";
import SectionHeading from "./section-heading";
import TrendChart from "./trend-chart";
import RangeSwitcher from "@/components/home/range-switcher";
import type { Range } from "@/lib/data/daily";
import type { AnalysisResult } from "@/lib/agents/types";
import type { Role } from "@/lib/kb/metric-kb";

const ROLE_LABEL: Record<Role, string> = {
  CEO: "CEO 视角",
  CRM_MANAGER: "CRM 经理视角",
  OPERATION_MANAGER: "运营经理视角",
};

export default function ReportView({
  question,
  perspective,
  initialRange,
}: {
  question: string;
  perspective: Role;
  initialRange: Range;
}) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(initialRange);
  const [nonce, setNonce] = useState(0);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, perspective, range }),
      });
      const data = (await res.json()) as AnalysisResult;
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [question, perspective, range]);

  useEffect(() => {
    void run();
  }, [run, nonce]);

  return (
    <div className="min-h-screen">
      <ReportHeader
        title={result?.title ?? "本周表现报告"}
        onRegenerate={() => setNonce((n) => n + 1)}
        regenerating={loading}
      />

      <main className="mx-auto max-w-[920px] px-6 py-8">
        {loading || !result ? (
          <ReportSkeleton />
        ) : (
          <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
            {/* 提问 + 时间范围切换 */}
            <section className="border-b border-border pb-6">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                AI 业务分析师 · {ROLE_LABEL[result.perspective]}
              </div>
              <h1 className="text-[22px] font-semibold leading-snug">
                {result.question}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">时间范围</span>
                <RangeSwitcher value={range} onChange={setRange} size="md" />
                {!result.hasComparison && (
                  <span className="text-xs text-amber-600">
                    当前范围无上一周期，未显示环比
                  </span>
                )}
              </div>
            </section>

            <div className="mt-6 space-y-8">
              <SummarySection summary={result.summary} />

              <TrendChart data={result.trend} rangeLabel={result.rangeLabel} />

              <section>
                <SectionHeading
                  index="01"
                  title="KPI 驾驶舱"
                  subtitle={`定义${result.rangeLabel}表现的四个核心指标`}
                />
                <KpiCards kpis={result.kpis} />
              </section>

              <section>
                <SectionHeading
                  index="02"
                  title="关键发现"
                  subtitle="按业务影响排序的洞察"
                />
                <FindingsSection findings={result.findings} />
              </section>

              <section>
                <SectionHeading
                  index="03"
                  title="风险提示"
                  subtitle="影响下期表现的重点风险"
                />
                <RiskSection risks={result.risks} />
              </section>

              <section>
                <SectionHeading
                  index="04"
                  title="行动建议"
                  subtitle="按预期收益与投入排序"
                />
                <RecommendationsSection recommendations={result.recommendations} />
              </section>

              <ReportFooter dataSources={result.dataSources} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** 加载骨架（Agent 工作流运行中） */
function ReportSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
      <div className="h-3 w-40 animate-pulse rounded bg-secondary" />
      <div className="mt-3 h-7 w-2/3 animate-pulse rounded bg-secondary" />
      <div className="mt-6 h-24 w-full animate-pulse rounded-xl bg-secondary" />
      <div className="mt-8 h-40 w-full animate-pulse rounded-xl bg-secondary" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Agent 工作流运行中：Role → Intent → Metric → Data → Insight…
      </p>
    </div>
  );
}
