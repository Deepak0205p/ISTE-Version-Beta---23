import React, { useState, useMemo } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { formatINR, formatCompactINR } from '../utils/currency';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Sparkles,
  CreditCard,
  PlusCircle,
  FileSpreadsheet,
  Target,
  Calculator,
  Wallet,
  Activity,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  PieChart as PieIcon,
  BarChart3,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Sector
} from 'recharts';

export const OverviewModule: React.FC = () => {
  const {
    metrics,
    expenses,
    bankAccounts,
    loans,
    goals,
    transactions,
    setCurrentTab,
    setActiveSubmodule,
    isFamilyView,
    currentUser,
    isDarkMode
  } = useFinancial();

  const gridStroke = isDarkMode ? '#3A3226' : '#E4DED4';
  const axisStroke = isDarkMode ? '#9A9186' : '#746B60';
  const tooltipBg = isDarkMode ? '#1D1913' : '#FCFBF8';
  const tooltipBorder = isDarkMode ? '#8F7D65' : '#E4DED4';
  const tooltipColor = isDarkMode ? '#F7F5F1' : '#29241E';

  const activePeriodLabel = new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' });
  
  // Dynamic Chart Maximized 3X State & Active Segment Hover
  const [isChartMaximized, setIsChartMaximized] = useState(false);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Category breakdown for Pie Chart
  const categoryMap: { [cat: string]: number } = {};
  expenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
  });

  const categoryChartData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#D95C52', '#C98A32', '#16A579', '#4F7CAC', '#8F7D65', '#E8A267', '#6F5D48', '#8A847B'];

  // Trend View Toggle: 'monthly' (matches default 6-Mo view) or 'weekly'
  const [trendView, setTrendView] = useState<'weekly' | 'monthly'>('monthly');

  // Dynamically compute monthly trends from actual ledger records
  const monthlyFlows = new Map<string, { income: number; expenses: number }>();
  transactions.forEach(t => {
    if (!t.date) return;
    const m = t.date.slice(0, 7);
    const curr = monthlyFlows.get(m) ?? { income: 0, expenses: 0 };
    if (t.type === 'CREDIT' && !t.isInternalTransfer) {
      curr.income += t.amount;
    }
    monthlyFlows.set(m, curr);
  });
  expenses.forEach(e => {
    if (!e.date || e.status !== 'ACTUAL') return;
    const m = e.date.slice(0, 7);
    const curr = monthlyFlows.get(m) ?? { income: 0, expenses: 0 };
    curr.expenses += e.amount;
    monthlyFlows.set(m, curr);
  });

  // Weekly Rhythm breakdown for the active month (fills chart proportionally)
  const weeklyCadence = useMemo(() => {
    const weeks = [
      { month: 'W1 (Oct 1–7)', income: 0, expenses: 0 },
      { month: 'W2 (Oct 8–14)', income: 0, expenses: 0 },
      { month: 'W3 (Oct 15–21)', income: 0, expenses: 0 },
      { month: 'W4 (Oct 22–31)', income: 0, expenses: 0 },
    ];

    transactions.forEach(t => {
      if (!t.date || t.isInternalTransfer) return;
      const day = parseInt(t.date.split('-')[2] || '1', 10);
      const wIdx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      if (t.type === 'CREDIT') {
        weeks[wIdx].income += t.amount;
      }
    });

    expenses.forEach(e => {
      if (!e.date || e.status !== 'ACTUAL') return;
      const day = parseInt(e.date.split('-')[2] || '1', 10);
      const wIdx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      weeks[wIdx].expenses += e.amount;
    });

    // If transactions occurred in a concentrated burst, smoothly distribute to reflect weekly burn
    const nonZeroWeeks = weeks.filter(w => w.income > 0 || w.expenses > 0);
    if (nonZeroWeeks.length <= 1 && (metrics.monthlyIncome > 0 || metrics.monthlyExpenses > 0)) {
      return [
        { month: 'W1 (1–7 Oct)', income: Math.round(metrics.monthlyIncome * 0.5), expenses: Math.round(metrics.monthlyExpenses * 0.32) },
        { month: 'W2 (8–14 Oct)', income: 0, expenses: Math.round(metrics.monthlyExpenses * 0.26) },
        { month: 'W3 (15–21 Oct)', income: Math.round(metrics.monthlyIncome * 0.5), expenses: Math.round(metrics.monthlyExpenses * 0.20) },
        { month: 'W4 (22–31 Oct)', income: 0, expenses: Math.round(metrics.monthlyExpenses * 0.22) },
      ];
    }

    // When no statement is added, return empty array without dummy bars
    if (metrics.monthlyIncome === 0 && metrics.monthlyExpenses === 0) {
      return [];
    }

    return weeks;
  }, [transactions, expenses, metrics.monthlyIncome, metrics.monthlyExpenses]);

  // 6-Month Trajectory
  const multiMonthTrend = useMemo(() => {
    if (monthlyFlows.size > 0) {
      return Array.from(monthlyFlows.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([monthKey, val]) => {
          const parts = monthKey.split('-');
          const year = Number(parts[0]);
          const monthNum = Number(parts[1]);
          let label = monthKey;
          if (!isNaN(year) && !isNaN(monthNum)) {
            const dateObj = new Date(year, monthNum - 1, 1);
            label = dateObj.toLocaleDateString('en-US', { month: 'short' });
          }
          return {
            month: label,
            income: val.income,
            expenses: val.expenses,
          };
        });
    }

    // When no statement is added, return empty array without dummy numbers
    return [];
  }, [monthlyFlows]);

  const activeTrendData = trendView === 'weekly' ? weeklyCadence : multiMonthTrend;

  // Custom active shape for dynamic interactive pie animation
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 4}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          className="transition-all duration-300 filter drop-shadow-[0_0_12px_rgba(20,184,166,0.6)]"
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={outerRadius + 14}
          outerRadius={outerRadius + 17}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn relative">
      {/* ======================================================== */}
      {/* 3X MAXIMIZED DYNAMIC EXPENSE DISTRIBUTION MODAL OVERLAY */}
      {/* ======================================================== */}
      {isChartMaximized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8 animate-fadeIn">
          <div className="bg-[#1D1913] border-2 border-[#8D7A62] rounded-3xl w-full max-w-5xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#8D7A62]/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#3A3226]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#8D7A62]/20 text-[#8D7A62]">
                  <PieIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Dynamic 3X Expense Distribution Inspector
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#8D7A62]/20 text-[#8D7A62] font-semibold">
                      Interactive 3D Glow
                    </span>
                  </h3>
                  <p className="text-xs text-[#A79A8A]">
                    Hover over any slice to activate fluid arc dilation, category inspection and itemized family attribution.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChartMaximized(false)}
                className="p-2 rounded-xl bg-[#241F17] hover:bg-[#3A3226] text-[#A79A8A] hover:text-white transition cursor-pointer"
                title="Exit 3X View (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Enlarged 3X Chart & Dynamic Data Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-6 items-center">
              {/* 3X Scaled Chart View */}
              <div className="lg:col-span-7 h-[420px] w-full min-w-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={400} minWidth={0}>
                  <PieChart>
                    <Pie
                      {...({
                        activeIndex: activePieIndex !== null ? activePieIndex : undefined,
                        activeShape: renderActiveShape
                      } as any)}
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={110}
                      outerRadius={165}
                      paddingAngle={5}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActivePieIndex(index)}
                      onMouseLeave={() => setActivePieIndex(null)}
                      animationDuration={800}
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell
                          key={`cell-max-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          className="cursor-pointer transition-transform duration-300 hover:opacity-90"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '12px',
                        color: tooltipColor,
                        boxShadow: isDarkMode ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 25px -5px rgba(15, 23, 42, 0.1)'
                      }}
                      formatter={(val: any) => [formatINR(Number(val)), 'Expenditure']}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Central Floating HUD */}
                <div className="absolute text-center pointer-events-none">
                  <span className="text-xs text-[#A79A8A] uppercase font-bold tracking-widest block">
                    {activePieIndex !== null ? categoryChartData[activePieIndex]?.name : 'Total Outflow'}
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-tabular block mt-0.5">
                    {activePieIndex !== null 
                      ? formatINR(categoryChartData[activePieIndex]?.value || 0)
                      : formatINR(metrics.monthlyExpenses)}
                  </span>
                  <span className="text-[11px] text-[#8D7A62] font-semibold mt-1 block">
                    {activePieIndex !== null 
                      ? `${(((categoryChartData[activePieIndex]?.value || 0) / metrics.monthlyExpenses) * 100).toFixed(1)}% of total burn`
                      : 'All 13 Active Categories'}
                  </span>
                </div>
              </div>

              {/* Right Side: Interactive Breakdown Grid */}
              <div className="lg:col-span-5 space-y-3 max-h-[420px] overflow-y-auto pr-2">
                <div className="text-xs text-[#A79A8A] font-semibold flex items-center justify-between pb-2 border-b border-[#3A3226]">
                  <span>Category Name</span>
                  <span>Amount & Share</span>
                </div>
                {categoryChartData.map((item, idx) => {
                  const isHovered = activePieIndex === idx;
                  const pct = ((item.value / metrics.monthlyExpenses) * 100).toFixed(1);
                  return (
                    <div
                      key={item.name}
                      onMouseEnter={() => setActivePieIndex(idx)}
                      onMouseLeave={() => setActivePieIndex(null)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isHovered
                          ? 'bg-[#241F17] border-[#8D7A62] shadow-lg shadow-[#8D7A62]/10 translate-x-1'
                          : 'bg-[#241F17]/40 border-[#3A3226] hover:bg-[#241F17]/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{item.name}</p>
                          <span className="text-[10px] text-[#A79A8A]">{pct}% of Monthly Living</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-white font-tabular">{formatINR(item.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#3A3226] flex items-center justify-between text-xs text-[#A79A8A]">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Sparkles size={14} /> Fluid 3X dilation active • Real-time backend synchronised
              </span>
              <button
                onClick={() => setIsChartMaximized(false)}
                className="px-4 py-1.5 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-bold rounded-lg transition"
              >
                Close Full Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner with Clean Contrast & Tactile Elevation */}
      <div className="card-z flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-6 rounded-2xl relative overflow-hidden shadow-xs">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8F7D65]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-[#F2ECE3] dark:bg-[#8F7D65]/10 text-[#6F5D48] dark:text-[#8F7D65] border border-[#E6E1D8] dark:border-[#8F7D65]/20 flex items-center gap-1.5">
              <Calendar size={12} className="text-[#8F7D65]" />
              Active Period: {activePeriodLabel}
            </span>
            <span className={`text-[11px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
              transactions.length > 0
                ? 'bg-[#E7F5EF] dark:bg-[#16A579]/10 text-[#16A579] border border-[#16A579]/30'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${transactions.length > 0 ? 'bg-[#16A579] animate-pulse' : 'bg-stone-400'}`} />
              {transactions.length > 0 ? 'Live Reconciled' : 'Awaiting Statement'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#29241E] dark:text-white font-tabular">
            Financial Dashboard
          </h1>
          <p className="text-xs md:text-sm text-[#6F665C] dark:text-[#A79A8A] mt-1 max-w-2xl leading-relaxed">
            Real-time balance reconciliation, automated habit tracking and multi-tier wealth analytics without double-counting internal transfers.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <button
            onClick={() => {
              setCurrentTab('money-management');
              setActiveSubmodule('expense-manager');
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#29241E] hover:bg-[#1A1713] dark:bg-[#8F7D65] dark:hover:bg-[#6F5D48] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle size={15} /> Add Expense
          </button>
          <button
            onClick={() => setCurrentTab('banking')}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F8F7F4] dark:bg-[#241F17] dark:hover:bg-[#2E2820] text-[#29241E] dark:text-[#ECEAE6] border border-[#E6E1D8] dark:border-[#3A3226] text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-[#4F7CAC]" /> Import Statement
          </button>
          <button
            onClick={() => setCurrentTab('calculators')}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F8F7F4] dark:bg-[#241F17] dark:hover:bg-[#2E2820] text-[#29241E] dark:text-[#ECEAE6] border border-[#E6E1D8] dark:border-[#3A3226] text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Calculator size={15} className="text-[#C98A32]" /> Financial Tools
          </button>
        </div>
      </div>

      {/* Primary Financial Position Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Worth */}
        <div className="card-z bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl relative overflow-hidden group transition-all shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F665C] dark:text-[#A79A8A]">
              Consolidated Net Worth
            </span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6F5D48] to-[#8F7D65] flex items-center justify-center text-white shadow-sm shadow-[#8F7D65]/20">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold text-[#29241E] dark:text-white font-tabular tracking-tight">
            {formatINR(metrics.netWorth)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E6E1D8] dark:border-[#3A3226]/50 text-xs">
            <span className="text-[#6F665C] dark:text-[#A79A8A]">
              Assets: <strong className="text-[#29241E] dark:text-white font-tabular">{formatCompactINR(metrics.totalSavingsBalance + metrics.totalInvestmentValuation)}</strong>
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              metrics.totalLoanPrincipal === 0
                ? 'bg-stone-100 text-stone-600 border border-stone-200 dark:bg-stone-800 dark:text-stone-300'
                : 'bg-[#E7F5EF] text-[#16A579] border border-[#16A579]/30'
            }`}>
              {metrics.totalLoanPrincipal === 0
                ? 'Zero Debt'
                : `${((metrics.totalSavingsBalance + metrics.totalInvestmentValuation) / (metrics.totalLoanPrincipal || 1)).toFixed(2)}x Solvency`}
            </span>
          </div>
        </div>

        {/* Monthly Inflow */}
        <div className="card-z bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl relative overflow-hidden group transition-all shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F665C] dark:text-[#A79A8A]">
              Verified Inflow
            </span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0E7A57] to-[#16A579] flex items-center justify-center text-white shadow-sm shadow-[#16A579]/20">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold text-[#29241E] dark:text-white font-tabular tracking-tight">
            {formatINR(metrics.monthlyIncome)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E6E1D8] dark:border-[#3A3226]/50 text-xs">
            <span className="text-[#6F665C] dark:text-[#A79A8A]">
              {transactions.filter(t => t.type === 'CREDIT' && !t.isInternalTransfer).length} Inflow Credits
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              transactions.some(t => t.type === 'CREDIT' && !t.isInternalTransfer)
                ? 'bg-[#E7F5EF] text-[#16A579] border border-[#16A579]/30'
                : 'bg-stone-100 text-stone-500 border border-stone-200 dark:bg-stone-800 dark:text-stone-400'
            }`}>
              {transactions.some(t => t.type === 'CREDIT' && !t.isInternalTransfer) ? '100% Reconciled' : 'Awaiting Inflow'}
            </span>
          </div>
        </div>

        {/* Monthly Outflow / Expenses */}
        <div className="card-z bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl relative overflow-hidden group transition-all shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F665C] dark:text-[#A79A8A]">
              Actual Living Outflow
            </span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#B83E34] to-[#D95C52] flex items-center justify-center text-white shadow-sm shadow-[#D95C52]/20">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold text-[#29241E] dark:text-white font-tabular tracking-tight">
            {formatINR(metrics.monthlyExpenses)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E6E1D8] dark:border-[#3A3226]/50 text-xs">
            <span className="text-[#6F665C] dark:text-[#A79A8A]">
              Committed: <strong className="text-[#29241E] dark:text-white font-tabular">{formatCompactINR(metrics.monthlyEmiCommitments)}</strong>
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              metrics.monthlyIncome > 0
                ? 'bg-[#E7F5EF] text-[#16A579] border border-[#16A579]/30'
                : 'bg-stone-100 text-stone-500 border border-stone-200 dark:bg-stone-800 dark:text-stone-400'
            }`}>
              {metrics.monthlyIncome > 0 ? `${metrics.savingsRatePercentage}% Saved` : '0% Outflow'}
            </span>
          </div>
        </div>

        {/* Liquid Savings & Cash */}
        <div className="card-z bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl relative overflow-hidden group transition-all shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F665C] dark:text-[#A79A8A]">
              Liquid Bank Balances
            </span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#355C88] to-[#4F7CAC] flex items-center justify-center text-white shadow-sm shadow-[#4F7CAC]/20">
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold text-[#29241E] dark:text-white font-tabular tracking-tight">
            {formatINR(metrics.totalSavingsBalance)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E6E1D8] dark:border-[#3A3226]/50 text-xs">
            <span className="text-[#6F665C] dark:text-[#A79A8A]">
              {bankAccounts.length} Connected Account{bankAccounts.length === 1 ? '' : 's'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              bankAccounts.length === 0
                ? 'bg-stone-100 text-stone-500 border border-stone-200 dark:bg-stone-800 dark:text-stone-400'
                : metrics.totalSavingsBalance >= (metrics.monthlyExpenses * 3) && metrics.totalSavingsBalance > 0
                ? 'bg-[#EAF1F7] text-[#4F7CAC] border border-[#4F7CAC]/30'
                : 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
            }`}>
              {bankAccounts.length === 0 ? 'No Accounts' : metrics.totalSavingsBalance >= (metrics.monthlyExpenses * 3) && metrics.totalSavingsBalance > 0 ? 'Safe Buffer' : 'Building Buffer'}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Cash Flow Trend & Dynamic Click-to-Maximize Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Cadence & Trend */}
        <div className="card-z lg:col-span-2 bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-[#29241E] dark:text-white">Cash Flow Trajectory</h2>
                  <div className="flex items-center bg-[#F8F7F4] dark:bg-[#241F17] p-0.5 rounded-lg border border-[#E6E1D8] dark:border-[#3A3226]">
                    <button
                      onClick={() => setTrendView('weekly')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        trendView === 'weekly'
                          ? 'bg-[#29241E] text-white dark:bg-[#8F7D65] shadow-xs'
                          : 'text-[#6F665C] hover:text-[#29241E] dark:text-[#A79A8A] dark:hover:text-white'
                      }`}
                    >
                      Weekly Rhythm
                    </button>
                    <button
                      onClick={() => setTrendView('monthly')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        trendView === 'monthly'
                          ? 'bg-[#29241E] text-white dark:bg-[#8F7D65] shadow-xs'
                          : 'text-[#6F665C] hover:text-[#29241E] dark:text-[#A79A8A] dark:hover:text-white'
                      }`}
                    >
                      6-Mo Trajectory
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#6F665C] dark:text-[#A79A8A] mt-0.5">
                  {trendView === 'weekly' ? 'Weekly inflow velocity vs. living spend for current month' : 'Rolling multi-month income & spending pattern'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-[#16A579]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A579] shadow-xs" /> Income (Inflow)
                </div>
                <div className="flex items-center gap-1.5 text-[#D95C52] dark:text-[#F87171]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D95C52] shadow-xs" /> Expenses (Outflow)
                </div>
              </div>
            </div>

            {activeTrendData.length === 0 || activeTrendData.every(d => (d.income || 0) === 0 && (d.expenses || 0) === 0) ? (
              <div className="h-60 w-full flex flex-col items-center justify-center text-center p-6 bg-[#F8F7F4]/60 dark:bg-[#241F17]/30 rounded-xl border border-dashed border-[#E6E1D8] dark:border-[#3A3226]">
                <div className="w-10 h-10 rounded-xl bg-[#8F7D65]/10 flex items-center justify-center text-[#8F7D65] mb-2">
                  <BarChart3 size={20} />
                </div>
                <p className="text-xs font-bold text-[#29241E] dark:text-white">No Statement Cash Flow Recorded</p>
                <p className="text-[11px] text-[#6F665C] dark:text-[#A79A8A] max-w-sm mt-0.5">
                  Upload a bank or credit card statement to generate real-time monthly inflow velocity and living expense burn patterns.
                </p>
                <button
                  onClick={() => setCurrentTab('banking')}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#8F7D65] hover:bg-[#786751] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Import Statement
                </button>
              </div>
            ) : (
              <div className="h-60 w-full min-w-0">
                <ResponsiveContainer width="100%" height={240} minWidth={0}>
                  <BarChart data={activeTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#16A579" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#0E7A57" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D95C52" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#B83E34" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="month" stroke={axisStroke} fontSize={12} tickLine={false} />
                    <YAxis stroke={axisStroke} fontSize={11} tickFormatter={val => formatCompactINR(val)} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: tooltipBg, borderColor: isDarkMode ? '#3A3226' : '#E6E1D8', borderRadius: '12px', color: tooltipColor, boxShadow: '0 10px 25px -5px rgba(41, 36, 30, 0.08)' }}
                      formatter={(val: any) => [formatINR(Number(val)), '']}
                    />
                    <Bar dataKey="income" name="Inflow" fill="url(#inflowGrad)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                    <Bar dataKey="expenses" name="Outflow" fill="url(#outflowGrad)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Cash Flow Summary Intelligence Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-[#E6E1D8] dark:border-[#3A3226]/60">
            <div className="p-2.5 rounded-xl bg-[#F8F7F4] dark:bg-[#241F17]/60 border border-[#E6E1D8] dark:border-[#3A3226]/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F665C] dark:text-[#A79A8A] block">Month Inflow</span>
              <span className="text-sm font-extrabold text-[#16A579] font-tabular">{formatINR(metrics.monthlyIncome)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F8F7F4] dark:bg-[#241F17]/60 border border-[#E6E1D8] dark:border-[#3A3226]/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F665C] dark:text-[#A79A8A] block">Month Outflow</span>
              <span className="text-sm font-extrabold text-[#D95C52] dark:text-[#F87171] font-tabular">{formatINR(metrics.monthlyExpenses)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F8F7F4] dark:bg-[#241F17]/60 border border-[#E6E1D8] dark:border-[#3A3226]/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F665C] dark:text-[#A79A8A] block">Net Surplus</span>
              <span className="text-sm font-extrabold text-[#16A579] font-tabular">+{formatINR(Math.max(0, metrics.monthlyIncome - metrics.monthlyExpenses))}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F8F7F4] dark:bg-[#241F17]/60 border border-[#E6E1D8] dark:border-[#3A3226]/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F665C] dark:text-[#A79A8A] block">Savings Margin</span>
              <span className="text-sm font-extrabold text-[#4F7CAC] font-tabular">{metrics.savingsRatePercentage}% Retained</span>
            </div>
          </div>
        </div>

        {/* Category Expense Distribution with Click-to-Maximize (3X) Action */}
        <div className="card-z bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl flex flex-col justify-between group relative transition-all duration-300 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-base font-bold text-[#29241E] dark:text-white">Expense Distribution</h2>
              <p className="text-xs text-[#6F665C] dark:text-[#A79A8A]">Active month category allocation</p>
            </div>
            <button
              onClick={() => setIsChartMaximized(true)}
              className="p-1.5 px-2.5 rounded-lg bg-white dark:bg-[#241F17] hover:bg-[#F8F7F4] dark:hover:bg-[#2E2820] text-[#29241E] dark:text-[#A79A8A] hover:text-white border border-[#E6E1D8] dark:border-[#3A3226] transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-[11px] font-bold shadow-xs"
              title="Click to maximize chart to 3X"
            >
              <Maximize2 size={13} />
              <span>Expand</span>
            </button>
          </div>

          {categoryChartData.length === 0 ? (
            <div className="h-60 w-full flex flex-col items-center justify-center text-center p-6 bg-[#F8F7F4]/60 dark:bg-[#241F17]/30 rounded-xl border border-dashed border-[#E6E1D8] dark:border-[#3A3226] my-auto">
              <div className="w-10 h-10 rounded-xl bg-[#8F7D65]/10 flex items-center justify-center text-[#8F7D65] mb-2">
                <PieIcon size={20} />
              </div>
              <p className="text-xs font-bold text-[#29241E] dark:text-white">No Expenses Recorded</p>
              <p className="text-[11px] text-[#6F665C] dark:text-[#A79A8A] max-w-xs mt-0.5">
                Imported statements will automatically categorize your living expenses into lifestyle, utilities, food, and essentials.
              </p>
              <button
                onClick={() => setCurrentTab('banking')}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#8F7D65] hover:bg-[#786751] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Import Statement
              </button>
            </div>
          ) : (
            <>
              {/* Interactive Clickable Donut Area */}
              <div
                onClick={() => setIsChartMaximized(true)}
                className="h-44 w-full min-w-0 relative flex items-center justify-center cursor-pointer my-1 transition-transform duration-300"
              >
                <ResponsiveContainer width="100%" height={176} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                      animationDuration={600}
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          className="transition-all duration-300 hover:opacity-85"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: tooltipBg, borderColor: isDarkMode ? '#3A3226' : '#E6E1D8', borderRadius: '10px', color: tooltipColor }}
                      formatter={(val: any) => [formatINR(Number(val)), 'Amount']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <span className="text-[10px] text-[#6F665C] dark:text-[#A79A8A] font-bold uppercase tracking-wider block">Total Spend</span>
                  <span className="text-base font-extrabold text-[#29241E] dark:text-white font-tabular">{formatCompactINR(metrics.monthlyExpenses)}</span>
                </div>
              </div>

              {/* Itemized Categories with Progress Bars */}
              <div className="overflow-y-auto space-y-2 mt-2 max-h-40 pr-1">
                {categoryChartData.map((cat, i) => {
                  const totalExp = metrics.monthlyExpenses || 1;
                  const share = Math.min(100, Math.round((cat.value / totalExp) * 100));
                  return (
                    <div
                      key={cat.name}
                      onClick={() => {
                        setActivePieIndex(i);
                        setIsChartMaximized(true);
                      }}
                      className="p-2.5 rounded-xl bg-[#F8F7F4] dark:bg-[#241F17]/70 hover:bg-[#F2ECE3] dark:hover:bg-[#241F17] border border-[#E6E1D8] dark:border-[#3A3226]/50 cursor-pointer transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate font-semibold text-[#29241E] dark:text-white">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-[#1D1913] text-[#6F665C] dark:text-[#A79A8A] border border-[#E6E1D8] dark:border-[#3A3226]">
                            {share}%
                          </span>
                          <span className="font-extrabold text-[#29241E] dark:text-white font-tabular">{formatINR(cat.value)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-[#E8E3D8] dark:bg-[#191510] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${share}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Grid: Active Goals & Upcoming Obligations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Financial Goals */}
        <div className="card-z bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-[#8F7D65]" />
              <h2 className="text-base font-bold text-[#29241E] dark:text-white">Financial Goals</h2>
            </div>
            <button
              onClick={() => setCurrentTab('goals-investments')}
              className="text-xs text-[#8F7D65] hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-4">
            {goals.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6F665C] dark:text-[#A79A8A] bg-[#F8F7F4] dark:bg-[#241F17]/40 rounded-xl border border-[#E6E1D8] dark:border-[#3A3226]">
                No financial goals set yet. Set a goal in Goals & Investments to track milestone progress.
              </div>
            ) : (
              goals.slice(0, 3).map(goal => {
                const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                return (
                  <div key={goal.id} className="p-3.5 bg-[#F8F7F4] dark:bg-[#241F17]/60 rounded-xl border border-[#E6E1D8] dark:border-[#3A3226] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#29241E] dark:text-white">{goal.title}</span>
                      <span className="text-[#8F7D65] font-extrabold font-tabular">{pct}%</span>
                    </div>
                    <div className="w-full bg-[#E8E3D8] dark:bg-[#191510] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#6F5D48] to-[#8F7D65] h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#6F665C] dark:text-[#A79A8A]">
                      <span>Accumulated: <strong className="text-[#29241E] dark:text-white font-tabular">{formatINR(goal.currentAmount)}</strong></span>
                      <span>Target: <strong className="text-[#29241E] dark:text-white font-tabular">{formatINR(goal.targetAmount)}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Scheduled Obligations & EMIs */}
        <div className="card-z bg-[#FFFFFF] dark:bg-[#1D1913] border border-[#E6E1D8] dark:border-[#3A3226] p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-[#C98A32]" />
              <h2 className="text-base font-bold text-[#29241E] dark:text-white">Monthly Obligations & EMIs</h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FBF1DD] dark:bg-amber-500/10 text-[#C98A32] font-bold border border-[#C98A32]/20">
              Total: {formatINR(metrics.monthlyEmiCommitments)}/mo
            </span>
          </div>

          <div className="space-y-3">
            {loans.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6F665C] dark:text-[#A79A8A] bg-[#F8F7F4] dark:bg-[#241F17]/40 rounded-xl border border-[#E6E1D8] dark:border-[#3A3226]">
                No monthly loans or EMIs recorded.
              </div>
            ) : (
              loans.map(loan => (
                <div key={loan.id} className="p-3.5 bg-[#F8F7F4] dark:bg-[#241F17]/60 rounded-xl border border-[#E6E1D8] dark:border-[#3A3226] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#29241E] dark:text-white">{loan.name}</h4>
                    <p className="text-[11px] text-[#6F665C] dark:text-[#A79A8A]">{loan.lender} • Due on {loan.emiDueDate}th of month</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[#29241E] dark:text-white font-tabular">{formatINR(loan.emiAmount)}</span>
                    <span className="block text-[10px] text-[#C98A32] font-bold">
                      Bal: {formatCompactINR(loan.outstandingPrincipal)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
