import React, { useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Calculator,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AffordabilityAuditReceipt } from '../types/finance';

interface TransparentReceiptDrawerProps {
  receipt: AffordabilityAuditReceipt;
}

export const TransparentReceiptDrawer: React.FC<TransparentReceiptDrawerProps> = ({
  receipt,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'json'>('audit');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { formulaVariables } = receipt;
  const isPassingP10 = formulaVariables.p10ProjectedBalance >= formulaVariables.safetyBuffer;

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs mb-6 overflow-hidden">
      {/* Trigger Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                View Receipt & Formula Audit
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Computed deterministically in code (Zero LLM math)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit the exact arithmetic, data window, exclusions, and bootstrap parameters.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 hidden sm:inline">
            {isOpen ? 'Collapse Audit Receipt' : 'Expand Audit Details'}
          </span>
          <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
            {isOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content Drawer */}
      {isOpen && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-slate-950/30">
          {/* Segmented view controls */}
          <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'audit'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Key-Value Audit Breakdown
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'json'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Raw JSON Object</span>
              </button>
            </div>

            {activeTab === 'json' && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Tab 1: Key-Value Breakdown */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Formula Evaluation Box */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Deterministic Formula Evaluation
                </span>
                <div className="mt-2 text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>P10(Day 30 Balance)</span>
                  <span className="text-slate-400">≥</span>
                  <span>Safety Buffer</span>
                </div>

                <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">Evaluation:</span>
                    <strong className="text-slate-900 dark:text-white font-bold">
                      ₹{formulaVariables.p10ProjectedBalance.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-slate-400">≥</span>
                    <strong className="text-slate-900 dark:text-white font-bold">
                      ₹{formulaVariables.safetyBuffer.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-slate-400">→</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-xs ${
                        isPassingP10
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {isPassingP10
                        ? `Pass (+₹${formulaVariables.headroomP10.toLocaleString('en-IN')} Headroom)`
                        : `Fail (-₹${Math.abs(formulaVariables.headroomP10).toLocaleString('en-IN')} Deficit)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exclusion Counter Badges */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Audit Exclusions & Neutralizations
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Internal Transfers Excluded
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {receipt.internalTransfersExcluded}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      ₹{receipt.internalTransfersAmountNetted.toLocaleString('en-IN')} netted to avoid double-counting
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Netted Failed UPI Reversals
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {receipt.nettedUpiReversalsCount}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Auto-neutralized matched pairs
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        MAD Anomalies (|M| &gt; 3.5)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {receipt.madAnomaliesExcludedCount}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Spiky outliers excluded from bootstrap variance
                    </span>
                  </div>
                </div>
              </div>

              {/* Ingestion & Ledger Parameters Key-Value Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ledger Ingestion & Simulation Parameters
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Data Window Range:</span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono">
                      {receipt.startDate} → {receipt.endDate} ({receipt.dataWindowDays} days)
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Active Accounts:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {receipt.accountsIncluded.join(', ') || 'All Active'}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Total Transactions Analyzed:</span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono">
                      {receipt.totalTransactionsParsed} records ({receipt.activeLedgerCount} net active)
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Bootstrap Configuration:</span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono">
                      {receipt.bootstrapDraws} draws · {receipt.blockSizeDays}-day sequential blocks · Seed: {receipt.deterministicSeed}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Calculation Engine:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      PS-4 Local Engine (Native TypeScript Mulberry32 + MAD)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Raw JSON Inspector */}
          {activeTab === 'json' && (
            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                {JSON.stringify(receipt, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
