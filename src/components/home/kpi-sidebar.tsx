"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Icon } from "@/components/icons";
import { dataAgent } from "@/lib/agents/data-agent";
import type { Range } from "@/lib/data/daily";

/**
 * 首页右侧 KPI 仪表盘。
 * 客户端按当前 range 直接聚合日数据，切换时间范围时 KPI 实时变化。
 */
export default function KpiSidebar({ range }: { range: Range }) {
  const { kpis, rangeLabel } = dataAgent(
    ["gmv", "orders", "aov", "conversion"],
    range,
  );

  return (
    <aside className="h-fit rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">KPI 仪表盘</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {rangeLabel}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {kpis.map((kpi) => {
          const up = kpi.direction === "up";
          const hasDelta = kpi.deltaPct !== 0;
          return (
            <div
              key={kpi.key}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon name={kpi.icon} className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">{kpi.name}</div>
                <div className="text-[17px] font-semibold leading-tight">
                  {kpi.value}
                </div>
              </div>
              {hasDelta && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
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
          );
        })}
      </div>
    </aside>
  );
}
