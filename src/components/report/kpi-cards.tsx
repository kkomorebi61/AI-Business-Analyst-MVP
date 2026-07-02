import { ArrowDownRight, ArrowUpRight, ChevronRight, ShieldCheck } from "lucide-react";
import { Icon } from "@/components/icons";
import type { KpiPoint } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";

function healthDot(health: string): string {
  if (health === "Healthy") return "bg-emerald-500";
  if (health === "Warning") return "bg-amber-500";
  return "bg-red-500";
}

/**
 * 第01节 KPI 驾驶舱：2×2 核心指标卡。
 *
 * V3：每张卡可点击 → 弹出 Metric Detail Drawer；内联展示 Data Trust
 * （来源 / 覆盖率 / 健康 / 最近更新）。企业 BI 风格，无复杂动画。
 */
export default function KpiCards({
  kpis,
  onViewMetric,
}: {
  kpis: KpiPoint[];
  onViewMetric?: (key: MetricKey) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {kpis.map((kpi) => {
        const up = kpi.direction === "up";
        const hasDelta = kpi.deltaPct !== 0;
        const trust = kpi.trust;
        const clickable = Boolean(onViewMetric);
        return (
          <div
            key={kpi.key}
            onClick={clickable ? () => onViewMetric?.(kpi.key) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onViewMetric?.(kpi.key);
                    }
                  }
                : undefined
            }
            className={`group rounded-xl border border-border bg-white p-4 transition-colors ${
              clickable ? "cursor-pointer hover:border-blue-300 hover:ring-1 hover:ring-blue-200" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon name={kpi.icon} className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-sm font-semibold leading-tight">
                    {kpi.name}
                    {clickable && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{kpi.en}</div>
                </div>
              </div>
              {hasDelta && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-semibold ${
                    up ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {up ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {kpi.deltaPct >= 0 ? "+" : ""}
                  {kpi.deltaPct.toFixed(1)}%
                </span>
              )}
            </div>

            <div className="mt-3 text-[22px] font-semibold leading-tight">{kpi.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {kpi.prevLabel} {kpi.prevValue}
            </div>

            {/* Data Trust 内联（来源 / 覆盖率 / 健康 / 最近更新） */}
            {trust && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-2.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground/70">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                  {trust.sources.join(" + ") || "—"}
                </span>
                <span>· 覆盖 {trust.coverage ?? "—"}%</span>
                <span className="inline-flex items-center gap-0.5">
                  ·
                  <span className={`h-1.5 w-1.5 rounded-full ${healthDot(trust.health)}`} />
                  {trust.health}
                </span>
                <span className="ml-auto">更新 {trust.lastUpdated?.slice(5) ?? "—"}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
