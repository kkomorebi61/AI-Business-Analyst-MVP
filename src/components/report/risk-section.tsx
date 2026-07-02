import { ShieldAlert, TriangleAlert } from "lucide-react";
import type { Risk } from "@/lib/agents/types";

const LEVEL = {
  high: { label: "高风险", bar: "border-l-red-500", text: "text-red-600", chip: "bg-red-50 text-red-600" },
  medium: { label: "中风险", bar: "border-l-amber-500", text: "text-amber-600", chip: "bg-amber-50 text-amber-600" },
  low: { label: "低风险", bar: "border-l-slate-300", text: "text-slate-500", chip: "bg-slate-100 text-slate-500" },
} as const;

/** 第03节 风险提示：按严重度着色的风险卡（高/中/低） */
export default function RiskSection({ risks }: { risks: Risk[] }) {
  return (
    <div className="flex flex-col gap-3">
      {risks.map((r) => {
        const lv = LEVEL[r.level];
        const IconCmp = r.level === "low" ? ShieldAlert : TriangleAlert;
        return (
          <div
            key={r.id}
            className={`rounded-xl border border-border border-l-4 bg-white p-4 ${lv.bar}`}
          >
            <div className="flex items-start justify-between">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${lv.chip}`}
              >
                <IconCmp className="h-4 w-4" />
              </div>
              <span className={`text-xs font-semibold ${lv.text}`}>
                {lv.label}
              </span>
            </div>

            <h3 className="mt-2.5 text-[15px] font-semibold">{r.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {r.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{r.impact}</p>
          </div>
        );
      })}
    </div>
  );
}
