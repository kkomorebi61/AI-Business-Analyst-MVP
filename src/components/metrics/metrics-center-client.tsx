"use client";

import { useMemo, useState } from "react";
import { Calculator, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import MetricDetailDrawer from "./metric-detail-drawer";
import type { MetricDetailRow } from "@/app/metrics/page";
import { ROLE_LABELS, type MetricKey, type Role } from "@/lib/kb/metric-kb";
import type { ConfidenceLevel } from "@/lib/data/data-trust";

const CONF_VARIANT: Record<ConfidenceLevel, "success" | "info" | "warning" | "danger"> = {
  High: "success",
  Medium: "info",
  Low: "warning",
  Caution: "danger",
};

type RoleFilter = "ALL" | Role;
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "CEO", label: ROLE_LABELS.CEO },
  { value: "CRM_MANAGER", label: ROLE_LABELS.CRM_MANAGER },
  { value: "OPERATION_MANAGER", label: ROLE_LABELS.OPERATION_MANAGER },
];

/**
 * 指标定义中心 —— 客户端交互岛：搜索（Metric Search）+ 角色过滤 + 卡片网格 + 详情抽屉。
 * 数据由服务端页面预聚合传入（rows），客户端零额外请求。
 */
export default function MetricsCenterClient({
  rows,
}: {
  rows: MetricDetailRow[];
  sourceSystems: string[];
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [selected, setSelected] = useState<MetricKey | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== "ALL" && !r.role.includes(role)) return false;
      if (!q) return true;
      const hay = [
        r.name,
        r.en,
        r.metric_name,
        r.definition,
        r.business_meaning,
        ...r.aliases,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, role]);

  return (
    <>
      {/* 搜索 + 过滤 */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 GMV / ROI / LTV / 复购率 / 销售额…"
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1">
          {ROLE_FILTERS.map((rf) => (
            <button
              key={rf.value}
              onClick={() => setRole(rf.value)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                role === rf.value
                  ? "bg-[#1E3A8A] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {rf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        共 {filtered.length} 个指标{query && ` · 命中「${query}」`}
      </div>

      {/* 指标卡片网格 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center text-sm text-muted-foreground">
          未找到匹配的指标，试试 GMV / 复购率 / LTV 等关键词。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              className="group rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-blue-300 hover:ring-1 hover:ring-blue-200"
            >
              {/* 头部 */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold">{r.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{r.en}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.role.map((rl) => (
                      <span
                        key={rl}
                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {ROLE_LABELS[rl]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 text-[15px] font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                    {r.trust.trustScore}
                  </span>
                  <Badge variant={CONF_VARIANT[r.trust.confidence]} className="text-[10px]">
                    {r.trust.confidence}
                  </Badge>
                </div>
              </div>

              {/* 定义 */}
              <p className="mt-2.5 text-[13px] leading-relaxed text-foreground">
                {r.definition}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.business_meaning}</p>

              {/* 公式 */}
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[#F5F7FA] px-2.5 py-1.5">
                <Calculator className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                <code className="truncate font-mono text-[12px] text-blue-800">{r.formula}</code>
              </div>

              {/* 页脚 */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>来源：{r.data_source}</span>
                <span>· 负责人：{r.owner}</span>
                <span>· 更新：{r.update_frequency}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <MetricDetailDrawer
        open={selected !== null}
        metricKey={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
