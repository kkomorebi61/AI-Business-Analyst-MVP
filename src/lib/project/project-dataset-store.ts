/**
 * 项目级数据集仓库（服务端进程内，globalStore 模式，仿 project-store.ts / dataset-store.ts）。
 *
 * Sprint 1 · Data Collection Module V2：数据归属按项目。每个 Project 1:N ProjectDatasetRecord。
 *   - success 记录保留原始 files，供项目激活时合并复算 understanding（dataset-store.setActiveProject）；
 *   - failed 记录只留 schema.rawColumns + ingestError（不入库、不合并），用于「失败可追溯 + 重新上传」；
 *   - origin 预留 "sync"（未来系统自动同步接入时同表混显）。
 *
 * 无 DB、无落盘（对齐 MVP）；HMR 下 globalThis guard 保单例。后续替换为 SQLite+Prisma 时，
 * 仅替换本文件实现，上层（API / dataset-store 合并）签名不变。
 */

import { buildFacts } from "@/lib/data/fact-table-builder";
import { understand } from "@/lib/data-understanding/engine";
import type { DatasetFile, UnderstandingResult } from "@/lib/data-understanding/types";
import type {
  IngestOutcome,
  ProjectDatasetRecord,
  ProjectDatasetSummary,
} from "./project-dataset-types";

interface Store {
  /** datasetId → record（扁平；record.projectId 标归属） */
  records: Map<string, ProjectDatasetRecord>;
}

const g = globalThis as unknown as { __ANALYST_PROJECT_DATASETS__?: Store };
g.__ANALYST_PROJECT_DATASETS__ ??= { records: new Map() };
const S = g.__ANALYST_PROJECT_DATASETS__!;

/* ------------------------------- 内部工具 ------------------------------- */

function newId(): string {
  return `pds-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function toSummary(r: ProjectDatasetRecord): ProjectDatasetSummary {
  const { files: _files, ...summary } = r;
  void _files;
  return summary;
}

/* --------------------------------- 读取 --------------------------------- */

/** 某项目的全部数据集摘要（按上传时间倒序；不含 files） */
export function listProjectDatasets(projectId: string): ProjectDatasetSummary[] {
  return Array.from(S.records.values())
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => b.uploadTime.localeCompare(a.uploadTime))
    .map(toSummary);
}

/** 单条完整记录（不存在返回 null） */
export function getProjectDataset(
  projectId: string,
  datasetId: string,
): ProjectDatasetRecord | null {
  const r = S.records.get(datasetId);
  if (!r || r.projectId !== projectId) return null;
  return { ...r, files: r.files.map((f) => ({ ...f, rows: f.rows })) };
}

/** 某项目的 success 数据集（完整，含 files）——驱动激活合并 */
export function getSuccessDatasets(projectId: string): ProjectDatasetRecord[] {
  return Array.from(S.records.values()).filter(
    (r) => r.projectId === projectId && r.ingestStatus === "success",
  );
}

/** 某项目是否有至少一份 success 数据集（「进入数据体检」门控） */
export function hasSuccessDataset(projectId: string): boolean {
  return Array.from(S.records.values()).some(
    (r) => r.projectId === projectId && r.ingestStatus === "success",
  );
}

/* --------------------------------- 写入 --------------------------------- */

/** 新增一条记录（生成 id/uploadTime） */
export function addProjectDataset(
  projectId: string,
  rec: Omit<ProjectDatasetRecord, "id" | "projectId" | "uploadTime">,
): ProjectDatasetRecord {
  const record: ProjectDatasetRecord = {
    ...rec,
    id: newId(),
    projectId,
    uploadTime: new Date().toISOString(),
  };
  S.records.set(record.id, record);
  return { ...record, files: record.files };
}

/** 删除一条记录（不存在或不属于该项目返回失败） */
export function deleteProjectDataset(
  projectId: string,
  datasetId: string,
): { ok: boolean; reason?: string } {
  const r = S.records.get(datasetId);
  if (!r || r.projectId !== projectId) return { ok: false, reason: "数据集不存在" };
  S.records.delete(datasetId);
  return { ok: true };
}

/** 删除某项目的全部数据集（项目删除级联用） */
export function clearProjectDatasets(projectId: string): number {
  let n = 0;
  for (const [id, r] of Array.from(S.records.entries())) {
    if (r.projectId === projectId) {
      S.records.delete(id);
      n++;
    }
  }
  return n;
}

/** 测试用：清空全部 */
export function resetProjectDatasetStore(): void {
  S.records = new Map();
}

/* ----------------------- 入库工厂（失败矩阵） ----------------------- */

/**
 * 把已解析的 DatasetFile[] 加工成一条 ProjectDatasetRecord（+ 成功时的 understanding）。
 * 失败矩阵：
 *   - files 为空（无有效数据行）                    → failed「CSV 无有效数据行」
 *   - buildFacts 入库总行数 0 且 rawDetected        → failed「原始流水，请按日聚合后上传」
 *   - buildFacts 入库总行数 0 且非 raw              → failed「未识别规范字段，请用标准列名」
 *   - 总行数 > 0                                    → success（保留 files）
 */
export function buildDatasetRecordFromIngest(
  projectId: string,
  files: DatasetFile[],
): IngestOutcome {
  const rawColumns = Array.from(new Set(files.flatMap((f) => f.columns)));
  const displayName =
    files.length === 0
      ? "空上传"
      : files.length > 1
        ? `${files[0].name} 等 ${files.length} 个文件`
        : files[0].name;

  // 1) 无文件 / 无有效行
  if (files.length === 0 || files.every((f) => f.rows.length === 0)) {
    return {
      record: {
        id: "", // addProjectDataset 填充
        projectId,
        name: displayName,
        origin: "upload",
        ingestStatus: "failed",
        ingestError: "CSV 无有效数据行，请检查文件内容",
        schema: { matchedByTable: {}, rawColumns },
        recordCount: 0,
        rowsByTable: {},
        files: [],
        uploadTime: "",
      },
      understanding: null,
    };
  }

  const { facts, diagnostics } = buildFacts(files);
  const totalRows = Object.values(diagnostics.rowsByTable).reduce((a, b) => a + b, 0);

  // 2/3) 入库 0 行
  if (totalRows === 0) {
    const ingestError = diagnostics.rawDetected
      ? "检测到原始事务流水（order_id/member_id 等），请按日聚合后上传（按日 × 渠道/会员/企微）"
      : "未识别到规范字段，请使用标准列名（如 gmv / orders / total_members）";
    return {
      record: {
        id: "",
        projectId,
        name: displayName,
        origin: "upload",
        ingestStatus: "failed",
        ingestError,
        schema: { matchedByTable: {}, rawColumns },
        recordCount: 0,
        rowsByTable: diagnostics.rowsByTable,
        files: [],
        uploadTime: "",
      },
      understanding: null,
    };
  }

  // 4) 成功
  const understanding: UnderstandingResult = {
    ...understand({ source: "upload", files }),
    uploadDiagnostics: diagnostics,
  };
  return {
    record: {
      id: "",
      projectId,
      name: displayName,
      origin: "upload",
      ingestStatus: "success",
      ingestError: null,
      schema: { matchedByTable: diagnostics.matchedByTable, rawColumns },
      recordCount: totalRows,
      rowsByTable: diagnostics.rowsByTable,
      files,
      uploadTime: "",
    },
    understanding,
  };
}
