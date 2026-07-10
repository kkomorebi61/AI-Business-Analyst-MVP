"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  Database,
  GitCompare,
  Lightbulb,
  Route,
  Sparkles,
  Target,
  Terminal,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import SectionHeading from "@/components/report/section-heading";
import SummarySection from "@/components/report/summary-section";
import KpiCards from "@/components/report/kpi-cards";
import FindingsSection from "@/components/report/findings-section";
import RiskSection from "@/components/report/risk-section";
import RecommendationsSection from "@/components/report/recommendations-section";
import EvidenceDrawer from "@/components/report/evidence-drawer";
import MetricDetailDrawer from "@/components/metrics/metric-detail-drawer";
import type { Finding, Risk } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";
import type {
  CalculationAnswer,
  ComparisonAnswer,
  ExecutionAnswer,
  InsightAnswer,
  MetricAnswer,
  MissingDataAnswer,
  QueryAnswer,
  RequirementAnswer,
  StrategyAnswer,
  TrendAnswer,
} from "@/lib/routing/types";

/** 统一外壳：标题 + 子标题 + 主体 */
function CardShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 sm:p-7">
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div>
          <h3 className="text-[16px] font-semibold leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** GLM 叙事块（Insight / Strategy 启用 LLM 时） */
function Narrative({ text }: { text: string }) {
  return (
    <div className="mb-5 flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
      <p className="text-[13px] leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

/** SQL / 依据 折叠面板（可解释 / 可审计，doc 15 SQL First） */
function SqlEvidence({ sql, sources }: { sql: string; sources?: string[] }) {
  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer list-none text-[11px] font-medium text-blue-600 hover:text-blue-700">
        ▸ 查看等价 SQL{sources && sources.length > 0 ? " 与数据来源" : ""}（可审计）
      </summary>
      <div className="mt-2">
        <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-3 text-[11px] leading-relaxed text-slate-200">
          <code>{sql}</code>
        </pre>
        {sources && sources.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Database className="h-3 w-3" />
            源系统：
            {sources.map((s) => (
              <Badge key={s} variant="outline">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

/* ----------------------------- Metric ----------------------------- */

function MetricAnswerCard({ a }: { a: MetricAnswer }) {
  const up = a.direction !== "down";
  return (
    <CardShell
      icon={<Target className="h-[18px] w-[18px]" />}
      title={`${a.metric} · 指标查询`}
      subtitle="由 SQL Engine 直接聚合取数（cost 0，未调用 LLM）"
    >
      <div className="flex items-end gap-4">
        <div>
          <div className="text-xs text-muted-foreground">当期值</div>
          <div className="text-[34px] font-semibold leading-none text-foreground">{a.value}</div>
        </div>
        {a.prev && (
          <div className="pb-1">
            <div className="text-xs text-muted-foreground">上一周期</div>
            <div className="text-[15px] text-muted-foreground">{a.prev}</div>
          </div>
        )}
        {a.delta && (
          <span
            className={`mb-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {a.delta}
          </span>
        )}
      </div>
      <SqlEvidence sql={a.sql} sources={a.sources} />
    </CardShell>
  );
}

/* --------------------------- Calculation -------------------------- */

function CalculationAnswerCard({ a }: { a: CalculationAnswer }) {
  return (
    <CardShell
      icon={<Boxes className="h-[18px] w-[18px]" />}
      title={`${a.metric} · 指标计算`}
      subtitle="由 Metric Engine 按公式计算（cost 0，禁止 LLM 计算业务指标）"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs text-muted-foreground">计算结果</div>
          <div className="text-[34px] font-semibold leading-none text-foreground">{a.result}</div>
        </div>
        <div className="mb-1 rounded-lg bg-secondary px-3 py-1.5 font-mono text-xs text-foreground">
          {a.formula}
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">计算依据（可审计）</div>
        {a.evidence.map((e, i) => (
          <div key={i} className="flex justify-between rounded-md bg-[#F8F9FA] px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">{e.name}</span>
            <span className="font-medium text-foreground">{e.value}</span>
          </div>
        ))}
      </div>
      <SqlEvidence sql={a.sql} sources={a.sources} />
    </CardShell>
  );
}

/* ---------------------------- Execution --------------------------- */

function ExecutionAnswerCard({ a }: { a: ExecutionAnswer }) {
  if (a.capability === "未找到匹配能力") {
    return (
      <CardShell
        icon={<TriangleAlert className="h-[18px] w-[18px]" />}
        title="未命中系统能力"
        subtitle="Capability KB 无匹配项"
      >
        <p className="text-sm text-muted-foreground">{a.businessGoal}</p>
        <ul className="mt-3 space-y-1.5">
          {a.steps.map((s, i) => (
            <li key={i} className="text-xs text-muted-foreground">· {s}</li>
          ))}
        </ul>
      </CardShell>
    );
  }
  return (
    <CardShell
      icon={<Terminal className="h-[18px] w-[18px]" />}
      title={`${a.capability} · 系统操作`}
      subtitle={`${a.system} / ${a.module} · 由 Capability KB 直答（cost≈0，未调用 LLM）`}
    >
      <p className="text-sm text-muted-foreground">{a.businessGoal}</p>

      <div className="mt-4">
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">操作路径</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          {a.path.split(" > ").map((seg, i, arr) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <Badge variant={i === arr.length - 1 ? "info" : "secondary"}>{seg}</Badge>
              {i < arr.length - 1 && <span className="text-muted-foreground">›</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">操作步骤</div>
          <ol className="space-y-1.5">
            {a.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-600">
                  {i + 1}
                </span>
                <span className="text-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">最佳实践</div>
          <div className="flex flex-wrap gap-1.5">
            {a.bestPractice.map((b) => (
              <Badge key={b} variant="success">
                {b}
              </Badge>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">负责人：{a.owner}</div>
        </div>
      </div>
    </CardShell>
  );
}

/* ---------------------------- Strategy ---------------------------- */

function StrategyAnswerCard({ a }: { a: StrategyAnswer }) {
  return (
    <CardShell
      icon={<Route className="h-[18px] w-[18px]" />}
      title={`${a.strategyName} · 经营策略`}
      subtitle={`目标：${a.businessObjective} · Strategy Engine + Capability KB`}
    >
      {a.narrative && <Narrative text={a.narrative} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="经营问题" value={a.problem} />
        <Field label="根因" value={a.rootCause.join("、")} />
        <Field label="目标人群" value={a.targetAudience.join("、") || "—"} />
        <Field label="推荐渠道" value={a.channel.join("、") || "—"} />
        <Field label="优惠 / 权益" value={a.offer.join("、") || "—"} />
        <Field label="预期结果" value={a.expectedResult.join("；") || "—"} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5" />
          能力映射（复用现有能力，doc 16 Rule 2）
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {a.capabilities.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-[#F8F9FA] p-2.5">
              <div className="text-[13px] font-medium text-foreground">{c.capability}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {c.system} / {c.module} · {c.path}
              </div>
            </div>
          ))}
          {a.capabilities.length === 0 && (
            <div className="text-xs text-muted-foreground">无现成能力映射（待沉淀为新策略）</div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F8F9FA] p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] text-foreground">{value}</div>
    </div>
  );
}

/* -------------------------- Requirement --------------------------- */

function RequirementAnswerCard({ a }: { a: RequirementAnswer }) {
  return (
    <CardShell
      icon={<ClipboardList className="h-[18px] w-[18px]" />}
      title="需求设计 · PRD 建议"
      subtitle="Gap Analysis 检测能力缺口 + LLM 生成方案（最高成本档）"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={a.supported ? "success" : "warning"}>
          {a.supported ? "系统已支持" : "存在能力缺口"}
        </Badge>
        <span className="text-xs text-muted-foreground">{a.gapSummary}</span>
      </div>

      {a.gaps.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">能力缺口</div>
          <div className="flex flex-wrap gap-1.5">
            {a.gaps.map((g) => (
              <Badge key={g} variant="danger">
                {g}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-blue-600" />
          PRD 草案
        </div>
        <div className="text-[13px] text-foreground">{a.prd.businessValue}</div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">功能点建议</div>
            <ul className="space-y-1">
              {a.prd.featureProposals.map((f, i) => (
                <li key={i} className="flex gap-1.5 text-[13px] text-foreground">
                  <span className="text-blue-500">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">设计要点</div>
            <ul className="space-y-1">
              {a.prd.designOutline.map((d, i) => (
                <li key={i} className="flex gap-1.5 text-[13px] text-foreground">
                  <span className="text-blue-500">•</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ---------------------------- Insight ----------------------------- */
/**
 * Insight 复用 ReportView 的子区组件（Summary / KPI / Findings / Risk / Recommendations），
 * 接 EvidenceDrawer + MetricDetailDrawer，保证与 /report 视觉完全一致。
 */
function InsightAnswerCard({ a }: { a: InsightAnswer }) {
  const analysis = a.analysis;
  const [drawer, setDrawer] = useState<{ open: boolean; target: Finding | Risk | null }>({
    open: false,
    target: null,
  });
  const [metricDrawer, setMetricDrawer] = useState<{ open: boolean; key: MetricKey | null }>({
    open: false,
    key: null,
  });

  return (
    <div className="rounded-2xl border border-border bg-white p-6 sm:p-7">
      {a.narrative && <Narrative text={a.narrative} />}

      <div className="space-y-7">
        <SummarySection summary={analysis.summary} />

        <section>
          <SectionHeading index="01" title="KPI 驾驶舱" subtitle={`定义${analysis.rangeLabel}表现的核心指标`} />
          <KpiCards kpis={analysis.kpis} onViewMetric={(k) => setMetricDrawer({ open: true, key: k })} />
        </section>

        {analysis.findings.length > 0 && (
          <section>
            <SectionHeading index="02" title="关键发现" subtitle="按业务影响排序的洞察" />
            <FindingsSection
              findings={analysis.findings}
              onViewEvidence={(t) => setDrawer({ open: true, target: t })}
              onViewMetric={(k) => setMetricDrawer({ open: true, key: k })}
            />
          </section>
        )}

        {analysis.risks.length > 0 && (
          <section>
            <SectionHeading index="03" title="风险提示" subtitle="影响下期表现的重点风险" />
            <RiskSection
              risks={analysis.risks}
              onViewEvidence={(t) => setDrawer({ open: true, target: t })}
              onViewMetric={(k) => setMetricDrawer({ open: true, key: k })}
            />
          </section>
        )}

        {analysis.recommendations.length > 0 && (
          <section>
            <SectionHeading index="04" title="行动建议" subtitle="按预期收益与投入排序" />
            <RecommendationsSection recommendations={analysis.recommendations} />
          </section>
        )}
      </div>

      <EvidenceDrawer
        open={drawer.open}
        target={drawer.target}
        onClose={() => setDrawer({ open: false, target: null })}
      />
      <MetricDetailDrawer
        open={metricDrawer.open}
        metricKey={metricDrawer.key}
        onClose={() => setMetricDrawer({ open: false, key: null })}
      />
    </div>
  );
}

/* --------------------------- Comparison --------------------------- */

function ComparisonAnswerCard({ a }: { a: ComparisonAnswer }) {
  const up = a.direction !== "down";
  return (
    <CardShell
      icon={<GitCompare className="h-[18px] w-[18px]" />}
      title={`${a.metric} · 对比分析`}
      subtitle={`Window Engine · ${a.mode === "time" ? "时段对比" : "维度对比"}（cost 0，未调用 LLM）`}
    >
      {a.windowLabel && (
        <div className="mb-3 text-xs text-muted-foreground">数据截止 · {a.windowLabel}</div>
      )}

      {a.mode === "time" ? (
        <div className="flex flex-wrap items-end gap-8">
          {a.baseline && (
            <div>
              <div className="text-xs text-muted-foreground">基线 · {a.baseline.label}</div>
              <div className="mt-0.5 text-[28px] font-semibold leading-none text-foreground">
                {a.baseline.formatted}
              </div>
            </div>
          )}
          {a.comparison && (
            <div>
              <div className="text-xs text-muted-foreground">对比 · {a.comparison.label}</div>
              <div className="mt-0.5 text-[28px] font-semibold leading-none text-foreground">
                {a.comparison.formatted}
              </div>
            </div>
          )}
          {a.delta && (
            <span
              className={`mb-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              }`}
            >
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {a.delta}
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {a.channels?.map((c) => (
            <div
              key={c.channel}
              className="flex justify-between rounded-md bg-[#F8F9FA] px-3 py-2 text-[13px]"
            >
              <span className="text-muted-foreground">{c.channel}</span>
              <span className="font-medium text-foreground">{c.formatted}</span>
            </div>
          ))}
          {a.delta && <div className="pt-1 text-xs text-muted-foreground">差异 {a.delta}</div>}
        </div>
      )}

      <SqlEvidence sql={a.sql} />
    </CardShell>
  );
}

/* ----------------------------- Trend ------------------------------ */

/** 纯 SVG 走势线（项目「零额外依赖」原则，doc 18 §Trend） */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <div className="rounded-lg bg-[#F8F9FA] px-3 py-3 text-xs text-muted-foreground">
        数据点不足，无法绘制走势（共 {values.length} 个点）
      </div>
    );
  }
  const W = 640;
  const H = 120;
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (W - pad * 2) / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (H - pad * 2) * (1 - (v - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

function TrendAnswerCard({ a }: { a: TrendAnswer }) {
  return (
    <CardShell
      icon={<TrendingUp className="h-[18px] w-[18px]" />}
      title={`${a.metric} · 趋势分析`}
      subtitle={`Window Engine · ${a.windowLabel}（cost 0，未调用 LLM）`}
    >
      <Sparkline values={a.points.map((p) => p.value)} />
      <p className="mt-3 text-[13px] text-foreground">{a.summary}</p>
      <div className="mt-2 text-[11px] text-muted-foreground">共 {a.points.length} 个数据点</div>
      <SqlEvidence sql={a.sql} />
    </CardShell>
  );
}

/* -------------------------- Missing Data -------------------------- */

function MissingDataAnswerCard({ a }: { a: MissingDataAnswer }) {
  return (
    <CardShell
      icon={<TriangleAlert className="h-[18px] w-[18px] text-amber-500" />}
      title={`无法计算「${a.metric}」`}
      subtitle="数据缺失拦截 · No Unsupported Analysis（doc 19 §M4）"
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-[13px] leading-relaxed text-foreground">
          <span className="font-medium">原因：</span>
          {a.reason}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-[#F8F9FA] px-3 py-2 text-[13px] text-foreground">
          建议上传：<span className="font-medium text-blue-600">{a.recommendUpload}</span> 数据后重试
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-1 rounded-lg bg-[#1E3A8A] px-3 py-2 text-xs font-medium text-white hover:bg-[#1e40af]"
        >
          去上传数据
        </Link>
      </div>
    </CardShell>
  );
}

/* --------------------------- Renderer ----------------------------- */

export default function AnswerRenderer({ answer }: { answer: QueryAnswer }) {
  switch (answer.kind) {
    case "metric":
      return <MetricAnswerCard a={answer} />;
    case "calculation":
      return <CalculationAnswerCard a={answer} />;
    case "comparison":
      return <ComparisonAnswerCard a={answer} />;
    case "trend":
      return <TrendAnswerCard a={answer} />;
    case "missing_data":
      return <MissingDataAnswerCard a={answer} />;
    case "execution":
      return <ExecutionAnswerCard a={answer} />;
    case "strategy":
      return <StrategyAnswerCard a={answer} />;
    case "requirement":
      return <RequirementAnswerCard a={answer} />;
    case "insight":
      return <InsightAnswerCard a={answer} />;
  }
}
