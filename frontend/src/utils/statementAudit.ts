import { TransactionRecord } from '../types';

export interface AuditRowResult {
  rowIndex: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  statedBalance: number;
  calculatedBalance: number;
  isDiscrepancy: boolean;
  variance: number;
}

export interface StatementChainAuditReport {
  totalRows: number;
  validRows: number;
  brokenLinks: number;
  discrepancies: AuditRowResult[];
  status: 'CHAIN_INTACT' | 'DISCREPANCY_DETECTED' | 'REVERSED_SORT_SUSPECTED';
  initialBalance: number;
  finalBalance: number;
}

/**
 * Audits running balance chain: Balance_t = Balance_{t-1} + Credit_t - Debit_t
 */
export function auditRunningBalanceChain(
  rows: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>
): StatementChainAuditReport {
  if (rows.length === 0) {
    return {
      totalRows: 0,
      validRows: 0,
      brokenLinks: 0,
      discrepancies: [],
      status: 'CHAIN_INTACT',
      initialBalance: 0,
      finalBalance: 0
    };
  }

  const discrepancies: AuditRowResult[] = [];
  let calculated = rows[0].balance;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    calculated = calculated + (row.credit || 0) - (row.debit || 0);
    const variance = Math.abs(calculated - row.balance);

    if (variance > 0.5) { // allow small float precision tolerance
      discrepancies.push({
        rowIndex: i,
        date: row.date,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        statedBalance: row.balance,
        calculatedBalance: calculated,
        isDiscrepancy: true,
        variance
      });
      // reset chain anchor to stated to prevent cascade false alarms
      calculated = row.balance;
    }
  }

  const brokenLinks = discrepancies.length;
  let status: StatementChainAuditReport['status'] = 'CHAIN_INTACT';

  if (brokenLinks > rows.length * 0.6) {
    status = 'REVERSED_SORT_SUSPECTED';
  } else if (brokenLinks > 0) {
    status = 'DISCREPANCY_DETECTED';
  }

  return {
    totalRows: rows.length,
    validRows: rows.length - brokenLinks,
    brokenLinks,
    discrepancies,
    status,
    initialBalance: rows[0].balance,
    finalBalance: rows[rows.length - 1].balance
  };
}

/**
 * Generate composite hash for deduplication: account_id + date + amount + normalized_description
 */
export function generateTransactionHash(
  accountId: string,
  date: string,
  amount: number,
  description: string
): string {
  const normDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  return `${accountId}_${date}_${amount.toFixed(2)}_${normDesc}`;
}

