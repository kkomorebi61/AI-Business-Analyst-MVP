"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CurrentDatasetCard from "./current-dataset-card";
import type { DatasetSummary } from "@/lib/data/dataset-store";

/**
 * 首页顶部「当前分析数据集」固定栏（Dataset Visibility §2）。
 * 自取 /api/understanding.currentDataset，挂载即拉；确保用户始终知道系统在分析哪份数据。
 * 右侧「管理 →」跳 /datasets（Dataset Manager）。
 */
export default function CurrentDatasetBar() {
  const [d, setD] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/understanding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setD(data.currentDataset ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[#F5F7FA] px-4 py-2.5">
      {loading ? (
        <span className="text-xs text-muted-foreground">加载当前数据集…</span>
      ) : d ? (
        <CurrentDatasetCard d={d} variant="compact" />
      ) : (
        <span className="text-xs text-muted-foreground">暂无数据集</span>
      )}
      <Link href="/datasets" className="shrink-0 text-xs font-medium text-blue-600 hover:underline">
        管理 →
      </Link>
    </div>
  );
}
