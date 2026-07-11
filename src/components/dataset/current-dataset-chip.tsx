"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Database } from "lucide-react";
import type { DatasetSummary } from "@/lib/data/dataset-store";

/**
 * Current Dataset Chip（Dataset Visibility §3）。
 * 轻量内联 pill，自取 /api/understanding.currentDataset；置入 Dashboard / Query Console /
 * Report 各分析面顶部，让用户在每一次分析时都看到「系统当前在分析哪份数据」。
 * 点击跳 /datasets（Dataset Manager，Task 12）。
 *
 * 比 CurrentDatasetCard(compact) 更轻：只显 Name + 截止 + 来源徽标，单行不换行。
 */
export default function CurrentDatasetChip() {
  const [d, setD] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/understanding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (alive) setD(data.currentDataset ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading || !d) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] text-muted-foreground">
        <Database className="h-3 w-3" />
        {loading ? "加载数据集…" : "暂无数据集"}
      </span>
    );
  }

  const isSample = d.sourceType === "sample";

  return (
    <Link
      href="/datasets"
      title={`数据集管理：${d.name}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <Database className="h-3 w-3 shrink-0 text-blue-600" />
      <span className="max-w-[180px] truncate font-medium text-foreground">
        {d.name}
      </span>
      <span className="text-muted-foreground/40">·</span>
      <CalendarClock className="h-3 w-3 shrink-0" />
      <span className="whitespace-nowrap">截止 {d.latestDataDate || "—"}</span>
      <span
        className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-medium ${
          isSample ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {isSample ? "样本" : "已上传"}
      </span>
    </Link>
  );
}
