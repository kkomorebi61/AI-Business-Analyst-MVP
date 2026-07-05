# AI Business Analyst · MVP

> 面向 **CEO / CRM 经理 / 运营经理** 的自然语言业务分析平台——提问即得摘要、KPI、洞察、风险与行动建议，且**每个结论都带数据依据与查询分级**。

本仓库为 MVP 完整交付物：Agent 工作流（规则引擎 + 90 天 Mock 数据）+ 数据可信层 + 查询治理引擎，UI 严格参照设计稿实现。

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Next.js 14（App Router）· TypeScript · TailwindCSS · shadcn 风格组件 · lucide-react |
| 图表 | **纯手写 SVG**（趋势折线图），不引入 recharts 等图表库 |
| 后端 | Next.js API Routes（`/api/analyze`、`/api/kpis`） |
| 数据 | CSV 单一事实源（`data/*.csv` 4 张事实表 · 03A Schema · 90 天；见「Phase 7 · CSV Metric Engine」） |
| 测试 | Vitest（**devDependency**，不进运行时） |
| LLM | GLM 5.1（**预留接口**，默认规则引擎，无需 Key） |

> 依赖克制：无 Radix 等 UI 原语库、无图表库；重数据聚合下沉服务端，不进客户端 bundle（见「Phase 5 · Bundle 优化」）。

---

## 快速开始

```bash
npm install
npm run dev        # http://localhost:3000
# 或生产构建
npm run build && npm start
npm test           # 运行 105 条 Vitest 单测（governance + 数据完整性 + SCRM 聚合）
```

MVP **无需任何环境变量**。接入 GLM 时复制 `.env.local.example` → `.env.local` 并设 `ANALYST_AGENT_MODE=glm`（见「Agent 实现方案」）。

---

## 交付阶段总览

| 阶段 | 主题 | 关键产出 |
| --- | --- | --- |
| Phase 1 | Agent 工作流 MVP | Role→Intent→Metric→Data→Insight 五段编排，首页 + 报告页 |
| V1.1 | 时间范围分析 | 7/14/30/90 天切换，90 天 Mock 数据层，纯 SVG 趋势图 |
| Phase 2 | 数据可信层（Data Trust） | Evidence Engine：每条结论挂 before/after/血缘/覆盖率 |
| Phase 3 | 数据可信中心（`/trust`） | 数据源注册表 / 时效 / 健康度 / 覆盖率 / 血缘可视化 |
| Phase 4 | 查询治理（Query Governance） | A/B/C 分级 + 覆盖率门 + 4 级响应 + 异常暂停 + 事件归因 |
| Phase 5 | 文档与 Bundle | README 同步 V2；KPI 聚合下沉 API，客户端瘦身 |
| Phase 6 | 指标可解释性 | `/metrics` 定义中心 + Detail Drawer + KPI 内联 Trust（V3 指标元数据 + Trust Score） |
| Phase 7 | CSV Metric Engine | 数据层统一到 `data/*.csv` 单一事实源；企微（SCRM）指标接入 |

---

## 1. 项目结构

```
AI-Business-Analyst-MVP/
├── 01_~07_*.rtf|png|pdf          # 需求/设计原始资料（不动）
├── src/
│   ├── app/
│   │   ├── layout.tsx / globals.css / page.tsx
│   │   ├── report/page.tsx       # 分析报告页（searchParams → ReportView）
│   │   ├── trust/page.tsx        # 数据可信中心（Phase 3）
│   │   ├── metrics/page.tsx      # 指标定义中心（Phase 6）
│   │   └── api/
│   │       ├── analyze/route.ts  # POST：跑 Agent 工作流 → AnalysisResult
│   │       └── kpis/route.ts     # GET：按 range 服务端聚合 → KPI（Phase 5，避免 JSON 进客户端）
│   ├── components/
│   │   ├── ui/                   # shadcn 风格原语：button / card / badge / input
│   │   ├── icons.tsx             # string key → lucide 图标
│   │   ├── top-nav.tsx           # 顶栏（首页 · 问答 · 数据源）
│   │   ├── home/                 # 首页：workspace（提问+视角+时间范围+推荐卡）/ kpi-sidebar / range-switcher
│   │   ├── metrics/              # 指标中心：metrics-center-client / metric-detail-drawer / metric-explain-link
│   │   └── report/               # 报告：header / summary / kpi-cards / findings /
│   │                             #       risk / recommendations / trend-chart(SVG) /
│   │                             #       query-banner(分级) / evidence-drawer / evidence-inline
│   └── lib/
│       ├── utils.ts              # cn / 数字·百分比格式化
│       ├── data/
│       │   ├── csv-engine.ts     # [P7] CSV Metric Engine：data/*.csv → SQL 式聚合（服务端专用，禁客户端引用）
│       │   ├── daily.ts          # [P7] client-safe：Range/RANGES/rangeLabel（聚合已下沉 csv-engine）
│       │   ├── data-trust.ts     # 数据源注册表（07）→ 覆盖率/健康度/血缘 + 指标 Trust Score
│       │   ├── mock-data/07_data_sources.json  # 仅剩 Data Trust 注册表元数据（事实数据已迁 CSV）
│       │   └── __tests__/        # data-integrity + csv-engine-scrm（口径回归）
│       ├── kb/metric-kb.ts       # [P6/P7] 指标知识库 V3：18 指标（含 6 个 SCRM）企业级元数据 + ROLE/搜索
│       ├── governance/           # Phase 4：查询治理引擎（纯函数 + 单测）
│       │   ├── classify.ts       #   A/B/C 分级 + 必需源齐全度
│       │   ├── coverage.ts       #   覆盖率评估（High≥80 / Medium 50–<80 / Low<50）
│       │   ├── risk.ts           #   响应策略决策（direct/partial/refuse/suspend）
│       │   ├── anomaly.ts        #   异常检测（量级 5× + 率类 ≥20pp）
│       │   ├── events.ts         #   业务事件归因（[P7] 读 business_events.csv）
│       │   └── index.ts          #   buildVerdict / applyStrategy / enrichInsight
│       └── agents/
│           ├── types.ts          # AnalysisResult / Evidence / GovernanceVerdict 等共享类型
│           ├── role / intent / metric / data / insight-agent.ts   # ①~⑤
│           ├── evidence-engine.ts #  Evidence Engine（Phase 2）
│           ├── workflow.ts       #   编排 + 接入 governance（Phase 4）
│           └── llm-client.ts     #   GLM 5.1 客户端（预留，未启用）
├── components.json / tailwind.config.ts / tsconfig.json / next.config.mjs / vitest.config.ts
└── package.json
```

---

## 2. 页面结构

### 首页 `/`（对应 `05_homepage.png`）

```
顶栏：智谱云分析 │ 首页  问答  数据源 │ EN 🔔 ⚙️ 头像
─────────────────────────────────────────────────────────
 左栏（主）                              │ 右栏
 下午好，思辰。                          │ KPI 仪表盘（最近7天）
 今天想了解什么？  视角 [CEO ▾] [最近7天▾]│ ┌ GMV      ¥99万   +8.5% ▲
 ┌──────────────────────────────┐       │ │ 订单数    3,991   +3.3% ▲
 │ 试试问问一些问题   [搜索]       │       │ │ 客单价    ¥248    +5.1% ▲
 └──────────────────────────────┘       │ │ 转化率    4.0%    +0.3pp ▲
 为 CEO 推荐              深度分析 →     │ └
 [本周业务表现如何？][为什么GMV下降？]    │ （KPI 走 /api/kpis，切换范围实时重算）
 [各渠道表现如何？]  [哪个渠道最好？]     │
```
- 输入框回车 / 点「搜索」/ 点推荐卡 → 跳转 `/report?question=…&perspective=…&range=…`
- 视角下拉（CEO / CRM 经理 / 运营经理）改变推荐区标题并随提问带入
- 时间范围（7/14/30/90 天）切换：右侧 KPI 经 `/api/kpis` 实时重算

### 分析报告页 `/report`（对应 PDF 三页）

客户端 `ReportView` 调 `/api/analyze`，骨架屏 → 渲染：

```
顶栏：← 返回      本周表现报告      重新生成 · 分享 · 导出 PDF
┌──────────────── 报告文档（白卡）────────────────┐
│ · AI 业务分析师 · CEO 视角       时间范围 [最近7天▾]│
│ 本周业务表现如何？                               │
│ ─ 查询分级横幅（直答 / 部分回答 / 暂不支持 / 数据异常）│
│ ─ 摘要灰底段落                    AI生成·查准度96%·45s│
│ 第01节 KPI 驾驶舱（GMV/订单/客单价/转化率/ROI）   │
│ 第02节 关键发现 — 每条带「查看依据」(Evidence+血缘+根因)│
│ 第03节 风险提示 — 高/中/低风险卡（彩色左边框）     │
│ 第04节 行动建议 — 按预期收益与投入排序             │
│ ⭐ 基于 4 个数据源生成，执行前请核实。           │
└──────────────────────────────────────────────────┘
```
- 点「查看依据」打开 Evidence 抽屉：before→after 变化、引用源系统、覆盖率、健康度、数据血缘、业务事件根因
- 分级为「拒答 / 暂停」时，正文隐藏，仅留横幅与（暂停时）KPI 仪表盘

### 数据可信中心 `/trust`（Phase 3）

汇总卡（数据源数 / 平均覆盖率 / 健康源 / 异常延迟源）+ 数据源状态卡（覆盖率进度条、健康度、时效徽标）+ 核心指标的数据血缘与定义（公式 / 负责人 / 更新频率 / 归因规则）。数据来自 `07_data_sources` 注册表。

---

## 3. Agent 实现方案

工作流（`src/lib/agents/workflow.ts`）编排，全链路可解释、可单测：

```
提问 ─▶ Role ─▶ Intent ─▶ Metric ─▶ Data ─▶ Insight
                                        │        │
                                        └──▶ 【查询治理门】◀──┘
                                  classify → anomaly → coverage → verdict → applyStrategy
```

| Agent | 输入 | 输出 | 实现（规则引擎） |
| --- | --- | --- | --- |
| **① Role** | 提问 + 视角 | `CEO \| CRM_MANAGER \| OPERATION_MANAGER` | 显式视角优先；否则关键词命中；默认 CEO |
| **② Intent** | 提问 | 业务域 + 风险倾向 | 关键词权重；「为什么…下降」→ 归属业务域 + 风险倾向 |
| **③ Metric** | 角色 + 意图 | 指标列表 | 角色→指标，意图做补充微调 |
| **④ Data** | 指标 + range | KPI（本期/上期/环比）+ 日序列 + 各域聚合 | 读 90 天 Mock，按 range 窗口聚合 |
| **⑤ Insight** | 角色/意图/数据 | 摘要 + 发现 + 风险 + 建议 | 数据驱动，从聚合结果推导（随 range 变化） |

**GLM 5.1 接入路径（已预留，零 UI 改动）：** `llm-client.ts` 已实现智谱 BigModel 的 OpenAI 兼容调用；把 `ANALYST_AGENT_MODE` 切到 `glm`，在各 Agent 内用同一份 `types.ts` 结构调用，`AnalysisResult` 结构不变。知识库（`metric-kb.ts`）作为 system prompt / few-shot 注入。

**可解释性**：`AnalysisResult.trace` 记录每步推理命中理由；`governance.reasons` 记录分级判定链。

---

## 4. 数据可信层（Phase 2 · Data Trust）

每条 Finding / Risk 都挂 `evidence`（数据依据）、`lineage`（数据血缘）、`rootCause`（业务事件根因）：

- **Evidence Engine**（`evidence-engine.ts`）：从聚合结果推导每个指标的 `before → after → change`（区分相对 % / 百分点 / 绝对值），附引用源系统、覆盖率、健康度、最晚更新时间。
- **数据源注册表**（`data-trust.ts` ← `07_data_sources.json`）：OMS / CRM / CDP / Marketing Platform 等源的覆盖率、健康度（Healthy/Warning/Delayed/Error）、时效。
- **指标知识库**（`metric-kb.ts`）：每个指标的定义 / 公式 / 业务含义 / 负责人 / 更新频率 / 归因规则 / 数据血缘链路。

---

## 5. 查询治理（Phase 4 · Query Governance）

来源：`11_Query_Governance`（分级 / 覆盖率 / 风险 / 响应 / 异常）+ `10_Data_Trust`。引擎位于 `src/lib/governance/`，**纯函数 + 单测守护**，`insight-agent.ts` 与 `api/analyze/route.ts` 全程未改。

**查询分级（A/B/C）**
- **A 直答**：指标在库 + 必需源齐全 → 完整摘要/发现/风险/建议
- **B 部分回答**：缺源或成本源未接入（如利润）→ 摘要前置「部分回答」提示，正文照常
- **C 暂不支持**：指标不在库 → 仅留横幅，正文隐藏

**覆盖率门（阈值 verbatim）**：High ≥ 80 / Medium 50–<80 / Low < 50。覆盖率按**实际引用源**计算。

**4 级响应策略**（按降级层实现，非缓存）：`direct`（直答）→ `partial`（部分）→ `refuse`（拒答）→ `suspend`（数据异常暂停）。异常检测：量级 ≥ 5× 且率类另需 ≥ 20pp。

**业务事件归因**（[Phase 7] 读 `business_events.csv`，由 `event_type` 派生 `impact_metrics`）：将周期内命中的业务事件（618 预热 / 新品上市 / 企微触达下降等）挂为 Finding/Risk 的根因。

**开发态演示开关**——Mock 全 High、波动小（≤1.12×），异常/Medium/Low 无法被真实问题触发；提问含以下关键词可强制注入对应裁决，便于浏览器演示全部横幅：`演示数据异常`(→suspend) / `演示低覆盖`(→refuse) / `演示中等覆盖`(→partial)。

---

## 6. 时间范围与环比口径（V1.1）

支持「最近 7 / 14 / 30 / 90 天」切换，系统按窗口聚合 90 天日数据：取末 N 天为当期、其前 N 天为上一期计算环比。KPI、AI 分析、趋势图同步变化。

- **7 / 14 / 30 天档**：90 天数据内有上一期，显示完整环比（`hasComparison=true`）。
- **90 天档**：无上一周期 → `hasComparison=false`，KPI 不显示环比，摘要改述累计值。
- 四处联动：首页 RangeSwitcher + KPI 仪表盘（`/api/kpis`）、报告页 RangeSwitcher（重跑 `/api/analyze`）、KPI 驾驶舱、GMV 日趋势图（点数 = range）。

**验证（实测 · CSV 单一事实源，CEO 视角，提问「本周业务表现如何？」）**

| range | GMV | 环比 | 摘要要点 | 命中事件 |
| --- | --- | --- | --- | --- |
| 7 天 | ¥116万 | −25.1% | 整体承压，各渠道分化、高价值会员复购走弱 0.2pp | — |
| 14 天 | ¥271万 | +32.9% | 增长主要来自小红书 +34.6%；复购走弱 4.3pp | 618大促 |
| 30 天 | ¥500万 | +46.1% | 增长主要来自小程序 +48.6% | 新品上市、618大促 |
| 90 天 | ¥1168万 | —（无上一期） | 累计口径：订单 58,854 / 客单价 ¥198 / 转化率 4.2% | 618预热、新品上市、618大促 |

> 暂不实现预测功能。数据集固定种子可复现（`scripts/gen_csv_mock_data.py`）。

---

## 7. Phase 5 · Bundle 优化

**问题**：`daily.ts` 顶层静态 `import` 了 4 个 90 天 Mock JSON（经营/会员/营销/渠道，合计 ~111KB，渠道表 64KB）。首页 `KpiSidebar` 原为客户端组件直接调用 `dataAgent` 聚合，导致这 4 份数据被打进客户端 bundle（首页 First Load 多出 ~29KB gzip，专属数据 chunk 达 81KB）——仅为渲染 4 个 KPI 卡。

**方案**：新增 `GET /api/kpis?range=N`，服务端跑 `dataAgent` 聚合并只回传 `{ kpis, rangeLabel }`（~400B）。`KpiSidebar` 改为客户端 fetch + 骨架屏。重数据从此留在服务端，客户端 chunk 中再也搜不到渠道/营销/会员数据。

**效果（`next build` 实测）**：

| 路由 | First Load JS（前 → 后） |
| --- | --- |
| `/`（首页） | 122 kB → **109 kB**（−13 kB） |
| `/report`（报告） | 117 kB → **106 kB**（−11 kB） |

> 注：上表为 Phase 5（JSON mock 时期）实测。Phase 6 指标元数据进客户端抽屉后 First Load 各 +~7 kB gzip；Phase 7 的 CSV Metric Engine 为服务端专用（顶部 `import fs`），不进客户端 bundle。

---

## 8. Phase 6 · 指标可解释性（Explainability）

目标：每个核心指标具备企业级可解释性（对齐 `02A_Business_Metric_Dictionary`）。来源：`02_Metric_KB` + `02A` + `10_Data_Trust` + `11_Query_Governance`。

- **指标知识库 V3**（`metric-kb.ts`）：18 个指标（12 核心 + 6 SCRM）补齐企业级元数据 —— `metric_name / definition / business_meaning / formula / included_scope / excluded_scope / time_window / data_source / source_keys / owner / update_frequency / related_metrics / aliases / example / breakdown / lineage`；附 `ROLE_METRICS / ALL_METRICS / searchMetrics / resolveMetricKey`。
- **指标 Trust Score**（`data-trust.ts`）：`metricTrustInfo(key)` 按 doc 10 §10 公式 —— `Trust Score = Coverage×40% + Freshness×30% + Health×20% + Completeness×10%`，分级 High ≥90 / Medium 75–89 / Low 60–74 / Caution <60。`dataAgent` 一处注入 → `/api/kpis` 与 `/api/analyze` 的 KPI 同时带 `trust`。
- **`/metrics` 指标定义中心**：搜索 + 角色过滤 + 指标卡网格；`MetricDetailDrawer`（点 KPI 弹：定义 / 公式 / Include / Exclude / 更新频率 + 血缘 + Trust）；`MetricExplainLink`（Insight「该指标如何计算」入口）。
- **KPI 内联 Trust**：首页侧边栏与报告 KPI 卡均内联「来源 / 覆盖率 / 健康 / 更新」，点击进 Detail Drawer。

---

## 9. Phase 7 · CSV Metric Engine（单一事实源）

目标：数据层统一到 **CSV 单一事实源**，结果指标（GMV / ROI / LTV / 复购率…）一律不落盘、由引擎按 SQL 聚合得到。来源：`03A_Daily_Fact_Table_Schema` + `03B` 生成规则。

- **四张事实表**（`data/*.csv`，03A Schema，固定种子可复现）：
  - `daily_channel_metrics.csv` — 渠道经营（90 天 × 6 渠道 = 540 行）
  - `daily_member_metrics.csv` — 会员运营（90 行）
  - `daily_scrm_metrics.csv` — 企微运营（90 行）
  - `business_events.csv` — 经营事件（6 行，供根因归因）
- **CSV Metric Engine**（`csv-engine.ts`，服务端专用）：自带 RFC-4180 解析；启动时一次性载入并缓存；`aggregateSales / aggregateChannels / aggregateCrm / aggregateMarketing / aggregateScrm` 每函数标注等价 SQL。**Rule 1/2 天然成立** —— GMV 仅存于渠道表，总 GMV/订单 = Σ 渠道值，无需对账。
- **数据层重构**：`daily.ts` 瘦身为 client-safe（仅 Range 工具，不含 `fs` —— 因客户端组件 import `RANGES`）；`dataAgent / evidence / insight` 改 import `csv-engine`（无感迁移）；`events.ts` 归因改读 `business_events.csv`（`event_type` 派生 `impact_metrics`）。删除 `mock-data/01~06 + 08` JSON（共 7 个），仅留 `07_data_sources.json`（Data Trust 注册表元数据）。
- **SCRM 接入**（归档「未完成 #1」，已交付）：`aggregateScrm` 暴露 6 个企微指标 —— 触达率（`Σreached/Σfriends`）、回复率（`Σreply/Σreached`）、企微成交率（`Σconverted/Σreached`）、发券核销率（`Σused/Σsent`）、企微好友总数（窗口末行存量）、新增好友（`Σnew`）；归入 `CRM_MANAGER`，CRM 视角报告页自动展示。Trust 由已注册的 `Enterprise WeChat` 源自动算出（coverage 76 / Delayed / Low，演示企微数据时效偏弱）。

**数据集关键量级**（经 `scripts/validate_csv_mock_data.py` 校验）：总 GMV ¥11,676,538 · 总订单 58,854 · 整体 AOV ¥198 · 转化率 4.23% · 退款率 3.45% · ROI 日级 4.15~4.30 · 会员 12,024→16,679（+38.71%）· 企微好友 18,096→28,069（+55.11%）。6 事件指纹可归因：618预热 +15% / 缺货 −20% / VIP复购 +10% / 企微触达 −30% / 新品 +10% / 618大促 +50%。

---

## 10. 明确不做（Master Prompt 约束）

Forecast Agent / PPT 导出 / 营销自动化 / 数据库集成；GLM 模型路由兜底（GLM 未启用，rule 模式）。导出 PDF、分享按钮为 UI 占位。
