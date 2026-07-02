"use client";

import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GovernanceVerdict, ResponseStrategy } from "@/lib/agents/types";

interface BannerStyle {
  tint: string;
  badge: "success" | "warning" | "danger";
  label: string;
}

function styleOf(strategy: ResponseStrategy, anomaly: boolean): BannerStyle {
  if (anomaly || strategy === "suspend") {
    return { tint: "bg-red-50 border-red-300 border-dashed", badge: "danger", label: "数据异常 · 已暂停" };
  }
  if (strategy === "refuse") return { tint: "bg-red-50 border-red-200", badge: "danger", label: "暂不支持" };
  if (strategy === "partial") return { tint: "bg-amber-50 border-amber-200", badge: "warning", label: "部分回答" };
  return { tint: "bg-emerald-50 border-emerald-200", badge: "success", label: "直答" };
}

/** 顶部查询分级横幅：直答 / 部分回答 / 暂不支持 / 数据异常（doc 11） */
export default function QueryBanner({ verdict }: { verdict: GovernanceVerdict }) {
  const st = styleOf(verdict.responseStrategy, verdict.anomaly.detected);
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${st.tint}`}>
      <div className="mt-0.5 shrink-0">
        {st.badge === "danger" ? (
          <TriangleAlert className="h-4 w-4 text-red-600" />
        ) : (
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              st.badge === "success" ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={st.badge}>{st.label}</Badge>
          <span className="text-[13px] font-medium text-foreground">{verdict.banner.title}</span>
          {verdict.coverage !== null && (
            <span className="text-[11px] text-muted-foreground">覆盖率 {verdict.coverage}%</span>
          )}
          {verdict.attributedEvents.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              · 命中事件 {verdict.attributedEvents.map((e) => e.event_name).join("、")}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{verdict.banner.description}</p>
      </div>
    </div>
  );
}
