"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import type { Range } from "@/lib/data/daily";
import type { Role } from "@/lib/kb/metric-kb";
import RangeSwitcher from "./range-switcher";

const PERSPECTIVES: { value: Role; label: string }[] = [
  { value: "CEO", label: "CEO" },
  { value: "CRM_MANAGER", label: "CRM 经理" },
  { value: "OPERATION_MANAGER", label: "运营经理" },
];

const SUGGESTIONS: { question: string; desc: string }[] = [
  { question: "本周业务表现如何？", desc: "GMV、订单数、转化率的本周表现摘要" },
  { question: "为什么 GMV 下降了？", desc: "针对 GMV 下降的原因分析" },
  { question: "各渠道表现如何？", desc: "分渠道、LTV 与活跃会员分析" },
  { question: "哪个渠道表现最好？", desc: "对比分析，自然与推荐渠道的转化" },
];

const ROLE_LABEL: Record<Role, string> = {
  CEO: "CEO",
  CRM_MANAGER: "CRM 经理",
  OPERATION_MANAGER: "运营经理",
};

export default function HomeWorkspace({
  perspective,
  range,
  question,
  onPerspective,
  onRange,
  onQuestion,
  onSubmit,
}: {
  perspective: Role;
  range: Range;
  question: string;
  onPerspective: (r: Role) => void;
  onRange: (r: Range) => void;
  onQuestion: (q: string) => void;
  onSubmit: () => void;
}) {
  const router = useRouter();

  const go = (q: string) => {
    const target = q.trim();
    if (!target) return;
    onSubmit();
    router.push(
      `/report?question=${encodeURIComponent(target)}&perspective=${perspective}&range=${range}`,
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section>
        <h1 className="text-[26px] font-semibold leading-tight">下午好，思辰。</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">今天想了解什么？</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">视角</label>
          <div className="relative">
            <select
              value={perspective}
              onChange={(e) => onPerspective(e.target.value as Role)}
              className="h-9 appearance-none rounded-md border border-border bg-white pl-3 pr-8 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              {PERSPECTIVES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* 时间范围筛选器（视角选择器右侧） */}
          <RangeSwitcher value={range} onChange={onRange} />

          <span className="text-xs text-muted-foreground">
            问答内容已根据视角与时间范围调整
          </span>
        </div>
      </section>

      {/* 问题输入 */}
      <section className="rounded-xl border border-border bg-[#F5F7FA] p-4">
        <textarea
          value={question}
          onChange={(e) => onQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go(question);
            }
          }}
          rows={2}
          placeholder="试试问问一些问题"
          className="w-full resize-none bg-transparent px-1 text-[15px] placeholder:text-muted-foreground/70 focus-visible:outline-none"
        />
        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>智能推荐</span>
            <span className="rounded-full bg-white px-2 py-0.5">按 / 自动过滤</span>
          </div>
          <button
            onClick={() => go(question)}
            className="h-9 rounded-md bg-[#1E3A8A] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            搜索
          </button>
        </div>
      </section>

      {/* 推荐问题卡片 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">
            为 {ROLE_LABEL[perspective]} 推荐
          </h2>
          <button className="flex items-center gap-1 text-xs text-blue-600">
            深度分析 <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.question}
              onClick={() => go(s.question)}
              className="group rounded-xl border border-border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <div className="text-[14px] font-medium group-hover:text-blue-600">
                {s.question}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {s.desc}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
