"use client";

import { ArrowRight, Database, Calendar, Clock } from "lucide-react";
import SectionHeading from "@/components/report/section-heading";
import MetricCard from "@/components/home/metric-card";
import type { KpiPoint } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";

/**
 * 通用业务主题节（首页 §1 经营总览 / §2 会员资产 / §3 私域经营 复用）。
 *
 * 周期/存量区分（kind）：
 *   - period（默认）  ：受时间筛选影响，随 range 窗口变化 → 展示「受时间筛选 · {rangeLabel}」+ 环比
 *   - snapshot        ：不受时间筛选影响，期末快照      → 展示「截至 {asOf} · 不受时间筛选」，不展示环比
 * 把周期指标与存量指标物理分节，避免时间维度导致的数据认知错误。
 */
export default function MetricSection({
  index,
  title,
  subtitle,
  source,
  kpis,
  drillTo,
  highlight,
  kind = "period",
  asOf,
  rangeLabel,
  onViewMetric,
}: {
  index: string;
  title: string;
  subtitle?: string;
  source: string;
  kpis: KpiPoint[];
  drillTo?: string;
  highlight?: boolean;
  kind?: "period" | "snapshot";
  asOf?: string;
  rangeLabel?: string;
  onViewMetric: (key: MetricKey) => void;
}) {
  if (!kpis.length) return null;
  const isSnapshot = kind === "snapshot";

  return (
    <section className={highlight ? "rounded-xl ring-2 ring-blue-200 ring-offset-4" : undefined}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <SectionHeading index={index} title={title} subtitle={subtitle} />
        <div className="flex flex-col items-end gap-1 pb-1">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Database className="h-3 w-3" />
            来源：{source}
          </span>
          {isSnapshot ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              <Calendar className="h-3 w-3" />
              截至 {asOf ?? "—"} · 不受时间筛选
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              <Clock className="h-3 w-3" />
              受时间筛选 · {rangeLabel ?? "近 7 天"}
            </span>
          )}
          {drillTo && (
            <a
              href={drillTo}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              查看全部 <ArrowRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <MetricCard key={kpi.key} kpi={kpi} snapshot={isSnapshot} onViewMetric={onViewMetric} />
        ))}
      </div>
    </section>
  );
}
