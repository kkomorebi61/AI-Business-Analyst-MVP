"use client";

import { RANGES, type Range } from "@/lib/data/daily";
import { cn } from "@/lib/utils";

/** 时间范围分段控件：最近7天 / 最近14天 / 最近30天 */
export default function RangeSwitcher({
  value,
  onChange,
  size = "sm",
}: {
  value: Range;
  onChange: (r: Range) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
            value === r.value
              ? "bg-[#1E3A8A] text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
