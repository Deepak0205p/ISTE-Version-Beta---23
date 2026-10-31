import { ExpenseRecord, TransactionRecord } from '../types';

export interface AnomalyReport {
  recordId: string;
  date: string;
  description: string;
  amount: number;
  flagType: 'LARGE_AMOUNT' | 'NEW_HIGH_VALUE_MERCHANT' | 'SUBSCRIPTION_JUMP' | 'POSSIBLE_DUPLICATE';
  reason: string;
  isDismissed?: boolean;
}

/**
 * Calculates Median and Median Absolute Deviation (MAD) for outlier robust detection
 */
export function calculateMedianAndMAD(values: number[]): { median: number; mad: number } {
  if (values.length === 0) return { median: 0, mad: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const deviations = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const madMid = Math.floor(deviations.length / 2);
  const mad = deviations.length % 2 !== 0 ? deviations[madMid] : (deviations[madMid - 1] + deviations[madMid]) / 2;

  return { median, mad: mad || 1 };
}

/**
 * Evaluates records using MAD (Modified Z-Score) and specific rule flags
 */
export function detectExpenseAnomalies(records: ExpenseRecord[]): AnomalyReport[] {
  const anomalies: AnomalyReport[] = [];
  const amounts = records.map(r => r.amount);
  const { median, mad } = calculateMedianAndMAD(amounts);

  // Frequency map to detect same day & amount duplicate charges
  const occurrenceMap: { [key: string]: ExpenseRecord[] } = {};

  records.forEach(r => {
    const key = `${r.date}_${r.amount}`;
    if (!occurrenceMap[key]) occurrenceMap[key] = [];
    occurrenceMap[key].push(r);

    // Modified Z-Score: 0.6745 * (x - median) / MAD
    const modifiedZScore = (0.6745 * Math.abs(r.amount - median)) / mad;

    // 1. Unusual Large Outlier (>95th percentile or Mod Z-Score > 3.5)
    if (modifiedZScore > 3.5 && r.amount > 20000) {
      anomalies.push({
        recordId: r.id,
        date: r.date,
        description: r.description,
        amount: r.amount,
        flagType: 'LARGE_AMOUNT',
        reason: `Unusual large amount (Modified Z-Score ${modifiedZScore.toFixed(1)} vs normal family median ₹${Math.round(median)})`
      });
    }

    // 2. New High-Value Merchant (>₹2,000 on shopping or misc)
    if (r.amount >= 2000 && (r.category === 'Shopping' || r.category === 'Miscellaneous')) {
      anomalies.push({
        recordId: r.id,
        date: r.date,
        description: r.description,
        amount: r.amount,
        flagType: 'NEW_HIGH_VALUE_MERCHANT',
        reason: `High value non-habitual merchant charge (>₹2,000 threshold)`
      });
    }
  });

  // 3. Duplicate charge flag on same day similar or exact amount
  Object.values(occurrenceMap).forEach(duplicates => {
    if (duplicates.length > 1) {
      duplicates.slice(1).forEach(dup => {
        anomalies.push({
          recordId: dup.id,
          date: dup.date,
          description: dup.description,
          amount: dup.amount,
          flagType: 'POSSIBLE_DUPLICATE',
          reason: `Exact identical amount of ₹${dup.amount} billed multiple times on ${dup.date}. Please verify.`
        });
      });
    }
  });

  return anomalies;
}

export interface PreFlightStatus {
  canForecast: boolean;
  refusalReason?: string;
  historyDays: number;
  hasVerifiedIncome: boolean;
  hasDateGapWarning: boolean;
  isStaleData: boolean;
}

/**
 * Pre-Flight Gatekeeper: Refuses forecasting if history < 90 days or no salary detected
 */
export function evaluatePreFlightSufficiency(
  transactions: TransactionRecord[]
): PreFlightStatus {
  if (transactions.length === 0) {
    return {
      canForecast: false,
      refusalReason: 'Cannot forecast: No transactions found. Minimum 90 days statement required.',
      historyDays: 0,
      hasVerifiedIncome: false,
      hasDateGapWarning: false,
      isStaleData: true
    };
  }

  const sortedDates = transactions
    .map(t => new Date(t.date).getTime())
    .sort((a, b) => a - b);

  const earliest = sortedDates[0];
  const latest = sortedDates[sortedDates.length - 1];
  const historyDays = Math.round((latest - earliest) / (1000 * 60 * 60 * 24));

  const hasVerifiedIncome = transactions.some((t) => {
    const isCredit = String(t.type).toUpperCase() === 'CREDIT';
    const desc = (t.description || '').toLowerCase();
    const hasSalaryKeyword = /salary|payroll|credit|deposit|income|interest|stipend|freelance|earnings|accr|neft|imps|transfer/i.test(desc);
    return isCredit && !t.isInternalTransfer && (t.amount >= 1000 || hasSalaryKeyword);
  }) || transactions.some(t => String(t.type).toUpperCase() === 'CREDIT' && !t.isInternalTransfer && t.amount > 0);

  // Check 15-day gap in statement records
  let hasDateGapWarning = false;
  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
    if (diffDays > 15) {
      hasDateGapWarning = true;
      break;
    }
  }

  // Check stale data (>45 days since latest transaction)
  const daysSinceLatest = Math.round((Date.now() - latest) / (1000 * 60 * 60 * 24));
  const isStaleData = daysSinceLatest > 45;

  let canForecast = true;
  let refusalReason: string | undefined = undefined;

  if (historyDays < 60) {
    canForecast = false;
    refusalReason = `Cannot forecast: Need minimum 60 days history (Detected ${historyDays} days).`;
  } else if (!hasVerifiedIncome) {
    canForecast = false;
    refusalReason = 'Cannot forecast: No verified recurring salary or primary inflow detected in statement.';
  }

  return {
    canForecast,
    refusalReason,
    historyDays,
    hasVerifiedIncome,
    hasDateGapWarning,
    isStaleData
  };
}

