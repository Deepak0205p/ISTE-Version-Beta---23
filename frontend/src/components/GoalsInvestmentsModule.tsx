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
  Sparkles
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export const GoalsInvestmentsModule: React.FC = () => {
  const {
    investments,
    goals,
    addInvestment,
    addGoal,
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
    category: 'Emergency Fund' as any,
    targetAmount: 500000,
    monthlyContribution: 15000,
    targetDate: '2028-12-31'
  });

  // Portfolio allocation data
  const allocMap: { [cat: string]: number } = {};
  investments.forEach(inv => {
    allocMap[inv.category] = (allocMap[inv.category] || 0) + inv.currentValuation;
  });

  const allocChartData = Object.entries(allocMap).map(([name, value]) => ({ name, value }));
  const COLORS = ['#8D7A62', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899'];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Sub-header navigation */}
      <div className="flex items-center justify-between border-b border-[#3A3226] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('gps')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              activeTab === 'gps'
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            <Compass size={14} /> Financial GPS & Life Milestones
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              activeTab === 'portfolio'
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            <TrendingUp size={14} /> Consolidated Investment Portfolio
          </button>
        </div>

        {activeTab === 'gps' ? (
          <button
            onClick={() => setShowAddGoalModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-semibold rounded-lg transition"
          >
            <Plus size={14} /> Set New Goal
          </button>
        ) : (
          <button
            onClick={() => setShowAddInvModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-semibold rounded-lg transition"
          >
            <Plus size={14} /> Add Asset Entry
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. FINANCIAL GPS & GOALS */}
      {/* ======================================================== */}
      {activeTab === 'gps' && (
        <div className="space-y-6">
          <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Compass size={18} className="text-[#8D7A62]" />
                <span className="text-xs font-bold text-[#8D7A62] uppercase tracking-wider">
                  Vision & Milestone Navigation
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">Your Financial Journey Map</h2>
              <p className="text-xs text-[#A79A8A] mt-1 max-w-xl">
                Track realistic milestones with monthly contribution schedules, emergency cushions, and family education funds.
              </p>
            </div>
            <div className="bg-[#241F17] p-4 rounded-xl border border-[#3A3226] flex items-center gap-4 text-xs">
              <div>
                <span className="text-[#A79A8A] block">Total Target Outlay</span>
                <span className="text-base font-bold text-white font-tabular">
                  {formatINR(goals.reduce((s, g) => s + g.targetAmount, 0))}
                </span>
              </div>
              <div>
                <span className="text-[#A79A8A] block">Corpus Saved</span>
                <span className="text-base font-bold text-emerald-400 font-tabular">
                  {formatINR(goals.reduce((s, g) => s + g.currentAmount, 0))}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {goals.length === 0 ? (
              <div className="col-span-full bg-[#1D1913] border border-[#3A3226] p-8 rounded-2xl text-center text-xs text-[#A79A8A]">
                No financial goals set yet. Click &quot;Set New Goal&quot; above to establish and track milestones.
              </div>
            ) : (
              goals.map(goal => {
              const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

              return (
                <div
                  key={goal.id}
                  className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl space-y-4 hover:border-[#8D7A62]/40 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#241F17] text-[#8D7A62] font-bold uppercase">
                        {goal.category}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1.5">{goal.title}</h3>
                      <p className="text-xs text-[#A79A8A]">Target Date: {formatDate(goal.targetDate)}</p>
                    </div>
                    <span className="text-sm font-bold text-[#8D7A62] font-tabular">{progress}%</span>
                  </div>

                  <div className="w-full bg-[#191510] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#6E5A44] to-[#8D7A62] h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#241F17] p-3 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-[10px] text-[#A79A8A] block">Saved</span>
                      <span className="font-bold text-white font-tabular">{formatCompactINR(goal.currentAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A79A8A] block">Target</span>
                      <span className="font-bold text-white font-tabular">{formatCompactINR(goal.targetAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A79A8A] block">Monthly Plan</span>
                      <span className="font-bold text-[#C9A87E] font-tabular">{formatINR(goal.monthlyContribution)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-[#A79A8A]">Remaining: {formatINR(remaining)}</span>
                    <button
                      onClick={() => setContributeGoalId(goal.id)}
                      className="px-3 py-1.5 bg-[#241F17] hover:bg-[#2E2820] border border-[#3A3226] text-white text-xs font-semibold rounded-lg transition"
                    >
                      + Top Up Corpus
                    </button>
                  </div>
                </div>
              );
            }))}
          </div>

          {/* Contribution Inline Dialog */}
          {contributeGoalId && (
            <div className="p-4 bg-[#241F17] border border-[#8D7A62] rounded-xl flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white">Add Monthly Corpus Contribution</h4>
                <p className="text-xs text-[#A79A8A]">Deposit directly into goal accumulation account.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={contributionAmt}
                  onChange={e => setContributionAmt(Number(e.target.value))}
                  className="bg-[#191510] border border-[#3A3226] text-white px-3 py-1.5 text-xs rounded-lg w-28"
                />
                <button
                  onClick={() => {
                    contributeToGoal(contributeGoalId, contributionAmt);
                    setContributeGoalId(null);
                  }}
                  className="px-4 py-1.5 bg-[#8D7A62] text-white text-xs font-bold rounded-lg"
                >
                  Deposit
                </button>
                <button
                  onClick={() => setContributeGoalId(null)}
                  className="px-3 py-1.5 text-[#A79A8A] text-xs hover:text-white"
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Portfolio Current Valuation</span>
              <div className="text-2xl font-bold text-white font-tabular mt-1">
                {formatINR(metrics.totalInvestmentValuation)}
              </div>
              <span className="text-[11px] text-emerald-400 mt-1 block">Live & Fixed Valuation</span>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Total Invested Principal</span>
              <div className="text-2xl font-bold text-white font-tabular mt-1">
                {formatINR(metrics.totalInvestedPrincipal)}
              </div>
              <span className="text-[11px] text-[#A79A8A] mt-1 block">Net Capital Deployed</span>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Unrealized Capital Gains</span>
              <div className="text-2xl font-bold text-emerald-400 font-tabular mt-1">
                {metrics.totalInvestmentValuation >= metrics.totalInvestedPrincipal ? '+' : ''}
                {formatINR(metrics.totalInvestmentValuation - metrics.totalInvestedPrincipal)}
              </div>
              <span className="text-[11px] text-emerald-400 mt-1 block">
                {metrics.totalInvestedPrincipal > 0
                  ? `${Math.round(((metrics.totalInvestmentValuation - metrics.totalInvestedPrincipal) / metrics.totalInvestedPrincipal) * 100)}% Absolute Return`
                  : '0% Absolute Return'}
              </span>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Weighted CAGR / XIRR</span>
              <div className="text-2xl font-bold text-[#8D7A62] font-tabular mt-1">
                {investments.length > 0 && metrics.totalInvestmentValuation > 0
                  ? `${(investments.reduce((sum, inv) => sum + (inv.cagrOrXirr ?? 0) * inv.currentValuation, 0) / metrics.totalInvestmentValuation).toFixed(1)}%`
                  : '—'}
              </div>
              <span className="text-[11px] text-[#A79A8A] mt-1 block">Annualized Yield</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Holdings Table */}
            <div className="lg:col-span-2 bg-[#1D1913] border border-[#3A3226] rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-[#3A3226]">
                <h3 className="text-sm font-bold text-white">Consolidated Holdings Ledger</h3>
                <p className="text-xs text-[#A79A8A]">Mutual Funds, Sovereign Bonds, PPF, FDs</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#241F17] text-[#A79A8A] border-b border-[#3A3226] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3.5">Asset Name</th>
                      <th className="p-3.5">Class</th>
                      <th className="p-3.5 text-right">Invested</th>
                      <th className="p-3.5 text-right">Current Value</th>
                      <th className="p-3.5 text-right">XIRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3226]">
                    {investments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[#A79A8A]">
                          No investment holdings recorded. Click &quot;Add Asset Entry&quot; above to track mutual funds, equity, or FDs.
                        </td>
                      </tr>
                    ) : (
                      investments.map(inv => (
                        <tr key={inv.id} className="hover:bg-[#241F17]/40 transition">
                          <td className="p-3.5 font-semibold text-white">
                            <div>{inv.name}</div>
                            <span className="text-[10px] text-[#A79A8A]">Since {formatDate(inv.investmentDate)}</span>
                          </td>
                          <td className="p-3.5 text-[#A79A8A]">{inv.category}</td>
                          <td className="p-3.5 text-right text-[#B3A595] font-tabular">{formatINR(inv.investedPrincipal)}</td>
                          <td className="p-3.5 text-right font-bold text-white font-tabular">{formatINR(inv.currentValuation)}</td>
                          <td className="p-3.5 text-right font-bold text-emerald-400 font-tabular">
                            {inv.cagrOrXirr ? `${inv.cagrOrXirr}%` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Asset Allocation Donut */}
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl flex flex-col">
              <h3 className="text-sm font-bold text-white mb-1">Asset Allocation</h3>
              <p className="text-xs text-[#A79A8A] mb-4">Diversification by asset class</p>

              <div className="h-48 w-full min-w-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={192} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={allocChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {allocChartData.map((_, index) => (
                        <Cell key={`cell-inv-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#241F17', borderColor: '#3A3226', borderRadius: '10px', color: '#FFF' }}
                      formatter={(val: any) => [formatINR(Number(val)), 'Valuation']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-4 flex-1">
                {allocChartData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs py-1 border-b border-[#3A3226]/40">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-[#B3A595]">{item.name}</span>
                    </div>
                    <span className="font-bold text-white font-tabular">{formatINR(item.value)}</span>
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
          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create Financial Goal</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#A79A8A] block mb-1">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Electric SUV Upgrade"
                  value={newGoal.title}
                  onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#A79A8A] block mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    value={newGoal.targetAmount}
                    onChange={e => setNewGoal({ ...newGoal, targetAmount: Number(e.target.value) })}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="text-[#A79A8A] block mb-1">Monthly Plan (₹)</label>
                  <input
                    type="number"
                    value={newGoal.monthlyContribution}
                    onChange={e => setNewGoal({ ...newGoal, monthlyContribution: Number(e.target.value) })}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#3A3226]">
              <button onClick={() => setShowAddGoalModal(false)} className="px-4 py-2 text-xs text-[#A79A8A]">
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
                className="px-4 py-2 bg-[#8D7A62] text-white text-xs font-bold rounded-xl"
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

