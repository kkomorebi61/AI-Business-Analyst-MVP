import { Check } from "lucide-react";
import { Icon } from "@/components/icons";
import type { Recommendation } from "@/lib/agents/types";

/** 第04节 行动建议：行动卡（编号 / 图标 / 标题 / 描述 / 三标签 / 指派） */
export default function RecommendationsSection({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="rounded-xl border border-border bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon name={rec.icon} className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">{rec.id}</div>
                  <h3 className="text-[15px] font-semibold leading-tight">
                    {rec.title}
                  </h3>
                </div>
                <button className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary">
                  <Check className="h-3.5 w-3.5" />
                  指派
                </button>
              </div>

              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {rec.description}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-secondary px-2 py-0.5 font-medium text-foreground">
                  {rec.category}
                </span>
                <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">
                  {rec.investment}
                </span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600">
                  {rec.outcome}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
