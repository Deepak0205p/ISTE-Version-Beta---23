"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFinancial } from "@/context/FinancialContext";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";

export interface AffordabilityTransaction {
  id: string;
  account_id: string;
  date: string;
  description: string;
  raw_desc: string;
  merchant: string;
  amount_paise: number;
  signed_amount_paise: number;
  direction: "credit" | "debit";
  category: string;
  is_duplicate: boolean;
  flags: Record<string, unknown>;
}

export interface AffordabilityRecurringItem {
  merchant: string;
  typical_amount_paise: number;
  frequency: string;
  interval_days: number;
  occurrences: number;
  last_date: string;
  next_expected_date: string;
  monthly_equivalent_paise: number;
}

export interface AffordabilityAnomalyFlag {
  tx_id: string;
  date: string;
  merchant: string;
  amount_paise: number;
  reason: string;
  ensemble_score: number;
}

export interface AffordabilityForecastPoint {
  week_start: string;
  point_paise: number;
  lo80_paise: number;
  hi80_paise: number;
}

export interface AffordabilityReport {
  target_amount_paise: number;
  current_balance_paise: number;
  expected_income_paise: number;
  income_range_min_paise: number;
  income_range_max_paise: number;
  income_is_variable: boolean;
  committed_payments_paise: number;
  average_variable_spend_paise: number;
  safety_buffer_paise: number;
  safety_buffer_rule: string;
  free_cash_before_purchase_paise: number;
  net_after_purchase_paise: number;
  verdict: "YES" | "TIGHT" | "NO" | "REFUSED";
  refusal_reason: string | null;
  distinct_months: number;
  span_days: number;
  committed_breakdown: Array<{
    merchant: string;
    amount_paise: number;
    frequency: string;
    next_expected_date: string;
  }>;
  variable_breakdown: Record<string, number>;
  trace_lines: Record<string, string>;
}

export interface AffordabilitySnapshot {
  transactions: AffordabilityTransaction[];
  exact_duplicates_removed: number;
  near_duplicates_flagged: number;
  recurring: AffordabilityRecurringItem[];
  anomalies: AffordabilityAnomalyFlag[];
  forecast: AffordabilityForecastPoint[];
  affordability: AffordabilityReport;
}

const CATEGORY_OPTIONS = [
  "Groceries",
  "Essential Groceries",
  "Rent & Housing",
  "Subscriptions",
  "Dining & Food",
  "Transport",
  "Utilities",
  "Shopping & Misc",
  "Salary",
  "Income",
];

export function formatPaiseINR(paise: number): string {
  const inr = paise / 100;
  const hasDecimals = Math.abs(paise % 100) !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(inr);
}

export const AffordabilityWorkspace: React.FC = () => {
  const { isDarkMode, syncWithBackend } = useFinancial();
  const [snapshot, setSnapshot] = useState<AffordabilitySnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [questionInput, setQuestionInput] = useState<string>(
    "Can I afford ₹80,000 next month?"
  );
  const [correctionNote, setCorrectionNote] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchSnapshot = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ps4", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        void syncWithBackend();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('mm_ledger_updated'));
        }
      }
    } catch {
      // Ignore initial load error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    setCorrectionNote(null);
    setUploadStatus("Uploading document & parsing with Gemini AI...");
    try {
      const formData = new FormData();
      formData.append("replace", "false");
      formData.append("account_label", "Primary-Statement");
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/ps4", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        setUploadStatus(
          `Successfully processed ${files.length} statement(s) via Gemini AI • ${data.snapshot.transactions.length} active transactions in ledger.`
        );
      } else {
        setUploadStatus(`Upload failed: ${data.error || "Could not parse document"}`);
      }
    } catch (err) {
      setUploadStatus(`Upload failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCategoryChange = async (merchant: string, newCategory: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ps4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correction",
          merchant,
          new_category: newCategory,
        }),
      });
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        setCorrectionNote(
          `Updated ${data.merchant} to ${data.new_category} — ${data.note}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const match = questionInput.match(/₹?\s*([\d,]+(?:\.\d+)?)/);
    const parsedAmount = match
      ? parseFloat(match[1].replace(/,/g, ""))
      : 80000;
    setLoading(true);
    try {
      const res = await fetch("/api/ps4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "question",
          amount_inr: isNaN(parsedAmount) ? 80000 : parsedAmount,
        }),
      });
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWipe = async () => {
    setLoading(true);
    setCorrectionNote(null);
    setUploadStatus(null);
    try {
      const res = await fetch("/api/ps4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wipe" }),
      });
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
      }
    } finally {
      setLoading(false);
    }
  };

  const txns = useMemo(() => Array.isArray(snapshot?.transactions) ? snapshot.transactions : [], [snapshot]);
  const recurring = useMemo(() => Array.isArray(snapshot?.recurring) ? snapshot.recurring : [], [snapshot]);
  const anomalies = useMemo(() => Array.isArray(snapshot?.anomalies) ? snapshot.anomalies : [], [snapshot]);
  const forecast = useMemo(() => Array.isArray(snapshot?.forecast) ? snapshot.forecast : [], [snapshot]);
  const aff = snapshot?.affordability;

  // Spend by category aggregation
  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of txns) {
      if (tx.direction === "debit") {
        map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount_paise);
      }
    }
    return Array.from(map.entries())
      .map(([category, amount_paise]) => ({ category, amount_paise }))
      .sort((a, b) => b.amount_paise - a.amount_paise);
  }, [txns]);

  // Monthly trend aggregation
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { income_paise: number; spend_paise: number }>();
    for (const tx of txns) {
      const m = tx.date.slice(0, 7);
      const cur = map.get(m) ?? { income_paise: 0, spend_paise: 0 };
      if (tx.direction === "credit") {
        cur.income_paise += tx.amount_paise;
      } else {
        cur.spend_paise += tx.amount_paise;
      }
      map.set(m, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month, ...vals }));
  }, [txns]);

  const maxCatPaise = spendByCategory[0]?.amount_paise ?? 1;
  const maxTrendPaise = Math.max(
    1,
    ...monthlyTrend.map((m) => Math.max(m.income_paise, m.spend_paise))
  );

  return (
    <div className="space-y-6 pb-16 text-[#F5F4F2]" data-testid="affordability-dashboard">
      {/* Top Header Bar */}
      <header className="card-z flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl bg-[#161512] border border-[#2C261E] p-6 shadow-xl">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Personal Finance Assistant
          </h1>
          <p className="text-xs sm:text-sm text-[#A79A8A] max-w-3xl">
            Upload multi-account bank statements (CSV + PDF) to merge & de-duplicate transactions,
            detect recurring subscriptions, flag anomalies with reasons, and verify next-month affordability step by step.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="statement-upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4A373] hover:bg-[#DFB387] text-[#121008] font-semibold text-xs sm:text-sm cursor-pointer transition shadow-md"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Statements (CSV / PDF)</span>
            <input
              id="statement-upload"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.pdf"
              onChange={handleFileUpload}
              className="sr-only"
              data-testid="statement-file-input"
            />
          </label>
          <button
            type="button"
            onClick={handleWipe}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#221E18] hover:bg-red-950/50 text-[#CFC4B6] hover:text-red-300 border border-[#3A3226] text-xs font-medium transition cursor-pointer"
            data-testid="wipe-data-button"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Data</span>
          </button>
        </div>
      </header>

      {uploadStatus && (
        <div
          className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 text-xs sm:text-sm text-emerald-200 flex items-center justify-between"
          data-testid="upload-status-banner"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{uploadStatus}</span>
          </div>
          <span className="font-mono text-xs text-emerald-300">
            Accounts merged: {Array.from(new Set(txns.map((t) => t.account_id))).join(", ")}
          </span>
        </div>
      )}

      {/* Row 1: Deterministic Affordability Engine + 3 Instant Dashboard Charts (Category Spend, Monthly Trend, Forecast) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 cols: Affordability Question & Step-by-Step Receipt */}
        <section
          className="card-z lg:col-span-6 rounded-2xl bg-[#161512] border border-[#2C261E] p-6 flex flex-col justify-between space-y-5"
          data-testid="affordability-panel"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#D4A373]" />
                <h2 className="text-base font-semibold text-white">
                  Affordability Calculator
                </h2>
              </div>
            </div>

            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <input
                type="text"
                aria-label="Ask affordability question"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                className="flex-1 rounded-xl bg-[#0F0E0B] border border-[#3A3226] px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#D4A373]"
                data-testid="affordability-question-input"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-[#8D7A62] hover:bg-[#9E8B72] text-white font-semibold text-xs sm:text-sm transition shrink-0 cursor-pointer"
                data-testid="affordability-ask-button"
              >
                Evaluate
              </button>
            </form>

            {aff && aff.verdict === "REFUSED" ? (
              <div
                className="rounded-xl bg-[#EFEEE9] dark:bg-[#8A847B]/20 border border-[#8A847B]/40 p-4 space-y-2 text-[#8A847B] dark:text-[#D5D2CD]"
                data-testid="refusal-banner"
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-[#8A847B] dark:text-[#EFEEE9]">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>INSUFFICIENT DATA — Need Minimum 3 Months History</span>
                </div>
                <p className="text-xs leading-relaxed" data-testid="refusal-reason">
                  {aff.refusal_reason || "We need at least 3 months of transaction history to make a reliable affordability estimate."}
                </p>
              </div>
            ) : aff ? (
              <div className="space-y-4" data-testid="affordability-steps">
                {/* Verdict Banner */}
                <div className="flex items-center justify-between rounded-xl bg-[#1F1C16] border border-[#3A3226] p-4">
                  <div>
                    <p className="text-[11px] font-mono uppercase text-[#A79A8A]">
                      Affordability Verdict for {formatPaiseINR(aff.target_amount_paise)}
                    </p>
                    <p
                      className={`text-xl font-bold font-mono mt-0.5 ${
                        aff.verdict === "YES"
                          ? "text-[#16A579]"
                          : aff.verdict === "TIGHT"
                            ? "text-[#C98A32]"
                            : "text-[#D95C52]"
                      }`}
                      data-testid="step-verdict"
                    >
                      {aff.verdict === "YES" ? "COMFORTABLE" : aff.verdict === "TIGHT" ? "TIGHT" : "NOT AFFORDABLE"} — Free Cash After Purchase: {formatPaiseINR(aff.net_after_purchase_paise)}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-[#2C261E] text-[#E2C799]">
                    {aff.distinct_months} months ({aff.span_days}d)
                  </span>
                </div>

                {/* Step-by-step waterfall */}
                <div className="rounded-xl bg-[#0F0E0B] border border-[#2C261E] divide-y divide-[#241F17] text-xs font-mono">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#CFC4B6]">
                      1. Current Closing Balance (balance)
                    </span>
                    <span className="font-semibold text-white" data-testid="step-balance">
                      {formatPaiseINR(aff.current_balance_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="text-emerald-400">
                        2. + Expected Monthly Income (median of last 3 months)
                      </span>
                      {aff.income_is_variable && (
                        <span className="block text-[10px] text-[#A79A8A]">
                          Range: {formatPaiseINR(aff.income_range_min_paise)} – {formatPaiseINR(aff.income_range_max_paise)}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-emerald-400" data-testid="step-income">
                      + {formatPaiseINR(aff.expected_income_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-amber-300">
                      3. − Committed Payments (from recurring detection)
                    </span>
                    <span className="font-semibold text-amber-300" data-testid="step-committed">
                      − {formatPaiseINR(aff.committed_payments_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-amber-300">
                      4. − Average Variable Spend (category averages)
                    </span>
                    <span className="font-semibold text-amber-300" data-testid="step-variable">
                      − {formatPaiseINR(aff.average_variable_spend_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="text-sky-300">
                        5. − Safety Buffer ({aff.safety_buffer_rule})
                      </span>
                    </div>
                    <span className="font-semibold text-sky-300" data-testid="step-buffer">
                      − {formatPaiseINR(aff.safety_buffer_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#161512]">
                    <span className="text-[#CFC4B6]">
                      = Safe Spendable Headroom Before Purchase
                    </span>
                    <span className="font-bold text-white" data-testid="step-headroom">
                      {formatPaiseINR(aff.free_cash_before_purchase_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#1D1913]">
                    <span className="text-[#E2C799] font-semibold">
                      6. Net Headroom After {formatPaiseINR(aff.target_amount_paise)} Purchase
                    </span>
                    <span className="font-bold text-emerald-400" data-testid="step-net">
                      {formatPaiseINR(aff.net_after_purchase_paise)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Right 6 cols: Spend by Category + Monthly Trend + Weekly Forecast (visible directly on Dashboard) */}
        <section className="lg:col-span-6 grid grid-cols-1 gap-6">
          {/* Spend by Category + Monthly Trend side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Spend by Category */}
            <div
              className="card-z rounded-2xl bg-[#161512] border border-[#2C261E] p-5 space-y-3"
              data-testid="spend-by-category"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Spend by Category</h3>
                <span className="text-[11px] font-mono text-[#A79A8A]">
                  {spendByCategory.length} categories
                </span>
              </div>
              {spendByCategory.length === 0 ? (
                <p className="text-xs text-[#A79A8A] py-6 text-center">
                  Upload statements to view spend breakdown by category.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {spendByCategory.map((item) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#ECEAE6] font-medium">{item.category}</span>
                        <span className="font-mono text-[#D4A373]">
                          {formatPaiseINR(item.amount_paise)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#241F17] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#D4A373]"
                          style={{
                            width: `${Math.max(5, Math.round((item.amount_paise / maxCatPaise) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Trend */}
            <div
              className="card-z rounded-2xl bg-[#161512] border border-[#2C261E] p-5 space-y-3"
              data-testid="monthly-trend"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Monthly Trend</h3>
                <span className="text-[11px] font-mono text-[#A79A8A]">Income vs Spend</span>
              </div>
              {monthlyTrend.length === 0 ? (
                <p className="text-xs text-[#A79A8A] py-6 text-center">
                  Upload statements to view monthly cashflow trend.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {monthlyTrend.map((m) => (
                    <div key={m.month} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-[#CFC4B6]">{m.month}</span>
                        <span className="text-emerald-400">
                          +{formatPaiseINR(m.income_paise)}
                        </span>
                        <span className="text-rose-400">
                          −{formatPaiseINR(m.spend_paise)}
                        </span>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div
                          className="bg-emerald-500/80 rounded-sm"
                          style={{
                            width: `${Math.max(4, Math.round((m.income_paise / maxTrendPaise) * 50))}%`,
                          }}
                        />
                        <div
                          className="bg-rose-500/80 rounded-sm"
                          style={{
                            width: `${Math.max(4, Math.round((m.spend_paise / maxTrendPaise) * 50))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Weekly Balance Forecast */}
          <div
            className="card-z rounded-2xl bg-[#161512] border border-[#2C261E] p-5 space-y-3"
            data-testid="weekly-forecast"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  4-Week Projected Balance
                </h3>
              </div>
            </div>
            {!Array.isArray(forecast) || forecast.length === 0 ? (
              <p className="text-xs text-[#A79A8A] py-4 text-center">
                Upload statements to generate 4-week balance projection with 80% confidence intervals.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.isArray(forecast) && forecast.map((pt, idx) => (
                  <div
                    key={pt.week_start}
                    className="rounded-xl bg-[#0F0E0B] border border-[#2C261E] p-3 space-y-1"
                  >
                    <p className="text-[10px] font-mono text-[#A79A8A]">
                      Week {idx + 1} ({pt.week_start})
                    </p>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      {formatPaiseINR(pt.point_paise)}
                    </p>
                    <p className="text-[10px] font-mono text-[#8A7C6D]">
                      80% PI: {formatPaiseINR(pt.lo80_paise)} – {formatPaiseINR(pt.hi80_paise)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Row 2: Recurring Subscriptions Panel + PyOD Anomaly Detection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recurring Subscriptions Panel */}
        <section
          className="card-z rounded-2xl bg-[#161512] border border-[#2C261E] p-6 space-y-4"
          data-testid="recurring-panel"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D4A373]" />
              <h2 className="text-base font-semibold text-white">
                Recurring Payments & Subscriptions
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#241F17] text-[#E2C799] border border-[#3A3226]">
              {recurring.length} detected
            </span>
          </div>

          {recurring.length === 0 ? (
            <p className="text-xs text-[#A79A8A] py-6 text-center">
              No recurring subscriptions detected yet. Upload 3+ months of statements.
            </p>
          ) : (
            <div className="divide-y divide-[#241F17] rounded-xl bg-[#0F0E0B] border border-[#2C261E]">
              {recurring.map((sub) => (
                <div
                  key={sub.merchant}
                  className="flex items-center justify-between px-4 py-3 text-xs"
                  data-testid="recurring-item"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">{sub.merchant}</p>
                    <p className="text-[11px] text-[#A79A8A] font-mono">
                      Cycle: {sub.frequency} ({sub.occurrences}x) · Next expected:{" "}
                      <span className="text-emerald-400" data-testid="recurring-next-date">
                        {sub.next_expected_date}
                      </span>
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-[#E2C799]" data-testid="recurring-amount">
                      {formatPaiseINR(sub.typical_amount_paise)}
                    </p>
                    <p className="text-[10px] text-[#8A7C6D]">per {sub.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Anomaly Panel */}
        <section
          className="card-z rounded-2xl bg-[#161512] border border-[#2C261E] p-6 space-y-4"
          data-testid="anomaly-panel"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h2 className="text-base font-semibold text-white">
                Anomalies & Duplicate Alerts
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-rose-950/60 text-rose-300 border border-rose-500/30">
              {anomalies.length} flagged
            </span>
          </div>

          {anomalies.length === 0 ? (
            <p className="text-xs text-[#A79A8A] py-6 text-center">
              No anomalies flagged. Upload statements to run IForest + LOF + ECOD detection.
            </p>
          ) : (
            <div className="divide-y divide-[#241F17] rounded-xl bg-[#0F0E0B] border border-[#2C261E]">
              {anomalies.map((flag) => (
                <div
                  key={flag.tx_id}
                  className="px-4 py-3 space-y-1 text-xs"
                  data-testid="anomaly-item"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-300">
                      {flag.merchant} ({flag.date})
                    </span>
                    <span className="font-mono font-bold text-rose-400">
                      {formatPaiseINR(flag.amount_paise)}
                    </span>
                  </div>
                  <p className="text-[#CFC4B6] font-mono text-[11px]" data-testid="anomaly-reason">
                    Reason: {flag.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Row 3: Merged & De-duplicated Transactions Table with Inline Category Correction */}
      <section
        className="card-z rounded-2xl bg-[#161512] border border-[#2C261E] p-6 space-y-4"
        data-testid="transactions-panel"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white">
              Merged & De-duplicated Ledger ({txns.length} transactions)
            </h2>
            <p className="text-xs text-[#A79A8A]">
              Correct any transaction category below — all transactions from the same merchant update automatically.
            </p>
          </div>
          {correctionNote && (
            <div
              className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono"
              data-testid="category-correction-note"
            >
              {correctionNote}
            </div>
          )}
        </div>

        {txns.length === 0 ? (
          <div className="rounded-xl bg-[#0F0E0B] border border-[#241F17] p-8 text-center text-xs text-[#A79A8A]">
            No transactions loaded. Upload CSV or PDF statements above to populate the ledger.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#2C261E]">
            <table className="w-full text-left text-xs" data-testid="merged-transactions-table">
              <thead className="bg-[#0F0E0B] text-[#A79A8A] font-mono uppercase text-[11px] border-b border-[#2C261E]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Merchant</th>
                  <th className="py-3 px-4">Category (Editable)</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#241F17] bg-[#12100B]">
                {txns.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-[#1B1812] transition"
                    data-testid="transaction-row"
                  >
                    <td className="py-2.5 px-4 font-mono text-[#CFC4B6]">{tx.date}</td>
                    <td className="py-2.5 px-4 font-mono text-[#E2C799]">{tx.account_id}</td>
                    <td className="py-2.5 px-4 text-white font-medium">{tx.description}</td>
                    <td className="py-2.5 px-4 font-mono text-[#A79A8A]">{tx.merchant}</td>
                    <td className="py-2.5 px-4">
                      <select
                        aria-label={`Category for ${tx.description}`}
                        value={tx.category}
                        onChange={(e) => handleCategoryChange(tx.description, e.target.value)}
                        className="rounded-lg bg-[#1D1913] border border-[#3A3226] px-2.5 py-1 text-xs text-[#ECEAE6] focus:outline-none focus:border-[#D4A373]"
                        data-testid={`category-select-${tx.merchant}`}
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-semibold ${
                        tx.direction === "credit" ? "text-emerald-400" : "text-[#ECEAE6]"
                      }`}
                    >
                      {tx.direction === "credit" ? "+" : "−"}
                      {formatPaiseINR(tx.amount_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
