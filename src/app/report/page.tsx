import ReportView from "@/components/report/report-view";
import { isRange, type Range } from "@/lib/data/daily";
import type { Role } from "@/lib/kb/metric-kb";

const VALID_ROLES: Role[] = ["CEO", "CRM_MANAGER", "OPERATION_MANAGER"];

/**
 * 分析报告页（路由：/report）
 * 入参来自首页跳转：?question=…&perspective=…&range=7|14|30|90
 */
export default function ReportPage({
  searchParams,
}: {
  searchParams: { question?: string; perspective?: string; range?: string };
}) {
  const question = searchParams.question?.trim() || "本周业务表现如何？";
  const perspective = VALID_ROLES.includes(searchParams.perspective as Role)
    ? (searchParams.perspective as Role)
    : "CEO";
  const rangeNum = Number(searchParams.range);
  const range: Range = isRange(rangeNum) ? rangeNum : 7;

  return <ReportView question={question} perspective={perspective} initialRange={range} />;
}
