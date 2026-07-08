import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Coins,
  Cpu,
  Gauge,
  Hash,
  Zap,
} from "lucide-react";
import TopNav from "@/components/top-nav";
import { getCostSnapshot, COST_TARGETS } from "@/lib/routing/cost-store";

/** 强制动态：读取进程内实时计数器，禁用静态预渲染 */
export const dynamic = "force-dynamic";

/**
 * 成本中心（Cost Center，路由：/cost）—— doc 15 §Cost Monitoring「✓ Cost Visible」
 *
 * 5 指标：请求量 / Token 消耗 / 缓存命中率 / 模型调用率 / 平均成本
 * 4 目标：缓存命中率>60% · 知识复用率>50% · LLM 调用率<30% · 单问平均成本<¥0.05
 */
type Status = "good" | "bad" | "neutral";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function CostPage() {
  const s = getCostSnapshot();
  const hasData = s.totalRequests > 0;

  const tiles: {
    icon: ReactNode;
    label: string;
    value: string;
    status: Status;
  }[] = [
    { icon: <Hash className="h-4 w-4" />, label: "请求量", value: `${s.totalRequests}`, status: "neutral" },
    {
      icon: <Coins className="h-4 w-4" />,
      label: "Token 消耗",
      value: `${s.tokensIn} in / ${s.tokensOut} out`,
      status: "neutral",
    },
    {
      icon: <Zap className="h-4 w-4" />,
      label: "缓存命中率",
      value: pct(s.cacheHitRate),
      status: hasData ? (s.cacheHitRate >= COST_TARGETS.cacheHitRate ? "good" : "bad") : "neutral",
    },
    {
      icon: <Cpu className="h-4 w-4" />,
      label: "模型调用率",
      value: pct(s.llmUsageRate),
      status: hasData ? (s.llmUsageRate <= COST_TARGETS.llmUsageRate ? "good" : "bad") : "neutral",
    },
    {
      icon: <Gauge className="h-4 w-4" />,
      label: "平均成本 / 问",
      value: `¥${s.avgCostYuan.toFixed(4)}`,
      status: hasData ? (s.avgCostYuan <= COST_TARGETS.avgCostYuan ? "good" : "bad") : "neutral",
    },
  ];

  const goals: {
    label: string;
    current: string;
    target: string;
    met: boolean;
    ratio: number;
  }[] = [
    {
      label: "缓存命中率",
      current: pct(s.cacheHitRate),
      target: `> ${pct(COST_TARGETS.cacheHitRate)}`,
      met: s.cacheHitRate >= COST_TARGETS.cacheHitRate,
      ratio: Math.min(1, s.cacheHitRate / COST_TARGETS.cacheHitRate),
    },
    {
      label: "知识复用率",
      current: pct(s.knowledgeReuseRate),
      target: `> ${pct(COST_TARGETS.knowledgeReuseRate)}`,
      met: s.knowledgeReuseRate >= COST_TARGETS.knowledgeReuseRate,
      ratio: Math.min(1, s.knowledgeReuseRate / COST_TARGETS.knowledgeReuseRate),
    },
    {
      label: "LLM 调用率",
      current: pct(s.llmUsageRate),
      target: `< ${pct(COST_TARGETS.llmUsageRate)}`,
      met: s.llmUsageRate <= COST_TARGETS.llmUsageRate,
      ratio: 1 - Math.min(1, s.llmUsageRate / COST_TARGETS.llmUsageRate),
    },
    {
      label: "单问平均成本",
      current: `¥${s.avgCostYuan.toFixed(4)}`,
      target: `< ¥${COST_TARGETS.avgCostYuan}`,
      met: s.avgCostYuan <= COST_TARGETS.avgCostYuan,
      ratio: 1 - Math.min(1, s.avgCostYuan / COST_TARGETS.avgCostYuan),
    },
  ];

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[1280px] px-6 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回首页
        </Link>

        <header className="mb-6">
          <h1 className="text-[24px] font-semibold">
            成本中心 <span className="text-emerald-600">✓ Cost Visible</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            doc 15 §Cost Monitoring · 请求量 / Token / 缓存命中率 / 模型调用率 / 平均成本
          </p>
        </header>

        {/* 5 指标 */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <Tile key={t.label} {...t} />
          ))}
        </div>

        {/* 4 目标达成 */}
        <Section title="成本目标达成" subtitle="doc 15 §Cost Monitoring Targets">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {goals.map((g) => (
              <div key={g.label} className="rounded-xl border border-border bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium">{g.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      g.met
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {g.met ? "达标" : "未达标"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  当前 {g.current} · 目标 {g.target}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-secondary">
                  <div
                    className={`h-1.5 rounded ${g.met ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.round(g.ratio * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <p className="mt-8 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          进程内计数器（dev/preview 单实例）· rule 模式零 token，平均成本自然满足 &lt;¥0.05
        </p>
      </main>
    </div>
  );
}

/* ----------------------------- 子组件 ----------------------------- */

const STATUS_COLOR: Record<Status, string> = {
  good: "text-emerald-600",
  bad: "text-amber-600",
  neutral: "",
};

function Tile({
  icon,
  label,
  value,
  status,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  status: Status;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-[20px] font-semibold ${STATUS_COLOR[status]}`}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
