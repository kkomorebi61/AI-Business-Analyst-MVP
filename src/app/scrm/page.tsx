import TopNav from "@/components/top-nav";
import DrillDownStub from "@/components/home/drill-down-stub";

/** 私域经营 Drill-Down 二级页（L2 指标：分群触达 / 单聊回复 / 内容核销等，后续迭代） */
export default function ScrmPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <DrillDownStub
        title="私域经营 · 明细分析"
        source="Enterprise WeChat"
        hint="L2 指标（分群触达 / 单聊回复 / 内容互动 / 优惠券核销明细）将在本页展开。"
      />
    </div>
  );
}
