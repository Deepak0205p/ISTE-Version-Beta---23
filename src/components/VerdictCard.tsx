import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  TrendingDown,
  Info,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { VerdictType, ForecastPercentiles } from '../types/finance';

interface VerdictCardProps {
  verdict: VerdictType;
  itemPrice: number;
  itemName: string;
  currentBalance: number;
  forecast: ForecastPercentiles;
  safetyBuffer: number;
  monthsOfData: number;
  onSimulateExtendHistory?: () => void;
}

export const VerdictCard: React.FC<VerdictCardProps> = ({
  verdict,
  itemPrice,
  itemName,
  currentBalance,
  forecast,
  safetyBuffer,
  monthsOfData,
  onSimulateExtendHistory,
}) => {
  const postPurchaseP10 = forecast.p10;
  const headroomP10 = postPurchaseP10 - safetyBuffer;
  const headroomP50 = forecast.p50 - safetyBuffer;

  // Configuration for each verdict state
  const config = {
    YES: {
      badgeBg: 'bg-emerald-500 text-white',
      badgeBorder: 'border-emerald-600',
      cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'YES — Safe to Purchase',
      subtitle:
        'Post-purchase reserves comfortably exceed your essential buffer across all historical cashflow draws.',
      recommendation:
        'Your worst-case scenario (P10) leaves a robust buffer above your required safety threshold. Cash flow variance is low.',
    },
    TIGHT: {
      badgeBg: 'bg-amber-500 text-white',
      badgeBorder: 'border-amber-600',
      cardBg: 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60',
      icon: AlertTriangle,
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'TIGHT — Proceed with Caution',
      subtitle:
        'Affordable on median path, tight on worst-case (P10).',
      recommendation:
        'In the median path (P50), you maintain your safety buffer. However, under a 10th-percentile dip, your balance drops into your safety buffer reserve.',
    },
    NO: {
      badgeBg: 'bg-rose-600 text-white',
      badgeBorder: 'border-rose-700',
      cardBg: 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60',
      icon: XCircle,
      iconColor: 'text-rose-600 dark:text-rose-400',
      title: 'NO — High Overdraft Risk',
      subtitle:
        'High risk of buffer depletion or overdraft in conservative simulation.',
      recommendation:
        'Buying this item now leaves less than your required emergency buffer in both median and worst-case scenarios. Defer or downsize the purchase.',
    },
    REFUSED: {
      badgeBg: 'bg-slate-700 text-white',
      badgeBorder: 'border-slate-800',
      cardBg: 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700',
      icon: Clock,
      iconColor: 'text-slate-600 dark:text-slate-400',
      title: 'REFUSED — Insufficient Data (<3 Months)',
      subtitle:
        'Insufficient data (<3 months) to forecast reliably. Minimum 90 days required for moving-block bootstrap.',
      recommendation:
        'The PS-4 engine requires at least 90 sequential days of statement transactions to construct independent 30-day blocks without statistical over-fitting.',
    },
  }[verdict];

  const IconComponent = config.icon;

  return (
    <div
      className={`border rounded-2xl p-6 sm:p-7 shadow-xs mb-6 transition-all ${config.cardBg}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left Side: Verdict Badge & Description */}
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${config.badgeBg}`}
            >
              Verdict: {verdict}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Deterministic Rule Check: P10 ≥ Price + Buffer
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {config.title}
              </h3>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">
                {config.subtitle}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {config.recommendation}
              </p>
            </div>
          </div>

          {verdict === 'REFUSED' && onSimulateExtendHistory && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onSimulateExtendHistory}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-900 bg-white dark:bg-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <span>Simulate 6-Month Ingestion for Arjun (+120 Days)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Key Numbers Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 bg-white/80 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs shrink-0 lg:min-w-[420px]">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Current Balance
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              ₹{currentBalance.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Consolidated across accounts
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Purchase Cost
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              -₹{itemPrice.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {itemName}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Safety Buffer
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              ₹{safetyBuffer.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 block">
              1w essentials + overshoot
            </span>
          </div>

          <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              Worst-Case Headroom (P10 - Buffer):
            </span>
            <span
              className={`font-mono font-bold tabular-nums ${
                headroomP10 >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {headroomP10 >= 0 ? '+' : ''}₹{headroomP10.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
