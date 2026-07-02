/**
 * Role Agent —— 识别用户角色
 *
 * 输入：自然语言提问 +（可选）显式视角
 * 输出：CEO | CRM_MANAGER | OPERATION_MANAGER
 *
 * 规则：显式视角优先；否则按关键词命中推断；默认 CEO。
 */

import type { Role } from "@/lib/kb/metric-kb";

const KEYWORDS: { role: Role; words: string[] }[] = [
  {
    role: "CRM_MANAGER",
    words: ["会员", "复购", "ltv", "流失", "留存", "活跃", "新客", "老客", "crm"],
  },
  {
    role: "OPERATION_MANAGER",
    words: ["渠道", "流量", "转化", "ctr", "cvr", "roi", "投放", "运营", "落地页", "天猫", "京东", "小红书"],
  },
];

export interface RoleAgentInput {
  question: string;
  /** 首页"视角"下拉的显式选择，优先级最高 */
  perspective?: Role;
}

export interface RoleAgentOutput {
  role: Role;
  reason: string;
}

export function roleAgent({ question, perspective }: RoleAgentInput): RoleAgentOutput {
  if (perspective && perspective !== ("AUTO" as Role)) {
    return { role: perspective, reason: "用户在首页显式选择了视角" };
  }

  const text = question.toLowerCase();
  for (const { role, words } of KEYWORDS) {
    if (words.some((w) => text.includes(w))) {
      return { role, reason: `命中关键词，推断为${labelOf(role)}` };
    }
  }

  return { role: "CEO", reason: "未命中特定角色关键词，默认 CEO 视角" };
}

function labelOf(role: Role): string {
  return role === "CEO" ? "CEO" : role === "CRM_MANAGER" ? "CRM 经理" : "运营经理";
}
