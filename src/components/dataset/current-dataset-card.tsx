import type { ReactNode } from "react";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  FileStack,
  Layers,
} from "lucide-react";
import type { DatasetSummary } from "@/lib/data/dataset-store";
import { DATA_TYPE_LABELS } from "@/lib/data-understanding/recommend";

/**
 * Current Dataset Card（Dataset Visibility §1）。
 * 纯展示组件，由父层喂入 DatasetSummary（来自 /api/understanding.currentDataset 或 /api/datasets）。
 *   - variant="full"    : 7 字段卡片（upload / datasets / trust 页用）
 *   - variant="compact" : 单行状态条（首页顶部 / 各分析面 chip 用）
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

function StatusBadge({ d }: { d: DatasetSummary }) {
  if (d.status !== "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <Archive className="h-3 w-3" />
        已归档
      </span>
    );
  }
  if (d.sourceType === "sample") {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        内置样本
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      当前激活
    </span>
  );
}

function Field({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 break-all text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function CurrentDatasetCard({
  d,
  variant = "full",
}: {
  d: DatasetSummary;
  variant?: "full" | "compact";
}) {
  const types = d.datasetTypes.map(typeLabel).join(" / ") || "—";
  const range = `${d.dateRange.minDate || "—"} ~ ${d.dateRange.maxDate || "—"}（${d.dateRange.dayCount} 天）`;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <Database className="h-3.5 w-3.5" />
          当前分析数据集
        </span>
        <span className="inline-flex items-center gap-1">
          <FileStack className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{d.name}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {types}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          截止 {d.latestDataDate || "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          <FileStack className="h-3.5 w-3.5" />
          {d.recordCount.toLocaleString("zh-CN")} 条
        </span>
        <StatusBadge d={d} />
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Database className="h-4 w-4 text-muted-foreground" />
          当前分析数据集
        </h3>
        <StatusBadge d={d} />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Field icon={<FileStack className="h-3.5 w-3.5" />} label="Dataset Name" value={d.name} />
        <Field icon={<Layers className="h-3.5 w-3.5" />} label="Dataset Type" value={types} />
        <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Upload Time" value={fmtUploadTime(d.uploadTime)} />
        <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label="Date Range" value={range} />
        <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label="Latest Data Date" value={d.latestDataDate || "—"} />
        <Field icon={<FileStack className="h-3.5 w-3.5" />} label="Record Count" value={`${d.recordCount.toLocaleString("zh-CN")} 条`} />
      </dl>
    </section>
  );
}
