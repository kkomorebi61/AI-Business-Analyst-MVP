/**
 * GLM 5.1 客户端 + 模型分层（doc 15 §Model Routing）
 *
 * 决策路由体系按任务复杂度选择模型档位（doc 15 Principle 5）：
 *   Level 1  规则引擎          cost 0
 *   Level 2  SQL / Metric      cost 极低（csv-engine，不经本客户端）
 *   Level 3  GLM Flash         摘要 / 周报（预留）
 *   Level 4  GLM 5.1           根因分析 / 策略推荐 / 分类兜底   ← 默认档
 *   Level 5  Claude            PRD / 方案设计（Requirement Query 默认，可回退 GLM）
 *
 * 启用方式：ANALYST_AGENT_MODE=glm 且配置 ANALYST_LLM_API_KEY。
 * 未启用时 isLlmEnabled()=false，Router 全程走规则路径（Rule First / LLM Last），
 * 测试与 CI 无需任何 Key 即可确定性运行。
 *
 * 统一调用入口：
 *   const out = await chat({
 *     system: "你是 Query Classifier，只输出 JSON…",
 *     messages: [{ role: "user", content: question }],
 *     json: true,
 *     tier: "high",            // Insight/Strategy=medium(默认 GLM-5.1)；Requirement=high(Claude)
 *   });
 *
 * 所有 Agent 的输入/输出结构（见 routing/types.ts、agents/types.ts）保持不变。
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 模型档位（doc 15 §Model Routing Level 4 / 5） */
export type ModelTier = "medium" | "high";

export interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  /** 强制 JSON 输出（用于结构化 Agent / Classifier） */
  json?: boolean;
  temperature?: number;
  /**
   * 模型档位：
   *  - medium（默认）= GLM-5.1：根因分析 / 策略推荐 / 分类兜底
   *  - high          = 高阶模型：PRD / 方案设计（默认 Claude，未配则回退 GLM-5.1）
   */
  tier?: ModelTier;
}

/** 单次调用的 token 计量（来自 GLM/OpenAI 兼容响应的 usage 字段） */
export interface ChatUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ChatResult {
  content: string;
  /** 实际使用的模型名（供路由留痕 / 成本监控） */
  model: string;
  /** token 计量（供成本监控；未启用 LLM 或响应缺 usage 时为 undefined） */
  usage?: ChatUsage;
}

/* ----------------------------- 环境门控 ----------------------------- */

/** GLM 是否可用：显式 ANALYST_AGENT_MODE=glm 且配置了 Key（doc 15 Rule First 兜底） */
export function isLlmEnabled(): boolean {
  return process.env.ANALYST_AGENT_MODE === "glm" && Boolean(process.env.ANALYST_LLM_API_KEY);
}

/**
 * 按档位解析模型名（doc 15 §Model Routing）。
 *  - medium：GLM-5.1（ANALYST_LLM_MODEL，默认 glm-5.1）
 *  - high  ：Claude（ANALYST_LLM_HIGH_MODEL），未配则回退 GLM-5.1
 *            —— doc 18 将 Requirement Query 路由到 Claude；当前 MVP 接入 GLM-5.1，
 *               配置 ANALYST_LLM_HIGH_MODEL=claude-... 后可切到真实 Claude。
 */
export function pickModel(tier: ModelTier = "medium"): string {
  const glm = process.env.ANALYST_LLM_MODEL ?? "glm-5.1";
  if (tier === "high") {
    return process.env.ANALYST_LLM_HIGH_MODEL ?? glm;
  }
  return glm;
}

/** 调用智谱 BigModel（GLM 5.1）/ Claude 的 OpenAI 兼容接口 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.ANALYST_LLM_API_KEY;
  const baseUrl = process.env.ANALYST_LLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
  const model = pickModel(opts.tier);

  if (!apiKey) {
    throw new Error(
      "未配置 ANALYST_LLM_API_KEY。请保持 ANALYST_AGENT_MODE=rule，或配置 Key 后切到 glm。",
    );
  }

  const messages: ChatMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push(...opts.messages);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM 请求失败（${model}）：${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const usage: ChatUsage | undefined = json.usage
    ? {
        prompt: json.usage.prompt_tokens,
        completion: json.usage.completion_tokens,
        total: json.usage.total_tokens,
      }
    : undefined;

  return { content: json.choices[0].message.content, model, usage };
}
