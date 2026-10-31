import React, { useState } from 'react';
import { formatINR, formatCompactINR } from '../utils/currency';
import { useFinancial } from '../context/FinancialContext';
import {
  Calculator,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Percent,
  PiggyBank,
  ShieldAlert,
  Flame,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Sliders,
  DollarSign,
  Calendar,
  Layers,
  HelpCircle,
  Clock,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';

export type CalculatorCategory = 
  | 'INVESTMENT'
  | 'SAVINGS_DEPOSIT'
  | 'RETIREMENT'
  | 'TAX_SAVING'
  | 'FINANCIAL_PLANNING';

export interface SliderMeta {
  min: number;
  max: number;
  step: number;
  unit: 'INR' | 'PCT' | 'YEARS' | 'MONTHS' | 'AGE';
  label: string;
  description: string;
}

export interface CalculatorDefinition {
  id: string;
  name: string;
  category: CalculatorCategory;
  description: string;
  defaultInputs: Record<string, number>;
  meta: Record<string, SliderMeta>;
}

export const calculatorsCatalog: CalculatorDefinition[] = [
  // 1. Investment
  {
    id: 'sip',
    name: 'SIP Calculator',
    category: 'INVESTMENT',
    description: 'Systematic Investment Plan with real inflation-adjusted wealth growth & profit multiplier',
    defaultInputs: {
      monthlyInv: 15000,
      rate: 12.0,
      tenureYears: 10,
      inflationRate: 6.0,
      capitalGainsTax: 12.5,
    },
    meta: {
      monthlyInv: { min: 500, max: 200000, step: 500, unit: 'INR', label: 'Monthly SIP Investment', description: 'Amount you commit each month to mutual funds' },
      rate: { min: 1, max: 30, step: 0.25, unit: 'PCT', label: 'Expected Return Rate (p.a.)', description: 'Historical equity mutual fund CAGR averages 12-14%' },
      tenureYears: { min: 1, max: 40, step: 1, unit: 'YEARS', label: 'Investment Horizon', description: 'Compounding accelerates significantly after 7-10 years' },
      inflationRate: { min: 0, max: 15, step: 0.25, unit: 'PCT', label: 'Expected Inflation Rate', description: 'Headline inflation discount to project real future purchasing power' },
      capitalGainsTax: { min: 0, max: 30, step: 0.5, unit: 'PCT', label: 'Capital Gains Tax (LTCG)', description: 'Long term capital gains tax on equity (current Indian rate 12.5%)' },
    }
  },
  {
    id: 'step-up-sip',
    name: 'Step-Up SIP Calculator',
    category: 'INVESTMENT',
    description: 'Annual SIP increment model to match career salary progression and wage growth',
    defaultInputs: {
      monthlyInv: 15000,
      stepUpPct: 10,
      rate: 12.0,
      tenureYears: 10,
      inflationRate: 6.0
    },
    meta: {
      monthlyInv: { min: 500, max: 200000, step: 500, unit: 'INR', label: 'Initial Monthly SIP', description: 'Starting monthly investment for Year 1' },
      stepUpPct: { min: 1, max: 30, step: 1, unit: 'PCT', label: 'Annual Top-up / Step-Up %', description: 'Percentage by which you increase your SIP every year' },
      rate: { min: 1, max: 30, step: 0.25, unit: 'PCT', label: 'Expected Return Rate (p.a.)', description: 'Estimated annual compounding rate' },
      tenureYears: { min: 1, max: 40, step: 1, unit: 'YEARS', label: 'Investment Horizon', description: 'Total accumulation period in years' },
      inflationRate: { min: 0, max: 15, step: 0.25, unit: 'PCT', label: 'Expected Inflation', description: 'Cost of living adjustment' }
    }
  },
  {
    id: 'swp',
    name: 'SWP Calculator',
    category: 'INVESTMENT',
    description: 'Systematic Withdrawal Plan for steady monthly retirement cashflow & corpus depletion modeling',
    defaultInputs: {
      corpus: 5000000,
      monthlyWithdrawal: 35000,
      rate: 8.5,
      tenureYears: 15,
      inflationRate: 5.5
    },
    meta: {
      corpus: { min: 500000, max: 50000000, step: 100000, unit: 'INR', label: 'Initial Investment Corpus', description: 'Lump-sum retirement corpus parked in debt/hybrid funds' },
      monthlyWithdrawal: { min: 5000, max: 500000, step: 1000, unit: 'INR', label: 'Monthly Withdrawal (SWP)', description: 'Monthly payout transferred directly to your bank' },
      rate: { min: 3, max: 18, step: 0.25, unit: 'PCT', label: 'Portfolio Annual Yield', description: 'Conservative hybrid fund returns' },
      tenureYears: { min: 1, max: 40, step: 1, unit: 'YEARS', label: 'Withdrawal Period', description: 'Desired drawdown duration in years' },
      inflationRate: { min: 0, max: 12, step: 0.25, unit: 'PCT', label: 'Annual Inflation', description: 'Purchasing power loss over the retirement period' }
    }
  },
  {
    id: 'stp',
    name: 'STP Calculator',
    category: 'INVESTMENT',
    description: 'Systematic Transfer Plan transitioning capital systematically from liquid/debt to equity',
    defaultInputs: {
      initialCorpus: 1000000,
      monthlyTransfer: 50000,
      debtRate: 6.5,
      equityRate: 12.0,
      tenureMonths: 20
    },
    meta: {
      initialCorpus: { min: 100000, max: 20000000, step: 50000, unit: 'INR', label: 'Lump-sum in Source Debt Fund', description: 'Liquid cash placed to mitigate equity market timing risk' },
      monthlyTransfer: { min: 5000, max: 500000, step: 5000, unit: 'INR', label: 'Monthly Transfer to Target Fund', description: 'Amount shifted into equity mutual funds monthly' },
      debtRate: { min: 3, max: 10, step: 0.25, unit: 'PCT', label: 'Source Debt Fund Return', description: 'Liquid fund yield while money sits in queue' },
      equityRate: { min: 6, max: 25, step: 0.5, unit: 'PCT', label: 'Target Equity Fund Return', description: 'Long term expected equity appreciation' },
      tenureMonths: { min: 3, max: 60, step: 1, unit: 'MONTHS', label: 'Transfer Horizon (Months)', description: 'Staggered STP duration' }
    }
  },
  {
    id: 'lumpsum',
    name: 'Lumpsum Investment Calculator',
    category: 'INVESTMENT',
    description: 'One-time wealth growth modeling with compound annual growth rate & inflation discount',
    defaultInputs: {
      initialInvestment: 500000,
      rate: 12.0,
      tenureYears: 10,
      inflationRate: 6.0
    },
    meta: {
      initialInvestment: { min: 10000, max: 20000000, step: 25000, unit: 'INR', label: 'Initial Lump-sum Amount', description: 'One-time initial capital deployed' },
      rate: { min: 1, max: 30, step: 0.25, unit: 'PCT', label: 'Expected Return Rate (p.a.)', description: 'Historical equity mutual fund CAGR averages 12-14%' },
      tenureYears: { min: 1, max: 40, step: 1, unit: 'YEARS', label: 'Investment Horizon', description: 'Compounding duration in years' },
      inflationRate: { min: 0, max: 15, step: 0.25, unit: 'PCT', label: 'Expected Inflation', description: 'Headline inflation discount' }
    }
  },
  {
    id: 'emi',
    name: 'Loan EMI Calculator',
    category: 'FINANCIAL_PLANNING',
    description: 'Precision reducing-balance EMI, total interest liability & principal-interest ratio',
    defaultInputs: {
      loanAmount: 2500000,
      interestRate: 8.5,
      tenureYears: 20
    },
    meta: {
      loanAmount: { min: 50000, max: 50000000, step: 50000, unit: 'INR', label: 'Loan Principal Amount', description: 'Total sanctioned loan amount' },
      interestRate: { min: 5, max: 24, step: 0.1, unit: 'PCT', label: 'Annual Interest Rate (p.a.)', description: 'Annual interest percentage' },
      tenureYears: { min: 1, max: 30, step: 1, unit: 'YEARS', label: 'Loan Tenure (Years)', description: 'Repayment period in years' }
    }
  },

  // 2. Savings & Deposits
  {
    id: 'ppf',
    name: 'PPF Calculator',
    category: 'SAVINGS_DEPOSIT',
    description: 'Public Provident Fund 15-year statutory compounding under sovereign EEE tax exemption',
    defaultInputs: {
      yearlyInv: 150000,
      rate: 7.1,
      tenureYears: 15,
      inflationRate: 5.5
    },
    meta: {
      yearlyInv: { min: 500, max: 150000, step: 500, unit: 'INR', label: 'Yearly Contribution', description: 'Statutory ceiling is ₹1,50,000 per financial year' },
      rate: { min: 5, max: 12, step: 0.1, unit: 'PCT', label: 'Govt Notified Interest Rate', description: 'Current sovereign benchmark rate is 7.1%' },
      tenureYears: { min: 15, max: 35, step: 5, unit: 'YEARS', label: 'Lock-in Period (Years)', description: '15 years mandatory, extendable in blocks of 5 years' },
      inflationRate: { min: 0, max: 10, step: 0.25, unit: 'PCT', label: 'Benchmark Inflation', description: 'Real net return calculation' }
    }
  },
  {
    id: 'fd',
    name: 'FD Calculator',
    category: 'SAVINGS_DEPOSIT',
    description: 'Fixed Deposit compound interest calculator with quarterly compounding and tax bracket analysis',
    defaultInputs: {
      principal: 500000,
      rate: 7.25,
      tenureYears: 3,
      taxBracket: 20
    },
    meta: {
      principal: { min: 10000, max: 10000000, step: 10000, unit: 'INR', label: 'Principal Deposit', description: 'Initial deposit placed with bank' },
      rate: { min: 3, max: 12, step: 0.1, unit: 'PCT', label: 'Bank Interest Rate (p.a.)', description: 'Annual coupon rate compounded quarterly' },
      tenureYears: { min: 1, max: 10, step: 1, unit: 'YEARS', label: 'Deposit Tenure (Years)', description: 'Term of the fixed deposit' },
      taxBracket: { min: 0, max: 30, step: 5, unit: 'PCT', label: 'Marginal Tax Bracket (TDS)', description: 'FD interest is taxed at your income slab' }
    }
  },
  {
    id: 'rd',
    name: 'RD Calculator',
    category: 'SAVINGS_DEPOSIT',
    description: 'Recurring Deposit quarterly compounded savings tool for disciplined salaried reserves',
    defaultInputs: {
      monthlyDeposit: 10000,
      rate: 7.0,
      tenureYears: 5,
      taxBracket: 15
    },
    meta: {
      monthlyDeposit: { min: 500, max: 200000, step: 500, unit: 'INR', label: 'Monthly Deposit Installment', description: 'Standing instruction debit every month' },
      rate: { min: 3, max: 12, step: 0.1, unit: 'PCT', label: 'Interest Rate (p.a.)', description: 'Quarterly compounded statutory rate' },
      tenureYears: { min: 1, max: 10, step: 1, unit: 'YEARS', label: 'Tenure (Years)', description: 'Total term of the recurring deposit' },
      taxBracket: { min: 0, max: 30, step: 5, unit: 'PCT', label: 'Income Tax Slab', description: 'Applicable TDS deduction on interest' }
    }
  },
  {
    id: 'nsc',
    name: 'NSC Calculator',
    category: 'SAVINGS_DEPOSIT',
    description: 'National Savings Certificate 5-year guaranteed return scheme at 7.7% annual compounding',
    defaultInputs: {
      principal: 100000,
      rate: 7.7,
      tenureYears: 5
    },
    meta: {
      principal: { min: 1000, max: 5000000, step: 5000, unit: 'INR', label: 'Certificate Purchase Amount', description: 'Post office sovereign certificate investment' },
      rate: { min: 5, max: 10, step: 0.1, unit: 'PCT', label: 'Sovereign Interest Rate', description: 'Current government rate 7.7% compounded annually' },
      tenureYears: { min: 5, max: 5, step: 1, unit: 'YEARS', label: 'Fixed Statutory Maturity', description: 'Standard lock-in period is strictly 5 years' }
    }
  },
  {
    id: 'kvp',
    name: 'KVP Calculator',
    category: 'SAVINGS_DEPOSIT',
    description: 'Kisan Vikas Patra maturity doubling estimator at 7.5% sovereign rate',
    defaultInputs: {
      principal: 100000,
      rate: 7.5
    },
    meta: {
      principal: { min: 1000, max: 5000000, step: 5000, unit: 'INR', label: 'Investment Amount', description: 'Lump-sum sovereign deposit' },
      rate: { min: 5, max: 10, step: 0.1, unit: 'PCT', label: 'Annual Compound Rate', description: 'Currently 7.5% (doubles in 115 months)' }
    }
  },

  // 3. Retirement
  {
    id: 'nps',
    name: 'NPS Calculator',
    category: 'RETIREMENT',
    description: 'National Pension Scheme retirement corpus, tax-free lumpsum & monthly annuity generator',
    defaultInputs: {
      monthlyInv: 10000,
      currentAge: 30,
      retirementAge: 60,
      expectedReturn: 10.5,
      annuityPct: 40,
      annuityRate: 6.5
    },
    meta: {
      monthlyInv: { min: 1000, max: 150000, step: 1000, unit: 'INR', label: 'Monthly NPS Contribution', description: 'Includes Tier-1 Section 80CCD(1B) extra ₹50k deduction' },
      currentAge: { min: 18, max: 65, step: 1, unit: 'AGE', label: 'Your Current Age', description: 'Starting age of active contribution' },
      retirementAge: { min: 50, max: 75, step: 1, unit: 'AGE', label: 'Target Retirement Age', description: 'Vesting age for withdrawal (default 60)' },
      expectedReturn: { min: 6, max: 16, step: 0.25, unit: 'PCT', label: 'Expected Portfolio Return', description: 'Blended return across Equity (E), Corporate (C) & Govt (G)' },
      annuityPct: { min: 40, max: 100, step: 5, unit: 'PCT', label: 'Annuity Purchase Percentage', description: 'Mandatory minimum 40% reserved for pension' },
      annuityRate: { min: 4, max: 10, step: 0.25, unit: 'PCT', label: 'Annuity Yield Rate', description: 'Lifelong fixed monthly pension rate' }
    }
  },
  {
    id: 'epf',
    name: 'EPF Calculator',
    category: 'RETIREMENT',
    description: 'Employees Provident Fund accumulation at statutory 8.25% with annual salary appraisal steps',
    defaultInputs: {
      monthlySalary: 85000,
      currentAge: 28,
      retirementAge: 58,
      annualSalaryHike: 8.0,
      epfRate: 8.25
    },
    meta: {
      monthlySalary: { min: 15000, max: 500000, step: 5000, unit: 'INR', label: 'Monthly Basic + DA Salary', description: 'Statutory basis for the 12% PF deduction' },
      currentAge: { min: 20, max: 55, step: 1, unit: 'AGE', label: 'Current Employee Age', description: 'Starting calculation point' },
      retirementAge: { min: 55, max: 65, step: 1, unit: 'AGE', label: 'Retirement Age', description: 'Standard EPFO superannuation age is 58' },
      annualSalaryHike: { min: 0, max: 25, step: 0.5, unit: 'PCT', label: 'Expected Annual Salary Hike', description: 'Compounding salary appraisal over career' },
      epfRate: { min: 7, max: 10, step: 0.05, unit: 'PCT', label: 'EPFO Statutory Interest', description: 'Current government declared rate is 8.25%' }
    }
  },
  {
    id: 'scss',
    name: 'SCSS Calculator',
    category: 'RETIREMENT',
    description: 'Senior Citizens Savings Scheme quarterly interest payout at guaranteed 8.2% sovereign yield',
    defaultInputs: {
      deposit: 1500000,
      rate: 8.2,
      tenureYears: 5
    },
    meta: {
      deposit: { min: 10000, max: 3000000, step: 50000, unit: 'INR', label: 'Deposit Principal', description: 'Statutory maximum limit is ₹30,00,000 per individual' },
      rate: { min: 6, max: 10, step: 0.1, unit: 'PCT', label: 'Government Coupon Rate', description: 'Fixed sovereign interest rate payable quarterly' },
      tenureYears: { min: 5, max: 8, step: 3, unit: 'YEARS', label: 'Deposit Term (Years)', description: '5 years standard, extendable by 3 years' }
    }
  },

  // 4. Tax-Saving
  {
    id: 'tax-fd',
    name: 'Tax-Saver FD Calculator',
    category: 'TAX_SAVING',
    description: '5-Year Section 80C Lock-in Fixed Deposit with net post-tax yield & tax deduction analysis',
    defaultInputs: {
      principal: 150000,
      rate: 7.1,
      taxBracket: 30
    },
    meta: {
      principal: { min: 10000, max: 150000, step: 5000, unit: 'INR', label: '80C Investment Amount', description: 'Qualifies for tax deduction under Section 80C up to ₹1.5L' },
      rate: { min: 5, max: 10, step: 0.1, unit: 'PCT', label: 'Bank Interest Rate (p.a.)', description: 'Quarterly compounded interest' },
      taxBracket: { min: 5, max: 35, step: 5, unit: 'PCT', label: 'Income Tax Slab (Old Regime)', description: 'Tax deducted on interest accrual' }
    }
  },
  {
    id: 'ssy',
    name: 'SSY (Sukanya Samriddhi) Calculator',
    category: 'TAX_SAVING',
    description: 'Girl child welfare accumulation scheme with 8.2% annual compound interest and EEE tax exemption',
    defaultInputs: {
      yearlyInv: 150000,
      childAge: 3,
      rate: 8.2
    },
    meta: {
      yearlyInv: { min: 1000, max: 150000, step: 1000, unit: 'INR', label: 'Yearly Contribution', description: 'Deposited for 15 years from account opening' },
      childAge: { min: 0, max: 10, step: 1, unit: 'AGE', label: 'Girl Child Current Age', description: 'Account can be opened before child turns 10 years' },
      rate: { min: 6, max: 10, step: 0.1, unit: 'PCT', label: 'Sovereign Interest Rate', description: 'Currently 8.2% compounded annually' }
    }
  },

  // 5. Financial Planning
  {
    id: 'budget-planner',
    name: '50-30-20 Budget Planner',
    category: 'FINANCIAL_PLANNING',
    description: 'Optimal household allocation across Needs (50%), Wants (30%) & Long-term Savings (20%)',
    defaultInputs: {
      monthlyTakeHome: 150000
    },
    meta: {
      monthlyTakeHome: { min: 20000, max: 1000000, step: 5000, unit: 'INR', label: 'Monthly In-Hand Net Income', description: 'Net take-home pay credited to your bank account' }
    }
  },
  {
    id: 'emergency-fund',
    name: 'Emergency Fund Calculator',
    category: 'FINANCIAL_PLANNING',
    description: 'Assess required 6-12 month liquidity reserve based on lifestyle burn rate and debt obligations',
    defaultInputs: {
      monthlyEssentialExpense: 65000,
      monthlyEmiObligations: 20000,
      targetMonths: 9
    },
    meta: {
      monthlyEssentialExpense: { min: 10000, max: 500000, step: 2000, unit: 'INR', label: 'Monthly Living Essentials', description: 'Food, rent, groceries, healthcare and utilities' },
      monthlyEmiObligations: { min: 0, max: 300000, step: 2000, unit: 'INR', label: 'Fixed Monthly EMIs', description: 'Home, car or personal loan repayments' },
      targetMonths: { min: 3, max: 24, step: 1, unit: 'MONTHS', label: 'Emergency Runway (Months)', description: 'Months of survival runway without fresh income' }
    }
  },
  {
    id: 'inflation',
    name: 'Inflation Impact Calculator',
    category: 'FINANCIAL_PLANNING',
    description: 'Evaluate future purchasing power and cost escalation of higher education, housing & life goals',
    defaultInputs: {
      currentCost: 2500000,
      inflationRate: 6.5,
      yearsInFuture: 12
    },
    meta: {
      currentCost: { min: 50000, max: 50000000, step: 50000, unit: 'INR', label: 'Current Cost of Goal Today', description: 'e.g. Higher education, dream car or house today' },
      inflationRate: { min: 2, max: 15, step: 0.25, unit: 'PCT', label: 'Annual Inflation Rate', description: 'Education inflation is typically 8-10%, lifestyle 6-7%' },
      yearsInFuture: { min: 1, max: 35, step: 1, unit: 'YEARS', label: 'Years to Goal Horizon', description: 'When the outlay will occur' }
    }
  },
  {
    id: 'rule72',
    name: 'Rule of 72 & 114 Calculator',
    category: 'FINANCIAL_PLANNING',
    description: 'Instant estimation of exact years required to double and triple wealth at any given compound return',
    defaultInputs: {
      annualRate: 12.0
    },
    meta: {
      annualRate: { min: 1, max: 35, step: 0.5, unit: 'PCT', label: 'Expected Annual Growth Rate', description: 'Annual percentage yield or investment CAGR' }
    }
  },
];

export const FinancialToolsModule: React.FC = () => {
  const { isDarkMode } = useFinancial();
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

  // Math Computations with inflation, tax, and detailed analytics
  const computeResults = () => {
    switch (currentCalc.id) {
      case 'sip': {
        const p = inputs.monthlyInv || 0;
        const nominalRate = (inputs.rate || 0) / 100 / 12;
        const years = inputs.tenureYears || 0;
        const n = years * 12;
        const inflationRate = (inputs.inflationRate || 0) / 100;
        const taxRate = (inputs.capitalGainsTax || 0) / 100;

        const maturity = nominalRate > 0 ? p * ((Math.pow(1 + nominalRate, n) - 1) / nominalRate) * (1 + nominalRate) : p * n;
        const invested = p * n;
        const grossProfit = Math.max(0, maturity - invested);

        // Tax calculation: First ₹1.25 Lakh exempt per FY under Indian Section 112A
        const taxableGain = Math.max(0, grossProfit - 125000);
        const taxDeduction = taxableGain * taxRate;
        const postTaxMaturity = maturity - taxDeduction;
        const postTaxProfit = grossProfit - taxDeduction;

        // Inflation adjusted real purchasing power
        const realPurchasingPower = maturity / Math.pow(1 + inflationRate, years);
        const profitMultiplier = invested > 0 ? (maturity / invested).toFixed(2) : '1.0';

        // Year by year progression trajectory for charts
        const progression = [];
        let runningInvested = 0;
        for (let y = 1; y <= years; y++) {
          const mCount = y * 12;
          const yMaturity = nominalRate > 0 ? p * ((Math.pow(1 + nominalRate, mCount) - 1) / nominalRate) * (1 + nominalRate) : p * mCount;
          runningInvested = p * mCount;
          progression.push({
            year: `Yr ${y}`,
            Invested: Math.round(runningInvested),
            Wealth: Math.round(yMaturity),
            Profit: Math.round(yMaturity - runningInvested)
          });
        }

        return {
          invested,
          returns: grossProfit,
          maturity,
          postTaxMaturity,
          taxDeduction,
          realPurchasingPower,
          profitMultiplier,
          progression,
          maturityLabel: 'Estimated Future Corpus',
          investedLabel: 'Total Capital Invested',
          returnsLabel: 'Total Compounded Profit',
          breakdown: [
            { name: 'Invested Principal', value: Math.round(invested) },
            { name: 'Estimated Profit', value: Math.round(grossProfit) }
          ]
        };
      }
      case 'step-up-sip': {
        const initialMonthly = inputs.monthlyInv || 0;
        const stepUp = (inputs.stepUpPct || 0) / 100;
        const rate = (inputs.rate || 0) / 100 / 12;
        const years = inputs.tenureYears || 0;
        const inflationRate = (inputs.inflationRate || 0) / 100;
        let totalInvested = 0;
        let totalMaturity = 0;
        let currentYearMonthly = initialMonthly;

        for (let y = 0; y < years; y++) {
          for (let m = 0; m < 12; m++) {
            totalInvested += currentYearMonthly;
            const remainingMonths = (years - y) * 12 - m;
            totalMaturity += currentYearMonthly * Math.pow(1 + rate, remainingMonths);
          }
          currentYearMonthly = currentYearMonthly * (1 + stepUp);
        }

        const realPurchasingPower = totalMaturity / Math.pow(1 + inflationRate, years);

        return {
          invested: totalInvested,
          returns: totalMaturity - totalInvested,
          maturity: totalMaturity,
          realPurchasingPower,
          maturityLabel: 'Step-Up Accumulated Wealth',
          investedLabel: 'Total Stepped-Up Investment',
          returnsLabel: 'Compounding Accelerated Gains',
          breakdown: [
            { name: 'Principal Invested', value: Math.round(totalInvested) },
            { name: 'Step-Up Wealth Gains', value: Math.round(totalMaturity - totalInvested) }
          ]
        };
      }
      case 'swp': {
        const corpus = inputs.corpus || 0;
        const monthlyWithdrawal = inputs.monthlyWithdrawal || 0;
        const annualRate = (inputs.rate || 0) / 100;
        const monthlyRate = annualRate / 12;
        const totalMonths = (inputs.tenureYears || 0) * 12;

        let remainingCorpus = corpus;
        let totalWithdrawn = 0;
        for (let m = 0; m < totalMonths; m++) {
          remainingCorpus = remainingCorpus * (1 + monthlyRate) - monthlyWithdrawal;
          totalWithdrawn += monthlyWithdrawal;
          if (remainingCorpus <= 0) {
            remainingCorpus = 0;
            break;
          }
        }
        return {
          invested: corpus,
          returns: totalWithdrawn,
          maturity: remainingCorpus,
          maturityLabel: 'Remaining Portfolio Corpus',
          investedLabel: 'Initial Lump-sum Corpus',
          returnsLabel: 'Total Cash Payout Received',
          breakdown: [
            { name: 'Remaining Corpus', value: Math.round(remainingCorpus) },
            { name: 'Total Withdrawn Cash', value: Math.round(totalWithdrawn) }
          ]
        };
      }
      case 'stp': {
        const initialCorpus = inputs.initialCorpus || 0;
        const monthlyTransfer = inputs.monthlyTransfer || 0;
        const debtMonthlyRate = (inputs.debtRate || 0) / 100 / 12;
        const equityMonthlyRate = (inputs.equityRate || 0) / 100 / 12;
        const months = inputs.tenureMonths || 12;

        let debtBalance = initialCorpus;
        let equityBalance = 0;
        for (let m = 0; m < months; m++) {
          const transferAmt = Math.min(debtBalance, monthlyTransfer);
          debtBalance = (debtBalance - transferAmt) * (1 + debtMonthlyRate);
          equityBalance = (equityBalance + transferAmt) * (1 + equityMonthlyRate);
        }
        const totalWealth = debtBalance + equityBalance;
        return {
          invested: initialCorpus,
          returns: totalWealth - initialCorpus,
          maturity: totalWealth,
          maturityLabel: 'Combined STP Wealth',
          investedLabel: 'Initial Debt Allocation',
          returnsLabel: 'Net Equity Gains',
          breakdown: [
            { name: 'Equity Fund Balance', value: Math.round(equityBalance) },
            { name: 'Residual Debt Fund', value: Math.round(debtBalance) }
          ]
        };
      }
      case 'lumpsum': {
        const principal = inputs.initialInvestment || 0;
        const annualRate = (inputs.rate || 0) / 100;
        const years = inputs.tenureYears || 0;
        const inflationRate = (inputs.inflationRate || 0) / 100;

        const maturity = principal * Math.pow(1 + annualRate, years);
        const grossProfit = maturity - principal;
        const realPurchasingPower = maturity / Math.pow(1 + inflationRate, years);
        const profitMultiplier = principal > 0 ? (maturity / principal).toFixed(2) : '1.0';

        return {
          invested: principal,
          returns: grossProfit,
          maturity,
          realPurchasingPower,
          profitMultiplier,
          maturityLabel: 'Estimated Lumpsum Corpus',
          investedLabel: 'Initial Principal Invested',
          returnsLabel: 'Total Compounded Profit',
          breakdown: [
            { name: 'Principal Invested', value: Math.round(principal) },
            { name: 'Compound Profit', value: Math.round(grossProfit) }
          ]
        };
      }
      case 'emi': {
        const loanAmount = inputs.loanAmount || 0;
        const annualRate = inputs.interestRate || 0;
        const years = inputs.tenureYears || 0;
        const monthlyRate = annualRate / 100 / 12;
        const totalMonths = years * 12;

        let emi = 0;
        if (monthlyRate > 0 && totalMonths > 0) {
          emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
            (Math.pow(1 + monthlyRate, totalMonths) - 1);
        } else if (totalMonths > 0) {
          emi = loanAmount / totalMonths;
        }

        const totalRepayment = emi * totalMonths;
        const totalInterest = Math.max(0, totalRepayment - loanAmount);

        return {
          invested: loanAmount,
          returns: totalInterest,
          maturity: emi,
          maturityLabel: `Monthly EMI: ${formatINR(Math.round(emi))}`,
          investedLabel: 'Principal Borrowed',
          returnsLabel: 'Total Interest Payable',
          breakdown: [
            { name: 'Principal Amount', value: Math.round(loanAmount) },
            { name: 'Total Interest Payable', value: Math.round(totalInterest) }
          ]
        };
      }
      case 'ppf': {
        const yearly = inputs.yearlyInv || 0;
        const r = (inputs.rate || 7.1) / 100;
        const n = inputs.tenureYears || 15;
        const inflationRate = (inputs.inflationRate || 0) / 100;
        let balance = 0;
        let totalInvested = 0;
        for (let i = 0; i < n; i++) {
          totalInvested += yearly;
          balance = (balance + yearly) * (1 + r);
        }
        const realPurchasingPower = balance / Math.pow(1 + inflationRate, n);
        return {
          invested: totalInvested,
          returns: balance - totalInvested,
          maturity: balance,
          realPurchasingPower,
          maturityLabel: 'Maturity (Tax-Free EEE)',
          investedLabel: 'Total Deposits (15+ Yrs)',
          returnsLabel: 'Guaranteed Sovereign Interest',
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
        const taxRate = (inputs.taxBracket || 0) / 100;
        // quarterly compounding
        const grossMaturity = p * Math.pow(1 + r / 4, 4 * n);
        const grossInterest = grossMaturity - p;
        const taxPaid = grossInterest * taxRate;
        const postTaxMaturity = p + (grossInterest - taxPaid);
        return {
          invested: p,
          returns: grossInterest - taxPaid,
          maturity: postTaxMaturity,
          maturityLabel: 'Post-Tax Net Payout',
          investedLabel: 'Principal Fixed Deposit',
          returnsLabel: 'Net Post-Tax Interest',
          breakdown: [
            { name: 'Principal Amount', value: Math.round(p) },
            { name: 'Net Post-Tax Return', value: Math.round(grossInterest - taxPaid) },
            { name: 'TDS Tax Liability', value: Math.round(taxPaid) }
          ]
        };
      }
      case 'rd': {
        const p = inputs.monthlyDeposit || 0;
        const r = (inputs.rate || 0) / 100;
        const nYears = inputs.tenureYears || 0;
        const totalMonths = nYears * 12;
        let maturity = 0;
        for (let m = 1; m <= totalMonths; m++) {
          const remainingQuarters = (totalMonths - m + 1) / 3;
          maturity += p * Math.pow(1 + r / 4, remainingQuarters);
        }
        const totalInvested = p * totalMonths;
        return {
          invested: totalInvested,
          returns: maturity - totalInvested,
          maturity,
          maturityLabel: 'Maturity Payout',
          investedLabel: 'Total Deposited Installments',
          returnsLabel: 'Quarterly Compounded Interest',
          breakdown: [
            { name: 'Total Deposits', value: Math.round(totalInvested) },
            { name: 'Compounded Returns', value: Math.round(maturity - totalInvested) }
          ]
        };
      }
      case 'nsc': {
        const p = inputs.principal || 0;
        const r = (inputs.rate || 7.7) / 100;
        const n = inputs.tenureYears || 5;
        const maturity = p * Math.pow(1 + r, n);
        return {
          invested: p,
          returns: maturity - p,
          maturity,
          maturityLabel: 'Guaranteed Maturity (5 Yrs)',
          investedLabel: 'Certificate Purchase Amount',
          returnsLabel: 'Sovereign Accrued Interest',
          breakdown: [
            { name: 'NSC Certificate Value', value: Math.round(p) },
            { name: 'Guaranteed Interest', value: Math.round(maturity - p) }
          ]
        };
      }
      case 'kvp': {
        const p = inputs.principal || 0;
        const r = (inputs.rate || 7.5) / 100;
        const maturity = p * 2;
        const monthsToDouble = Math.round((Math.log(2) / Math.log(1 + r)) * 12);
        return {
          invested: p,
          returns: p,
          maturity,
          maturityLabel: `Matures in ~${monthsToDouble} Mo (Doubled)`,
          investedLabel: 'Deposit Principal',
          returnsLabel: '100% Guaranteed Return',
          breakdown: [
            { name: 'Deposit Principal', value: Math.round(p) },
            { name: 'Doubled Growth Gain', value: Math.round(p) }
          ]
        };
      }
      case 'nps': {
        const monthly = inputs.monthlyInv || 0;
        const curAge = inputs.currentAge || 30;
        const retAge = inputs.retirementAge || 60;
        const r = (inputs.expectedReturn || 10) / 100 / 12;
        const annuityPct = (inputs.annuityPct || 40) / 100;
        const annuityRate = (inputs.annuityRate || 6) / 100 / 12;

        const months = Math.max(12, (retAge - curAge) * 12);
        const corpus = monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
        const invested = monthly * months;
        const annuityCorpus = corpus * annuityPct;
        const lumpSum = corpus * (1 - annuityPct);
        const monthlyPension = annuityCorpus * annuityRate;

        return {
          invested,
          returns: corpus - invested,
          maturity: corpus,
          maturityLabel: `Pension: ${formatINR(Math.round(monthlyPension))}/mo`,
          investedLabel: 'Total NPS Contributions',
          returnsLabel: `Lumpsum (${((1 - annuityPct) * 100).toFixed(0)}%)`,
          breakdown: [
            { name: 'Tax-Free Lumpsum', value: Math.round(lumpSum) },
            { name: 'Annuity Corpus (Pension)', value: Math.round(annuityCorpus) }
          ]
        };
      }
      case 'epf': {
        const basicSalary = inputs.monthlySalary || 0;
        const curAge = inputs.currentAge || 30;
        const retAge = inputs.retirementAge || 58;
        const annualHike = (inputs.annualSalaryHike || 0) / 100;
        const epfRate = (inputs.epfRate || 8.25) / 100;

        let totalEmployee = 0;
        let totalEmployer = 0;
        let epfBalance = 0;
        let currentSalary = basicSalary;
        const years = Math.max(1, retAge - curAge);

        for (let y = 0; y < years; y++) {
          const employeeContributionYear = (currentSalary * 0.12) * 12;
          const employerEpfYear = (currentSalary * 0.0367) * 12;
          totalEmployee += employeeContributionYear;
          totalEmployer += employerEpfYear;
          epfBalance = (epfBalance + employeeContributionYear + employerEpfYear) * (1 + epfRate);
          currentSalary *= (1 + annualHike);
        }
        const totalDeposited = totalEmployee + totalEmployer;
        return {
          invested: totalDeposited,
          returns: epfBalance - totalDeposited,
          maturity: epfBalance,
          maturityLabel: 'EPF Superannuation Corpus',
          investedLabel: 'Employee + Employer Share',
          returnsLabel: 'Statutory 8.25% Compounded Interest',
          breakdown: [
            { name: 'Employee Contribution', value: Math.round(totalEmployee) },
            { name: 'Employer EPF Contribution', value: Math.round(totalEmployer) },
            { name: 'Compounded EPF Interest', value: Math.round(epfBalance - totalDeposited) }
          ]
        };
      }
      case 'scss': {
        const deposit = inputs.deposit || 0;
        const r = (inputs.rate || 8.2) / 100;
        const tenure = inputs.tenureYears || 5;
        const quarterlyInterest = (deposit * r) / 4;
        const totalInterest = quarterlyInterest * (tenure * 4);
        return {
          invested: deposit,
          returns: totalInterest,
          maturity: deposit + totalInterest,
          maturityLabel: `Quarterly Payout: ${formatINR(Math.round(quarterlyInterest))}`,
          investedLabel: 'SCSS Lock-in Principal',
          returnsLabel: 'Total Guaranteed Interest',
          breakdown: [
            { name: 'Deposit Capital', value: Math.round(deposit) },
            { name: 'Total 5-Yr Interest Payout', value: Math.round(totalInterest) }
          ]
        };
      }
      case 'tax-fd': {
        const principal = inputs.principal || 0;
        const rate = (inputs.rate || 7.1) / 100;
        const taxRate = (inputs.taxBracket || 30) / 100;
        const tenureYears = 5;
        const grossMaturity = principal * Math.pow(1 + rate / 4, 4 * tenureYears);
        const grossInterest = grossMaturity - principal;
        const taxDeducted = grossInterest * taxRate;
        const netReturns = grossInterest - taxDeducted;
        const netMaturity = principal + netReturns;
        return {
          invested: principal,
          returns: netReturns,
          maturity: netMaturity,
          maturityLabel: 'Post-Tax Net Maturity',
          investedLabel: '80C Deductible Principal',
          returnsLabel: 'Net Post-Tax Interest',
          breakdown: [
            { name: 'Principal Invested', value: Math.round(principal) },
            { name: 'Net Post-Tax Return', value: Math.round(netReturns) },
            { name: 'Tax Liability (TDS)', value: Math.round(taxDeducted) }
          ]
        };
      }
      case 'ssy': {
        const yearly = inputs.yearlyInv || 0;
        const r = (inputs.rate || 8.2) / 100;
        const childAge = inputs.childAge ?? 0;
        const tenureYears = Math.max(15, 21 - childAge);
        let balance = 0;
        let totalInvested = 0;
        for (let y = 1; y <= tenureYears; y++) {
          if (y <= 15) {
            totalInvested += yearly;
            balance += yearly;
          }
          balance *= (1 + r);
        }
        return {
          invested: totalInvested,
          returns: balance - totalInvested,
          maturity: balance,
          maturityLabel: `Maturity Corpus (at ${tenureYears} Yrs)`,
          investedLabel: '15-Year Deposits',
          returnsLabel: 'Tax-Free SSY Growth',
          breakdown: [
            { name: 'Total Deposits (15 Yrs)', value: Math.round(totalInvested) },
            { name: 'Tax-Free Wealth Gain', value: Math.round(balance - totalInvested) }
          ]
        };
      }
      case 'inflation': {
        const cost = inputs.currentCost || 0;
        const r = (inputs.inflationRate || 6) / 100;
        const years = inputs.yearsInFuture || 10;
        const futureCost = cost * Math.pow(1 + r, years);
        return {
          invested: cost,
          returns: futureCost - cost,
          maturity: futureCost,
          maturityLabel: 'Future Escalated Cost',
          investedLabel: 'Current Purchase Price',
          returnsLabel: 'Inflation Surcharge Impact',
          breakdown: [
            { name: 'Base Cost Today', value: Math.round(cost) },
            { name: 'Inflation Erosion Cost', value: Math.round(futureCost - cost) }
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
          maturityLabel: `Needs (50%): ${formatINR(Math.round(needs))}`,
          investedLabel: 'Savings / SIP (20%)',
          returnsLabel: 'Wants & Discretionary (30%)',
          breakdown: [
            { name: 'Needs (50%)', value: Math.round(needs) },
            { name: 'Wants (30%)', value: Math.round(wants) },
            { name: 'Savings & SIP (20%)', value: Math.round(savings) }
          ]
        };
      }
      case 'emergency-fund': {
        const expense = inputs.monthlyEssentialExpense || 0;
        const emi = inputs.monthlyEmiObligations || 0;
        const months = inputs.targetMonths || 6;
        const totalMonthlyBurn = expense + emi;
        const target = totalMonthlyBurn * months;
        return {
          invested: totalMonthlyBurn,
          returns: months,
          maturity: target,
          maturityLabel: 'Emergency Reserve Required',
          investedLabel: 'Monthly Total Burn (Living + EMI)',
          returnsLabel: 'Runway Duration (Months)',
          breakdown: [
            { name: 'Monthly Burn Rate', value: totalMonthlyBurn },
            { name: 'Emergency Cushion Target', value: target }
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
          maturityLabel: 'Years Required to Double',
          investedLabel: 'Annual Return Rate',
          returnsLabel: 'Years to Triple Wealth',
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
  const COLORS = ['#3B82F6', '#10B981', '#7C3AED', '#F59E0B'];

  const categories: { id: CalculatorCategory; label: string }[] = [
    { id: 'INVESTMENT', label: 'Investment & SIP' },
    { id: 'SAVINGS_DEPOSIT', label: 'Savings & Deposits' },
    { id: 'RETIREMENT', label: 'Retirement & Pension' },
    { id: 'TAX_SAVING', label: 'Tax-Saving & Sovereign' },
    { id: 'FINANCIAL_PLANNING', label: 'Financial Planning & EMI' }
  ];

  const filteredCatalog = calculatorsCatalog.filter(c => c.category === selectedCategory);

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Category Tabs Bar (Divider line removed) */}
      <div className="sticky top-0 z-20 bg-[#F8FAFC]/95 dark:bg-[#0F172A]/95 backdrop-blur-md pt-1 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                const firstInCat = calculatorsCatalog.find(c => c.category === cat.id);
                if (firstInCat) handleSelectCalculator(firstInCat.id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/25'
                  : 'bg-white dark:bg-[#1E293B] text-black dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white border border-[#E2E8F0] dark:border-[#334155]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Calculator Switcher List (Compact & neat) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-2.5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
              Calculators
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] font-bold">
              {filteredCatalog.length}
            </span>
          </div>
          <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5">
            {filteredCatalog.map(calc => {
              const isSelected = calc.id === selectedCalcId;
              return (
                <button
                  key={calc.id}
                  onClick={() => handleSelectCalculator(calc.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#3B82F6] text-white shadow-xs font-semibold'
                      : 'text-slate-700 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#273549] hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  <div className="truncate">
                    <span className="block truncate font-medium">{calc.name}</span>
                  </div>
                  {isSelected && <Check size={14} className="shrink-0 text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Calculator Form & Real-time Graphical Breakdown */}
        <div className="lg:col-span-9 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#E2E8F0] dark:border-[#334155] pb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] font-bold uppercase tracking-wider">
                  Verified Engine
                </span>
                <span className="text-xs text-black dark:text-[#94A3B8]">Compound Mathematical Modeling</span>
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-white leading-tight">{currentCalc.name}</h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5 max-w-xl line-clamp-1">{currentCalc.description}</p>
            </div>
            <button
              onClick={() => setInputs(currentCalc.defaultInputs)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#273549] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] border border-[#E2E8F0] dark:border-[#334155] text-black dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white text-xs font-medium transition cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left: Input Sliders & Clean Controls (7 Cols on wide screens) */}
            <div className="xl:col-span-7 space-y-2.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider block">
                Adjust Variables
              </span>
              <div className="space-y-2">
                {Object.entries(inputs).map(([key, val]) => {
                  const meta = currentCalc.meta?.[key] || {
                    min: 1,
                    max: 100000,
                    step: 500,
                    unit: 'INR',
                    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    description: ''
                  };

                  return (
                    <div
                      key={key}
                      className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#3B82F6]/40 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="pr-2 truncate">
                          <span className="text-[#0F172A] dark:text-white font-semibold block truncate">
                            {meta.label}
                          </span>
                          {meta.description && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                              {meta.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={meta.min}
                            max={meta.max}
                            step={meta.step}
                            value={val}
                            onChange={e => handleInputChange(key, Number(e.target.value))}
                            className="w-24 bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] focus:border-[#3B82F6] text-[#0F172A] dark:text-white text-xs font-semibold rounded-lg px-2 py-0.5 font-tabular text-right shadow-xs outline-none"
                          />
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 w-8 text-left">
                            {meta.unit === 'PCT' ? '%' : meta.unit === 'YEARS' ? 'Yrs' : meta.unit === 'MONTHS' ? 'Mo' : meta.unit === 'AGE' ? 'Yrs' : '₹'}
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={meta.min}
                        max={meta.max}
                        step={meta.step}
                        value={val}
                        onChange={e => handleInputChange(key, Number(e.target.value))}
                        className="w-full accent-[#3B82F6] cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Modern Compact Metric & Chart Deck (5 Cols) */}
            <div className="xl:col-span-5 space-y-3">
              {/* Maturity Headline Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-[#3B82F6]/30 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] uppercase tracking-wider">
                    {(results as any).maturityLabel || 'Estimated Corpus'}
                  </span>
                  {(results as any).profitMultiplier && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                      {(results as any).profitMultiplier}x Multiplier
                    </span>
                  )}
                </div>

                <div className="text-2xl font-extrabold text-[#0F172A] dark:text-white font-tabular tracking-tight">
                  {currentCalc.id === 'rule72'
                    ? `${results.maturity.toFixed(1)} Years`
                    : formatINR(results.maturity)}
                </div>

                {/* Grid of Invested vs Returns */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-500/15 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                      {(results as any).investedLabel || 'Capital Invested'}
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-white font-tabular text-xs mt-0.5 block">
                      {currentCalc.id === 'rule72' ? `${inputs.annualRate}% Rate` : formatINR(results.invested)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                      {(results as any).returnsLabel || 'Compounded Profit'}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-tabular text-xs mt-0.5 block">
                      {currentCalc.id === 'rule72' ? `${results.returns.toFixed(1)} Yrs to Triple` : formatINR(results.returns)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real World Projections (Inflation & Tax) */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] space-y-2 text-xs">
                {(results as any).realPurchasingPower !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Flame size={13} className="text-amber-500" /> Real Purchasing Power:
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 font-tabular text-xs">
                      {formatINR((results as any).realPurchasingPower)}
                    </span>
                  </div>
                )}
                {(results as any).postTaxMaturity !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-blue-500" /> Post-Tax In-Hand:
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-white font-tabular text-xs">
                      {formatINR((results as any).postTaxMaturity)}
                    </span>
                  </div>
                )}
                {(results as any).taxDeduction !== undefined && (results as any).taxDeduction > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-500">Tax Liability (LTCG):</span>
                    <span className="font-semibold text-rose-500 font-tabular">
                      {formatINR((results as any).taxDeduction)}
                    </span>
                  </div>
                )}
              </div>

              {/* Compact Pie Chart Visualization */}
              {results.breakdown && results.breakdown.length > 0 && (
                <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <span>Portfolio Split</span>
                    <span>100% Capital Breakdown</span>
                  </div>
                  <div className="h-32 w-full min-w-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={128} minWidth={0}>
                      <PieChart>
                        <Pie
                          data={results.breakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={56}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {results.breakdown.map((_, index) => (
                            <Cell key={`cell-calc-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '10px', color: '#FFF' }}
                          formatter={(val: any) => [formatINR(Number(val)), 'Amount']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                    {results.breakdown.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span>{item.name}: <strong className="text-[#0F172A] dark:text-white font-tabular">{formatCompactINR(item.value)}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
