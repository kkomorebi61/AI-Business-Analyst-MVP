"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Globe, LineChart, Search, Settings } from "lucide-react";

type NavItem = { label: string; href?: string };

const NAV: NavItem[] = [
  { label: "首页", href: "/" },
  { label: "智能问答", href: "/query" },
  { label: "指标中心", href: "/metrics" },
  { label: "数据源", href: "/trust" },
  { label: "成本中心", href: "/cost" },
];

/**
 * 顶部导航（对齐 homepage.png 顶栏）。
 * 首页 / 问答 / 数据源 可跳转；其余为占位。
 */
export default function TopNav() {
  const pathname = usePathname();
  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="border-b border-border bg-[#F8F9FA]">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1E3A8A] text-white">
              <LineChart className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              智谱云分析
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive(item.href)
                      ? "bg-white font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.label}
                  className="cursor-default rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {item.label}
                </span>
              ),
            )}
          </nav>
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-3 text-muted-foreground">
          <Globe className="h-[18px] w-[18px] cursor-default" />
          <Search className="h-[18px] w-[18px] cursor-default" />
          <Bell className="h-[18px] w-[18px] cursor-default" />
          <Settings className="h-[18px] w-[18px] cursor-default" />
          <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-medium text-white">
            思
          </div>
        </div>
      </div>
    </header>
  );
}
