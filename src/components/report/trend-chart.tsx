"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";

/**
 * GMV 日趋势图（纯 SVG，零第三方依赖）。
 * 当期日序列随时间范围变化 —— 切换 7/14/30 天自动重绘。
 */
export default function TrendChart({
  data,
  rangeLabel,
}: {
  data: { date: string; gmv: number }[];
  rangeLabel: string;
}) {
  const W = 720;
  const H = 200;
  const pad = { l: 10, r: 10, t: 16, b: 26 };

  const { linePath, areaPath, points, ticks } = useMemo(() => {
    if (!data.length) return { linePath: "", areaPath: "", points: [], ticks: [] };
    const gmv = data.map((d) => d.gmv);
    const min = Math.min(...gmv);
    const max = Math.max(...gmv);
    const span = max - min || 1;
    const n = data.length;
    const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
    const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - min) / span);

    const line = data
      .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.gmv).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${x(n - 1).toFixed(1)} ${H - pad.b} L${x(0).toFixed(1)} ${H - pad.b} Z`;
    const pts = data.map((d, i) => ({ x: x(i), y: y(d.gmv), date: d.date, gmv: d.gmv }));

    // 横轴标签：均匀取 ~5 个
    const count = Math.min(5, n);
    const tk = Array.from({ length: count }, (_, k) => {
      const i = Math.round((k * (n - 1)) / Math.max(1, count - 1));
      return { x: x(i), label: fmtDate(data[i].date) };
    });

    return { linePath: line, areaPath: area, points: pts, ticks: tk };
  }, [data]);

  const last = points[points.length - 1];

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold">GMV 日趋势</span>
        <span className="text-xs text-muted-foreground">· {rangeLabel}</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label="GMV 日趋势"
      >
        <defs>
          <linearGradient id="gmv-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 网格线 */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + (H - pad.t - pad.b) * p}
            y2={pad.t + (H - pad.t - pad.b) * p}
            stroke="#eef2f7"
            strokeWidth={1}
          />
        ))}

        {areaPath && <path d={areaPath} fill="url(#gmv-area)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* 最新点高亮 */}
        {last && (
          <>
            <circle cx={last.x} cy={last.y} r={6} fill="#2563eb" fillOpacity={0.15} />
            <circle cx={last.x} cy={last.y} r={3} fill="#2563eb" />
          </>
        )}

        {/* 横轴日期 */}
        {ticks.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#94a3b8"
          >
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${m}-${d}`;
}
