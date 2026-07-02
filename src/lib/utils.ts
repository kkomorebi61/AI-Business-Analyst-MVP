import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn 标准的 className 合并工具 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 数字格式化：保留 1 位小数并去除多余 0 */
export function formatNumber(n: number): string {
  return n
    .toLocaleString("zh-CN", { maximumFractionDigits: 1 })
    .toString();
}

/** 百分比带正负号，例如 +12.4 / -2.3 */
export function formatDelta(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}
