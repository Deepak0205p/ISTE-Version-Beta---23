"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserProfile,
  FamilyWorkspace,
  BankAccount,
  ExpenseRecord,
  ExpenseCategory,
  HabitualExpense,
  MedicalExpenseRecord,
  StudentProfile,
  EducationExpenseRecord,
  LoanRecord,
  InvestmentAsset,
  FinancialGoal,
  TransactionRecord,
  NavigationTab
} from '../types';
import {
  initialFamily,
  initialStudents,
  initialEducationExpenses,
  initialLoans,
  initialBankAccounts,
  initialTransactions,
  initialExpenses,
  initialInvestments,
  initialGoals,
} from '../data/initialData';
import { categorizeDescriptor } from '../utils/merchantLexicon';
import { detectHabitualExpenses } from '../utils/anomalyEngine';

interface FinancialContextType {
  // Navigation & Theme
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  activeSubmodule: string;
  setActiveSubmodule: (sub: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  
  // User & Family
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  family: FamilyWorkspace;
  isFamilyView: boolean;
  setIsFamilyView: (val: boolean) => void;

  // Data Collections & Operations
  bankAccounts: BankAccount[];
  addBankAccount: (account: Omit<BankAccount, 'id'>) => void;
  
  expenses: ExpenseRecord[];
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  updateExpense: (id: string, expense: Partial<ExpenseRecord>) => void;
  propagateCategoryOverride: (targetDesc: string, newCategory: ExpenseCategory) => { updatedCount: number };
  undoCategoryPropagation: (previousSnapshot: ExpenseRecord[]) => void;
  deleteExpense: (id: string) => void;

  habitualExpenses: HabitualExpense[];
  updateHabitualStatus: (id: string, status: 'CONFIRMED' | 'DETECTED' | 'DISMISSED') => void;
  addHabitualExpense: (expense: Omit<HabitualExpense, 'id'>) => void;
  deleteHabitualExpense: (id: string) => void;

  medicalExpenses: MedicalExpenseRecord[];
  addMedicalExpense: (record: Omit<MedicalExpenseRecord, 'id'>) => void;
  updateMedicalExpense: (id: string, record: Partial<MedicalExpenseRecord>) => void;
  deleteMedicalExpense: (id: string) => void;

  students: StudentProfile[];
  addStudent: (student: Omit<StudentProfile, 'id'>) => void;
  educationExpenses: EducationExpenseRecord[];
  addEducationExpense: (record: Omit<EducationExpenseRecord, 'id'>) => void;
  deleteEducationExpense: (id: string) => void;

  loans: LoanRecord[];
  addLoan: (loan: Omit<LoanRecord, 'id'>) => void;
  deleteLoan: (id: string) => void;
  recordLoanPrepayment: (loanId: string, amount: number) => void;

  investments: InvestmentAsset[];
  addInvestment: (inv: Omit<InvestmentAsset, 'id'>) => void;
  deleteInvestment: (id: string) => void;

  goals: FinancialGoal[];
  addGoal: (goal: Omit<FinancialGoal, 'id'>) => void;
  deleteGoal: (id: string) => void;
  contributeToGoal: (goalId: string, amount: number) => void;

  transactions: TransactionRecord[];
  addTransaction: (tx: Omit<TransactionRecord, 'id'>) => void;
  importBankTransactions: (txs: Omit<TransactionRecord, 'id'>[]) => void;
  clearAllData: () => void;
  syncWithBackend: () => Promise<void>;

  // Aggregate Calculations (Accurate, strictly excluding internal transfers)
  metrics: {
    monthlyIncome: number;
    monthlyExpenses: number;
    remainingBalance: number;
    totalSavingsBalance: number;
    totalInvestmentValuation: number;
    totalInvestedPrincipal: number;
    totalLoanPrincipal: number;
    monthlyEmiCommitments: number;
    savingsRatePercentage: number;
    netWorth: number;
  };
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const browserStorage = typeof window !== 'undefined' ? window.localStorage : null;

  // Navigation State
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [activeSubmodule, setActiveSubmodule] = useState<string>('expense-manager');
  
  // Theme State: Default to Money Matters Warm Off-White palette
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = browserStorage?.getItem('mm_theme');
    return saved !== null ? saved === 'dark' : false; // Default to Warm Off-White light mode
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      browserStorage?.setItem('mm_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      browserStorage?.setItem('mm_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // User State
  const [family] = useState<FamilyWorkspace>(initialFamily);
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialFamily.members[0]);
  const [isFamilyView, setIsFamilyView] = useState<boolean>(true);

  // One-time self cleanup: immediately purge legacy hardcoded mock entries from previous sessions
  if (typeof window !== 'undefined') {
    const rawBank = window.localStorage.getItem('mm_bank_accounts') || '';
    const rawLoans = window.localStorage.getItem('mm_loans') || '';
    const isLegacyMock =
      rawBank.includes('bank-hdfc-01') ||
      rawLoans.includes('loan-home-01') ||
      rawLoans.includes('4500000') ||
      window.localStorage.getItem('mm_data_version') !== 'v2_clean';

    if (isLegacyMock) {
      [
        'mm_bank_accounts',
        'mm_expenses',
        'mm_habitual',
        'mm_medical',
        'mm_students',
        'mm_education',
        'mm_loans',
        'mm_investments',
        'mm_goals',
        'mm_transactions',
        'mm_category_overrides',
        'mm_advisor_sessions',
      ].forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.setItem('mm_data_version', 'v2_clean');
    }
  }

  // Collections state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    if (!browserStorage) return initialBankAccounts;
    const saved = browserStorage.getItem('mm_bank_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialBankAccounts;
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    if (!browserStorage) return initialExpenses;
    const saved = browserStorage.getItem('mm_expenses');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialExpenses;
  });

  const [habitualExpenses, setHabitualExpenses] = useState<HabitualExpense[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_habitual');
    return saved ? JSON.parse(saved) : [];
  });

  const [medicalExpenses, setMedicalExpenses] = useState<MedicalExpenseRecord[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_medical');
    return saved ? JSON.parse(saved) : [];
  });

  const [students, setStudents] = useState<StudentProfile[]>(() => {
    if (!browserStorage) return initialStudents;
    const saved = browserStorage.getItem('mm_students');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialStudents;
  });

  const [educationExpenses, setEducationExpenses] = useState<EducationExpenseRecord[]>(() => {
    if (!browserStorage) return initialEducationExpenses;
    const saved = browserStorage.getItem('mm_education');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialEducationExpenses;
  });

  const [loans, setLoans] = useState<LoanRecord[]>(() => {
    if (!browserStorage) return initialLoans;
    const saved = browserStorage.getItem('mm_loans');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialLoans;
  });

  const [investments, setInvestments] = useState<InvestmentAsset[]>(() => {
    if (!browserStorage) return initialInvestments;
    const saved = browserStorage.getItem('mm_investments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialInvestments;
  });

  const [goals, setGoals] = useState<FinancialGoal[]>(() => {
    if (!browserStorage) return initialGoals;
    const saved = browserStorage.getItem('mm_goals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialGoals;
  });

  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => {
    if (!browserStorage) return initialTransactions;
    const saved = browserStorage.getItem('mm_transactions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return initialTransactions;
  });

  const clearAllData = useCallback(() => {
    setBankAccounts([]);
    setExpenses([]);
    setHabitualExpenses([]);
    setMedicalExpenses([]);
    setStudents([]);
    setEducationExpenses([]);
    setLoans([]);
    setInvestments([]);
    setGoals([]);
    setTransactions([]);
    if (browserStorage) {
      browserStorage.removeItem('mm_bank_accounts');
      browserStorage.removeItem('mm_expenses');
      browserStorage.removeItem('mm_habitual');
      browserStorage.removeItem('mm_medical');
      browserStorage.removeItem('mm_students');
      browserStorage.removeItem('mm_education');
      browserStorage.removeItem('mm_loans');
      browserStorage.removeItem('mm_investments');
      browserStorage.removeItem('mm_goals');
      browserStorage.removeItem('mm_transactions');
      browserStorage.removeItem('mm_category_overrides');
      browserStorage.removeItem('mm_advisor_sessions');
      browserStorage.removeItem('mm_sessions');
    }

    // Also wipe backend SQLite/Firestore ledger so all modules stay synchronized
    fetch('/api/wipe', { method: 'POST' })
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('mm_ledger_updated'));
        }
      })
      .catch(() => {});
  }, [browserStorage]);

  // Reset in-memory states whenever user logs out
  useEffect(() => {
    const handleLogout = () => {
      clearAllData();
    };
    window.addEventListener('mm_logout', handleLogout);
    return () => {
      window.removeEventListener('mm_logout', handleLogout);
    };
  }, [clearAllData]);

  // Sync with backend API (/api/ingest) on load and on demand
  const syncWithBackend = useCallback(async () => {
    try {
      const res = await fetch('/api/ingest', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.transactions)) return;

      const rawTxns = data.transactions as Array<{
        id: number | string;
        account_id: string;
        date: string;
        amount_paise: number;
        clean_narration: string;
        raw_narration: string;
        category: string | null;
        type: string;
        flags?: Record<string, unknown>;
      }>;

      if (rawTxns.length === 0) return;

      // Group accounts
      const accountMap = new Map<string, { totalBalance: number; label: string }>();
      const mappedTransactions: TransactionRecord[] = [];
      const mappedExpenses: ExpenseRecord[] = [];

      rawTxns.forEach((t) => {
        const isCredit = t.amount_paise > 0;
        const absAmount = Math.abs(t.amount_paise) / 100;
        const description = t.clean_narration || t.raw_narration || 'Transaction';
        const accountId = t.account_id || 'Primary-Account';
        const isInternal = t.type === 'transfer' || Boolean(t.flags?.transfer);

        // Track running account balance
        const acc = accountMap.get(accountId) || { totalBalance: 0, label: accountId };
        acc.totalBalance += t.amount_paise / 100;
        accountMap.set(accountId, acc);

        const userOverrides: Record<string, ExpenseCategory> = browserStorage
          ? JSON.parse(browserStorage.getItem('mm_category_overrides') || '{}')
          : {};
        const normDesc = description.toLowerCase().trim();
        const overriddenCat = userOverrides[normDesc] || Object.entries(userOverrides).find(([k]) => normDesc.includes(k) || k.includes(normDesc))?.[1];

        const lex = categorizeDescriptor(description);
        const mappedCat: ExpenseCategory = overriddenCat || lex.category;

        const txRecord: TransactionRecord = {
          id: `be-tx-${t.id || t.clean_narration}-${t.date}`,
          date: t.date,
          description,
          amount: absAmount,
          type: isCredit ? 'CREDIT' : 'DEBIT',
          category: mappedCat,
          bankAccountId: accountId,
          paymentMethod: 'UPI',
          associatedUserId: currentUser.id,
          source: 'STATEMENT_IMPORT',
          verificationStatus: 'VERIFIED',
          isInternalTransfer: isInternal,
        };
        mappedTransactions.push(txRecord);

        if (!isCredit && !isInternal) {
          mappedExpenses.push({
            id: `be-exp-${t.id || t.clean_narration}-${t.date}`,
            amount: absAmount,
            date: t.date,
            category: mappedCat,
            subcategory: lex.subcategory,
            paymentMethod: 'UPI',
            bankAccountId: accountId,
            description,
            familyMemberId: currentUser.id,
            familyMemberName: currentUser.name,
            isRecurring: Boolean(lex.isRecurring),
            status: 'ACTUAL',
          });
        }
      });

      // Update Bank Accounts
      const mappedAccounts: BankAccount[] = Array.from(accountMap.entries()).map(([id, info], idx) => ({
        id,
        bankName: info.label.replace(/_/g, ' '),
        nickname: info.label.replace(/_/g, ' '),
        accountType: 'Savings',
        maskedAccountNumber: `•••• ${1000 + idx * 234}`,
        openingBalance: 0,
        currentBalance: Math.max(0, Math.round(info.totalBalance)),
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        status: 'ACTIVE',
        color: ['#3B82F6', '#4F7CAC', '#16A579', '#7C3AED'][idx % 4],
      }));

      setTransactions(mappedTransactions);
      setExpenses(mappedExpenses);
      if (mappedAccounts.length > 0) {
        setBankAccounts(mappedAccounts);
      }

      // Automatically synthesize habitual expenses from detected recurring patterns
      setHabitualExpenses(prev => detectHabitualExpenses(mappedExpenses, prev));
    } catch {
      // Backend sync error handled gracefully
    }
  }, [currentUser]);

  useEffect(() => {
    void syncWithBackend();

    // Auto-refresh: listen to statement upload events across tabs & components
    const handleUpdate = () => {
      void syncWithBackend();
    };

    window.addEventListener('mm_ledger_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    // Regular background polling every 8 seconds to prevent stale cache
    const interval = setInterval(() => {
      void syncWithBackend();
    }, 8000);

    return () => {
      window.removeEventListener('mm_ledger_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [syncWithBackend]);

  // Sync to local storage
  useEffect(() => {
    browserStorage?.setItem('mm_bank_accounts', JSON.stringify(bankAccounts));
  }, [bankAccounts, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_expenses', JSON.stringify(expenses));
  }, [expenses, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_habitual', JSON.stringify(habitualExpenses));
  }, [habitualExpenses, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_medical', JSON.stringify(medicalExpenses));
  }, [medicalExpenses, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_students', JSON.stringify(students));
  }, [students, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_education', JSON.stringify(educationExpenses));
  }, [educationExpenses, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_loans', JSON.stringify(loans));
  }, [loans, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_investments', JSON.stringify(investments));
  }, [investments, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_goals', JSON.stringify(goals));
  }, [goals, browserStorage]);

  useEffect(() => {
    browserStorage?.setItem('mm_transactions', JSON.stringify(transactions));
  }, [transactions, browserStorage]);

  // Operations
  const addBankAccount = (acc: Omit<BankAccount, 'id'>) => {
    const newAccount: BankAccount = { ...acc, id: `bank-${Date.now()}` };
    setBankAccounts(prev => [...prev, newAccount]);

    // Persist account and opening balance to backend
    fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newAccount.id,
        bank: newAccount.bankName,
        label: newAccount.nickname || newAccount.bankName,
        opening_balance: newAccount.openingBalance || 0,
      }),
    })
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('mm_ledger_updated'));
        }
      })
      .catch(() => {});
  };

  const addExpense = (exp: Omit<ExpenseRecord, 'id'>) => {
    const newExp: ExpenseRecord = { ...exp, id: `exp-${Date.now()}` };
    setExpenses(prev => [newExp, ...prev]);

    // Also deduct balance from bank account if specified
    if (newExp.bankAccountId) {
      setBankAccounts(prev => prev.map(acc => {
        if (acc.id === newExp.bankAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - newExp.amount };
        }
        return acc;
      }));
    }

    // Add matching transaction record
    const newTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      date: newExp.date,
      description: newExp.description,
      amount: newExp.amount,
      type: 'DEBIT',
      category: newExp.category,
      bankAccountId: newExp.bankAccountId || bankAccounts[0]?.id || 'bank-1',
      paymentMethod: (newExp.paymentMethod as any) || 'UPI',
      associatedUserId: newExp.familyMemberId,
      source: 'MANUAL',
      verificationStatus: 'VERIFIED'
    };
    setTransactions(prev => [newTx, ...prev]);

    // Persist to backend ledger
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: newExp.amount,
        description: newExp.description,
        date: newExp.date,
        type: 'debit',
        category: newExp.category,
        account_id: newExp.bankAccountId || 'Primary_Account',
      }),
    })
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('mm_ledger_updated'));
        }
      })
      .catch(() => {});
  };

  const updateExpense = (id: string, updated: Partial<ExpenseRecord>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
  };

  const propagateCategoryOverride = (targetDesc: string, newCategory: ExpenseCategory) => {
    const norm = targetDesc.toLowerCase().trim();
    let count = 0;
    setExpenses(prev => prev.map(e => {
      if (e.description.toLowerCase().includes(norm) || norm.includes(e.description.toLowerCase())) {
        count++;
        return { ...e, category: newCategory };
      }
      return e;
    }));

    // Also persist correction to backend alias table
    fetch('/api/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern: targetDesc,
        category: newCategory,
      }),
    })
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('mm_ledger_updated'));
        }
      })
      .catch(() => {});

    // Update local overrides map so subsequent syncs preserve the user choice
    if (browserStorage) {
      const overrides = JSON.parse(browserStorage.getItem('mm_category_overrides') || '{}');
      overrides[norm] = newCategory;
      browserStorage.setItem('mm_category_overrides', JSON.stringify(overrides));
    }

    // Auto-link: if user selects category corresponding to a dedicated sub-module,
    // automatically mirror it into that module so it appears on that tab
    if (newCategory === 'Medical & Health') {
      const matched = expenses.filter(e => e.description.toLowerCase().includes(norm) || norm.includes(e.description.toLowerCase()));
      matched.forEach(item => {
        setMedicalExpenses(prev => {
          if (prev.some(m => m.id === `med-auto-${item.id}` || m.notes === item.id)) return prev;
          return [
            {
              id: `med-auto-${item.id}`,
              patientName: item.familyMemberName || currentUser.name || 'Self',
              date: item.date,
              type: 'Doctor Consultation',
              amount: item.amount,
              insuranceClaimStatus: 'NOT_APPLIED',
              doctorHospital: item.description,
              notes: item.id
            },
            ...prev
          ];
        });
      });
    } else if (newCategory === 'Education') {
      const matched = expenses.filter(e => e.description.toLowerCase().includes(norm) || norm.includes(e.description.toLowerCase()));
      matched.forEach(item => {
        const student = students[0];
        setEducationExpenses(prev => {
          if (prev.some(ed => ed.id === `edu-auto-${item.id}`)) return prev;
          return [
            {
              id: `edu-auto-${item.id}`,
              studentId: student?.id || 'stu-default',
              studentName: student?.studentName || item.familyMemberName || 'Student',
              date: item.date,
              type: 'School / College Tuition',
              amount: item.amount,
              academicYear: '2026-2027',
              receiptNumber: item.receiptName || 'AUTO-IMPORT'
            },
            ...prev
          ];
        });
      });
    } else if (newCategory === 'Subscriptions' || newCategory === 'Electricity & Utilities') {
      const matched = expenses.filter(e => e.description.toLowerCase().includes(norm) || norm.includes(e.description.toLowerCase()));
      matched.forEach(item => {
        setHabitualExpenses(prev => {
          if (prev.some(h => h.title.toLowerCase() === item.description.toLowerCase())) return prev;
          const d = new Date(item.date);
          const nextD = new Date(item.date);
          nextD.setMonth(nextD.getMonth() + 1);
          return [
            {
              id: `hab-auto-${item.id}`,
              title: item.description,
              category: newCategory,
              amount: item.amount,
              frequency: 'Monthly',
              expectedDayOfMonth: d.getDate() || 5,
              lastPaymentDate: item.date,
              nextPaymentDate: nextD.toISOString().slice(0, 10),
              historicalChange: 0,
              confidenceScore: 90,
              status: 'CONFIRMED',
              bankAccountId: item.bankAccountId || 'Primary-Account'
            },
            ...prev
          ];
        });
      });
    }

    return { updatedCount: count };
  };

  const undoCategoryPropagation = (previousSnapshot: ExpenseRecord[]) => {
    setExpenses(previousSnapshot);
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));

    // Also delete from backend ledger if it corresponds to a backend txn
    const rawId = id.replace(/^(be-exp-|be-tx-|exp-|tx-)/, '');
    fetch(`/api/transactions/${rawId}`, { method: 'DELETE' })
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('mm_ledger_updated'));
        }
      })
      .catch(() => {});
  };

  const updateHabitualStatus = (id: string, status: 'CONFIRMED' | 'DETECTED' | 'DISMISSED') => {
    setHabitualExpenses(prev => prev.map(h => h.id === id ? { ...h, status } : h));
  };

  const addHabitualExpense = (hab: Omit<HabitualExpense, 'id'>) => {
    const newHab: HabitualExpense = { ...hab, id: `hab-${Date.now()}` };
    setHabitualExpenses(prev => [...prev, newHab]);
  };

  const deleteHabitualExpense = (id: string) => {
    setHabitualExpenses(prev => prev.filter(h => h.id !== id));
  };

  const addMedicalExpense = (med: Omit<MedicalExpenseRecord, 'id'>) => {
    const newMed: MedicalExpenseRecord = { ...med, id: `med-${Date.now()}` };
    setMedicalExpenses(prev => [newMed, ...prev]);

    // Also mirror to global expenses & backend transactions as 'Medical & Health'
    addExpense({
      amount: med.amount,
      category: 'Medical & Health',
      subcategory: med.type,
      description: `Medical: ${med.patientName} - ${med.doctorHospital || med.type}`,
      date: med.date,
      paymentMethod: 'UPI',
      bankAccountId: bankAccounts[0]?.id || '',
      familyMemberId: currentUser.id,
      familyMemberName: med.patientName,
      isRecurring: false,
      status: 'ACTUAL'
    });
  };

  const updateMedicalExpense = (id: string, updated: Partial<MedicalExpenseRecord>) => {
    setMedicalExpenses(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
  };

  const deleteMedicalExpense = (id: string) => {
    setMedicalExpenses(prev => prev.filter(m => m.id !== id));
  };

  const addStudent = (student: Omit<StudentProfile, 'id'>) => {
    const newStudent: StudentProfile = { ...student, id: `stu-${Date.now()}` };
    setStudents(prev => [...prev, newStudent]);
  };

  const addEducationExpense = (edu: Omit<EducationExpenseRecord, 'id'>) => {
    const newEdu: EducationExpenseRecord = { ...edu, id: `edu-${Date.now()}` };
    setEducationExpenses(prev => [newEdu, ...prev]);

    // Also mirror to global expenses & backend transactions as 'Education'
    addExpense({
      amount: edu.amount,
      category: 'Education',
      subcategory: edu.type,
      description: `Education: ${edu.studentName} - ${edu.type} (${edu.academicYear})`,
      date: edu.date,
      paymentMethod: 'NetBanking',
      bankAccountId: bankAccounts[0]?.id || '',
      familyMemberId: currentUser.id,
      familyMemberName: edu.studentName,
      isRecurring: false,
      status: 'ACTUAL'
    });
  };

  const deleteEducationExpense = (id: string) => {
    setEducationExpenses(prev => prev.filter(e => e.id !== id));
  };

  const addLoan = (loan: Omit<LoanRecord, 'id'>) => {
    const newLoan: LoanRecord = { ...loan, id: `loan-${Date.now()}` };
    setLoans(prev => [...prev, newLoan]);
  };

  const deleteLoan = (id: string) => {
    setLoans(prev => prev.filter(l => l.id !== id));
  };

  const recordLoanPrepayment = (loanId: string, amount: number) => {
    const targetLoan = loans.find(l => l.id === loanId);
    setLoans(prev => prev.map(l => {
      if (l.id === loanId) {
        const newPrincipal = Math.max(0, l.outstandingPrincipal - amount);
        return {
          ...l,
          outstandingPrincipal: newPrincipal,
          totalPrepaid: l.totalPrepaid + amount
        };
      }
      return l;
    }));

    // Record as prepayment expense
    if (amount > 0) {
      addExpense({
        amount,
        category: 'Loan Repayments / EMI',
        subcategory: 'Principal Prepayment',
        description: `Prepayment: ${targetLoan?.name || 'Loan'} (${targetLoan?.lender || ''})`,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'NetBanking',
        bankAccountId: bankAccounts[0]?.id || '',
        familyMemberId: currentUser.id,
        familyMemberName: currentUser.name,
        isRecurring: false,
        status: 'ACTUAL'
      });
    }
  };

  const addInvestment = (inv: Omit<InvestmentAsset, 'id'>) => {
    const newInv: InvestmentAsset = { ...inv, id: `inv-${Date.now()}` };
    setInvestments(prev => [...prev, newInv]);
  };

  const deleteInvestment = (id: string) => {
    setInvestments(prev => prev.filter(inv => inv.id !== id));
  };

  const addGoal = (goal: Omit<FinancialGoal, 'id'>) => {
    const newGoal: FinancialGoal = { ...goal, id: `goal-${Date.now()}` };
    setGoals(prev => [...prev, newGoal]);
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const contributeToGoal = (goalId: string, amount: number) => {
    setGoals(prev => prev.map(g => {
      if (g.id === goalId) {
        const updated = g.currentAmount + amount;
        return {
          ...g,
          currentAmount: updated,
          status: updated >= g.targetAmount ? 'COMPLETED' : g.status
        };
      }
      return g;
    }));
  };

  const addTransaction = (tx: Omit<TransactionRecord, 'id'>) => {
    const newTx: TransactionRecord = { ...tx, id: `tx-${Date.now()}` };
    setTransactions(prev => [newTx, ...prev]);
  };

  const importBankTransactions = (newTxs: Omit<TransactionRecord, 'id'>[]) => {
    const stamped: TransactionRecord[] = newTxs.map((t, idx) => ({
      ...t,
      id: `tx-imp-${Date.now()}-${idx}`
    }));
    setTransactions(prev => [...stamped, ...prev]);

    // Also mirror debit non-internal transactions into expenses
    const newExpenses: ExpenseRecord[] = stamped
      .filter(t => t.type === 'DEBIT' && !t.isInternalTransfer)
      .map(t => ({
        id: `exp-${t.id}`,
        amount: t.amount,
        date: t.date,
        category: t.category,
        paymentMethod: t.paymentMethod,
        bankAccountId: t.bankAccountId,
        description: t.description,
        familyMemberId: t.associatedUserId || currentUser.id,
        familyMemberName: currentUser.name,
        isRecurring: false,
        status: 'ACTUAL'
      }));
    if (newExpenses.length > 0) {
      setExpenses(prev => [...newExpenses, ...prev]);
    }
  };

  // Rigorous aggregate calculations without double-counting internal transfers
  const monthlyIncome = transactions
    .filter(t => t.type === 'CREDIT' && !t.isInternalTransfer)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = expenses
    .filter(e => e.status === 'ACTUAL')
    .reduce((sum, e) => sum + e.amount, 0);

  const remainingBalance = monthlyIncome - monthlyExpenses;

  const totalSavingsBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);
  const totalInvestmentValuation = investments.reduce((sum, i) => sum + i.currentValuation, 0);
  const totalInvestedPrincipal = investments.reduce((sum, i) => sum + i.investedPrincipal, 0);
  const totalLoanPrincipal = loans.reduce((sum, l) => sum + l.outstandingPrincipal, 0);
  const monthlyEmiCommitments = loans.reduce((sum, l) => sum + l.emiAmount, 0);
  
  const savingsRatePercentage = monthlyIncome > 0 
    ? Math.max(0, Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100))
    : 0;


  const netWorth = (totalSavingsBalance + totalInvestmentValuation) - totalLoanPrincipal;

  return (
    <FinancialContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        activeSubmodule,
        setActiveSubmodule,
        isDarkMode,
        toggleDarkMode,
        currentUser,
        setCurrentUser,
        family,
        isFamilyView,
        setIsFamilyView,
        clearAllData,
        syncWithBackend,
        bankAccounts,
        addBankAccount,
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
        updateMedicalExpense,
        deleteMedicalExpense,
        students,
        addStudent,
        educationExpenses,
        addEducationExpense,
        deleteEducationExpense,
        loans,
        addLoan,
        deleteLoan,
        recordLoanPrepayment,
        investments,
        addInvestment,
        deleteInvestment,
        goals,
        addGoal,
        deleteGoal,
        contributeToGoal,
        transactions,
        addTransaction,
        importBankTransactions,
        metrics: {
          monthlyIncome,
          monthlyExpenses,
          remainingBalance,
          totalSavingsBalance,
          totalInvestmentValuation,
          totalInvestedPrincipal,
          totalLoanPrincipal,
          monthlyEmiCommitments,
          savingsRatePercentage,
          netWorth
        }
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
};
