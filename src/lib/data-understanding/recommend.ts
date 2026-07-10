/**
 * Module 3 · Analysis Recommendation Engine（doc 19 §Module 3）
 *
 * 按已识别的数据类型，自动推荐可做的分析项。
 * 纯函数、无 fs。
 */

import type { AnalysisRecommendation, DataSetType } from "./types";

const RECS: Record<DataSetType, string[]> = {
  crm: ["会员增长分析", "会员分层", "RFM 分析", "复购分析", "生命周期价值（LTV）分析"],
  oms: ["GMV 趋势分析", "渠道分析", "商品分析", "客单价分析", "经营趋势分析"],
  marketing: ["ROI 分析", "活动效果分析", "渠道投放分析"],
  scrm: ["好友增长分析", "导购分析", "触达分析", "转化分析"],
  product: ["商品分析", "库存分析"],
};

const DATA_TYPE_LABEL: Record<DataSetType, string> = {
  crm: "CRM 会员",
  oms: "OMS 订单",
  marketing: "营销投放",
  scrm: "企微/私域",
  product: "商品",
};

export function recommend(detected: DataSetType[]): AnalysisRecommendation[] {
  const out: AnalysisRecommendation[] = [];
  for (const t of detected) {
    for (const title of RECS[t] ?? []) {
      out.push({ id: `${t}-${title}`, title, dataType: t });
    }
  }
  return out;
}

export const DATA_TYPE_LABELS = DATA_TYPE_LABEL;
