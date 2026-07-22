import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "AI经营分析助手 · AI-Powered Consulting OS",
  description:
    "AI 驱动的 CRM 咨询顾问——业务问题发现 → 数据体检 → 经营诊断 → 根因分析 → 策略 → 执行 → 效果追踪 → 案例沉淀，全闭环。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
