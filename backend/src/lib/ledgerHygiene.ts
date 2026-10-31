/**
 * Ledger hygiene (Build Bible §8) — pure, deterministic, explainable.
 *
 * Three frozen rules, in pipeline order:
 *   1. Fellegi-Sunter record linkage: M (identical hash) / P (possible) / U
 *      — P is FLAGGED AND ASKED, never deleted.
 *   2. Internal transfer pairing: A out + B in, same amount (≤ ₹1), same or
 *      adjacent day → type=transfer, excluded from income and spend.
 *   3. Failed UPI + reversal netting: pair nets to zero, stays visible.
 */
import type { LedgerTxn } from "./types";

/** ₹1 tolerance on transfer amounts, in paise (Build Bible §8). */
export const TRANSFER_TOLERANCE_PAISE = 100;
/** Transfers may land up to 2 days apart (settles over a weekend). */
export const TRANSFER_WINDOW_DAYS = 2;
/** Reversal must land within this many days (Build Bible §8). */
export const REVERSAL_WINDOW_DAYS = 7;
/** Narration keywords that mark a failed/declined/reversed payment. */
export const FAILED_KEYWORDS = ["FAILED", "DECLINED", "REVERSED", "RVRSL"];
/** Credit-card bill payments to your own card — money you owe yourself. */
export const CARD_BILL_KEYWORDS = [
  "CREDIT CARD",
  "CC A/C",
  "CARD PAYMENT",
  "HDFC CARD",
  "SBI CARD",
  "AXIS CARD",
  "ICICI CARD",
  "CARD PMT",
  "CC BILL",
];

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  return Math.round(Math.abs(da - db) / 86_400_000);
}

/** Whitespace-collapsed, uppercased narration used for all fuzzy comparisons. */
export function normalizeNarration(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function narrationKey(raw: string): string {
  return normalizeNarration(raw).toUpperCase();
}

/**
 * Stable transaction hash: sha256(account_id | date | amount_paise | ref |
 * normalized narration). Same input → same hash, across uploads, forever.
 * (async because Web Crypto is async; sync variant below for pure tests)
 */
export function hashInput(
  account_id: string,
  date: string,
  amount_paise: number,
  ref: string | null,
  clean_narration: string,
): string {
  return [account_id, date, amount_paise, ref ?? "", clean_narration.toUpperCase()].join("|");
}

/** Small deterministic non-crypto hash (FNV-1a, 64-bit-ish via two 32-bit lanes). */
export function fnv1aHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + c) >>> 0;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
    h2 ^= h2 >>> 13;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function txnHash(
  account_id: string,
  date: string,
  amount_paise: number,
  ref: string | null,
  clean_narration: string,
): string {
  return fnv1aHex(hashInput(account_id, date, amount_paise, ref, clean_narration));
}

// ---------------------------------------------------------------------------
// 1. Fellegi-Sunter three-class dedup
// ---------------------------------------------------------------------------

export type DupAction =
  | { kind: "M"; keep: number; drop: number[] } // identical hash → auto-merge + log
  | { kind: "P"; a: number; b: number }; // possible → flag both, ask

/**
 * M: identical txn_hash → merge (keep one row, log it).
 * P: same account, same amount, dates within 3 days, near-identical
 *    narration → flag BOTH rows, keep both, user decides.
 * U: everything else.
 *
 * Returns actions; the caller decides how to render them. Nothing is ever
 * removed by this function.
 */
export function classifyDuplicates(txns: LedgerTxn[]): DupAction[] {
  const actions: DupAction[] = [];

  // ---- M class: identical hash -------------------------------------------------
  const byHash = new Map<string, number[]>();
  txns.forEach((t, i) => {
    const list = byHash.get(t.txn_hash) ?? [];
    list.push(i);
    byHash.set(t.txn_hash, list);
  });
  for (const [, idxs] of byHash) {
    if (idxs.length > 1) {
      actions.push({ kind: "M", keep: idxs[0], drop: idxs.slice(1) });
    }
  }

  // ---- P class: same account, |Δamount| ≤ 0, Δdate ≤ 3d, near-identical narr --
  const mergedIdx = new Set<number>();
  for (const a of actions) {
    if (a.kind === "M") for (const d of a.drop) mergedIdx.add(d);
  }

  for (let i = 0; i < txns.length; i++) {
    if (mergedIdx.has(i)) continue;
    for (let j = i + 1; j < txns.length; j++) {
      if (mergedIdx.has(j)) continue;
      const A = txns[i];
      const B = txns[j];
      if (A.account_id !== B.account_id) continue;
      if (A.amount_paise !== B.amount_paise) continue;
      if (daysBetween(A.date, B.date) > 3) continue;
      if (!nearIdenticalNarration(A.clean_narration, B.clean_narration)) continue;
      actions.push({ kind: "P", a: i, b: j });
    }
  }

  return actions;
}

/**
 * Near-identical = one narration contains the other after normalization, or
 * token overlap ≥ 0.8 (whitespace/case-insensitive). Reference numbers are
 * stripped first — two ₹20 chai charges from different apps differ only there
 * and MUST be P-class, not U-class.
 */
export function nearIdenticalNarration(a: string, b: string): boolean {
  const na = narrationKey(stripRefs(a));
  const nb = narrationKey(stripRefs(b));
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = new Set(na.split(/[^A-Z0-9]+/).filter(Boolean));
  const tb = new Set(nb.split(/[^A-Z0-9]+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union > 0 && inter / union >= 0.8;
}

/** Blanks out long digit runs (UPI refs, cheque numbers) for fuzzy compare. */
export function stripRefs(narration: string): string {
  return narration.replace(/\d{5,}/g, "#");
}

/**
 * Apply dedup decisions to a copy of the ledger.
 *
 * M → rows merged into the keeper (kept row accumulates a `merged_count`),
 *     drop list logged, rows removed from the returned ledger.
 * P → BOTH rows kept, flags.dup_p set, never deleted.
 */
export function applyDedup(txns: LedgerTxn[]): {
  txns: LedgerTxn[];
  merged: number;
  flaggedPairs: number;
  mergeLog: { hash: string; kept_id?: number; removed: number }[];
} {
  const working = txns.map((t) => ({ ...t, flags: { ...t.flags } }));
  const actions = classifyDuplicates(working);

  const removed = new Set<number>();
  const mergeLog: { hash: string; kept_id?: number; removed: number }[] = [];
  let flaggedPairs = 0;

  for (const a of actions) {
    if (a.kind === "M") {
      const keep = working[a.keep];
      for (const d of a.drop) {
        removed.add(d);
      }
      mergeLog.push({
        hash: keep.txn_hash,
        kept_id: keep.id,
        removed: a.drop.length,
      });
      for (const d of a.drop) working[d].flags = { ...working[d].flags, dup_m: true };
    } else {
      flaggedPairs++;
      working[a.a].flags = { ...working[a.a].flags, dup_p: true };
      working[a.b].flags = { ...working[a.b].flags, dup_p: true };
    }
  }

  return {
    txns: working.filter((_, i) => !removed.has(i)),
    merged: removed.size,
    flaggedPairs,
    mergeLog,
  };
}

// ---------------------------------------------------------------------------
// 2. Internal transfer detection
// ---------------------------------------------------------------------------

/**
 * Outflow in account A + inflow in account B, |amount difference| ≤ ₹1, on
 * the same day or within ±2 days → both rows become type=transfer and are
 * excluded from income/spend/forecast.
 *
 * Mutates the passed rows (flags + type) and returns the pair count.
 */
export function markTransfers(txns: LedgerTxn[]): number {
  const debits = txns
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.type === "normal" && t.amount_paise < 0);
  const credits = txns
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.type === "normal" && t.amount_paise > 0);

  const usedCredits = new Set<number>();
  let pairs = 0;

  for (const { t: d, i: di } of debits) {
    for (const { t: c, i: ci } of credits) {
      if (usedCredits.has(ci)) continue;
      if (d.account_id === c.account_id) continue; // own-account pair only
      if (Math.abs(-d.amount_paise - c.amount_paise) > TRANSFER_TOLERANCE_PAISE) continue;
      if (daysBetween(d.date, c.date) > TRANSFER_WINDOW_DAYS) continue;

      usedCredits.add(ci);
      txns[di] = {
        ...d,
        type: "transfer",
        flags: { ...d.flags, transfer: true },
        category: "transfer",
      };
      txns[ci] = {
        ...c,
        type: "transfer",
        flags: { ...c.flags, transfer: true },
        category: "transfer",
      };
      pairs++;
      break;
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// 2b. Credit-card bill elimination (your own card, not new spend)
// ---------------------------------------------------------------------------

export function isCardBillNarration(narration: string): boolean {
  const n = narrationKey(narration);
  return CARD_BILL_KEYWORDS.some((k) => n.includes(k));
}

/**
 * A debit that pays YOUR OWN credit-card bill is not consumption — the spend
 * was already counted when the card was swiped. Mark type=card_bill and
 * exclude from income/spend/forecast. Returns rows marked.
 */
export function markCardBills(txns: LedgerTxn[]): number {
  let marked = 0;
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    if (t.type !== "normal" || t.amount_paise >= 0) continue;
    if (!isCardBillNarration(t.raw_narration)) continue;
    txns[i] = {
      ...t,
      type: "card_bill",
      flags: { ...t.flags, transfer: true },
      category: "transfer",
    };
    marked++;
  }
  return marked;
}

// ---------------------------------------------------------------------------
// 3. Failed UPI + reversal netting
// ---------------------------------------------------------------------------

export function isFailedNarration(narration: string): boolean {
  const n = narrationKey(narration);
  return FAILED_KEYWORDS.some((k) => n.includes(k));
}

/**
 * A FAILED/DECLINED/REVERSED row plus a matching counter-entry within 7 days
 * (same |amount|, opposite sign, similar narration) nets to zero: both rows
 * stay visible with type=netted but contribute nothing to spend or forecast.
 *
 * Returns the number of pairs netted.
 */
export function markNettedPairs(txns: LedgerTxn[]): number {
  const used = new Set<number>();
  let pairs = 0;

  const failIdx = txns
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.type === "normal" && isFailedNarration(t.raw_narration));

  for (const { t: f, i: fi } of failIdx) {
    if (used.has(fi)) continue;
    for (let j = 0; j < txns.length; j++) {
      if (j === fi || used.has(j)) continue;
      const r = txns[j];
      if (r.type !== "normal") continue;
      if (Math.abs(r.amount_paise + f.amount_paise) > TRANSFER_TOLERANCE_PAISE) continue;
      if (r.amount_paise * f.amount_paise >= 0) continue; // must be opposite signs
      if (daysBetween(r.date, f.date) > REVERSAL_WINDOW_DAYS) continue;
      if (!nearIdenticalNarration(r.raw_narration, f.raw_narration) && !isFailedNarration(r.raw_narration)) continue;

      used.add(fi);
      used.add(j);
      txns[fi] = { ...f, type: "netted", flags: { ...f.flags, netted: true } };
      txns[j] = { ...r, type: "netted", flags: { ...r.flags, netted: true } };
      pairs++;
      break;
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Full hygiene pipeline
// ---------------------------------------------------------------------------

export type HygieneResult = {
  txns: LedgerTxn[];
  summary: {
    transactions: number;
    merged_duplicates: number;
    flagged_duplicates: number;
    transfers: number;
    netted_failed_upi: number;
    card_bills: number;
    anomalies: number;
  };
  mergeLog: { hash: string; kept_id?: number; removed: number }[];
  anomalyNote: string;
};

/**
 * Run the whole frozen pipeline: M/P dedup → card bills → transfers →
 * failed-UPI netting.
 * (Anomaly flags are applied separately via mathEngine.flagAnomalies so the
 * median used for detection excludes already-netted/transferred rows.)
 */
export function runHygiene(txns: LedgerTxn[]): HygieneResult {
  const dedup = applyDedup(txns);
  // Idempotent re-runs: rows persisted by a previous pass carry type
  // transfer/netted/card_bill, and those are excluded from candidate pools —
  // so a second run (the receipt rebuild) would count 0 pairs. Re-evaluate
  // from type=normal (flags kept); the deterministic algorithm re-marks the
  // same pairs.
  const working = dedup.txns.map((t) =>
    t.type === "normal" ? t : { ...t, type: "normal" as const },
  );

  // Order matters: FAILED/RVRSL rows must be netted BEFORE transfer pairing,
  // otherwise a ₹20 reversal credit could "pair" with an unrelated ₹20 debit
  // in another own-account and be excluded as a transfer.
  const netted = markNettedPairs(working);
  const cardBills = markCardBills(working);
  const transfers = markTransfers(working);

  const anomalies = working.filter((t) => t.flags.mad_anomaly).length;

  return {
    txns: working,
    summary: {
      transactions: working.length,
      merged_duplicates: dedup.merged,
      flagged_duplicates: dedup.flaggedPairs,
      transfers,
      netted_failed_upi: netted,
      card_bills: cardBills,
      anomalies,
    },
    mergeLog: dedup.mergeLog,
    anomalyNote: "",
  };
}

/** Income/spend totals with every exclusion applied (the honest numbers). */
export function totals(txns: LedgerTxn[]): {
  income_paise: number;
  spend_paise: number;
  excluded_transfers: number;
  netted_failed_upi: number;
  excluded_one_off_income: number;
} {
  let income = 0;
  let spend = 0;
  let transfers = 0;
  let netted = 0;
  let oneOff = 0;
  for (const t of txns) {
    if (t.type === "transfer" || t.type === "card_bill") {
      transfers++;
      continue;
    }
    if (t.type === "netted") {
      netted++;
      continue;
    }
    if (t.flags.user_duplicate) continue; // user confirmed it as a duplicate
    if (t.amount_paise > 0) {
      if (t.flags.one_off_income) {
        oneOff++; // bonus/gift: counted, but not "regular income"
        continue;
      }
      income += t.amount_paise;
    } else {
      spend += -t.amount_paise;
    }
  }
  return {
    income_paise: income,
    spend_paise: spend,
    excluded_transfers: transfers,
    netted_failed_upi: netted,
    excluded_one_off_income: oneOff,
  };
}
