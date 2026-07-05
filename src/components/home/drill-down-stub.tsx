import Link from "next/link";
import { ArrowLeft, Construction, ArrowRight } from "lucide-react";

/**
 * Drill-Down 二级页占位（IA V2 预留）。
 * 本期仅入口 + 占位，L2 指标内容后续迭代（详见 docs/home-ia-redesign.md §5.4）。
 */
export default function DrillDownStub({
  title,
  source,
  hint,
}: {
  title: string;
  source: string;
  hint: string;
}) {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回首页驾驶舱
      </Link>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Construction className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">来源：{source} · Drill-Down 二级页</p>
        <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          当前版本聚焦首页 L1 经营驾驶舱；复杂指标 Drill-Down 在后续迭代补齐。
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="h-9 rounded-md border border-border bg-white px-4 text-sm font-medium hover:bg-secondary"
          >
            返回首页
          </Link>
          <Link
            href="/report?question=本周业务表现如何？"
            className="inline-flex h-9 items-center gap-1 rounded-md bg-[#1E3A8A] px-4 text-sm font-medium text-white hover:opacity-90"
          >
            去深度分析 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </main>
  );
}
