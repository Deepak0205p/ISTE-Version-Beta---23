/**
 * CSV normalizer (Build Bible §6) — adapter config in, typed rows out.
 *
 * Frozen rules:
 *   - dates → ISO 8601 (YYYY-MM-DD)
 *   - money → integer paise, never floats (strip ₹, commas, spaces)
 *   - balance reconciliation: any row where opening + movement ≠ closing
 *     balance is REJECTED, not silently kept (free correctness check every
 *     bank gives you)
 *   - txn_hash = hash(account_id, date, amount_paise, ref, normalized narr)
 *
 * No bank-specific branching lives here — only the adapter config.
 */
import type { BankCsvAdapter } from "@/config/bankAdapters";
import { normalizeNarration, txnHash } from "@/lib/ledgerHygiene";
import type { LedgerTxn } from "@/lib/types";

export type NormalizedRow = LedgerTxn & {
  /** Set when balance reconciliation failed; row is not ingested. */
  rejected?: { reason: string; line: number };
};

export type NormalizeResult = {
  rows: NormalizedRow[];
  rejected: NormalizedRow[];
  stats: {
    parsed: number;
    rejected_balance: number;
    rejected_format: number;
    balance_reconciled: boolean;
    /** 'ascending' | 'descending' (newest-first exports) | 'mixed'. */
    sort_order: "ascending" | "descending" | "mixed";
    /** File is newest-first — parsed fine, but flag it for the user. */
    reversed_alert: boolean;
    /** Internal date gaps > 15 days — a row may be missing from the export. */
    date_gaps: { from: string; to: string; days: number }[];
    biggest_gap_days: number;
  };
};

// ---------------------------------------------------------------------------
// CSV tokenization (RFC 4180-ish: quotes, escaped quotes, CRLF)
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** strptime-ish date parse → ISO 8601, or null if unparseable. */
export function parseBankDate(raw: string, format: BankCsvAdapter["date_format"]): string | null {
  const s = raw.trim();
  if (!s) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (format === "%d %b %Y" || format === "%d-%b-%Y") {
    const m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{4})$/);
    if (!m) return null;
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return `${m[3]}-${pad(mo)}-${pad(Number(m[1]))}`;
  }

  if (format === "%Y-%m-%d") {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  }

  // %d/%m/%Y, %d-%m-%Y
  const sep = format === "%d/%m/%Y" ? "/" : "-";
  const m = s.match(new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{4})$`));
  if (!m) return null;
  return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
}

/**
 * "1,234.50" / "₹1,234.50" / "(1,234.50)" / "1234.50 Cr" → integer paise.
 * Returns null when the cell is not a number.
 */
export function parseAmountToPaise(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  // explicit Dr/Cr suffix: "500.00 Dr", "500 (Cr)"
  let sign = 1;
  const dirMatch = s.match(/^(.*?)\s*\(?(Dr|Cr)\)?$/i);
  if (dirMatch && dirMatch[1].trim() !== "") {
    s = dirMatch[1].trim();
    if (dirMatch[2].toLowerCase() === "dr") sign = -1;
  }

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  s = s.replace(/[₹$,\s]/g, "");
  if (!s) return null;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const [whole, frac = ""] = s.split(".");
  const paise = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  const value = negative ? -paise : paise;
  return sign * value;
}

/**
 * Balance cell → integer paise, sign preserved: a genuine negative running
 * balance (overdraft) must reconcile too — forcing it positive here would
 * reject correct rows.
 */
function parseBalance(raw: string): number | null {
  return parseAmountToPaise(raw);
}

function colIndex(header: string[], wanted: string): number {
  const target = wanted.trim().toLowerCase();
  return header.findIndex((h) => h.trim().toLowerCase() === target);
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Convert raw bank CSV text + adapter config into typed rows.
 *
 * Balance reconciliation walks the file in order:
 *   expected_closing = previous_closing + current_row_amount
 *   (amount is signed: debit negative, credit positive)
 * Mismatch → row rejected with the exact expected/got values.
 */
export function normalizeBankCsv(
  csvText: string,
  adapter: BankCsvAdapter,
  account_id: string,
): NormalizeResult {
  const allRows = parseCsv(csvText);
  const skip = adapter.skip_lines ?? 0;
  const body = allRows.slice(skip);
  if (body.length === 0) {
    return {
      rows: [],
      rejected: [],
      stats: {
        parsed: 0,
        rejected_balance: 0,
        rejected_format: 0,
        balance_reconciled: true,
        sort_order: "ascending",
        reversed_alert: false,
        date_gaps: [],
        biggest_gap_days: 0,
      },
    };
  }

  // Header = first row that contains date_col and narration_col.
  const headerIdx = body.findIndex(
    (r) =>
      r.some((c) => c.trim().toLowerCase() === adapter.date_col.toLowerCase()) &&
      r.some((c) => c.trim().toLowerCase() === adapter.narration_col.toLowerCase()),
  );
  if (headerIdx === -1) {
    throw new Error(
      `Header not found: expected columns "${adapter.date_col}" and "${adapter.narration_col}". Is this really a ${adapter.label} export?`,
    );
  }

  const header = body[headerIdx];
  const dateI = colIndex(header, adapter.date_col);
  const narrI = colIndex(header, adapter.narration_col);
  const refI = colIndex(header, adapter.ref_col);
  const balI = colIndex(header, adapter.balance_col);

  const amountCols = resolveAmountColumns(header, adapter);

  // ---- Phase 1: parse every row (no balance logic yet) --------------------
  type Entry = {
    line: number;
    date: string;
    amount: number;
    ref: string | null;
    clean: string;
    raw: string;
    balanceRaw: string;
  };
  const entries: Entry[] = [];
  let rejectedFormat = 0;
  const rejected: NormalizedRow[] = [];

  for (let r = headerIdx + 1; r < body.length; r++) {
    const cells = body[r];
    const line = r + 1 + skip;

    const dateRaw = cells[dateI] ?? "";
    const narrRaw = cells[narrI] ?? "";
    if (!dateRaw.trim() && !narrRaw.trim()) continue; // footer/garbage row

    const date = parseBankDate(dateRaw, adapter.date_format);
    const amount = readAmount(cells, amountCols);

    if (date === null || amount === null) {
      rejectedFormat++;
      rejected.push({
        account_id,
        date: date ?? "",
        amount_paise: amount ?? 0,
        raw_narration: narrRaw,
        clean_narration: normalizeNarration(narrRaw),
        ref: refI >= 0 ? (cells[refI]?.trim() || null) : null,
        category: null,
        type: "normal",
        flags: {},
        txn_hash: "",
        rejected: { reason: `unparseable date/amount at line ${line}`, line },
      });
      continue;
    }

    entries.push({
      line,
      date,
      amount,
      ref: refI >= 0 ? (cells[refI]?.trim() || null) : null,
      clean: normalizeNarration(narrRaw),
      raw: narrRaw,
      balanceRaw: balI >= 0 ? (cells[balI] ?? "") : "",
    });
  }

  // ---- Phase 2: sort order (newest-first exports are reconciled reversed) --
  let ascending = 0;
  let descending = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].date > entries[i - 1].date) ascending++;
    else if (entries[i].date < entries[i - 1].date) descending++;
  }
  const sortOrder: "ascending" | "descending" | "mixed" =
    entries.length < 2 || (ascending > 0 && descending === 0)
      ? "ascending"
      : descending > 0 && ascending === 0
        ? "descending"
        : "mixed";

  // The closing-balance chain is chronological: a newest-first export still
  // reconciles perfectly once read oldest → newest.
  const ordered = sortOrder === "descending" ? [...entries].reverse() : entries;

  // ---- Phase 3: strict balance reconciliation in chronological order ------
  const rows: NormalizedRow[] = [];
  let rejectedBalance = 0;
  let prevBalance: number | null = null;

  for (const e of ordered) {
    const row: NormalizedRow = {
      account_id,
      date: e.date,
      amount_paise: e.amount,
      raw_narration: e.raw,
      clean_narration: e.clean,
      ref: e.ref,
      category: null,
      type: "normal",
      flags: {},
      txn_hash: txnHash(account_id, e.date, e.amount, e.ref, e.clean),
    };

    if (adapter.validate_balance && balI >= 0) {
      const closing = parseBalance(e.balanceRaw);

      if (closing === null) {
        row.rejected = { reason: `missing/invalid closing balance at line ${e.line}`, line: e.line };
        rejected.push(row);
        rejectedBalance++;
        prevBalance = null; // chain broken — restart from this row's amount
        continue;
      }

      if (prevBalance !== null) {
        const expected: number = prevBalance + e.amount;
        if (Math.abs(expected - closing) > 0) {
          row.rejected = {
            reason: `balance mismatch at line ${e.line}: expected ${expected}, bank says ${closing}`,
            line: e.line,
          };
          rejected.push(row);
          rejectedBalance++;
          // Continue the computed chain (prev + amount) so ONE corrupt balance
          // cell rejects only its own row, not the rest of the file.
          prevBalance = expected;
          continue;
        }
      }

      prevBalance = closing;
    }

    rows.push(row);
  }

  // Output stays in file order (callers may want to show it as uploaded).
  if (sortOrder === "descending") rows.reverse();

  // ---- missing-row date gaps ---------------------------------------------
  const dates = rows.map((r) => r.date).sort();
  const dateGaps: { from: string; to: string; days: number }[] = [];
  let biggestGap = 0;
  for (let i = 1; i < dates.length; i++) {
    const days = Math.round(
      (Date.parse(dates[i] + "T00:00:00Z") - Date.parse(dates[i - 1] + "T00:00:00Z")) / 86_400_000,
    );
    if (days > biggestGap) biggestGap = days;
    if (days > 15) dateGaps.push({ from: dates[i - 1], to: dates[i], days });
  }

  return {
    rows,
    rejected,
    stats: {
      parsed: rows.length,
      rejected_balance: rejectedBalance,
      rejected_format: rejectedFormat,
      balance_reconciled: rejectedBalance === 0,
      sort_order: sortOrder,
      reversed_alert: sortOrder === "descending",
      date_gaps: dateGaps,
      biggest_gap_days: biggestGap,
    },
  };
}

type AmountCols =
  | { mode: "signed"; amount: number }
  | { mode: "dr_cr_pair"; debit: number; credit: number }
  | { mode: "single_with_flag"; amount: number; flag: number; debit_flags: string[] };

function resolveAmountColumns(header: string[], adapter: BankCsvAdapter): AmountCols {
  if (adapter.amount_mode === "signed") {
    const i = colIndex(header, adapter.amount_col ?? "");
    if (i === -1) throw new Error(`Amount column not found for adapter "${adapter.id}"`);
    return { mode: "signed", amount: i };
  }
  if (adapter.amount_mode === "dr_cr_pair") {
    const debit = colIndex(header, adapter.debit_col ?? "");
    const credit = colIndex(header, adapter.credit_col ?? "");
    if (debit === -1 || credit === -1) {
      throw new Error(`Dr/Cr columns not found for adapter "${adapter.id}"`);
    }
    return { mode: "dr_cr_pair", debit, credit };
  }
  const amount = colIndex(header, adapter.amount_col ?? "");
  const flag = colIndex(header, adapter.flag_col ?? "");
  if (amount === -1 || flag === -1) {
    throw new Error(`Amount/flag columns not found for adapter "${adapter.id}"`);
  }
  return {
    mode: "single_with_flag",
    amount,
    flag,
    debit_flags: (adapter.debit_flags ?? ["dr", "debit", "withdrawal"]).map((s) => s.toLowerCase()),
  };
}

function readAmount(cells: string[], cols: AmountCols): number | null {
  if (cols.mode === "signed") return parseAmountToPaise(cells[cols.amount] ?? "");

  if (cols.mode === "dr_cr_pair") {
    const dr = parseAmountToPaise(cells[cols.debit] ?? "");
    const cr = parseAmountToPaise(cells[cols.credit] ?? "");
    const hasDr = dr !== null && dr !== 0;
    const hasCr = cr !== null && cr !== 0;
    if (hasDr) return -Math.abs(dr);
    if (hasCr) return Math.abs(cr);
    if (dr !== null || cr !== null) return 0; // explicit zero row
    return null;
  }

  const amount = parseAmountToPaise(cells[cols.amount] ?? "");
  if (amount === null) return null;
  const flag = (cells[cols.flag] ?? "").trim().toLowerCase();
  return cols.debit_flags.includes(flag) ? -Math.abs(amount) : Math.abs(amount);
}
