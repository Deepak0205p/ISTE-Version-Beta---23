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
} from '../data/initialData';
import { categorizeDescriptor } from '../utils/merchantLexicon';

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

  medicalExpenses: MedicalExpenseRecord[];
  addMedicalExpense: (record: Omit<MedicalExpenseRecord, 'id'>) => void;
  updateMedicalExpense: (id: string, record: Partial<MedicalExpenseRecord>) => void;

  students: StudentProfile[];
  educationExpenses: EducationExpenseRecord[];
  addEducationExpense: (record: Omit<EducationExpenseRecord, 'id'>) => void;

  loans: LoanRecord[];
  addLoan: (loan: Omit<LoanRecord, 'id'>) => void;
  recordLoanPrepayment: (loanId: string, amount: number) => void;

  investments: InvestmentAsset[];
  addInvestment: (inv: Omit<InvestmentAsset, 'id'>) => void;

  goals: FinancialGoal[];
  addGoal: (goal: Omit<FinancialGoal, 'id'>) => void;
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
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = browserStorage?.getItem('mm_theme');
    return saved !== null ? saved === 'dark' : false; // Default to Money Matters Clean Light mode
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

  // Collections state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_bank_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_expenses');
    return saved ? JSON.parse(saved) : [];
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

  const [students] = useState<StudentProfile[]>(initialStudents);
  const [educationExpenses, setEducationExpenses] = useState<EducationExpenseRecord[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_education');
    return saved ? JSON.parse(saved) : [];
  });

  const [loans, setLoans] = useState<LoanRecord[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_loans');
    return saved ? JSON.parse(saved) : [];
  });

  const [investments, setInvestments] = useState<InvestmentAsset[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_investments');
    return saved ? JSON.parse(saved) : [];
  });

  const [goals, setGoals] = useState<FinancialGoal[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_goals');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => {
    if (!browserStorage) return [];
    const saved = browserStorage.getItem('mm_transactions');
    return saved ? JSON.parse(saved) : [];
  });

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

        const lex = categorizeDescriptor(description);
        const mappedCat: ExpenseCategory = lex.category;

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
        color: ['#8D7A62', '#3B82F6', '#10B981', '#F59E0B'][idx % 4],
      }));

      setTransactions(mappedTransactions);
      setExpenses(mappedExpenses);
      if (mappedAccounts.length > 0) {
        setBankAccounts(mappedAccounts);
      }
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
    return { updatedCount: count };
  };

  const undoCategoryPropagation = (previousSnapshot: ExpenseRecord[]) => {
    setExpenses(previousSnapshot);
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const updateHabitualStatus = (id: string, status: 'CONFIRMED' | 'DETECTED' | 'DISMISSED') => {
    setHabitualExpenses(prev => prev.map(h => h.id === id ? { ...h, status } : h));
  };

  const addHabitualExpense = (hab: Omit<HabitualExpense, 'id'>) => {
    const newHab: HabitualExpense = { ...hab, id: `hab-${Date.now()}` };
    setHabitualExpenses(prev => [...prev, newHab]);
  };

  const addMedicalExpense = (med: Omit<MedicalExpenseRecord, 'id'>) => {
    const newMed: MedicalExpenseRecord = { ...med, id: `med-${Date.now()}` };
    setMedicalExpenses(prev => [newMed, ...prev]);
  };

  const updateMedicalExpense = (id: string, updated: Partial<MedicalExpenseRecord>) => {
    setMedicalExpenses(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
  };

  const addEducationExpense = (edu: Omit<EducationExpenseRecord, 'id'>) => {
    const newEdu: EducationExpenseRecord = { ...edu, id: `edu-${Date.now()}` };
    setEducationExpenses(prev => [newEdu, ...prev]);
  };

  const addLoan = (loan: Omit<LoanRecord, 'id'>) => {
    const newLoan: LoanRecord = { ...loan, id: `loan-${Date.now()}` };
    setLoans(prev => [...prev, newLoan]);
  };

  const recordLoanPrepayment = (loanId: string, amount: number) => {
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
  };

  const addInvestment = (inv: Omit<InvestmentAsset, 'id'>) => {
    const newInv: InvestmentAsset = { ...inv, id: `inv-${Date.now()}` };
    setInvestments(prev => [...prev, newInv]);
  };

  const addGoal = (goal: Omit<FinancialGoal, 'id'>) => {
    const newGoal: FinancialGoal = { ...goal, id: `goal-${Date.now()}` };
    setGoals(prev => [...prev, newGoal]);
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
    const stamped = newTxs.map((t, idx) => ({
      ...t,
      id: `tx-imp-${Date.now()}-${idx}`
    }));
    setTransactions(prev => [...stamped, ...prev]);
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

  const clearAllData = () => {
    setBankAccounts([]);
    setExpenses([]);
    setHabitualExpenses([]);
    setMedicalExpenses([]);
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
      browserStorage.removeItem('mm_education');
      browserStorage.removeItem('mm_loans');
      browserStorage.removeItem('mm_investments');
      browserStorage.removeItem('mm_goals');
      browserStorage.removeItem('mm_transactions');
    }
  };

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
        medicalExpenses,
        addMedicalExpense,
        updateMedicalExpense,
        students,
        educationExpenses,
        addEducationExpense,
        loans,
        addLoan,
        recordLoanPrepayment,
        investments,
        addInvestment,
        goals,
        addGoal,
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
