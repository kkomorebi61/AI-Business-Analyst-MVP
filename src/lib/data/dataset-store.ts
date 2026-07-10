/**
 * 活跃数据集 + 理解结果存储（服务端进程内，globalStore 模式，仿 cost-store.ts）。
 *
 * Data First 升级：系统的「当前数据」不再是写死的 CSV，而是「活跃数据集」——
 * 默认为内置 90 天样本（满足 No Empty Dashboard，开箱即有内容），
 * /upload 上传后替换为用户数据并重跑 Data Understanding Engine。
 *
 * 无 DB、无落盘（对齐 MVP 范围）；HMR 下 globalThis guard 保单例。
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parseCsvText } from "@/lib/data/csv-engine";
import { understand } from "@/lib/data-understanding/engine";
import type { DatasetFile, UnderstandingResult } from "@/lib/data-understanding/types";

const DATA_DIR = join(process.cwd(), "data");

/** 内置样本 = 三张日聚合事实表（渠道/会员/企微；events 仅供根因，不进理解引擎） */
const SAMPLE_FILES = [
  "daily_channel_metrics.csv",
  "daily_member_metrics.csv",
  "daily_scrm_metrics.csv",
];

function loadSampleFiles(): DatasetFile[] {
  return SAMPLE_FILES.map((name) => {
    const rows = parseCsvText(readFileSync(join(DATA_DIR, name), "utf-8"));
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { name, columns, rows };
  });
}

/** 样本理解结果（进程内只算一次） */
let sampleCache: UnderstandingResult | null = null;
function buildSample(): UnderstandingResult {
  if (!sampleCache) sampleCache = understand({ source: "sample", files: loadSampleFiles() });
  return sampleCache;
}

interface Store {
  /** null = 未上传，使用样本 */
  active: UnderstandingResult | null;
  uploaded: { fileNames: string[]; rowCount: number; at: string } | null;
}

const g = globalThis as unknown as { __ANALYST_DATASET__?: Store };
g.__ANALYST_DATASET__ ??= { active: null, uploaded: null };
const S = g.__ANALYST_DATASET__!;

/** 当前理解结果（默认样本；上传后为上传数据） */
export function getUnderstanding(): UnderstandingResult {
  return S.active ?? buildSample();
}

/** 用户上传后：重跑理解引擎并设为活跃 */
export function setUploaded(files: DatasetFile[]): UnderstandingResult {
  const result = understand({ source: "upload", files });
  S.active = result;
  S.uploaded = {
    fileNames: files.map((f) => f.name),
    rowCount: files.reduce((s, f) => s + f.rows.length, 0),
    at: new Date().toISOString(),
  };
  return result;
}

/** 重置回内置样本 */
export function resetToSample(): UnderstandingResult {
  S.active = null;
  S.uploaded = null;
  return getUnderstanding();
}

export function isSample(): boolean {
  return S.active === null;
}

export function getUploadedSummary(): Store["uploaded"] {
  return S.uploaded;
}

/** 测试用：清空 */
export function resetDatasetStore(): void {
  S.active = null;
  S.uploaded = null;
  sampleCache = null;
}
