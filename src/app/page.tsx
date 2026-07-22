"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import Dashboard from "@/components/home/dashboard";
import { Badge } from "@/components/ui/badge";
import { useDeactivateOnMount } from "@/components/shared/use-deactivate-on-mount";
import {
  PHASE_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/project/labels";
import type { Project } from "@/lib/project/types";

/**
 * 工作台（/）—— 原型数据驾驶舱雏形。
 * Hero（欢迎 + 开始业务诊断）+ 真实经营驾驶舱（复用 Dashboard：KPI / 图表 / 发现）
 * + 最近项目（接 /api/projects）+ 待办（占位）。
 * KPI / 图表 / 发现均接 /api/dashboard 真实数据（当前 active dataset）。
 */

const TODOS = [
  { icon: "⚠️", tone: "text-amber-600", title: "补充 6 月华东会员活跃数据", desc: "数据体检 · 缺失字段" },
  { icon: "⏱️", tone: "text-blue-600", title: "评审「活动 ROI 复盘」策略方案", desc: "策略生成 · 待评审" },
  { icon: "✅", tone: "text-green-600", title: "效果追踪：会员日活动已完成", desc: "Impact Report 已生成" },
];

export default function HomePage() {
  useDeactivateOnMount();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setProjects((d.projects ?? []) as Project[]))
      .catch(() => {});
  }, []);

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      {/* Hero */}
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6">
        <h1 className="text-[22px] font-semibold">工作台</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          欢迎回来，李经理 · 让 AI 引导你从业务问题走到可执行策略。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1e40af]"
          >
            <Sparkles className="h-4 w-4" />
            开始业务诊断
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            查看历史项目
          </Link>
        </div>
      </section>

      {/* 经营驾驶舱：KPI / 图表 / 发现（真实数据） */}
      <section className="mt-6">
        <Dashboard range={7} perspective="CEO" />
      </section>

      {/* 最近项目 + 待办 */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">最近项目</h2>
            <Link href="/projects" className="text-xs text-blue-600 hover:text-blue-700">
              全部 →
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
              还没有项目。
              <Link href="/projects" className="ml-1 text-blue-600 underline">
                新建第一个项目
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group flex items-center justify-between rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {PHASE_LABEL[p.currentPhase]} · {p.businessGoal || "未填写目标"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-[17px] font-semibold">待办事项</h2>
          <div className="space-y-3">
            {TODOS.map((t, i) => (
              <div key={i} className="rounded-xl border border-border bg-white p-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-base leading-none">{t.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${t.tone}`}>{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
