import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Database,
  Gauge,
  GitBranch,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import TopNav from "@/components/top-nav";
import { listSources, type SourceTrust } from "@/lib/data/data-trust";
import { METRIC_SPECS, type MetricKey } from "@/lib/kb/metric-kb";
import { getUnderstanding, isSample } from "@/lib/data/dataset-store";
import { SCENARIO_LABELS } from "@/lib/data-understanding/scenario";
import { DATA_TYPE_LABELS } from "@/lib/data-understanding/recommend";

/**
 * 数据可信中心（Data Trust Center，路由：/trust）
 * 来源：10_Data_Trust_Layer.md · Data First 升级叠加「数据理解概览 + 缺口」（doc19 M4）。
 * 展示：数据源状态 / 时效 / 覆盖率 / 健康度 / 数据血缘 / 指标定义 / 当前数据缺口。
 */
const HEALTH_STYLE: Record<string, string> = {
  Healthy: "bg-emerald-50 text-emerald-700",
  Warning: "bg-amber-50 text-amber-700",
  Delayed: "bg-orange-50 text-orange-700",
  Error: "bg-red-50 text-red-600",
  Critical: "bg-red-50 text-red-600",
};
function badgeClass(s: string): string {
  return HEALTH_STYLE[s] ?? "bg-secondary text-muted-foreground";
}

const CORE_METRICS: MetricKey[] = [
  "gmv",
  "orders",
  "conversion",
  "repurchaseRate",
  "roi",
];

export default function TrustPage() {
  const sources = listSources();
  const u = getUnderstanding();
  const sample = isSample();
  const avgCoverage = Math.round(
    sources.reduce((s, x) => s + x.coverage, 0) / (sources.length || 1),
  );
  const healthy = sources.filter((s) => s.health_status === "Healthy").length;
  const abnormal = sources.length - healthy;

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[1280px] px-6 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回首页
        </Link>

        <header className="mb-6">
          <h1 className="text-[24px] font-semibold">数据可信中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Data Trust Center · 数据源 / 时效 / 覆盖率 / 健康度 / 血缘 / 缺口
          </p>
        </header>

        {/* 汇总 */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={<Database className="h-4 w-4" />} label="数据源" value={`${sources.length}`} />
          <Tile icon={<Gauge className="h-4 w-4" />} label="平均覆盖率" value={`${avgCoverage}%`} />
          <Tile icon={<ShieldCheck className="h-4 w-4" />} label="健康源" value={`${healthy}`} />
          <Tile icon={<Activity className="h-4 w-4" />} label="异常/延迟源" value={`${abnormal}`} warn={abnormal > 0} />
        </div>

        {/* Data First · 数据理解概览 + 缺口（doc19 M4） */}
        <Section
          title="数据理解概览"
          subtitle="Data Understanding · 当前数据类型 / 场景 / Date Anchor / 缺口"
        >
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                Date Anchor（数据截止）：<b className="text-foreground">{u.latestDataDate || "未知"}</b>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                场景：<b className="text-foreground">{SCENARIO_LABELS[u.scenario.primary]}</b>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  sample ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {sample ? "内置样本" : "已上传数据"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {u.classification.perType.map((d) => (
                <span
                  key={d.type}
                  className="rounded-md border border-border bg-[#F8F9FA] px-2 py-0.5 text-xs text-foreground"
                >
                  ✓ {DATA_TYPE_LABELS[d.type]}（{d.matchedFields.length} 字段）
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 可分析（{u.gaps.canAnalyze.length}）
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.gaps.canAnalyze.map((m) => (
                    <span key={m} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-emerald-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-700">
                  <XCircle className="h-3.5 w-3.5" /> 暂不支持（{u.gaps.cannotAnalyze.length}）
                </div>
                {u.gaps.cannotAnalyze.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground">无缺口，数据齐全</span>
                ) : (
                  <ul className="space-y-1 text-[11px] text-rose-700">
                    {u.gaps.cannotAnalyze.slice(0, 6).map((g) => (
                      <li key={g.metric}>
                        <span className="font-medium">{g.metric}</span>：{g.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/upload"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Upload className="h-3 w-3" /> 上传数据补充
                </Link>
              </div>
            </div>
          </div>
        </Section>

        {/* 数据源状态 */}
        <Section title="数据源状态" subtitle="Source Registry · Freshness · Health · Coverage">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {sources.map((s) => (
              <SourceCard key={s.source_system} s={s} />
            ))}
          </div>
        </Section>

        {/* 数据血缘 + 指标定义 */}
        <Section
          title="数据血缘与指标定义"
          subtitle="Data Lineage · Definition · Formula · Source"
        >
          <div className="space-y-3">
            {CORE_METRICS.map((k) => {
              const m = METRIC_SPECS[k];
              return (
                <div key={k} className="rounded-xl border border-border bg-white p-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[15px] font-semibold">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.en}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      来源：{m.data_source}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {m.definition} · {m.business_meaning}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    公式：{m.formula} · 负责人：{m.owner} · 更新：{m.update_frequency} · 规则：{m.analysis_rules}
                  </p>
                  {m.lineage && (
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                      <GitBranch className="mr-1 h-3.5 w-3.5 text-blue-600" />
                      {m.lineage.map((node, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          <span className="rounded bg-secondary px-1.5 py-0.5">
                            {node}
                          </span>
                          {i < m.lineage!.length - 1 && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          基于 07_data_sources 注册表（Mock · 90 天口径） · 数据理解来自 Data Understanding Engine
        </p>
      </main>
    </div>
  );
}

/* ----------------------------- 子组件 ----------------------------- */

function Tile({
  icon,
  label,
  value,
  warn,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 text-[22px] font-semibold ${warn ? "text-amber-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function SourceCard({ s }: { s: SourceTrust }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[15px] font-semibold">{s.source_system}</div>
          <div className="text-xs text-muted-foreground">负责人 {s.owner}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(s.health_status)}`}>
          {s.health_status}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>覆盖率</span>
          <span>{s.coverage}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-secondary">
          <div
            className="h-1.5 rounded bg-[#1E3A8A]"
            style={{ width: `${s.coverage}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>更新：{s.update_time}</span>
        <span className={`rounded px-1.5 py-0.5 ${badgeClass(s.freshness)}`}>
          时效 {s.freshness}
        </span>
      </div>
    </div>
  );
}
