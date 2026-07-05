/**
 * 渠道 GMV 明细表 ——「可验证」闭环 + 排序 / 钻取（首页 §4 / 报告页 §2 共用）
 *
 * 数据层已保证 Σ 渠道 GMV === 汇总 GMV（单一事实源 daily_channel_metrics，
 * 见 csv-engine aggregateSales/aggregateChannels 与 data-integrity 套件）。
 * 本组件把这一关系在展示层显式做出来：列出全部 6 个渠道的精确元值，
 * 并用「Σ渠道」与「汇总 GMV」两行对照、附 ✓ 校验，消除万级四舍五入带来的
 * 「各渠道加总≠汇总」观感。KPI 卡的「¥XXX万」是本表元值的四舍五入headline。
 *
 * 可选交互（首页启用，报告页不传 → 行为不变）：
 *   - onSortChange：表头 GMV/订单/ROI 可点击排序
 *   - onDrillChannel：每行尾部「钻取」入口 → 渠道二级页
 */
import { ArrowDown, Check, ChevronRight } from "lucide-react";
import type { ChannelAggregate } from "@/lib/data/csv-engine";

export type ChannelSortKey = "gmv" | "orders" | "roi";

/** 元级格式化：四舍五入到整元 + 千分位 */
function fmtYuan(v: number): string {
  return `¥${Math.round(v).toLocaleString("zh-CN")}`;
}

export default function ChannelBreakdown({
  channels,
  totalGmv,
  rangeLabel,
  sortKey = "gmv",
  onSortChange,
  onDrillChannel,
}: {
  channels: ChannelAggregate[];
  totalGmv: number;
  rangeLabel: string;
  sortKey?: ChannelSortKey;
  onSortChange?: (key: ChannelSortKey) => void;
  onDrillChannel?: (channel: string) => void;
}) {
  if (!channels.length) return null;

  const valueOf = (c: ChannelAggregate, k: ChannelSortKey) => (k === "orders" ? c.orders : c[k]);
  // 按 sortKey 降序，主要贡献居前
  const rows = [...channels].sort((a, b) => valueOf(b, sortKey) - valueOf(a, sortKey));
  const sumGmv = channels.reduce((s, c) => s + c.gmv, 0);
  const sumOrders = channels.reduce((s, c) => s + c.orders, 0);
  const share = (gmv: number) => (sumGmv ? (gmv / sumGmv) * 100 : 0);

  // 数据层已证 Σ渠道 === 汇总（同源求和，仅浮点加法顺序不同，元级显示恒等）
  const match = Math.abs(sumGmv - totalGmv) < 1;
  const hasDrill = !!onDrillChannel;
  const footColSpan = hasDrill ? 4 : 3; // 汇总行 ✓ 单元格跨列数

  /** 可排序表头单元格 */
  function SortTh({ k, label, className }: { k: ChannelSortKey; label: string; className?: string }) {
    const active = sortKey === k;
    if (!onSortChange) {
      return <th className={`px-4 py-2.5 text-right font-medium ${className ?? ""}`}>{label}</th>;
    }
    return (
      <th className={`px-4 py-2.5 text-right font-medium ${className ?? ""}`}>
        <button
          onClick={() => onSortChange(k)}
          className={`inline-flex items-center gap-0.5 hover:text-foreground ${
            active ? "text-foreground" : ""
          }`}
        >
          {label}
          <ArrowDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-0"}`} />
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#F8FAFC] text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">渠道</th>
            <SortTh k="gmv" label="GMV" />
            <th className="px-4 py-2.5 text-right font-medium">占比</th>
            <SortTh k="orders" label="订单" className="hidden sm:table-cell" />
            <SortTh k="roi" label="ROI" className="hidden sm:table-cell" />
            {hasDrill && <th className="px-4 py-2.5 text-right font-medium">操作</th>}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((c) => (
            <tr key={c.channel} className="border-t border-border">
              <td className="px-4 py-2.5 text-[13px] font-medium">{c.channel}</td>
              <td className="px-4 py-2.5 text-right text-[13px]">{fmtYuan(c.gmv)}</td>
              <td className="px-4 py-2.5 text-right text-[13px] text-muted-foreground">
                {share(c.gmv).toFixed(1)}%
              </td>
              <td className="hidden px-4 py-2.5 text-right text-[13px] text-muted-foreground sm:table-cell">
                {c.orders.toLocaleString("zh-CN")}
              </td>
              <td className="hidden px-4 py-2.5 text-right text-[13px] text-muted-foreground sm:table-cell">
                {c.roi.toFixed(1)}
              </td>
              {hasDrill && (
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => onDrillChannel?.(c.channel)}
                    className="inline-flex items-center gap-0.5 text-[12px] text-blue-600 hover:text-blue-700"
                  >
                    钻取 <ChevronRight className="h-3 w-3" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {/* Σ 各渠道 */}
          <tr className="border-t-2 border-border bg-[#F8FAFC] text-[13px] font-semibold">
            <td className="px-4 py-2.5">Σ 各渠道</td>
            <td className="px-4 py-2.5 text-right">{fmtYuan(sumGmv)}</td>
            <td className="px-4 py-2.5 text-right">100.0%</td>
            <td className="hidden px-4 py-2.5 text-right sm:table-cell">
              {sumOrders.toLocaleString("zh-CN")}
            </td>
            <td className="hidden px-4 py-2.5 text-right text-muted-foreground sm:table-cell">—</td>
            {hasDrill && <td className="px-4 py-2.5" />}
          </tr>
          {/* 汇总 GMV（KPI 同源口径） */}
          <tr className="border-t border-border bg-[#F8FAFC] text-[13px] font-semibold">
            <td className="px-4 py-2.5">汇总 GMV</td>
            <td className="px-4 py-2.5 text-right">{fmtYuan(totalGmv)}</td>
            <td className="px-4 py-2.5 text-right" colSpan={footColSpan}>
              {match ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                  Σ渠道 = 汇总
                </span>
              ) : (
                <span className="font-medium text-amber-600">
                  差异 {fmtYuan(sumGmv - totalGmv)}（数据源不一致，请核查）
                </span>
              )}
            </td>
            {hasDrill && <td className="px-4 py-2.5" />}
          </tr>
        </tfoot>
      </table>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        {rangeLabel}·全部 {rows.length} 个渠道；金额为精确元值，KPI 卡的「万」级显示为其四舍五入。
      </p>
    </div>
  );
}
