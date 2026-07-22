import DrillDownStub from "@/components/home/drill-down-stub";

/** 会员经营 Drill-Down 二级页（L2 指标：渠道会员数 / 渠道 LTV / 渠道复购等，后续迭代） */
export default function MembersPage() {
  return (
    <div className="min-h-screen">
      <DrillDownStub
        title="会员经营 · 明细分析"
        source="CRM · CDP"
        hint="L2 指标（渠道会员数 / 渠道 LTV / 渠道复购 / 分层画像）将在本页展开。"
      />
    </div>
  );
}
