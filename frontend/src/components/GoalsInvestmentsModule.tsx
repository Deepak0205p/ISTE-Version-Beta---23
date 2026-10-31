import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { formatINR, formatCompactINR, formatDate } from '../utils/currency';
import {
  Compass,
  TrendingUp,
  Target,
  Plus,
  ShieldCheck,
  Award,
  Layers,
  ArrowUpRight,
  Sparkles,
  Calculator,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export const GoalsInvestmentsModule: React.FC = () => {
  const {
    investments,
    goals,
    addInvestment,
    deleteInvestment,
    addGoal,
    deleteGoal,
    contributeToGoal,
    metrics,
    currentUser
  } = useFinancial();

  const [activeTab, setActiveTab] = useState<'gps' | 'portfolio'>('gps');
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  const [contributionAmt, setContributionAmt] = useState<number>(10000);

  // New Goal State
  const [newGoal, setNewGoal] = useState({
    title: '',
    category: 'Emergency Fund' as 'Emergency Fund' | 'Education Fund' | 'Vehicle' | 'Dream Home' | 'Vacation & Travel' | 'Retirement / FI',
    targetAmount: 500000,
    monthlyContribution: 15000,
    targetDate: '2028-12-31',
    notes: ''
  });

  // New Investment Asset State
  const [newInv, setNewInv] = useState({
    name: '',
    category: 'Mutual Funds (Equity)',
    investedPrincipal: 100000,
    currentValuation: 120000,
    investmentDate: new Date().toISOString().split('T')[0],
    cagrOrXirr: 12.0,
    isLiveMarketSync: true
  });

  // Mathematical Calculation for Goals: Compound Annuity Due SIP Formula
  // Calculates required monthly SIP contribution given target, current saved, target date, and expected CAGR (default 12%)
  const calculateGoalRequiredSIP = (goal: { targetAmount: number; currentAmount: number; targetDate: string }, annualCagr: number = 12.0) => {
    const targetDate = new Date(goal.targetDate);
    const now = new Date();
    // Months remaining until target date
    const diffMonths = Math.max(1, Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));
    const monthlyRate = annualCagr / 100 / 12;

    // Future value of existing corpus at milestone date
    const fvCurrent = goal.currentAmount * Math.pow(1 + monthlyRate, diffMonths);
    const deficit = Math.max(0, goal.targetAmount - fvCurrent);

    // Monthly compounding factor for annuity due: ((1 + r)^n - 1) / r * (1 + r)
    const factor = monthlyRate > 0
      ? ((Math.pow(1 + monthlyRate, diffMonths) - 1) / monthlyRate) * (1 + monthlyRate)
      : diffMonths;

    const requiredMonthly = deficit > 0 ? deficit / factor : 0;
    const projectedMaturity = fvCurrent + (goal.monthlyContribution * factor);

    return {
      diffMonths,
      fvCurrent: Math.round(fvCurrent),
      deficit: Math.round(deficit),
      requiredMonthly: Math.round(requiredMonthly),
      projectedMaturity: Math.round(projectedMaturity),
      isOnTrack: goal.monthlyContribution >= requiredMonthly || goal.currentAmount >= goal.targetAmount
    };
  };

  // Portfolio allocation data
  const allocMap: { [cat: string]: number } = {};
  investments.forEach(inv => {
    allocMap[inv.category] = (allocMap[inv.category] || 0) + inv.currentValuation;
  });

  const allocChartData = Object.entries(allocMap).map(([name, value]) => ({ name, value }));
  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Sub-header navigation (Compact & clean, no excessive margins) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#334155] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('gps')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gps'
                ? 'bg-[#3B82F6] text-white shadow-sm'
                : 'bg-white dark:bg-[#1E293B] text-black dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white border border-[#E2E8F0] dark:border-[#334155]'
            }`}
          >
            <Compass size={14} /> Financial GPS & Life Milestones
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'portfolio'
                ? 'bg-[#3B82F6] text-white shadow-sm'
                : 'bg-white dark:bg-[#1E293B] text-black dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white border border-[#E2E8F0] dark:border-[#334155]'
            }`}
          >
            <TrendingUp size={14} /> Consolidated Portfolio
          </button>
        </div>

        {activeTab === 'gps' ? (
          <button
            onClick={() => setShowAddGoalModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <Plus size={14} /> Set New Goal
          </button>
        ) : (
          <button
            onClick={() => setShowAddInvModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <Plus size={14} /> Add Asset Entry
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. FINANCIAL GPS & GOALS */}
      {/* ======================================================== */}
      {activeTab === 'gps' && (
        <div className="space-y-4">
          {/* Top Banner Card (Tight, refined padding) */}
          <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-5 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Compass size={16} className="text-[#3B82F6]" />
                <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider">
                  Vision & Milestone Navigation
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">Your Financial Journey Map</h2>
              <p className="text-xs text-black dark:text-[#94A3B8] mt-0.5 max-w-xl">
                Precision compound interest algorithms project your required monthly SIP, tenure horizon, and corpus completion probability.
              </p>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-[#273549] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] flex items-center gap-5 text-xs shrink-0 shadow-xs">
              <div>
                <span className="text-[11px] text-black dark:text-[#94A3B8] block font-medium">Total Outlay Target</span>
                <span className="text-base font-bold text-[#0F172A] dark:text-white font-tabular">
                  {formatINR(goals.reduce((s, g) => s + g.targetAmount, 0))}
                </span>
              </div>
              <div className="border-l border-[#E2E8F0] dark:border-[#334155] pl-4">
                <span className="text-[11px] text-black dark:text-[#94A3B8] block font-medium">Total Corpus Saved</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-tabular">
                  {formatINR(goals.reduce((s, g) => s + g.currentAmount, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Goal Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-8 rounded-2xl text-center text-xs text-black dark:text-[#94A3B8]">
                No financial goals set yet. Click &quot;Set New Goal&quot; above to establish and track milestones.
              </div>
            ) : (
              goals.map(goal => {
                const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
                const math = calculateGoalRequiredSIP(goal, 12.0);

                return (
                  <div
                    key={goal.id}
                    className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-2xl space-y-3 hover:border-[#3B82F6]/50 transition shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] font-bold uppercase tracking-wide">
                            {goal.category}
                          </span>
                          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white mt-1.5 leading-snug">{goal.title}</h3>
                          <div className="flex items-center gap-1.5 text-[11px] text-black dark:text-[#94A3B8] mt-0.5">
                            <Calendar size={12} className="text-slate-400" />
                            <span>Target: {formatDate(goal.targetDate)} ({math.diffMonths} mos)</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-bold text-[#3B82F6] font-tabular">{progress}%</span>
                          <button
                            onClick={() => deleteGoal(goal.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition ml-1 cursor-pointer block mt-1"
                            title="Delete Goal"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-[#0F172A] h-2 rounded-full overflow-hidden mt-3">
                        <div
                          className="bg-gradient-to-r from-[#2563EB] to-[#3B82F6] h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Saved vs Target metrics */}
                      <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] dark:bg-[#273549] p-2.5 rounded-xl text-center text-xs mt-3">
                        <div>
                          <span className="text-[10px] text-black dark:text-[#94A3B8] block">Saved</span>
                          <span className="font-bold text-[#0F172A] dark:text-white font-tabular">{formatCompactINR(goal.currentAmount)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-black dark:text-[#94A3B8] block">Target</span>
                          <span className="font-bold text-[#0F172A] dark:text-white font-tabular">{formatCompactINR(goal.targetAmount)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-black dark:text-[#94A3B8] block">Monthly SIP</span>
                          <span className="font-bold text-[#7C3AED] font-tabular">{formatINR(goal.monthlyContribution)}</span>
                        </div>
                      </div>

                      {/* Mathematical Algorithm Health Box */}
                      <div className="mt-3 p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Calculated Required SIP (12% CAGR):</span>
                          <strong className="font-bold text-[#0F172A] dark:text-white font-tabular">{formatINR(math.requiredMonthly)}/mo</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Algorithmic Status:</span>
                          {math.isOnTrack ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={12} /> On Schedule
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <AlertTriangle size={12} /> +{formatINR(math.requiredMonthly - goal.monthlyContribution)} Shortfall
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] dark:border-[#334155]/60 mt-3">
                      <span className="text-xs text-black dark:text-[#94A3B8]">Remaining: <strong className="text-[#0F172A] dark:text-white">{formatINR(remaining)}</strong></span>
                      <button
                        onClick={() => setContributeGoalId(goal.id)}
                        className="px-3 py-1.5 bg-[#F1F5F9] dark:bg-[#273549] hover:bg-[#E2E8F0] dark:hover:bg-[#334155] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        + Top Up
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Contribution Inline Dialog */}
          {contributeGoalId && (
            <div className="p-4 bg-white dark:bg-[#273549] border border-[#3B82F6] rounded-xl flex items-center justify-between gap-4 shadow-md">
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">Add Monthly Corpus Contribution</h4>
                <p className="text-xs text-black dark:text-[#94A3B8]">Deposit directly into goal accumulation account.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={contributionAmt}
                  onChange={e => setContributionAmt(Number(e.target.value))}
                  className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white px-3 py-1.5 text-xs rounded-lg w-28 font-tabular outline-none"
                />
                <button
                  onClick={() => {
                    contributeToGoal(contributeGoalId, contributionAmt);
                    setContributeGoalId(null);
                  }}
                  className="px-4 py-1.5 bg-[#3B82F6] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#1D4ED8] transition"
                >
                  Deposit
                </button>
                <button
                  onClick={() => setContributeGoalId(null)}
                  className="px-3 py-1.5 text-black dark:text-[#94A3B8] text-xs hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CONSOLIDATED INVESTMENT PORTFOLIO */}
      {/* ======================================================== */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-black dark:text-[#94A3B8] font-medium">Portfolio Current Valuation</span>
              <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-tabular mt-1">
                {formatINR(metrics.totalInvestmentValuation)}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">Live & Fixed Assets</span>
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-black dark:text-[#94A3B8] font-medium">Total Invested Principal</span>
              <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-tabular mt-1">
                {formatINR(metrics.totalInvestedPrincipal)}
              </div>
              <span className="text-[11px] text-black dark:text-[#94A3B8] mt-0.5 block font-medium">Net Capital Deployed</span>
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-black dark:text-[#94A3B8] font-medium">Unrealized Capital Gains</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-tabular mt-1">
                {metrics.totalInvestmentValuation >= metrics.totalInvestedPrincipal ? '+' : ''}
                {formatINR(metrics.totalInvestmentValuation - metrics.totalInvestedPrincipal)}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                {metrics.totalInvestedPrincipal > 0
                  ? `${Math.round(((metrics.totalInvestmentValuation - metrics.totalInvestedPrincipal) / metrics.totalInvestedPrincipal) * 100)}% Absolute Return`
                  : '0% Absolute Return'}
              </span>
            </div>
            <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-black dark:text-[#94A3B8] font-medium">Weighted CAGR / XIRR</span>
              <div className="text-2xl font-bold text-[#3B82F6] font-tabular mt-1">
                {investments.length > 0 && metrics.totalInvestmentValuation > 0
                  ? `${(investments.reduce((sum, inv) => sum + (inv.cagrOrXirr ?? 0) * inv.currentValuation, 0) / metrics.totalInvestmentValuation).toFixed(1)}%`
                  : '—'}
              </div>
              <span className="text-[11px] text-black dark:text-[#94A3B8] mt-0.5 block font-medium">Annualized Compound Yield</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Holdings Table */}
            <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">Consolidated Holdings Ledger</h3>
                  <p className="text-xs text-black dark:text-[#94A3B8]">Mutual Funds, Sovereign Bonds, PPF, FDs</p>
                </div>
                <button
                  onClick={() => setShowAddInvModal(true)}
                  className="px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-[#1D4ED8] transition flex items-center gap-1"
                >
                  <Plus size={13} /> Add Asset
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#273549] text-black dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#334155] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3">Asset Name</th>
                      <th className="p-3">Class</th>
                      <th className="p-3 text-right">Invested</th>
                      <th className="p-3 text-right">Current Value</th>
                      <th className="p-3 text-right">XIRR</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                    {investments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-black dark:text-[#94A3B8]">
                          No investment holdings recorded. Click &quot;Add Asset Entry&quot; above to track mutual funds, equity, or FDs.
                        </td>
                      </tr>
                    ) : (
                      investments.map(inv => (
                        <tr key={inv.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#273549]/40 transition">
                          <td className="p-3 font-semibold text-[#0F172A] dark:text-white">
                            <div>{inv.name}</div>
                            <span className="text-[10px] text-black dark:text-[#94A3B8] block">Since {formatDate(inv.investmentDate)}</span>
                          </td>
                          <td className="p-3 text-black dark:text-[#94A3B8]">{inv.category}</td>
                          <td className="p-3 text-right text-black dark:text-[#94A3B8] font-tabular">{formatINR(inv.investedPrincipal)}</td>
                          <td className="p-3 text-right font-bold text-[#0F172A] dark:text-white font-tabular">{formatINR(inv.currentValuation)}</td>
                          <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-tabular">
                            {inv.cagrOrXirr ? `${inv.cagrOrXirr}%` : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => deleteInvestment(inv.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                              title="Delete Asset"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Asset Allocation Donut */}
            <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-5 rounded-2xl flex flex-col shadow-xs">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white mb-0.5">Asset Allocation</h3>
              <p className="text-xs text-black dark:text-[#94A3B8] mb-3">Diversification by asset class</p>

              <div className="h-44 w-full min-w-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={176} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={allocChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {allocChartData.map((_, index) => (
                        <Cell key={`cell-inv-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '10px', color: '#FFF' }}
                      formatter={(val: any) => [formatINR(Number(val)), 'Valuation']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 mt-3 flex-1 overflow-y-auto max-h-48 pr-1">
                {allocChartData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs py-1 border-b border-[#E2E8F0] dark:border-[#334155]/40">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-black dark:text-[#94A3B8] truncate">{item.name}</span>
                    </div>
                    <span className="font-bold text-[#0F172A] dark:text-white font-tabular shrink-0">{formatINR(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Goal */}
      {showAddGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#334155] pb-3">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <Target size={16} className="text-[#3B82F6]" /> Set Financial Goal
              </h3>
              <button onClick={() => setShowAddGoalModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Higher Education Fund / Dream Home"
                  value={newGoal.title}
                  onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Category</label>
                <select
                  value={newGoal.category}
                  onChange={e => setNewGoal({ ...newGoal, category: e.target.value as any })}
                  className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 outline-none"
                >
                  <option value="Emergency Fund">Emergency Fund</option>
                  <option value="Education Fund">Education Fund</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Dream Home">Dream Home</option>
                  <option value="Vacation & Travel">Vacation & Travel</option>
                  <option value="Retirement / FI">Retirement / FI</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Target Amount (₹)</label>
                  <input
                    type="number"
                    value={newGoal.targetAmount}
                    onChange={e => setNewGoal({ ...newGoal, targetAmount: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 font-bold font-tabular outline-none"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Monthly Planned SIP (₹)</label>
                  <input
                    type="number"
                    value={newGoal.monthlyContribution}
                    onChange={e => setNewGoal({ ...newGoal, monthlyContribution: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 font-bold font-tabular outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Target Date</label>
                <input
                  type="date"
                  value={newGoal.targetDate}
                  onChange={e => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                  className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
              <button
                onClick={() => setShowAddGoalModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newGoal.title) return;
                  addGoal({
                    ...newGoal,
                    currentAmount: 0,
                    status: 'ON_TRACK'
                  });
                  setShowAddGoalModal(false);
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs"
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Asset Entry */}
      {showAddInvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#334155] pb-3">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-[#3B82F6]" /> Add Investment Asset
              </h3>
              <button onClick={() => setShowAddInvModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Asset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Parag Parikh Flexi Cap Fund / SGB 2029"
                  value={newInv.name}
                  onChange={e => setNewInv({ ...newInv, name: e.target.value })}
                  className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Asset Class</label>
                <select
                  value={newInv.category}
                  onChange={e => setNewInv({ ...newInv, category: e.target.value })}
                  className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 outline-none"
                >
                  <option value="Mutual Funds (Equity)">Mutual Funds (Equity)</option>
                  <option value="Mutual Funds (Debt)">Mutual Funds (Debt)</option>
                  <option value="Direct Equity (Stocks)">Direct Equity (Stocks)</option>
                  <option value="Sovereign Gold Bonds">Sovereign Gold Bonds</option>
                  <option value="PPF / EPF">PPF / EPF</option>
                  <option value="Fixed Deposit (FD)">Fixed Deposit (FD)</option>
                  <option value="National Pension Scheme (NPS)">National Pension Scheme (NPS)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Invested Principal (₹)</label>
                  <input
                    type="number"
                    value={newInv.investedPrincipal}
                    onChange={e => setNewInv({ ...newInv, investedPrincipal: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 font-bold font-tabular outline-none"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Current Valuation (₹)</label>
                  <input
                    type="number"
                    value={newInv.currentValuation}
                    onChange={e => setNewInv({ ...newInv, currentValuation: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 font-bold font-tabular outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">CAGR / XIRR (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newInv.cagrOrXirr}
                    onChange={e => setNewInv({ ...newInv, cagrOrXirr: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 font-bold font-tabular outline-none"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1 font-medium">Investment Date</label>
                  <input
                    type="date"
                    value={newInv.investmentDate}
                    onChange={e => setNewInv({ ...newInv, investmentDate: e.target.value })}
                    className="w-full bg-[#F8FAFC] dark:bg-[#273549] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-white rounded-lg p-2.5 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
              <button
                onClick={() => setShowAddInvModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newInv.name) return;
                  addInvestment({
                    ...newInv,
                    ownerId: currentUser.id
                  });
                  setShowAddInvModal(false);
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs"
              >
                Save Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
