import HomeClient from "@/components/home/home-client";

/**
 * 经营驾驶舱（/cockpit）—— 原 BI 驾驶舱首页（问询入口 + 7 节经营驾驶舱）。
 *
 * 首页已升级为 V2.0 工作台（/）；本路由保留旧驾驶舱，确保既有分析能力不丢失、
 * 历史链接仍可达。后续阶段驾驶舱将作为「项目内诊断视图」被复用。
 */
export default function CockpitPage() {
  return (
    <div className="min-h-screen">
      <HomeClient />
    </div>
  );
}
