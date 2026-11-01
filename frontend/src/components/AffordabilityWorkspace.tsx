"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useFinancial } from "@/context/FinancialContext";
import {
  Wallet,
  Building2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Clock,
  PieChart,
} from "lucide-react";
import { ExpenseCategory } from "@/types";

interface AiAffordabilityEvaluation {
  verdict: "YES" | "TIGHT" | "NO";
  verdictHeadline: string;
  confidenceScore: number;
  netRunwayMonthsAfterPurchase: number;
  accountDrainRatio: number;
  howAndWhy: string[];
  whyAndRisks: string[];
  categoryImpactSummary: string;
  recommendedAction: string;
}

const CATEGORY_CHOICES: ExpenseCategory[] = [
  "Shopping",
  "Grocery & Food",
  "Transportation & Fuel",
  "Entertainment",
  "Electricity & Utilities",
  "Rent & Housing",
  "Subscriptions",
  "Medical & Health",
  "Education",
  "Miscellaneous",
];

const PRESET_AMOUNTS = [5000, 15000, 35000, 75000, 150000];

function formatRupee(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const AffordabilityWorkspace: React.FC = () => {
  const { isDarkMode, bankAccounts, transactions, expenses, metrics } = useFinancial();

  // Bank account selection: "all" or specific account ID
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  // Purchase input fields
  const [productName, setProductName] = useState<string>("Apple MacBook Air M3");
  const [purchaseAmount, setPurchaseAmount] = useState<number>(85000);
  const [category, setCategory] = useState<ExpenseCategory>("Shopping");
  const [paymentType, setPaymentType] = useState<string>("lump_sum"); // lump_sum, emi_3, emi_6

  // AI evaluation states
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<AiAffordabilityEvaluation | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Derive active account context & balances
  const activeAccount = useMemo(() => {
    if (selectedAccountId === "all") return null;
    return bankAccounts.find((acc) => acc.id === selectedAccountId) || null;
  }, [bankAccounts, selectedAccountId]);

  const accountName = useMemo(() => {
    if (activeAccount) {
      return `${activeAccount.bankName} (${activeAccount.accountType} ••••${activeAccount.maskedAccountNumber.slice(-4)})`;
    }
    return bankAccounts.length > 0 ? "All Accounts (Consolidated Ledger)" : "Self-Reported Balance Sheet";
  }, [activeAccount, bankAccounts]);

  const liquidBalance = useMemo(() => {
    if (activeAccount) {
      return activeAccount.currentBalance || 0;
    }
    if (bankAccounts.length > 0) {
      return bankAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
    }
    return metrics.liquidCapital || 0;
  }, [activeAccount, bankAccounts, metrics.liquidCapital]);

  // Historical transactions scoped to the selected bank account
  const accountTransactions = useMemo(() => {
    if (activeAccount) {
      return transactions.filter((t) => t.bankAccountId === activeAccount.id);
    }
    return transactions;
  }, [activeAccount, transactions]);

  // Calculate monthly inflow & outflow for selected account
  const { monthlyInflow, monthlyOutflow } = useMemo(() => {
    if (accountTransactions.length > 0) {
      const credits = accountTransactions
        .filter((t) => t.type === "CREDIT")
        .reduce((sum, t) => sum + t.amount, 0);
      const debits = accountTransactions
        .filter((t) => t.type === "DEBIT")
        .reduce((sum, t) => sum + t.amount, 0);

      // Estimate monthly span from unique months in transactions
      const uniqueMonths = new Set(
        accountTransactions.map((t) => (t.date ? t.date.slice(0, 7) : "cur"))
      ).size;
      const divisor = Math.max(1, uniqueMonths);

      return {
        monthlyInflow: Math.round(credits / divisor),
        monthlyOutflow: Math.round(debits / divisor),
      };
    }

    // Fallback to global metrics if no granular transactions
    if (selectedAccountId === "all") {
      return {
        monthlyInflow: metrics.monthlyRunRateInflow || 0,
        monthlyOutflow: metrics.monthlyRunRateExpenses || 0,
      };
    }

    return { monthlyInflow: 0, monthlyOutflow: 0 };
  }, [accountTransactions, selectedAccountId, metrics]);

  // Historical Spend by Category for selected account
  const categorySpendMap = useMemo(() => {
    const map: Record<string, number> = {};
    CATEGORY_CHOICES.forEach((c) => (map[c] = 0));

    // Aggregate from scoped transactions or expenses
    if (accountTransactions.length > 0) {
      accountTransactions
        .filter((t) => t.type === "DEBIT")
        .forEach((t) => {
          const cat = (t.category as string) || "Miscellaneous";
          map[cat] = (map[cat] || 0) + t.amount;
        });
    } else {
      // Fallback to expenses list
      const scopedExpenses = activeAccount
        ? expenses.filter((e) => e.bankAccountId === activeAccount.id)
        : expenses;
      scopedExpenses.forEach((e) => {
        map[e.category] = (map[e.category] || 0) + e.amount;
      });
    }

    return map;
  }, [accountTransactions, activeAccount, expenses]);

  // Post-purchase calculations
  const effectiveAddition = useMemo(() => {
    if (paymentType === "emi_3") return Math.round(purchaseAmount / 3);
    if (paymentType === "emi_6") return Math.round(purchaseAmount / 6);
    return purchaseAmount;
  }, [purchaseAmount, paymentType]);

  const currentCategorySpend = categorySpendMap[category] || 0;
  const projectedCategorySpend = currentCategorySpend + effectiveAddition;
  const projectedMonthlyLivingSpend = monthlyOutflow + effectiveAddition;
  const remainingMonthlySurplus = Math.max(0, monthlyInflow - projectedMonthlyLivingSpend);

  // Invoke AI Evaluation Endpoint
  const runAiEvaluation = useCallback(
    async (
      overrideProd = productName,
      overrideAmt = purchaseAmount,
      overrideCat = category,
      overridePay = paymentType
    ) => {
      setIsEvaluating(true);
      setEvalError(null);

      try {
        const res = await fetch("/api/affordability/ai-evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: overrideProd,
            purchaseAmount: overrideAmt,
            category: overrideCat,
            paymentType: overridePay,
            accountData: {
              accountName,
              currentBalance: liquidBalance,
              monthlyInflow,
              monthlyOutflow,
            },
            globalMetrics: {
              consolidatedNetWorth: metrics.consolidatedNetWorth,
              totalMonthlyEmiCommitments: metrics.totalMonthlyEmiCommitments,
            },
          }),
        });

        const data = await res.json();
        if (data.ok && data.data) {
          setEvaluation(data.data);
        } else {
          setEvalError(data.error || "Failed to retrieve AI evaluation.");
        }
      } catch (err) {
        setEvalError(err instanceof Error ? err.message : "Network error");
      } finally {
        setIsEvaluating(false);
      }
    },
    [productName, purchaseAmount, category, paymentType, accountName, liquidBalance, monthlyInflow, monthlyOutflow, metrics]
  );

  // Run initial evaluation on mount or account change
  useEffect(() => {
    runAiEvaluation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================================
          TOP EXECUTIVE BAR: BANK ACCOUNT SELECTOR (Replaces Statement Upload Bar)
          ========================================================================= */}
      <header className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Subtitle */}
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8F7D65] animate-pulse" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#121008] dark:text-[#F8F7F4]">
                Purchase Affordability
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#8F7D65] dark:text-[#B3A898] mt-0.5">
              Fiduciary AI Purchase Feasibility & Account-Scoped Category Impact
            </p>
          </div>

          {/* Bank Account Selector Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] rounded-xl px-3 py-2 text-xs">
              <Building2 className="w-4 h-4 text-[#8F7D65] shrink-0" />
              <span className="text-[#8F7D65] font-semibold">Scoped Bank Account:</span>
              <select
                aria-label="Select Bank Account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-transparent font-semibold text-[#121008] dark:text-[#F8F7F4] focus:outline-none cursor-pointer pr-2"
              >
                <option value="all" className="bg-[#FFFFFF] dark:bg-[#1D1913] text-[#121008] dark:text-[#F8F7F4]">
                  All Accounts (Consolidated Ledger)
                </option>
                {bankAccounts.map((acc) => (
                  <option
                    key={acc.id}
                    value={acc.id}
                    className="bg-[#FFFFFF] dark:bg-[#1D1913] text-[#121008] dark:text-[#F8F7F4]"
                  >
                    {acc.bankName} ({acc.accountType}) • ₹{acc.currentBalance.toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Liquid Balance Tag */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F2ECE3] dark:bg-[#273549] border border-[#8F7D65]/20 text-xs">
              <span className="text-[#8F7D65] font-medium">Verified Balance:</span>
              <span className="font-mono font-bold text-[#121008] dark:text-[#F8F7F4]">
                {formatRupee(liquidBalance)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          TWO-SECTION MAIN LAYOUT:
          1. AI Purchase Affordability Calculator
          2. Spend by Category & Projected Purchase Impact
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =====================================================================
            MODULE 1: AI PURCHASE AFFORDABILITY CALCULATOR (7 Cols)
            ===================================================================== */}
        <section className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-6 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6E1D8] dark:border-[#3A3226] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F2ECE3] dark:bg-[#273549] flex items-center justify-center text-[#8F7D65]">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#121008] dark:text-[#F8F7F4]">
                    AI Affordability Calculator
                  </h2>
                  <p className="text-xs text-[#8F7D65]">
                    Analyzed against {accountName}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#F2ECE3] dark:bg-[#273549] text-[#8F7D65] border border-[#8F7D65]/20">
                <Sparkles className="w-3 h-3 text-[#8F7D65]" />
                Gemini Fiduciary Model
              </span>
            </div>

            {/* Inputs Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Item / Service Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8F7D65]">
                    Product or Expense Description
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Sony Bravia 65 TV, iPhone 16..."
                    className="w-full rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] px-3.5 py-2.5 text-xs sm:text-sm text-[#121008] dark:text-[#F8F7F4] font-medium focus:outline-none focus:border-[#8F7D65]"
                  />
                </div>

                {/* Purchase Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8F7D65]">
                    Purchase Price (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8F7D65]">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={purchaseAmount || ""}
                      onChange={(e) => setPurchaseAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold text-[#121008] dark:text-[#F8F7F4] focus:outline-none focus:border-[#8F7D65]"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Amount Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[#8F7D65] font-semibold mr-1">Presets:</span>
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setPurchaseAmount(amt);
                      runAiEvaluation(productName, amt, category, paymentType);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition border ${
                      purchaseAmount === amt
                        ? "bg-[#8F7D65] text-white border-[#8F7D65] shadow-xs"
                        : "bg-[#F8F7F4] dark:bg-[#121008] text-[#8F7D65] border-[#E6E1D8] dark:border-[#3A3226] hover:border-[#8F7D65]"
                    }`}
                  >
                    {formatRupee(amt)}
                  </button>
                ))}
              </div>

              {/* Target Category & Procurement Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8F7D65]">
                    Target Category
                  </label>
                  <select
                    aria-label="Select Target Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] px-3.5 py-2.5 text-xs sm:text-sm text-[#121008] dark:text-[#F8F7F4] font-medium focus:outline-none focus:border-[#8F7D65]"
                  >
                    {CATEGORY_CHOICES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8F7D65]">
                    Procurement Mode
                  </label>
                  <select
                    aria-label="Select Procurement Mode"
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] px-3.5 py-2.5 text-xs sm:text-sm text-[#121008] dark:text-[#F8F7F4] font-medium focus:outline-none focus:border-[#8F7D65]"
                  >
                    <option value="lump_sum">Outright Payment (One-time Debit)</option>
                    <option value="emi_3">3-Month Staggered EMI (~{formatRupee(Math.round(purchaseAmount / 3))}/mo)</option>
                    <option value="emi_6">6-Month Staggered EMI (~{formatRupee(Math.round(purchaseAmount / 6))}/mo)</option>
                  </select>
                </div>
              </div>

              {/* Evaluate Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isEvaluating}
                  onClick={() => runAiEvaluation()}
                  className="w-full py-3 rounded-xl bg-[#8F7D65] hover:bg-[#6F5D48] text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md shadow-[#8F7D65]/20 cursor-pointer disabled:opacity-60"
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Bank History with AI Model...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Evaluate Purchase Feasibility with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Banner if any */}
            {evalError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{evalError}</span>
              </div>
            )}

            {/* ===================================================================
                AI VERDICT DISPLAY & POINT-BY-POINT BREAKDOWN
                =================================================================== */}
            {evaluation && (
              <div className="space-y-4 pt-2">
                {/* Executive Verdict Banner */}
                <div
                  className={`rounded-2xl p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    evaluation.verdict === "YES"
                      ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-100"
                      : evaluation.verdict === "TIGHT"
                      ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40 text-amber-900 dark:text-amber-100"
                      : "bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/40 text-rose-900 dark:text-rose-100"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {evaluation.verdict === "YES" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : evaluation.verdict === "TIGHT" ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <span className="font-mono text-xs uppercase tracking-wider font-bold">
                        {evaluation.verdict === "YES"
                          ? "🟢 VERDICT: AFFORDABLE"
                          : evaluation.verdict === "TIGHT"
                          ? "🟡 VERDICT: STRETCH / CAUTION"
                          : "🔴 VERDICT: NOT RECOMMENDED"}
                      </span>
                    </div>
                    <p className="text-base sm:text-lg font-bold">
                      {evaluation.verdictHeadline}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-white/70 dark:bg-black/30 border border-current/10">
                      Confidence: {evaluation.confidenceScore}%
                    </span>
                  </div>
                </div>

                {/* Key Balance & Runway Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-3 text-center">
                    <span className="text-[10px] font-medium text-[#8F7D65] block uppercase">
                      Current Balance
                    </span>
                    <span className="text-sm font-mono font-bold text-[#121008] dark:text-[#F8F7F4]">
                      {formatRupee(liquidBalance)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-3 text-center">
                    <span className="text-[10px] font-medium text-[#8F7D65] block uppercase">
                      Post-Purchase Balance
                    </span>
                    <span
                      className={`text-sm font-mono font-bold ${
                        liquidBalance - purchaseAmount >= 0
                          ? "text-[#121008] dark:text-[#F8F7F4]"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {formatRupee(liquidBalance - purchaseAmount)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-3 text-center">
                    <span className="text-[10px] font-medium text-[#8F7D65] block uppercase">
                      Safety Runway
                    </span>
                    <span className="text-sm font-mono font-bold text-[#121008] dark:text-[#F8F7F4]">
                      {evaluation.netRunwayMonthsAfterPurchase} mos
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-3 text-center">
                    <span className="text-[10px] font-medium text-[#8F7D65] block uppercase">
                      Capital Drain
                    </span>
                    <span
                      className={`text-sm font-mono font-bold ${
                        evaluation.accountDrainRatio > 50
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-[#8F7D65]"
                      }`}
                    >
                      {evaluation.accountDrainRatio}%
                    </span>
                  </div>
                </div>

                {/* Point-by-Point Breakdown: How & Why (If YES) vs Why & Risks (If NO) */}
                <div className="space-y-3 pt-1">
                  {/* How & Why Section */}
                  {evaluation.howAndWhy && evaluation.howAndWhy.length > 0 && (
                    <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Feasibility Breakdown (How & Why)</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-[#29241E] dark:text-[#D1C7BA] leading-relaxed">
                        {evaluation.howAndWhy.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Why & Risks Section */}
                  {evaluation.whyAndRisks && evaluation.whyAndRisks.length > 0 && (
                    <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wide">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Solvency Warnings & Risk Breakdown</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-[#29241E] dark:text-[#D1C7BA] leading-relaxed">
                        {evaluation.whyAndRisks.map((risk, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended Action */}
                  {evaluation.recommendedAction && (
                    <div className="rounded-xl bg-[#F2ECE3] dark:bg-[#273549] border border-[#8F7D65]/20 p-3.5 flex items-start gap-2.5 text-xs text-[#29241E] dark:text-[#F8F7F4]">
                      <ArrowRight className="w-4 h-4 text-[#8F7D65] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#8F7D65] block uppercase text-[10px] tracking-wider">
                          Fiduciary Recommendation:
                        </span>
                        <span>{evaluation.recommendedAction}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =====================================================================
            MODULE 2: SPEND BY CATEGORY & IMPACT VISUALIZATION (5 Cols)
            ===================================================================== */}
        <section className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-6 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6E1D8] dark:border-[#3A3226] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F2ECE3] dark:bg-[#273549] flex items-center justify-center text-[#8F7D65]">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#121008] dark:text-[#F8F7F4]">
                    Spend by Category
                  </h3>
                  <p className="text-xs text-[#8F7D65]">
                    Simulated impact on monthly living allocations
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#F2ECE3] dark:bg-[#273549] text-[#8F7D65] border border-[#8F7D65]/20">
                1-Mo Projection
              </span>
            </div>

            {/* Impact Status Summary (Reflecting YES vs NO) */}
            <div
              className={`rounded-xl p-4 border space-y-2 ${
                evaluation?.verdict === "YES"
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-100"
                  : evaluation?.verdict === "TIGHT"
                  ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40 text-amber-900 dark:text-amber-100"
                  : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/40 text-rose-900 dark:text-rose-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {evaluation?.verdict === "YES"
                    ? "🟢 Sustainable Living Allocation"
                    : evaluation?.verdict === "TIGHT"
                    ? "🟡 Moderate Cashflow Pinch"
                    : "🔴 High Solvency & Budget Deficit"}
                </span>
                <span className="font-mono text-xs font-bold">
                  +{formatRupee(effectiveAddition)}
                </span>
              </div>

              <p className="text-xs leading-relaxed">
                {evaluation?.verdict === "YES"
                  ? `This purchase is comfortably absorbed within your monthly operating surplus. Total monthly living outflow shifts to ${formatRupee(
                      projectedMonthlyLivingSpend
                    )}, leaving a protective cushion of ${formatRupee(remainingMonthlySurplus)}.`
                  : evaluation?.verdict === "TIGHT"
                  ? `Monthly living spend rises to ${formatRupee(
                      projectedMonthlyLivingSpend
                    )}, consuming substantial operating surplus and tightening emergency buffer.`
                  : `Monthly living spend spikes to ${formatRupee(
                      projectedMonthlyLivingSpend
                    )}, triggering an operating shortfall or drawing heavily upon unbuffered liquid capital.`}
              </p>
            </div>

            {/* Total Living Outflow Before vs After */}
            <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#E6E1D8] dark:border-[#3A3226] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[#8F7D65]">
                <span>Overall Monthly Living Spend</span>
                <span>Before → Projected After</span>
              </div>

              <div className="flex items-baseline justify-between font-mono">
                <div>
                  <span className="text-lg font-bold text-[#121008] dark:text-[#F8F7F4]">
                    {formatRupee(monthlyOutflow)}
                  </span>
                  <span className="text-[11px] text-[#8F7D65] ml-1">current</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[#8F7D65]" />
                <div className="text-right">
                  <span
                    className={`text-lg font-bold ${
                      evaluation?.verdict === "NO"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[#8F7D65]"
                    }`}
                  >
                    {formatRupee(projectedMonthlyLivingSpend)}
                  </span>
                  <span className="text-[11px] text-[#8F7D65] ml-1">projected</span>
                </div>
              </div>

              {/* Dual-color living spend progress bar */}
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-[#E6E1D8] dark:bg-[#273549] overflow-hidden flex">
                  <div
                    className="h-full bg-[#8F7D65]"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((monthlyOutflow / Math.max(1, projectedMonthlyLivingSpend)) * 100)
                      )}%`,
                    }}
                    title={`Current Outflow: ${formatRupee(monthlyOutflow)}`}
                  />
                  <div
                    className={`h-full ${
                      evaluation?.verdict === "NO" ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (effectiveAddition / Math.max(1, projectedMonthlyLivingSpend)) * 100
                        )
                      )}%`,
                    }}
                    title={`Purchase Outlay: ${formatRupee(effectiveAddition)}`}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#8F7D65]">
                  <span>■ Base Living Outflow</span>
                  <span
                    className={
                      evaluation?.verdict === "NO"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    ■ +{formatRupee(effectiveAddition)} Purchase Impact
                  </span>
                </div>
              </div>
            </div>

            {/* Target Category High-Contrast Focus Card */}
            <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#121008] border border-[#8F7D65]/40 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#8F7D65]" />
                  <span className="font-bold text-[#121008] dark:text-[#F8F7F4]">
                    Target Category: {category}
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-[#8F7D65]">
                  {formatRupee(currentCategorySpend)} → {formatRupee(projectedCategorySpend)}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-[#E6E1D8] dark:bg-[#273549] overflow-hidden flex">
                <div
                  className="h-full bg-[#8F7D65]"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (currentCategorySpend / Math.max(1, projectedCategorySpend)) * 100
                      )
                    )}%`,
                  }}
                />
                <div
                  className={`h-full ${
                    evaluation?.verdict === "NO" ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (effectiveAddition / Math.max(1, projectedCategorySpend)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>

              <p className="text-[11px] text-[#8F7D65] italic">
                {evaluation?.categoryImpactSummary ||
                  `Adding ${formatRupee(effectiveAddition)} expands ${category} spend by ${
                    currentCategorySpend > 0
                      ? Math.round((effectiveAddition / currentCategorySpend) * 100) + "%"
                      : "100%"
                  }.`}
              </p>
            </div>

            {/* Itemized Categories Comparison List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[#8F7D65]">
                <span>All Account Categories</span>
                <span>Monthly Allocation</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {CATEGORY_CHOICES.map((catName) => {
                  const isTarget = catName === category;
                  const baseAmt = categorySpendMap[catName] || 0;
                  const finalAmt = isTarget ? baseAmt + effectiveAddition : baseAmt;
                  const maxAmt = Math.max(
                    1,
                    ...Object.values(categorySpendMap),
                    projectedCategorySpend
                  );

                  return (
                    <div
                      key={catName}
                      className={`p-2.5 rounded-xl border transition ${
                        isTarget
                          ? "bg-[#F2ECE3] dark:bg-[#273549] border-[#8F7D65]"
                          : "bg-[#F8F7F4] dark:bg-[#121008] border-[#E6E1D8] dark:border-[#3A3226]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span
                          className={
                            isTarget
                              ? "font-bold text-[#121008] dark:text-[#F8F7F4]"
                              : "text-[#8F7D65]"
                          }
                        >
                          {catName} {isTarget && "(+ Purchase)"}
                        </span>
                        <span className="font-mono font-semibold text-[#121008] dark:text-[#F8F7F4]">
                          {formatRupee(finalAmt)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#E6E1D8] dark:bg-[#3A3226] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isTarget
                              ? evaluation?.verdict === "NO"
                                ? "bg-rose-500"
                                : "bg-[#8F7D65]"
                              : "bg-[#8F7D65]/60"
                          }`}
                          style={{
                            width: `${Math.max(4, Math.round((finalAmt / maxAmt) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
