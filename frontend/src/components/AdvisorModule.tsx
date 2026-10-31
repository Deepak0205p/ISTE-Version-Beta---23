import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { formatINR } from '../utils/currency';
import {
  Bot,
  Sparkles,
  Send,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { TransactionRecord } from '../types';

interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  text: string;
  timestamp: string;
}

const STRICT_PRECONDITION_REFUSAL =
  "Please provide at least 3 months of bank statements or financial records first so I can study your personal financial conditions accurately before giving suggestions.";

// Helper function to check for at least 3 consecutive calendar months of statements/records
function checkConsecutiveMonths(transactions: TransactionRecord[]): {
  hasThreeConsecutiveMonths: boolean;
  consecutiveMonthsCount: number;
  distinctMonthKeys: string[];
} {
  if (!transactions || transactions.length === 0) {
    return {
      hasThreeConsecutiveMonths: false,
      consecutiveMonthsCount: 0,
      distinctMonthKeys: [],
    };
  }

  // Extract unique Year-Month keys (format: YYYY-MM)
  const monthKeySet = new Set<string>();
  for (const t of transactions) {
    if (t.date) {
      const ym = t.date.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthKeySet.add(ym);
      }
    }
  }

  const sortedMonths = Array.from(monthKeySet).sort();
  if (sortedMonths.length === 0) {
    return {
      hasThreeConsecutiveMonths: false,
      consecutiveMonthsCount: 0,
      distinctMonthKeys: [],
    };
  }

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedMonths.length; i++) {
    const [prevYear, prevMonth] = sortedMonths[i - 1].split('-').map(Number);
    const [currYear, currMonth] = sortedMonths[i].split('-').map(Number);

    const monthDiff = (currYear - prevYear) * 12 + (currMonth - prevMonth);
    if (monthDiff === 1) {
      currentStreak += 1;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      currentStreak = 1;
    }
  }

  return {
    hasThreeConsecutiveMonths: maxStreak >= 3,
    consecutiveMonthsCount: maxStreak,
    distinctMonthKeys: sortedMonths,
  };
}

export const AdvisorModule: React.FC = () => {
  const { metrics, loans, goals, habitualExpenses, currentUser, investments, transactions } = useFinancial();

  const sufficiency = useMemo(() => {
    return checkConsecutiveMonths(transactions);
  }, [transactions]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const initialSufficiency = checkConsecutiveMonths(transactions);
    const initialText = !initialSufficiency.hasThreeConsecutiveMonths
      ? STRICT_PRECONDITION_REFUSAL
      : `Hello ${currentUser.name}! I have verified ${initialSufficiency.consecutiveMonthsCount} consecutive months of your financial statements. I have completed analysis across your income streams, recurring spending patterns, and cash flow stability. How can I assist your financial strategy today?`;

    return [
      {
        id: 'm1',
        sender: 'AI',
        text: initialText,
        timestamp: 'Just now'
      }
    ];
  });
  const [userInput, setUserInput] = useState('');

  // 1. Analyze, 2. Identify, 3. Guide Insights (strictly gated behind 3 consecutive months)
  const structuredAdvisory = useMemo(() => {
    if (!sufficiency.hasThreeConsecutiveMonths) {
      return null;
    }

    // 1. Analyze: Income streams, recurring spending, fixed vs variable, cash flow stability
    const monthlyIncome = metrics.monthlyIncome;
    const monthlyExpenses = metrics.monthlyExpenses;
    const recurringOutflow = habitualExpenses.reduce((s, h) => s + h.amount, 0);
    const variableBurn = Math.max(0, monthlyExpenses - recurringOutflow - metrics.monthlyEmiCommitments);
    const cashFlowStability = monthlyIncome > 0 
      ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100)
      : 0;

    // 2. Identify: Subscription leaks, wasteful spending, high-risk habits
    const highRiskFlags: string[] = [];
    const subscriptionLeaks: string[] = [];
    
    if (habitualExpenses.length > 3) {
      subscriptionLeaks.push(
        `${habitualExpenses.length} recurring commitments totaling ${formatINR(recurringOutflow)}/month.`
      );
    }
    if (metrics.savingsRatePercentage < 20) {
      highRiskFlags.push(
        `Savings rate is currently ${metrics.savingsRatePercentage}%, below the 20% stability baseline.`
      );
    }
    if (loans.length > 0 && metrics.monthlyEmiCommitments > monthlyIncome * 0.4) {
      highRiskFlags.push(
        `Debt service ratio is high: EMI commitments (${formatINR(metrics.monthlyEmiCommitments)}) exceed 40% of income.`
      );
    }

    // 3. Guide: Tailored data-backed financial guidance and customized budgeting strategies
    const recommendedBudget = {
      needs: Math.round(monthlyIncome * 0.5),
      wants: Math.round(monthlyIncome * 0.3),
      savingsAndDebt: Math.round(monthlyIncome * 0.2),
    };

    return {
      analyze: {
        monthlyIncome,
        recurringOutflow,
        variableBurn,
        cashFlowStability,
        monthsCount: sufficiency.consecutiveMonthsCount,
      },
      identify: {
        subscriptionLeaks,
        highRiskFlags,
        recurringCount: habitualExpenses.length,
      },
      guide: {
        recommendedBudget,
        emergencyFundTarget: Math.round(monthlyExpenses * 6),
      }
    };
  }, [sufficiency, metrics, habitualExpenses, loans]);

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'USER',
      text: userInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setUserInput('');

    setTimeout(() => {
      let reply = '';

      // STRICT PRE-CONDITION GATING
      if (!sufficiency.hasThreeConsecutiveMonths) {
        reply = STRICT_PRECONDITION_REFUSAL;
      } else {
        const lower = userMsg.text.toLowerCase();

        // 1. Analyze requested
        if (lower.includes('analyze') || lower.includes('income') || lower.includes('cash flow') || lower.includes('fixed') || lower.includes('variable')) {
          reply = `[1. Analyze - ${sufficiency.consecutiveMonthsCount} Months Verified]\n• Income Stream: ${formatINR(metrics.monthlyIncome)}/month recorded across verified statements.\n• Fixed Commitments: ${formatINR(habitualExpenses.reduce((s, h) => s + h.amount, 0) + metrics.monthlyEmiCommitments)}/month.\n• Variable Burn: ${formatINR(Math.max(0, metrics.monthlyExpenses - habitualExpenses.reduce((s, h) => s + h.amount, 0))) }/month.\n• Cash Flow Stability: Net monthly surplus is ${formatINR(metrics.remainingBalance)} (${metrics.savingsRatePercentage}% savings retention).`;
        }
        // 2. Identify requested
        else if (lower.includes('identify') || lower.includes('subscription') || lower.includes('leak') || lower.includes('waste') || lower.includes('risk')) {
          const leakInfo = habitualExpenses.length > 0 
            ? `${habitualExpenses.length} recurring outflow(s) totaling ${formatINR(habitualExpenses.reduce((s, h) => s + h.amount, 0))}/month.` 
            : 'No recurring subscription leaks detected.';
          const riskInfo = metrics.savingsRatePercentage < 20 
            ? `Savings margin of ${metrics.savingsRatePercentage}% creates vulnerability to shocks.` 
            : 'Savings retention is within healthy bounds.';
          reply = `[2. Identify - Anomalies & Leaks]\n• Subscription & Recurring Leaks: ${leakInfo}\n• Risk Assessment: ${riskInfo}\n• High-Risk Habit Check: Liquid buffer stands at ${formatINR(metrics.totalSavingsBalance)} against monthly commitments of ${formatINR(metrics.monthlyExpenses)}.`;
        }
        // 3. Guide requested
        else if (lower.includes('guide') || lower.includes('budget') || lower.includes('strategy') || lower.includes('recommend') || lower.includes('plan')) {
          const needs = Math.round(metrics.monthlyIncome * 0.5);
          const wants = Math.round(metrics.monthlyIncome * 0.3);
          const savings = Math.round(metrics.monthlyIncome * 0.2);
          reply = `[3. Guide - Tailored Budgeting Strategy]\nBased on your 3+ months verified records, here is your customized 50/30/20 budget:\n• Essential Needs (50% max): Target ₹${needs.toLocaleString('en-IN')}/mo (Current: ₹${metrics.monthlyExpenses.toLocaleString('en-IN')})\n• Discretionary (30% max): Target ₹${wants.toLocaleString('en-IN')}/mo\n• Savings & Acceleration (20% min): Target ₹${savings.toLocaleString('en-IN')}/mo\n• Emergency Target: Build 6 months of expenses (${formatINR(metrics.monthlyExpenses * 6)}) before high-risk allocations.`;
        }
        // General query with 3+ months met: Provide full 1-2-3 structured synthesis
        else {
          reply = `[Financial Review Summary (3+ Months Data Verified)]\n\n1. Analyze: Monthly income stream is ${formatINR(metrics.monthlyIncome)} with ${formatINR(metrics.monthlyExpenses)} total outflow and ${formatINR(metrics.totalSavingsBalance)} liquid cushion.\n\n2. Identify: ${habitualExpenses.length} recurring subscription commitments detected (${formatINR(habitualExpenses.reduce((s, h) => s + h.amount, 0))}/mo). Debt obligations: ${formatINR(metrics.monthlyEmiCommitments)}/mo.\n\n3. Guide: Maintain a 6-month buffer (${formatINR(metrics.monthlyExpenses * 6)}) and allocate 20% (${formatINR(Math.round(metrics.monthlyIncome * 0.2))}/mo) towards automated savings/investments.`;
        }
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMsg]);
    }, 500);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Advisor Header */}
      <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot size={20} className="text-[#8D7A62]" />
            <span className="text-xs font-bold text-[#8D7A62] uppercase tracking-wider">
              FinTech Intelligence Engine
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">Data-Grounded Financial Advisory</h2>
          <p className="text-xs text-[#A79A8A] mt-1 max-w-xl">
            Synthesizing banking transactions, loan amortization, habitual trends, and goal velocity without hallucinations or unverified external advice.
          </p>
        </div>

        {/* 3-Month Gating Status Badge (Green #16A579 if satisfied, Gray #8A847B if insufficient data) */}
        <div className={`px-4 py-2 rounded-xl border text-xs flex items-center gap-2.5 ${
          sufficiency.hasThreeConsecutiveMonths
            ? 'bg-[#E7F5EF] border-[#16A579]/40 text-[#16A579] dark:bg-[#16A579]/20'
            : 'bg-[#EFEEE9] border-[#8A847B]/40 text-[#8A847B] dark:bg-[#8A847B]/20 dark:text-[#EFEEE9]'
        }`}>
          {sufficiency.hasThreeConsecutiveMonths ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#16A579] animate-pulse" />
              <span>
                <strong>Verified:</strong> {sufficiency.consecutiveMonthsCount} consecutive months of records
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={15} className="text-[#8A847B] shrink-0" />
              <span>
                <strong>INSUFFICIENT DATA:</strong> {sufficiency.consecutiveMonthsCount}/3 consecutive months provided
              </span>
            </>
          )}
        </div>
      </div>

      {/* Pre-condition Notice banner: Gray #8A847B / #EFEEE9 for Insufficient Data */}
      {!sufficiency.hasThreeConsecutiveMonths && (
        <div className="bg-[#EFEEE9] dark:bg-[#8A847B]/20 border border-[#8A847B]/40 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="text-[#8A847B] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-[#8A847B] dark:text-[#EFEEE9] uppercase tracking-wide">
              INSUFFICIENT DATA: 3-Month History Gatekeeper
            </h4>
            <p className="text-xs text-[#746B60] dark:text-[#D5D2CD] leading-relaxed">
              {STRICT_PRECONDITION_REFUSAL}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Structured 3-Step Advisory or Gate Status */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-[#8D7A62]" />
            {sufficiency.hasThreeConsecutiveMonths
              ? 'Multi-Month Grounded Analysis'
              : 'Algorithmic Observations'}
          </h3>

          {!sufficiency.hasThreeConsecutiveMonths ? (
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-[#8A847B] text-xs font-semibold">
                <ShieldAlert size={16} />
                <span>INSUFFICIENT DATA: Advisory Modules Withheld</span>
              </div>
              <p className="text-xs text-[#A79A8A] leading-relaxed">
                Financial suggestions, budget plans, and recommendations remain withheld until at least 3 consecutive months of bank statements are imported.
              </p>
              <div className="pt-2 border-t border-[#3A3226]/60 text-[11px] text-[#8D7A62]">
                Import statements in the <strong>Banking</strong> tab to unlock:
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[#A79A8A]">
                  <li>1. Analyze: Income & recurring spending</li>
                  <li>2. Identify: Subscription leaks & waste</li>
                  <li>3. Guide: Tailored budget recommendations</li>
                </ul>
              </div>
            </div>
          ) : structuredAdvisory ? (
            <div className="space-y-3">
              {/* Step 1: Analyze Card */}
              <div className="bg-[#1D1913] border border-[#3A3226] p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-blue-500/10 text-blue-400 flex items-center gap-1">
                    <TrendingUp size={12} />
                    1. Analyze
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {structuredAdvisory.analyze.monthsCount} Mo. Verified
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">Cash Flow & Outflow Stability</h4>
                <div className="text-[11px] text-[#A79A8A] space-y-1">
                  <div>• Inflow Stream: <strong className="text-white">{formatINR(structuredAdvisory.analyze.monthlyIncome)}/mo</strong></div>
                  <div>• Fixed Commitments: <strong className="text-white">{formatINR(structuredAdvisory.analyze.recurringOutflow)}/mo</strong></div>
                  <div>• Variable Burn: <strong className="text-white">{formatINR(structuredAdvisory.analyze.variableBurn)}/mo</strong></div>
                  <div>• Cash Flow Buffer: <strong className="text-emerald-400">{structuredAdvisory.analyze.cashFlowStability}% retained</strong></div>
                </div>
              </div>

              {/* Step 2: Identify Card */}
              <div className="bg-[#1D1913] border border-[#3A3226] p-4 rounded-xl space-y-2">
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/10 text-amber-400 flex items-center gap-1 w-fit">
                  <ShieldAlert size={12} />
                  2. Identify
                </span>
                <h4 className="text-xs font-bold text-white">Leaks & High-Risk Spending</h4>
                <div className="text-[11px] text-[#A79A8A] space-y-1">
                  {structuredAdvisory.identify.subscriptionLeaks.length > 0 ? (
                    structuredAdvisory.identify.subscriptionLeaks.map((leak, idx) => (
                      <div key={idx} className="text-amber-300/90">• {leak}</div>
                    ))
                  ) : (
                    <div>• No wasteful subscription leaks detected ({structuredAdvisory.identify.recurringCount} recurring item).</div>
                  )}
                  {structuredAdvisory.identify.highRiskFlags.map((risk, idx) => (
                    <div key={idx} className="text-red-400">• {risk}</div>
                  ))}
                </div>
              </div>

              {/* Step 3: Guide Card */}
              <div className="bg-[#1D1913] border border-[#3A3226] p-4 rounded-xl space-y-2">
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/10 text-emerald-400 flex items-center gap-1 w-fit">
                  <Compass size={12} />
                  3. Guide
                </span>
                <h4 className="text-xs font-bold text-white">Customized Budgeting Blueprint</h4>
                <div className="text-[11px] text-[#A79A8A] space-y-1">
                  <div>• Needs (50% max): <strong className="text-white">{formatINR(structuredAdvisory.guide.recommendedBudget.needs)}/mo</strong></div>
                  <div>• Discretionary (30%): <strong className="text-white">{formatINR(structuredAdvisory.guide.recommendedBudget.wants)}/mo</strong></div>
                  <div>• Savings/Debt (20%): <strong className="text-emerald-400">{formatINR(structuredAdvisory.guide.recommendedBudget.savingsAndDebt)}/mo</strong></div>
                  <div className="pt-1 text-[10px] text-[#8D7A62]">
                    Target Emergency Cushion: {formatINR(structuredAdvisory.guide.emergencyFundTarget)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: Interactive FinTech Advisory Chat */}
        <div className="lg:col-span-2 bg-[#1D1913] border border-[#3A3226] rounded-2xl flex flex-col h-[520px] shadow-xl overflow-hidden">
          <div className="p-4 border-b border-[#3A3226] bg-[#241F17] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#4F7CAC]/15 border border-[#4F7CAC]/40 flex items-center justify-center text-[#4F7CAC]">
                <Bot size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  Money Matters Financial AI
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-normal bg-[#4F7CAC]/10 text-[#4F7CAC] border border-[#4F7CAC]/30">
                    Pure Explanation
                  </span>
                </h4>
                <p className="text-[10px] text-[#16A579] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A579] inline-block" />
                  Ledger Grounded • PII Redacted • Local Engine Priority
                </p>
              </div>
            </div>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'USER'
                      ? 'bg-[#8F7D65] text-white rounded-br-none shadow-sm'
                      : 'bg-[#EAF1F7] text-[#29241E] dark:bg-[#4F7CAC]/15 dark:text-[#F7F5F1] border border-[#4F7CAC]/30 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-[#A79A8A] mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 bg-[#241F17] border-t border-[#3A3226] flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask about your loans, emergency fund, SIP projections, or spending habits..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-[#191510] border border-[#3A3226] text-white text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#8D7A62]"
            />
            <button
              onClick={handleSendMessage}
              className="p-2.5 bg-[#8D7A62] hover:bg-[#6E5A44] text-white rounded-xl transition cursor-pointer"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

