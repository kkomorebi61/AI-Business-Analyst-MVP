"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Share2, FileDown } from "lucide-react";

/**
 * 报告页顶部操作栏（对齐 PDF 顶栏：返回 / 标题 / 重新生成·分享·导出 PDF）。
 * 重新生成 = 重新跑一次工作流；分享 / 导出 PDF 为 Sprint 5 能力，此处仅占位。
 */
export default function ReportHeader({
  title,
  onRegenerate,
  regenerating,
}: {
  title: string;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[920px] items-center justify-between px-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold">
          {title}
        </h1>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">重新生成</span>
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-secondary">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">分享</span>
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-secondary">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">导出 PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}
