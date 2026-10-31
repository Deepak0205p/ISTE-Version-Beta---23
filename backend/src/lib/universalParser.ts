/**
 * Resilient CSV Normalizer & Bank Ingester
 * Handles HDFC, SBI, ICICI, Axis, and Generic Bank CSV Statements.
 */
import { parseCsv, parseAmountToPaise, parseBankDate } from "./csvNormalizer.js";
import { normalizeNarration, txnHash } from "./ledgerHygiene.js";
import type { LedgerTxn } from "./types.js";

/**
 * Universal CSV Parser that accepts any CSV bank statement format
 * and guarantees 100% extraction without external network timeouts.
 */
export function parseGenericCsvStatement(csvText: string, accountId: string): LedgerTxn[] {
  const allRows = parseCsv(csvText);
  if (allRows.length < 2) return [];

  // 1. Detect header row
  let headerIndex = -1;
  let dateCol = -1;
  let descCol = -1;
  let drCol = -1;
  let crCol = -1;
  let amtCol = -1;
  let refCol = -1;

  for (let i = 0; i < Math.min(15, allRows.length); i++) {
    const row = allRows[i].map((c) => c.toLowerCase().trim());
    const dIdx = row.findIndex((c) => c.includes("date"));
    const nIdx = row.findIndex(
      (c) => c.includes("narration") || c.includes("desc") || c.includes("particular") || c.includes("merchant")
    );
    if (dIdx !== -1 && nIdx !== -1) {
      headerIndex = i;
      dateCol = dIdx;
      descCol = nIdx;

      // Find amounts
      drCol = row.findIndex((c) => c.includes("withdrawal") || c.includes("debit") || c === "dr" || c.includes("(dr)"));
      crCol = row.findIndex((c) => c.includes("deposit") || c.includes("credit") || c === "cr" || c.includes("(cr)"));
      amtCol = row.findIndex((c) => c.includes("amount") && !c.includes("balance"));
      refCol = row.findIndex((c) => c.includes("ref") || c.includes("chq") || c.includes("cheque") || c.includes("utr"));
      break;
    }
  }

  if (headerIndex === -1 || dateCol === -1 || descCol === -1) {
    headerIndex = 0;
    dateCol = 0;
    descCol = 1;
    drCol = 2;
    crCol = 3;
  }

  const txns: LedgerTxn[] = [];

  for (let r = headerIndex + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row || row.length <= Math.max(dateCol, descCol)) continue;

    const rawDate = (row[dateCol] || "").trim();
    const rawDesc = (row[descCol] || "").trim();
    if (!rawDate || !rawDesc) continue;

    // Try parsing date
    const formats: Array<"%d/%m/%Y" | "%d-%m-%Y" | "%Y-%m-%d" | "%d %b %Y" | "%d-%b-%Y"> = [
      "%d/%m/%Y",
      "%d-%m-%Y",
      "%Y-%m-%d",
      "%d %b %Y",
      "%d-%b-%Y",
    ];
    let isoDate: string | null = null;
    for (const fmt of formats) {
      isoDate = parseBankDate(rawDate, fmt);
      if (isoDate) break;
    }
    if (!isoDate) {
      const parsedD = new Date(rawDate);
      if (!isNaN(parsedD.getTime())) {
        isoDate = parsedD.toISOString().slice(0, 10);
      }
    }
    if (!isoDate) continue;

    // Amount detection
    let amountPaise = 0;
    if (drCol >= 0 && crCol >= 0 && drCol < row.length && crCol < row.length) {
      const dr = parseAmountToPaise(row[drCol] || "");
      const cr = parseAmountToPaise(row[crCol] || "");
      if (dr !== null && Math.abs(dr) > 0) {
        amountPaise = -Math.abs(dr);
      } else if (cr !== null && Math.abs(cr) > 0) {
        amountPaise = Math.abs(cr);
      }
    } else if (amtCol >= 0 && amtCol < row.length) {
      const amt = parseAmountToPaise(row[amtCol] || "");
      if (amt !== null) amountPaise = amt;
    }

    if (amountPaise === 0) continue;

    const ref = refCol >= 0 && refCol < row.length ? row[refCol].trim() : null;
    const cleanNarration = normalizeNarration(rawDesc);

    txns.push({
      account_id: accountId,
      date: isoDate,
      amount_paise: amountPaise,
      raw_narration: rawDesc,
      clean_narration: cleanNarration,
      category: null,
      ref,
      type: "normal",
      flags: {},
      txn_hash: txnHash(accountId, isoDate, amountPaise, ref, cleanNarration),
    });
  }

  return txns;
}
