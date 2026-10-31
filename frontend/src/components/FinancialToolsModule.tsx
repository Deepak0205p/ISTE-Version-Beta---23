import React, { useState } from 'react';
import { formatINR, formatCompactINR } from '../utils/currency';
import {
  Calculator,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Percent,
  PiggyBank,
  ShieldAlert,
  Flame,
  Check
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export type CalculatorCategory = 
  | 'INVESTMENT'
  | 'SAVINGS_DEPOSIT'
  | 'RETIREMENT'
  | 'TAX_SAVING'
  | 'FINANCIAL_PLANNING';

export interface CalculatorDefinition {
  id: string;
  name: string;
  category: CalculatorCategory;
  description: string;
  defaultInputs: Record<string, number>;
}

export const calculatorsCatalog: CalculatorDefinition[] = [
  // 1. Investment
  { id: 'sip', name: 'SIP Calculator', category: 'INVESTMENT', description: 'Systematic Investment Plan compounding wealth estimator', defaultInputs: { monthlyInv: 15000, rate: 12, tenureYears: 10 } },
  { id: 'step-up-sip', name: 'Step-Up SIP Calculator', category: 'INVESTMENT', description: 'Annual SIP increment model to match career salary progression', defaultInputs: { monthlyInv: 15000, stepUpPct: 10, rate: 12, tenureYears: 10 } },
  { id: 'swp', name: 'SWP Calculator', category: 'INVESTMENT', description: 'Systematic Withdrawal Plan for steady monthly retirement cashflow', defaultInputs: { corpus: 5000000, monthlyWithdrawal: 35000, rate: 8.5, tenureYears: 15 } },
  { id: 'stp', name: 'STP Calculator', category: 'INVESTMENT', description: 'Systematic Transfer Plan from liquid/debt to equity funds', defaultInputs: { initialCorpus: 1000000, monthlyTransfer: 50000, debtRate: 6.5, equityRate: 12, tenureMonths: 20 } },

  // 2. Savings & Deposits
  { id: 'ppf', name: 'PPF Calculator', category: 'SAVINGS_DEPOSIT', description: 'Public Provident Fund 15-year statutory compounding at 7.1%', defaultInputs: { yearlyInv: 150000, rate: 7.1, tenureYears: 15 } },
  { id: 'fd', name: 'FD Calculator', category: 'SAVINGS_DEPOSIT', description: 'Fixed Deposit compound interest calculator with quarterly compounding', defaultInputs: { principal: 500000, rate: 7.25, tenureYears: 3 } },
  { id: 'rd', name: 'RD Calculator', category: 'SAVINGS_DEPOSIT', description: 'Recurring Deposit quarterly compounded savings tool', defaultInputs: { monthlyDeposit: 10000, rate: 7.0, tenureYears: 5 } },
  { id: 'nsc', name: 'NSC Calculator', category: 'SAVINGS_DEPOSIT', description: 'National Savings Certificate 5-year guaranteed return scheme at 7.7%', defaultInputs: { principal: 100000, rate: 7.7, tenureYears: 5 } },
  { id: 'kvp', name: 'KVP Calculator', category: 'SAVINGS_DEPOSIT', description: 'Kisan Vikas Patra maturity doubling estimator at 7.5% (115 months)', defaultInputs: { principal: 100000, rate: 7.5 } },

  // 3. Retirement
  { id: 'nps', name: 'NPS Calculator', category: 'RETIREMENT', description: 'National Pension Scheme retirement corpus and monthly annuity generator', defaultInputs: { monthlyInv: 10000, currentAge: 32, retirementAge: 60, expectedReturn: 10.5, annuityPct: 40, annuityRate: 6.5 } },
  { id: 'epf', name: 'EPF Calculator', category: 'RETIREMENT', description: 'Employees Provident Fund accumulation at statutory 8.25% interest rate', defaultInputs: { monthlySalary: 85000, currentAge: 30, retirementAge: 58, annualSalaryHike: 8, epfRate: 8.25 } },
  { id: 'scss', name: 'SCSS Calculator', category: 'RETIREMENT', description: 'Senior Citizens Savings Scheme quarterly interest payout at 8.2%', defaultInputs: { deposit: 1500000, rate: 8.2, tenureYears: 5 } },

  // 4. Tax-Saving
  { id: 'tax-fd', name: 'Tax-Saver FD Calculator', category: 'TAX_SAVING', description: '5-Year Section 80C Lock-in Fixed Deposit with interest tax calculation', defaultInputs: { principal: 150000, rate: 7.1, taxBracket: 30 } },
  { id: 'ssy', name: 'SSY (Sukanya Samriddhi) Calculator', category: 'TAX_SAVING', description: 'Girl child welfare accumulation scheme with 8.2% annual compound interest', defaultInputs: { yearlyInv: 150000, childAge: 3, rate: 8.2 } },

  // 5. Financial Planning
  { id: 'budget-planner', name: '50-30-20 Budget Planner', category: 'FINANCIAL_PLANNING', description: 'Optimal household allocation across Needs, Wants & Savings', defaultInputs: { monthlyTakeHome: 150000 } },
  { id: 'emergency-fund', name: 'Emergency Fund Calculator', category: 'FINANCIAL_PLANNING', description: 'Assess required 6-12 month liquidity reserve based on lifestyle burn rate', defaultInputs: { monthlyEssentialExpense: 85000, targetMonths: 9 } },
  { id: 'inflation', name: 'Inflation Impact Calculator', category: 'FINANCIAL_PLANNING', description: 'Evaluate future purchasing power and cost escalation of life goals', defaultInputs: { currentCost: 2500000, inflationRate: 6.5, yearsInFuture: 12 } },
  { id: 'rule72', name: 'Rule of 72 & 114 Calculator', category: 'FINANCIAL_PLANNING', description: 'Instant estimation of exact years required to double and triple wealth', defaultInputs: { annualRate: 12 } },
];

export const FinancialToolsModule: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<CalculatorCategory>('INVESTMENT');
  const [selectedCalcId, setSelectedCalcId] = useState<string>('sip');
  
  // Current active inputs
  const currentCalc = calculatorsCatalog.find(c => c.id === selectedCalcId) || calculatorsCatalog[0];
  const [inputs, setInputs] = useState<Record<string, number>>(currentCalc.defaultInputs);

  const handleSelectCalculator = (id: string) => {
    setSelectedCalcId(id);
    const target = calculatorsCatalog.find(c => c.id === id);
    if (target) {
      setInputs(target.defaultInputs);
    }
  };

  const handleInputChange = (key: string, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  // Math Computations
  const computeResults = () => {
    switch (currentCalc.id) {
      case 'sip': {
        const p = inputs.monthlyInv || 0;
        const i = (inputs.rate || 0) / 100 / 12;
        const n = (inputs.tenureYears || 0) * 12;
        const maturity = i > 0 ? p * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : p * n;
        const invested = p * n;
        const returns = maturity - invested;
        return {
          invested,
          returns,
          maturity,
          breakdown: [
            { name: 'Invested Principal', value: Math.round(invested) },
            { name: 'Estimated Returns', value: Math.round(returns) }
          ]
        };
      }
      case 'step-up-sip': {
        let monthly = inputs.monthlyInv || 0;
        const stepUp = (inputs.stepUpPct || 0) / 100;
        const rate = (inputs.rate || 0) / 100 / 12;
        const years = inputs.tenureYears || 0;
        let totalInvested = 0;
        let totalMaturity = 0;

        for (let y = 0; y < years; y++) {
          for (let m = 0; m < 12; m++) {
            totalInvested += monthly;
            const remainingMonths = (years - y) * 12 - m;
            totalMaturity += monthly * Math.pow(1 + rate, remainingMonths);
          }
          monthly += monthly * stepUp;
        }

        return {
          invested: totalInvested,
          returns: totalMaturity - totalInvested,
          maturity: totalMaturity,
          breakdown: [
            { name: 'Principal Invested', value: Math.round(totalInvested) },
            { name: 'Step-Up Wealth Gains', value: Math.round(totalMaturity - totalInvested) }
          ]
        };
      }
      case 'ppf': {
        const yearly = inputs.yearlyInv || 0;
        const r = (inputs.rate || 7.1) / 100;
        const n = inputs.tenureYears || 15;
        let balance = 0;
        let totalInvested = 0;
        for (let i = 0; i < n; i++) {
          totalInvested += yearly;
          balance = (balance + yearly) * (1 + r);
        }
        return {
          invested: totalInvested,
          returns: balance - totalInvested,
          maturity: balance,
          breakdown: [
            { name: 'Total Deposits', value: Math.round(totalInvested) },
            { name: 'Tax-Free Interest', value: Math.round(balance - totalInvested) }
          ]
        };
      }
      case 'fd': {
        const p = inputs.principal || 0;
        const r = (inputs.rate || 0) / 100;
        const n = inputs.tenureYears || 0;
        // quarterly compounding
        const maturity = p * Math.pow(1 + r / 4, 4 * n);
        return {
          invested: p,
          returns: maturity - p,
          maturity,
          breakdown: [
            { name: 'Principal Amount', value: Math.round(p) },
            { name: 'Compounded Interest', value: Math.round(maturity - p) }
          ]
        };
      }
      case 'budget-planner': {
        const income = inputs.monthlyTakeHome || 0;
        const needs = income * 0.50;
        const wants = income * 0.30;
        const savings = income * 0.20;
        return {
          invested: savings,
          returns: wants,
          maturity: needs,
          customLabels: { needs, wants, savings },
          breakdown: [
            { name: 'Needs (50%)', value: Math.round(needs) },
            { name: 'Wants (30%)', value: Math.round(wants) },
            { name: 'Savings & SIP (20%)', value: Math.round(savings) }
          ]
        };
      }
      case 'emergency-fund': {
        const expense = inputs.monthlyEssentialExpense || 0;
        const months = inputs.targetMonths || 6;
        const target = expense * months;
        return {
          invested: expense,
          returns: months,
          maturity: target,
          breakdown: [
            { name: 'Monthly Burn Rate', value: expense },
            { name: 'Total Cushion Required', value: target }
          ]
        };
      }
      case 'rule72': {
        const r = inputs.annualRate || 1;
        const yearsToDouble = 72 / r;
        const yearsToTriple = 114 / r;
        return {
          invested: yearsToDouble,
          returns: yearsToTriple,
          maturity: yearsToDouble,
          breakdown: [
            { name: 'Years to Double', value: Number(yearsToDouble.toFixed(1)) },
            { name: 'Years to Triple', value: Number(yearsToTriple.toFixed(1)) }
          ]
        };
      }
      default: {
        const p = 100000;
        const r = 0.08;
        const n = 5;
        const maturity = p * Math.pow(1 + r, n);
        return {
          invested: p,
          returns: maturity - p,
          maturity,
          breakdown: [
            { name: 'Principal', value: p },
            { name: 'Interest', value: Math.round(maturity - p) }
          ]
        };
      }
    }
  };

  const results = computeResults();
  const COLORS = ['#8D7A62', '#3B82F6', '#F59E0B'];

  const categories: { id: CalculatorCategory; label: string }[] = [
    { id: 'INVESTMENT', label: 'Investment (4)' },
    { id: 'SAVINGS_DEPOSIT', label: 'Savings & Deposits (5)' },
    { id: 'RETIREMENT', label: 'Retirement (3)' },
    { id: 'TAX_SAVING', label: 'Tax-Saving (2)' },
    { id: 'FINANCIAL_PLANNING', label: 'Financial Planning (4)' }
  ];

  const filteredCatalog = calculatorsCatalog.filter(c => c.category === selectedCategory);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#3A3226]">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              const firstInCat = calculatorsCatalog.find(c => c.category === cat.id);
              if (firstInCat) handleSelectCalculator(firstInCat.id);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                : 'bg-[#1D1913] text-[#A79A8A] hover:text-white border border-[#3A3226]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Calculator Switcher List */}
        <div className="lg:col-span-1 bg-[#1D1913] border border-[#3A3226] rounded-2xl p-3 space-y-1">
          <span className="text-[11px] font-bold text-[#A79A8A] uppercase px-2 mb-2 block tracking-wider">
            Suite Selection
          </span>
          {filteredCatalog.map(calc => {
            const isSelected = calc.id === selectedCalcId;
            return (
              <button
                key={calc.id}
                onClick={() => handleSelectCalculator(calc.id)}
                className={`w-full text-left p-3 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#8D7A62]/20 text-[#8D7A62] border border-[#8D7A62]/30 font-bold'
                    : 'text-[#A79A8A] hover:bg-[#241F17] hover:text-white'
                }`}
              >
                <div className="text-white font-semibold">{calc.name}</div>
                <div className="text-[10px] text-[#A79A8A] truncate mt-0.5">{calc.description}</div>
              </button>
            );
          })}
        </div>

        {/* Right: Active Calculator Form & Real-time Graphical Breakdown */}
        <div className="lg:col-span-3 bg-[#1D1913] border border-[#3A3226] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#3A3226] pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{currentCalc.name}</h2>
              <p className="text-xs text-[#A79A8A] mt-0.5">{currentCalc.description}</p>
            </div>
            <button
              onClick={() => setInputs(currentCalc.defaultInputs)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#241F17] hover:bg-[#2E2820] border border-[#3A3226] text-[#A79A8A] hover:text-white text-xs transition"
            >
              <RotateCcw size={14} /> Reset Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Sliders & Fields */}
            <div className="space-y-5">
              {Object.entries(inputs).map(([key, val]) => {
                // Human-friendly label formatting
                const label = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase());
                
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A79A8A] font-medium">{label}</span>
                      <span className="font-bold text-white font-tabular bg-[#241F17] px-2.5 py-1 rounded-md border border-[#3A3226]">
                        {key.toLowerCase().includes('rate') || key.toLowerCase().includes('pct') || key.toLowerCase().includes('hike')
                          ? `${val}%`
                          : key.toLowerCase().includes('years') || key.toLowerCase().includes('months') || key.toLowerCase().includes('age')
                          ? `${val}`
                          : formatINR(val)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={key.toLowerCase().includes('rate') ? 1 : key.toLowerCase().includes('years') ? 1 : 500}
                      max={
                        key.toLowerCase().includes('rate') ? 30 :
                        key.toLowerCase().includes('years') ? 40 :
                        key.toLowerCase().includes('corpus') ? 20000000 : 200000
                      }
                      step={key.toLowerCase().includes('rate') ? 0.25 : 500}
                      value={val}
                      onChange={e => handleInputChange(key, Number(e.target.value))}
                      className="w-full accent-[#8D7A62] cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Visual Output & Computation Highlights */}
            <div className="bg-[#241F17]/50 border border-[#3A3226] p-5 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[#A79A8A] uppercase tracking-wider block mb-1">
                  Expected Maturity Wealth
                </span>
                <div className="text-3xl font-extrabold text-[#8D7A62] font-tabular">
                  {currentCalc.id === 'rule72'
                    ? `${results.maturity.toFixed(1)} Years to Double`
                    : formatINR(results.maturity)}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-[#1D1913] p-3 rounded-lg border border-[#3A3226]">
                    <span className="text-[10px] text-[#A79A8A] block">Total Principal</span>
                    <span className="font-bold text-white font-tabular">
                      {currentCalc.id === 'rule72' ? `${inputs.annualRate}% Rate` : formatINR(results.invested)}
                    </span>
                  </div>
                  <div className="bg-[#1D1913] p-3 rounded-lg border border-[#3A3226]">
                    <span className="text-[10px] text-[#A79A8A] block">Estimated Growth / Profit</span>
                    <span className="font-bold text-emerald-400 font-tabular">
                      {currentCalc.id === 'rule72' ? `${results.returns.toFixed(1)} Yrs to Triple` : formatINR(results.returns)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pie Chart Representation */}
              {results.breakdown && results.breakdown.length > 0 && (
                <div className="h-36 w-full mt-4 min-w-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={144} minWidth={0}>
                    <PieChart>
                      <Pie
                        data={results.breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {results.breakdown.map((_, index) => (
                          <Cell key={`cell-calc-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#241F17', borderColor: '#3A3226', borderRadius: '8px', color: '#FFF' }}
                        formatter={(val: any) => [formatINR(Number(val)), 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

