/**
 * Data Understanding Engine 类型（doc 19）
 *
 * 纯类型模块（无 fs / 无时钟），供 engine / classify / scenario / recommend / gap
 * 以及 dataset-store、/upload、/api/understanding 共用。
 */

import type { MetricKey } from "@/lib/kb/metric-kb";

/** 数据类型（doc 19 §Module 1 Data Classification 的五类） */
export type DataSetType = "crm" | "oms" | "marketing" | "scrm" | "product";

/** 单类数据的识别结果 */
export interface DetectedDataset {
  type: DataSetType;
  /** 命中的字段签名（raw + aggregated） */
  matchedFields: string[];
  /** 该类数据涉及的行数 */
  rowCount: number;
  /** 该类数据涉及的全部列名 */
  columns: string[];
}

export interface DataClassification {
  detected: DataSetType[];
  perType: DetectedDataset[];
}

/** 业务场景（doc 19 §Module 2 Business Scenario Identification） */
export type BusinessScenario =
  | "member_growth" // A: CRM + OMS  会员增长运营
  | "operations" // B: OMS          经营分析
  | "roi" // C: OMS + Marketing ROI 分析
  | "omnichannel" // D: CRM + OMS + SCRM 全渠道用户运营
  | "custom";

export interface ScenarioResult {
  scenarios: BusinessScenario[];
  primary: BusinessScenario;
  reason: string;
}

/** 推荐分析项（doc 19 §Module 3） */
export interface AnalysisRecommendation {
  id: string;
  title: string;
  dataType: DataSetType;
}

/** 数据缺口（doc 19 §Module 4 Capability Gap Analysis） */
export interface DataGap {
  metric: string;
  reason: string;
  recommendUpload: DataSetType;
}

export interface GapAnalysis {
  canAnalyze: string[]; // 指标名
  cannotAnalyze: DataGap[];
}

/** 动态驾驶舱规格（doc 19 §Module 5 Dashboard Generator） */
export interface DashboardSpec {
  scenario: BusinessScenario;
  sections: { id: string; title: string; metrics: MetricKey[] }[];
}

/** 数据日期跨度（min/max + 去重天数）——「分析范围 = 上传范围」的事实依据 */
export interface DateRange {
  /** 最早数据日期（左边界） */
  minDate: string;
  /** 最新数据日期（右边界 = Date Anchor） */
  maxDate: string;
  /** 去重后的天数 = 可分析范围的上限 */
  dayCount: number;
}

/** 上传入库诊断（仅 source="upload" 时存在；结构化，由 Fact Table Builder 填充） */
export interface UploadDiagnostics {
  /** 是否检测到 raw 事务流水（需提示「请按日聚合后上传」） */
  rawDetected: boolean;
  /** 未映射到任何规范字段的用户列名 */
  unmappedColumns: string[];
  /** 各规范事实表入库行数 */
  rowsByTable: Record<string, number>;
}

/** Data Understanding Engine 的最终输出 */
export interface UnderstandingResult {
  source: "sample" | "upload";
  classification: DataClassification;
  scenario: ScenarioResult;
  recommendations: AnalysisRecommendation[];
  gaps: GapAnalysis;
  /** 最新数据日期 = Date Anchor（doc 18 §Time Anchor Engine）；≡ dateRange.maxDate（保留以向后兼容） */
  latestDataDate: string;
  /** 数据日期跨度：分析范围以此为上限（上传多少天 = 多少天分析范围，不回落样本、不越界） */
  dateRange: DateRange;
  dashboardSpec: DashboardSpec;
  /** 上传入库诊断（样本时为 undefined） */
  uploadDiagnostics?: UploadDiagnostics;
}

/* ------------------------------ 输入 ------------------------------ */

/** 一份上传/样本文件（已解析为行列） */
export interface DatasetFile {
  name: string;
  columns: string[];
  rows: Record<string, string>[];
}

export interface UnderstandingInput {
  source: "sample" | "upload";
  files: DatasetFile[];
}
