"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import UnderstandingResultView from "@/components/upload/understanding-result";
import {
  FIELD_SPEC,
  INGEST_KINDS,
} from "@/lib/data-understanding/field-spec";
import type { FactTableKind } from "@/lib/data/fact-table-builder";
import type { UnderstandingResult } from "@/lib/data-understanding/types";
import type { HealthScore } from "@/lib/agents/health-score";
import type { InsightCard } from "@/lib/agents/insight-format";
import type { StrategyCard } from "@/lib/agents/strategy-v2";
import type { Task, TaskStatus } from "@/lib/project/task-store";
import type { GovernanceVerdict, KpiPoint } from "@/lib/agents/types";
import {
  CREDIBILITY_LABEL,
  INDUSTRY_LABEL,
  PHASE_INDEX,
  STATUS_BADGE,
  STATUS_LABEL,
  WIZARD_STEPS,
  type WizardStep,
} from "@/lib/project/labels";
import type {
  IngestStatus,
  ProjectDatasetSummary,
} from "@/lib/project/project-dataset-types";
import type { Project, ProjectIndustry } from "@/lib/project/types";
import type { Role } from "@/lib/kb/metric-kb";

/**
 * 项目详情（/projects/[id]）—— 8 步 AI 咨询 Wizard 壳（原型对齐）。
 * 顶部：项目列表返回 + 标题 + 副标题（项目号·行业·视角）+ 状态徽标。
 * 中部：8 步进度条（已完成绿✓ / 当前蓝 / 未完灰，可点切换查看）。
 * 内容：当前步骤面板（Step1 实存、Step2 模式卡、Step3/5/7 形态示例，其余占位 + engine 标注）。
 * 底部：上一步 / 继续 AI 分析（推进项目 phase）。
 */

const ROLE_LABEL: Record<Role, string> = {
  CEO: "CEO 视角",
  CRM_MANAGER: "CRM 运营视角",
  OPERATION_MANAGER: "运营视角",
};

function cx(...c: (string | false | undefined | null)[]): string {
  return c.filter(Boolean).join(" ");
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await r.json();
      setProject(data.project);
      const ph = data.project.currentPhase as Project["currentPhase"];
      setActiveStep(ph === "PRE_A" ? 1 : PHASE_INDEX[ph]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // 进入项目即激活其数据（项目内诊断/查询读项目数据；幂等，ref 防重）
  const activatedRef = useRef<string | null>(null);
  useEffect(() => {
    if (activatedRef.current === id) return;
    activatedRef.current = id;
    void fetch(`/api/projects/${id}/activate`, { method: "POST" }).catch(() => {});
  }, [id]);

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<Project | null> => {
      const r = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) {
        setProject(data.project);
        return data.project as Project;
      }
      return null;
    },
    [id],
  );

  const advance = async () => {
    if (!project || activeStep === 8) return;
    const nextNo = Math.min(activeStep + 1, 8);
    setBusy(true);
    const nextPhase = WIZARD_STEPS[nextNo - 1].phase;
    await patch({ phase: nextPhase });
    setActiveStep(nextNo);
    setBusy(false);
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载项目…
        </div>
      </Shell>
    );
  }
  if (notFound || !project) {
    return (
      <Shell>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          项目不存在或已删除。
          <Link href="/projects" className="ml-1 text-blue-600 underline">
            返回项目列表
          </Link>
        </div>
      </Shell>
    );
  }

  const doneStepNo = Math.max(0, PHASE_INDEX[project.currentPhase] - 1);

  return (
    <Shell>
      {/* 标题区 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            项目列表
          </Link>
          <h1 className="mt-2 text-[22px] font-semibold">{project.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            项目 {project.id.slice(-8)} · {INDUSTRY_LABEL[project.industry]} ·{" "}
            {ROLE_LABEL[project.perspective]} · 可信度 {CREDIBILITY_LABEL[project.credibilityLevel]}（{project.dataCompletenessPct}%）
          </p>
          {project.businessGoal && (
            <p className="mt-1.5 text-xs text-foreground">
              <span className="text-muted-foreground">当前业务问题：</span>
              {project.businessGoal}
            </p>
          )}
        </div>
        <Badge variant={STATUS_BADGE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
      </div>

      {/* 8 步进度条 */}
      <nav className="mt-6 rounded-xl border border-border bg-white p-3">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {WIZARD_STEPS.map((s, i) => {
            const done = s.no <= doneStepNo;
            const current = s.no === activeStep;
            return (
              <div key={s.phase} className="flex items-center">
                <button
                  onClick={() => setActiveStep(s.no)}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted"
                >
                  <span
                    className={cx(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                      done
                        ? "bg-green-500 text-white"
                        : current
                          ? "bg-[#1E3A8A] text-white"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : s.no}
                  </span>
                  <span
                    className={cx(
                      "whitespace-nowrap text-xs",
                      current ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {i < WIZARD_STEPS.length - 1 && (
                  <span className="mx-0.5 text-muted-foreground/40">›</span>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* 当前步骤内容 */}
      <div className="mt-6">
        <StepPanel step={activeStep} project={project} onPatch={patch} onAdvance={advance} />
      </div>

      {/* 底部导航 */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
        <button
          onClick={() => setActiveStep(Math.max(activeStep - 1, 1))}
          disabled={activeStep === 1}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
        >
          上一步
        </button>
        <button
          onClick={() => void advance()}
          disabled={busy || activeStep === 8}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {activeStep === 8 ? "已完成" : "继续 AI 分析"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[1100px] px-6 py-6">{children}</main>;
}

/* ------------------------------ 步骤面板 ------------------------------ */

function StepPanel({
  step,
  project,
  onPatch,
  onAdvance,
}: {
  step: number;
  project: Project;
  onPatch: (b: Record<string, unknown>) => Promise<Project | null>;
  onAdvance: () => Promise<void>;
}) {
  const meta = WIZARD_STEPS[step - 1];
  switch (step) {
    case 1:
      return <StepBusiness project={project} onPatch={onPatch} />;
    case 2:
      return <StepData project={project} onAdvance={onAdvance} />;
    case 3:
      return <StepHealthCheck />;
    case 4:
      return <StepDiagnosis projectId={project.id} onAdvance={onAdvance} />;
    case 5:
      return <StepRootCauseV2 projectId={project.id} onAdvance={onAdvance} />;
    case 6:
      return <StepStrategy projectId={project.id} onAdvance={onAdvance} />;
    case 7:
      return <StepExecution projectId={project.id} onAdvance={onAdvance} />;
    default:
      return <StepPreview meta={meta} />;
  }
}

/* ----------------------- Step 4 · 经营诊断（Insight Engine V2） ----------------------- */

interface DiagnosisResponse {
  range: number;
  rangeLabel: string;
  anchor: string;
  hasComparison: boolean;
  summary: string;
  health: HealthScore;
  insights: InsightCard[];
  kpis: KpiPoint[];
  trend: { labels: string[]; series: { key: string; label: string; data: number[] }[] };
  anomalies: { event_name: string; event_date: string; direction: string; description: string }[];
  anomaly: { detected: boolean; metric?: string; ratio?: number };
  problemTree: { text: string; pct?: string; depth: number; tone?: "blue" | "red" | "amber" }[];
  governance: GovernanceVerdict;
}

const HEALTH_STATUS_LABEL = { healthy: "健康", watch: "关注", risk: "风险" } as const;
const HEALTH_STATUS_COLOR = { healthy: "#16a34a", watch: "#d97706", risk: "#dc2626" } as const;
const SEVERITY_BADGE: Record<string, "danger" | "warning" | "secondary"> = {
  high: "danger",
  medium: "warning",
  low: "secondary",
};
const CONF_LABEL = { High: "高可信", Medium: "中可信", Low: "低可信", Caution: "谨慎" } as const;

function StepDiagnosis({
  projectId,
  onAdvance,
}: {
  projectId: string;
  onAdvance: () => Promise<void>;
}) {
  const [data, setData] = useState<DiagnosisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricIdx, setMetricIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}/diagnosis`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DiagnosisResponse) => !cancelled && setData(d))
      .catch(() => !cancelled && setError("诊断加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const goNext = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onAdvance();
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepSection meta={WIZARD_STEPS[3]}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在生成经营诊断…
        </div>
      ) : error || !data ? (
        <p className="text-sm text-red-600">{error ?? "诊断失败"}</p>
      ) : (
        <div className="space-y-6">
          {/* 模块1 · 经营健康度 */}
          <HealthCard health={data.health} hasComparison={data.hasComparison} />

          {/* 模块2 · AI 关键发现 */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">AI 关键发现</h4>
            {data.insights.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-white p-4 text-xs text-muted-foreground">
                {data.hasComparison
                  ? "本期未触发关键发现或风险。"
                  : "数据不足一个完整环比周期，暂无对比型发现。"}
              </p>
            ) : (
              <div className="space-y-3">
                {data.insights.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={SEVERITY_BADGE[c.severity]}>
                        {c.kind === "risk" ? "风险" : "发现"}·
                        {c.severity === "high" ? "高" : c.severity === "medium" ? "中" : "低"}
                      </Badge>
                      {c.confidence && (
                        <Badge variant="outline">{CONF_LABEL[c.confidence]}</Badge>
                      )}
                      <span className="text-sm font-semibold text-foreground">{c.title}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{c.businessImpact}</p>
                    {c.evidence && c.evidence.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {c.evidence.items.slice(0, 3).map((it, i) => (
                          <span key={i} className="rounded bg-secondary px-1.5 py-0.5">
                            {it.metric}：{fmtNum(it.before)} → {fmtNum(it.after)}（
                            {it.change ?? 0}
                            {it.changeKind === "pct" ? "%" : it.changeKind === "pp" ? "pp" : ""}
                            ）
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-blue-600">
                      下一步：{c.nextSteps.join("、")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 模块3 · 指标趋势 */}
          <TrendPanel data={data} metricIdx={metricIdx} setMetricIdx={setMetricIdx} />

          {/* 模块4 · 异常 / 事件归因 */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">异常检测</h4>
            {data.anomaly.detected ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                检测到异常（{data.anomaly.metric} 环比约 {data.anomaly.ratio}×），建议结合事件归因研判。
              </p>
            ) : (
              <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                未检测到量级异常（阈值 5×）。
              </p>
            )}
            {data.anomalies.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {data.anomalies.map((e, i) => (
                  <li key={i}>
                    · {e.event_date} {e.event_name}（{e.direction}）：{e.description}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 模块5 · 问题拆解树 */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">问题拆解树（预览）</h4>
            <div className="space-y-1.5 rounded-lg border border-border bg-white p-3">
              {data.problemTree.map((n, i) => (
                <div
                  key={i}
                  className={cx(
                    "rounded-md border p-2 text-xs",
                    n.tone === "red"
                      ? "border-red-200 bg-red-50"
                      : n.tone === "amber"
                        ? "border-amber-200 bg-amber-50"
                        : "border-blue-200 bg-blue-50",
                  )}
                  style={{ marginLeft: n.depth * 18 }}
                >
                  <span className="font-medium">{n.text}</span>
                  {n.pct && <span className="ml-2 text-muted-foreground">贡献 {n.pct}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 进入根因分析 */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">{data.rangeLabel} · 锚点 {data.anchor}</p>
            <button
              onClick={() => void goNext()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              进入根因分析
            </button>
          </div>
        </div>
      )}
    </StepSection>
  );
}

function HealthCard({ health, hasComparison }: { health: HealthScore; hasComparison: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - health.score / 100);
  const color = HEALTH_STATUS_COLOR[health.status];
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-[#F8F9FA] p-4">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="#E5E7EB" strokeWidth="11" />
          <circle
            cx="65"
            cy="65"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 65 65)"
          />
          <text x="65" y="65" textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="700" className="fill-foreground">
            {health.score}
          </text>
        </svg>
        <p className="mt-1 text-xs font-medium" style={{ color }}>
          {HEALTH_STATUS_LABEL[health.status]}
        </p>
        <p className="text-[11px] text-muted-foreground">综合健康度</p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <h4 className="text-sm font-semibold">维度评分</h4>
        <div className="mt-2 grid gap-2.5">
          {health.dimensions
            .filter((d) => d.metrics.length > 0)
            .map((d) => (
              <div key={d.key} className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground">{d.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.score}%`, backgroundColor: d.score >= 80 ? "#16a34a" : d.score >= 60 ? "#d97706" : "#dc2626" }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium">{d.score}</span>
              </div>
            ))}
        </div>
        {health.topRisks.length > 0 && (
          <div className="mt-3 rounded-md bg-amber-50 p-2 text-[11px] text-amber-700">
            <p className="font-semibold">主要风险</p>
            {health.topRisks.map((t, i) => (
              <p key={i}>· {t.label}：{t.reason}</p>
            ))}
          </div>
        )}
        {!hasComparison && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            提示：数据不足一个完整环比周期，健康度基于现状中性评估。
          </p>
        )}
      </div>
    </div>
  );
}

function TrendPanel({
  data,
  metricIdx,
  setMetricIdx,
}: {
  data: DiagnosisResponse;
  metricIdx: number;
  setMetricIdx: (n: number) => void;
}) {
  const series = data.trend.series;
  const idx = Math.min(metricIdx, series.length - 1);
  const sel = series[idx];
  const values = sel.data;
  const w = 480;
  const h = 140;
  const pad = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">指标趋势</h4>
        <div className="flex flex-wrap gap-1">
          {series.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setMetricIdx(i)}
              className={cx(
                "rounded px-2 py-0.5 text-[11px]",
                i === idx ? "bg-[#1E3A8A] text-white" : "bg-secondary text-muted-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {values.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          暂无趋势数据。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white p-2">
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
            <polyline
              fill="none"
              stroke="#1E3A8A"
              strokeWidth="2"
              points={pts.join(" ")}
            />
            {pts.map((p, i) => {
              const [x, y] = p.split(",");
              return <circle key={i} cx={x} cy={y} r="2.5" fill="#1E3A8A" />;
            })}
            {values.length <= 14 &&
              data.trend.labels.map((lb, i) => (
                <text key={i} x={pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2)} y={h - 6} textAnchor="middle" fontSize="8" className="fill-muted-foreground">
                  {lb.slice(5)}
                </text>
              ))}
          </svg>
        </div>
      )}
    </div>
  );
}

function fmtNum(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return Math.round(v).toLocaleString("zh-CN");
}

function StepSection({ meta, children }: { meta: WizardStep; children?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">
          Step {meta.no} · {meta.label}
        </h2>
        {meta.engine && <Badge variant="outline">将接入 · {meta.engine}</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{meta.desc}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StepPreview({ meta }: { meta: WizardStep }) {
  return (
    <StepSection meta={meta}>
      <div className="rounded-lg border border-dashed border-border bg-[#F8F9FA] p-10 text-center">
        <p className="text-sm text-muted-foreground">这一步的产出（{meta.desc}）将在此呈现。</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          骨架阶段占位——后续接入 {meta.engine ?? "对应引擎"} 与示例数据预览。
        </p>
      </div>
    </StepSection>
  );
}

/* ------------------------------- Step 1 ------------------------------- */

function StepBusiness({
  project,
  onPatch,
}: {
  project: Project;
  onPatch: (b: Record<string, unknown>) => Promise<Project | null>;
}) {
  const [name, setName] = useState(project.name);
  const [industry, setIndustry] = useState<ProjectIndustry>(project.industry);
  const [perspective, setPerspective] = useState<Role>(project.perspective);
  const [goal, setGoal] = useState(project.businessGoal);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(project.name);
    setIndustry(project.industry);
    setPerspective(project.perspective);
    setGoal(project.businessGoal);
  }, [project]);

  const save = async () => {
    setSaving(true);
    await onPatch({ name, industry, perspective, businessGoal: goal });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const field =
    "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <StepSection meta={WIZARD_STEPS[0]}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium">项目名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-medium">行业</span>
          <select value={industry} onChange={(e) => setIndustry(e.target.value as ProjectIndustry)} className={field}>
            {(Object.keys(INDUSTRY_LABEL) as ProjectIndustry[]).map((k) => (
              <option key={k} value={k}>{INDUSTRY_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium">分析视角</span>
          <select value={perspective} onChange={(e) => setPerspective(e.target.value as Role)} className={field}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((k) => (
              <option key={k} value={k}>{ROLE_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium">业务目标 / 要解决的问题</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className={`resize-none ${field}`} />
        </label>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          保存
        </button>
        {saved && <span className="text-xs text-green-600">已保存</span>}
      </div>
    </StepSection>
  );
}

/* ------------------------------- Step 2 · 数据采集中心 ------------------------------- */

const INGEST_STATUS_LABEL: Record<IngestStatus, string> = {
  success: "成功",
  processing: "处理中",
  failed: "失败",
};
const INGEST_STATUS_BADGE: Record<IngestStatus, "success" | "warning" | "danger"> = {
  success: "success",
  processing: "warning",
  failed: "danger",
};

function fmtUploadTime(at: string): string {
  try {
    return new Date(at).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return at;
  }
}

function StepData({
  project,
  onAdvance,
}: {
  project: Project;
  onAdvance: () => Promise<void>;
}) {
  const [datasets, setDatasets] = useState<ProjectDatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${project.id}/datasets`, { cache: "no-store" });
      const d = (await r.json()) as { datasets?: ProjectDatasetSummary[] };
      setDatasets(d.datasets ?? []);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasSuccess = datasets.some((d) => d.ingestStatus === "success");

  const remove = async (datasetId: string) => {
    if (!window.confirm("删除这份数据集？")) return;
    const r = await fetch(`/api/projects/${project.id}/datasets/${datasetId}`, {
      method: "DELETE",
    });
    if (r.ok) {
      const d = (await r.json()) as { datasets?: ProjectDatasetSummary[] };
      setDatasets(d.datasets ?? []);
    }
  };

  const goHealthCheck = async () => {
    if (!hasSuccess || advancing) return;
    setAdvancing(true);
    try {
      await onAdvance();
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <StepSection meta={WIZARD_STEPS[1]}>
      {/* 项目信息 */}
      <div className="rounded-lg bg-[#F8F9FA] p-4">
        <div className="text-[11px] text-muted-foreground">项目</div>
        <div className="text-sm font-semibold text-foreground">{project.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          当前业务问题：{project.businessGoal || "（未填写，可在「业务背景」补充）"}
        </div>
      </div>

      {/* Module 1 · 已上传数据 */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">
            已上传数据
            <span className="ml-1 text-muted-foreground">（{datasets.length}）</span>
          </h4>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
        {loading ? (
          <div className="h-20 animate-pulse rounded-lg border border-border bg-white" />
        ) : datasets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-xs text-muted-foreground">
            尚未上传数据，请先「添加数据」。
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">数据名称</th>
                  <th className="px-3 py-2 text-left font-medium">类型</th>
                  <th className="px-3 py-2 text-left font-medium">记录数</th>
                  <th className="px-3 py-2 text-left font-medium">上传时间</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {datasets.map((d) => {
                  const kinds = Object.keys(d.schema.matchedByTable) as FactTableKind[];
                  return (
                    <tr key={d.id}>
                      <td className="px-3 py-2.5 font-medium text-foreground">{d.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {kinds.map((k) => FIELD_SPEC[k].label).join("、") || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {d.recordCount || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {d.uploadTime ? fmtUploadTime(d.uploadTime) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={INGEST_STATUS_BADGE[d.ingestStatus]}>
                          {INGEST_STATUS_LABEL[d.ingestStatus]}
                        </Badge>
                        {d.ingestStatus === "failed" && d.ingestError && (
                          <div className="mt-0.5 text-[11px] text-red-600">{d.ingestError}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => void remove(d.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Module 2 · 添加数据 */}
      <div className="mt-5">
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af]"
        >
          <Plus className="h-4 w-4" />
          添加数据
        </button>
      </div>

      {/* Module 3 · 字段规范提示 */}
      <div className="mt-5">
        <h4 className="mb-2 text-sm font-semibold">上传前字段规范提示</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {INGEST_KINDS.map(({ kind }) => {
            const spec = FIELD_SPEC[kind];
            return (
              <div key={kind} className="rounded-lg border border-border bg-white p-3">
                <div className="text-xs font-semibold text-foreground">{spec.label}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  用途：{spec.purpose.join("、")}
                </div>
                <div className="mt-1.5 text-[11px]">
                  <span className="text-muted-foreground">必须：</span>
                  <code className="rounded bg-secondary px-1 py-0.5 text-[10px]">
                    {spec.required.join("、")}
                  </code>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  推荐：{spec.recommended.join("、")}
                </div>
                <div className="mt-1 text-[11px] text-amber-700">
                  缺少影响：{spec.missingImpact.join("、")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 进入数据体检（门控：≥1 success） */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {hasSuccess ? "数据就绪，可进入数据体检。" : "请先上传至少一份数据，再进入数据体检。"}
        </p>
        <button
          onClick={() => void goHealthCheck()}
          disabled={!hasSuccess || advancing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {advancing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          进入数据体检
        </button>
      </div>

      <AddDataModal
        projectId={project.id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onUploaded={() => void load()}
      />
    </StepSection>
  );
}

/** 添加数据弹窗：选类型 → 看字段规范 → 上传 → 处理中 → 成功/失败 */
function AddDataModal({
  projectId,
  open,
  onClose,
  onUploaded,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [phase, setPhase] = useState<"select" | "preview" | "uploading" | "success" | "failed">(
    "select",
  );
  const [kind, setKind] = useState<FactTableKind>("channel");
  const [files, setFiles] = useState<File[] | null>(null);
  const [understanding, setUnderstanding] = useState<UnderstandingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordName, setRecordName] = useState<string>("");

  useEffect(() => {
    if (open) {
      setPhase("select");
      setKind("channel");
      setFiles(null);
      setUnderstanding(null);
      setErrorMsg(null);
      setRecordName("");
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!files || !files.length) return;
    setPhase("uploading");
    setErrorMsg(null);
    const form = new FormData();
    for (const f of files) form.append("files", f);

    let res: Response;
    try {
      res = await fetch(`/api/projects/${projectId}/datasets`, { method: "POST", body: form });
    } catch {
      setPhase("failed");
      setErrorMsg("网络错误，请重试");
      return;
    }

    // 413 / 500 可能返回非 JSON（Next 错误页）——先判 content-type 再解析
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.includes("application/json")) {
      let msg = `上传失败（${res.status}）`;
      if (ct.includes("application/json")) {
        try {
          const d = (await res.json()) as { error?: string };
          msg = d.error ?? msg;
        } catch {
          /* ignore */
        }
      }
      setPhase("failed");
      setErrorMsg(res.status === 413 ? "文件过大（413），请压缩或分批上传" : msg);
      return;
    }

    const data = (await res.json()) as {
      dataset?: ProjectDatasetSummary;
      understanding?: UnderstandingResult | null;
    };
    const ds = data.dataset;
    setRecordName(ds?.name ?? "");
    if (ds?.ingestStatus === "success") {
      setUnderstanding(data.understanding ?? null);
      setPhase("success");
      onUploaded();
    } else {
      setErrorMsg(ds?.ingestError ?? "上传失败");
      setPhase("failed");
      onUploaded(); // failed 记录同样入列表
    }
  };

  const spec = FIELD_SPEC[kind];
  const btnPrimary =
    "inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-40";
  const btnGhost =
    "rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">添加数据</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              选择数据类型 → 查看字段规范 → 上传 CSV（聚合日表）。
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === "select" && (
          <div className="mt-5 space-y-4">
            <div>
              <span className="text-xs font-medium text-foreground">数据类型</span>
              <div className="mt-2 grid gap-2">
                {INGEST_KINDS.map(({ kind: k, label }) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={cx(
                      "rounded-lg border p-3 text-left transition-colors",
                      kind === k
                        ? "border-[#1E3A8A] bg-blue-50"
                        : "border-border bg-white hover:bg-muted",
                    )}
                  >
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {FIELD_SPEC[k].purpose.join("、")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-foreground">选择文件（CSV，可多选）</span>
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : null)}
                className="mt-1 block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className={btnGhost}>
                取消
              </button>
              <button
                onClick={() => setPhase("preview")}
                disabled={!files?.length}
                className={btnPrimary}
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
              <div className="font-semibold text-blue-700">上传前请确认 · {spec.label}</div>
              <div className="mt-1 text-blue-700/80">
                必须字段：
                <code className="ml-1 rounded bg-white/60 px-1 py-0.5 text-[10px]">
                  {spec.required.join("、")}
                </code>
              </div>
              <div className="mt-1 text-blue-700/80">推荐字段：{spec.recommended.join("、")}</div>
              <div className="mt-1 text-amber-700">缺少影响：{spec.missingImpact.join("、")}</div>
              <div className="mt-1 text-blue-700/70">
                已选：{files?.map((f) => f.name).join("、")}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPhase("select")} className={btnGhost}>
                返回
              </button>
              <button onClick={() => void submit()} className={btnPrimary}>
                <Upload className="h-4 w-4" />
                开始上传
              </button>
            </div>
          </div>
        )}

        {phase === "uploading" && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            文件解析与入库中…
          </div>
        )}

        {phase === "success" && (
          <div className="mt-5">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                上传成功
              </div>
              <div className="mt-1 text-xs text-green-700/80">文件：{recordName}</div>
            </div>
            {understanding && (
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-border p-2">
                <UnderstandingResultView u={understanding} />
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPhase("select");
                  setFiles(null);
                }}
                className={btnGhost}
              >
                继续添加
              </button>
              <button onClick={onClose} className={btnPrimary}>
                完成
              </button>
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="mt-5">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-red-700">
                <AlertCircle className="h-4 w-4" />
                上传失败
              </div>
              <div className="mt-1 text-xs text-red-700/80">{errorMsg}</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPhase("select")} className={btnPrimary}>
                重新上传
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Step 3 ------------------------------- */

const HEALTH_DIMS = [
  { label: "完整性", value: 92, tone: "green" },
  { label: "一致性", value: 88, tone: "green" },
  { label: "覆盖度", value: 74, tone: "amber" },
  { label: "可信度", value: 96, tone: "green" },
  { label: "时效性", value: 58, tone: "red" },
];
const TONE_BAR: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

function StepHealthCheck() {
  const score = 82;
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  return (
    <StepSection meta={WIZARD_STEPS[2]}>
      <div className="text-[11px] text-amber-600">↓ 以下为示例数据预览，将接入 data-understanding 引擎</div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-[#F8F9FA] p-6">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={r} fill="none" stroke="#E5E7EB" strokeWidth="12" />
            <circle
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke="#1E3A8A"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
            />
            <text x="70" y="70" textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontSize="34" fontWeight="700">
              {score}
            </text>
          </svg>
          <p className="mt-2 text-xs font-medium text-green-600">✓ 可支持诊断与根因分析</p>
          <p className="text-[11px] text-muted-foreground">综合数据质量评分</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold">维度评分</h4>
          <div className="mt-3 space-y-2.5">
            {HEALTH_DIMS.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="w-16 text-xs text-muted-foreground">{d.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className={cx("h-full rounded-full", TONE_BAR[d.tone])} style={{ width: `${d.value}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium">{d.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-amber-50 p-3 text-xs">
              <p className="font-semibold text-amber-700">⚠ 建议补充数据</p>
              <p className="mt-1 text-amber-700/80">· 华东区门店级订单明细<br />· 会员等级映射表</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-xs">
              <p className="font-semibold text-blue-700">◆ 支持的分析能力</p>
              <p className="mt-1 text-blue-700/80">· 趋势 / 异常 / 健康度<br />· 会员分层 · 根因树</p>
            </div>
          </div>
        </div>
      </div>
    </StepSection>
  );
}

/* ----------------------- Step 5 · 根因分析（真实引擎） ----------------------- */

function StepRootCauseV2({
  projectId,
  onAdvance,
}: {
  projectId: string;
  onAdvance: () => Promise<void>;
}) {
  const [data, setData] = useState<DiagnosisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/diagnosis`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DiagnosisResponse) => !cancelled && setData(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const tree = data?.problemTree ?? [];

  return (
    <StepSection meta={WIZARD_STEPS[4]}>
      {loading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载根因…
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-semibold">问题树 · 根因拆解</h4>
            <div className="space-y-1.5 rounded-lg border border-border bg-white p-3">
              {tree.length === 0 && (
                <p className="text-xs text-muted-foreground">暂无可比根因（数据不足一个完整周期）。</p>
              )}
              {tree.map((n, i) => (
                <div
                  key={i}
                  className={cx(
                    "rounded-md border p-2 text-xs",
                    n.tone === "red"
                      ? "border-red-200 bg-red-50"
                      : n.tone === "amber"
                        ? "border-amber-200 bg-amber-50"
                        : "border-blue-200 bg-blue-50",
                  )}
                  style={{ marginLeft: n.depth * 18 }}
                >
                  <span className="font-medium">{n.text}</span>
                  {n.pct && <span className="ml-2 text-muted-foreground">{n.pct}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <h4 className="text-sm font-semibold">事件归因</h4>
              {data.anomalies.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">本周期内无命中的业务事件。</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.anomalies.map((e, i) => (
                    <li key={i} className="border-l-2 border-blue-300 pl-3">
                      <p className="text-xs font-medium">
                        {e.event_date} · {e.event_name}（{e.direction}）
                      </p>
                      <p className="text-[11px] text-muted-foreground">{e.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-border p-4">
              <h4 className="text-sm font-semibold">关键发现（证据）</h4>
              <ul className="mt-2 space-y-1.5">
                {data.insights.slice(0, 4).map((c) => (
                  <li key={c.id} className="text-xs">
                    <span className="font-medium">{c.title}</span>
                    <span className="ml-1 text-muted-foreground">— {c.businessImpact}</span>
                  </li>
                ))}
                {data.insights.length === 0 && (
                  <li className="text-xs text-muted-foreground">暂无关键发现。</li>
                )}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-border pt-4">
            <button
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await onAdvance();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              进入策略方案
            </button>
          </div>
        </div>
      )}
    </StepSection>
  );
}

/* ----------------------- Step 6 · 策略方案（Strategy V2） ----------------------- */

const PRIORITY_BADGE: Record<string, "danger" | "warning" | "secondary"> = {
  P0: "danger",
  P1: "warning",
  P2: "secondary",
};

function StepStrategy({
  projectId,
  onAdvance,
}: {
  projectId: string;
  onAdvance: () => Promise<void>;
}) {
  const [strategies, setStrategies] = useState<StrategyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasComparison, setHasComparison] = useState(true);
  const [adoptedId, setAdoptedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/projects/${projectId}/strategy`, { cache: "no-store" });
    const d = (await r.json()) as { strategies: StrategyCard[]; hasComparison: boolean };
    setStrategies(d.strategies ?? []);
    setHasComparison(d.hasComparison);
    setLoading(false);
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);

  const adopt = async (s: StrategyCard) => {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate",
        strategy: {
          id: s.scenarioId,
          name: s.name,
          channel: s.channel,
          targetUser: s.targetUser,
          expectedMetric: s.expectedMetric,
        },
      }),
    });
    setAdoptedId(s.id);
    setBusy(false);
  };

  return (
    <StepSection meta={WIZARD_STEPS[5]}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 生成策略…
        </div>
      ) : strategies.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-xs text-muted-foreground">
          {hasComparison
            ? "当前指标未触发明显问题，暂无推荐策略。"
            : "数据不足一个完整环比周期，无法识别需干预的指标。"}
        </p>
      ) : (
        <div className="space-y-4">
          {strategies.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={PRIORITY_BADGE[s.priority.level]}>{s.priority.level}</Badge>
                <Badge variant="outline">可信·{s.credibility}</Badge>
                <span className="text-sm font-semibold text-foreground">{s.name}</span>
                <span className="text-[11px] text-muted-foreground">（{s.problemType}）</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{s.appliesTo}</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-[#F8F9FA] p-3 text-xs">
                  <div className="text-muted-foreground">目标人群</div>
                  <div className="mt-0.5 font-medium">{s.targetUser || "—"}</div>
                  <div className="mt-1.5 text-muted-foreground">执行渠道</div>
                  <div className="mt-0.5 font-medium">{s.channel.join("、") || "—"}</div>
                </div>
                <div className="rounded-md bg-[#F8F9FA] p-3 text-xs">
                  <div className="text-muted-foreground">预计收益（区间）</div>
                  <div className="mt-0.5 font-medium text-blue-700">
                    ¥{fmtNum(s.expectedROI.low)} – ¥{fmtNum(s.expectedROI.high)}
                  </div>
                  <div className="mt-1.5 text-muted-foreground">可行性</div>
                  <div className="mt-0.5 font-medium">{s.capabilityMapping.feasibilityPct}%</div>
                </div>
              </div>

              <div className="mt-3 text-[11px]">
                <span className="text-muted-foreground">能力映射：</span>
                {s.capabilityMapping.items.map((it, i) => (
                  <span
                    key={i}
                    className={cx(
                      "ml-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5",
                      it.has ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
                    )}
                  >
                    {it.has ? "✓" : "✗"} {it.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-amber-700">风险：{s.risk}</p>

              <div className="mt-3 flex items-center justify-between">
                <details className="text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer">推荐依据</summary>
                  <ul className="mt-1 list-disc pl-4">
                    {s.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
                {adoptedId === s.id ? (
                  <span className="text-xs text-green-600">✓ 已生成执行任务</span>
                ) : (
                  <button
                    onClick={() => void adopt(s)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1e40af] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    采用此策略
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end border-t border-border pt-4">
            <button
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await onAdvance();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              进入执行计划
            </button>
          </div>
        </div>
      )}
    </StepSection>
  );
}

/* ----------------------- Step 7 · 执行计划（真实任务） ----------------------- */

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "待启动",
  doing: "进行中",
  done: "已完成",
};
const TASK_STATUS_BADGE: Record<TaskStatus, "secondary" | "info" | "success"> = {
  todo: "secondary",
  doing: "info",
  done: "success",
};

function StepExecution({
  projectId,
  onAdvance,
}: {
  projectId: string;
  onAdvance: () => Promise<void>;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" });
    const d = (await r.json()) as { tasks: Task[] };
    setTasks(d.tasks ?? []);
    setLoading(false);
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: TaskStatus) => {
    await fetch(`/api/projects/${projectId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const addTask = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const r = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", task: { taskName: newName.trim() } }),
    });
    if (r.ok) {
      const d = (await r.json()) as { all: Task[] };
      setTasks(d.all ?? []);
      setNewName("");
    }
    setAdding(false);
  };

  const remove = async (id: string) => {
    const r = await fetch(`/api/projects/${projectId}/tasks?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      const d = (await r.json()) as { all: Task[] };
      setTasks(d.all ?? []);
    }
  };

  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <StepSection meta={WIZARD_STEPS[6]}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载任务…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              共 {tasks.length} 个任务 · 已完成 {done}
            </p>
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="新增任务…"
                className="w-44 rounded-lg border border-border bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-400"
              />
              <button
                onClick={() => void addTask()}
                disabled={adding || !newName.trim()}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> 添加
              </button>
            </div>
          </div>

          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-xs text-muted-foreground">
              暂无任务。可在「策略方案」采用策略自动生成，或在此手动添加。
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">任务</th>
                    <th className="px-3 py-2 text-left font-medium">负责人</th>
                    <th className="px-3 py-2 text-left font-medium">系统</th>
                    <th className="px-3 py-2 text-left font-medium">截止</th>
                    <th className="px-3 py-2 text-left font-medium">目标</th>
                    <th className="px-3 py-2 text-left font-medium">状态</th>
                    <th className="px-3 py-2 text-left font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2.5 font-medium text-foreground">{t.taskName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{t.owner}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{t.system}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{t.deadline}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{t.metric}</td>
                      <td className="px-3 py-2.5">
                        <select
                          value={t.status}
                          onChange={(e) => void setStatus(t.id, e.target.value as TaskStatus)}
                          className="rounded border border-border bg-white px-1.5 py-1 text-xs"
                        >
                          {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <Badge variant={TASK_STATUS_BADGE[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => void remove(t.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end border-t border-border pt-4">
            <button
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await onAdvance();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              进入效果追踪
            </button>
          </div>
        </div>
      )}
    </StepSection>
  );
}
