import React, { useState } from 'react';
import {
  Sliders,
  TrendingDown,
  TrendingUp,
  Activity,
  Layers,
  Shield,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { ForecastPercentiles, BufferComponents } from '../types/finance';

interface ForecastDistributionProps {
  forecast: ForecastPercentiles;
  bufferComponents: BufferComponents;
  currentBuffer: number;
  onChangeBuffer: (newBuffer: number) => void;
  currentBalance: number;
  itemPrice: number;
}

export const ForecastDistribution: React.FC<ForecastDistributionProps> = ({
  forecast,
  bufferComponents,
  currentBuffer,
  onChangeBuffer,
  currentBalance,
  itemPrice,
}) => {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const { p10, p50, p90, dayByDayProjection } = forecast;

  // Compute graph bounds
  const allValues = dayByDayProjection.flatMap((d) => [d.p10, d.p50, d.p90]);
  const minValue = Math.min(...allValues, 0, currentBuffer);
  const maxValue = Math.max(...allValues, currentBalance, currentBuffer + 20000);
  const range = Math.max(1, maxValue - minValue);

  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (day: number) => padding.left + (day / 30) * chartW;
  const getY = (val: number) => padding.top + chartH - ((val - minValue) / range) * chartH;

  // Build SVG path strings
  const p10Path = dayByDayProjection
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.day).toFixed(1)} ${getY(d.p10).toFixed(1)}`)
    .join(' ');

  const p50Path = dayByDayProjection
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.day).toFixed(1)} ${getY(d.p50).toFixed(1)}`)
    .join(' ');

  const p90Path = dayByDayProjection
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.day).toFixed(1)} ${getY(d.p90).toFixed(1)}`)
    .join(' ');

  // Ribbon area between p10 and p90
  const ribbonPath = `${p10Path} ${dayByDayProjection
    .slice()
    .reverse()
    .map((d) => `L ${getX(d.day).toFixed(1)} ${getY(d.p90).toFixed(1)}`)
    .join(' ')} Z`;

  const bufferY = getY(currentBuffer);
  const zeroY = getY(0);

  const activePoint =
    hoveredDay !== null
      ? dayByDayProjection.find((d) => d.day === hoveredDay) || dayByDayProjection[30]
      : dayByDayProjection[30];

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 shadow-xs mb-6">
      {/* Header and Method Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              30-Day Cashflow Forecast Distribution
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              Moving-block bootstrap (500 draws, 30-day blocks)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Simulates 500 potential month paths using sequential 30-day blocks sampled from your historical bank records.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>P10 (Worst-Case)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>P50 (Median)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>P90 (Best-Case)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Forecast Visualizer + Interactive Buffer Slider */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
        {/* SVG Chart & Band Representation (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800">
            {/* SVG Visualizer */}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none"
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const val = minValue + ratio * range;
                const y = getY(val);
                return (
                  <g key={ratio}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray="2 3"
                      className="text-slate-200 dark:text-slate-800/80"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      ₹{Math.round(val / 1000)}k
                    </text>
                  </g>
                );
              })}

              {/* Zero Line if in view */}
              {minValue < 0 && (
                <line
                  x1={padding.left}
                  y1={zeroY}
                  x2={width - padding.right}
                  y2={zeroY}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="text-rose-400/60 dark:text-rose-500/40"
                />
              )}

              {/* Safety Buffer Target Line */}
              <line
                x1={padding.left}
                y1={bufferY}
                x2={width - padding.right}
                y2={bufferY}
                stroke="#d97706"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={width - padding.right}
                y={bufferY - 6}
                textAnchor="end"
                className="text-[10px] fill-amber-600 dark:fill-amber-400 font-semibold"
              >
                Buffer Floor (₹{currentBuffer.toLocaleString('en-IN')})
              </text>

              {/* Confidence Ribbon between P10 and P90 */}
              <path
                d={ribbonPath}
                className="fill-emerald-500/10 dark:fill-emerald-400/10"
              />

              {/* P90 Line */}
              <path
                d={p90Path}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeLinecap="round"
                className="opacity-70"
              />

              {/* P50 Median Line */}
              <path
                d={p50Path}
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeLinecap="round"
              />

              {/* P10 Conservative Line */}
              <path
                d={p10Path}
                fill="none"
                stroke="#f43f5e"
                strokeWidth={2}
                strokeLinecap="round"
              />

              {/* Day Labels on X Axis */}
              {[0, 7, 14, 21, 30].map((d) => (
                <g key={d}>
                  <text
                    x={getX(d)}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-mono"
                  >
                    Day {d}
                  </text>
                </g>
              ))}

              {/* Interactive Hover Probe */}
              {activePoint && (
                <g>
                  <line
                    x1={getX(activePoint.day)}
                    y1={padding.top}
                    x2={getX(activePoint.day)}
                    y2={height - padding.bottom}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-slate-400 dark:text-slate-600"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={getX(activePoint.day)}
                    cy={getY(activePoint.p50)}
                    r={4}
                    className="fill-emerald-500 stroke-white dark:stroke-slate-900"
                    strokeWidth={2}
                  />
                  <circle
                    cx={getX(activePoint.day)}
                    cy={getY(activePoint.p10)}
                    r={3.5}
                    className="fill-rose-500 stroke-white dark:stroke-slate-900"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={getX(activePoint.day)}
                    cy={getY(activePoint.p90)}
                    r={3.5}
                    className="fill-blue-500 stroke-white dark:stroke-slate-900"
                    strokeWidth={1.5}
                  />
                </g>
              )}

              {/* Invisible interactive hover bars */}
              {dayByDayProjection.map((d) => (
                <rect
                  key={d.day}
                  x={getX(d.day) - (chartW / 60)}
                  y={padding.top}
                  width={chartW / 30}
                  height={chartH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredDay(d.day)}
                />
              ))}
            </svg>

            {/* Hover details badge */}
            <div className="flex items-center justify-between text-xs px-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Day {activePoint.day} Forecast Projection:
              </span>
              <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  P10: ₹{activePoint.p10.toLocaleString('en-IN')}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  P50: ₹{activePoint.p50.toLocaleString('en-IN')}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  P90: ₹{activePoint.p90.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Percentile Visual Band Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold tracking-wider block">
                P10 (Worst-Case)
              </span>
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums block mt-0.5">
                ₹{p10.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                10% probability balance drops below this
              </span>
            </div>

            <div className="p-3 rounded-lg border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-wider block">
                P50 (Median Path)
              </span>
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums block mt-0.5">
                ₹{p50.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Expected central trajectory at Day 30
              </span>
            </div>

            <div className="p-3 rounded-lg border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20">
              <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold tracking-wider block">
                P90 (Best-Case)
              </span>
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums block mt-0.5">
                ₹{p90.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Optimistic inflows, minimal spikes
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Safety Buffer Slider Section (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Interactive Safety Buffer
                </h4>
              </div>
              <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                ₹{currentBuffer.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Adjust minimum liquidity floor required after purchasing. Recalculates verdict instantly.
            </p>

            {/* Live Range Slider */}
            <div className="mt-4 space-y-2">
              <input
                type="range"
                min={0}
                max={50000}
                step={1000}
                value={currentBuffer}
                onChange={(e) => onChangeBuffer(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>₹0</span>
                <span>₹25,000</span>
                <span>₹50,000</span>
              </div>
            </div>

            {/* Sub-breakdown badges */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-2.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Recommended Buffer Breakdown:
              </span>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Worst-month variable overshoot:
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  ₹{bufferComponents.worstMonthVariableOvershoot.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  1 week of essentials:
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  ₹{bufferComponents.oneWeekEssentials.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-xs">
                <span className="font-medium text-emerald-800 dark:text-emerald-300">
                  Sum of recommended buffer:
                </span>
                <button
                  type="button"
                  onClick={() => onChangeBuffer(bufferComponents.userBufferTotal)}
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white font-mono tabular-nums transition-colors"
                  title="Click to reset slider to recommended amount"
                >
                  Reset to ₹{bufferComponents.userBufferTotal.toLocaleString('en-IN')}
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-2">
            Tip: Sliding buffer above ₹{p10.toLocaleString('en-IN')} will flip verdict to TIGHT or NO.
          </div>
        </div>
      </div>
    </div>
  );
};
