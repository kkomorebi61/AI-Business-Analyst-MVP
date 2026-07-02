"use client";

import { useState } from "react";
import type { Range } from "@/lib/data/daily";
import type { Role } from "@/lib/kb/metric-kb";
import HomeWorkspace from "./home-workspace";
import KpiSidebar from "./kpi-sidebar";

/** 首页客户端根：持有视角 + 时间范围 + 问题输入状态 */
export default function HomeClient() {
  const [perspective, setPerspective] = useState<Role>("CEO");
  const [range, setRange] = useState<Range>(7);
  const [question, setQuestion] = useState(
    "对比 Q3 与 Q2 各渠道 GMV 并解释差异原因",
  );

  return (
    <main className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_360px]">
      <HomeWorkspace
        perspective={perspective}
        range={range}
        question={question}
        onPerspective={setPerspective}
        onRange={setRange}
        onQuestion={setQuestion}
        onSubmit={() => {}}
      />
      <KpiSidebar range={range} />
    </main>
  );
}
