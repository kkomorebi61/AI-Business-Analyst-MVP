import TopNav from "@/components/top-nav";
import DrillDownStub from "@/components/home/drill-down-stub";

/** 渠道分析 Drill-Down 二级页（L2 指标：渠道转化率 / 退款率 / 趋势等，后续迭代） */
export default function ChannelsPage({
  searchParams,
}: {
  searchParams: { ch?: string };
}) {
  const ch = searchParams.ch;
  return (
    <div className="min-h-screen">
      <TopNav />
      <DrillDownStub
        title={ch ? `${ch} · 渠道明细分析` : "渠道分析 · 明细分析"}
        source="OMS"
        hint={
          ch
            ? `${ch} 渠道的 L2 指标（转化率 / 退款率 / 新客占比 / 日趋势）将在本页展开。`
            : "各渠道 L2 指标（转化率 / 退款率 / 新客占比 / 日趋势）将在本页展开。"
        }
      />
    </div>
  );
}
