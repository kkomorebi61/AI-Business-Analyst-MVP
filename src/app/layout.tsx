import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智谱云分析 · AI 业务分析师",
  description:
    "面向 CEO / CRM / 运营的自然语言业务分析平台——提问即得洞察、风险与行动建议。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
