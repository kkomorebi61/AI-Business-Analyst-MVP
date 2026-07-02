import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Database,
  Gauge,
  ShieldCheck,
  Users,
} from "lucide-react";
import TopNav from "@/components/top-nav";
import MetricsCenterClient from "@/components/metrics/metrics-center-client";
import { ALL_METRICS } from "@/lib/kb/metric-kb";
import {
  listSources,
  metricTrustInfo,
  type MetricTrustInfo,
} from "@/lib/data/data-trust";
import type { MetricSpec } from "@/lib/kb/metric-kb";

/**
 * 指标定义中心（Metric Definition Center，路由：/metrics）
 * 来源：02_Metric_KB + 02A_Business_Metric_Dictionary + 10_Data_Trust + 11_Query_Governance
 *
 * 目标：让所有核心指标具备企业级可解释性（Explainability）—— 定义 / 公式 / 来源 /
 * 口径 / 负责人 / 更新频率 / 可信度，集中可检索、可追溯。
 *
 * 服务端预聚合「指标 + 可信度」，交由客户端组件做搜索 / 过滤 / 详情抽屉。
 */
export interface MetricDetailRow extends MetricSpec {
  trust: MetricTrustInfo;
}

export default function MetricsPage() {
  const rows: MetricDetailRow[] = ALL_METRICS.map((m) => ({
    ...m,
    trust: metricTrustInfo(m.key),
  }));

  const sources = listSources();
  const allSourceKeys = Array.from(new Set(ALL_METRICS.flatMap((m) => m.source_keys)));
  const avgCoverage = Math.round(
    rows.reduce((s, r) => s + (r.trust.coverage ?? 0), 0) / (rows.length || 1),
  );
  const avgTrust = Math.round(rows.reduce((s, r) => s + r.trust.trustScore, 0) / (rows.length || 1));
  const owners = Array.from(new Set(ALL_METRICS.map((m) => m.owner))).length;

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
          <h1 className="text-[24px] font-semibold">指标定义中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Metric Definition Center · 定义 / 公式 / 来源 / 口径 / 可信度
          </p>
        </header>

        {/* 治理原则横幅（02A Governance Principle + 11 Final Principle） */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-blue-800">
            <BookOpen className="h-4 w-4" />
            治理原则 · Governance
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-blue-700/80">
            <Pill>No Definition</Pill>
            <Arrow />
            <Pill>No Metric</Pill>
            <Arrow />
            <Pill>No Insight</Pill>
            <Arrow />
            <Pill>No Conclusion</Pill>
          </div>
          <p className="mt-1.5 text-[11px] text-blue-700/70">
            每个指标都明确定义、可追溯公式、明确来源与统计口径，确保 AI 分析与用户理解一致。
          </p>
        </div>

        {/* 汇总看板 */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile icon={<BookOpen className="h-4 w-4" />} label="核心指标" value={`${rows.length}`} />
          <Tile icon={<Database className="h-4 w-4" />} label="接入数据源" value={`${allSourceKeys.length}`} />
          <Tile icon={<Gauge className="h-4 w-4" />} label="平均覆盖率" value={`${avgCoverage}%`} />
          <Tile icon={<ShieldCheck className="h-4 w-4" />} label="平均可信度" value={`${avgTrust}`} />
          <Tile icon={<Users className="h-4 w-4" />} label="指标负责人" value={`${owners}`} />
        </div>

        {/* 客户端：搜索 + 角色过滤 + 卡片网格 + 详情抽屉 */}
        <MetricsCenterClient rows={rows} sourceSystems={sources.map((s) => s.source_system)} />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          基于 02A Business Metric Dictionary + 07_data_sources（Mock · 90 天口径）
        </p>
      </main>
    </div>
  );
}

/* ----------------------------- 子组件 ----------------------------- */

function Tile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold">{value}</div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[11px] text-blue-800 ring-1 ring-blue-200">
      {children}
    </span>
  );
}

function Arrow() {
  return <span className="text-blue-400">↓</span>;
}
