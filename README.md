# AI Business Analyst · MVP

> **面向 CEO / CRM 经理 / 运营经理的自然语言经营分析助手** —— 提问即得摘要、KPI、关键发现、风险与行动建议，且**每一个结论都带数据依据与查询分级**。

一个把「业务提问 → 可解释分析报告」完整跑通的 AI 应用 MVP：内置 **AI 决策路由体系**（提问自动分类 → 路由到最优执行路径）、Agent 工作流编排、数据可信层与查询治理引擎，UI 严格参照设计稿实现。默认规则引擎驱动、零配置即可运行（绝大多数查询零 LLM 成本）；GLM 5.1 接口已接线，切换一个环境变量即可接入大模型。

🌐 **在线 Demo**：<https://ai-business-analyst-mvp.vercel.app>

---

## V2.0 · 项目制咨询流水线（Consulting OS）

V2.0 在「问答式分析」之上，升级为 **以项目为单元的端到端咨询闭环**：每个 Project 绑定自己的数据、跑完一条「业务问题 → 数据 → 诊断 → 根因 → 策略 → 执行 → 追踪」的完整咨询链路。全局 AppShell（左侧导航 + 顶栏），项目制着陆页 `/projects`。

**8 步 Wizard**（`/projects/[id]`，每步接真实引擎，非占位）：

| 步 | 阶段 | 能力 |
|---|---|---|
| 1 业务背景 | A | 项目名 / 行业 / 视角 / 业务问题 |
| **2 数据采集** | B | **Data Collection Center**：数据归属项目、可追溯、可追加；上传前字段规范提示；成功/失败/处理中状态；明细流水识别后提示「按日聚合」 |
| 3 数据体检 | C | 完整性 / 一致性 / 覆盖度 / 可信度评分 |
| **4 经营诊断** | D | **Insight Engine V2**：经营健康度（4 维综合分）+ AI 关键发现卡（带证据/严重度/可信度/下一步）+ 多指标趋势 + 异常检测 + 问题拆解树 |
| 5 根因分析 | E | 问题树 + 业务事件归因 + 证据链 |
| **6 策略方案** | F | **Strategy Center V2**：根因 → 策略库匹配 → Strategy Card（优先级 P0-P2 / 预计收益 ROI / 能力映射 √× / 可信度 / 风险 / 推荐依据） |
| 7 执行计划 | G | 采用策略 → Task Generator 生成 Action Plan，状态可改 |
| 8 效果追踪 | H | Before / Target / After（数据已就绪） |

**核心设计原则**

- **数据归属按项目（by project）**：每份数据集挂 `projectId` + `origin`（`upload` 现行 / `sync` 预留未来系统自动同步）。进入项目即激活其数据（合并写入引擎单例，**全栈引擎零改动**）；独立沙盒页（`/` `/cockpit` `/query`）始终读内置样本，互不串台。
- **Rule-First + Knowledge-Based**：健康度、Insight、策略均由规则 + 知识库计算，LLM 仅润色语言（默认关闭）。每个结论绑定 Evidence + 可信度 Badge。
- **仅摄入聚合日表**：4 张事实表（渠道/订单 · 会员 · 私域 · 业务事件）；明细流水（order_id/customer_id）识别后引导按日聚合上传。

**新增 API**：`/api/projects/:id/datasets`（上传/列表）、`/datasets/:datasetId`（删除）、`/activate` `/deactivate`（项目激活上下文）、`/diagnosis`（经营诊断）、`/strategy`（策略方案）、`/tasks`（执行计划 CRUD + 生成）。

**数据层**：`project-dataset-store`（项目级数据集）、`task-store`（任务）、`dataset-store` 增「激活项目」槽（`setActiveProject`/`clearActiveProject`）、`field-spec`（字段规范）、`health-score` + `insight-format`（诊断整形）、`strategy-v2`（策略卡 + 优先级/ROI/能力映射）。

---

## 目录

- [V2.0 项目制咨询流水线](#v20-项目制咨询流水线consulting-os)
- [项目背景](#项目背景)
- [核心功能](#核心功能)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [Agent 工作流](#agent-工作流)
- [AI 决策路由体系](#ai-决策路由体系)
- [数据可信与查询治理](#数据可信与查询治理)
- [指标体系](#指标体系)
- [工程亮点](#工程亮点)
- [项目结构](#项目结构)
- [范围说明](#范围说明)

---

## 项目背景

企业日常经营分析长期存在三个痛点：

1. **看数成本高**：业务方想了解「本周表现如何」，往往要跨多个看板手动拼凑 GMV、订单、转化、渠道、会员等指标，再自己组织成结论。
2. **结论不可信**：AI 生成的分析报告常出现「数字漂亮但无依据」，使用者无法判断哪句话可信、哪句话是幻觉。
3. **响应无分级**：当数据缺失或异常时，系统仍机械输出结论，掩盖了数据质量问题，可能误导决策。

本项目以 **「可信的 AI 经营分析」** 为核心命题，尝试用工程化的方式回答一个问题：

> *当 AI 给出一条业务结论时，它凭什么这么说？依据来自哪些源系统？数据覆盖到什么程度？是否应该被允许回答？应该用多贵的引擎来回答？*

围绕这一问题，MVP 构建了四层能力：**AI 决策路由体系**（提问自动分类并路由到成本最优的执行路径）、**Agent 工作流**（把提问编排出可解释的分析链路）、**数据可信层**（给每条结论挂上数据依据与血缘）、**查询治理引擎**（按数据质量分级响应，必要时拒答）。

---

## 核心功能

### 🎯 自然语言提问 → 结构化分析报告

输入「本周业务表现如何？」「为什么 GMV 下降？」「各渠道表现如何？」，系统自动生成包含 **摘要 / KPI 驾驶舱 / 关键发现 / 风险提示 / 行动建议** 的完整报告，支持导出与分享（UI 占位）。

### 🧭 智能问答 · 决策路由控制台（`/query`）

每次提问先经 **Query Classifier** 自动归类为 6 类查询之一（取值 / 计算 / 归因 / 策略 / 操作 / 需求），再路由到对应执行引擎。控制台顶部「路由横幅」实时显示**判定类型 · 将走哪条引擎链 · 成本档 · 判定来源（置信度）**，并可展开「查看决策链」。输入框输入即预览「将判定为：策略建议 → Strategy Engine」，提交前高成本查询（strategy / requirement）弹二次确认。详见 [AI 决策路由体系](#ai-决策路由体系)。

### 💰 成本中心（`/cost`）

把 LLM 成本「**可见**」：实时快照缓存命中率、知识复用率、**LLM 使用率**、单查询均价，对照目标（LLM 使用率 <30%、单查询均价 <¥0.05）展示达成度。`GET /api/cost` 读进程内 globalThis 计数器（`force-dynamic` 防静态预渲染）。

### 👥 三视角适配

同一份数据，按 **CEO / CRM 经理 / 运营经理** 三种视角呈现不同重点：CEO 看经营总览与渠道，CRM 经理聚焦会员资产与私域，运营经理关注渠道经营。视角改变首页聚焦节与推荐问题，并贯穿决策路由全链路（`RouteInput.role` + POST body + 控制台视角选择器）。

### 📊 经营驾驶舱（首页）

首页即「业务驾驶舱」：一次接口返回 4 大主题域 L1 指标 + 默认概览洞察，按 **经营总览 / 会员资产 / 私域经营 / 渠道分析 / 关键发现** 组织成直读视图，并区分**周期指标**（受时间筛选影响）与**存量指标**（会员资产快照，不受筛选影响）。

### 🕒 多时间范围与环比口径

支持 **最近 7 / 14 / 30 / 90 天** 切换，系统按窗口聚合 90 天日数据并计算环比；90 天档无上一周期时自动改述累计值，不臆造环比。KPI、AI 分析、趋势图四处联动。

### 🔍 查询分级横幅

报告顶部明确标注本次回答的级别 —— **直答 / 部分回答 / 暂不支持 / 数据异常暂停**，让使用者对结论可信度有第一判断。

### 📋 指标定义中心（`/metrics`）

20 个企业级指标的统一字典：定义、公式、业务含义、Include/Exclude 范围、负责人、更新频率、数据血缘。每个 KPI 卡可下钻查看「该指标如何计算」。

### 🛡️ 数据可信中心（`/trust`）

数据源注册表的可视化：覆盖率、健康度、时效、血缘，以及核心指标的 **Trust Score**（覆盖率 40% + 时效 30% + 健康 20% + 完整度 10%）。

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                              用户层                                    │
│            CEO · CRM 经理 · 运营经理（自然语言提问 + 视角）              │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                          交互层（Next.js 页面）                         │
│  首页驾驶舱 / 智能问答控制台 / 问答报告 / 指标中心 / 数据源 / 成本中心   │
│    /          /query           /report   /metrics    /trust  /cost   │
│                            + 二级下钻页 /channels /members /scrm      │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ fetch
┌───────────────────────────▼──────────────────────────────────────────┐
│                        API 层（Next.js Route Handlers）                │
│   GET /api/dashboard   一次返回 4 主题域 L1 指标 + 概览洞察（首页直读）    │
│   GET /api/kpis        CEO 四件套 KPI（轻量、切换范围实时重算）          │
│   POST /api/analyze    跑完整 Agent 工作流 → AnalysisResult 报告        │
│   POST/GET /api/query  决策路由主入口：分类→路由→执行→成本（GET 仅分类） │
│   GET /api/cost        成本监控实时快照（force-dynamic）                │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│              AI 决策路由层（决策前置 · 不替换 runWorkflow）              │
│   Query Classifier（三层：6 类 QueryType + 参数 + 置信度/GLM 兜底）     │
│   Router → metric/calculation/insight/strategy/execution/requirement   │
│   缓存层（TTL 分级） · 成本监控（usage→pricing→cost-store） · 高成本确认 │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                     Agent 工作流（可解释编排）                          │
│                                                                       │
│   提问 ─▶ ① Role ─▶ ② Intent ─▶ ③ Metric ─▶ ④ Data ─▶ ⑤ Insight       │
│                                                       │        │       │
│                                  ┌────────────────────┘        │       │
│                                  ▼                             ▼       │
│                        【查询治理门】◀────────────────────────┘       │
│            classify → anomaly → coverage → verdict → applyStrategy     │
│                  （A/B/C 分级 + 覆盖率门 + 4 级响应 + 事件归因）          │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                        数据可信层（Data Trust）                         │
│   Evidence Engine：每条结论挂 before→after→change + 引用源 + 覆盖率      │
│   数据源注册表：OMS / CRM / CDP / Marketing / Enterprise WeChat         │
│   指标知识库 V3：20 指标企业级元数据 + Trust Score + 数据血缘            │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│              数据层（CSV 单一事实源 · 服务端专用）                       │
│   daily_channel_metrics.csv   渠道经营（90 天 × 6 渠道）                │
│   daily_member_metrics.csv    会员运营（90 天）                         │
│   daily_scrm_metrics.csv      企微/私域运营（90 天）                    │
│   business_events.csv         经营事件（供根因归因）                    │
│                                                                       │
│   CSV Metric Engine：自带 RFC-4180 解析，按 SQL 语义聚合，结果不落盘     │
└──────────────────────────────────────────────────────────────────────┘
```

**设计原则**：重数据聚合全部下沉服务端（`csv-engine.ts` 顶部 `import fs`，禁客户端引用），客户端 bundle 只承载 UI，不进任何事实数据。

---

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端框架 | Next.js 14（App Router） | 文件路由 + RSC，API 与页面同仓 |
| 语言 | TypeScript | 全链路类型，`AnalysisResult` 结构贯穿前后端 |
| 样式 | TailwindCSS + shadcn 风格组件 | 不引入 Radix 等运行时 UI 原语库 |
| 图标 | lucide-react | string key → 图标映射 |
| 图表 | **纯手写 SVG** | 趋势折线图不引入 recharts 等图表库 |
| 后端 | Next.js Route Handlers | `/api/analyze`、`/api/dashboard`、`/api/query`、`/api/cost` 等 |
| 数据 | **CSV 单一事实源** | 4 张事实表（03A Schema · 90 天 · 固定种子可复现） |
| 测试 | Vitest（devDependency） | 237 条单测，决策路由 + 查询治理 + 数据完整性 + SCRM 聚合，不进运行时 |
| LLM | GLM 5.1（**已接线 · 默认关闭**） | 默认规则引擎，无需 Key；切换 `ANALYST_AGENT_MODE=glm` 接入 |

> **依赖克制**：运行时依赖仅 `next / react / react-dom / tailwind-merge / clsx / class-variance-authority / lucide-react`。无图表库、无 UI 原语库、无状态管理库。

---

## 快速开始

```bash
git clone <repo-url> && cd AI-Business-Analyst-MVP
npm install
npm run dev          # http://localhost:3000
```

MVP **无需任何环境变量**，开箱即用。

```bash
npm run build && npm start   # 生产构建
npm test                     # 237 条 Vitest 单测
```

接入 GLM 5.1（可选）：复制 `.env.local.example` → `.env.local`，填入智谱 BigModel API Key 并设 `ANALYST_AGENT_MODE=glm`。详见 [AI 决策路由体系](#ai-决策路由体系)。

---

## Agent 工作流

工作流（`src/lib/agents/workflow.ts`）把一次提问编排为五段，全链路可解释、可单测：

```
提问 ─▶ ① Role ─▶ ② Intent ─▶ ③ Metric ─▶ ④ Data ─▶ ⑤ Insight
                                          │              │
                                          └──▶ 【查询治理门】◀──┘
```

| Agent | 输入 | 输出 | 职责 |
| --- | --- | --- | --- |
| ① Role | 提问 + 视角 | `CEO \| CRM_MANAGER \| OPERATION_MANAGER` | 显式视角优先，否则关键词命中，默认 CEO |
| ② Intent | 提问 | 业务域 + 风险倾向 | 关键词权重判定，「为什么…下降」→ 归属业务域 + 风险倾向 |
| ③ Metric | 角色 + 意图 | 指标列表 | 角色→指标，意图做补充微调 |
| ④ Data | 指标 + range | KPI（本期/上期/环比）+ 日序列 + 各域聚合 | 读 CSV，按 range 窗口聚合 |
| ⑤ Insight | 角色/意图/数据 | 摘要 + 发现 + 风险 + 建议 | 数据驱动，从聚合结果推导 |

**可解释性**：`AnalysisResult.trace` 记录每步推理命中理由；`governance.reasons` 记录分级判定链。任意一条结论都可回溯到「为什么这么判」。

> 该工作流被 **AI 决策路由体系** 复用为 Insight 查询的执行引擎（见下节），二者正交：`Intent` 回答「什么业务主题」，`QueryType` 回答「想干什么」。

---

## AI 决策路由体系

> 对齐设计文档 `docs/ai-decision-routing.md` 与 `15_AI_Cost_and_Execution_Principles` / `16_Capability_Knowledge_Base` / `17_AI_Strategy_Engine` / `18_Query_Classifier`。

这是**决策前置层**：用户提问 → 自动分类 → 路由到**最优执行路径**，而非「所有请求直接调用大模型」。它不替换既有 `runWorkflow`，而是复用它作为 Insight 查询的执行引擎，把成本治理下沉到系统每一层。

### 五条铁律（落到每一层）

| 原则 | 含义 | 在本体系的落点 |
| --- | --- | --- |
| **Rule First** | 规则可解则不用 LLM | Query Classifier 规则先行，置信度足够直接返回（cost 0） |
| **SQL First** | 结构化数据用 SQL 取 | metric / calculation 走 csv-engine 聚合，附等价 SQL |
| **Evidence First** | 先取证再推理 | Insight 复用 Evidence Engine，结论必带数据依据 |
| **Knowledge First** | 优先查知识库 | execution / strategy 走 Capability KB，不调 LLM |
| **LLM Last** | 最后才用大模型 | 仅叙事 / 出 PRD / 分类兜底时调用 |

成本目标（doc 15 §Cost Monitoring）：缓存命中率 >60%、知识复用率 >50%、**LLM 使用率 <30%**、单查询均价 <¥0.05。

### Query Classifier（三层 · `src/lib/routing/query-classifier.ts`）

| 层 | 职责 | 实现 |
| --- | --- | --- |
| L1 Intent Parser | 自然语言 → 6 类 `QueryType` | 正则规则集，按优先级先命中先归类（消除歧义） |
| L2 Parameter Extractor | 抽取 metric / range / channel / segment | 关键词 + `resolveMetricKey` 归一化（始终规则，确定性） |
| L3 置信度 | 决定是否回落 LLM | ≥0.8 直返；<0.6 且 GLM 可用 → GLM 仅修正类型，失败回退规则、绝不抛错 |

**六类查询与执行路径**：

| QueryType | 示例 | 执行引擎 | LLM | 成本档 |
| --- | --- | --- | --- | --- |
| `metric` | 今天 GMV 是多少？ | SQL Engine（csv-engine 聚合） | ❌ | free |
| `calculation` | 复购率是多少？ | Metric Engine（按公式计算） | ❌ | free |
| `insight` | 为什么 GMV 下降？ | Insight + Evidence + GLM 叙事 | ✅ | medium |
| `strategy` | 如何提升复购率？ | Strategy Engine + Capability KB + GLM | ✅ | high |
| `execution` | 如何创建优惠券？ | Capability KB | ❌ | low |
| `requirement` | 帮我生成 PRD | Gap Analysis + LLM（high 档） | ✅ | very_high |

### 路由可解释性（RoutingTrace）

每个结果携带 `routing`，记录「**为什么这么走**」：

```ts
routing = {
  queryType, engines[],        // 实际引擎链
  ruleOrder[],                 // 决策链：①规则命中 ②SQL/知识库优先 ③LLM Last
  costTier, llmUsed, llmModel  // 成本档 + 是否用了 LLM 及模型
}
```

例：metric 路径 `ruleOrder = ["①规则命中取值诉求", "②SQL Engine 直接聚合", "③禁止 LLM 计算"]`，`llmUsed=false`。任意一次路由都可回溯到「为何不调用更贵的引擎」。

### 缓存层与成本治理

- **缓存层**（`src/lib/routing/cache.ts`）：Key = Question / Range / Role / Brand，TTL 按查询节奏分级（metric/calculation 5min、insight/execution 1h、strategy 6h、requirement 24h）；globalThis 单例 Map + 惰性过期，命中即早返回（`routing.cacheHit=true`）且不调引擎。
- **成本监控**（`src/lib/agents/{usage,pricing,cost-store}.ts`）：捕获 GLM `usage` token（原本被丢弃）→ 请求级 `CostAcc` 贯穿分类器与各 handler → globalThis 计数器汇总 5 项指标 + 4 项目标（含 `knowledgeReuseRate` 代理 = (total−llm)/total）。`GET /api/cost` 与 `/cost` 页实时展示。
- **高成本确认**（`cost-estimate.ts` + `confirm-dialog.tsx`）：strategy / requirement（high / very_high）触发「预计消耗：XX Tokens / 确认执行？」，query-console 提交前用 GET 分类判档门控。

### 知识库与策略引擎

| 模块 | 源码 | 内容 |
| --- | --- | --- |
| **Capability KB** | `src/lib/kb/capability-kb.ts` | doc 16 全部 14 项能力（CRM/CDP/SCRM/OMS）；`matchCapabilities()` 关键词加权；`gapAnalysis()` 缺口检测 |
| **Strategy Engine** | `src/lib/agents/strategy-engine.ts` | doc 17 六个零售场景（复购下降 / 增长放缓 / 流失 / AOV / VIP / 企微）；`matchStrategy()` + 能力解析 + 缺口暴露 |

匹配规则：能力命中优先复用；仅当能力缺失才出 PRD。策略需要但 KB 未覆盖的项（如「邀请裂变 / 积分中心 / 商品推荐」）自动暴露为 `capabilityGaps`，闭环到 Gap Analysis。

### GLM 5.1 接线

`src/lib/agents/llm-client.ts` 统一入口 `chat({ system, messages, json, tier, temperature })`，OpenAI 兼容接口直连智谱 BigModel。**模型分层**：`medium`（默认 `glm-5.1`）用于 Insight / Strategy / 分类兜底；`high`（回退 GLM-5.1，配 `claude-*` 即切真实 Claude）用于 Requirement 出 PRD。**环境门控** `isLlmEnabled() = ANALYST_AGENT_MODE==='glm' && ANALYST_LLM_API_KEY`：未启用时全程规则路径，测试与 CI 无需 Key 即确定性运行。

```bash
ANALYST_AGENT_MODE=glm
ANALYST_LLM_API_KEY=xxxxx
ANALYST_LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ANALYST_LLM_MODEL=glm-5.1
# 可选：Requirement Query 走 Claude（未配则回退 GLM-5.1）
# ANALYST_LLM_HIGH_MODEL=claude-opus-4-8
```

---

## 数据可信与查询治理

这是本项目的核心差异化能力，回答「AI 的结论凭什么可信」。

### 数据可信层（Data Trust）

每条 Finding / Risk 都挂 `evidence`（数据依据）、`lineage`（数据血缘）、`rootCause`（业务事件根因）：

- **Evidence Engine**：从聚合结果推导每个指标的 `before → after → change`（区分相对 % / 百分点 / 绝对值），附引用源系统、覆盖率、健康度、最晚更新时间。
- **数据源注册表**：OMS / CRM / CDP / Marketing / Enterprise WeChat 等源的覆盖率、健康度（Healthy / Warning / Delayed / Error）、时效。
- **指标 Trust Score**：`Coverage×40% + Freshness×30% + Health×20% + Completeness×10%`，分级 High ≥90 / Medium 75–89 / Low 60–74 / Caution <60。

### 查询治理引擎（Query Governance）

位于 `src/lib/governance/`，纯函数 + 单测守护。决定「这次提问该不该答、怎么答」：

| 分级 | 触发条件 | 响应策略 | UI 表现 |
| --- | --- | --- | --- |
| **A 直答** | 指标在库 + 必需源齐全 | `direct` | 完整摘要 / 发现 / 风险 / 建议 |
| **B 部分回答** | 缺源或成本源未接入（如利润） | `partial` | 摘要前置「部分回答」提示，正文照常 |
| **C 暂不支持** | 指标不在库 | `refuse` | 仅留横幅，正文隐藏 |
| **数据异常** | 量级 ≥5×（率类另需 ≥20pp） | `suspend` | 暂停分析，仅展示 KPI 仪表盘 |

**覆盖率门**（阈值严格对齐设计文档）：High ≥80 / Medium 50–<80 / Low <50，按**实际引用源**计算。**业务事件归因**：读取 `business_events.csv`，将周期内命中的经营事件（618 预热 / 新品上市 / 企微触达下降等）挂为 Finding/Risk 的根因。

---

## 指标体系

20 个企业级指标，覆盖三大主题域，全部具备定义 / 公式 / 业务含义 / 负责人 / 更新频率 / 数据血缘：

| 主题域 | 指标 |
| --- | --- |
| **经营 / 渠道**（7） | GMV、订单数、客单价、转化率、退款率、ROI、渠道机会 |
| **会员运营**（7） | 新增会员、活跃会员、复购率、LTV、流失率、VIP 会员、会员总数 |
| **私域 / 企微 SCRM**（6） | 触达率、回复率、企微成交率、发券核销率、企微好友总数、新增好友 |

**数据集关键量级**（90 天，固定种子可复现，经 `scripts/validate_csv_mock_data.py` 校验）：总 GMV ¥11,676,538 · 总订单 58,854 · 整体客单价 ¥198 · 转化率 4.23% · 退款率 3.45% · 会员 12,024→16,679（+38.71%）· 企微好友 18,096→28,069（+55.11%）。

---

## 工程亮点

- **单一事实源**：数据层统一到 4 张 CSV，结果指标（GMV / ROI / LTV / 复购率…）一律不落盘、由 `csv-engine.ts` 按 SQL 语义实时聚合。GMV 仅存于渠道表，总 GMV = Σ 渠道值天然成立，**无需对账**。
- **LLM Last 成本治理**：决策路由让绝大多数查询零 LLM（metric / calculation / execution 走 SQL 与知识库，cost 0 或 ≈0），仅 insight / strategy / requirement 叙事才调 GLM；配合分级 TTL 缓存（命中即早返回）与高成本二次确认，把单查询均价压到目标内。成本全程可见（`/cost` 实时快照）。
- **Bundle 瘦身**：重数据聚合全部下沉服务端（`csv-engine.ts` 顶部 `import fs`，禁客户端引用），客户端只回传轻量 KPI（~400B）；事实数据（CSV）绝不进客户端 bundle。共享 First Load JS 仅 87 kB，各页面在其上仅增 1–6 kB（首页 123 kB / 报告 116 kB / 指标 113 kB / 二级页 ~96 kB，`next build` 实测）。
- **治理引擎与业务解耦**：查询治理为纯函数模块，`insight-agent.ts` 与 `api/analyze/route.ts` 全程未改即可接入，降级链 `direct → partial → refuse → suspend` 按层实现、非缓存。
- **零配置可跑 + 大模型可接**：默认规则引擎无需 Key 即可完整演示；GLM 5.1 走已接线入口，切换一个环境变量接入，前后端结构不变。
- **测试守护**：237 条单测覆盖决策路由（分类器 / 路由 / 缓存 / 成本）、查询治理（分级 / 覆盖率 / 异常 / 事件归因）、CSV 引擎口径回归、SCRM 聚合、数据完整性（Σ 渠道 = 总 GMV）。

---

## 项目结构

```
AI-Business-Analyst-MVP/
├── data/                          # CSV 单一事实源（4 张事实表，服务端专用）
├── scripts/                       # Mock 数据生成与校验（Python，固定种子可复现）
├── docs/                          # 设计文档（ai-decision-routing / home-ia-redesign）
├── src/
│   ├── app/                       # 页面 + API Routes
│   │   ├── page.tsx               #   首页驾驶舱
│   │   ├── query/                 #   智能问答 · 决策路由控制台
│   │   ├── report/                #   分析报告页
│   │   ├── metrics/ trust/ cost/  #   指标中心 / 数据源 / 成本中心
│   │   ├── channels/ members/ scrm/  # 二级下钻页
│   │   └── api/                   #   /dashboard /kpis /analyze /query /cost
│   ├── components/                # home / report / query / metrics / ui 原语
│   └── lib/
│       ├── agents/                # ①~⑤ Agent + Evidence + workflow + strategy-engine + llm-client + cost(usage/pricing)
│       ├── routing/               # 决策路由（classifier/router/cache + cost-estimate/cost-store + 6 类 handler）
│       ├── governance/            # 查询治理引擎（纯函数 + 单测）
│       ├── data/                  # csv-engine / data-trust / daily(Range 工具)
│       └── kb/                    # metric-kb（20 指标）+ capability-kb（14 能力 + Gap Analysis）
└── package.json
```

---

## 范围说明

作为 MVP，本项目**明确不做**以下能力（对齐 Master Prompt 约束）：

- Forecast Agent / 预测功能
- PPT 导出 / 营销自动化 / 数据库集成
- GLM 实调需配置可用 Key（决策路由机制已就绪，默认 rule 模式零成本运行；接 GLM 仅改环境变量，模型分层 medium/high 已接线）
- MCP（doc 暂缓）：Capability KB 的能力执行当前为「指引」，未接真实系统操作
- 导出 PDF、分享按钮为 UI 占位

二级下钻页（`/channels`、`/members`、`/scrm`）当前为 Drill-Down 桩，L2 明细指标留待后续迭代。

---

*Built as a portfolio MVP demonstrating end-to-end AI business analysis with decision routing, explainability, and query governance.*
