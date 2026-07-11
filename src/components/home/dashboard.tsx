"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MetricSection from "./sections/metric-section";
import ChannelSection from "./sections/channel-section";
import InsightSection from "./sections/insight-section";
import MetricDetailDrawer from "@/components/metrics/metric-detail-drawer";
import EvidenceDrawer from "@/components/report/evidence-drawer";
import CurrentDatasetChip from "@/components/dataset/current-dataset-chip";
import { Sparkles, CalendarClock, Upload } from "lucide-react";
import type { DashboardResponse } from "@/app/api/dashboard/route";
import type { Finding, Risk } from "@/lib/agents/types";
import type { MetricKey, Role } from "@/lib/kb/metric-kb";
import type { Range } from "@/lib/data/daily";

/** 视角 → 默认聚焦节（按 section id 高亮，不藏节） */
const FOCUS_SECTION: Record<Role, string> = {
  CEO: "overview",
  CRM_MANAGER: "membership",
  OPERATION_MANAGER: "channels",
};
const FOCUS_HINT: Record<Role, string> = {
  CEO: "经营总览 · 渠道分析 · 关键发现",
  CRM_MANAGER: "会员资产 · 私域经营",
  OPERATION_MANAGER: "经营总览 · 渠道分析",
};

export default function Dashboard({
  range,
  perspective,
}: {
  range: Range;
  perspective: Role;
}) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricDrawer, setMetricDrawer] = useState<{ open: boolean; key: MetricKey | null }>({
    open: false,
    key: null,
  });
  const [evidenceDrawer, setEvidenceDrawer] = useState<{ open: boolean; target: Finding | Risk | null }>({
    open: false,
    target: null,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/dashboard?range=${range}&perspective=${perspective}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload: DashboardResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        /* 保留上次数据；本地接口不应失败 */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, perspective]);

  const onViewMetric = useCallback((key: MetricKey) => {
    setMetricDrawer({ open: true, key });
  }, []);
  const onViewInsightEvidence = useCallback((target: Finding | Risk) => {
    setEvidenceDrawer({ open: true, target });
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const focus = FOCUS_SECTION[perspective];
  const gapCount = data.gaps.cannotAnalyze.length;

  // 节序号：按渲染顺序连续编号（metric sections + channels）
  let idx = 0;
  const nextIndex = () => String(++idx).padStart(2, "0");

  return (
    <div className="flex flex-col gap-8">
      {/* Data First 上下文：视角 + Date Anchor + 场景 + 缺口提示 */}
      <div className="flex flex-col gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        <span className="flex flex-wrap items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          当前视角：
          <b>{perspective === "CEO" ? "CEO" : perspective === "CRM_MANAGER" ? "CRM 经理" : "运营经理"}</b>
          ；业务场景：<b>{data.scenario.label}</b>
          <CurrentDatasetChip />
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          Date Anchor（数据截止 <b>{data.anchor || "未知"}</b>）：所有指标的时间口径基于此日期，与系统当前时间无关
        </span>
        {gapCount > 0 && (
          <Link
            href="/upload"
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            当前数据暂不支持 {gapCount} 项分析（如 {data.gaps.cannotAnalyze.slice(0, 3).map((g) => g.metric).join("、")}
            ）→ 前往「上传数据」补充
          </Link>
        )}
      </div>

      {/* 动态节：仅渲染数据支撑的 metric sections */}
      {data.sections.map((s) => (
        <MetricSection
          key={s.id}
          index={nextIndex()}
          title={s.title}
          subtitle={s.subtitle}
          source={s.source}
          kpis={s.kpis}
          kind={s.kind}
          asOf={s.asOf}
          drillTo={s.drillTo}
          rangeLabel={data.rangeLabel}
          highlight={focus === s.id}
          onViewMetric={onViewMetric}
        />
      ))}

      {/* 渠道分析（OMS 存在时） */}
      {data.channels && (
        <div className={focus === "channels" ? "rounded-xl ring-2 ring-blue-200 ring-offset-4" : undefined}>
          <ChannelSection
            channels={data.channels.rows}
            totalGmv={data.channels.totalGmv}
            rangeLabel={data.rangeLabel}
          />
        </div>
      )}

      {/* 关键发现 / 风险 / 建议（doc19 M6 主动洞察） */}
      <InsightSection
        findings={data.insights.findings}
        risks={data.insights.risks}
        recommendations={data.insights.recommendations}
        onViewEvidence={onViewInsightEvidence}
        onViewMetric={onViewMetric}
      />

      {/* 抽屉（全局）：指标口径说明 + 洞察 Evidence */}
      <MetricDetailDrawer
        open={metricDrawer.open}
        metricKey={metricDrawer.key}
        onClose={() => setMetricDrawer({ open: false, key: null })}
      />
      <EvidenceDrawer
        open={evidenceDrawer.open}
        target={evidenceDrawer.target}
        onClose={() => setEvidenceDrawer({ open: false, target: null })}
      />
    </div>
  );
}

/** 加载骨架 */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-9 w-2/3 animate-pulse rounded bg-secondary" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="mb-3 h-5 w-40 animate-pulse rounded bg-secondary" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-20 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-muted-foreground">经营驾驶舱加载中…</p>
    </div>
  );
}
