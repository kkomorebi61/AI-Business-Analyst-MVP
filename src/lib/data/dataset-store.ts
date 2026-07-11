/**
 * 数据集集合 + 活跃数据集存储（服务端进程内，globalStore 模式，仿 cost-store.ts）。
 *
 * Dataset Visibility：系统始终知道「当前在分析哪份数据」。
 *   - datasets：用户上传过的数据集集合（内存，不落盘 —— 对齐 MVP 范围）。
 *   - activeId：当前激活数据集（"sample" 或某 datasetId）；所有引擎经 csv-engine.getFacts() 读它。
 *   - sample 为虚拟数据集（不入 map，惰性构建），保证 No Empty Dashboard。
 *
 * Data First 升级：/upload 上传后由 Fact Table Builder 构建规范事实表，新建数据集并入集合、
 * 挂为活跃。**此后 Dashboard / Metric / Query / Insight 所有指标均从此数据集计算，不再回落样本。**
 *
 * 切换/删除只改 activeId 与 csv-engine 的 Active Facts；查询缓存的清空放在路由层
 * （避免数据层反向依赖路由层）。无 DB、无落盘；HMR 下 globalThis guard 保单例。
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  parseCsvText,
  setActiveFacts,
  resetFacts,
  getSampleFacts,
  type Facts,
} from "@/lib/data/csv-engine";
import { buildFacts } from "@/lib/data/fact-table-builder";
import { understand } from "@/lib/data-understanding/engine";
import type {
  DatasetFile,
  DateRange,
  UnderstandingResult,
} from "@/lib/data-understanding/types";

const DATA_DIR = join(process.cwd(), "data");
const SAMPLE_ID = "sample";

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
let sampleUnderstanding: UnderstandingResult | null = null;
function buildSample(): UnderstandingResult {
  if (!sampleUnderstanding) {
    sampleUnderstanding = understand({ source: "sample", files: loadSampleFiles() });
  }
  return sampleUnderstanding;
}

/** 三张分析事实表的总行数（=「记录数」口径，channel+member+scrm） */
function recordCountOf(f: Facts): number {
  return f.channel.length + f.member.length + f.scrm.length;
}

/* ------------------------------- 数据模型 ------------------------------- */

/** 数据集摘要（前端展示 / 列表用；不含 facts 与完整 understanding） */
export interface DatasetSummary {
  datasetId: string;
  name: string;
  sourceType: "sample" | "upload";
  datasetTypes: string[];
  fileNames: string[];
  uploadTime: string | null;
  dateRange: DateRange;
  latestDataDate: string;
  recordCount: number;
  status: "active" | "archived";
}

/** 完整数据集记录（服务端用，含 facts 供切换） */
export interface DatasetInfo extends DatasetSummary {
  facts: Facts;
  understanding: UnderstandingResult;
}

interface Store {
  /** 上传数据集集合（sample 虚拟，不入 map） */
  datasets: Map<string, DatasetInfo>;
  /** 当前激活：SAMPLE_ID 或某 datasetId */
  activeId: string;
}

const g = globalThis as unknown as { __ANALYST_DATASET__?: Store };
g.__ANALYST_DATASET__ ??= { datasets: new Map(), activeId: SAMPLE_ID };
const S = g.__ANALYST_DATASET__!;

/* ------------------------------- 内部工具 ------------------------------- */

/** 构造 sample 虚拟数据集信息（与当前激活无关，独立取样本事实表） */
function sampleInfo(): DatasetInfo {
  const u = buildSample();
  const f = getSampleFacts();
  return {
    datasetId: SAMPLE_ID,
    name: "内置样本（90 天演示数据）",
    sourceType: "sample",
    datasetTypes: u.classification.detected,
    fileNames: SAMPLE_FILES.slice(),
    uploadTime: null,
    dateRange: u.dateRange,
    latestDataDate: u.latestDataDate,
    recordCount: recordCountOf(f),
    status: S.activeId === SAMPLE_ID ? "active" : "archived",
    facts: f,
    understanding: u,
  };
}

function toSummary(d: DatasetInfo): DatasetSummary {
  const { facts: _facts, understanding: _u, ...summary } = d;
  void _facts;
  void _u;
  return summary;
}

/* --------------------------------- 读取 --------------------------------- */

/** 当前激活数据集（完整；永远是 sample 或某个上传数据集） */
export function getCurrentDataset(): DatasetInfo {
  if (S.activeId === SAMPLE_ID || !S.datasets.has(S.activeId)) return sampleInfo();
  return S.datasets.get(S.activeId)!;
}

/** 当前激活数据集摘要（前端 / Current Dataset Card 用，不含 facts/understanding） */
export function getCurrentDatasetSummary(): DatasetSummary {
  return toSummary(getCurrentDataset());
}

/** 当前理解结果（向后兼容；= 当前激活数据集的 understanding） */
export function getUnderstanding(): UnderstandingResult {
  return getCurrentDataset().understanding;
}

/** 是否正在使用内置样本 */
export function isSample(): boolean {
  return S.activeId === SAMPLE_ID;
}

/** 上传摘要（向后兼容；仅当前激活为上传数据集时有值） */
export function getUploadedSummary(): { fileNames: string[]; rowCount: number; at: string } | null {
  if (S.activeId === SAMPLE_ID) return null;
  const d = S.datasets.get(S.activeId);
  if (!d) return null;
  return { fileNames: d.fileNames, rowCount: d.recordCount, at: d.uploadTime ?? "" };
}

/** 数据集列表（含 sample；按 active 优先、上传时间倒序；返回摘要，不含 facts） */
export function listDatasets(): DatasetSummary[] {
  const list: DatasetSummary[] = [toSummary(sampleInfo())];
  for (const d of Array.from(S.datasets.values())) {
    list.push(toSummary({ ...d, status: d.datasetId === S.activeId ? "active" : "archived" }));
  }
  list.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return (b.uploadTime ?? "").localeCompare(a.uploadTime ?? "");
  });
  return list;
}

/* --------------------------------- 写入 --------------------------------- */

/**
 * 用户上传：
 *   ① Fact Table Builder 构建（规范化）事实表；
 *   ② 新建数据集记录并入集合；
 *   ③ 挂为活跃（替换样本，成为唯一分析源）。
 * 返回该数据集的 UnderstandingResult（向后兼容 /upload 响应）。
 */
export function setUploaded(files: DatasetFile[]): UnderstandingResult {
  const { facts, diagnostics } = buildFacts(files);
  const understanding: UnderstandingResult = {
    ...understand({ source: "upload", files }),
    uploadDiagnostics: diagnostics,
  };

  const primary = files[0]?.name ?? "uploaded";
  const name = files.length > 1 ? `${primary} 等 ${files.length} 个文件` : primary;
  const id = `ds-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

  const info: DatasetInfo = {
    datasetId: id,
    name,
    sourceType: "upload",
    datasetTypes: understanding.classification.detected,
    fileNames: files.map((f) => f.name),
    uploadTime: new Date().toISOString(),
    dateRange: understanding.dateRange,
    latestDataDate: understanding.latestDataDate,
    recordCount: recordCountOf(facts),
    status: "active",
    facts,
    understanding,
  };

  S.datasets.set(id, info);
  S.activeId = id;
  setActiveFacts(facts);
  return understanding;
}

/** 切换激活数据集（同步 csv-engine Active Facts；缓存清空由路由层负责） */
export function switchDataset(id: string): DatasetSummary {
  if (id === SAMPLE_ID) {
    S.activeId = SAMPLE_ID;
    resetFacts();
  } else {
    const d = S.datasets.get(id);
    if (!d) throw new Error(`数据集不存在: ${id}`);
    S.activeId = id;
    setActiveFacts(d.facts);
  }
  return toSummary(getCurrentDataset());
}

/** 删除数据集（不可删 sample；不可删当前激活） */
export function deleteDataset(id: string): { ok: boolean; reason?: string } {
  if (id === SAMPLE_ID) return { ok: false, reason: "内置样本不可删除" };
  if (id === S.activeId) return { ok: false, reason: "不可删除当前激活数据集，请先切换至其它数据集" };
  if (!S.datasets.delete(id)) return { ok: false, reason: "数据集不存在" };
  return { ok: true };
}

/** 重置激活为内置样本（保留已上传数据集，供 Dataset Manager 切换） */
export function resetToSample(): UnderstandingResult {
  S.activeId = SAMPLE_ID;
  resetFacts();
  return getUnderstanding();
}

/** 测试用：清空全部（集合 + 激活 + 样本缓存） */
export function resetDatasetStore(): void {
  S.datasets = new Map();
  S.activeId = SAMPLE_ID;
  resetFacts();
  sampleUnderstanding = null;
}
