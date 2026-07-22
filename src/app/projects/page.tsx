"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FolderKanban,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CREDIBILITY_LABEL,
  INDUSTRY_LABEL,
  PHASE_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/project/labels";
import type { CreateProjectInput, Project, ProjectIndustry } from "@/lib/project/types";

/**
 * 项目列表（/projects）—— sidebar「项目」落地页。
 * 卡片网格 + 新建项目弹窗。从 workspace-client 迁移项目列表，去掉与 sidebar 重复的快捷入口。
 */
const INDUSTRIES: ProjectIndustry[] = [
  "RETAIL",
  "ECOMMERCE",
  "BEAUTY",
  "FASHION",
  "FMCG",
  "CUSTOM",
];
const PERSPECTIVES: { value: CreateProjectInput["perspective"]; label: string }[] = [
  { value: "CEO", label: "CEO 视角" },
  { value: "CRM_MANAGER", label: "CRM 运营" },
  { value: "OPERATION_MANAGER", label: "运营经理" },
];

function CreateProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<ProjectIndustry>("RETAIL");
  const [perspective, setPerspective] = useState<CreateProjectInput["perspective"]>("CEO");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setIndustry("RETAIL");
      setPerspective("CEO");
      setGoal("");
      setErr(null);
    }
  }, [open]);
  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          industry,
          perspective,
          businessGoal: goal.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "创建失败");
      router.push(`/projects/${data.project.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败");
      setBusy(false);
    }
  };

  const field = "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">新建咨询项目</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              从业务问题开始——先描述你要解决的问题，后续步骤由 AI 引导。
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium">项目名称</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：GMV 下滑归因（可留空自动生成）" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium">行业</span>
              <select value={industry} onChange={(e) => setIndustry(e.target.value as ProjectIndustry)} className={field}>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{INDUSTRY_LABEL[i]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium">分析视角</span>
              <select value={perspective} onChange={(e) => setPerspective(e.target.value as CreateProjectInput["perspective"])} className={field}>
                {PERSPECTIVES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium">业务目标 / 要解决的问题</span>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="如：近 30 天 GMV 环比下滑，想定位原因并给出挽回策略" className={`resize-none ${field}`} />
          </label>
        </div>
        {err && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">⚠ {err}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">取消</button>
          <button onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            创建并开始
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/projects", { cache: "no-store" });
      const data = (await r.json()) as { projects: Project[] };
      setProjects(data.projects ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold">
            <FolderKanban className="h-5 w-5 text-blue-600" />
            项目
            <span className="text-sm font-normal text-muted-foreground">（{projects.length}）</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">每一次完整咨询（业务问题 → 诊断 → 策略 → 执行 → 追踪）归为一个项目。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />刷新
          </button>
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e40af]">
            <Plus className="h-4 w-4" />新建项目
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-white" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white p-12 text-center">
          <p className="text-sm text-muted-foreground">还没有项目。点击「新建项目」开始第一次咨询分析。</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group block rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-[15px] font-semibold">{p.name}</h3>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              {p.businessGoal && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.businessGoal}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                <Badge variant="outline">{PHASE_LABEL[p.currentPhase]}</Badge>
                <Badge variant="secondary">{INDUSTRY_LABEL[p.industry]}</Badge>
                <span className="text-[11px] text-muted-foreground">可信度：{CREDIBILITY_LABEL[p.credibilityLevel]} · {p.dataCompletenessPct}%</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </main>
  );
}
