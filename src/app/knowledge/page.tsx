import Link from "next/link";
import { BarChart3, BookOpen, Lightbulb } from "lucide-react";

/**
 * 知识库（/knowledge）—— 沉淀与复用 hub。
 * 指标中心为现有页；案例库 / 策略知识为后续阶段（项目跑完 Step11 自动沉淀）。
 */
const ITEMS: {
  title: string;
  desc: string;
  href?: string;
  icon: typeof BarChart3;
  soon?: boolean;
}[] = [
  {
    title: "指标中心",
    desc: "所有经营指标的口径、公式、血缘与可信度",
    href: "/metrics",
    icon: BarChart3,
  },
  {
    title: "案例库",
    desc: "沉淀的历史咨询案例：行业 · 问题 · 根因 · 策略 · 结果",
    icon: BookOpen,
    soon: true,
  },
  {
    title: "策略知识库",
    desc: "行业策略库与系统能力地图（Capability KB）",
    icon: Lightbulb,
    soon: true,
  },
];

export default function KnowledgePage() {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <h1 className="text-[22px] font-semibold">知识库</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        指标、案例与策略知识的沉淀与复用——让每一次分析都可被复用。
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const inner = (
            <>
              <Icon className="h-5 w-5 text-blue-600" />
              <div className="mt-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{it.title}</h3>
                {it.soon && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    即将上线
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{it.desc}</p>
            </>
          );
          return it.href ? (
            <Link
              key={it.title}
              href={it.href}
              className="group rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-sm"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={it.title}
              className="rounded-xl border border-dashed border-border bg-white/60 p-5 opacity-70"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </main>
  );
}
