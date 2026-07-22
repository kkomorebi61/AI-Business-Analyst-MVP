import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Database,
  DollarSign,
  Lightbulb,
  Network,
  Upload,
  Users,
  MessageCircle,
} from "lucide-react";

/**
 * 数据中心（/data）—— 既有数据能力的收纳 hub。
 * 把上传/数据集/数据源/成本/渠道/会员/私域 等既有页面统一收进 sidebar「数据中心」。
 */
const ITEMS = [
  { title: "上传数据", desc: "上传 CSV，自动数据理解与缺口分析", href: "/upload", icon: Upload },
  { title: "数据集", desc: "管理多份数据集，切换当前分析源", href: "/datasets", icon: Database },
  { title: "数据源 · 血缘", desc: "数据源覆盖、血缘与可信度", href: "/trust", icon: Network },
  { title: "渠道分析", desc: "各渠道 GMV / 订单 / ROI", href: "/channels", icon: BarChart3 },
  { title: "会员资产", desc: "会员总数 / VIP / LTV / 流失", href: "/members", icon: Users },
  { title: "私域经营", desc: "企微触达 / 回复 / 成交 / 核销", href: "/scrm", icon: MessageCircle },
  { title: "成本中心", desc: "LLM 用量与成本监控", href: "/cost", icon: DollarSign },
];

export default function DataCenterPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <h1 className="text-[22px] font-semibold">数据中心</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        数据采集、数据集管理与各业务域分析视图的统一入口。
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="group rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <Icon className="h-5 w-5 text-blue-600" />
              <h3 className="mt-2 text-sm font-semibold">{it.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{it.desc}</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
