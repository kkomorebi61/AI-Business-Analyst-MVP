"use client";

import { CheckCircle2, XCircle, CalendarClock, Layers, Target, AlertTriangle } from "lucide-react";
import type { UnderstandingResult } from "@/lib/data-understanding/types";
import { SCENARIO_LABELS } from "@/lib/data-understanding/scenario";
import { DATA_TYPE_LABELS } from "@/lib/data-understanding/recommend";

/**
 * 数据理解结果展示（doc 19 §Module 1-4 输出）。
 * 纯展示组件，由 upload-client 喂入 UnderstandingResult。
 */
export default function UnderstandingResultView({ u }: { u: UnderstandingResult }) {
  const detected = u.classification.detected;
  return (
    <div className="space-y-5">
      {/* 头部：数据源 + Date Anchor */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white p-4">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            u.source === "sample"
              ? "bg-blue-50 text-blue-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {u.source === "sample" ? "内置样本数据" : "已上传数据"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Date Anchor（数据截止）：<span className="font-medium text-foreground">{u.latestDataDate || "未知"}</span>
        </span>
        <span className="text-sm text-muted-foreground">
          所有问题的时间口径基于此日期，与系统当前时间无关
        </span>
      </div>

      {/* §1 数据分类 */}
      <Section icon={<Layers className="h-4 w-4" />} title="① 数据分类" hint="识别到的业务数据类型">
        <div className="flex flex-wrap gap-2">
          {detected.length === 0 && <Empty>未识别到标准业务数据</Empty>}
          {u.classification.perType.map((d) => (
            <div
              key={d.type}
              className="rounded-md border border-border bg-[#F8F9FA] px-3 py-2 text-sm"
            >
              <div className="font-medium text-foreground">{DATA_TYPE_LABELS[d.type]}</div>
              <div className="text-xs text-muted-foreground">命中 {d.matchedFields.length} 个字段</div>
            </div>
          ))}
        </div>
      </Section>

      {/* §2 业务场景 */}
      <Section icon={<Target className="h-4 w-4" />} title="② 业务场景识别">
        <div className="text-sm">
          <span className="font-medium text-foreground">{SCENARIO_LABELS[u.scenario.primary]}</span>
          <span className="ml-2 text-muted-foreground">{u.scenario.reason}</span>
        </div>
        {u.scenario.scenarios.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {u.scenario.scenarios.map((s) => (
              <span key={s} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {SCENARIO_LABELS[s]}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* §3 推荐分析 */}
      <Section icon={<Target className="h-4 w-4" />} title="③ 推荐分析">
        <div className="flex flex-wrap gap-1.5">
          {u.recommendations.length === 0 && <Empty>暂无可推荐分析</Empty>}
          {u.recommendations.map((r) => (
            <span key={r.id} className="rounded-md border border-border px-2.5 py-1 text-sm text-foreground">
              {r.title}
            </span>
          ))}
        </div>
      </Section>

      {/* §4 缺口分析 */}
      <Section
        icon={<AlertTriangle className="h-4 w-4" />}
        title="④ 数据缺口分析"
        hint="No Unsupported Analysis：缺数据明确告知，禁止推测"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> 当前可分析（{u.gaps.canAnalyze.length}）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {u.gaps.canAnalyze.map((m) => (
                <span key={m} className="rounded bg-white px-2 py-0.5 text-xs text-emerald-700">
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-rose-700">
              <XCircle className="h-4 w-4" /> 暂不支持（{u.gaps.cannotAnalyze.length}）
            </div>
            <ul className="space-y-1.5 text-xs">
              {u.gaps.cannotAnalyze.map((g) => (
                <li key={g.metric} className="text-rose-700">
                  <span className="font-medium">{g.metric}</span>：{g.reason}
                  <span className="text-rose-500"> · 建议上传「{DATA_TYPE_LABELS[g.recommendUpload]}」</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}
