"use client";

import { useCallback, useEffect, useState } from "react";
import MetricSection from "./sections/metric-section";
import ChannelSection from "./sections/channel-section";
import InsightSection from "./sections/insight-section";
import MetricDetailDrawer from "@/components/metrics/metric-detail-drawer";
import EvidenceDrawer from "@/components/report/evidence-drawer";
import { Sparkles } from "lucide-react";
import type { DashboardResponse } from "@/app/api/dashboard/route";
import type { Finding, Risk } from "@/lib/agents/types";
import type { MetricKey, Role } from "@/lib/kb/metric-kb";
import type { Range } from "@/lib/data/daily";

/** 视角 → 默认聚焦节（仅高亮，不藏节） */
const FOCUS_SECTION: Record<Role, string> = {
  CEO: "01",
  CRM_MANAGER: "02",
  OPERATION_MANAGER: "04",
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
    fetch(`/api/dashboard?range=${range}&perspective=${perspective}`)
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

  /** 指标卡「依据」/ 卡身点击 → 指标口径说明抽屉（定义 / 公式 / 来源 / 更新时间） */
  const onViewMetric = useCallback((key: MetricKey) => {
    setMetricDrawer({ open: true, key });
  }, []);

  /** 洞察（§5/§6）「查看依据」→ 直接用 Finding/Risk 自带的 evidence */
  const onViewInsightEvidence = useCallback((target: Finding | Risk) => {
    setEvidenceDrawer({ open: true, target });
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const focus = FOCUS_SECTION[perspective];
  const s = data.sections;

  return (
    <div className="flex flex-col gap-8">
      {/* 视角聚焦提示 + 周期/存量口径说明 */}
      <div className="flex flex-col gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          当前视角：
          <b>{perspective === "CEO" ? "CEO" : perspective === "CRM_MANAGER" ? "CRM 经理" : "运营经理"}</b>
          ；建议关注：{FOCUS_HINT[perspective]}。
        </span>
        <span className="text-blue-600/80">
          口径：§1 经营总览为<b>周期指标</b>（随时间筛选变化）；§2 会员资产为<b>存量指标</b>（期末快照，不随筛选变化）。
        </span>
      </div>

      {/* §1 经营总览（周期指标 · 受时间筛选影响） */}
      <MetricSection
        index="01"
        title="经营总览"
        subtitle="Business Overview · 周期指标（GMV / 订单 / 客单价 / ROI / 新增 / 活跃 / 复购）"
        source={s.overview.source}
        kpis={s.overview.kpis}
        kind="period"
        rangeLabel={data.rangeLabel}
        highlight={focus === "01"}
        onViewMetric={onViewMetric}
      />

      {/* §2 会员资产（存量指标 · 不受时间筛选影响） */}
      <MetricSection
        index="02"
        title="会员资产"
        subtitle="Membership Assets · 存量快照（会员总数 / VIP / LTV / 流失率）"
        source={s.membership.source}
        kpis={s.membership.kpis}
        kind="snapshot"
        asOf={s.membership.asOf}
        drillTo={s.membership.drillTo}
        highlight={focus === "02"}
        onViewMetric={onViewMetric}
      />

      {/* §3 私域经营 */}
      <MetricSection
        index="03"
        title="私域经营"
        subtitle="SCRM Performance · Enterprise WeChat"
        source={s.scrm.source}
        kpis={s.scrm.kpis}
        kind="period"
        rangeLabel={data.rangeLabel}
        drillTo={s.scrm.drillTo}
        highlight={focus === "03"}
        onViewMetric={onViewMetric}
      />

      {/* §4 渠道分析 */}
      <div className={focus === "04" ? "rounded-xl ring-2 ring-blue-200 ring-offset-4" : undefined}>
        <ChannelSection channels={s.channels.rows} totalGmv={s.channels.totalGmv} rangeLabel={data.rangeLabel} />
      </div>

      {/* §5/§6/§7 洞察 */}
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
