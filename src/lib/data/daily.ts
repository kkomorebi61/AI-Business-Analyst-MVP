/**
 * 时间范围工具（client-safe）。
 *
 * V3 起，指标聚合与事实表读取由 src/lib/data/csv-engine.ts（服务端专用，读 data/*.csv）承担。
 * 本文件只保留客户端组件（RangeSwitcher 等）与全链路共享的范围类型 / 工具，
 * 不含任何业务数据、也不 import fs，因此可安全进入客户端 bundle。
 */

export type Range = 7 | 14 | 30 | 90;

export const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: "最近7天" },
  { value: 14, label: "最近14天" },
  { value: 30, label: "最近30天" },
  { value: 90, label: "最近90天" },
];

export function rangeLabel(r: Range): string {
  return RANGES.find((x) => x.value === r)?.label ?? `最近${r}天`;
}

export function isRange(v: unknown): v is Range {
  return v === 7 || v === 14 || v === 30 || v === 90;
}
