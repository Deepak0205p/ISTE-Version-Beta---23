import React, { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  GitMerge,
  Eye,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Transaction } from '../types/finance';
import { COMMON_CATEGORIES } from '../mock/personasData';

interface LedgerTableProps {
  transactions: Transaction[];
  onUpdateCategory: (txnId: string, newCategory: string) => void;
  onResolveDuplicate: (txnId: string, action: 'KEEP' | 'MERGE') => void;
  onToggleMadExclusion: (txnId: string) => void;
  learnedRuleNotice: string | null;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  transactions,
  onUpdateCategory,
  onResolveDuplicate,
  onToggleMadExclusion,
  learnedRuleNotice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FLAGGED' | 'DEBIT' | 'CREDIT'>('ALL');
  const [editingCategoryTxId, setEditingCategoryTxId] = useState<string | null>(null);

  const filteredTransactions = transactions.filter((t) => {
    // Search match
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      t.normalizedMerchant.toLowerCase().includes(term) ||
      t.rawNarration.toLowerCase().includes(term) ||
      t.category.toLowerCase().includes(term) ||
      t.account.toLowerCase().includes(term) ||
      t.amount.toString().includes(term);

    if (!matchesSearch) return false;

    // Filter type match
    if (activeFilter === 'FLAGGED') {
      return (
        t.anomaly === 'DUPLICATE_P_CLASS' ||
        t.anomaly === 'NETTED_REVERSAL' ||
        t.anomaly === 'MAD_OUTLIER'
      );
    }
    if (activeFilter === 'DEBIT') return t.type === 'DEBIT';
    if (activeFilter === 'CREDIT') return t.type === 'CREDIT';

    return true;
  });

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Normalized Ledger & Anomaly Flags
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search, re-categorize, and resolve detected ledger duplicates, reversals, and MAD anomalies.
          </p>
        </div>

        {/* Filter buttons & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activeFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setActiveFilter('FLAGGED')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activeFilter === 'FLAGGED'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Flagged Anomalies
            </button>
            <button
              onClick={() => setActiveFilter('DEBIT')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activeFilter === 'DEBIT'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Debits
            </button>
            <button
              onClick={() => setActiveFilter('CREDIT')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activeFilter === 'CREDIT'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Credits
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search narration, merchant, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </div>

      {/* Learned Rule Notification Toast */}
      {learnedRuleNotice && (
        <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{learnedRuleNotice}</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Rule learned for future
          </span>
        </div>
      )}

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold">
              <th className="py-3 px-4 w-28">Date</th>
              <th className="py-3 px-4">Merchant & Bank Narration</th>
              <th className="py-3 px-4 w-44">Category (Editable)</th>
              <th className="py-3 px-4 w-28">Account</th>
              <th className="py-3 px-4 w-32 text-right">Amount (INR)</th>
              <th className="py-3 px-4 min-w-[220px]">Flags & Anomaly Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No matching ledger transactions found.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isDebit = tx.type === 'DEBIT';
                const isDuplicate = tx.anomaly === 'DUPLICATE_P_CLASS';
                const isReversal = tx.anomaly === 'NETTED_REVERSAL';
                const isMad = tx.anomaly === 'MAD_OUTLIER';

                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                      tx.duplicateMergedWith
                        ? 'opacity-40 line-through bg-slate-100/50 dark:bg-slate-900/50'
                        : ''
                    }`}
                  >
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                      {tx.date}
                    </td>

                    {/* Narration */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {tx.normalizedMerchant}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-sm">
                        {tx.rawNarration}
                      </div>
                    </td>

                    {/* Category inline edit */}
                    <td className="py-3 px-4">
                      {editingCategoryTxId === tx.id ? (
                        <select
                          value={tx.category}
                          autoFocus
                          onBlur={() => setEditingCategoryTxId(null)}
                          onChange={(e) => {
                            onUpdateCategory(tx.id, e.target.value);
                            setEditingCategoryTxId(null);
                          }}
                          className="w-full text-xs py-1 px-2 rounded border border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                        >
                          {COMMON_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingCategoryTxId(tx.id)}
                          className="group text-left text-xs text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5"
                          title="Click to re-categorize"
                        >
                          <span className="truncate">{tx.category}</span>
                          <ChevronDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </td>

                    {/* Account */}
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {tx.account}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          isDebit
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {isDebit ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                      </span>
                    </td>

                    {/* Flags & Special Actions */}
                    <td className="py-3 px-4">
                      {/* Duplicate P-Class Banner with Keep / Merge */}
                      {isDuplicate && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-semibold text-[11px] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            Possible Duplicate (P-Class)
                          </span>
                          {!tx.duplicateMergedWith && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onResolveDuplicate(tx.id, 'MERGE')}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                              >
                                Merge
                              </button>
                              <button
                                type="button"
                                onClick={() => onResolveDuplicate(tx.id, 'KEEP')}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                Keep
                              </button>
                            </div>
                          )}
                          {tx.duplicateMergedWith && (
                            <span className="text-[10px] text-slate-400 italic">
                              Merged into primary receipt
                            </span>
                          )}
                        </div>
                      )}

                      {/* Netted Reversal */}
                      {isReversal && (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-semibold text-[11px] inline-flex items-center gap-1">
                            <GitMerge className="w-3 h-3 shrink-0" />
                            Netted Reversal
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            {tx.anomalyDetails || 'Failed order refunded'}
                          </span>
                        </div>
                      )}

                      {/* MAD Anomaly Flag with toggle */}
                      {isMad && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 font-semibold text-[11px] inline-flex items-center gap-1">
                            <AlertOctagon className="w-3 h-3 shrink-0" />
                            MAD Anomaly Flag (|M| &gt; 3.5)
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleMadExclusion(tx.id)}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 transition-colors"
                          >
                            {tx.isManualOverride ? 'Include in Bootstrap' : 'Excluded from Median'}
                          </button>
                        </div>
                      )}

                      {/* Internal transfer quiet badge */}
                      {tx.category === 'Internal Transfer' && !tx.anomaly && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Internal contra-netting
                        </span>
                      )}

                      {/* Standard clean row */}
                      {!tx.anomaly && tx.category !== 'Internal Transfer' && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Reconciled</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
