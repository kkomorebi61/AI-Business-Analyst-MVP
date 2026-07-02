"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Icon } from "@/components/icons";
import type { KpiPoint } from "@/lib/agents/types";
import type { Range } from "@/lib/data/daily";

interface KpiPayload {
  kpis: KpiPoint[];
  rangeLabel: string;
}

/**
 * 首页右侧 KPI 仪表盘。
 *
 * 数据来自 GET /api/kpis?range=N（服务端聚合 90 天日数据），
 * 切换时间范围时重新拉取、KPI 实时变化。
 * 首次加载显示骨架；后续切换保留旧值直到新数据返回，避免骨架闪烁。
 */
export default function KpiSidebar({ range }: { range: Range }) {
  const [data, setData] = useState<KpiPayload | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/kpis?range=${range}`)
      .then((r) => r.json())
      .then((payload: KpiPayload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        /* 保留上次数据；mock 本地接口不应失败 */
      });
    return () => {
      active = false;
    };
  }, [range]);

  if (!data) return <KpiSkeleton />;

  return (
    <aside className="h-fit rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">KPI 仪表盘</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {data.rangeLabel}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {data.kpis.map((kpi) => {
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

/** KPI 仪表盘加载骨架（首次拉取时） */
function KpiSkeleton() {
  return (
    <aside className="h-fit rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-secondary" />
      </div>
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="h-9 w-9 animate-pulse rounded-lg bg-secondary" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-10 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
            </div>
            <div className="h-3 w-10 animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
    </aside>
  );
}
