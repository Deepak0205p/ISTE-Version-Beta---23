"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFinancial } from "@/context/FinancialContext";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  Activity,
  ArrowRight,
  ShieldCheck,
  Percent,
  Layers,
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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("mm_ledger_updated"));
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
    setUploadStatus("Uploading document & parsing with AI and bank adapters...");
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
          `Successfully processed ${files.length} statement(s) • ${data.snapshot.transactions.length} active transactions in ledger.`
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
        void syncWithBackend();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("mm_ledger_updated"));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const txns = useMemo(
    () => snapshot?.transactions ?? [],
    [snapshot?.transactions]
  );
  const aff = snapshot?.affordability ?? null;
  const recurring = snapshot?.recurring ?? [];
  const anomalies = snapshot?.anomalies ?? [];
  const forecast = snapshot?.forecast ?? [];

  // Monthly trend calculation
  const monthlyTrend = useMemo(() => {
    const buckets: Record<string, { income_paise: number; spend_paise: number }> =
      {};
    for (const t of txns) {
      const m = t.date ? t.date.slice(0, 7) : "Unknown";
      if (!buckets[m]) {
        buckets[m] = { income_paise: 0, spend_paise: 0 };
      }
      if (t.direction === "credit") {
        buckets[m].income_paise += t.amount_paise;
      } else {
        buckets[m].spend_paise += t.amount_paise;
      }
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month, ...vals }));
  }, [txns]);

  // Category breakdown calculation
  const spendByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const t of txns) {
      if (t.direction === "debit") {
        const c = t.category || "Uncategorized";
        cats[c] = (cats[c] || 0) + t.amount_paise;
      }
    }
    return Object.entries(cats)
      .map(([category, amount_paise]) => ({ category, amount_paise }))
      .sort((a, b) => b.amount_paise - a.amount_paise);
  }, [txns]);

  const maxCatPaise = spendByCategory[0]?.amount_paise ?? 1;
  const maxTrendPaise = Math.max(
    1,
    ...monthlyTrend.map((m) => Math.max(m.income_paise, m.spend_paise))
  );

  return (
    <div className="space-y-6 pb-16 text-[#121008] dark:text-[#F8F7F4]" data-testid="affordability-dashboard">
      {/* Top Header Bar */}
      <header className="card-z flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F2ECE3] dark:bg-[#273549] text-[#8F7D65] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#121008] dark:text-[#F8F7F4]">
              Can I Afford It?
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-black dark:text-[#94A3B8] max-w-3xl">
            Deterministic Affordability Engine with multi-account merge, de-duplication, subscription detection, anomaly detection, and cashflow simulation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="statement-upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8F7D65] hover:bg-[#6F5D48] text-white font-semibold text-xs sm:text-sm cursor-pointer transition shadow-md shadow-[#8F7D65]/20"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Statement (CSV / PDF)</span>
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-[#273549] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-black dark:text-[#94A3B8] hover:text-rose-600 dark:hover:text-rose-300 border border-[#E6E1D8] dark:border-[#3A3226] text-xs font-semibold transition cursor-pointer"
            data-testid="wipe-data-button"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Ledger</span>
          </button>
        </div>
      </header>

      {uploadStatus && (
        <div
          className="rounded-xl bg-[#F2ECE3] dark:bg-[#1D1913] border border-[#8F7D65]/30 px-4 py-3 text-xs sm:text-sm text-[#6F5D48] dark:text-[#60A5FA] flex items-center justify-between"
          data-testid="upload-status-banner"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#8F7D65] shrink-0" />
            <span className="font-medium">{uploadStatus}</span>
          </div>
          {txns.length > 0 && (
            <span className="font-mono text-xs text-black dark:text-[#94A3B8] dark:text-[#94A3B8]">
              Merged: {Array.from(new Set(txns.map((t) => t.account_id))).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Row 1: Deterministic Affordability Engine + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 cols: Affordability Question & Step-by-Step Receipt */}
        <section
          className="card-z lg:col-span-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-6 flex flex-col justify-between space-y-5"
          data-testid="affordability-panel"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#8F7D65]" />
                <h2 className="text-base font-semibold text-[#121008] dark:text-[#F8F7F4]">
                  Affordability Calculator
                </h2>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#273549] text-black dark:text-[#94A3B8] dark:text-[#94A3B8]">
                Real-Time Solver
              </span>
            </div>

            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <input
                type="text"
                aria-label="Ask affordability question"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                className="flex-1 rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] px-3.5 py-2.5 text-sm text-[#121008] dark:text-[#F8F7F4] font-medium focus:outline-none focus:border-[#8F7D65]"
                data-testid="affordability-question-input"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#8F7D65] hover:bg-[#6F5D48] text-white font-semibold text-xs sm:text-sm transition shrink-0 cursor-pointer shadow-sm shadow-[#8F7D65]/20"
                data-testid="affordability-ask-button"
              >
                Evaluate
              </button>
            </form>

            {aff && aff.verdict === "REFUSED" ? (
              <div
                className="rounded-xl bg-[#F1F5F9] dark:bg-[#273549] border border-[#E6E1D8] dark:border-[#3A3226] p-4 space-y-2 text-black dark:text-[#94A3B8] dark:text-[#94A3B8]"
                data-testid="refusal-banner"
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-[#121008] dark:text-[#F8F7F4]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8F7D65]" />
                  <span>Awaiting Sufficient Historical Statements</span>
                </div>
                <p className="text-xs leading-relaxed" data-testid="refusal-reason">
                  {aff.refusal_reason}
                </p>
              </div>
            ) : aff ? (
              <div className="space-y-4" data-testid="affordability-steps">
                {/* Verdict Banner */}
                <div className="flex items-center justify-between rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-4 shadow-sm">
                  <div>
                    <p className="text-[11px] font-mono uppercase text-black dark:text-[#94A3B8] dark:text-[#94A3B8]">
                      Affordability Verdict for {formatPaiseINR(aff.target_amount_paise)}
                    </p>
                    <p
                      className={`text-xl font-bold font-mono mt-0.5 ${
                        aff.verdict === "YES"
                          ? "text-[#8F7D65]"
                          : aff.verdict === "TIGHT"
                          ? "text-[#8F7D65]"
                          : "text-rose-500"
                      }`}
                      data-testid="step-verdict"
                    >
                      {aff.verdict === "YES"
                        ? "🟢 COMFORTABLE"
                        : aff.verdict === "TIGHT"
                        ? "🟣 TIGHT CASHFLOW"
                        : "🔴 NOT RECOMMENDED"}
                    </p>
                    <p className="text-xs text-black dark:text-[#94A3B8] dark:text-[#94A3B8] mt-1 font-mono">
                      Projected Free Cash After Purchase:{" "}
                      <span className="font-bold text-[#121008] dark:text-[#F8F7F4]">
                        {formatPaiseINR(aff.net_after_purchase_paise)}
                      </span>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-[#F2ECE3] dark:bg-[#1D1913] text-[#6F5D48] dark:text-[#8F7D65] border border-[#8F7D65]/20">
                    {aff.distinct_months} mo ({aff.span_days}d)
                  </span>
                </div>

                {/* Step-by-step waterfall */}
                <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] divide-y divide-[#E6E1D8] dark:divide-[#273549] text-xs font-mono">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-black dark:text-[#94A3B8] dark:text-[#94A3B8]">
                      1. Current Closing Balance
                    </span>
                    <span className="font-semibold text-[#121008] dark:text-[#F8F7F4]" data-testid="step-balance">
                      {formatPaiseINR(aff.current_balance_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="text-[#8F7D65] font-semibold">
                        2. + Expected Monthly Income
                      </span>
                      {aff.income_is_variable && (
                        <span className="block text-[10px] text-black dark:text-[#94A3B8] dark:text-[#94A3B8]">
                          Range: {formatPaiseINR(aff.income_range_min_paise)} – {formatPaiseINR(aff.income_range_max_paise)}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-[#8F7D65]" data-testid="step-income">
                      + {formatPaiseINR(aff.expected_income_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#8F7D65] font-semibold">
                      3. − Committed Payments (Subscriptions/Rent)
                    </span>
                    <span className="font-semibold text-[#8F7D65]" data-testid="step-committed">
                      − {formatPaiseINR(aff.committed_payments_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#8F7D65] font-semibold">
                      4. − Average Variable Spend
                    </span>
                    <span className="font-semibold text-[#8F7D65]" data-testid="step-variable">
                      − {formatPaiseINR(aff.average_variable_spend_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="text-black dark:text-[#94A3B8] dark:text-[#94A3B8]">
                        5. − Safety Buffer ({aff.safety_buffer_rule})
                      </span>
                    </div>
                    <span className="font-semibold text-black dark:text-[#94A3B8] dark:text-[#94A3B8]" data-testid="step-buffer">
                      − {formatPaiseINR(aff.safety_buffer_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8F7F4] dark:bg-[#1D1913]">
                    <span className="text-[#121008] dark:text-[#F8F7F4] font-semibold">
                      = Safe Spendable Headroom
                    </span>
                    <span className="font-bold text-[#121008] dark:text-[#F8F7F4]" data-testid="step-headroom">
                      {formatPaiseINR(aff.free_cash_before_purchase_paise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#F2ECE3] dark:bg-[#273549]">
                    <span className="text-[#6F5D48] dark:text-[#60A5FA] font-bold">
                      6. Net Headroom After {formatPaiseINR(aff.target_amount_paise)} Purchase
                    </span>
                    <span
                      className={`font-bold ${
                        aff.verdict === "YES"
                          ? "text-[#8F7D65]"
                          : aff.verdict === "TIGHT"
                          ? "text-[#8F7D65]"
                          : "text-rose-500"
                      }`}
                      data-testid="step-net"
                    >
                      {formatPaiseINR(aff.net_after_purchase_paise)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-6 text-center text-xs text-black dark:text-[#94A3B8]">
                Upload your bank statement above to see instant mathematical affordability verification.
              </div>
            )}
          </div>
        </section>

        {/* Right 6 cols: Spend by Category + Monthly Trend + Weekly Forecast */}
        <section className="lg:col-span-6 grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Spend by Category */}
            <div
              className="card-z rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 space-y-3"
              data-testid="spend-by-category"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#121008] dark:text-[#F8F7F4]">
                  Spend by Category
                </h3>
                <span className="text-[11px] font-mono text-black dark:text-[#94A3B8]">
                  {spendByCategory.length} categories
                </span>
              </div>
              {spendByCategory.length === 0 ? (
                <p className="text-xs text-black dark:text-[#94A3B8] py-6 text-center">
                  Upload statements to view spend breakdown by category.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {spendByCategory.map((item) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#121008] dark:text-[#F8F7F4] font-medium">
                          {item.category}
                        </span>
                        <span className="font-mono font-semibold text-[#8F7D65]">
                          {formatPaiseINR(item.amount_paise)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] dark:bg-[#273549] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#8F7D65]"
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
              className="card-z rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 space-y-3"
              data-testid="monthly-trend"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#121008] dark:text-[#F8F7F4]">
                  Monthly Cashflow
                </h3>
                <span className="text-[11px] font-mono text-black dark:text-[#94A3B8]">Income vs Spend</span>
              </div>
              {monthlyTrend.length === 0 ? (
                <p className="text-xs text-black dark:text-[#94A3B8] py-6 text-center">
                  Upload statements to view monthly cashflow trend.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {monthlyTrend.map((m) => (
                    <div key={m.month} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-[#121008] dark:text-[#F8F7F4] font-medium">
                          {m.month}
                        </span>
                        <span className="text-[#8F7D65] font-semibold">
                          +{formatPaiseINR(m.income_paise)}
                        </span>
                        <span className="text-[#8F7D65] font-semibold">
                          −{formatPaiseINR(m.spend_paise)}
                        </span>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div
                          className="bg-[#8F7D65] rounded-sm"
                          style={{
                            width: `${Math.max(4, Math.round((m.income_paise / maxTrendPaise) * 50))}%`,
                          }}
                        />
                        <div
                          className="bg-[#8F7D65] rounded-sm"
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
            className="card-z rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 space-y-3"
            data-testid="weekly-forecast"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#8F7D65]" />
                <h3 className="text-sm font-semibold text-[#121008] dark:text-[#F8F7F4]">
                  4-Week Projected Balance
                </h3>
              </div>
              <span className="text-[11px] font-mono text-black dark:text-[#94A3B8]">80% Confidence</span>
            </div>
            {!Array.isArray(forecast) || forecast.length === 0 ? (
              <p className="text-xs text-black dark:text-[#94A3B8] py-4 text-center">
                Upload statements to generate 4-week balance projection.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.isArray(forecast) &&
                  forecast.map((pt, idx) => (
                    <div
                      key={pt.week_start}
                      className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-3 space-y-1"
                    >
                      <p className="text-[10px] font-mono text-black dark:text-[#94A3B8]">
                        Week {idx + 1}
                      </p>
                      <p className="text-sm font-bold font-mono text-[#8F7D65]">
                        {formatPaiseINR(pt.point_paise)}
                      </p>
                      <p className="text-[10px] font-mono text-black dark:text-[#94A3B8]">
                        Range: {formatPaiseINR(pt.lo80_paise)} – {formatPaiseINR(pt.hi80_paise)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Row 2: Recurring Subscriptions Panel + Anomaly Detection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Recurring Subscriptions Panel */}
        <section
          className="card-z rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-6 space-y-4 flex flex-col h-[400px]"
          data-testid="recurring-panel"
        >
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8F7D65]" />
              <h2 className="text-base font-semibold text-[#121008] dark:text-[#F8F7F4]">
                Recurring Payments & Subscriptions
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#F2ECE3] dark:bg-[#273549] text-[#6F5D48] dark:text-[#8F7D65] border border-[#8F7D65]/20">
              {recurring.length} detected
            </span>
          </div>

          {recurring.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-black dark:text-[#94A3B8] text-center">
                No recurring subscriptions detected yet. Upload multi-month statements to detect recurring debits.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 divide-y divide-[#E6E1D8] dark:divide-[#273549] rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226]">
              {recurring.map((sub) => (
                <div
                  key={sub.merchant}
                  className="flex items-center justify-between px-4 py-3 text-xs"
                  data-testid="recurring-item"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#121008] dark:text-[#F8F7F4]">{sub.merchant}</p>
                    <p className="text-[11px] text-black dark:text-[#94A3B8] font-mono">
                      Cycle: {sub.frequency} ({sub.occurrences}x) · Next expected:{" "}
                      <span className="text-[#8F7D65] font-semibold" data-testid="recurring-next-date">
                        {sub.next_expected_date}
                      </span>
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-[#8F7D65]" data-testid="recurring-amount">
                      {formatPaiseINR(sub.typical_amount_paise)}
                    </p>
                    <p className="text-[10px] text-black dark:text-[#94A3B8]">per {sub.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Anomaly Panel */}
        <section
          className="card-z rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-6 space-y-4 flex flex-col h-[400px]"
          data-testid="anomaly-panel"
        >
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#8F7D65]" />
              <h2 className="text-base font-semibold text-[#121008] dark:text-[#F8F7F4]">
                Anomalies & Duplicate Alerts
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-50 dark:bg-purple-950/60 text-[#8F7D65] dark:text-purple-300 border border-[#8F7D65]/20">
              {anomalies.length} flagged
            </span>
          </div>

          {anomalies.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-black dark:text-[#94A3B8] text-center">
                No anomalies flagged. Upload statements to run anomaly and duplicate detection.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 divide-y divide-[#E6E1D8] dark:divide-[#273549] rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226]">
              {anomalies.map((flag) => (
                <div
                  key={flag.tx_id}
                  className="px-4 py-3 space-y-1 text-xs"
                  data-testid="anomaly-item"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#121008] dark:text-[#F8F7F4]">
                      {flag.merchant} ({flag.date})
                    </span>
                    <span className="font-mono font-bold text-[#8F7D65]">
                      {formatPaiseINR(flag.amount_paise)}
                    </span>
                  </div>
                  <p className="text-black dark:text-[#94A3B8] dark:text-[#94A3B8] font-mono text-[11px]" data-testid="anomaly-reason">
                    Reason: {flag.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
