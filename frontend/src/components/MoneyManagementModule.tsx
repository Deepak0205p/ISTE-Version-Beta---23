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

import { detectExpenseAnomalies, AnomalyReport } from '../utils/anomalyEngine';

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
    medicalExpenses,
    addMedicalExpense,
    students,
    educationExpenses,
    addEducationExpense,
    loans,
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
  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null);
  const [prepayAmount, setPrepayAmount] = useState<number>(50000);

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
    { id: 'anomalies', label: `Explainable Anomalies (${activeAnomalies.length})`, icon: <AlertCircle size={16} /> },
    { id: 'habitual-intelligence', label: 'Habitual Expense AI', icon: <Sparkles size={16} /> },
    { id: 'medical-fund', label: 'Medical Fund & Health', icon: <HeartPulse size={16} /> },
    { id: 'education-fund', label: 'Education Expenses', icon: <GraduationCap size={16} /> },
    { id: 'loans-emi', label: 'Loans & EMI Amortization', icon: <Landmark size={16} /> }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Submodule Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#3A3226]">
        {submodules.map(sub => {
          const isActive = activeSubmodule === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubmodule(sub.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#8D7A62] text-white shadow-lg shadow-[#8D7A62]/20'
                  : 'bg-[#1D1913] text-[#A79A8A] hover:text-white hover:bg-[#241F17] border border-[#3A3226]'
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
              <p className="text-xs text-[#A79A8A]">
                Granular logging across 13 certified categories with receipt verification and member attribution.
              </p>
            </div>
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-semibold rounded-xl shadow-lg shadow-[#8D7A62]/20 transition cursor-pointer"
            >
              <Plus size={16} /> Record Expense
            </button>
          </div>

          {/* Correction Propagation Toast */}
          {propagationToast && (
            <div className="p-3.5 bg-[#8D7A62]/15 border border-[#8D7A62] rounded-xl flex items-center justify-between animate-fadeIn text-xs">
              <span className="text-white font-medium flex items-center gap-2">
                <Sparkles size={15} className="text-[#8D7A62]" />
                {propagationToast.message}
              </span>
              <button
                onClick={() => {
                  if (propagationToast.previousSnapshot) {
                    undoCategoryPropagation(propagationToast.previousSnapshot);
                    setPropagationToast(null);
                  }
                }}
                className="px-3 py-1 bg-[#241F17] hover:bg-[#3A3226] border border-[#3A3226] text-[#D9C0A0] font-bold rounded-lg transition"
              >
                Undo
              </button>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#1D1913] border border-[#3A3226] p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-3 text-[#A79A8A]" />
              <input
                type="text"
                placeholder="Search by description, merchant, tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#241F17] border border-[#3A3226] text-white text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#8D7A62]"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-[#241F17] border border-[#3A3226] text-[#ECEAE6] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#8D7A62] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {expenseCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Expenses Table */}
          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#241F17] text-[#A79A8A] border-b border-[#3A3226] uppercase tracking-wider font-semibold">
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
                <tbody className="divide-y divide-[#3A3226]">
                  {filteredExpenses.map(item => (
                    <tr key={item.id} className="hover:bg-[#241F17]/50 transition-colors">
                      <td className="p-3.5 text-[#A79A8A] whitespace-nowrap">{formatDate(item.date)}</td>
                      <td className="p-3.5 font-medium text-white">
                        <div>{item.description}</div>
                        {item.subcategory && (
                          <span className="text-[10px] text-[#A79A8A]">{item.subcategory}</span>
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
                          className="bg-[#241F17] border border-[#3A3226] text-[#8D7A62] font-medium text-[11px] rounded-lg px-2 py-1 cursor-pointer focus:outline-none"
                        >
                          {expenseCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5 text-[#A79A8A]">{item.familyMemberName}</td>
                      <td className="p-3.5 text-[#A79A8A]">{item.paymentMethod}</td>
                      <td className="p-3.5 text-right font-bold text-white font-tabular">
                        {formatINR(item.amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => deleteExpense(item.id)}
                          className="p-1.5 hover:bg-red-500/20 text-[#A79A8A] hover:text-red-400 rounded-lg transition"
                          title="Delete expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#A79A8A]">
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
      {/* 2. EXPLAINABLE MAD ANOMALIES SUBMODULE */}
      {/* ======================================================== */}
      {activeSubmodule === 'anomalies' && (
        <div className="space-y-6">
          <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={18} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Median Absolute Deviation (MAD) & Modified Z-Score
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">Explainable Outliers & Anomaly Flags</h2>
              <p className="text-xs text-[#A79A8A] mt-1 max-w-xl">
                Robust statistical analysis that eliminates normal Gaussian bias to detect abnormal charges, duplicate vendor pulls, and price spikes with exact reasoning.
              </p>
            </div>
            <div className="text-right bg-[#241F17] p-3 rounded-xl border border-[#3A3226]">
              <span className="text-[11px] text-[#A79A8A] block">Active Flags</span>
              <span className="text-xl font-bold text-amber-400 font-tabular">{activeAnomalies.length} Items</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAnomalies.map(anomaly => (
              <div
                key={anomaly.recordId + anomaly.flagType}
                className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl space-y-3 hover:border-amber-500/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold uppercase border border-amber-500/20">
                      {anomaly.flagType.replace(/_/g, ' ')}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{anomaly.description}</h3>
                    <p className="text-xs text-[#A79A8A]">{formatDate(anomaly.date)}</p>
                  </div>
                  <span className="text-base font-extrabold text-white font-tabular">{formatINR(anomaly.amount)}</span>
                </div>

                <p className="text-xs text-[#B3A595] bg-[#241F17] p-3 rounded-xl border border-[#3A3226] leading-relaxed">
                  {anomaly.reason}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-emerald-400 font-medium">System Feedback Loop Active</span>
                  <button
                    onClick={() => setDismissedAnomalyIds(prev => [...prev, anomaly.recordId])}
                    className="px-3 py-1.5 bg-[#241F17] hover:bg-[#2E2820] border border-[#3A3226] text-white text-xs font-semibold rounded-lg transition"
                  >
                    Mark as Real (Learn)
                  </button>
                </div>
              </div>
            ))}

            {activeAnomalies.length === 0 && (
              <div className="md:col-span-2 p-12 text-center text-xs text-[#A79A8A] bg-[#1D1913] border border-[#3A3226] rounded-2xl">
                ✓ No active spending anomalies detected in the current statement ledger.
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
          <div className="bg-[#1D1913] border border-[#3A3226] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} className="text-[#8D7A62]" />
                <span className="text-xs font-bold text-[#8D7A62] uppercase tracking-wider">
                  Automated Recurring Detection Engine
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">Monthly Habitual Spending Intelligence</h2>
              <p className="text-xs text-[#A79A8A] mt-1 max-w-xl">
                The algorithm analyzes frequency patterns, merchant descriptors, and predictable calendar intervals to identify habitual outflows. Predicted items never automatically post to bank ledgers until verified.
              </p>
            </div>
            <div className="text-right bg-[#241F17] p-3 rounded-xl border border-[#3A3226]">
              <span className="text-[11px] text-[#A79A8A] block">Projected Monthly Commitments</span>
              <span className="text-xl font-bold text-white font-tabular">
                {formatINR(habitualExpenses.reduce((s, h) => s + h.amount, 0))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {habitualExpenses.map(item => (
              <div
                key={item.id}
                className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl space-y-4 hover:border-[#8D7A62]/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#241F17] text-[#A79A8A] border border-[#3A3226] uppercase font-bold tracking-wider">
                      {item.frequency}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{item.title}</h3>
                    <p className="text-xs text-[#A79A8A]">{item.category}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    item.status === 'CONFIRMED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {item.status === 'CONFIRMED' ? 'Verified Habit' : 'AI Detected'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between border-t border-b border-[#3A3226] py-3">
                  <div>
                    <span className="text-[11px] text-[#A79A8A] block">Recurring Amount</span>
                    <span className="text-lg font-bold text-white font-tabular">{formatINR(item.amount)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#A79A8A] block">Due Day</span>
                    <span className="text-sm font-semibold text-white font-tabular">{item.expectedDayOfMonth}th of month</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#A79A8A]">
                  <span>Pattern Match: {item.confidenceScore}%</span>
                  <span>Next: {formatDate(item.nextPaymentDate)}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {item.status !== 'CONFIRMED' ? (
                    <button
                      onClick={() => updateHabitualStatus(item.id, 'CONFIRMED')}
                      className="flex-1 py-1.5 rounded-lg bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-semibold transition"
                    >
                      Confirm Habit
                    </button>
                  ) : (
                    <span className="flex-1 py-1 text-center text-xs text-emerald-400 font-medium">
                      ✓ Active in Monthly Forecast
                    </span>
                  )}
                  <button
                    onClick={() => updateHabitualStatus(item.id, 'DISMISSED')}
                    className="px-3 py-1.5 rounded-lg bg-[#241F17] hover:bg-[#3A3226] text-[#A79A8A] hover:text-white text-xs transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MEDICAL FUND & HEALTHCARE EXPENSES */}
      {/* ======================================================== */}
      {activeSubmodule === 'medical-fund' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Dedicated Healthcare Reserve</span>
              <div className="text-2xl font-bold text-white font-tabular mt-1">
                {formatINR(
                  bankAccounts
                    .filter(b => b.bankName.toLowerCase().includes('health') || b.bankName.toLowerCase().includes('medic'))
                    .reduce((s, b) => s + b.currentBalance, 0)
                )}
              </div>
              <p className="text-[11px] text-[#A79A8A] mt-1">
                {bankAccounts.some(b => b.bankName.toLowerCase().includes('health') || b.bankName.toLowerCase().includes('medic'))
                  ? 'Allocated in medical accounts'
                  : 'No dedicated medical account designated'}
              </p>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Reimbursed via Health Insurance</span>
              <div className="text-2xl font-bold text-emerald-400 font-tabular mt-1">
                {formatINR(medicalExpenses.reduce((s, m) => s + (m.reimbursedAmount || 0), 0))}
              </div>
              <p className="text-[11px] text-[#A79A8A] mt-1">
                {medicalExpenses.some(m => (m.reimbursedAmount || 0) > 0)
                  ? 'Cashless & TPA claims successful'
                  : 'No insurance claims settled yet'}
              </p>
            </div>
            <div className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl">
              <span className="text-xs text-[#A79A8A] font-medium">Net Out-of-Pocket Expense</span>
              <div className="text-2xl font-bold text-amber-400 font-tabular mt-1">
                {formatINR(medicalExpenses.reduce((s, m) => s + m.amount - (m.reimbursedAmount || 0), 0))}
              </div>
              <p className="text-[11px] text-[#A79A8A] mt-1">Unreimbursed consultations & labs</p>
            </div>
          </div>

          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#3A3226] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Medical Incident & Claims Register</h3>
                <p className="text-xs text-[#A79A8A]">Strictly isolated healthcare audit records</p>
              </div>
              <button
                onClick={() => setShowAddMedicalModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-semibold rounded-lg transition"
              >
                <Plus size={14} /> Log Medical Incident
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-[#241F17] text-[#A79A8A] border-b border-[#3A3226] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Patient</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Hospital / Provider</th>
                  <th className="p-3.5">Insurance Status</th>
                  <th className="p-3.5 text-right">Invoiced Amount</th>
                  <th className="p-3.5 text-right">Reimbursed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3226]">
                {medicalExpenses.map(item => (
                  <tr key={item.id} className="hover:bg-[#241F17]/40 transition">
                    <td className="p-3.5 text-[#A79A8A] whitespace-nowrap">{formatDate(item.date)}</td>
                    <td className="p-3.5 font-semibold text-white">{item.patientName}</td>
                    <td className="p-3.5 text-[#A79A8A]">{item.type}</td>
                    <td className="p-3.5 text-[#B3A595]">{item.doctorHospital}</td>
                    <td className="p-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        item.insuranceClaimStatus === 'REIMBURSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-[#3A3226] text-[#A79A8A]'
                      }`}>
                        {item.insuranceClaimStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-white font-tabular">{formatINR(item.amount)}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-400 font-tabular">
                      {item.reimbursedAmount ? formatINR(item.reimbursedAmount) : '—'}
                    </td>
                  </tr>
                ))}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {students.map(student => {
              const spent = educationExpenses
                .filter(e => e.studentId === student.id)
                .reduce((s, e) => s + e.amount, 0);
              const remainingBudget = student.annualBudget - spent;
              return (
                <div key={student.id} className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl md:col-span-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#3A3226] pb-4 mb-4">
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#8D7A62]/20 text-[#8D7A62] font-bold uppercase">
                        Active Student Profile
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{student.studentName}</h3>
                      <p className="text-xs text-[#A79A8A]">{student.institution} • {student.gradeLevel}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-[#A79A8A] block">Annual Allocation</span>
                        <span className="text-base font-bold text-white font-tabular">{formatINR(student.annualBudget)}</span>
                      </div>
                      <div>
                        <span className="text-[#A79A8A] block">Spent YTD</span>
                        <span className="text-base font-bold text-amber-400 font-tabular">{formatINR(spent)}</span>
                      </div>
                      <div>
                        <span className="text-[#A79A8A] block">Available Budget</span>
                        <span className="text-base font-bold text-emerald-400 font-tabular">{formatINR(remainingBudget)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white">Itemized Educational Expenses</span>
                    <button
                      onClick={() => setShowAddEducationModal(true)}
                      className="px-3 py-1.5 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-semibold rounded-lg transition"
                    >
                      + Record Tuition / Fee
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#241F17] text-[#A79A8A] uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Academic Period</th>
                          <th className="p-3">Receipt / Ref</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3A3226]">
                        {educationExpenses.map(item => (
                          <tr key={item.id} className="hover:bg-[#241F17]/30">
                            <td className="p-3 text-[#A79A8A]">{formatDate(item.date)}</td>
                            <td className="p-3 font-semibold text-white">{item.type}</td>
                            <td className="p-3 text-[#A79A8A]">{item.academicYear}</td>
                            <td className="p-3 text-[#B3A595] font-mono">{item.receiptNumber || '—'}</td>
                            <td className="p-3 text-right font-bold text-white font-tabular">{formatINR(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. LOANS & EMI AMORTIZATION */}
      {/* ======================================================== */}
      {activeSubmodule === 'loans-emi' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loans.map(loan => (
              <div key={loan.id} className="bg-[#1D1913] border border-[#3A3226] p-5 rounded-2xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase">
                      {loan.type}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{loan.name}</h3>
                    <p className="text-xs text-[#A79A8A]">{loan.lender}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#A79A8A] block">Monthly Obligation</span>
                    <span className="text-lg font-bold text-white font-tabular">{formatINR(loan.emiAmount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#241F17] p-3 rounded-xl text-center">
                  <div>
                    <span className="text-[10px] text-[#A79A8A] block">Principal Bal</span>
                    <span className="text-xs font-bold text-white font-tabular">{formatCompactINR(loan.outstandingPrincipal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#A79A8A] block">Interest Rate</span>
                    <span className="text-xs font-bold text-amber-400 font-tabular">{loan.interestRate}% {loan.interestType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#A79A8A] block">Remaining</span>
                    <span className="text-xs font-bold text-white font-tabular">{loan.remainingTenureMonths} Mos</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#A79A8A]">
                    <span>Repayment Progress</span>
                    <span className="font-bold text-white font-tabular">
                      {Math.round(((loan.originalAmount - loan.outstandingPrincipal) / loan.originalAmount) * 100)}% Paid
                    </span>
                  </div>
                  <div className="w-full bg-[#191510] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{
                        width: `${Math.round(((loan.originalAmount - loan.outstandingPrincipal) / loan.originalAmount) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#3A3226]">
                  <button
                    onClick={() => setPrepayLoanId(loan.id)}
                    className="flex-1 py-2 bg-[#241F17] hover:bg-[#2E2820] border border-[#3A3226] text-white text-xs font-semibold rounded-xl transition"
                  >
                    Record Prepayment
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Prepayment Dialog */}
          {prepayLoanId && (
            <div className="p-4 bg-[#241F17] border border-[#8D7A62] rounded-xl flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white">Record Principal Prepayment</h4>
                <p className="text-xs text-[#A79A8A]">Reduces outstanding balance directly & compresses tenure.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={prepayAmount}
                  onChange={e => setPrepayAmount(Number(e.target.value))}
                  className="bg-[#191510] border border-[#3A3226] text-white px-3 py-1.5 text-xs rounded-lg w-32"
                />
                <button
                  onClick={() => {
                    recordLoanPrepayment(prepayLoanId, prepayAmount);
                    setPrepayLoanId(null);
                  }}
                  className="px-4 py-1.5 bg-[#8D7A62] text-white text-xs font-bold rounded-lg"
                >
                  Confirm Prepayment
                </button>
                <button
                  onClick={() => setPrepayLoanId(null)}
                  className="px-3 py-1.5 text-[#A79A8A] text-xs hover:text-white"
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
          <div className="bg-[#1D1913] border border-[#3A3226] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Log Expense Record</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#A79A8A] block mb-1">Expense Description</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Grocery from Nature Basket"
                  value={newExpense.description}
                  onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#A79A8A] block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={newExpense.amount || ''}
                    onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5 font-bold font-tabular"
                  />
                </div>
                <div>
                  <label className="text-[#A79A8A] block mb-1">Category</label>
                  <select
                    value={newExpense.category}
                    onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#A79A8A] block mb-1">Date</label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="text-[#A79A8A] block mb-1">Family Member</label>
                  <select
                    value={newExpense.familyMemberId}
                    onChange={e => setNewExpense({ ...newExpense, familyMemberId: e.target.value })}
                    className="w-full bg-[#241F17] border border-[#3A3226] text-white rounded-lg p-2.5"
                  >
                    {family.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#3A3226]">
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="px-4 py-2 text-xs text-[#A79A8A] hover:text-white"
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
                className="px-4 py-2 bg-[#8D7A62] hover:bg-[#6E5A44] text-white text-xs font-bold rounded-xl"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

