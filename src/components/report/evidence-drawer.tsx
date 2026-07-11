"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DATA_TYPE_LABELS } from "@/lib/data-understanding/recommend";
import type { EvidenceItem, Finding, Risk } from "@/lib/agents/types";

function typeLabel(t: string): string {
  return DATA_TYPE_LABELS[t as keyof typeof DATA_TYPE_LABELS] ?? t;
}

function fmtNum(v: number, unit: string): string {
  if (unit === "¥") {
    if (Math.abs(v) >= 1e8) return `¥${(v / 1e8).toFixed(2)}亿`;
    if (Math.abs(v) >= 1e4) return `¥${Math.round(v / 1e4)}万`;
    return `¥${Math.round(v)}`;
  }
  if (unit === "%") return `${v.toFixed(1)}%`;
  if (Number.isInteger(v)) return v.toLocaleString("zh-CN");
  return v.toFixed(2);
}

function fmtChange(change: number | null, kind: EvidenceItem["changeKind"]): string {
  if (change === null) return "—";
  const sign = change > 0 ? "+" : "";
  if (kind === "pct") return `${sign}${change.toFixed(1)}%`;
  if (kind === "pp") return `${sign}${change.toFixed(1)}pp`;
  return `${sign}${change.toFixed(2)}`;
}

function healthVariant(h: string): "success" | "warning" | "danger" {
  if (h === "Healthy") return "success";
  if (h === "Warning") return "warning";
  return "danger";
}

type Target = Finding | Risk;

/** 「查看依据」抽屉：根因 / Evidence(before→after) / 数据源 / 可信度 / 数据血缘 */
export default function EvidenceDrawer({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: Target | null;
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

  if (!open || !target) return null;
  const ev = target.evidence;
  const lineage = target.lineage ?? [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">查看依据 · Evidence & Lineage</div>
            <h2 className="truncate text-[15px] font-semibold">{target.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* 根因 · 业务事件 */}
          {target.rootCause && (
            <Section title="根因 · 业务事件">
              <div className="rounded-lg bg-amber-50 p-3 text-xs">
                <div className="font-medium text-amber-700">
                  {target.rootCause.event.event_name} · {target.rootCause.event.event_date}
                </div>
                <p className="mt-1 leading-relaxed text-amber-700/80">
                  {target.rootCause.event.description}
                </p>
                <div className="mt-1.5 text-[11px] text-amber-700/60">
                  {target.rootCause.event.event_type} · {target.rootCause.event.direction}
                </div>
              </div>
            </Section>
          )}

          {/* Evidence before→after */}
          {ev && ev.items.length > 0 && (
            <Section title="数据依据 · Evidence">
              <div className="space-y-2">
                {ev.items.map((it, i) => (
                  <div key={i} className="rounded-lg border border-border p-2.5 text-xs">
                    <div className="text-muted-foreground">{it.metric}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-muted-foreground line-through decoration-muted-foreground/40">
                        {it.before !== null ? fmtNum(it.before, it.unit) : "—"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-[13px] font-semibold text-foreground">
                        {it.after !== null ? fmtNum(it.after, it.unit) : "—"}
                      </span>
                      {it.change !== null && (
                        <Badge variant="secondary" className="ml-auto">{fmtChange(it.change, it.changeKind)}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 数据源 */}
          {ev && ev.dataSources.length > 0 && (
            <Section title="数据源">
              <div className="flex flex-wrap gap-1.5">
                {ev.dataSources.map((s) => (
                  <Badge key={s} variant="info">{s}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* 当前数据集 · Dataset Visibility：该结论计算所用的数据集 */}
          {ev?.dataset && (
            <Section title="当前数据集 · Current Dataset">
              <div className="rounded-lg border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-foreground">{ev.dataset.name}</span>
                  <Badge variant={ev.dataset.sourceType === "sample" ? "info" : "success"}>
                    {ev.dataset.sourceType === "sample" ? "内置样本" : "已上传"}
                  </Badge>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <dt className="text-muted-foreground">数据类型</dt>
                    <dd className="font-medium text-foreground">
                      {ev.dataset.datasetTypes.map(typeLabel).join(" / ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">截止日期</dt>
                    <dd className="font-medium text-foreground">{ev.dataset.latestDataDate || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">数据范围</dt>
                    <dd className="font-medium text-foreground">
                      {ev.dataset.dateRange.minDate || "—"} ~ {ev.dataset.dateRange.maxDate || "—"}
                      （{ev.dataset.dateRange.dayCount} 天）
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">记录数</dt>
                    <dd className="font-medium text-foreground">
                      {ev.dataset.recordCount.toLocaleString("zh-CN")} 条
                    </dd>
                  </div>
                </dl>
                {ev.dataset.fileNames.length > 0 && (
                  <div className="mt-2 border-t border-border pt-2">
                    <dt className="text-muted-foreground">来源文件</dt>
                    <dd className="mt-0.5 break-all font-medium text-foreground">
                      {ev.dataset.fileNames.join("、")}
                    </dd>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 可信度：覆盖率 / 健康 / 更新 */}
          {ev && (
            <Section title="可信度">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Cell label="覆盖率" value={ev.coverage !== null ? `${ev.coverage}%` : "—"} />
                <Cell label="健康度" value={ev.healthStatus} highlight={healthVariant(ev.healthStatus)} />
                <Cell label="更新时间" value={ev.lastUpdated ?? "—"} />
              </div>
            </Section>
          )}

          {/* 数据血缘 */}
          {lineage.length > 0 && (
            <Section title="数据血缘 · Lineage">
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {lineage.map((node, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className="rounded bg-secondary px-1.5 py-0.5">{node}</span>
                    {i < lineage.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                可追溯链路：AI 结论 → Evidence → 数据源 → 血缘 → 原始数据
              </p>
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Cell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {highlight ? (
        <Badge variant={highlight} className="mt-1">{value}</Badge>
      ) : (
        <div className="mt-1 text-[13px] font-semibold">{value}</div>
      )}
    </div>
  );
}
