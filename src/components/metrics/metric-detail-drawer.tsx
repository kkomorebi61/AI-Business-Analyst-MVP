"use client";

import { useEffect } from "react";
import { Check, Clock, GitBranch, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { METRIC_SPECS, type MetricKey } from "@/lib/kb/metric-kb";
import {
  metricTrustInfo,
  type ConfidenceLevel,
} from "@/lib/data/data-trust";

/**
 * 指标详情抽屉（Metric Detail Drawer，来源：02A Business Metric Dictionary）
 *
 * 点击任意 KPI / Insight「该指标如何计算」入口弹出。展示企业级可解释性元数据：
 *   Definition / Formula / Data Source / Included Scope / Excluded Scope / Update Frequency
 *   + 业务意义 / 负责人 / 统计周期 / 数据血缘 / 关联指标 / 可信度（10 Data Trust）
 *
 * 设计：企业 BI 风格，无复杂动画（与 EvidenceDrawer 一致：遮罩 + 右侧固定面板）。
 * 自包含：仅依赖指标元数据（小体量），不触发额外请求，随处可复用。
 */
const CONFIDENCE_VARIANT: Record<ConfidenceLevel, "success" | "info" | "warning" | "danger"> = {
  High: "success",
  Medium: "info",
  Low: "warning",
  Caution: "danger",
};

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  High: "高可信",
  Medium: "中可信",
  Low: "低可信",
  Caution: "谨慎使用",
};

export default function MetricDetailDrawer({
  open,
  metricKey,
  onClose,
}: {
  open: boolean;
  metricKey: MetricKey | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !metricKey) return null;
  const m = METRIC_SPECS[metricKey];
  const trust = metricTrustInfo(metricKey);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        {/* 头部 */}
        <header className="border-b border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">指标定义 · How it&apos;s calculated</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <h2 className="truncate text-[17px] font-semibold">{m.name}</h2>
                <span className="text-xs text-muted-foreground">{m.en}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                metric_name: <code className="rounded bg-secondary px-1 py-0.5">{m.metric_name}</code>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 可信度总览（doc 10） */}
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-[#F5F7FA] p-3">
            <div className="text-center">
              <div className="text-[22px] font-semibold leading-none">{trust.trustScore}</div>
              <div className="text-[10px] text-muted-foreground">Trust Score</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-1 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <Badge variant={CONFIDENCE_VARIANT[trust.confidence]}>
                {CONFIDENCE_LABEL[trust.confidence]}
              </Badge>
              <span>· 覆盖 {trust.coverage ?? "—"}% · 时效 {trust.freshness}</span>
            </div>
          </div>
        </header>

        {/* 内容 */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <Section title="定义 · Definition">
            <p className="text-[13px] leading-relaxed text-foreground">{m.definition}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              业务意义：{m.business_meaning}
            </p>
          </Section>

          <Section title="公式 · Formula">
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 font-mono text-[13px] text-blue-800">
              {m.formula}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">示例：{m.example}</p>
          </Section>

          <Section title="数据来源 · Data Source">
            <div className="flex flex-wrap gap-1.5">
              {m.source_keys.map((s) => (
                <Badge key={s} variant="info">{s}</Badge>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <Cell label="覆盖率" value={trust.coverage !== null ? `${trust.coverage}%` : "—"} />
              <Cell label="健康度" value={trust.health} />
              <Cell label="更新频率" value={m.update_frequency} />
              <Cell label="最近更新" value={trust.lastUpdated ?? "—"} />
            </div>
          </Section>

          <Section title="统计口径 · Scope">
            <div className="space-y-2">
              <ScopeList
                title="包含范围"
                tone="ok"
                items={m.included_scope}
              />
              <ScopeList
                title="排除范围"
                tone="no"
                items={m.excluded_scope}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Clock className="mr-0.5 h-3.5 w-3.5" />
              统计周期：
              {m.time_window.map((w) => (
                <span key={w} className="rounded bg-secondary px-1.5 py-0.5">{w}</span>
              ))}
            </div>
          </Section>

          <Section title="负责人 · Owner">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium">{m.owner}</span>
              <span className="text-xs text-muted-foreground">分析规则：{m.analysis_rules}</span>
            </div>
          </Section>

          <Section title="关联指标 · Related">
            <div className="flex flex-wrap gap-1.5">
              {m.related_metrics.map((rk) => (
                <Badge key={rk} variant="secondary">{METRIC_SPECS[rk].name}</Badge>
              ))}
            </div>
          </Section>

          {m.lineage && m.lineage.length > 0 && (
            <Section title="数据血缘 · Lineage">
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <GitBranch className="mr-1 h-3.5 w-3.5 text-blue-600" />
                {m.lineage.map((node, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className="rounded bg-secondary px-1.5 py-0.5">{node}</span>
                    {i < m.lineage!.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                可追溯链路：AI 结论 → Evidence → 指标 → 数据源 → 原始数据
              </p>
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-[13px] font-semibold">{value}</div>
    </div>
  );
}

function ScopeList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "ok" | "no";
  items: string[];
}) {
  return (
    <div>
      <div className={`text-[11px] font-medium ${tone === "ok" ? "text-emerald-700" : "text-red-600"}`}>
        {title}
      </div>
      <ul className="mt-1 space-y-0.5">
        {items.length > 0 ? (
          items.map((it) => (
            <li key={it} className="flex items-start gap-1.5 text-xs text-foreground">
              {tone === "ok" ? (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
              ) : (
                <X className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
              )}
              <span>{it}</span>
            </li>
          ))
        ) : (
          <li className="text-xs text-muted-foreground">—</li>
        )}
      </ul>
    </div>
  );
}
