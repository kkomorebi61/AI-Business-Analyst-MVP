/**
 * GLM 5.1 客户端（预留，Sprint 1 不启用）
 *
 * Sprint 1 默认 ANALYST_AGENT_MODE=rule（规则引擎 + Mock），无需任何 Key。
 * 后续 Sprint 把各 Agent 的"判断/生成"切换为 GLM 时，统一走本客户端：
 *
 *   const out = await chat({
 *     system: "你是业务分析 Intent Agent，只输出 JSON…",
 *     messages: [{ role: "user", content: question }],
 *     response_format: "json",
 *   });
 *
 * 优势：所有 Agent 的输入/输出结构（见 types.ts）保持不变，UI 零改动。
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  /** 强制 JSON 输出（用于结构化 Agent） */
  json?: boolean;
  temperature?: number;
}

export interface ChatResult {
  content: string;
}

/** 调用智谱 BigModel（GLM 5.1）的 OpenAI 兼容接口 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.ANALYST_LLM_API_KEY;
  const baseUrl = process.env.ANALYST_LLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
  const model = process.env.ANALYST_LLM_MODEL ?? "glm-5.1";

  if (!apiKey) {
    throw new Error(
      "未配置 ANALYST_LLM_API_KEY。Sprint 1 请保持 ANALYST_AGENT_MODE=rule。",
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
    throw new Error(`GLM 请求失败：${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  return { content: json.choices[0].message.content };
}
