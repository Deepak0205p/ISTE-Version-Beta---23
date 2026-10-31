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

// Clean zero-dummy state: all pages start empty without hardcoded mock data
export const initialBankAccounts: BankAccount[] = [];
export const initialExpenses: ExpenseRecord[] = [];
export const initialHabitualExpenses: HabitualExpense[] = [];
export const initialMedicalExpenses: MedicalExpenseRecord[] = [];
export const initialStudents: StudentProfile[] = [];
export const initialEducationExpenses: EducationExpenseRecord[] = [];
export const initialLoans: LoanRecord[] = [];
export const initialInvestments: InvestmentAsset[] = [];
export const initialGoals: FinancialGoal[] = [];
export const initialTransactions: TransactionRecord[] = [];
