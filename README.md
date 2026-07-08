# AI Business Analyst · MVP

> **面向 CEO / CRM 经理 / 运营经理的自然语言经营分析助手** —— 提问即得摘要、KPI、关键发现、风险与行动建议，且**每一个结论都带数据依据与查询分级**。

一个把「业务提问 → 可解释分析报告」完整跑通的 AI 应用 MVP：内置 Agent 工作流编排、数据可信层与查询治理引擎，UI 严格参照设计稿实现。默认规则引擎驱动、零配置即可运行；GLM 5.1 接口已预留，切换一个环境变量即可接入大模型。

🌐 **在线 Demo**：<https://ai-business-analyst-mvp.vercel.app>

---

## 目录

- [项目背景](#项目背景)
- [核心功能](#核心功能)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [Agent 工作流](#agent-工作流)
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

> *当 AI 给出一条业务结论时，它凭什么这么说？依据来自哪些源系统？数据覆盖到什么程度？是否应该被允许回答？*

围绕这一问题，MVP 构建了三层能力：**Agent 工作流**（把提问编排出可解释的分析链路）、**数据可信层**（给每条结论挂上数据依据与血缘）、**查询治理引擎**（按数据质量分级响应，必要时拒答）。

---

## 核心功能

### 🎯 自然语言提问 → 结构化分析报告

输入「本周业务表现如何？」「为什么 GMV 下降？」「各渠道表现如何？」，系统自动生成包含 **摘要 / KPI 驾驶舱 / 关键发现 / 风险提示 / 行动建议** 的完整报告，支持导出与分享（UI 占位）。

### 👥 三视角适配

同一份数据，按 **CEO / CRM 经理 / 运营经理** 三种视角呈现不同重点：CEO 看经营总览与渠道，CRM 经理聚焦会员资产与私域，运营经理关注渠道经营。视角改变首页聚焦节与推荐问题。

### 📊 经营驾驶舱（首页）

首页即「业务驾驶舱」：一次接口返回 4 大主题域 L1 指标 + 默认概览洞察，按 **经营总览 / 会员资产 / 渠道分析 / 关键发现** 组织成 7 节直读视图，并区分**周期指标**（受时间筛选影响）与**存量指标**（会员资产快照，不受筛选影响）。

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
│  首页驾驶舱 /  问答报告   /  指标中心  /  数据可信中心  /  二级下钻页     │
│    /         /report      /metrics      /trust        /channels /members /scrm │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ fetch
┌───────────────────────────▼──────────────────────────────────────────┐
│                        API 层（Next.js Route Handlers）                │
│   GET /api/dashboard   一次返回 4 主题域 L1 指标 + 概览洞察（首页直读）    │
│   GET /api/kpis        CEO 四件套 KPI（轻量、切换范围实时重算）          │
│   POST /api/analyze    跑完整 Agent 工作流 → AnalysisResult 报告        │
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
| 后端 | Next.js Route Handlers | `/api/analyze`、`/api/kpis`、`/api/dashboard` |
| 数据 | **CSV 单一事实源** | 4 张事实表（03A Schema · 90 天 · 固定种子可复现） |
| 测试 | Vitest（devDependency） | 122 条单测，governance + 数据完整性 + SCRM 聚合，不进运行时 |
| LLM | GLM 5.1（**预留接口**） | 默认规则引擎，无需 Key；切换 `ANALYST_AGENT_MODE=glm` 接入 |

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
npm test                     # 122 条 Vitest 单测
```

接入 GLM 5.1（可选）：复制 `.env.local.example` → `.env.local`，填入智谱 BigModel API Key 并设 `ANALYST_AGENT_MODE=glm`。详见 [Agent 工作流](#agent-工作流)。

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

**GLM 5.1 接入路径（零 UI 改动）**：`llm-client.ts` 已实现智谱 BigModel 的 OpenAI 兼容调用；切到 `glm` 模式后，各 Agent 用同一份 `types.ts` 结构调用，`AnalysisResult` 结构不变。知识库（`metric-kb.ts`）作为 system prompt / few-shot 注入。

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
- **Bundle 瘦身**：重数据聚合全部下沉服务端（`csv-engine.ts` 顶部 `import fs`，禁客户端引用），客户端只回传轻量 KPI（~400B）；事实数据（CSV）绝不进客户端 bundle。共享 First Load JS 仅 87 kB，各页面在其上仅增 1–6 kB（首页 123 kB / 报告 116 kB / 指标 113 kB / 二级页 ~96 kB，`next build` 实测）。
- **治理引擎与业务解耦**：查询治理为纯函数模块，`insight-agent.ts` 与 `api/analyze/route.ts` 全程未改即可接入，降级链 `direct → partial → refuse → suspend` 按层实现、非缓存。
- **零配置可跑 + 大模型可接**：默认规则引擎无需 Key 即可完整演示；GLM 5.1 走预留接口，切换一个环境变量接入，前后端结构不变。
- **测试守护**：122 条单测覆盖查询治理（分级 / 覆盖率 / 异常 / 事件归因）、CSV 引擎口径回归、SCRM 聚合、数据完整性（Σ 渠道 = 总 GMV）。

---

## 项目结构

```
AI-Business-Analyst-MVP/
├── data/                          # CSV 单一事实源（4 张事实表，服务端专用）
├── scripts/                       # Mock 数据生成与校验（Python，固定种子可复现）
├── src/
│   ├── app/                       # 页面 + API Routes
│   │   ├── page.tsx               #   首页驾驶舱
│   │   ├── report/                #   分析报告页
│   │   ├── trust/ metrics/        #   数据可信中心 / 指标定义中心
│   │   ├── channels/ members/ scrm/  # 二级下钻页
│   │   └── api/                   #   /dashboard /kpis /analyze
│   ├── components/                # home / report / metrics / ui 原语
│   └── lib/
│       ├── agents/                # ①~⑤ Agent + Evidence Engine + workflow + llm-client
│       ├── governance/            # 查询治理引擎（纯函数 + 单测）
│       ├── data/                  # csv-engine / data-trust / daily(Range 工具)
│       └── kb/                    # 指标知识库 V3（20 指标企业级元数据）
└── package.json
```

---

## 范围说明

作为 MVP，本项目**明确不做**以下能力（对齐 Master Prompt 约束）：

- Forecast Agent / 预测功能
- PPT 导出 / 营销自动化 / 数据库集成
- GLM 模型路由兜底（GLM 未启用，rule 模式）
- 导出 PDF、分享按钮为 UI 占位

二级下钻页（`/channels`、`/members`、`/scrm`）当前为 Drill-Down 桩，L2 明细指标留待后续迭代。

---

*Built as a portfolio MVP demonstrating end-to-end AI business analysis with explainability and query governance.*
