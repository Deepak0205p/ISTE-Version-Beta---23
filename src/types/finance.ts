export type VerdictType = 'YES' | 'TIGHT' | 'NO' | 'REFUSED';

export type AnomalyType = 'DUPLICATE_P_CLASS' | 'NETTED_REVERSAL' | 'MAD_OUTLIER' | 'NORMAL';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  rawNarration: string;
  normalizedMerchant: string;
  category: string;
  account: string; // e.g. "HDFC-1234", "SBI-8890"
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  anomaly?: AnomalyType;
  anomalyDetails?: string;
  isExcludedFromBootstrap?: boolean;
  duplicateMergedWith?: string;
  isManualOverride?: boolean;
}

export interface BankStatementFile {
  id: string;
  fileName: string;
  accountLabel: string;
  bankFormat: 'HDFC Bank' | 'State Bank of India' | 'ICICI Bank' | 'Axis Bank';
  fileType: 'CSV' | 'PDF';
  status: 'RECONCILED' | 'PASSWORD_PROTECTED' | 'SCANNED_NO_TEXT' | 'PROCESSING';
  transactionCount: number;
  dateRange: string;
  openingBalance: number;
  closingBalance: number;
  calculatedClosingBalance: number;
  isReconciled: boolean;
  passwordPromptNeeded?: boolean;
}

export interface PersonaProfile {
  id: 'rohan' | 'meera' | 'arjun';
  name: string;
  tagline: string;
  archetype: 'Salaried' | 'Freelancer' | 'New Earner';
  currentBalance: number;
  defaultQuestion: string;
  defaultPrice: number;
  monthsOfData: number;
  description: string;
  files: BankStatementFile[];
  transactions: Transaction[];
}

export interface ForecastPercentiles {
  p10: number; // Worst-case 10th percentile
  p50: number; // Median 50th percentile
  p90: number; // Best-case 90th percentile
  minProjected: number;
  maxProjected: number;
  dayByDayProjection: Array<{
    day: number;
    p10: number;
    p50: number;
    p90: number;
  }>;
}

export interface BufferComponents {
  worstMonthVariableOvershoot: number;
  oneWeekEssentials: number;
  userBufferTotal: number;
}

export interface AffordabilityAuditReceipt {
  evaluatedAt: string;
  dataWindowDays: number;
  startDate: string;
  endDate: string;
  accountsIncluded: string[];
  totalTransactionsParsed: number;
  activeLedgerCount: number;
  internalTransfersExcluded: number;
  internalTransfersAmountNetted: number;
  nettedUpiReversalsCount: number;
  nettedUpiReversalsAmount: number;
  madAnomaliesExcludedCount: number;
  madAnomaliesTotalAmount: number;
  duplicateRowsResolved: number;
  formula: string;
  formulaVariables: {
    currentBalance: number;
    itemPrice: number;
    safetyBuffer: number;
    p10ProjectedBalance: number;
    p50ProjectedBalance: number;
    p90ProjectedBalance: number;
    headroomP10: number;
    headroomP50: number;
  };
  verdict: VerdictType;
  deterministicSeed: number;
  bootstrapDraws: number;
  blockSizeDays: number;
}
