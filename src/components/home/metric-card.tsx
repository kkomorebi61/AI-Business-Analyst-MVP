"use client";

import { ArrowDownRight, ArrowUpRight, ChevronRight, ShieldCheck, FileText } from "lucide-react";
import { Icon } from "@/components/icons";
import type { KpiPoint } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";

/** 健康度 → 颜色点 */
function healthDot(health: string): string {
  if (health === "Healthy") return "bg-emerald-500";
  if (health === "Warning") return "bg-amber-500";
  return "bg-red-500";
}

/** 可信度分 → 颜色 */
function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-blue-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

/**
 * 通用 L1 指标卡（首页 §1 经营总览 / §2 会员资产 / §3 私域经营 复用）。
 *
 * - 点击卡身 / 【依据】 → 指标口径抽屉（MetricDetailDrawer）
 *   展示：指标定义 / 计算公式 / 数据来源 / 更新时间（+ 血缘 / 可信度），
 *   让业务用户自助理解指标含义。
 * - 周期指标（snapshot=false）：展示环比 delta；存量指标（snapshot=true）：不展示 delta
 *   （快照值不随时间窗口变化，环比无意义）。
 * - 底部 Trust 行：Trust Score + 源 + 覆盖率 + 健康 + 更新（10 §12 UI 必展项）。
 */
export default function MetricCard({
  kpi,
  snapshot = false,
  onViewMetric,
}: {
  kpi: KpiPoint;
  /** 存量指标：隐藏环比 delta（快照值，与时间窗口无关） */
  snapshot?: boolean;
  onViewMetric: (key: MetricKey) => void;
}) {
  const up = kpi.direction === "up";
  const hasDelta = !snapshot && kpi.deltaPct !== 0;
  const trust = kpi.trust;

  return (
    <div className="group rounded-xl border border-border bg-white p-4 transition-colors hover:bg-[#F5F7FA]">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onViewMetric(kpi.key)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon name={kpi.icon} className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {kpi.name}
              <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="text-[18px] font-semibold leading-tight">{kpi.value}</div>
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {hasDelta && (
            <span
              className={`flex items-center gap-0.5 text-xs font-medium ${
                up ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {kpi.deltaPct >= 0 ? "+" : ""}
              {kpi.deltaPct.toFixed(1)}%
            </span>
          )}
          {/* 【依据】→ 指标口径说明（定义 / 公式 / 来源 / 更新时间） */}
          <button
            onClick={() => onViewMetric(kpi.key)}
            className="flex items-center gap-0.5 text-[11px] text-blue-600 hover:text-blue-700"
            title="查看指标口径：定义 / 公式 / 数据来源 / 更新时间"
          >
            <FileText className="h-3 w-3" />
            依据
          </button>
        </div>
      </div>

      {/* Data Trust 内联（Trust Score / 来源 / 覆盖率 / 健康 / 更新） */}
      {trust && (
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className={`inline-flex items-center gap-0.5 font-medium ${scoreColor(trust.trustScore)}`}>
            <ShieldCheck className="h-3 w-3" />
            {trust.trustScore}
          </span>
          <span>· {trust.sources.join(" + ") || "—"}</span>
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
  );
}
