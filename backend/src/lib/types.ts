/**
 * Shared ledger types — the shape every layer speaks.
 * Money is always integer paise; dates are always ISO 8601 strings.
 */

export type TxnType = "normal" | "transfer" | "netted" | "card_bill";

export type TxnFlags = {
  /** Fellegi-Sunter P-class: possible duplicate, asked about, never deleted. */
  dup_p?: boolean;
  /** M-class merge source (kept only in the merge log, row is merged away). */
  dup_m?: boolean;
  /** Modified z-score anomaly (MAD rule). */
  mad_anomaly?: boolean;
  /** Part of a failed-UPI/reversal pair that nets to zero. */
  netted?: boolean;
  /** Paired internal transfer between own accounts. */
  transfer?: boolean;
  /** Small-n MAD guard: flag is only "possible", not confirmed. */
  anomaly_possible?: boolean;
  /** User confirmed this row as the real one (P-class decision remembered). */
  user_kept?: boolean;
  /** User marked this row as a duplicate (P-class decision remembered). */
  user_duplicate?: boolean;
  /** Credit is a one-off (bonus/gift) — excluded from regular income. */
  one_off_income?: boolean;
  /** Human-readable anomaly reasons, one of the four exact reasons. */
  anomaly_reasons?: string[];
  /** Row removed from math by a what-if simulation (kept visible). */
  whatif_removed?: boolean;
};

export interface LedgerTxn {
  id?: number;
  account_id: string;
  /** ISO 8601: YYYY-MM-DD */
  date: string;
  /** Integer paise; debits negative, credits positive. */
  amount_paise: number;
  raw_narration: string;
  clean_narration: string;
  ref: string | null;
  category: string | null;
  type: TxnType;
  flags: TxnFlags;
  txn_hash: string;
}

export type Verdict = "YES" | "TIGHT" | "NO" | "REFUSED";

export type ForecastBand = {
  p10: number;
  p50: number;
  p90: number;
  method: "moving-block bootstrap";
  draws: number;
  block_days: number;
  horizon_days: number;
  seed: number;
};

export type BufferBreakdown = {
  buffer_paise: number;
  worst_month_overshoot_paise: number;
  one_week_essentials_paise: number;
  median_monthly_variable_paise: number;
  worst_month_variable_paise: number;
  median_daily_essential_paise: number;
  /** Which month produced the worst-case term, for the receipt trace. */
  worst_month: string;
  /** Branch A: minimum-account-balance headroom the bank demands. */
  mab_headroom_paise: number;
  /** Branch B: 15 × median daily essential spend (a bad fortnight). */
  fifteen_day_burn_paise: number;
  /** Branch C: the frozen volatility cushion (overshoot + 7× essentials). */
  volatility_cushion_paise: number;
  /** Which of the three branches won the max() — shown on the receipt. */
  dominant_branch: "mab" | "fifteen_day_burn" | "volatility";
};

export type Question = {
  item: string;
  price_inr: number;
  horizon: "next_month" | "this_month" | "custom_date";
  custom_date?: string;
};

/** A detected recurring commitment (subscription / EMI / SIP / rent). */
export type RecurringCommitment = {
  merchant: string;
  amount_paise: number;
  interval_days: number;
  next_expected_date: string;
  occurrences: number;
  confidence: "High" | "Low";
  kind: "subscription" | "emi" | "sip" | "rent" | "salary" | "utility";
  last_seen: string;
};

/** One point of the day-by-day projected cash floor. */
export type CashFloorPoint = {
  date: string;
  projected_balance_paise: number;
};

/** Walk-forward backtest: one held-out month at a time. */
export type BacktestEntry = {
  month: string;
  predicted_p50_paise: number;
  actual_close_paise: number;
  error_paise: number;
  error_pct: number;
};

export type BacktestScorecard = {
  ok: boolean;
  note: string;
  months_tested: number;
  mean_abs_error_pct: number | null;
  entries: BacktestEntry[];
};

/** What-if sandbox inputs (client can toggle these per question). */
export type WhatIf = {
  /** Merchant names whose recurring debits are cancelled in the scenario. */
  cancel_subscriptions?: string[];
  /** Convert the purchase to an EMI of this many rupees/month. */
  emi_monthly_inr?: number;
};
