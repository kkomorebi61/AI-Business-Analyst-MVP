import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/icons";
import type { Finding } from "@/lib/agents/types";

/** 第02节 关键发现：发现卡（分类标签 + 图标 / 标题 / 描述 / 指标徽标 + 深入分析） */
export default function FindingsSection({ findings }: { findings: Finding[] }) {
  return (
    <div className="flex flex-col gap-3">
      {findings.map((f) => {
        const up = f.direction === "up";
        return (
          <div
            key={f.id}
            className="rounded-xl border border-border bg-white p-4"
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  up ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
                }`}
              >
                <Icon name={f.icon} className="h-4 w-4" />
              </div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {f.category}
              </span>
            </div>

            <div className="mt-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
              <span
                className={`shrink-0 whitespace-nowrap text-sm font-semibold ${
                  up ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {f.metric}
              </span>
            </div>

            <button className="mt-3 flex items-center gap-1 text-xs text-blue-600">
              深入分析 <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
