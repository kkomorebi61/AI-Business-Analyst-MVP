"use client";

import { Calculator } from "lucide-react";
import { resolveMetricKey, type MetricKey } from "@/lib/kb/metric-kb";

/**
 * Insight「该指标如何计算」入口。
 * 从 Finding / Risk 文本中解析出指标 key（11_Query_Governance §6 Metric Mapping），
 * 可解析时渲染入口，点击弹出 Metric Detail Drawer。
 *
 * 与「查看依据」互补：依据 = 数据可信 / 血缘；如何计算 = 定义 / 公式 / 口径。
 */
export default function MetricExplainLink({
  text,
  onViewMetric,
}: {
  text: string;
  onViewMetric?: (key: MetricKey) => void;
}) {
  if (!onViewMetric) return null;
  const key = resolveMetricKey(text);
  if (!key) return null;
  return (
    <button
      onClick={() => onViewMetric(key)}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-blue-600"
    >
      <Calculator className="h-3 w-3" />
      该指标如何计算
    </button>
  );
}
