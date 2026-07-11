/**
 * Date Anchor（doc 18 §Module 2 Time Anchor Engine）—— 服务端入口。
 *
 * 一切时间的基准 = 「最新数据日期」（Latest Data Date）。
 * 取内置事实表日期的最大值；**严禁使用系统当前时间**（doc18 铁律）。
 *
 * 注：上传数据的 anchor 由 Data Understanding Engine 从上传行内抽取
 * （UnderstandingResult.latestDataDate）；本文件服务于「默认样本」口径。
 */

import { getFacts } from "@/lib/data/csv-engine";
import { maxDateString, type DateAnchor } from "@/lib/data/time";

/** Latest Data Date = 渠道 / 会员 / 企微 三张事实表日期的最大值（取自当前 Active Dataset） */
export function getLatestDataDate(): string {
  const f = getFacts();
  return maxDateString([
    ...f.channel.map((r) => r.date),
    ...f.member.map((r) => r.date),
    ...f.scrm.map((r) => r.date),
  ]);
}

export function getDateAnchor(): DateAnchor {
  return { latestDataDate: getLatestDataDate() };
}
