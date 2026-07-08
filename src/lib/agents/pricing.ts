/**
 * Token → 成本估算（doc 15 §Cost Monitoring · 平均成本 <¥0.05/问）
 *
 * 按「每 1M token」计价（GLM-5.1 量级），env 可调：
 *   - rule 模式零 token → ¥0，自然满足目标；
 *   - GLM 模式机制真实可用，配置真实费率后即为业务成本。
 *
 * 注意：刻意按「每 1M」而非「每 1K」——若按每 1K、¥0.5 计，单次 Insight 叙事
 * （≈800 in / 300 out）即 ¥0.55，会令「平均成本」面板永久飘红 11×。
 */
export const PRICE_PER_1M_YUAN = {
  input: Number(process.env.ANALYST_LLM_PRICE_IN_PER_M ?? 1),
  output: Number(process.env.ANALYST_LLM_PRICE_OUT_PER_M ?? 1),
};

/** 估算 token 成本（元） */
export function estimateCostYuan(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn * PRICE_PER_1M_YUAN.input + tokensOut * PRICE_PER_1M_YUAN.output) /
    1_000_000
  );
}
