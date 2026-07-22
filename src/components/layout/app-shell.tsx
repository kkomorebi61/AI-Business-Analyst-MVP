"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Database,
  FolderKanban,
  LayoutDashboard,
  Library,
  Search,
  Settings,
} from "lucide-react";

/**
 * 全局应用外壳（AppShell）—— AI 经营分析助手 V2 原型布局。
 *
 * 左：固定深色 sidebar（品牌 + 5 项主导航 + 底部用量条）。
 * 右：顶 bar（全局搜索 / 通知 / 用户）+ 主内容区。
 * 取代旧的顶部水平 TopNav；放在根 layout，所有路由共享。
 * 桌面优先（md 以上显示 sidebar），移动端隐藏 sidebar 仅留顶 bar。
 */

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { label: "工作台", href: "/", icon: LayoutDashboard },
  { label: "项目", href: "/projects", icon: FolderKanban },
  { label: "知识库", href: "/knowledge", icon: Library },
  { label: "数据中心", href: "/data", icon: Database },
  { label: "设置", href: "/settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col bg-[#1E213A] text-white md:flex">
        {/* 品牌 */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold">
            AI
          </div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold">AI经营分析助手</div>
            <div className="text-[10px] text-white/50">AI-Powered Consulting OS</div>
          </div>
        </div>

        {/* 主导航 */}
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 用量 */}
        <div className="px-5 py-4">
          <div className="text-[11px] text-white/40">本月用量</div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-white/70">分析额度</span>
            <span className="font-medium text-white">68%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[68%] rounded-full bg-orange-400" />
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-h-screen flex-col md:pl-56">
        {/* 顶 bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-white/90 px-6 backdrop-blur">
          <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-[#F8F9FA] px-3 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              placeholder="搜索项目、指标、根因、策略..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Bell className="h-[18px] w-[18px] cursor-default text-muted-foreground" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-medium text-white">
                李
              </div>
              <div className="hidden leading-tight sm:block">
                <div className="text-[13px] font-medium text-foreground">李经理</div>
                <div className="text-[11px] text-muted-foreground">CRM运营·星巴克</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
