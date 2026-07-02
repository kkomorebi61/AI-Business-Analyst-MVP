import path from "node:path";
import { defineConfig } from "vitest/config";

// Vitest 配置：node 环境 + @/* 路径别名（对齐 tsconfig paths）。
// governance 引擎为纯函数，不依赖 DOM；JSON 数据集（07/08）由 esbuild 原生支持。
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
