"use client";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import type { Evidence, EvidenceItem } from "@/lib/agents/types";

/** 数值格式化：¥ 紧凑货币 / % 保留一位 / 其它千分位 */
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

/** 变化量格式化（中性展示，不附加涨跌色彩以免对退款率等反向指标误读） */
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

/** 卡片内紧凑 Evidence：before→after + 数据源/覆盖率/健康度 */
export default function EvidenceInline({ evidence }: { evidence?: Evidence }) {
  if (!evidence) return null;
  const items = evidence.items.filter((it) => it.after !== null);
  if (!items.length) return null;

  return (
    <div className="mt-3 rounded-lg bg-[#F5F7FA] p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{it.metric}</span>
            <span className="text-muted-foreground line-through decoration-muted-foreground/40">
              {it.before !== null ? fmtNum(it.before, it.unit) : "—"}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold text-foreground">{fmtNum(it.after!, it.unit)}</span>
            {it.change !== null && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0">
                {fmtChange(it.change, it.changeKind)}
              </Badge>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Icon name="database" className="h-3 w-3" />
          {evidence.dataSources.join(" · ") || "—"}
        </span>
        <span>覆盖率 {evidence.coverage !== null ? `${evidence.coverage}%` : "—"}</span>
        <Badge variant={healthVariant(evidence.healthStatus)} className="px-1.5 py-0">
          {evidence.healthStatus}
        </Badge>
      </div>
    </div>
  );
}
