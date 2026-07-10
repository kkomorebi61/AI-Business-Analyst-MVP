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

/** Data Understanding Engine 的最终输出 */
export interface UnderstandingResult {
  source: "sample" | "upload";
  classification: DataClassification;
  scenario: ScenarioResult;
  recommendations: AnalysisRecommendation[];
  gaps: GapAnalysis;
  /** 最新数据日期 = Date Anchor（doc 18 §Time Anchor Engine） */
  latestDataDate: string;
  dashboardSpec: DashboardSpec;
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
