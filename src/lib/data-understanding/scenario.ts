/**
 * Module 2 · Business Scenario Identification（doc 19 §Module 2）
 *
 * 按已识别的数据类型组合，判定业务场景。
 *   A CRM + OMS              → 会员增长运营（member_growth）
 *   B OMS                    → 经营分析（operations）
 *   C OMS + Marketing        → ROI 分析（roi）
 *   D CRM + OMS + SCRM       → 全渠道用户运营（omnichannel）
 *
 * 命中多个场景时全部返回，primary 取「数据最齐 / 最具象」者。
 * 纯函数、无 fs。
 */

import type { BusinessScenario, DataSetType, ScenarioResult } from "./types";

interface ScenarioRule {
  key: BusinessScenario;
  label: string;
  requires: DataSetType[];
}

const RULES: ScenarioRule[] = [
  { key: "omnichannel", label: "全渠道用户运营", requires: ["crm", "oms", "scrm"] },
  { key: "member_growth", label: "会员增长运营", requires: ["crm", "oms"] },
  { key: "roi", label: "营销 ROI 分析", requires: ["oms", "marketing"] },
  { key: "operations", label: "经营分析", requires: ["oms"] },
];

const has = (detected: DataSetType[], need: DataSetType[]) => need.every((t) => detected.includes(t));

/** 场景优先级（primary 取最高者）：覆盖面越广越优先 */
const PRIORITY: BusinessScenario[] = ["omnichannel", "member_growth", "roi", "operations"];

export function identifyScenario(detected: DataSetType[]): ScenarioResult {
  const matched = RULES.filter((r) => has(detected, r.requires));

  if (matched.length === 0) {
    // 无 OMS 这类经营主数据时，标记 custom 并说明
    return {
      scenarios: ["custom"],
      primary: "custom",
      reason: detected.length
        ? `已识别 ${detected.join(" / ")}，但缺少 OMS 订单数据，暂无法判定标准经营场景`
        : "未识别到任何业务数据，请上传 CSV",
    };
  }

  const primary = PRIORITY.find((p) => matched.some((m) => m.key === p)) ?? matched[0].key;
  const primaryLabel = matched.find((m) => m.key === primary)!.label;
  return {
    scenarios: matched.map((m) => m.key),
    primary,
    reason: `数据覆盖 ${detected.join(" + ")}，识别为「${primaryLabel}」`,
  };
}

export const SCENARIO_LABELS: Record<BusinessScenario, string> = {
  omnichannel: "全渠道用户运营",
  member_growth: "会员增长运营",
  roi: "营销 ROI 分析",
  operations: "经营分析",
  custom: "自定义场景",
};
