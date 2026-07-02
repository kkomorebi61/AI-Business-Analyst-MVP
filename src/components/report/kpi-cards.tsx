import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Icon } from "@/components/icons";
import type { KpiPoint } from "@/lib/agents/types";

/** 第01节 KPI 驾驶舱：2×2 核心指标卡 */
export default function KpiCards({ kpis }: { kpis: KpiPoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {kpis.map((kpi) => {
        const up = kpi.direction === "up";
        const hasDelta = kpi.deltaPct !== 0;
        return (
          <div
            key={kpi.key}
            className="rounded-xl border border-border bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon name={kpi.icon} className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">
                    {kpi.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {kpi.en}
                  </div>
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

            <div className="mt-3 text-[22px] font-semibold leading-tight">
              {kpi.value}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {kpi.prevLabel} {kpi.prevValue}
            </div>
          </div>
        );
      })}
    </div>
  );
}
