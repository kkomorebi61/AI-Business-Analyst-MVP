"use client";

import { AlertTriangle } from "lucide-react";
import type { CostTier } from "@/lib/routing/types";

/**
 * 高成本任务确认弹窗（doc 15 Principle 10）
 * 触发：QueryType ∈ {strategy, requirement}（CostTier high / very_high）。
 * 文案：「预计消耗：XX Tokens / 确认执行？」（Token 数为 tier 估算）。
 */
export default function ConfirmDialog({
  open,
  tier,
  estimateLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  tier: CostTier | null;
  estimateLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || !tier) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-[15px] font-semibold">高成本任务确认</h3>
        </div>
        <p className="mt-3 text-sm text-foreground">
          预计消耗：<span className="font-semibold">{estimateLabel}</span> Tokens
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          该任务将调用大模型（doc 15 Principle 10）。确认执行？
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="h-9 rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="h-9 rounded-md bg-[#1E3A8A] px-4 text-sm font-medium text-white hover:bg-[#1e40af]"
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}
