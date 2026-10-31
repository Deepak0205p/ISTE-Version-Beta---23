import React, { useState } from 'react';
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

  const gridStroke = isDarkMode ? '#334155' : '#E2E8F0';
  const axisStroke = isDarkMode ? '#94A3B8' : '#64748B';
  const tooltipBg = isDarkMode ? '#1E293B' : '#FFFFFF';
  const tooltipBorder = isDarkMode ? '#3B82F6' : '#E2E8F0';
  const tooltipColor = isDarkMode ? '#F8FAFC' : '#0F172A';

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

  // Calibrated semantic palette for Financial Expense Categories
  // Each color visually conveys the meaning of the category:
  // - Rent/Housing & Loan/EMI: Deep Amber/Orange (Major fixed commitments)
  // - Medical & Health: Rose/Red (Critical necessity)
  // - Grocery & Food: Emerald Green (Vital daily sustenance)
  // - Utilities & Fuel: Cyan/Blue (Essential infrastructure)
  // - Education: Indigo (Academic growth)
  // - Shopping & Entertainment: Purple/Violet (Discretionary lifestyle)
  // - Investment Transfer: Vibrant Teal (Wealth creation)
  // - Subscriptions: Sky Blue
  // - Miscellaneous: Slate
  const CATEGORY_COLOR_MAP: Record<string, string> = {
    'Rent & Housing': '#EA580C',        // Deep Orange (Housing commitment)
    'Loan Repayments / EMI': '#DC2626', // Red/Crimson (Debt obligation)
    'Medical & Health': '#E11D48',      // Rose/Red (Emergency & Care)
    'Grocery & Food': '#16A579',        // Emerald Green (Food & Nutrition)
    'Household': '#D97706',             // Warm Amber (Home supplies)
    'Electricity & Utilities': '#0284C7',// Sky Blue (Essential utility)
    'Transportation & Fuel': '#0D9488', // Teal (Transit & Mobility)
    'Education': '#4F46E5',             // Indigo (Knowledge & Future)
    'Insurance': '#059669',             // Sea Green (Protection & Safety)
    'Subscriptions': '#7C3AED',         // Purple (Recurring entertainment)
    'Shopping': '#9333EA',              // Vibrant Violet (Discretionary goods)
    'Entertainment': '#C026D3',         // Fuchsia (Leisure & Dining)
    'Investment Transfer': '#10B981',   // Mint/Emerald (Wealth building)
    'Miscellaneous': '#64748B',         // Slate (Other)
  };

  const getCategoryColor = (catName: string, index: number) => {
    return CATEGORY_COLOR_MAP[catName] || ['#3B82F6', '#7C3AED', '#EA580C', '#16A579', '#DC2626', '#0284C7'][index % 6];
  };

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

  const trendData = Array.from(monthlyFlows.entries())
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
        savings: val.income - val.expenses,
      };
    });

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
          <div className="bg-[#1E293B] border-2 border-[#3B82F6] rounded-3xl w-full max-w-5xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#3B82F6]/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#334155]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#3B82F6]/20 text-[#3B82F6]">
                  <PieIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Dynamic 3X Expense Distribution Inspector
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] font-semibold">
                      Interactive 3D Glow
                    </span>
                  </h3>
                  <p className="text-xs text-black dark:text-[#94A3B8]">
                    Hover over any slice to activate fluid arc dilation, category inspection and itemized family attribution.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChartMaximized(false)}
                className="p-2 rounded-xl bg-[#273549] hover:bg-[#334155] text-black dark:text-[#94A3B8] hover:text-white transition cursor-pointer"
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
                      {categoryChartData.map((cat, index) => (
                        <Cell
                          key={`cell-max-${index}`}
                          fill={getCategoryColor(cat.name, index)}
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
                  <span className="text-xs text-black dark:text-[#94A3B8] uppercase font-bold tracking-widest block">
                    {activePieIndex !== null ? categoryChartData[activePieIndex]?.name : 'Total Outflow'}
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-tabular block mt-0.5">
                    {activePieIndex !== null 
                      ? formatINR(categoryChartData[activePieIndex]?.value || 0)
                      : formatINR(metrics.monthlyExpenses)}
                  </span>
                  <span className="text-[11px] text-[#3B82F6] font-semibold mt-1 block">
                    {activePieIndex !== null 
                      ? `${(((categoryChartData[activePieIndex]?.value || 0) / metrics.monthlyExpenses) * 100).toFixed(1)}% of total burn`
                      : 'All 13 Active Categories'}
                  </span>
                </div>
              </div>

              {/* Right Side: Interactive Breakdown Grid */}
              <div className="lg:col-span-5 space-y-3 max-h-[420px] overflow-y-auto pr-2">
                <div className="text-xs text-black dark:text-[#94A3B8] font-semibold flex items-center justify-between pb-2 border-b border-[#334155]">
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
                          ? 'bg-[#273549] border-[#3B82F6] shadow-lg shadow-[#3B82F6]/10 translate-x-1'
                          : 'bg-[#273549]/40 border-[#334155] hover:bg-[#273549]/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: getCategoryColor(item.name, idx) }}
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{item.name}</p>
                          <span className="text-[10px] text-black dark:text-[#94A3B8]">{pct}% of Monthly Living</span>
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
            <div className="pt-3 border-t border-[#334155] flex items-center justify-between text-xs text-black dark:text-[#94A3B8]">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Sparkles size={14} /> Fluid 3X dilation active • Real-time backend synchronised
              </span>
              <button
                onClick={() => setIsChartMaximized(false)}
                className="px-4 py-1.5 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-lg transition"
              >
                Close Full Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Title */}
      <div className="pt-2 pb-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-tabular">
          Financial Dashboard
        </h1>
      </div>

      {/* Primary Financial Position Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Worth */}
        <div className="card-z bg-[#1E293B] border border-[#334155] p-5 rounded-2xl relative overflow-hidden group hover:border-[#3B82F6]/50 transition-all">
          <div className="flex items-center justify-between text-xs text-black dark:text-[#94A3B8] font-medium mb-2">
            <span>Consolidated Net Worth</span>
            <div className="p-2 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6]">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-tabular tracking-tight">
            {formatINR(metrics.netWorth)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-black dark:text-[#94A3B8] font-medium">
            <span>Assets: {formatCompactINR(metrics.totalSavingsBalance + metrics.totalInvestmentValuation)} • Debt: {formatCompactINR(metrics.totalLoanPrincipal)}</span>
          </div>
        </div>

        {/* Monthly Inflow */}
        <div className="card-z bg-[#1E293B] border border-[#334155] p-5 rounded-2xl relative overflow-hidden group hover:border-[#16A579]/50 transition-all">
          <div className="flex items-center justify-between text-xs text-black dark:text-[#94A3B8] font-medium mb-2">
            <span>Verified Inflow</span>
            <div className="p-2 rounded-lg bg-[#16A579]/10 text-[#16A579]">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-tabular tracking-tight">
            {formatINR(metrics.monthlyIncome)}
          </div>
          <p className="text-[11px] text-black dark:text-[#94A3B8] mt-2">
            {transactions.filter(t => t.type === 'CREDIT' && !t.isInternalTransfer).length} Verified Inflow Credit(s)
          </p>
        </div>

        {/* Monthly Outflow / Expenses */}
        <div className="card-z bg-[#1E293B] border border-[#334155] p-5 rounded-2xl relative overflow-hidden group hover:border-[#D95C52]/50 transition-all">
          <div className="flex items-center justify-between text-xs text-black dark:text-[#94A3B8] font-medium mb-2">
            <span>Actual Living Outflow</span>
            <div className="p-2 rounded-lg bg-[#D95C52]/10 text-[#D95C52]">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-tabular tracking-tight">
            {formatINR(metrics.monthlyExpenses)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-[#16A579] font-medium">
              Savings Rate: {metrics.savingsRatePercentage}%
            </span>
          </div>
        </div>

        {/* Liquid Savings & Cash */}
        <div className="card-z bg-[#1E293B] border border-[#334155] p-5 rounded-2xl relative overflow-hidden group hover:border-[#4F7CAC]/50 transition-all">
          <div className="flex items-center justify-between text-xs text-black dark:text-[#94A3B8] font-medium mb-2">
            <span>Liquid Bank Balances</span>
            <div className="p-2 rounded-lg bg-[#4F7CAC]/10 text-[#4F7CAC]">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-tabular tracking-tight">
            {formatINR(metrics.totalSavingsBalance)}
          </div>
          <p className="text-[11px] text-black dark:text-[#94A3B8] mt-2">
            Across {bankAccounts.length} Connected Accounts
          </p>
        </div>
      </div>

      {/* Middle Grid: Cash Flow Trend & Dynamic Click-to-Maximize Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 5-Month Inflow vs Outflow */}
        <div className="card-z lg:col-span-2 bg-[#1E293B] border border-[#334155] p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Monthly Cash Flow Trend</h2>
              <p className="text-xs text-black dark:text-[#94A3B8]">Income, Actual Expenses & Net Savings Reserve</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> Income (Inflow)
              </div>
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" /> Expenses (Outflow)
              </div>
            </div>
          </div>

          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#DC2626" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="month" stroke={axisStroke} fontSize={12} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={11} tickFormatter={val => formatCompactINR(val)} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: tooltipBg, borderColor: isDarkMode ? '#334155' : '#E2E8F0', borderRadius: '12px', color: tooltipColor, boxShadow: '0 10px 25px -5px rgba(53, 41, 28, 0.12)' }}
                  formatter={(val: any) => [formatINR(Number(val)), '']}
                />
                <Bar dataKey="income" name="Income (Inflow)" fill="url(#inflowGrad)" radius={[8, 8, 2, 2]} maxBarSize={36} />
                <Bar dataKey="expenses" name="Expenses (Outflow)" fill="url(#outflowGrad)" radius={[8, 8, 2, 2]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Expense Distribution with Click-to-Maximize (3X) Action */}
        <div className="card-z bg-[#1E293B] border border-[#334155] p-5 rounded-2xl flex flex-col group relative transition-all duration-300 hover:border-[#3B82F6]/60">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-white">Expense Distribution</h2>
            <button
              onClick={() => setIsChartMaximized(true)}
              className="p-1.5 rounded-lg bg-[#273549] hover:bg-[#3B82F6] text-black dark:text-[#94A3B8] hover:text-white transition-all duration-200 cursor-pointer flex items-center gap-1 text-[11px]"
              title="Click to maximize chart to 3X"
            >
              <Maximize2 size={13} />
              <span className="font-semibold">Expand</span>
            </button>
          </div>
          <p className="text-xs text-black dark:text-[#94A3B8] mb-3">Click anywhere on chart to inspect details</p>

          {/* Interactive Clickable Donut Area */}
          <div
            onClick={() => setIsChartMaximized(true)}
            className="h-48 w-full min-w-0 relative flex items-center justify-center cursor-pointer group-hover:scale-105 transition-transform duration-300"
          >
            <ResponsiveContainer width="100%" height={192} minWidth={0}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={600}
                >
                  {categoryChartData.map((cat, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getCategoryColor(cat.name, index)}
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: tooltipBg, borderColor: isDarkMode ? '#334155' : '#E2E8F0', borderRadius: '10px', color: tooltipColor }}
                  formatter={(val: any) => [formatINR(Number(val)), 'Amount']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center pointer-events-none">
              <span className="text-[10px] text-black dark:text-[#94A3B8] uppercase block">Total</span>
              <span className="text-sm font-bold text-white font-tabular">{formatCompactINR(metrics.monthlyExpenses)}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mt-2 max-h-36 pr-1">
            {categoryChartData.map((cat, i) => (
              <div
                key={cat.name}
                onClick={() => {
                  setActivePieIndex(i);
                  setIsChartMaximized(true);
                }}
                className="flex items-center justify-between text-xs py-1 px-1 rounded-md hover:bg-[#273549] cursor-pointer border-b border-[#334155]/40 transition"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(cat.name, i) }} />
                  <span className="text-black dark:text-[#94A3B8] font-medium truncate">{cat.name}</span>
                </div>
                <span className="font-semibold text-white font-tabular">{formatINR(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Active Goals & Upcoming Obligations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Financial Goals */}
        <div className="card-z bg-[#1E293B] border border-[#334155] p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-[#3B82F6]" />
              <h2 className="text-base font-semibold text-white">Financial Goals</h2>
            </div>
            <button
              onClick={() => setCurrentTab('goals-investments')}
              className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-4">
            {goals.length === 0 ? (
              <div className="p-6 text-center text-xs text-black dark:text-[#94A3B8] bg-[#273549]/40 rounded-xl border border-[#334155]">
                No financial goals set yet. Set a goal in Goals & Investments to track milestone progress.
              </div>
            ) : (
              goals.slice(0, 3).map(goal => {
                const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                return (
                  <div key={goal.id} className="p-3.5 bg-[#273549]/60 rounded-xl border border-[#334155] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{goal.title}</span>
                      <span className="text-[#3B82F6] font-bold font-tabular">{pct}%</span>
                    </div>
                    <div className="w-full bg-[#0F172A] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-black dark:text-[#94A3B8]">
                      <span>Accumulated: {formatINR(goal.currentAmount)}</span>
                      <span>Target: {formatINR(goal.targetAmount)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Scheduled Obligations & EMIs */}
        <div className="card-z bg-[#1E293B] border border-[#334155] p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-[#7C3AED]" />
              <h2 className="text-base font-semibold text-white">Monthly Obligations & EMIs</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
              Total: {formatINR(metrics.monthlyEmiCommitments)}/mo
            </span>
          </div>

          <div className="space-y-3">
            {loans.length === 0 ? (
              <div className="p-6 text-center text-xs text-black dark:text-[#94A3B8] bg-[#273549]/40 rounded-xl border border-[#334155]">
                No monthly loans or EMIs recorded.
              </div>
            ) : (
              loans.map(loan => (
                <div key={loan.id} className="p-3.5 bg-[#273549]/60 rounded-xl border border-[#334155] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">{loan.name}</h4>
                    <p className="text-[11px] text-black dark:text-[#94A3B8]">{loan.lender} • Due on {loan.emiDueDate}th of month</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white font-tabular">{formatINR(loan.emiAmount)}</span>
                    <span className="block text-[10px] text-amber-400 font-medium">
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
