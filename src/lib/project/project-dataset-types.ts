/**
 * Project-scoped Dataset 实体（Data Collection Module V2 · Sprint 1）。
 *
 * 数据归属按项目（by project）：每条上传/同步数据记录挂在一个 Project 下，可追溯、
 * 可追加、可删除。区别于 dataset-store 的「全局沙盒数据集」——本实体不参与全局
 * activeId 切换，而是由项目激活时把该项目的 success 数据集合并写入 csv-engine 单例。
 *
 * 持久化 = 进程内 globalStore（project-dataset-store.ts），与 dataset-store /
 * project-store 同口径（无 DB、HMR guard）。origin 预留 "sync" 供未来系统自动同步
 * 接入——届时只需往项目追加 origin:"sync" 的记录，合并/展示逻辑零改动。
 */

import type { FactTableKind } from "@/lib/data/fact-table-builder";
import type {
  DatasetFile,
  UnderstandingResult,
} from "@/lib/data-understanding/types";

/** 入库结果状态（驱动列表徽标 + 「进入数据体检」门控） */
export type IngestStatus = "success" | "processing" | "failed";

/** 数据来源：upload（用户上传）/ sync（预留：系统自动同步） */
export type DatasetOrigin = "upload" | "sync";

/** 入库时捕获的 schema（驱动删除/重传 + 字段规范「缺少字段」提示） */
export interface DatasetSchema {
  /** 命中的规范字段（按事实表分组；仅 success 有值） */
  matchedByTable: Partial<Record<FactTableKind, string[]>>;
  /** 用户原始列名（始终捕获；failed 时是排错的唯一线索） */
  rawColumns: string[];
}

/** 项目级数据集完整记录（服务端，含原始文件供激活合并复算 understanding） */
export interface ProjectDatasetRecord {
  id: string;
  projectId: string;
  /** 展示名（文件名，或「x 等 N 个文件」） */
  name: string;
  origin: DatasetOrigin;
  ingestStatus: IngestStatus;
  /** failed 时的人话原因；success/processing 为 null */
  ingestError: string | null;
  schema: DatasetSchema;
  /** 入库行数合计（failed = 0） */
  recordCount: number;
  /** 各事实表入库行数 */
  rowsByTable: Record<string, number>;
  /** 解析后的原始文件——仅 success 保留（激活合并复算 understanding 用）；failed 为 [] */
  files: DatasetFile[];
  uploadTime: string;
}

/** 列表/摘要形态（不含 files，回前端） */
export type ProjectDatasetSummary = Omit<ProjectDatasetRecord, "files">;

/** buildDatasetRecordFromIngest 的返回（成功时附 understanding 供激活合并复算） */
export interface IngestOutcome {
  record: ProjectDatasetRecord;
  /** 仅 success 非 null */
  understanding: UnderstandingResult | null;
}
