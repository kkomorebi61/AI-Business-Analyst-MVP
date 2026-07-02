"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, ShieldCheck } from "lucide-react";
import { Icon } from "@/components/icons";
import MetricDetailDrawer from "@/components/metrics/metric-detail-drawer";
import type { KpiPoint } from "@/lib/agents/types";
import type { Range } from "@/lib/data/daily";
import type { MetricKey } from "@/lib/kb/metric-kb";

interface KpiPayload {
  kpis: KpiPoint[];
  rangeLabel: string;
}

/** 健康度 → 颜色点 */
function healthDot(health: string): string {
  if (health === "Healthy") return "bg-emerald-500";
  if (health === "Warning") return "bg-amber-500";
  return "bg-red-500";
}

/**
 * 首页右侧 KPI 仪表盘。
 *
 * 数据来自 GET /api/kpis?range=N（服务端聚合 90 天日数据，KPI 已附带 Data Trust），
 * 切换时间范围时重新拉取、KPI 实时变化。首次加载显示骨架；后续切换保留旧值直到新数据返回。
 *
 * V3：每个 KPI 内联展示 Data Trust（来源/覆盖率/健康/更新），
 * 点击任意 KPI 弹出 Metric Detail Drawer（指标定义 / 公式 / 口径）。
 */
export default function KpiSidebar({ range }: { range: Range }) {
  const [data, setData] = useState<KpiPayload | null>(null);
  const [selected, setSelected] = useState<MetricKey | null>(null);

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
    <>
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
            const trust = kpi.trust;
            return (
              <button
                key={kpi.key}
                onClick={() => setSelected(kpi.key)}
                className="group -mx-1 flex items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors first:pt-0 last:pb-0 hover:bg-[#F5F7FA]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon name={kpi.icon} className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {kpi.name}
                    <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="text-[17px] font-semibold leading-tight">{kpi.value}</div>

                  {/* Data Trust 内联（来源 / 覆盖率 / 健康 / 更新） */}
                  {trust && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <ShieldCheck className="h-3 w-3 text-blue-500" />
                        {trust.sources.join(" + ") || "—"}
                      </span>
                      <span>· 覆盖 {trust.coverage ?? "—"}%</span>
                      <span className="inline-flex items-center gap-0.5">
                        ·
                        <span className={`h-1.5 w-1.5 rounded-full ${healthDot(trust.health)}`} />
                        {trust.health}
                      </span>
                      <span>· 更新 {trust.lastUpdated?.slice(5) ?? "—"}</span>
                    </div>
                  )}
                </div>
                {hasDelta && (
                  <span
                    className={`flex shrink-0 items-center gap-0.5 text-xs font-medium ${
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
              </button>
            );
          })}
        </div>
      </aside>

      <MetricDetailDrawer
        open={selected !== null}
        metricKey={selected}
        onClose={() => setSelected(null)}
      />
    </>
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
