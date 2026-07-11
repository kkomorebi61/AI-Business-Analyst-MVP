"use client";

import { useState } from "react";
import type { Range } from "@/lib/data/daily";
import type { Role } from "@/lib/kb/metric-kb";
import HomeWorkspace from "./home-workspace";
import Dashboard from "./dashboard";
import CurrentDatasetBar from "../dataset/current-dataset-bar";

/**
 * 首页客户端根（IA V2）：持有视角 + 时间范围 + 问题输入状态。
 *
 * 布局：单栏 —— 顶部问询入口（HomeWorkspace）+ 下方 7 节业务驾驶舱（Dashboard）。
 * 视角 / Range 同时驱动问询跳转（/report）与首页驾驶舱数据（/api/dashboard）。
 * 原 KpiSidebar（4 KPI 侧栏）已由 Dashboard 的 §1 经营总览取代。
 */
export default function HomeClient() {
  const [perspective, setPerspective] = useState<Role>("CEO");
  const [range, setRange] = useState<Range>(7);
  const [question, setQuestion] = useState(
    "对比 Q3 与 Q2 各渠道 GMV 并解释差异原因",
  );

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      {/* 当前分析数据集（Dataset Visibility · 首页顶部固定） */}
      <div className="mb-6">
        <CurrentDatasetBar />
      </div>

      <HomeWorkspace
        perspective={perspective}
        range={range}
        question={question}
        onPerspective={setPerspective}
        onRange={setRange}
        onQuestion={setQuestion}
        onSubmit={() => {}}
      />

      <div className="mt-10 border-t border-border pt-8">
        <h2 className="mb-6 text-[17px] font-semibold">经营驾驶舱</h2>
        <Dashboard range={range} perspective={perspective} />
      </div>
    </main>
  );
}
