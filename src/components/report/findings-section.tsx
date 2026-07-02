"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { Icon } from "@/components/icons";
import EvidenceInline from "./evidence-inline";
import MetricExplainLink from "@/components/metrics/metric-explain-link";
import type { Finding } from "@/lib/agents/types";
import type { MetricKey } from "@/lib/kb/metric-kb";

/** 第02节 关键发现：发现卡（分类标签 / 标题 / 描述 / 指标 / Evidence / 根因 / 查看依据 / 该指标如何计算） */
export default function FindingsSection({
  findings,
  onViewEvidence,
  onViewMetric,
}: {
  findings: Finding[];
  onViewEvidence: (f: Finding) => void;
  onViewMetric?: (key: MetricKey) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {findings.map((f) => {
        const up = f.direction === "up";
        return (
          <div key={f.id} className="rounded-xl border border-border bg-white p-4">
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
              {f.rootCause && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                  <Sparkles className="h-3 w-3" />
                  根因：{f.rootCause.event.event_name}
                </span>
              )}
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

            <EvidenceInline evidence={f.evidence} />

            <div className="mt-3 flex items-center justify-between">
              <MetricExplainLink
                text={`${f.title} ${f.metric} ${f.description} ${f.evidence?.items.map((i) => i.metric).join(" ") ?? ""}`}
                onViewMetric={onViewMetric}
              />
              <button
                onClick={() => onViewEvidence(f)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                查看依据 <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
