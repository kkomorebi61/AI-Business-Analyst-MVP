"use client";

import { useEffect } from "react";

/**
 * 独立沙盒页（/、/cockpit、/query）挂载时退出项目，回到内置样本。
 *
 * Sprint 1 · 决策 3：这些页面始终读内置样本（demo/沙盒），真实分析只在项目内进行。
 * 仅清「当前激活项目」并回落样本，不影响沙盒已上传数据集。失败静默（沙盒页不阻塞）。
 */
export function useDeactivateOnMount(): void {
  useEffect(() => {
    void fetch("/api/projects/deactivate", { method: "POST" }).catch(() => {});
  }, []);
}
