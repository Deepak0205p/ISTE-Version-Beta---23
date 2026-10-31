import React, { useState } from 'react';
import { useFinancial } from '../context/FinancialContext';
import { formatINR, formatDate, formatCompactINR } from '../utils/currency';
import { ExpenseCategory, ExpenseRecord } from '../types';
import {
  Wallet,
  Sparkles,
  HeartPulse,
  GraduationCap,
  Layers,
  Landmark,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Calendar,
  Trash2,
  Edit2,
  FileText,
  DollarSign
} from 'lucide-react';

import { detectExpenseAnomalies, AnomalyReport } from '../utils/anomalyEngine';

const expenseCategories: ExpenseCategory[] = [
  'Household',
  'Rent & Housing',
  'Electricity & Utilities',
  'Grocery & Food',
  'Transportation & Fuel',
  'Medical & Health',
  'Education',
  'Loan Repayments / EMI',
  'Insurance',
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Miscellaneous'
];

export const MoneyManagementModule: React.FC = () => {
  const {
    activeSubmodule,
    setActiveSubmodule,
    expenses,
    addExpense,
    updateExpense,
    propagateCategoryOverride,
    undoCategoryPropagation,
    deleteExpense,
    habitualExpenses,
    updateHabitualStatus,
    addHabitualExpense,
    deleteHabitualExpense,
    medicalExpenses,
    addMedicalExpense,
    deleteMedicalExpense,
    updateMedicalExpense,
    students,
    addStudent,
    educationExpenses,
    addEducationExpense,
    deleteEducationExpense,
    loans,
    addLoan,
    deleteLoan,
    recordLoanPrepayment,
    bankAccounts,
    currentUser,
    family
  } = useFinancial();

  // Propagation Toast State
  const [propagationToast, setPropagationToast] = useState<{
    message: string;
    previousSnapshot: ExpenseRecord[] | null;
  } | null>(null);

  // MAD & Rule-based Anomaly detection
  const anomalies: AnomalyReport[] = detectExpenseAnomalies(expenses);
  const [dismissedAnomalyIds, setDismissedAnomalyIds] = useState<string[]>([]);
  const activeAnomalies = anomalies.filter(a => !dismissedAnomalyIds.includes(a.recordId));

  // Search & Filter state for Expense Manager
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  // Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddMedicalModal, setShowAddMedicalModal] = useState(false);
  const [showAddEducationModal, setShowAddEducationModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null);
  const [prepayAmount, setPrepayAmount] = useState<number>(50000);

  // New Habitual Commitment Form State
  const [newHabit, setNewHabit] = useState<{
    title: string;
    category: ExpenseCategory;
    amount: number;
    frequency: 'Monthly' | 'Quarterly' | 'Yearly';
    expectedDayOfMonth: number;
  }>({
    title: '',
    category: 'Subscriptions',
    amount: 1499,
    frequency: 'Monthly',
    expectedDayOfMonth: 5
  });

  // New Medical Incident Form State
  const [newMedical, setNewMedical] = useState<{
    patientName: string;
    date: string;
    type: 'Hospitalization' | 'Doctor Consultation' | 'Pharmacy / Medicines' | 'Diagnostics & Tests' | 'Health Insurance';
    amount: number;
    insuranceClaimStatus: 'NOT_APPLIED' | 'FILED' | 'APPROVED' | 'REIMBURSED' | 'REJECTED';
    claimedAmount: number;
    reimbursedAmount: number;
    doctorHospital: string;
    notes: string;
  }>({
    patientName: currentUser.name || 'Self',
    date: new Date().toISOString().split('T')[0],
    type: 'Doctor Consultation',
    amount: 0,
    insuranceClaimStatus: 'NOT_APPLIED',
    claimedAmount: 0,
    reimbursedAmount: 0,
    doctorHospital: '',
    notes: ''
  });

  // New Student Profile State
  const [newStudent, setNewStudent] = useState<{
    studentName: string;
    institution: string;
    gradeLevel: string;
    annualBudget: number;
  }>({
    studentName: '',
    institution: '',
    gradeLevel: 'Grade 10',
    annualBudget: 150000
  });

  // New Education Expense Form State
  const [newEducation, setNewEducation] = useState<{
    studentId: string;
    type: 'School / College Tuition' | 'Semester Fees' | 'Coaching & Tutors' | 'Books & Stationery' | 'Hostel & Mess' | 'Transportation' | 'Exam Fees';
    amount: number;
    academicYear: string;
    receiptNumber: string;
    date: string;
  }>({
    studentId: students[0]?.id || '',
    type: 'School / College Tuition',
    amount: 0,
    academicYear: '2026-2027',
    receiptNumber: '',
    date: new Date().toISOString().split('T')[0]
  });

  // New Loan Form State
  const [newLoan, setNewLoan] = useState<{
    name: string;
    type: 'Home Loan' | 'Education Loan' | 'Personal Loan' | 'Vehicle Loan' | 'Gold Loan';
    lender: string;
    originalAmount: number;
    outstandingPrincipal: number;
    interestRate: number;
    interestType: 'REDUCING' | 'FLAT';
    startDate: string;
    tenureMonths: number;
    remainingTenureMonths: number;
    emiAmount: number;
    emiDueDate: number;
    totalInterestPaid: number;
    totalPrepaid: number;
  }>({
    name: '',
    type: 'Home Loan',
    lender: '',
    originalAmount: 2500000,
    outstandingPrincipal: 2500000,
    interestRate: 8.5,
    interestType: 'REDUCING',
    startDate: new Date().toISOString().split('T')[0],
    tenureMonths: 240,
    remainingTenureMonths: 240,
    emiAmount: 21700,
    emiDueDate: 5,
    totalInterestPaid: 0,
    totalPrepaid: 0
  });

  // New Expense Form State
  const [newExpense, setNewExpense] = useState<{
    amount: number;
    category: ExpenseCategory;
    subcategory: string;
    description: string;
    date: string;
    paymentMethod: string;
    bankAccountId: string;
    familyMemberId: string;
    isRecurring: boolean;
  }>({
    amount: 0,
    category: 'Grocery & Food',
    subcategory: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI',
    bankAccountId: bankAccounts[0]?.id || '',
    familyMemberId: currentUser.id,
    isRecurring: false
  });

  // Filtered Expenses
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || e.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const submodules = [
    { id: 'expense-manager', label: 'Expense Manager', icon: <Wallet size={16} /> },
    { id: 'anomalies', label: 'Explainable Anomalies', icon: <AlertCircle size={16} /> },
    { id: 'habitual-intelligence', label: 'Habitual Expense AI', icon: <Sparkles size={16} /> },
    { id: 'medical-fund', label: 'Medical Fund & Health', icon: <HeartPulse size={16} /> },
    { id: 'education-fund', label: 'Education Expenses', icon: <GraduationCap size={16} /> },
    { id: 'loans-emi', label: 'Loans & EMI Amortization', icon: <Landmark size={16} /> }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Submodule Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#334155]">
        {submodules.map(sub => {
          const isActive = activeSubmodule === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubmodule(sub.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20'
                  : 'bg-[#1E293B] text-black dark:text-[#94A3B8] hover:text-white hover:bg-[#273549] border border-[#334155]'
              }`}
            >
              {sub.icon}
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 1. EXPENSE MANAGER SUBMODULE */}
      {/* ======================================================== */}
      {activeSubmodule === 'expense-manager' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Family Expense Manager</h2>
              <p className="text-xs text-black dark:text-[#94A3B8]">
                Granular logging across 13 certified categories with receipt verification and member attribution.
              </p>
            </div>
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl shadow-lg shadow-[#3B82F6]/20 transition cursor-pointer"
            >
              <Plus size={16} /> Record Expense
            </button>
          </div>

          {/* Correction Propagation Toast */}
          {propagationToast && (
            <div className="p-3.5 bg-[#3B82F6]/15 border border-[#3B82F6] rounded-xl flex items-center justify-between animate-fadeIn text-xs">
              <span className="text-white font-medium flex items-center gap-2">
                <Sparkles size={15} className="text-[#3B82F6]" />
                {propagationToast.message}
              </span>
              <button
                onClick={() => {
                  if (propagationToast.previousSnapshot) {
                    undoCategoryPropagation(propagationToast.previousSnapshot);
                    setPropagationToast(null);
                  }
                }}
                className="px-3 py-1 bg-[#273549] hover:bg-[#334155] border border-[#334155] text-[#E2E8F0] font-bold rounded-lg transition"
              >
                Undo
              </button>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#1E293B] border border-[#334155] p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-3 text-black dark:text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search by description, merchant, tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#273549] border border-[#334155] text-white text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-[#273549] border border-[#334155] text-[#ECEAE6] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#3B82F6] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {expenseCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Expenses Table */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#273549] text-black dark:text-[#94A3B8] border-b border-[#334155] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Member</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {filteredExpenses.map(item => (
                    <tr key={item.id} className="hover:bg-[#273549]/50 transition-colors">
                      <td className="p-3.5 text-black dark:text-[#94A3B8] whitespace-nowrap">{formatDate(item.date)}</td>
                      <td className="p-3.5 font-medium text-white">
                        <div>{item.description}</div>
                        {item.subcategory && (
                          <span className="text-[10px] text-black dark:text-[#94A3B8]">{item.subcategory}</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <select
                          value={item.category}
                          onChange={e => {
                            const newCat = e.target.value as ExpenseCategory;
                            const snapshot = [...expenses];
                            const { updatedCount } = propagateCategoryOverride(item.description, newCat);
                            setPropagationToast({
                              message: `${updatedCount} similar transactions updated to "${newCat}"`,
                              previousSnapshot: snapshot
                            });
                          }}
                          className="bg-[#273549] border border-[#334155] text-[#3B82F6] font-medium text-[11px] rounded-lg px-2 py-1 cursor-pointer focus:outline-none"
                        >
                          {expenseCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5 text-black dark:text-[#94A3B8]">{item.familyMemberName}</td>
                      <td className="p-3.5 text-black dark:text-[#94A3B8]">{item.paymentMethod}</td>
                      <td className="p-3.5 text-right font-bold text-white font-tabular">
                        {formatINR(item.amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => deleteExpense(item.id)}
                          className="p-1.5 hover:bg-red-500/20 text-black dark:text-[#94A3B8] hover:text-red-400 rounded-lg transition"
                          title="Delete expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-black dark:text-[#94A3B8]">
                        No matching expenses recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EXPLAINABLE ANOMALIES SUBMODULE */}
      {/* ======================================================== */}
      {activeSubmodule === 'anomalies' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={18} className="text-[#3B82F6]" />
                <span className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider">
                  Flagged Transactions
                </span>
              </div>
              <h2 className="text-xl font-bold text-black dark:text-white">Explainable Anomalies & Outliers</h2>
              <p className="text-xs text-black dark:text-[#94A3B8] mt-1 max-w-xl">
                Transactions with unusual amounts, duplicate charges, or unexpected vendor activity needing your review.
              </p>
            </div>
            <div className="text-right bg-[#F8FAFC] dark:bg-[#1E293B] p-3 rounded-xl border border-[#CBD5E1] dark:border-[#334155]">
              <span className="text-[11px] text-black dark:text-[#94A3B8] block">Pending Review</span>
              <span className="text-xl font-bold text-[#3B82F6] font-tabular">{activeAnomalies.length} Items</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAnomalies.map(anomaly => {
              const badgeLabel =
                anomaly.flagType === 'LARGE_AMOUNT'
                  ? 'High Amount'
                  : anomaly.flagType === 'POSSIBLE_DUPLICATE'
                  ? 'Possible Duplicate'
                  : anomaly.flagType === 'NEW_HIGH_VALUE_MERCHANT'
                  ? 'New Merchant'
                  : 'Notice';

              return (
                <div
                  key={anomaly.recordId + anomaly.flagType}
                  className="bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] p-5 rounded-2xl space-y-3 hover:border-[#3B82F6]/50 transition shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] dark:text-[#60A5FA] font-bold uppercase border border-[#3B82F6]/20">
                        {badgeLabel}
                      </span>
                      <h3 className="text-sm font-bold text-black dark:text-white mt-1.5">{anomaly.description}</h3>
                      <p className="text-xs text-black dark:text-[#94A3B8]">{formatDate(anomaly.date)}</p>
                    </div>
                    <span className="text-base font-extrabold text-black dark:text-white font-tabular">{formatINR(anomaly.amount)}</span>
                  </div>

                  <p className="text-xs text-black dark:text-[#CBD5E1] bg-[#F8FAFC] dark:bg-[#1E293B] p-3 rounded-xl border border-[#CBD5E1] dark:border-[#334155] leading-relaxed">
                    {anomaly.reason}
                  </p>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      onClick={() => setDismissedAnomalyIds(prev => [...prev, anomaly.recordId])}
                      className="px-3.5 py-1.5 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg transition shadow-sm"
                    >
                      Dismiss &amp; Verify
                    </button>
                  </div>
                </div>
              );
            })}

            {activeAnomalies.length === 0 && (
              <div className="md:col-span-2 p-12 text-center text-xs text-black dark:text-[#94A3B8] bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-2xl">
                ✓ No flagged transactions in your records. Everything looks normal!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. HABITUAL EXPENSE INTELLIGENCE SUBMODULE */}
      {/* ======================================================== */}
      {activeSubmodule === 'habitual-intelligence' && (
        <div className="space-y-6">
          <div className="bg-[#1E293B] border border-[#334155] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} className="text-[#3B82F6]" />
                <span className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider">
                  Automated Recurring Detection Engine
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">Monthly Habitual Spending Intelligence</h2>
              <p className="text-xs text-black dark:text-[#94A3B8] mt-1 max-w-xl">
                The algorithm analyzes frequency patterns, merchant descriptors, and predictable calendar intervals to identify habitual outflows. Predicted items never automatically post to bank ledgers until verified.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="text-right bg-[#273549] p-3 rounded-xl border border-[#334155]">
                <span className="text-[11px] text-black dark:text-[#94A3B8] block">Projected Monthly Commitments</span>
                <span className="text-xl font-bold text-white font-tabular">
                  {formatINR(habitualExpenses.reduce((s, h) => s + h.amount, 0))}
                </span>
              </div>
              <button
                onClick={() => setShowAddHabitModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition shadow-lg shadow-[#3B82F6]/20"
              >
                <Plus size={15} /> Add Habitual Outflow
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {habitualExpenses.map(item => (
              <div
                key={item.id}
                className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl space-y-4 hover:border-[#3B82F6]/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#273549] text-black dark:text-[#94A3B8] border border-[#334155] uppercase font-bold tracking-wider">
                      {item.frequency}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{item.title}</h3>
                    <p className="text-xs text-black dark:text-[#94A3B8]">{item.category}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    item.status === 'CONFIRMED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-[#3B82F6]/10 text-[#3B82F6] dark:text-[#60A5FA] border border-[#3B82F6]/20'
                  }`}>
                    {item.status === 'CONFIRMED' ? 'Verified Habit' : 'Recurring Bill'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between border-t border-b border-[#334155] py-3">
                  <div>
                    <span className="text-[11px] text-black dark:text-[#94A3B8] block">Recurring Amount</span>
                    <span className="text-lg font-bold text-white font-tabular">{formatINR(item.amount)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-black dark:text-[#94A3B8] block">Due Day</span>
                    <span className="text-sm font-semibold text-white font-tabular">{item.expectedDayOfMonth}th of month</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-black dark:text-[#94A3B8]">
                  <span>Pattern Match: {item.confidenceScore}%</span>
                  <span>Next: {formatDate(item.nextPaymentDate)}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {item.status !== 'CONFIRMED' ? (
                    <button
                      onClick={() => updateHabitualStatus(item.id, 'CONFIRMED')}
                      className="flex-1 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition"
                    >
                      Confirm Habit
                    </button>
                  ) : (
                    <button
                      onClick={() => updateHabitualStatus(item.id, 'DETECTED')}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition"
                      title="Click to revert to unverified"
                    >
                      ✓ Verified Habit
                    </button>
                  )}
                  <button
                    onClick={() => deleteHabitualExpense(item.id)}
                    className="p-1.5 rounded-lg bg-[#273549] hover:bg-red-500/20 text-black dark:text-[#94A3B8] hover:text-red-400 text-xs transition"
                    title="Remove Habit"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {habitualExpenses.length === 0 && (
              <div className="md:col-span-3 p-12 text-center text-xs text-black dark:text-[#94A3B8] bg-[#1E293B] border border-[#334155] rounded-2xl space-y-3">
                <p>No habitual expenses identified yet.</p>
                <button
                  onClick={() => setShowAddHabitModal(true)}
                  className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition"
                >
                  Add Your First Habitual Expense
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MEDICAL FUND & HEALTHCARE EXPENSES */}
      {/* ======================================================== */}
      {activeSubmodule === 'medical-fund' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl">
              <span className="text-xs text-black dark:text-[#94A3B8] font-medium">Dedicated Healthcare Reserve</span>
              <div className="text-2xl font-bold text-white font-tabular mt-1">
                {formatINR(
                  bankAccounts
                    .filter(b => b.bankName.toLowerCase().includes('health') || b.bankName.toLowerCase().includes('medic'))
                    .reduce((s, b) => s + b.currentBalance, 0)
                )}
              </div>
              <p className="text-[11px] text-black dark:text-[#94A3B8] mt-1">
                {bankAccounts.some(b => b.bankName.toLowerCase().includes('health') || b.bankName.toLowerCase().includes('medic'))
                  ? 'Allocated in medical accounts'
                  : 'No dedicated medical account designated'}
              </p>
            </div>
            <div className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl">
              <span className="text-xs text-black dark:text-[#94A3B8] font-medium">Reimbursed via Health Insurance</span>
              <div className="text-2xl font-bold text-emerald-400 font-tabular mt-1">
                {formatINR(medicalExpenses.reduce((s, m) => s + (m.reimbursedAmount || 0), 0))}
              </div>
              <p className="text-[11px] text-black dark:text-[#94A3B8] mt-1">
                {medicalExpenses.some(m => (m.reimbursedAmount || 0) > 0)
                  ? 'Cashless & TPA claims successful'
                  : 'No insurance claims settled yet'}
              </p>
            </div>
            <div className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl">
              <span className="text-xs text-black dark:text-[#94A3B8] font-medium">Net Out-of-Pocket Expense</span>
              <div className="text-2xl font-bold text-amber-400 font-tabular mt-1">
                {formatINR(medicalExpenses.reduce((s, m) => s + m.amount - (m.reimbursedAmount || 0), 0))}
              </div>
              <p className="text-[11px] text-black dark:text-[#94A3B8] mt-1">Unreimbursed consultations & labs</p>
            </div>
          </div>

          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#334155] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Medical Incident & Claims Register</h3>
                <p className="text-xs text-black dark:text-[#94A3B8]">Strictly isolated healthcare audit records</p>
              </div>
              <button
                onClick={() => setShowAddMedicalModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg transition"
              >
                <Plus size={14} /> Log Medical Incident
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-[#273549] text-black dark:text-[#94A3B8] border-b border-[#334155] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Patient</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Hospital / Provider</th>
                  <th className="p-3.5">Insurance Status</th>
                  <th className="p-3.5 text-right">Invoiced Amount</th>
                  <th className="p-3.5 text-right">Reimbursed</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {medicalExpenses.map(item => (
                  <tr key={item.id} className="hover:bg-[#273549]/40 transition">
                    <td className="p-3.5 text-black dark:text-[#94A3B8] whitespace-nowrap">{formatDate(item.date)}</td>
                    <td className="p-3.5 font-semibold text-white">{item.patientName}</td>
                    <td className="p-3.5 text-black dark:text-[#94A3B8]">{item.type}</td>
                    <td className="p-3.5 text-[#94A3B8]">{item.doctorHospital || '—'}</td>
                    <td className="p-3.5">
                      <select
                        value={item.insuranceClaimStatus}
                        onChange={e => updateMedicalExpense(item.id, { insuranceClaimStatus: e.target.value as any })}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold bg-[#1E293B] border cursor-pointer focus:outline-none ${
                          item.insuranceClaimStatus === 'REIMBURSED'
                            ? 'text-emerald-400 border-emerald-500/30'
                            : item.insuranceClaimStatus === 'APPROVED'
                            ? 'text-blue-400 border-blue-500/30'
                            : item.insuranceClaimStatus === 'FILED'
                            ? 'text-amber-400 border-amber-500/30'
                            : 'text-[#94A3B8] border-[#334155]'
                        }`}
                      >
                        <option value="NOT_APPLIED">NOT APPLIED</option>
                        <option value="FILED">CLAIM FILED</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REIMBURSED">REIMBURSED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </td>
                    <td className="p-3.5 text-right font-bold text-white font-tabular">{formatINR(item.amount)}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-400 font-tabular">
                      {item.reimbursedAmount ? formatINR(item.reimbursedAmount) : '—'}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => deleteMedicalExpense(item.id)}
                        className="p-1 hover:bg-red-500/20 text-black dark:text-[#94A3B8] hover:text-red-400 rounded transition"
                        title="Delete Medical Record"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {medicalExpenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-black dark:text-[#94A3B8]">
                      No medical incidents recorded yet. Click &quot;Log Medical Incident&quot; above to log hospital visits, bills or health insurance claims.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. EDUCATION EXPENSE MANAGEMENT */}
      {/* ======================================================== */}
      {activeSubmodule === 'education-fund' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Education & Tuition Fund</h2>
              <p className="text-xs text-black dark:text-[#94A3B8]">
                Track academic budgets, semester fee installments, books, and coaching for each student.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#273549] hover:bg-[#334155] border border-[#334155] text-white text-xs font-semibold rounded-xl transition"
              >
                <Plus size={14} /> Add Student Profile
              </button>
              <button
                onClick={() => setShowAddEducationModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-[#3B82F6]/20"
              >
                <Plus size={14} /> Record Tuition / Fee
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {students.map(student => {
              const studentExpenses = educationExpenses.filter(e => e.studentId === student.id);
              const spent = studentExpenses.reduce((s, e) => s + e.amount, 0);
              const remainingBudget = student.annualBudget - spent;
              return (
                <div key={student.id} className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl md:col-span-3 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334155] pb-4">
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#3B82F6]/20 text-[#3B82F6] font-bold uppercase">
                        Active Student Profile
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{student.studentName}</h3>
                      <p className="text-xs text-black dark:text-[#94A3B8]">{student.institution} • {student.gradeLevel}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-black dark:text-[#94A3B8] block">Annual Allocation</span>
                        <span className="text-base font-bold text-white font-tabular">{formatINR(student.annualBudget)}</span>
                      </div>
                      <div>
                        <span className="text-black dark:text-[#94A3B8] block">Spent YTD</span>
                        <span className="text-base font-bold text-amber-400 font-tabular">{formatINR(spent)}</span>
                      </div>
                      <div>
                        <span className="text-black dark:text-[#94A3B8] block">Available Budget</span>
                        <span className="text-base font-bold text-emerald-400 font-tabular">{formatINR(remainingBudget)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-black dark:text-[#94A3B8]">
                      <span>Budget Utilization</span>
                      <span className="font-bold text-white font-tabular">
                        {student.annualBudget > 0 ? Math.round((spent / student.annualBudget) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-[#0F172A] h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          spent > student.annualBudget ? 'bg-red-500' : 'bg-[#3B82F6]'
                        }`}
                        style={{
                          width: `${Math.min(100, student.annualBudget > 0 ? (spent / student.annualBudget) * 100 : 0)}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-white">Itemized Educational Expenses ({studentExpenses.length})</span>
                    <button
                      onClick={() => {
                        setNewEducation(prev => ({ ...prev, studentId: student.id }));
                        setShowAddEducationModal(true);
                      }}
                      className="px-2.5 py-1 bg-[#273549] hover:bg-[#334155] text-[#3B82F6] hover:text-white text-xs font-semibold rounded-lg transition"
                    >
                      + Add Item for {student.studentName}
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#334155]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#273549] text-black dark:text-[#94A3B8] uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Expense Name / Item</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Academic Period</th>
                          <th className="p-3">Receipt / Ref</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155]">
                        {studentExpenses.map(item => (
                          <tr key={item.id} className="hover:bg-[#273549]/30">
                            <td className="p-3 text-black dark:text-[#94A3B8]">{formatDate(item.date)}</td>
                            <td className="p-3 font-semibold text-white">{item.type}</td>
                            <td className="p-3 text-black dark:text-[#94A3B8]">
                              <span className="px-2 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] font-medium text-[10px] border border-[#3B82F6]/20">
                                Education
                              </span>
                            </td>
                            <td className="p-3 text-black dark:text-[#94A3B8]">{item.academicYear}</td>
                            <td className="p-3 text-[#94A3B8] font-mono">{item.receiptNumber || '—'}</td>
                            <td className="p-3 text-right font-bold text-white font-tabular">{formatINR(item.amount)}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => deleteEducationExpense(item.id)}
                                className="p-1 hover:bg-red-500/20 text-black dark:text-[#94A3B8] hover:text-red-400 rounded transition"
                                title="Delete Expense"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {studentExpenses.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-black dark:text-[#94A3B8]">
                              No education expenses recorded yet for {student.studentName}. (Payments categorized as &quot;Education&quot; in Expense Manager link here automatically).
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {students.length === 0 && (
              <div className="p-10 text-center text-black dark:text-[#94A3B8] bg-[#1E293B] border border-[#334155] rounded-2xl md:col-span-3">
                <p>No student profiles configured yet.</p>
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="mt-3 px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition"
                >
                  Create Student Profile
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. LOANS & EMI AMORTIZATION */}
      {/* ======================================================== */}
      {activeSubmodule === 'loans-emi' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Loans & EMI Amortization Schedule</h2>
              <p className="text-xs text-black dark:text-[#94A3B8]">
                Track outstanding principal, interest rates, tenure compression, and principal prepayments.
              </p>
            </div>
            <button
              onClick={() => setShowAddLoanModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-[#3B82F6]/20 self-start sm:self-auto"
            >
              <Plus size={14} /> Add Loan Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loans.map(loan => (
              <div key={loan.id} className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase">
                      {loan.type}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{loan.name}</h3>
                    <p className="text-xs text-black dark:text-[#94A3B8]">{loan.lender}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-black dark:text-[#94A3B8] block">Monthly Obligation</span>
                    <span className="text-lg font-bold text-white font-tabular">{formatINR(loan.emiAmount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#273549] p-3 rounded-xl text-center">
                  <div>
                    <span className="text-[10px] text-black dark:text-[#94A3B8] block">Principal Bal</span>
                    <span className="text-xs font-bold text-white font-tabular">{formatCompactINR(loan.outstandingPrincipal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black dark:text-[#94A3B8] block">Interest Rate</span>
                    <span className="text-xs font-bold text-amber-400 font-tabular">{loan.interestRate}% {loan.interestType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black dark:text-[#94A3B8] block">Remaining</span>
                    <span className="text-xs font-bold text-white font-tabular">{loan.remainingTenureMonths} Mos</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-black dark:text-[#94A3B8]">
                    <span>Repayment Progress</span>
                    <span className="font-bold text-white font-tabular">
                      {Math.round(((loan.originalAmount - loan.outstandingPrincipal) / loan.originalAmount) * 100)}% Paid
                    </span>
                  </div>
                  <div className="w-full bg-[#0F172A] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{
                        width: `${Math.round(((loan.originalAmount - loan.outstandingPrincipal) / loan.originalAmount) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#334155]">
                  <button
                    onClick={() => setPrepayLoanId(loan.id)}
                    className="flex-1 py-2 bg-[#273549] hover:bg-[#334155] border border-[#334155] text-white text-xs font-semibold rounded-xl transition"
                  >
                    Record Prepayment
                  </button>
                  <button
                    onClick={() => deleteLoan(loan.id)}
                    className="p-2 hover:bg-red-500/20 text-black dark:text-[#94A3B8] hover:text-red-400 rounded-xl transition border border-transparent hover:border-red-500/20"
                    title="Remove Loan"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {loans.length === 0 && (
              <div className="p-10 text-center text-black dark:text-[#94A3B8] bg-[#1E293B] border border-[#334155] rounded-2xl md:col-span-2">
                <p>No active loans recorded. Keep debts at zero or add your mortgage, auto or education loan.</p>
                <button
                  onClick={() => setShowAddLoanModal(true)}
                  className="mt-3 px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition"
                >
                  Add Loan Account
                </button>
              </div>
            )}
          </div>

          {/* Prepayment Dialog */}
          {prepayLoanId && (
            <div className="p-4 bg-[#273549] border border-[#3B82F6] rounded-xl flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white">Record Principal Prepayment</h4>
                <p className="text-xs text-black dark:text-[#94A3B8]">Reduces outstanding balance directly & compresses tenure.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={prepayAmount}
                  onChange={e => setPrepayAmount(Number(e.target.value))}
                  className="bg-[#0F172A] border border-[#334155] text-white px-3 py-1.5 text-xs rounded-lg w-32"
                />
                <button
                  onClick={() => {
                    recordLoanPrepayment(prepayLoanId, prepayAmount);
                    setPrepayLoanId(null);
                  }}
                  className="px-4 py-1.5 bg-[#3B82F6] text-white text-xs font-bold rounded-lg"
                >
                  Confirm Prepayment
                </button>
                <button
                  onClick={() => setPrepayLoanId(null)}
                  className="px-3 py-1.5 text-black dark:text-[#94A3B8] text-xs hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Expense */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Log Expense Record</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">Expense Description</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Grocery from Nature Basket"
                  value={newExpense.description}
                  onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={newExpense.amount || ''}
                    onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Category</label>
                  <select
                    value={newExpense.category}
                    onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Date</label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Family Member</label>
                  <select
                    value={newExpense.familyMemberId}
                    onChange={e => setNewExpense({ ...newExpense, familyMemberId: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    {family.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newExpense.amount || !newExpense.description) return;
                  const member = family.members.find(m => m.id === newExpense.familyMemberId);
                  addExpense({
                    ...newExpense,
                    familyMemberName: member?.name || 'Self',
                    status: 'ACTUAL'
                  });
                  setShowAddExpenseModal(false);
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log Medical Incident */}
      {showAddMedicalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Log Medical Incident & Claim</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">Patient Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe / Self"
                  value={newMedical.patientName}
                  onChange={e => setNewMedical({ ...newMedical, patientName: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Incident Type</label>
                  <select
                    value={newMedical.type}
                    onChange={e => setNewMedical({ ...newMedical, type: e.target.value as any })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    <option value="Doctor Consultation">Doctor Consultation</option>
                    <option value="Hospitalization">Hospitalization</option>
                    <option value="Pharmacy / Medicines">Pharmacy / Medicines</option>
                    <option value="Diagnostics & Tests">Diagnostics & Tests</option>
                    <option value="Health Insurance">Health Insurance</option>
                  </select>
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Date</label>
                  <input
                    type="date"
                    value={newMedical.date}
                    onChange={e => setNewMedical({ ...newMedical, date: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Invoiced Amount (₹)</label>
                  <input
                    type="number"
                    value={newMedical.amount || ''}
                    onChange={e => setNewMedical({ ...newMedical, amount: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Reimbursed Amount (₹)</label>
                  <input
                    type="number"
                    value={newMedical.reimbursedAmount || ''}
                    onChange={e => setNewMedical({ ...newMedical, reimbursedAmount: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Hospital / Doctor</label>
                  <input
                    type="text"
                    placeholder="e.g. Apollo Hospital / Max"
                    value={newMedical.doctorHospital}
                    onChange={e => setNewMedical({ ...newMedical, doctorHospital: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Insurance Status</label>
                  <select
                    value={newMedical.insuranceClaimStatus}
                    onChange={e => setNewMedical({ ...newMedical, insuranceClaimStatus: e.target.value as any })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    <option value="NOT_APPLIED">NOT APPLIED</option>
                    <option value="FILED">FILED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REIMBURSED">REIMBURSED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
              <button
                onClick={() => setShowAddMedicalModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newMedical.amount || !newMedical.patientName) return;
                  addMedicalExpense(newMedical);
                  setShowAddMedicalModal(false);
                  setNewMedical({
                    patientName: currentUser.name || 'Self',
                    date: new Date().toISOString().split('T')[0],
                    type: 'Doctor Consultation',
                    amount: 0,
                    insuranceClaimStatus: 'NOT_APPLIED',
                    claimedAmount: 0,
                    reimbursedAmount: 0,
                    doctorHospital: '',
                    notes: ''
                  });
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl"
              >
                Save Medical Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Student Profile */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create Student Profile</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">Student Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={newStudent.studentName}
                  onChange={e => setNewStudent({ ...newStudent, studentName: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">School / University</label>
                <input
                  type="text"
                  placeholder="e.g. DPS / IIT Delhi"
                  value={newStudent.institution}
                  onChange={e => setNewStudent({ ...newStudent, institution: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Grade / Year</label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 10 / B.Tech Yr 2"
                    value={newStudent.gradeLevel}
                    onChange={e => setNewStudent({ ...newStudent, gradeLevel: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Annual Budget (₹)</label>
                  <input
                    type="number"
                    value={newStudent.annualBudget || ''}
                    onChange={e => setNewStudent({ ...newStudent, annualBudget: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newStudent.studentName || !newStudent.annualBudget) return;
                  addStudent(newStudent);
                  setShowAddStudentModal(false);
                  setNewStudent({
                    studentName: '',
                    institution: '',
                    gradeLevel: 'Grade 10',
                    annualBudget: 150000
                  });
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl"
              >
                Create Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Tuition / Education Fee */}
      {showAddEducationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Record Tuition / Educational Fee</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">Select Student</label>
                <select
                  value={newEducation.studentId}
                  onChange={e => setNewEducation({ ...newEducation, studentId: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.studentName} ({s.institution})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Expense Type</label>
                  <select
                    value={newEducation.type}
                    onChange={e => setNewEducation({ ...newEducation, type: e.target.value as any })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    <option value="School / College Tuition">School / College Tuition</option>
                    <option value="Semester Fees">Semester Fees</option>
                    <option value="Coaching & Tutors">Coaching & Tutors</option>
                    <option value="Books & Stationery">Books & Stationery</option>
                    <option value="Hostel & Mess">Hostel & Mess</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Exam Fees">Exam Fees</option>
                  </select>
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Academic Year</label>
                  <input
                    type="text"
                    placeholder="2026-2027"
                    value={newEducation.academicYear}
                    onChange={e => setNewEducation({ ...newEducation, academicYear: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={newEducation.amount || ''}
                    onChange={e => setNewEducation({ ...newEducation, amount: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Date</label>
                  <input
                    type="date"
                    value={newEducation.date}
                    onChange={e => setNewEducation({ ...newEducation, date: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">Receipt / Invoice Ref</label>
                <input
                  type="text"
                  placeholder="e.g. REC-2026-8842"
                  value={newEducation.receiptNumber}
                  onChange={e => setNewEducation({ ...newEducation, receiptNumber: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
              <button
                onClick={() => setShowAddEducationModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newEducation.amount) return;
                  const st = students.find(s => s.id === newEducation.studentId) || students[0];
                  if (!st) return;
                  addEducationExpense({
                    ...newEducation,
                    studentId: st.id,
                    studentName: st.studentName
                  });
                  setShowAddEducationModal(false);
                  setNewEducation({
                    studentId: students[0]?.id || '',
                    type: 'School / College Tuition',
                    amount: 0,
                    academicYear: '2026-2027',
                    receiptNumber: '',
                    date: new Date().toISOString().split('T')[0]
                  });
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl"
              >
                Save Education Fee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Loan Account */}
      {showAddLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Add Loan / Debt Obligation</h3>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Loan Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Home Loan"
                    value={newLoan.name}
                    onChange={e => setNewLoan({ ...newLoan, name: e.target.value })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Loan Type</label>
                  <select
                    value={newLoan.type}
                    onChange={e => setNewLoan({ ...newLoan, type: e.target.value as any })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    <option value="Home Loan">Home Loan</option>
                    <option value="Vehicle Loan">Vehicle Loan</option>
                    <option value="Personal Loan">Personal Loan</option>
                    <option value="Education Loan">Education Loan</option>
                    <option value="Gold Loan">Gold Loan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">Lender / Bank</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank / SBI / ICICI"
                  value={newLoan.lender}
                  onChange={e => setNewLoan({ ...newLoan, lender: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Original Loan (₹)</label>
                  <input
                    type="number"
                    value={newLoan.originalAmount || ''}
                    onChange={e => setNewLoan({ ...newLoan, originalAmount: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Outstanding Principal (₹)</label>
                  <input
                    type="number"
                    value={newLoan.outstandingPrincipal || ''}
                    onChange={e => setNewLoan({ ...newLoan, outstandingPrincipal: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Monthly EMI (₹)</label>
                  <input
                    type="number"
                    value={newLoan.emiAmount || ''}
                    onChange={e => setNewLoan({ ...newLoan, emiAmount: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLoan.interestRate || ''}
                    onChange={e => setNewLoan({ ...newLoan, interestRate: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Tenure (Months)</label>
                  <input
                    type="number"
                    value={newLoan.remainingTenureMonths || ''}
                    onChange={e => setNewLoan({ ...newLoan, remainingTenureMonths: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
              <button
                onClick={() => setShowAddLoanModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newLoan.name || !newLoan.outstandingPrincipal) return;
                  addLoan(newLoan);
                  setShowAddLoanModal(false);
                  setNewLoan({
                    name: '',
                    type: 'Home Loan',
                    lender: '',
                    originalAmount: 2500000,
                    outstandingPrincipal: 2500000,
                    interestRate: 8.5,
                    interestType: 'REDUCING',
                    startDate: new Date().toISOString().split('T')[0],
                    tenureMonths: 240,
                    remainingTenureMonths: 240,
                    emiAmount: 21700,
                    emiDueDate: 5,
                    totalInterestPaid: 0,
                    totalPrepaid: 0
                  });
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl"
              >
                Add Loan Obligation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Habitual Commitment */}
      {showAddHabitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Add Habitual Recurring Outflow</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-black dark:text-[#94A3B8] block mb-1">Habit / Service Title</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix Subscription / Internet Fibernet"
                  value={newHabit.title}
                  onChange={e => setNewHabit({ ...newHabit, title: e.target.value })}
                  className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Recurring Amount (₹)</label>
                  <input
                    type="number"
                    value={newHabit.amount || ''}
                    onChange={e => setNewHabit({ ...newHabit, amount: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Frequency</label>
                  <select
                    value={newHabit.frequency}
                    onChange={e => setNewHabit({ ...newHabit, frequency: e.target.value as any })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Category</label>
                  <select
                    value={newHabit.category}
                    onChange={e => setNewHabit({ ...newHabit, category: e.target.value as any })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-black dark:text-[#94A3B8] block mb-1">Expected Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newHabit.expectedDayOfMonth}
                    onChange={e => setNewHabit({ ...newHabit, expectedDayOfMonth: Number(e.target.value) })}
                    className="w-full bg-[#273549] border border-[#334155] text-white rounded-lg p-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334155]">
              <button
                onClick={() => setShowAddHabitModal(false)}
                className="px-4 py-2 text-xs text-black dark:text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newHabit.title || !newHabit.amount) return;
                  const nextDate = new Date();
                  nextDate.setDate(newHabit.expectedDayOfMonth);
                  if (nextDate.getTime() < Date.now()) {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                  }
                  addHabitualExpense({
                    title: newHabit.title,
                    category: newHabit.category,
                    amount: newHabit.amount,
                    frequency: newHabit.frequency,
                    expectedDayOfMonth: newHabit.expectedDayOfMonth,
                    lastPaymentDate: new Date().toISOString().slice(0, 10),
                    nextPaymentDate: nextDate.toISOString().slice(0, 10),
                    historicalChange: 0,
                    confidenceScore: 95,
                    status: 'CONFIRMED',
                    bankAccountId: bankAccounts[0]?.id || 'Primary-Account'
                  });
                  setShowAddHabitModal(false);
                  setNewHabit({
                    title: '',
                    category: 'Subscriptions',
                    amount: 1499,
                    frequency: 'Monthly',
                    expectedDayOfMonth: 5
                  });
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl"
              >
                Save Habitual Outflow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

