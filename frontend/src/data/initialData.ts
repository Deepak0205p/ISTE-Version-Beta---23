import {
  FamilyWorkspace,
  UserProfile,
  BankAccount,
  ExpenseRecord,
  HabitualExpense,
  MedicalExpenseRecord,
  StudentProfile,
  EducationExpenseRecord,
  LoanRecord,
  InvestmentAsset,
  FinancialGoal,
  TransactionRecord
} from '../types';

export const initialFamily: FamilyWorkspace = {
  id: 'fam_default',
  name: 'My Workspace',
  members: [
    {
      id: 'usr_me',
      name: 'Primary Account',
      email: 'user@example.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      role: 'ADMIN',
      familyId: 'fam_default'
    }
  ]
};

// Initial standard accounts
export const initialBankAccounts: BankAccount[] = [
  {
    id: 'bank-hdfc-01',
    bankName: 'HDFC Bank',
    nickname: 'Primary Salary & Operating',
    accountType: 'Salary',
    maskedAccountNumber: '•••• 4829',
    openingBalance: 145000,
    currentBalance: 248600,
    ownerId: 'usr_me',
    ownerName: 'Primary Account',
    status: 'ACTIVE',
    color: '#3B82F6'
  },
  {
    id: 'bank-sbi-02',
    bankName: 'State Bank of India',
    nickname: 'Emergency & Fixed Reserve',
    accountType: 'Savings',
    maskedAccountNumber: '•••• 9104',
    openingBalance: 120000,
    currentBalance: 185400,
    ownerId: 'usr_me',
    ownerName: 'Primary Account',
    status: 'ACTIVE',
    color: '#10B981'
  },
  {
    id: 'bank-icici-03',
    bankName: 'ICICI Bank',
    nickname: 'Discretionary & Digital Spends',
    accountType: 'Savings',
    maskedAccountNumber: '•••• 6312',
    openingBalance: 40000,
    currentBalance: 52300,
    ownerId: 'usr_me',
    ownerName: 'Primary Account',
    status: 'ACTIVE',
    color: '#F59E0B'
  }
];

export const initialTransactions: TransactionRecord[] = [
  {
    id: 'tx-seed-101',
    date: '2026-10-30',
    description: 'Swiggy Food Delivery - Gourmet Feast',
    amount: 840,
    type: 'DEBIT',
    category: 'Grocery & Food',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'UPI',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-102',
    date: '2026-10-28',
    description: 'Zepto Quick Commerce Groceries',
    amount: 1420,
    type: 'DEBIT',
    category: 'Grocery & Food',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'UPI',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-103',
    date: '2026-10-27',
    description: 'Monthly Salary Credit - Tech Corp India',
    amount: 165000,
    type: 'CREDIT',
    category: 'Household',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-104',
    date: '2026-10-25',
    description: 'HDFC Home Loan Auto-Debit EMI',
    amount: 38750,
    type: 'DEBIT',
    category: 'Loan Repayments / EMI',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'Direct Debit',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-105',
    date: '2026-10-22',
    description: 'Tata Power Electricity Bill',
    amount: 3450,
    type: 'DEBIT',
    category: 'Electricity & Utilities',
    bankAccountId: 'bank-sbi-02',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-106',
    date: '2026-10-20',
    description: 'Transfer to Emergency Reserve SBI',
    amount: 30000,
    type: 'DEBIT',
    category: 'Household',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED',
    isInternalTransfer: true
  },
  {
    id: 'tx-seed-107',
    date: '2026-10-20',
    description: 'Funds Inward from HDFC Salary A/c',
    amount: 30000,
    type: 'CREDIT',
    category: 'Household',
    bankAccountId: 'bank-sbi-02',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED',
    isInternalTransfer: true
  },
  {
    id: 'tx-seed-108',
    date: '2026-10-18',
    description: 'Apollo Pharmacy Medicines',
    amount: 1850,
    type: 'DEBIT',
    category: 'Medical & Health',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'UPI',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-109',
    date: '2026-10-15',
    description: 'DPS R.K. Puram Term 2 Tuition',
    amount: 45000,
    type: 'DEBIT',
    category: 'Education',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-110',
    date: '2026-10-12',
    description: 'Netflix India Subscription',
    amount: 649,
    type: 'DEBIT',
    category: 'Subscriptions',
    bankAccountId: 'bank-icici-03',
    paymentMethod: 'Card',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-111',
    date: '2026-10-10',
    description: 'SBI Vehicle Loan EMI Auto-Debit',
    amount: 24780,
    type: 'DEBIT',
    category: 'Loan Repayments / EMI',
    bankAccountId: 'bank-sbi-02',
    paymentMethod: 'Direct Debit',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-112',
    date: '2026-10-05',
    description: 'Indian Oil Fuel Refill',
    amount: 3200,
    type: 'DEBIT',
    category: 'Transportation & Fuel',
    bankAccountId: 'bank-icici-03',
    paymentMethod: 'Card',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-113',
    date: '2026-09-27',
    description: 'Monthly Salary Credit - Tech Corp India',
    amount: 165000,
    type: 'CREDIT',
    category: 'Household',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-114',
    date: '2026-09-25',
    description: 'HDFC Home Loan Auto-Debit EMI',
    amount: 38750,
    type: 'DEBIT',
    category: 'Loan Repayments / EMI',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'Direct Debit',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-115',
    date: '2026-08-27',
    description: 'Monthly Salary Credit - Tech Corp India',
    amount: 165000,
    type: 'CREDIT',
    category: 'Household',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'tx-seed-116',
    date: '2026-07-27',
    description: 'Monthly Salary Credit - Tech Corp India',
    amount: 165000,
    type: 'CREDIT',
    category: 'Household',
    bankAccountId: 'bank-hdfc-01',
    paymentMethod: 'NetBanking',
    associatedUserId: 'usr_me',
    source: 'STATEMENT_IMPORT',
    verificationStatus: 'VERIFIED'
  }
];

export const initialExpenses: ExpenseRecord[] = initialTransactions
  .filter(t => t.type === 'DEBIT' && !t.isInternalTransfer)
  .map(t => ({
    id: `exp-${t.id}`,
    amount: t.amount,
    date: t.date,
    category: t.category,
    paymentMethod: t.paymentMethod,
    bankAccountId: t.bankAccountId,
    description: t.description,
    familyMemberId: 'usr_me',
    familyMemberName: 'Primary Account',
    isRecurring: ['Subscriptions', 'Loan Repayments / EMI'].includes(t.category),
    status: 'ACTUAL'
  }));

export const initialHabitualExpenses: HabitualExpense[] = [];
export const initialMedicalExpenses: MedicalExpenseRecord[] = [];
export const initialStudents: StudentProfile[] = [
  {
    id: 'stu-default-1',
    studentName: 'Aarav Sharma',
    institution: 'Delhi Public School (DPS R.K. Puram)',
    gradeLevel: 'Grade 11 - Science',
    annualBudget: 240000
  }
];
export const initialEducationExpenses: EducationExpenseRecord[] = [
  {
    id: 'edu-seed-1',
    studentId: 'stu-default-1',
    studentName: 'Aarav Sharma',
    date: '2026-10-15',
    type: 'School / College Tuition',
    amount: 45000,
    academicYear: '2026-2027',
    receiptNumber: 'REC-DPS-2026-904'
  },
  {
    id: 'edu-seed-2',
    studentId: 'stu-default-1',
    studentName: 'Aarav Sharma',
    date: '2026-09-10',
    type: 'Coaching & Tutors',
    amount: 18500,
    academicYear: '2026-2027',
    receiptNumber: 'REC-ALLEN-782'
  }
];
export const initialLoans: LoanRecord[] = [
  {
    id: 'loan-seed-1',
    name: 'Primary Home Loan',
    type: 'Home Loan',
    lender: 'HDFC Bank Ltd.',
    originalAmount: 4500000,
    outstandingPrincipal: 3820000,
    interestRate: 8.4,
    interestType: 'REDUCING',
    startDate: '2023-04-10',
    tenureMonths: 240,
    remainingTenureMonths: 198,
    emiAmount: 38750,
    emiDueDate: 5,
    totalInterestPaid: 420000,
    totalPrepaid: 250000
  },
  {
    id: 'loan-seed-2',
    name: 'Electric Vehicle Loan',
    type: 'Vehicle Loan',
    lender: 'State Bank of India (SBI)',
    originalAmount: 1200000,
    outstandingPrincipal: 680000,
    interestRate: 8.75,
    interestType: 'REDUCING',
    startDate: '2024-06-15',
    tenureMonths: 60,
    remainingTenureMonths: 32,
    emiAmount: 24780,
    emiDueDate: 10,
    totalInterestPaid: 85000,
    totalPrepaid: 100000
  }
];
export const initialInvestments: InvestmentAsset[] = [
  {
    id: 'inv-seed-1',
    name: 'Parag Parikh Flexi Cap Fund - Direct Growth',
    category: 'Mutual Funds (Equity)',
    investedPrincipal: 450000,
    currentValuation: 648000,
    investmentDate: '2023-01-15',
    cagrOrXirr: 18.2,
    isLiveMarketSync: true,
    ownerId: 'usr-default-1'
  },
  {
    id: 'inv-seed-2',
    name: 'Mirae Asset Large Cap Fund - Direct',
    category: 'Mutual Funds (Equity)',
    investedPrincipal: 300000,
    currentValuation: 396000,
    investmentDate: '2023-05-10',
    cagrOrXirr: 15.4,
    isLiveMarketSync: true,
    ownerId: 'usr-default-1'
  },
  {
    id: 'inv-seed-3',
    name: 'SBI Sovereign Gold Bond 2028',
    category: 'Sovereign Gold Bonds',
    investedPrincipal: 250000,
    currentValuation: 335000,
    investmentDate: '2022-11-20',
    cagrOrXirr: 12.8,
    isLiveMarketSync: false,
    ownerId: 'usr-default-1'
  },
  {
    id: 'inv-seed-4',
    name: 'Public Provident Fund (PPF - SBI)',
    category: 'PPF / EPF',
    investedPrincipal: 350000,
    currentValuation: 412000,
    investmentDate: '2021-04-05',
    cagrOrXirr: 7.1,
    isLiveMarketSync: false,
    ownerId: 'usr-default-1'
  }
];

export const initialGoals: FinancialGoal[] = [
  {
    id: 'goal-seed-1',
    title: 'Emergency Cushion Reserve (6 Months)',
    category: 'Emergency Fund',
    targetAmount: 600000,
    currentAmount: 420000,
    targetDate: '2027-03-31',
    monthlyContribution: 25000,
    status: 'ON_TRACK',
    notes: 'Liquid fixed deposit & arbitrage funds for household safety runway'
  },
  {
    id: 'goal-seed-2',
    title: 'Higher Education & STEM College Fund',
    category: 'Education Fund',
    targetAmount: 2500000,
    currentAmount: 950000,
    targetDate: '2029-06-30',
    monthlyContribution: 30000,
    status: 'ON_TRACK',
    notes: 'Long-term diversified equity index portfolio for degree tuition'
  },
  {
    id: 'goal-seed-3',
    title: 'Electric Vehicle (EV) Upgrade Down Payment',
    category: 'Vehicle',
    targetAmount: 800000,
    currentAmount: 320000,
    targetDate: '2028-02-28',
    monthlyContribution: 18000,
    status: 'ON_TRACK',
    notes: 'Short-term debt fund allocation for upfront vehicle down payment'
  }
];
