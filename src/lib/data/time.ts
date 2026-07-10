/**
 * 时间模型 + Date Anchor 解析器（doc 18 §Module 2 Time Anchor Engine）
 *
 * 核心铁律（doc 18）：**所有时间基于「最新数据日期」（Latest Data Date），
 * 禁止使用系统当前时间。** 本模块只做「锚点日期 + 时间表达 → 具体日期窗口」
 * 的纯函数换算，不读时钟、不读 fs，因此 client-safe（query-console 时间 UI 复用）。
 *
 * 与既有 Range(7|14|30|90) 的关系：Range 退化为 { kind:'relative', days } 的一种；
 * 新增 today / yesterday / absolute（自定义区间）与 TimeComparison（任意对比）。
 */

/** 时间表达：经 Classifier 从自然语言解析出的结构化时间意图 */
export type TimeExpr =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "relative"; days: number } // 最近 N 天（=旧 Range）
  | { kind: "absolute"; from: string; to: string }; // 自定义区间 2026-06-01~06-15

/** 经锚点解析出的具体日期窗口（YYYY-MM-DD） */
export interface ResolvedWindow {
  from: string;
  to: string;
  label: string;
}

/** Date Anchor：最新数据日期（一切时间的基准） */
export interface DateAnchor {
  latestDataDate: string; // YYYY-MM-DD
}

/** 任意对比：基线 vs 对比（时段对比或维度对比） */
export interface TimeComparison {
  baseline: TimeExpr;
  comparison: TimeExpr;
  /** 维度对比时标注对比维度（如「企业微信 vs 小程序」）；时段对比留空 */
  dimension?: string;
}

/* ------------------------------ 纯日期工具 ------------------------------ */

function parseDate(s: string): Date {
  // YYYY-MM-DD → 本地日期，避免 UTC 时区漂移
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function fmt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 锚点日期 ± n 天 → YYYY-MM-DD（纯算术，不读系统时钟） */
export function addDays(anchor: string, n: number): string {
  const dt = parseDate(anchor);
  dt.setDate(dt.getDate() + n);
  return fmt(dt);
}

/** 校验 YYYY-MM-DD */
export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime());
}

/** 取一组日期字符串的最大值（= Latest Data Date）；空则 "" */
export function maxDateString(dates: string[]): string {
  const valid = dates.filter((d) => d && isValidDate(d)).sort();
  return valid.length ? valid[valid.length - 1] : "";
}

/* ------------------------------ 窗口解析 ------------------------------ */

/**
 * 把时间表达解析为具体日期窗口（doc 18 §Time Anchor Engine）。
 * 一切相对锚点 `anchor`（= 最新数据日期），**绝不**用系统今天。
 *
 * - today      → [anchor, anchor]
 * - yesterday  → [anchor-1, anchor-1]
 * - relative N → [anchor-(N-1), anchor]  最近 N 天
 * - absolute   → [from, to]              自定义（不依赖 anchor）
 */
export function resolveWindow(anchor: string, expr: TimeExpr): ResolvedWindow {
  switch (expr.kind) {
    case "today":
      return { from: anchor, to: anchor, label: `今天（${anchor}）` };
    case "yesterday": {
      const y = addDays(anchor, -1);
      return { from: y, to: y, label: `昨天（${y}）` };
    }
    case "relative": {
      const n = Math.max(1, Math.floor(expr.days));
      const from = addDays(anchor, -(n - 1));
      return { from, to: anchor, label: `最近 ${n} 天（${from} ~ ${anchor}）` };
    }
    case "absolute":
      return { from: expr.from, to: expr.to, label: `${expr.from} ~ ${expr.to}` };
  }
}

/** 旧 Range → TimeExpr（向后兼容；csv-engine / dashboard 仍用 Range） */
export function rangeToExpr(days: number): TimeExpr {
  return { kind: "relative", days };
}

/** 时间表达的简短标签（UI 预览用） */
export function timeExprLabel(expr: TimeExpr): string {
  switch (expr.kind) {
    case "today":
      return "今天";
    case "yesterday":
      return "昨天";
    case "relative":
      return `最近 ${expr.days} 天`;
    case "absolute":
      return `${expr.from} ~ ${expr.to}`;
  }
}
