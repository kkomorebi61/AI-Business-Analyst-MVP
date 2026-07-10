"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Cpu, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  Classification,
  CostTier,
  QueryType,
  RoutingTrace,
} from "@/lib/routing/types";
import { QUERY_TYPE_LABEL } from "@/lib/routing/types";

/** 查询类型 → 徽章变体 + 图标 key */
const TYPE_STYLE: Record<QueryType, { badge: "info" | "success" | "warning" | "danger" | "secondary"; icon: string }> = {
  metric: { badge: "info", icon: "🟦" },
  calculation: { badge: "info", icon: "🧮" },
  insight: { badge: "warning", icon: "🔍" },
  strategy: { badge: "success", icon: "🎯" },
  execution: { badge: "secondary", icon: "⚙️" },
  requirement: { badge: "danger", icon: "📝" },
  comparison: { badge: "info", icon: "⚖️" },
  trend: { badge: "info", icon: "📈" },
};

const COST_STYLE: Record<CostTier, "success" | "info" | "warning" | "danger"> = {
  free: "success",
  low: "info",
  medium: "warning",
  high: "warning",
  very_high: "danger",
};

/**
 * 路由横幅 —— 让「问题分类 → 自动路由」对用户可见、可解释（设计文档 §7.1）。
 *
 * 展示：查询类型 / 引擎链 / 成本档 / 置信度与来源 / 决策链（可展开）/ LLM 模型。
 */
export default function RoutingBanner({
  classification,
  routing,
  estimate,
}: {
  classification: Classification;
  routing: RoutingTrace;
  estimate: string;
}) {
  const [open, setOpen] = useState(false);
  const ts = TYPE_STYLE[classification.queryType];

  return (
    <div className="rounded-xl border border-border bg-[#F8F9FA] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Route className="h-4 w-4 text-blue-600" />
        <span className="text-[13px] font-medium text-foreground">路由判定</span>
        <Badge variant={ts.badge}>
          {ts.icon} {QUERY_TYPE_LABEL[classification.queryType]}
        </Badge>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Cpu className="h-3.5 w-3.5" />
          将走：{routing.engines.join(" → ")}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          成本档：<Badge variant={COST_STYLE[routing.costTier]}>{estimate}</Badge>
        </span>
        <span>
          判定来源：
          <span className={classification.by === "llm" ? "text-amber-600" : "text-emerald-600"}>
            {classification.by === "llm" ? "GLM 辅助" : "规则"}
          </span>
          （置信度 {(classification.confidence * 100).toFixed(0)}%）
        </span>
        {routing.llmUsed && routing.llmModel && (
          <span>LLM：{routing.llmModel}</span>
        )}
        {!routing.llmUsed && (
          <span className="text-emerald-600">未调用 LLM（Rule First）</span>
        )}
        {routing.cacheHit && (
          <span className="text-emerald-600">⚡ 缓存命中（未调用引擎）</span>
        )}
        {routing.llmUsed &&
          routing.tokensIn !== undefined &&
          routing.tokensOut !== undefined && (
            <span>
              Token：{routing.tokensIn} in / {routing.tokensOut} out
            </span>
          )}
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        查看决策链（为何这么走）
      </button>

      {open && (
        <ol className="mt-2 space-y-1 rounded-lg bg-white p-3 text-[11px] leading-relaxed text-muted-foreground">
          {routing.ruleOrder.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-blue-500">›</span>
              <span>{step}</span>
            </li>
          ))}
          <li className="mt-1 flex gap-2 border-t border-border pt-1.5 text-foreground">
            <span className="text-muted-foreground">理由：</span>
            <span>{classification.reason}</span>
          </li>
        </ol>
      )}
    </div>
  );
}
