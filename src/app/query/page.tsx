import QueryConsole from "@/components/query/query-console";
import type { Role } from "@/lib/kb/metric-kb";

/**
 * 智能问答 · 决策路由控制台（路由：/query）
 *
 * 入参可选：?q=… 深链直达某个问题；?perspective=CEO|CRM_MANAGER|OPERATION_MANAGER 设初始视角。
 * 页面内：输入 → 实时分类预览 → 提交 → 路由横幅 + 按 answer.kind 渲染。
 */
const ROLES: Role[] = ["CEO", "CRM_MANAGER", "OPERATION_MANAGER"];

export default function QueryPage({
  searchParams,
}: {
  searchParams: { q?: string; perspective?: string };
}) {
  const initialQuestion = searchParams.q?.trim() || "";
  const p = searchParams.perspective;
  const initialPerspective: Role | undefined =
    p && ROLES.includes(p as Role) ? (p as Role) : undefined;
  return (
    <QueryConsole initialQuestion={initialQuestion} initialPerspective={initialPerspective} />
  );
}
