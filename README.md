# AI Business Analyst · MVP

> 面向 **CEO / CRM 经理 / 运营经理** 的自然语言业务分析平台——提问即得摘要、KPI、洞察、风险与行动建议。

本仓库为 **Sprint 1** 交付物：Agent 工作流 MVP（规则引擎 + Mock 数据），UI 严格参照设计稿实现。

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Next.js 14（App Router）· TypeScript · TailwindCSS · shadcn 风格组件 · lucide-react |
| 后端 | Next.js API Routes（`/api/analyze`） |
| 数据 | Mock JSON（`sales.json` / `crm.json` / `channels.json`） |
| LLM | GLM 5.1（**预留接口**，Sprint 1 默认规则引擎，无需 Key） |

---

## 快速开始

```bash
npm install
npm run dev        # http://localhost:3000
# 或生产构建
npm run build && npm start
```

Sprint 1 **无需任何环境变量**。接入 GLM 时复制 `.env.local.example` → `.env.local` 并设 `ANALYST_AGENT_MODE=glm`（见下文「Agent 实现方案」）。

---

## 1. 项目结构

```
AI-Business-Analyst-MVP/
├── 01_~07_*.rtf|png|pdf          # 需求/设计原始资料（不动）
├── src/
│   ├── app/
│   │   ├── layout.tsx            # 根布局（中文、字体、标题）
│   │   ├── globals.css           # Tailwind + 主题变量（对齐设计稿配色）
│   │   ├── page.tsx              # 首页（服务端：组装 hero + KPI 仪表盘）
│   │   ├── report/page.tsx       # 分析报告页（读 searchParams → 交给 ReportView）
│   │   └── api/analyze/route.ts  # POST 接口：跑 Agent 工作流，返回 AnalysisResult
│   ├── components/
│   │   ├── ui/                   # shadcn 风格原语：button / card / badge / input
│   │   ├── icons.tsx             # string key → lucide 图标（数据层不存组件）
│   │   ├── top-nav.tsx           # 首页顶栏（智谱云分析 / 首页·驾驶舱·问答·数据源）
│   │   ├── home/                 # 首页：home-workspace（提问+视角+推荐卡）/ kpi-sidebar
│   │   └── report/               # 报告：header / summary / kpi-cards /
│   │                             #       findings / risk / recommendations / footer / report-view
│   └── lib/
│       ├── utils.ts              # cn / 数字·百分比格式化
│       ├── data/                 # V2 数据层：mock-data/01~08（90天）+ daily.ts + data-trust.ts
│       │       └── daily.ts      # 按 range(7/14/30) 窗口聚合 + 环比 + 日序列
│       ├── kb/metric-kb.ts       # 指标知识库（角色→指标 / 定义 / 归因规则 / 推荐行动）
│       └── agents/
│           ├── types.ts          # AnalysisResult 等共享类型
│           ├── role-agent.ts     # ① Role Agent
│           ├── intent-agent.ts   # ② Intent Agent
│           ├── metric-agent.ts   # ③ Metric Agent
│           ├── data-agent.ts     # ④ Data Agent
│           ├── insight-agent.ts  # ⑤ Insight Agent
│           ├── workflow.ts       #   编排 ①→⑤
│           └── llm-client.ts     #   GLM 5.1 客户端（预留，Sprint 1 未启用）
├── components.json / tailwind.config.ts / tsconfig.json / next.config.mjs
└── package.json
```

---

## 2. 页面结构

### 首页 `/`（对应 `05_homepage.png`）

```
顶栏：智谱云分析 │ 首页 驾驶舱 问答 数据源 │ EN 🔔 ⚙️ 头像
─────────────────────────────────────────────────────────
 左栏（主）                              │ 右栏
 下午好，思辰。                          │ KPI 仪表盘（昨日上线）
 今天想了解什么？  视角 [CEO ▾]          │ ┌ GMV      ¥4.28亿  +12.3% ▲
 ┌──────────────────────────────┐       │ │ 订单数    38,210   +6.1%  ▲
 │ 试试问问一些问题               │       │ │ 利润     ¥612万   -2.3%  ▼
 │ [对比 Q3 与 Q2 各渠道 GMV…]   │       │ │ 复购率   …        …
 │ ✨智能推荐 [近7天][按/自动]  [搜索]│      │ └
 └──────────────────────────────┘       │
 为 CEO 推荐              深度分析 →      │
 ┌────────────┐ ┌────────────┐          │
 │本周业务表现？│ │为什么GMV下降？│        │
 └────────────┘ └────────────┘          │
 ┌────────────┐ ┌────────────┐          │
 │各渠道表现？ │ │哪个渠道最好？│          │
 └────────────┘ └────────────┘          │
```
- 输入框回车 / 点「搜索」/ 点推荐卡 → 跳转 `/report?question=…&perspective=…`
- 视角下拉（CEO / CRM 经理 / 运营经理）会改变推荐区标题并随提问带入

### 分析报告页 `/report`（对应 PDF 三页）

服务端读 `searchParams`，客户端 `ReportView` 调 `/api/analyze`，骨架屏 → 渲染：

```
顶栏：← 返回      本周表现报告      重新生成 · 分分享 · 导出 PDF
┌──────────────── 报告文档（白卡）────────────────┐
│ · AI 业务分析师 · CEO 视角                       │
│ 本周业务表现如何？                               │
│ ─────────────────────────                       │
│ 本周整体表现 [高智能摘要]  AI生成·查准度96% ·45s  │
│ 〔摘要灰底段落〕                                │
│                                                  │
│ 第01节 KPI 驾驶舱 — 定义本周表现的四个核心指标    │
│ ┌ GMV ¥4.28亿 +12.3%▲ ┐ ┌ 订单数 38,210 +6.1%▲┐ │
│ └ 利润 ¥612万 -2.3%▼  ┘ └ 客单价 ¥112.04 +5.9%▲┘ │
│                                                  │
│ 第02节 关键发现 — 按业务影响排序                  │
│ 〔新品驱动增长 +¥770万 / 京东 +24% / 复购-8pp〕   │
│                                                  │
│ 第03节 风险提示 — 高/中/低风险卡（彩色左边框）     │
│ 〔利润率被压缩·高 / 库存风险·中 / CAC·低〕        │
│                                                  │
│ 第04节 行动建议 — 按预期收益与投入排序             │
│ 〔行动01 重新激活A级会员 / 行动02 / 行动03〕       │
│ ─────────────────────────                       │
│ ⭐ 基于 4 个数据源生成，执行前请核实。 👍有用 👎不够好│
└──────────────────────────────────────────────────┘
```

---

## 3. Agent 实现方案

工作流（`src/lib/agents/workflow.ts`）编排，全链路可解释、可单测：

```
提问 ─▶ Role Agent ─▶ Intent Agent ─▶ Metric Agent ─▶ Data Agent ─▶ Insight Agent ─▶ AnalysisResult
```

| Agent | 输入 | 输出 | Sprint 1 实现（规则引擎） |
| --- | --- | --- | --- |
| **① Role** | 提问 + 视角 | `CEO \| CRM_MANAGER \| OPERATION_MANAGER` | 显式视角优先；否则关键词命中；默认 CEO |
| **② Intent** | 提问 | `business_overview \| sales_analysis \| crm_analysis \| channel_analysis \| risk_analysis` | 关键词权重；「为什么…下降」→ 归属业务域 + 风险倾向 |
| **③ Metric** | 角色 + 意图 | 指标列表 | 角色→指标（`ROLE_METRICS`），意图做补充微调 |
| **④ Data** | 指标列表 | KPI（本期/上期/同比）+ 原始数据集 | 读 Mock JSON，计算环比 |
| **⑤ Insight** | 角色/意图/数据 | 摘要 + 发现 + 风险 + 建议 | 基于 `metric-kb` 归因规则 + 场景知识库生成 |

**为什么 Sprint 1 用规则引擎 + Mock：**
- 满足「先使用 Mock Data」，开箱即用、**无需 API Key**、可在演示/面试中即时跑通；
- 每个 Agent 是纯函数，边界清晰，便于单测与替换；
- 「本周经营概览」主场景产出与设计稿**逐字一致**；CRM/风险/渠道场景按规则派生。

**GLM 5.1 接入路径（已预留，零 UI 改动）：**
1. `src/lib/agents/llm-client.ts` 已实现智谱 BigModel 的 OpenAI 兼容调用（`chat()`，支持 `response_format: json`）。
2. 把 `ANALYST_AGENT_MODE` 切到 `glm`，在各 Agent 内部用同一份 `types.ts` 的输入/输出结构调用 GLM，**AnalysisResult 结构不变，前端零改动**。
3. 知识库（`metric-kb.ts`）作为 system prompt / few-shot 注入，保证 GLM 输出符合归因规则。

**可解释性**：`AnalysisResult.trace` 记录每步推理（role/intent/metrics/dataSources 的命中理由），调试或「展示推理过程」时可直接用。

---

## 4. 下一步 Sprint 计划（严格遵循 `04_Sprint_Backlog`）

| Sprint | 目标 | 关键任务 | 对应成功场景 |
| --- | --- | --- | --- |
| **Sprint 2** | 角色化体验 | CEO / CRM / 运营三套独立视图；同问题不同角色不同输出 | 场景 2（CRM 经理提问→会员分析/复购/LTV/流失） |
| **Sprint 3** | 业务仪表盘 | KPI 卡强化、趋势图表（接入每日明细）、洞察面板 | 仪表盘可视化 |
| **Sprint 4** | 根因分析 | **归因树**（Cause Tree）、风险深挖、推荐引擎升级 | 场景 3（为什么复购率下降→根因树） |
| **Sprint 5** | 高管报告 | 摘要报告、复制、分享、**导出 PDF** | 报告对外交付 |

> Sprint 1 已为后续埋好接口：`report` 页可按角色切换 KPI/洞察；`/report` 已具备「重新生成」；导出/分享按钮已占位（Sprint 5 启用）；根因树入口（关键发现「深入分析」）已留链接（Sprint 4 启用）。

**明确不做（Master Prompt 约束）：** Forecast Agent / PPT 导出 / 营销自动化 / 数据库集成。

---

## V1.1 · 时间范围分析（已交付）

支持「最近 7 / 14 / 30 天」切换，系统按选择范围聚合日数据，KPI、AI 分析、趋势图同步变化。

**数据升级**
- V2 数据层：`src/lib/data/mock-data/01~08`（90 天 8 数据集）；旧 30 天 `*_daily.json`（来源 `mock一个月数据V2/`）已移除。
- 新增 `src/lib/data/daily.ts`：`aggregateSales/aggregateChannels/aggregateCrm(range)` 取「最近 N 天」为当期、其前 N 天为上一期，计算环比。

**四处联动**（验收：切换时间范围后 KPI / 分析 / 图表自动变化）
1. **首页时间筛选器** —— 视角选择器右侧的 `RangeSwitcher`（默认 7 天）；右侧 KPI 仪表盘随 range **实时重算**。
2. **报告页时间范围** —— 摘要区 `RangeSwitcher`，切换即**重跑 Agent 工作流**（重新 fetch `/api/analyze?range=…`）。
3. **KPI 驾驶舱** —— GMV / Orders / Profit / AOV 由当期聚合得出，显示真实环比（↑/↓%）。
4. **GMV 日趋势图** —— 新增纯 SVG 折线图（`report/trend-chart.tsx`，零新依赖），点数 = range（7→7 点，30→30 点）。

**Agent 升级**
- **Data Agent**：按 `range` 聚合日数据，KPI 来自真实环比；返回当期日序列 `trend` 供图表。
- **Insight Agent**：改为**数据驱动**——摘要/发现/风险/建议从聚合结果推导（如「最近7天 GMV 环比 +8.8%，增长主要来自京东渠道」），随 range 变化。

**环比口径与边界**
- 7 / 14 天档：与上一周期对比，显示完整环比。
- 30 天档：数据窗口仅 30 天，无上一周期 → `hasComparison=false`，KPI 不显示环比、摘要改述累计值（界面有「当前范围无上一周期，未显示环比」提示）。默认 7 天不受影响。
- 暂不实现预测功能。

**验证（实测）**

| range | GMV | 环比 | 摘要要点 |
| --- | --- | --- | --- |
| 7 天 | ¥241万 | +8.8% | 整体积极，GMV 环比 +8.8% |
| 14 天 | ¥462万 | −1.9% | 整体承压，增长主要来自小红书渠道 +14.5% |
| 30 天 | ¥1000万 | — | 累计 GMV ¥1000万（无上一周期） |

