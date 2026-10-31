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
      name: 'User',
      email: '',
      avatar: '',
      role: 'ADMIN',
      familyId: 'fam_default'
    }
  ]
};

// Initial state starts completely clean without hardcoded transactions, loans or balances
export const initialBankAccounts: BankAccount[] = [];
export const initialTransactions: TransactionRecord[] = [];
export const initialExpenses: ExpenseRecord[] = [];
export const initialStudents: StudentProfile[] = [];
export const initialEducationExpenses: EducationExpenseRecord[] = [];
export const initialLoans: LoanRecord[] = [];
export const initialInvestments: InvestmentAsset[] = [];
export const initialGoals: FinancialGoal[] = [];
