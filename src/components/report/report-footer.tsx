"use client";

import { useState } from "react";
import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

/** 报告底部：数据源免责声明 + 反馈（有用 / 不够好） */
export default function ReportFooter({ dataSources }: { dataSources: number }) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  return (
    <footer className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex items-start gap-2 rounded-xl bg-[#F5F7FA] p-4 text-[13px] leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <span>
          本报告由 AI 业务分析师基于 {dataSources} 个数据源生成，执行前请核实。
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">这份报告对你有帮助吗？</span>
        <button
          onClick={() => setFeedback("up")}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            feedback === "up"
              ? "border-amber-300 bg-amber-50 text-foreground"
              : "border-border bg-white text-muted-foreground hover:bg-secondary"
          }`}
        >
          <ThumbsUp className="h-4 w-4 text-amber-500" />
          有用
        </button>
        <button
          onClick={() => setFeedback("down")}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            feedback === "down"
              ? "border-amber-300 bg-amber-50 text-foreground"
              : "border-border bg-white text-muted-foreground hover:bg-secondary"
          }`}
        >
          <ThumbsDown className="h-4 w-4 text-amber-500" />
          不够好
        </button>
      </div>
    </footer>
  );
}
