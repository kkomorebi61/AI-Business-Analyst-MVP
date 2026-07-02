import { Clock, Sparkles } from "lucide-react";
import type { AnalysisResult } from "@/lib/agents/types";

/** 摘要卡：本周整体表现 + 高智能摘要标签 + AI生成·查准度 + 阅读时间 */
export default function SummarySection({
  summary,
}: {
  summary: AnalysisResult["summary"];
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[15px] font-semibold text-blue-600">
          本周整体表现
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
          <Sparkles className="h-3 w-3" />
          {summary.tag}
        </span>
      </div>
      <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>AI 生成 · 查准度 {summary.accuracy}%</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          阅读时间: 约 {summary.readingTimeSec} 秒
        </span>
      </div>
      <div className="rounded-xl bg-[#F5F7FA] p-4 text-[14px] leading-relaxed text-foreground">
        {summary.text}
      </div>
    </section>
  );
}
