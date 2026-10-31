/**
 * Bank CSV adapter registry (Build Bible §6).
 *
 * Do not build a universal parser — build a tiny adapter config per bank and
 * one strict normalizer behind it. Two or three adapters are enough for the
 * demo; the architecture is the point, not the count.
 *
 * Every adapter answers the same five questions about a bank's export:
 *   where is the date / narration / reference / balance, are amounts signed
 *   or split Dr/Cr, and how is the date written.
 */

/** How the bank encodes money in a CSV row. */
export type AmountMode =
  /** One signed column: debits negative, credits positive (HDFC Withdrawal/Deposit). */
  | "signed"
  /** Separate Withdrawal/Deposit (or Dr/Cr) columns — normalizer picks which fired (SBI). */
  | "dr_cr_pair"
  /** One unsigned column plus a direction column, e.g. amount + "Dr"/"Cr". */
  | "single_with_flag";

export type DateFormat =
  | "%d/%m/%Y" // 31/12/2026
  | "%d-%m-%Y" // 31-12-2026
  | "%d %b %Y" // 31 Dec 2026
  | "%Y-%m-%d" // 2026-12-31
  | "%d-%b-%Y"; // 31-Dec-2026

/**
 * Strict contract every bank adapter must satisfy.
 * The normalizer reads only these fields — no bank-specific branching.
 */
export interface BankCsvAdapter {
  /** Stable machine id, e.g. "hdfc". Used as the CSV's first-line detector. */
  id: string;
  /** Human label for the UI and receipts, e.g. "HDFC Bank". */
  label: string;
  /** Substrings that identify this bank's export in its header line. */
  headerSignals: string[];

  /** Header text of the transaction date column. */
  date_col: string;
  /** Header text of the narration/description column. */
  narration_col: string;
  /** How amounts are encoded (signed vs Dr/Cr). */
  amount_mode: AmountMode;

  /** amount_mode === "signed": which header holds the signed amount. */
  amount_col?: string;
  /** amount_mode === "dr_cr_pair": debit and credit column headers. */
  debit_col?: string;
  credit_col?: string;
  /** amount_mode === "single_with_flag": amount column + direction column. */
  flag_col?: string;
  /** Values in the direction column that mean "debit" (mirrored for credit). */
  debit_flags?: string[];

  /** Header of the reference column (Chq/Ref No) — part of the dedup key. */
  ref_col: string;
  /** Header of the closing-balance column — the free correctness check. */
  balance_col: string;
  /** strptime-style date format of date_col. */
  date_format: DateFormat;

  /** Header rows to discard before the real header (bank logos, footers). */
  skip_lines?: number;
  /** If true, rows whose running balance does not reconcile are rejected. */
  validate_balance?: boolean;
}

/**
 * Two initial adapters — HDFC-style and SBI-style (Build Bible §6 table).
 * Between them they cover both amount_mode families: signed column vs Dr/Cr pair.
 */
export const bankAdapters: BankCsvAdapter[] = [
  {
    id: "hdfc",
    label: "HDFC Bank",
    headerSignals: ["narration", "chq/ref no", "withdrawal", "deposit", "closing balance"],

    date_col: "Date",
    narration_col: "Narration",
    amount_mode: "dr_cr_pair",
    debit_col: "Withdrawal (Dr)",
    credit_col: "Deposit (Cr)",
    ref_col: "Chq/Ref No",
    balance_col: "Closing Balance",
    date_format: "%d/%m/%Y",

    skip_lines: 0,
    validate_balance: true,
  },
  {
    id: "sbi",
    label: "State Bank of India",
    headerSignals: ["txn date", "description", "ref no./cheque no", "balance"],

    date_col: "Txn Date",
    narration_col: "Description",
    amount_mode: "dr_cr_pair",
    debit_col: "Withdrawal Amt.",
    credit_col: "Deposit Amt.",
    ref_col: "Ref No./Cheque No",
    balance_col: "Balance",
    date_format: "%d %b %Y",

    skip_lines: 0,
    validate_balance: true,
  },
];

/** Header-line lowercase text → adapter, for auto-detecting an upload. */
export function detectAdapter(headerLine: string): BankCsvAdapter | undefined {
  const h = headerLine.toLowerCase();
  return bankAdapters.find((a) => a.headerSignals.every((s) => h.includes(s)));
}

export function getAdapter(id: string): BankCsvAdapter | undefined {
  return bankAdapters.find((a) => a.id === id);
}
