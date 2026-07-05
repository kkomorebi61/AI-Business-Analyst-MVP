"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database } from "lucide-react";
import SectionHeading from "@/components/report/section-heading";
import ChannelBreakdown, { type ChannelSortKey } from "@/components/report/channel-breakdown";
import type { ChannelAggregate } from "@/lib/data/csv-engine";

/**
 * 首页 §4 渠道分析 —— 业务主题节（来源 OMS）。
 * 包 ChannelBreakdown，叠加：表头排序（GMV/订单/ROI）+ 行级钻取（→ /channels?ch=渠道）。
 * Σ渠道 = 汇总 的可验证关系由 ChannelBreakdown 负责。
 */
export default function ChannelSection({
  channels,
  totalGmv,
  rangeLabel,
}: {
  channels: ChannelAggregate[];
  totalGmv: number;
  rangeLabel: string;
}) {
  const [sortKey, setSortKey] = useState<ChannelSortKey>("gmv");
  const router = useRouter();

  if (!channels.length) return null;

  const drillTo = (channel: string) => router.push(`/channels?ch=${encodeURIComponent(channel)}`);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <SectionHeading index="04" title="渠道分析" subtitle="各渠道 GMV / 订单 / ROI / 贡献占比" />
        <span className="inline-flex items-center gap-1 pb-1 text-[11px] text-muted-foreground">
          <Database className="h-3 w-3" />
          来源：OMS
        </span>
      </div>

      <ChannelBreakdown
        channels={channels}
        totalGmv={totalGmv}
        rangeLabel={rangeLabel}
        sortKey={sortKey}
        onSortChange={setSortKey}
        onDrillChannel={drillTo}
      />
    </section>
  );
}
