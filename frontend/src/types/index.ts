export type NavigationTab = 
  | 'overview'
  | 'money-management'
  | 'banking'
  | 'goals-investments'
  | 'affordability'
  | 'calculators'
  | 'advisor'
  | 'reports';

export type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER' | 'CUSTOM';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  familyId: string;
}

export interface FamilyWorkspace {
  id: string;
  name: string;
  members: UserProfile[];
}

export type RecordStatus = 'ACTUAL' | 'PLANNED' | 'PREDICTED';

export type ExpenseCategory = 
  | 'Household'
  | 'Rent & Housing'
  | 'Electricity & Utilities'
  | 'Grocery & Food'
  | 'Transportation & Fuel'
  | 'Medical & Health'
  | 'Education'
  | 'Loan Repayments / EMI'
  | 'Insurance'
  | 'Shopping'
  | 'Entertainment'
  | 'Subscriptions'
  | 'Investment Transfer'
  | 'Miscellaneous';

export interface ExpenseRecord {
  id: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  subcategory?: string;
  paymentMethod: string;
  bankAccountId?: string;
  description: string;
  familyMemberId: string;
  familyMemberName: string;
  isRecurring: boolean;
  status: RecordStatus;
  receiptName?: string;
}

export interface HabitualExpense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly';
  expectedDayOfMonth: number;
  lastPaymentDate: string;
  nextPaymentDate: string;
  historicalChange: number; // percentage change vs average
  confidenceScore: number; // 0-100%
  status: 'CONFIRMED' | 'DETECTED' | 'DISMISSED';
  bankAccountId: string;
}

export interface MedicalExpenseRecord {
  id: string;
  patientName: string;
  date: string;
  type: 'Hospitalization' | 'Doctor Consultation' | 'Pharmacy / Medicines' | 'Diagnostics & Tests' | 'Health Insurance';
  amount: number;
  insuranceClaimStatus: 'NOT_APPLIED' | 'FILED' | 'APPROVED' | 'REIMBURSED' | 'REJECTED';
  claimedAmount?: number;
  reimbursedAmount?: number;
  doctorHospital: string;
  notes?: string;
}

export interface StudentProfile {
  id: string;
  studentName: string;
  institution: string;
  gradeLevel: string; // e.g. "Grade 10", "B.Tech Year 3"
  annualBudget: number;
}

export interface EducationExpenseRecord {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  type: 'School / College Tuition' | 'Semester Fees' | 'Coaching & Tutors' | 'Books & Stationery' | 'Hostel & Mess' | 'Transportation' | 'Exam Fees';
  amount: number;
  academicYear: string;
  receiptNumber?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  nickname: string;
  accountType: 'Savings' | 'Current' | 'Salary' | 'Credit Card' | 'Overdraft';
  maskedAccountNumber: string; // e.g. "•••• 4829"
  openingBalance: number;
  currentBalance: number;
  ownerId: string;
  ownerName: string;
  status: 'ACTIVE' | 'DORMANT' | 'FROZEN';
  color: string;
}

export interface TransactionRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category: ExpenseCategory;
  bankAccountId: string;
  paymentMethod: 'UPI' | 'NetBanking' | 'Card' | 'Cheque' | 'Cash' | 'Direct Debit';
  associatedUserId: string;
  source: 'MANUAL' | 'STATEMENT_IMPORT' | 'SYSTEM_RECURRING';
  verificationStatus: 'VERIFIED' | 'PENDING_REVIEW' | 'AUTO_CONFIRMED';
  isInternalTransfer?: boolean;
  notes?: string;
}

export interface LoanRecord {
  id: string;
  name: string;
  type: 'Home Loan' | 'Education Loan' | 'Personal Loan' | 'Vehicle Loan' | 'Gold Loan';
  lender: string;
  originalAmount: number;
  outstandingPrincipal: number;
  interestRate: number; // percentage
  interestType: 'REDUCING' | 'FLAT';
  startDate: string;
  tenureMonths: number;
  remainingTenureMonths: number;
  emiAmount: number;
  emiDueDate: number; // Day of month 1-31
  totalInterestPaid: number;
  totalPrepaid: number;
}

export interface InvestmentAsset {
  id: string;
  name: string;
  category: 'Mutual Funds' | 'Direct Equity' | 'Fixed Deposit' | 'PPF' | 'NPS' | 'Gold / SGB' | 'Real Estate';
  investedPrincipal: number;
  currentValuation: number;
  investmentDate: string;
  expectedMaturityDate?: string;
  cagrOrXirr?: number;
  isLiveMarketSync: boolean;
  ownerId: string;
}

export interface FinancialGoal {
  id: string;
  title: string;
  category: 'Emergency Fund' | 'Education Fund' | 'Vehicle' | 'Dream Home' | 'Vacation & Travel' | 'Retirement / FI';
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  monthlyContribution: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'COMPLETED';
  notes?: string;
}

export interface AdvisorInsight {
  id: string;
  type: 'ALERT' | 'OPPORTUNITY' | 'HABITUAL_SAVING' | 'GOAL_STATUS' | 'COMPLIANCE';
  title: string;
  description: string;
  metricBacking: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  actionableStep?: string;
  category: string;
}

export interface CalculatorSavedPreset {
  id: string;
  calculatorId: string;
  title: string;
  dateSaved: string;
  inputs: Record<string, any>;
  results: Record<string, any>;
}
