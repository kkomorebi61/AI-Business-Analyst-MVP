"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import RangeSwitcher from "@/components/home/range-switcher";
import CurrentDatasetChip from "@/components/dataset/current-dataset-chip";
import RoutingBanner from "./routing-banner";
import AnswerRenderer from "./answer-renderer";
import { QUERY_TYPE_LABEL, QUERY_TYPE_COST } from "@/lib/routing/types";
import type { Classification, QueryResult, CostTier } from "@/lib/routing/types";
import type { Range } from "@/lib/data/daily";
import type { Role } from "@/lib/kb/metric-kb";
import { needsConfirmation, TIER_TOKEN_ESTIMATE } from "@/lib/routing/cost-estimate";
import ConfirmDialog from "./confirm-dialog";

/** 每类一个示例提问，点击即填入并提交（便于验收 8 条路径） */
const EXAMPLES: { type: Classification["queryType"]; q: string }[] = [
  { type: "metric", q: "最近7天GMV是多少？" },
  { type: "comparison", q: "今天和昨天GMV对比" },
  { type: "trend", q: "最近30天GMV趋势如何？" },
  { type: "calculation", q: "ROI是多少？" },
  { type: "insight", q: "为什么GMV下降？" },
  { type: "strategy", q: "如何提升复购率？" },
  { type: "execution", q: "如何创建优惠券？" },
  { type: "requirement", q: "帮我生成PRD" },
];

/** 视角选择（doc 15 P3 缓存键 Role 组件 + Insight 工作流 perspective） */
const PERSPECTIVES: { value: Role; label: string }[] = [
  { value: "CEO", label: "CEO" },
  { value: "CRM_MANAGER", label: "CRM 经理" },
  { value: "OPERATION_MANAGER", label: "运营经理" },
];

/** 提交前实时分类以判定成本档（doc 15 P10 高成本确认；GET 零成本纯规则） */
async function classifyTier(q: string): Promise<CostTier | null> {
  try {
    const res = await fetch(`/api/query?question=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const c = (await res.json()) as Classification;
    return QUERY_TYPE_COST[c.queryType];
  } catch {
    return null;
  }
}

export default function QueryConsole({
  initialQuestion = "",
  initialPerspective = "CEO",
}: {
  initialQuestion?: string;
  initialPerspective?: Role;
}) {
  const [question, setQuestion] = useState(initialQuestion || EXAMPLES[2].q);
  const [range, setRange] = useState<Range>(7);
  const [perspective, setPerspective] = useState<Role>(initialPerspective);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Classification | null>(null);
  /** doc 15 P10：待确认的高成本档位（非 null 时弹窗拦截） */
  const [pendingConfirm, setPendingConfirm] = useState<CostTier | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 实时分类预览（GET /api/query，零成本、纯规则）—— 输入即显示将走哪条路径 */
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    const q = question.trim();
    if (!q) {
      setPreview(null);
      return;
    }
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/query?question=${encodeURIComponent(q)}`);
        if (res.ok) setPreview((await res.json()) as Classification);
      } catch {
        /* 预览失败静默，不影响主流程 */
      }
    }, 250);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [question]);

  const submit = useCallback(
    async (q?: string, opts?: { force?: boolean }) => {
      const questionText = (q ?? question).trim();
      if (!questionText) return;
      setQuestion(questionText);

      // doc 15 P10：高成本任务（strategy/requirement）执行前需 Token 消耗确认
      if (!opts?.force) {
        const tier = await classifyTier(questionText);
        if (tier && needsConfirmation(tier)) {
          setPendingConfirm(tier);
          return;
        }
      }
      setPendingConfirm(null);

      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: questionText, range, role: perspective }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `请求失败 (${res.status})`);
        }
        setResult((await res.json()) as QueryResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "路由执行失败");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [question, range, perspective],
  );

  return (
    <main className="mx-auto max-w-[920px] px-6 py-8">
      {/* 标题 */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-[22px] font-semibold">
            <Sparkles className="h-5 w-5 text-blue-600" />
            智能问答 · 决策路由控制台
          </h1>
          <CurrentDatasetChip />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          自然语言提问 → 自动分类 → 路由到最优执行路径（Rule / SQL / Evidence / Knowledge First · LLM Last）
        </p>
      </div>

      {/* 输入区 */}
      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
            }}
            rows={2}
            placeholder="试试：如何提升复购率？ / 为什么GMV下降？ / 如何创建优惠券？"
            className="min-h-[56px] flex-1 resize-none rounded-lg border border-border bg-[#F8F9FA] px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground focus:border-blue-400 focus:bg-white"
          />
          <button
            onClick={() => void submit()}
            disabled={loading || !question.trim()}
            className="inline-flex h-[56px] items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? "路由中" : "提问"}
          </button>
        </div>

        {/* 时间范围 + 实时分类预览 */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">视角</span>
            <select
              value={perspective}
              onChange={(e) => setPerspective(e.target.value as Role)}
              className="h-8 rounded-md border border-border bg-white px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              {PERSPECTIVES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">时间范围</span>
            <RangeSwitcher value={range} onChange={setRange} size="sm" />
            <span className="text-[11px] text-muted-foreground">（⌘/Ctrl + Enter 提交）</span>
          </div>

          {preview && !loading && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
              将判定为：{QUERY_TYPE_LABEL[preview.queryType]}
              <span className="text-blue-400">·</span>
              置信度 {(preview.confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>

        {/* 示例 chips（6 类路径，点击即验） */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <span className="text-[11px] text-muted-foreground">示例：</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.type}
              onClick={() => void submit(ex.q)}
              className="rounded-full border border-border bg-[#F8F9FA] px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              {QUERY_TYPE_LABEL[ex.type]}：{ex.q}
            </button>
          ))}
        </div>
      </div>

      {/* 结果区 */}
      <div className="mt-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            ⚠ {error}
          </div>
        )}

        {loading && !result && (
          <div className="rounded-2xl border border-border bg-white p-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
            <p className="mt-3 text-xs text-muted-foreground">
              决策路由运行中：QueryClassifier → Router → 执行引擎…
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <RoutingBanner
              classification={result.classification}
              routing={result.routing}
              estimate={result.cost.estimate}
            />
            <AnswerRenderer answer={result.answer} />
          </div>
        )}

        {!result && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-white/50 p-10 text-center text-sm text-muted-foreground">
            输入问题或点击上方示例，查看自动分类与路由结果。
          </div>
        )}
      </div>

      {/* doc 15 P10：高成本任务确认弹窗 */}
      <ConfirmDialog
        open={!!pendingConfirm}
        tier={pendingConfirm}
        estimateLabel={pendingConfirm ? TIER_TOKEN_ESTIMATE[pendingConfirm].label : ""}
        onConfirm={() => {
          setPendingConfirm(null);
          void submit(undefined, { force: true });
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </main>
  );
}
