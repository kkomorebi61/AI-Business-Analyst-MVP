"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Database,
  Info,
  Loader2,
  RefreshCw,
  ToggleRight,
  Trash2,
  Upload,
} from "lucide-react";
import TopNav from "@/components/top-nav";
import { DATA_TYPE_LABELS } from "@/lib/data-understanding/recommend";
import type { DatasetSummary } from "@/lib/data/dataset-store";

/**
 * 数据集管理（Dataset Manager，路由：/datasets）—— Dataset Visibility §4。
 *
 * 列出所有数据集（含内置样本），支持：
 *   - 切换当前激活数据集（→ 同步 csv-engine Active Facts + 清查询缓存，见 /api/datasets）
 *   - 删除已上传数据集（sample 与当前 active 不可删，API 兜底）
 * 所有指标从「当前激活」数据集计算 —— 切换即改变全局分析口径。
 *
 * 客户端页：状态/交互需 hooks；数据经 /api/datasets（force-dynamic）取进程内 globalStore。
 */

function typeLabel(t: string): string {
  return DATA_TYPE_LABELS[t as keyof typeof DATA_TYPE_LABELS] ?? t;
}

function fmtUploadTime(at: string | null): string {
  if (!at) return "内置（演示数据）";
  try {
    return new Date(at).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return at;
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function DatasetRow({
  d,
  isActive,
  busy,
  onSwitch,
  onDelete,
}: {
  d: DatasetSummary;
  isActive: boolean;
  busy: boolean;
  onSwitch: (id: string) => void;
  onDelete: (d: DatasetSummary) => void;
}) {
  const isSample = d.sourceType === "sample";
  const canDelete = !isSample && !isActive;
  const types = d.datasetTypes.map(typeLabel).join(" / ") || "—";
  const range = `${d.dateRange.minDate || "—"} ~ ${d.dateRange.maxDate || "—"}`;

  return (
    <div
      className={`rounded-xl border bg-white p-5 transition-shadow ${
        isActive ? "border-blue-300 shadow-sm ring-2 ring-blue-100" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-foreground">{d.name}</h3>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                当前激活
              </span>
            ) : isSample ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                <Archive className="h-3 w-3" />
                内置样本
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Archive className="h-3 w-3" />
                已归档
              </span>
            )}
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {d.fileNames.length
              ? d.fileNames.join("、")
              : "内置演示数据（渠道 / 会员 / 企微 三张日聚合表）"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isActive ? (
            <span className="text-xs font-medium text-emerald-600">分析中</span>
          ) : (
            <button
              onClick={() => onSwitch(d.datasetId)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ToggleRight className="h-3.5 w-3.5" />
              )}
              设为活跃
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(d)}
              disabled={busy}
              title="删除数据集"
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3">
        <Field label="数据类型" value={types} />
        <Field label="数据范围" value={`${range}（${d.dateRange.dayCount} 天）`} />
        <Field label="截止日期" value={d.latestDataDate || "—"} />
        <Field label="记录数" value={`${d.recordCount.toLocaleString("zh-CN")} 条`} />
        <Field label="上传时间" value={fmtUploadTime(d.uploadTime)} />
        <Field label="数据集 ID" value={d.datasetId} />
      </dl>
    </div>
  );
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [current, setCurrent] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/datasets", { cache: "no-store" });
      if (!r.ok) throw new Error(`加载失败（${r.status}）`);
      const data = (await r.json()) as { datasets: DatasetSummary[]; current: DatasetSummary };
      setDatasets(data.datasets ?? []);
      setCurrent(data.current ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (data: { datasets?: DatasetSummary[]; current?: DatasetSummary }) => {
    setDatasets(data.datasets ?? []);
    setCurrent(data.current ?? null);
  };

  const switchTo = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const r = await fetch("/api/datasets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "switch", id }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? data.reason ?? "切换失败");
        apply(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "切换失败");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const remove = useCallback(
    async (d: DatasetSummary) => {
      if (!window.confirm(`确认删除数据集「${d.name}」？此操作不可撤销。`)) return;
      setBusyId(d.datasetId);
      setError(null);
      try {
        const r = await fetch("/api/datasets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id: d.datasetId }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.reason ?? data.error ?? "删除失败");
        apply(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "删除失败");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <TopNav />
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        {/* 标题 + 操作 */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回首页
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-[22px] font-semibold">
              <Database className="h-5 w-5 text-blue-600" />
              数据集管理
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              查看全部数据集、切换当前分析数据集或删除已上传数据集。所有指标均从「当前激活」数据集计算。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              刷新
            </button>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1e40af]"
            >
              <Upload className="h-3.5 w-3.5" />
              上传新数据集
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-white p-5">
                <div className="h-5 w-48 animate-pulse rounded bg-secondary" />
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j}>
                      <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
                      <div className="mt-2 h-4 w-24 animate-pulse rounded bg-secondary" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-muted-foreground">加载数据集列表…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {datasets.map((d) => (
              <DatasetRow
                key={d.datasetId}
                d={d}
                isActive={!!current && current.datasetId === d.datasetId}
                busy={busyId === d.datasetId}
                onSwitch={(id) => void switchTo(id)}
                onDelete={(dd) => void remove(dd)}
              />
            ))}
          </div>
        )}

        <p className="mt-6 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          数据集存储于服务端内存（对齐 MVP 无落盘）；重启服务后已上传数据集会清空，内置样本不受影响。
          切换数据集会清空查询缓存，后续问答将基于新数据集重新计算。
        </p>
      </main>
    </div>
  );
}
