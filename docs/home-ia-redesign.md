# 智谱云分析 · 首页信息架构（IA）改版方案

| 项 | 值 |
|---|---|
| 版本 | V1.0 |
| 日期 | 2026-07-05 |
| 范围 | **仅首页（`/`）信息架构**，不开发新功能、不重构 Agent、不改数据模型 |
| 依据 | `02A_Business_Metric_Dictionary` · `10_Data_Trust_Layer` · `11_Query_Governance` · `01_Agent_Flow`（替代缺失的 `00_System_Overview`） |
| 交付物 | ① 页面改版方案 ② 新页面结构图 ③ 组件调整说明 ④ 变更清单 ⑤ 实现方案 |

---

## 0. 背景与范围

### 0.1 现状
首页（`/`）= `HomeWorkspace`（左：问候 + 视角/Range + 提问框 + 4 个推荐问题卡）+ `KpiSidebar`（右：4 个固定 KPI「GMV / 订单 / 客单价 / 转化率」）。组织轴是**按功能**（提问 / 推荐 / KPI），且指标维度单一、渠道不在首页、源系统不显式。

### 0.2 目标
把首页从「**先问再看**」改为「**打开即得经营全貌，按需深问 / 钻取**」，按**业务主题**（非源系统）组织为 7 节驾驶舱，仅展示 L1 指标，复杂指标下沉 Drill-Down。贴合 CEO / CRM 经理 / 运营负责人的经营分析习惯，减少信息噪音、增强决策导向。

### 0.3 关键事实（已核查代码，决定本方案是「纯 IA」）
1. **数据层零缺口**：`csv-engine.ts` 现有 `aggregateSales / aggregateCrm / aggregateScrm / aggregateChannels` 已覆盖 7 节所需的**全部 L1 指标**——本次不碰数据层与 Agent。
2. **Trust/Evidence 已就绪**：`metricTrustInfo` + `buildMetricEvidence` + `MetricDetailDrawer` + `EvidenceDrawer` 已满足 10 号文档「Trust Score / Source / Coverage / Health / Updated / Evidence」全要素，直接复用。

### 0.4 既定决策（默认假设，已采纳）
- **D1**：首页**保留自然语言问询入口**，降级为顶部紧凑提问条；主视觉让位给 7 节驾驶舱。提问 → 仍跳 `/report` 深度归因。
- **D2**：首页 §5/§6/§7（发现 / 风险 / 建议）来自**默认「经营概览」分析**（用当前视角 + Range 跑一次 overview 工作流），复用 `runWorkflow`，不新增 Agent。
- **D3**：3 角色都看**全部 7 节**（"减少噪音"靠 L1-only + 主题分组，不靠藏节）；角色决定**默认聚焦节**与概览洞察口径。
- **D4**：Drill-Down 二级页（`/members`、`/scrm`、`/channels`）本期**仅建路由占位 + 埋入口**，L2 内容后续迭代。

---

## ① 页面改版方案

### 1.1 设计原则
| 原则 | 落地 |
|---|---|
| **业务主题 > 源系统** | 分节按「经营 / 会员 / 私域 / 渠道」；**不**以 CRM / OMS / Enterprise WeChat 作分节标题；源系统只作每指标 Trust 行内元数据。 |
| **首页仅 L1 指标** | 每节 4–6 个核心指标；转化率 / 退款率 / 渠道会员数 / 渠道 LTV / 渠道复购等下沉 Drill-Down。 |
| **Trust/Evidence 不降级** | 每个 L1 指标卡保留 Trust Score 徽标 + Source + Coverage + Health + Updated；定义入口 → `MetricDetailDrawer`；证据入口 → `EvidenceDrawer`（对齐 10 §12、11 §12）。 |
| **角色适配** | CEO 聚焦 §1+§4+§5；CRM 聚焦 §2+§3；运营聚焦 §1+§4。切换视角不改节清单，改「聚焦高亮 + 概览洞察口径」。 |
| **决策导向** | §4 渠道支持排序 / 钻取；§5–§7 直接给「结论 → 证据 → 影响 → 建议」（11 §12 响应结构）。 |

### 1.2 核心转变
```
现状：问询工作台（左 1fr）  +  4 项 KPI 侧栏（右 360px）
目标：顶部提问条  +  7 节业务驾驶舱（单列 max-w 1100px）  +  TopNav 旁角色/Range 控件
```

### 1.3 信息架构对比
| 维度 | 现状 | 目标 |
|---|---|---|
| 组织轴 | 按功能（提问 / 推荐 / 4 KPI） | **按业务主题**（经营 / 会员 / 私域 / 渠道 / 洞察 / 风险 / 建议） |
| 首屏指标 | 4 | 22 个 L1 分 4 主题节 |
| 渠道 | 不在首页 | 首页 §4，6 渠道 × 4 维，可排序钻取 |
| 源系统 | 不显式 | 每指标 Trust 行内标注（OMS / CRM+CDP / Enterprise WeChat / Marketing） |
| 深度分析 | 必须先提问 | 默认概览洞察 + 提问深问 + Drill-Down 三条路径 |

---

## ② 新页面结构图

### 2.1 首页 Wireframe
```
┌──────────────────────────────────────────────────────────────────────┐
│  TopNav  智谱云分析       指标中心  数据可信度           [视角▼ CEO] [7天▼]│
├──────────────────────────────────────────────────────────────────────┤
│  下午好，思辰。今天想了解什么？                                        │
│  ┌──────────────────────────────────────────────────┐                │
│  │  🔍 输入经营分析问题…                       [搜索] │                │
│  └──────────────────────────────────────────────────┘                │
│  快捷: [本周表现] [各渠道] [复购为何降] [哪个渠道最好]                  │
├──────────────────────────────────────────────────────────────────────┤
│ §1 经营总览  Business Overview          来源: OMS · Marketing         │
│  ┌────────┐┌────────┐┌────────┐┌────────┐                            │
│  │ GMV    ││ 订单数 ││ 客单价 ││ ROI    │  每卡: 值/环比/Trust/定义/证据│
│  └────────┘└────────┘└────────┘└────────┘                            │
├──────────────────────────────────────────────────────────────────────┤
│ §2 会员经营  Membership Health         来源: CRM · CDP      查看全部 → │
│  [新增会员][活跃会员][复购率][LTV][流失率][VIP会员]   → Drill-Down /members│
├──────────────────────────────────────────────────────────────────────┤
│ §3 私域经营  SCRM Performance          来源: Enterprise WeChat 查看→  │
│  [企微好友][新增好友][触达率][回复率][成交率][核销率]  → Drill-Down /scrm│
├──────────────────────────────────────────────────────────────────────┤
│ §4 渠道分析  Channel Performance       [按 GMV ▼ 排序]                │
│  渠道    GMV        订单    ROI    贡献占比    [钻取]                  │
│  私域    ¥347,069   1,795   4.5    29.9%       → /channels?ch=私域     │
│  天猫    ¥291,897   1,513   …      25.2%                                │
│  …（6 渠道，可排序，行级钻取）          Σ渠道 = 汇总 ✓                  │
├──────────────────────────────────────────────────────────────────────┤
│ §5 关键发现  Insights   §6 风险提示  Risks   §7 行动建议  Recs          │
│ （默认概览洞察；每条 Finding→Evidence→Impact，复用现有组件）            │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 各节指标—数据源映射（对齐 02A 字典）
| 节 | L1 指标（metric key） | 数据源（Trust 行） | 现有聚合函数 |
|---|---|---|---|
| §1 经营总览 | `gmv` `orders` `aov` `roi` | OMS；ROI = Marketing+OMS | `aggregateSales` + `aggregateMarketing` |
| §2 会员经营 | `newMembers` `activeMembers` `repurchaseRate` `ltv` `churnRate` `vipMembers` | CRM+CDP（LTV/复购含 OMS） | `aggregateCrm` |
| §3 私域经营 | `totalFriends` `newFriends` `reachRate` `replyRate` `scrmConversion` `couponRedemption` | Enterprise WeChat | `aggregateScrm` |
| §4 渠道分析 | 6 渠道 × {`gmv`,`orders`,`roi`,占比} | OMS | `aggregateChannels` |
| §5/§6/§7 | findings / risks / recommendations | 多源（按指标） | `runWorkflow(overview)` 复用 |

**下沉到 Drill-Down 的 L2 指标**（首页不出现）：`conversion`、`refundRate`、渠道级会员数 / LTV / 复购、退款金额、营销成本明细。

---

## ③ 组件调整说明

### 3.1 复用（零改动）
`SectionHeading` · `RangeSwitcher` · `MetricDetailDrawer` · `EvidenceDrawer` · `EvidenceInline` · `MetricExplainLink` · `FindingsSection` · `RiskSection` · `RecommendationsSection` · `SummarySection` · `TrendChart` · `ChannelBreakdown`（§4 直接用）

### 3.2 改造
| 组件 | 改动 |
|---|---|
| `home/home-client.tsx` | 由「2 栏 workspace+sidebar」改为「单栏 dashboard + 顶部提问条」；视角/Range 上提到 TopNav 旁 |
| `home/home-workspace.tsx` | 瘦身为 `QuestionBar`：保留提问框 + 角色化快捷 chips；移除大 Hero 推荐卡 |
| `home/kpi-sidebar.tsx` | **退役**为独立侧栏；其 KPI 卡 + Trust 行能力**抽取为通用 `<MetricCard>`**，供 §1/§2/§3 复用 |

### 3.3 新增
| 组件 / 文件 | 职责 |
|---|---|
| `home/dashboard.tsx` | 首页主容器：拉 `/api/dashboard`，按序渲染 §1–§7 |
| `home/sections/metric-section.tsx` | 通用主题节壳：`<SectionHeading>` + 指标卡网格 + Drill-Down 链接（§1/§2/§3 复用） |
| `home/sections/channel-section.tsx` | §4：包 `ChannelBreakdown` + 排序控件 + 行级钻取 |
| `home/sections/insight-section.tsx` | §5/§6/§7：包现有 Findings/Risk/Recommendations |
| `home/metric-card.tsx` | 通用 L1 指标卡（值/环比/Trust/定义/证据）——由 kpi-sidebar 抽取 |
| `app/api/dashboard/route.ts` | **唯一新接口**：一次返回 7 节全部 L1 数据 |
| `app/(members\|scrm\|channels)/page.tsx` | Drill-Down 二级页占位 |

### 3.4 `<MetricCard>` 规格（抽取自 kpi-sidebar）
```
┌─────────────────────────────┐
│ 📊 GMV          ℹ️定义  🔗证据 │  ← 图标 + 名称 + 定义入口 + 证据入口
│ ¥116万                       │  ← 当前值（headline 万级）
│ ▲ +12.4%                     │  ← 环比（↑绿 ↓红）
│ 🛡 OMS · 覆盖95% · ●Healthy · 更新 07-05  │  ← Trust 行（10 §12）
└─────────────────────────────┘
点击卡身 → MetricDetailDrawer；点击 🔗 → EvidenceDrawer
```

---

## ④ 变更清单（Change Log）

| 类型 | 路径 | 说明 |
|---|---|---|
| ✨ 新增 | `src/app/api/dashboard/route.ts` | 7 节聚合接口（复用 dataAgent + overview） |
| ✨ 新增 | `src/components/home/dashboard.tsx` | 首页驾驶舱主容器 |
| ✨ 新增 | `src/components/home/sections/metric-section.tsx` | §1/§2/§3 通用主题节 |
| ✨ 新增 | `src/components/home/sections/channel-section.tsx` | §4 渠道节（排序+钻取） |
| ✨ 新增 | `src/components/home/sections/insight-section.tsx` | §5/§6/§7 洞察节 |
| ✨ 新增 | `src/components/home/metric-card.tsx` | 通用 L1 指标卡 |
| ✨ 新增 | `src/app/members/page.tsx` `app/scrm/page.tsx` `app/channels/page.tsx` | Drill-Down 占位页 |
| 🔧 改造 | `src/components/home/home-client.tsx` | 布局重构为单栏 dashboard |
| 🔧 改造 | `src/components/home/home-workspace.tsx` | 瘦身为 QuestionBar |
| 🔧 改造 | `src/components/home/kpi-sidebar.tsx` | 抽取 MetricCard 后退役 |
| ♻️ 复用 | `csv-engine.ts` `data-agent.ts` `insight-agent.ts` `workflow.ts` | **零改动** |
| ♻️ 复用 | `report/*` 渠道 / 发现 / 风险 / 建议组件 | 首页直接复用 |
| 🚫 不动 | Agent 流水线、数据模型、CSV 事实表、查询治理、Trust 引擎 | 符合"非功能 / 非重构"约束 |

---

## ⑤ 实现方案

### 5.1 数据接口 `GET /api/dashboard?range=N&perspective=ROLE`
**唯一新增后端点**，一次返回 7 节全部 L1 数据：
```ts
import { dataAgent } from "@/lib/agents/data-agent";
import { runWorkflow } from "@/lib/agents/workflow";

export async function GET(req: Request) {
  const range = /* 7|30|90 */;
  const perspective = /* CEO|CRM_MANAGER|OPERATION_MANAGER */;

  // 一次取齐 4 主题域全部 L1 指标（dataAgent 已支持任意 metric key 组合并附 Trust）
  const all = dataAgent([
    "gmv","orders","aov","roi",                          // §1
    "newMembers","activeMembers","repurchaseRate","ltv","churnRate","vipMembers", // §2
    "totalFriends","newFriends","reachRate","replyRate","scrmConversion","couponRedemption", // §3
  ], range);

  // 默认概览洞察（§5/§6/§7）——复用现成 overview 工作流
  const overview = runWorkflow({ question: "本周业务表现如何？", perspective, range });

  return NextResponse.json({
    range, rangeLabel: all.rangeLabel, perspective,
    sections: {
      overview:   { kpis: pick(all.kpis, ["gmv","orders","aov","roi"]), source: "OMS · Marketing" },
      membership: { kpis: pick(all.kpis, [...§2]), source: "CRM · CDP", drillTo: "/members" },
      scrm:       { kpis: pick(all.kpis, [...§3]), source: "Enterprise WeChat", drillTo: "/scrm" },
      channels:   { rows: all.channels, totalGmv: all.sales.current.gmv }, // §4 含 Σ=汇总
    },
    insights: { summary: overview.summary, findings: overview.findings,
                risks: overview.risks, recommendations: overview.recommendations },
  });
}
```
要点：**无新计算**——`dataAgent` 已按 key 取数并附 Trust；`runWorkflow(overview)` 已产 findings/risks/recommendations。沿用 `/api/kpis` 的 bundle 友好模式（重数据留服务端）。

### 5.2 页面层结构
```
page.tsx (不动)
 └─ HomeClient (重构: 单栏)
     ├─ QuestionBar (原 home-workspace 瘦身)
     └─ <Dashboard> (新; useEffect fetch /api/dashboard)
         ├─ <MetricSection §1 overview>
         ├─ <MetricSection §2 membership drillTo=/members>
         ├─ <MetricSection §3 scrm       drillTo=/scrm>
         ├─ <ChannelSection §4>   (复用 ChannelBreakdown + 排序 + 钻取)
         └─ <InsightSection §5/§6/§7> (复用 Findings/Risk/Recommendations)
     + MetricDetailDrawer / EvidenceDrawer 挂最外层，全局复用
```

### 5.3 角色适配（轻量）
- 视角切换在 TopNav 旁（已有 `PERSPECTIVES`）。
- 视角 → `defaultFocus`：CEO=`§1`、CRM=`§2`、运营=`§4`；dashboard 滚动 / 高亮该节。
- 默认概览洞察口径随视角变（`runWorkflow` 已吃 `perspective`）。
- **不改节清单**——3 角色都看 7 节，避免"角色 = 藏信息"。

### 5.4 Drill-Down（本期占位 + 入口）
- §2 / §3 标题右侧"查看全部 →"链接 `/members`、`/scrm`。
- §4 渠道行尾"钻取"链接 `/channels?ch=私域`。
- 三个二级页本期占位（标题 + "建设中" + 返回首页 / 去 `/report` 深问），L2 指标后续填充。

### 5.5 实施步骤（4 步，可独立验证）
1. **接口**：建 `/api/dashboard`；curl 验证 7 节数据齐、Trust 齐、§4 Σ=汇总 ✓。
2. **MetricCard 抽取**：从 `kpi-sidebar` 抽出通用卡；手测 4 指标 + Trust + 定义 / 证据抽屉。
3. **4 个 Section 组件**：MetricSection / ChannelSection / InsightSection 逐节接入。
4. **HomeClient 重构 + 角色聚焦 + Drill-Down 占位**：替换布局并回归。

### 5.6 验收与回归
- `vitest`：新增 `/api/dashboard` 契约测试（7 节字段齐、§4 Σ=汇总、perspective 生效）；现有 118 测试不受影响（数据层零改）。
- `tsc --noEmit` 零错误；`next build` 9 → 12 路由（+3 占位页）。
- 实跑：`/` 切视角 / Range，7 节实时变；§4 排序 / 钻取链接通；Trust / 定义 / 证据抽屉正常。

### 5.7 风险与缓解
| 风险 | 缓解 |
|---|---|
| §5–§7 默认洞察与后续提问重复 | 首页标注"概览洞察"，`/report` 为针对性分析，口径一致文案区分 |
| 角色聚焦被误读为"信息缺失" | 文案明确"全部 7 节可见，仅高亮聚焦" |
| Drill-Down 占位页体验突兀 | 占位页明示"建设中" + 提供"返回 / 去 /report 深问"出口 |

---

## 附录 A · 规格对齐
| 规格要求（文档） | 本方案落点 |
|---|---|
| 10 §12 UI 必展 Trust/Source/Coverage/Health/Updated/Evidence | 每张 `<MetricCard>` Trust 行 + 定义 / 证据抽屉 |
| 11 §12 响应结构 Finding→Evidence→Impact→Recommendation→Trust | §5–§7 复用现 Findings/Risk/Recommendations + Evidence |
| 02A 指标→源映射 | §2.2 表 + 每节标题「来源: …」 |
| 角色定义（01_Agent_Flow） | §5.3 角色聚焦 + overview 洞察口径 |

## 附录 B · 决策记录
D1 保留问询入口为顶部提问条 · D2 §5–§7 = 默认 overview 洞察 · D3 全角色看全 7 节 + 聚焦高亮 · D4 Drill-Down 本期占位。
