/**
 * The math engine (Build Bible §9-§10).
 *
 * EVERY function in this module is:
 *   - pure: no I/O, no clock, no DB, no network
 *   - deterministic: fixed seed 42 wherever randomness is involved
 *   - integer-paise: no floating point money math anywhere
 *
 * The LLM never touches anything in here. "LLM samajhta hai, code saabit
 * karta hai."
 */
import type {
  BacktestEntry,
  BacktestScorecard,
  BufferBreakdown,
  CashFloorPoint,
  ForecastBand,
  LedgerTxn,
  RecurringCommitment,
  Verdict,
} from "./types";

/** Frozen constants (Build Bible §9.1) — do not tune mid-hackathon. */
export const FORECAST = {
  horizon_days: 30,
  n_draws: 500,
  block_days: 30,
  seed: 42,
  /** Flows older than this are not resampled. */
  history_days: 90,
} as const;

/** Minimum history for a verdict: 3 months (Build Bible §9.3). */
export const MIN_MONTHS_FOR_VERDICT = 3;

/** MAD anomaly thresholds (Build Bible §10). */
export const MAD = {
  /** Modified z-score threshold, Iglewicz & Hoaglin 1993. */
  threshold: 3.5,
  constant: 0.6745,
  /** Below this n, at most one flag, labeled "possible". */
  small_sample: 10,
} as const;

/**
 * Minimum-account-balance headroom: Indian banks demand an MAB (₹10,000 by
 * default) — dipping below it costs a penalty, so the buffer must cover it.
 */
export const MAB = {
  default_paise: 1_000_000, // ₹10,000
  fifteen_day_days: 15,
} as const;

/** The four exact anomaly reasons the spec allows (plus MAD, which is extra). */
export const ANOMALY_REASONS = {
  duplicate_charge: "possible duplicate charge",
  p95: "unusual amount - above your 95th percentile",
  new_merchant: "new high-value merchant over ₹2,000",
  price_jump: "subscription price jump over 20%",
} as const;

/**
 * Categories treated as essentials for the one-week cushion
 * ("so a delayed salary does not break you").
 */
const ESSENTIAL_CATEGORIES = new Set([
  "housing",
  "utilities",
  "groceries",
  "transport",
  "insurance",
  "emi",
  "health",
  "education",
]);

// ---------------------------------------------------------------------------
// Deterministic PRNG — mulberry32, seeded. Same seed → same stream, always.
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. Daily net flows
// ---------------------------------------------------------------------------

export type DailyFlow = { date: string; net_paise: number };

/** Rows that count for math: normal type and not removed by a what-if. */
export function countedForMath(t: LedgerTxn): boolean {
  return t.type === "normal" && !t.flags.whatif_removed;
}

function isoDay(iso: string): number {
  return Date.parse(iso + "T00:00:00Z");
}

function daysBetween(a: string, b: string): number {
  return Math.round((isoDay(b) - isoDay(a)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  return new Date(isoDay(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Net flow (credits - debits) per calendar day.
 * Days with no activity are included as 0 so weekday/month rhythm survives.
 * Transfers and netted failed UPIs are excluded — they are neither income
 * nor spend (Build Bible §8).
 */
export function dailyNetFlows(txns: LedgerTxn[], from?: string, to?: string): DailyFlow[] {
  const counted = txns.filter((t) => countedForMath(t));

  const dates = counted.map((t) => t.date);
  const start = from ?? (dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : "");
  const end = to ?? (dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "");
  if (!start || !end || start > end) return [];

  const byDate = new Map<string, number>();
  for (const t of counted) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount_paise);
  }

  const out: DailyFlow[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push({ date: d, net_paise: byDate.get(d) ?? 0 });
  }
  return out;
}

/** Sum of the last `n` days of flows (oldest→newest input is not assumed). */
export function totalNetFlows(flows: DailyFlow[]): number {
  return flows.reduce((sum, f) => sum + f.net_paise, 0);
}

// ---------------------------------------------------------------------------
// 2. Safety buffer — frozen formula (Build Bible §9.2)
//
//    buffer = worst observed month's variable-spend overshoot over its median
//           + 7 × median daily essential spend
// ---------------------------------------------------------------------------

export function categorizeSpend(txns: LedgerTxn[]): {
  variablePaise: number;
  essentialPaise: number;
} {
  let variablePaise = 0;
  let essentialPaise = 0;
  for (const t of txns) {
    if (!countedForMath(t) || t.amount_paise >= 0) continue; // debits only
    if (t.category && ESSENTIAL_CATEGORIES.has(t.category)) {
      essentialPaise += -t.amount_paise;
    } else {
      variablePaise += -t.amount_paise;
    }
  }
  return { variablePaise, essentialPaise };
}

/** Integer median of a list (no copy mutation of caller data). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : Math.floor((s[mid - 1] + s[mid]) / 2);
}

/** Monthly variable-spend totals keyed by YYYY-MM, in chronological order. */
export function monthlyVariableSpend(txns: LedgerTxn[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const t of txns) {
    if (!countedForMath(t) || t.amount_paise >= 0) continue;
    if (t.category && ESSENTIAL_CATEGORIES.has(t.category)) continue;
    const month = t.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + -t.amount_paise);
  }
  return new Map([...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * Exact buffer with itemized parts — unified formula:
 *
 *   buffer = max(
 *     A. MAB headroom            (the bank's minimum balance, by default ₹10,000)
 *     B. 15-day burn             (15 × median daily essential spend)
 *     C. volatility cushion      (frozen: worst-month variable overshoot
 *                                 + 7 × median daily essential spend)
 *   )
 *
 * Every branch is itemized on the receipt, and `dominant_branch` says which
 * one won the max() — the judge can see exactly why ₹18,400 and not ₹12,000.
 */
export function computeBuffer(
  txns: LedgerTxn[],
  oneWeekDays = 7,
  mabPaise: number = MAB.default_paise,
): BufferBreakdown {
  const months = monthlyVariableSpend(txns);
  const monthlyTotals = [...months.values()];
  const medianMonthly = median(monthlyTotals);

  let worstMonthVariable = 0;
  let worstMonth = "—";
  if (monthlyTotals.length > 0) {
    for (const [month, total] of months) {
      if (total > worstMonthVariable) {
        worstMonthVariable = total;
        worstMonth = month;
      }
    }
  }

  const overshoot = Math.max(0, worstMonthVariable - medianMonthly);

  // Daily essential spend across the whole window, zero-days included.
  const essentialByDay = new Map<string, number>();
  let windowStart = "";
  let windowEnd = "";
  for (const t of txns) {
    if (!countedForMath(t) || t.amount_paise >= 0) continue;
    if (!(t.category && ESSENTIAL_CATEGORIES.has(t.category))) continue;
    essentialByDay.set(t.date, (essentialByDay.get(t.date) ?? 0) + -t.amount_paise);
    if (!windowStart || t.date < windowStart) windowStart = t.date;
    if (!windowEnd || t.date > windowEnd) windowEnd = t.date;
  }

  const dailyEssentials: number[] = [];
  if (windowStart && windowEnd) {
    for (let d = windowStart; d <= windowEnd; d = addDays(d, 1)) {
      dailyEssentials.push(essentialByDay.get(d) ?? 0);
    }
  }
  const medianDailyEssential = median(dailyEssentials);
  const oneWeekEssentials = medianDailyEssential * oneWeekDays;

  // Unified branches
  const volatilityCushion = overshoot + oneWeekEssentials; // frozen formula
  const fifteenDayBurn = medianDailyEssential * MAB.fifteen_day_days;
  const mabHeadroom = Math.max(0, mabPaise);

  const branches: { key: BufferBreakdown["dominant_branch"]; v: number }[] = [
    { key: "mab", v: mabHeadroom },
    { key: "fifteen_day_burn", v: fifteenDayBurn },
    { key: "volatility", v: volatilityCushion },
  ];
  const dominant = branches.reduce((a, b) => (b.v > a.v ? b : a));

  return {
    buffer_paise: dominant.v,
    worst_month_overshoot_paise: overshoot,
    one_week_essentials_paise: oneWeekEssentials,
    median_monthly_variable_paise: medianMonthly,
    worst_month_variable_paise: worstMonthVariable,
    median_daily_essential_paise: medianDailyEssential,
    worst_month: worstMonth,
    mab_headroom_paise: mabHeadroom,
    fifteen_day_burn_paise: fifteenDayBurn,
    volatility_cushion_paise: volatilityCushion,
    dominant_branch: dominant.key,
  };
}

/** Median daily VARIABLE (non-essential) spend across the whole window. */
export function medianDailyVariableSpend(txns: LedgerTxn[]): number {
  const byDay = new Map<string, number>();
  let start = "";
  let end = "";
  for (const t of txns) {
    if (!countedForMath(t) || t.amount_paise >= 0) continue;
    if (t.category && ESSENTIAL_CATEGORIES.has(t.category)) continue;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + -t.amount_paise);
    if (!start || t.date < start) start = t.date;
    if (!end || t.date > end) end = t.date;
  }
  const values: number[] = [];
  if (start && end) {
    for (let d = start; d <= end; d = addDays(d, 1)) values.push(byDay.get(d) ?? 0);
  }
  return median(values);
}

// ---------------------------------------------------------------------------
// 3. Moving-block bootstrap (Kunsch 1989) — the forecast band
// ---------------------------------------------------------------------------

/**
 * Resamples the user's own recent daily net flows in contiguous 30-day
 * blocks, 500 draws, seed 42, and returns P10/P50/P90 of the balance
 * `horizon_days` out.
 *
 * Honest on thin data: less history → wider band, never a fake point guess.
 */
export function bootstrapForecast(
  dailyFlows: number[],
  openingBalancePaise: number,
  opts: {
    horizon_days?: number;
    n_draws?: number;
    block_days?: number;
    seed?: number;
  } = {},
): ForecastBand {
  const horizon = opts.horizon_days ?? FORECAST.horizon_days;
  const nDraws = opts.n_draws ?? FORECAST.n_draws;
  const blockDays = opts.block_days ?? FORECAST.block_days;
  const seed = opts.seed ?? FORECAST.seed;

  const n = dailyFlows.length;
  if (n < blockDays) {
    throw new Error(
      `bootstrapForecast needs at least ${blockDays} days of flows, got ${n}`,
    );
  }

  const rand = mulberry32(seed);
  const outcomes: number[] = [];

  for (let draw = 0; draw < nDraws; draw++) {
    const start = Math.floor(rand() * (n - blockDays + 1));
    const block = dailyFlows.slice(start, start + blockDays);
    let sum = 0;
    for (let i = 0; i < Math.min(horizon, block.length); i++) sum += block[i];
    outcomes.push(openingBalancePaise + sum);
  }

  outcomes.sort((a, b) => a - b);

  const quantile = (p: number): number => {
    const idx = Math.floor(p * (outcomes.length - 1));
    return outcomes[Math.min(Math.max(idx, 0), outcomes.length - 1)];
  };

  return {
    p10: quantile(0.1),
    p50: quantile(0.5),
    p90: quantile(0.9),
    method: "moving-block bootstrap",
    draws: nDraws,
    block_days: blockDays,
    horizon_days: horizon,
    seed,
  };
}

// ---------------------------------------------------------------------------
// 4. Verdicts — exact conditions (Build Bible §9.3), boundary inclusive
// ---------------------------------------------------------------------------

export type VerdictResult = {
  verdict: Verdict;
  /** shortfall vs the worst case; ≤ 0 means the worst case clears. */
  shortfall_worst_case_paise: number;
  /** shortfall vs the median path; ≤ 0 means the median clears. */
  shortfall_median_paise: number;
  target_paise: number;
  /** Human reason — always shown on screen for REFUSED. */
  reason: string;
  /** Big banner headline for REFUSED verdicts. */
  banner?: string;
  months_of_data: number;
};

/** History span in months from the first and last transaction dates. */
export function monthsOfData(txns: LedgerTxn[]): number {
  if (txns.length === 0) return 0;
  let first = txns[0].date;
  let last = txns[0].date;
  for (const t of txns) {
    if (t.date < first) first = t.date;
    if (t.date > last) last = t.date;
  }
  const days = daysBetween(first, last) + 1; // inclusive of both endpoints
  return Math.round((days / 30.44) * 10) / 10;
}

export function computeVerdict(input: {
  band: Pick<ForecastBand, "p10" | "p50">;
  price_paise: number;
  buffer_paise: number;
  months_of_data: number;
}): VerdictResult {
  const { band, price_paise, buffer_paise, months_of_data } = input;
  const target = price_paise + buffer_paise;
  const shortfallWorst = target - band.p10;
  const shortfallMedian = target - band.p50;

  if (months_of_data < MIN_MONTHS_FOR_VERDICT) {
    const x = Math.round(months_of_data * 10) / 10;
    return {
      verdict: "REFUSED",
      shortfall_worst_case_paise: shortfallWorst,
      shortfall_median_paise: shortfallMedian,
      target_paise: target,
      reason: `Only ${x} months of history - a forecast would be a guess. We need at least 3 months of transaction history to make a reliable affordability estimate.`,
      banner: "INSUFFICIENT DATA: We need at least 3 months of transaction history to make a reliable affordability estimate.",
      months_of_data,
    };
  }

  if (band.p10 >= target) {
    return {
      verdict: "YES",
      shortfall_worst_case_paise: Math.min(0, shortfallWorst),
      shortfall_median_paise: Math.min(0, shortfallMedian),
      target_paise: target,
      reason: `Even in your worst-case path you clear the price plus a ₹${paiseToInrWords(target)} buffer.`,
      months_of_data,
    };
  }

  if (band.p50 >= target) {
    return {
      verdict: "TIGHT",
      shortfall_worst_case_paise: shortfallWorst,
      shortfall_median_paise: Math.min(0, shortfallMedian),
      target_paise: target,
      reason: `Affordable on the median path, short by ₹${paiseToInrWords(shortfallWorst)} in the worst case.`,
      months_of_data,
    };
  }

  return {
    verdict: "NO",
    shortfall_worst_case_paise: shortfallWorst,
    shortfall_median_paise: shortfallMedian,
    target_paise: target,
    reason: `Median path falls ₹${paiseToInrWords(shortfallMedian)} short - this purchase raises overdraft risk.`,
    months_of_data,
  };
}

// ---------------------------------------------------------------------------
// 5. MAD anomaly detection (Iglewicz & Hoaglin 1993) with the guards
// ---------------------------------------------------------------------------

export type MadResult = {
  flags: { index: number; score: number; possible: boolean }[];
  median: number;
  mad: number;
  /** "uniform history" when MAD = 0, "small sample" when n < 10, else "ok". */
  note: string;
};

/**
 * Modified z-score on the median absolute deviation.
 *
 * Guards (frozen):
 *   - MAD == 0 → flag nothing, note "uniform history" (no division by zero)
 *   - n < 10   → at most ONE flag, labeled "possible"
 */
export function madFlags(values: number[]): MadResult {
  const n = values.length;
  if (n === 0) return { flags: [], median: 0, mad: 0, note: "empty" };

  const med = median(values);
  const devs = values.map((v) => Math.abs(v - med));
  const mad = median(devs);

  if (mad === 0) {
    return { flags: [], median: med, mad: 0, note: "uniform history" };
  }

  const scored = values.map((v, index) => ({
    index,
    score: (MAD.constant * (v - med)) / mad,
    raw: Math.abs((MAD.constant * (v - med)) / mad),
  }));

  const hits = scored
    .filter((s) => s.raw > MAD.threshold)
    .sort((a, b) => b.raw - a.raw)
    .map(({ index, score }) => ({
      index,
      score: Math.round(score * 100) / 100,
      possible: n < MAD.small_sample,
    }));

  if (n < MAD.small_sample) {
    return { flags: hits.slice(0, 1), median: med, mad, note: "small sample" };
  }
  return { flags: hits, median: med, mad, note: "ok" };
}

/** Flag transactions whose amount is a MAD anomaly (credits and debits separately). */
export function flagAnomalies(txns: LedgerTxn[]): {
  flagged: Set<number>;
  note: string;
} {
  const flagged = new Set<number>();
  let worstNote = "ok";

  for (const direction of ["credit", "debit"] as const) {
    const subset = txns
      .map((t, i) => ({ t, i }))
      .filter(
        ({ t }) =>
          t.type === "normal" &&
          (direction === "credit" ? t.amount_paise > 0 : t.amount_paise < 0),
      );
    if (subset.length === 0) continue;

    const res = madFlags(subset.map(({ t }) => t.amount_paise));
    if (res.note === "uniform history") worstNote = "uniform history";
    else if (res.note === "small sample" && worstNote === "ok") worstNote = "small sample";

    for (const f of res.flags) {
      const target = subset[f.index];
      if (!target) continue;
      flagged.add(target.i);
      target.t.flags = {
        ...target.t.flags,
        mad_anomaly: true,
        ...(f.possible ? { anomaly_possible: true } : {}),
      };
    }
  }

  return { flagged, note: worstNote };
}

// ---------------------------------------------------------------------------
// Formatting helpers — the LLM receives these as STRINGS, never recomputes.
// ---------------------------------------------------------------------------

/** 2000000 → "20,000" (Indian grouping, no symbol, no decimals when whole). */
export function paiseToInrWords(paise: number): string {
  const rupees = Math.round(paise / 100);
  return rupees.toLocaleString("en-IN");
}

/** Question price is entered in rupees (LLM output), stored in paise. */
export function inrToPaise(inr: number): number {
  return Math.round(inr * 100);
}

/**
 * Sentence template used when the LLM is unreachable (offline fallback) and
 * when the user slides the buffer (instant local recompute). Numbers come in
 * as strings — this function does no arithmetic of its own beyond display.
 */
export function formatVerdictSentence(
  v: Verdict,
  parts: { price: string; buffer: string; p10: string; p50: string; shortfall: string },
): string {
  switch (v) {
    case "REFUSED":
      return "";
    case "YES":
      return `Yes — you can afford ₹${parts.price}. Even the worst-case path (₹${parts.p10}) clears the price plus a ₹${parts.buffer} safety buffer.`;
    case "TIGHT":
      return `Tight — affordable on the median path (₹${parts.p50}), but short by ₹${parts.shortfall} in the worst case. Delay or trim the buffer consciously.`;
    case "NO":
      return `No — the median path falls ₹${parts.shortfall} short of ₹${parts.price} plus the ₹${parts.buffer} buffer. This purchase raises overdraft risk.`;
  }
}

export function isEssentialCategory(category: string | null): boolean {
  return !!category && ESSENTIAL_CATEGORIES.has(category);
}

// ---------------------------------------------------------------------------
// 6. One-off income detection (bonus/gift ≠ regular income)
// ---------------------------------------------------------------------------

/** Payment-rail noise words that never identify a merchant. */
const MERCHANT_STOPWORDS = new Set([
  "UPI", "P2A", "P2M", "NEFT", "IMPS", "RTGS", "NACH", "ATM", "POS",
  "TFR", "PAY", "PMT", "DR", "CR", "REF", "TRF", "MMT", "UPIQR",
]);

/** Stable merchant-ish key: first 3 merchant tokens, refs and rails stripped. */
export function merchantKey(narration: string): string {
  return narration
    .toUpperCase()
    .replace(/\d{4,}/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !MERCHANT_STOPWORDS.has(w))
    .slice(0, 3)
    .join(" ");
}

/**
 * A credit is ONE-OFF when it is far bigger than the user's typical credit
 * (≥ 3× the median credit, min ₹10,000) and nothing similar recurred within
 * ±60 days. Bonuses and gifts leave regular income; salary does not.
 *
 * Mutates flags (one_off_income) and returns the flagged count.
 */
export function markOneOffIncome(txns: LedgerTxn[]): number {
  const credits = txns.filter((t) => t.type === "normal" && t.amount_paise > 0);
  if (credits.length < 2) return 0;

  const medianCredit = median(credits.map((c) => c.amount_paise));
  let flagged = 0;

  for (const c of credits) {
    if (c.amount_paise < 1_000_000) continue; // below ₹10,000 never "one-off"
    if (c.amount_paise < 3 * medianCredit) continue;

    const key = merchantKey(c.clean_narration);
    const recurred = credits.some(
      (o) =>
        o !== c &&
        Math.abs(o.amount_paise - c.amount_paise) <= c.amount_paise * 0.25 &&
        Math.abs(daysBetween(o.date, c.date)) <= 60 &&
        (!key || merchantKey(o.clean_narration) === key),
    );
    if (!recurred) {
      c.flags = { ...c.flags, one_off_income: true };
      flagged++;
    }
  }
  return flagged;
}

// ---------------------------------------------------------------------------
// 7. Recurring commitments engine (subscriptions, EMI, SIP, rent, salary)
// ---------------------------------------------------------------------------

const RECUR_KINDS: { kind: RecurringCommitment["kind"]; test: RegExp }[] = [
  { kind: "sip", test: /\b(SIP|MUTUAL FUND|FUND|ZERODHA|GROWW|COIN|MF Purchase|ANGEL ONE|GROWW SIP)\b/ },
  { kind: "emi", test: /\b(EMI|LOAN|Bajaj|MAHINDRA FIN|HDFC LOAN|PERSONAL LOAN)\b/ },
  { kind: "rent", test: /\b(RENT|LANDLORD|MAINT|SOCIETY|PG ACCOMMODATION)\b/ },
  { kind: "salary", test: /\b(SALARY|SAL CREDIT|NEFT CR SAL)\b/ },
  { kind: "utility", test: /\b(ELECTRIC|GAS|WATER BILL|BROADBAND|AIRTEL|JIO|VODAFONE)\b/ },
];

function recurringKind(narration: string, category: string | null): RecurringCommitment["kind"] {
  const n = narration.toUpperCase();
  for (const k of RECUR_KINDS) if (k.test.test(n)) return k.kind;
  if (category === "utilities") return "utility";
  return "subscription";
}

/**
 * Group by (merchant, exact amount), ≥3 occurrences, consistent interval →
 * a commitment with the next expected date (tolerance ±2 days) and a
 * High/Low confidence grade.
 */
export function detectRecurring(txns: LedgerTxn[]): RecurringCommitment[] {
  const groups = new Map<string, LedgerTxn[]>();
  for (const t of txns) {
    if (!countedForMath(t) || t.amount_paise === 0) continue;
    const key = `${merchantKey(t.clean_narration)}|${t.amount_paise}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const out: RecurringCommitment[] = [];
  for (const [, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    const interval = median(gaps);
    if (interval < 5 || interval > 400) continue;

    // consistency: most gaps within ±2 days of the median
    const within = gaps.filter((g) => Math.abs(g - interval) <= 2).length;
    const consistent = within / gaps.length >= 0.6;
    if (!consistent) continue;

    const last = sorted[sorted.length - 1];
    const kind = recurringKind(last.clean_narration, last.category);

    out.push({
      merchant: merchantKey(last.clean_narration) || last.clean_narration.slice(0, 24),
      amount_paise: last.amount_paise,
      interval_days: interval,
      next_expected_date: addDays(last.date, interval),      occurrences: sorted.length,
      confidence: sorted.length >= 4 && within === gaps.length ? "High" : "Low",
      kind,
      last_seen: last.date,
    });
  }

  return out.sort((a, b) => b.amount_paise - a.amount_paise);
}

// ---------------------------------------------------------------------------
// 8. The four exact anomaly reasons (+ subscription price jump)
// ---------------------------------------------------------------------------

/**
 * Annotate txns.flags.anomaly_reasons with the exact reason strings:
 *   - "possible duplicate charge" (Fellegi-Sunter P-class)
 *   - "unusual amount - above your 95th percentile"
 *   - "new high-value merchant over ₹2,000"
 *   - "subscription price jump over 20%"
 * Returns the number of flagged rows.
 */
export function annotateAnomalyReasons(txns: LedgerTxn[]): number {
  const debits = txns.filter((t) => t.type === "normal" && t.amount_paise < 0);
  if (debits.length === 0) return 0;

  const amounts = debits.map((t) => -t.amount_paise).sort((a, b) => a - b);
  const p95 = amounts[Math.min(amounts.length - 1, Math.floor(0.95 * (amounts.length - 1)))];

  // first-ever merchants with a high-value debit
  const seenBefore = new Set<string>();
  for (const t of debits) {
    const key = merchantKey(t.clean_narration);
    const isnew = key !== "" && !seenBefore.has(key);
    if (key !== "") seenBefore.add(key);
    if (isnew && -t.amount_paise > 200_000) {
      addReason(t, ANOMALY_REASONS.new_merchant);
    }
  }

  // percentile
  for (const t of debits) {
    if (-t.amount_paise >= p95 && amounts.length >= 10) {
      addReason(t, ANOMALY_REASONS.p95);
    }
  }

  // duplicates
  for (const t of txns) {
    if (t.flags.dup_p) addReason(t, ANOMALY_REASONS.duplicate_charge);
  }

  // subscription price jump > 20%: same merchant, later amount ≥ 1.2× earlier
  const byMerchant = new Map<string, LedgerTxn[]>();
  for (const t of debits) {
    const key = merchantKey(t.clean_narration);
    if (!key) continue;
    const list = byMerchant.get(key) ?? [];
    list.push(t);
    byMerchant.set(key, list);
  }
  for (const [, list] of byMerchant) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const kind = recurringKind(sorted[sorted.length - 1].clean_narration, sorted[sorted.length - 1].category);
    if (kind === "salary") continue;
    const prevMedian = median(sorted.slice(0, -1).map((t) => -t.amount_paise));
    const lastAmt = -sorted[sorted.length - 1].amount_paise;
    if (prevMedian > 0 && lastAmt >= prevMedian * 1.2) {
      addReason(sorted[sorted.length - 1], ANOMALY_REASONS.price_jump);
    }
  }

  return txns.filter((t) => (t.flags.anomaly_reasons?.length ?? 0) > 0).length;
}

function addReason(t: LedgerTxn, reason: string): void {
  const existing = t.flags.anomaly_reasons ?? [];
  if (!existing.includes(reason)) {
    t.flags = { ...t.flags, anomaly_reasons: [...existing, reason] };
  }
}

// ---------------------------------------------------------------------------
// 9. Daily Cash Floor — deterministic day-by-day projection
// ---------------------------------------------------------------------------

/**
 * Project the balance forward one day at a time using the median daily net
 * flow (a deterministic central path — the bootstrap band covers the risk).
 * The floor is the lowest projected day: if it dips ≤ 0 the purchase is
 * dangerous even when the month-end P50 looks fine.
 */
export function projectDailyCashFloor(
  startingBalancePaise: number,
  flows: DailyFlow[],
  horizonDays: number = FORECAST.horizon_days,
): { points: CashFloorPoint[]; floor_paise: number; floor_date: string } {
  const netMedian = median(flows.map((f) => f.net_paise));
  const lastDate = flows.length ? flows[flows.length - 1].date : "";

  const points: CashFloorPoint[] = [];
  let balance = startingBalancePaise;
  let floorPaise = startingBalancePaise;
  let floorDate = lastDate;

  for (let i = 1; i <= horizonDays; i++) {
    balance += netMedian;
    const date = lastDate ? addDays(lastDate, i) : String(i);
    points.push({ date, projected_balance_paise: balance });
    if (balance < floorPaise) {
      floorPaise = balance;
      floorDate = date;
    }
  }

  return { points, floor_paise: floorPaise, floor_date: floorDate };
}

// ---------------------------------------------------------------------------
// 10. Forecast backtest scorecard (walk-forward, ≥4 months of history)
// ---------------------------------------------------------------------------

const BACKTEST_MIN_MONTHS = 4;

/**
 * Walk-forward validation: for each COMPLETE past month, re-forecast it from
 * the months before (seed 42) and compare P50 against the actual close.
 * The scorecard is the engine's own honesty metric — shown in the UI.
 */
export function backtestScorecard(txns: LedgerTxn[], horizonDays = 30): BacktestScorecard {
  const flows = dailyNetFlows(txns);
  if (flows.length === 0) {
    return { ok: false, note: "no flows to test", months_tested: 0, mean_abs_error_pct: null, entries: [] };
  }

  const monthsOfFlows = new Map<string, DailyFlow[]>();
  for (const f of flows) {
    const m = f.date.slice(0, 7);
    const list = monthsOfFlows.get(m) ?? [];
    list.push(f);
    monthsOfFlows.set(m, list);
  }
  const monthKeys = [...monthsOfFlows.keys()].sort();

  const lastMonth = monthKeys[monthKeys.length - 1];
  const lastMonthFlows = monthsOfFlows.get(lastMonth) ?? [];
  // the current (incomplete) month is never a test target
  const isComplete = (m: string): boolean =>
    m !== lastMonth || lastMonthFlows.length >= 28;

  const entries: BacktestEntry[] = [];
  for (let i = 1; i < monthKeys.length; i++) {
    const target = monthKeys[i];
    if (!isComplete(target)) continue;

    const trainFlows: number[] = [];
    for (let j = 0; j < i; j++) {
      for (const f of monthsOfFlows.get(monthKeys[j]) ?? []) trainFlows.push(f.net_paise);
    }
    if (trainFlows.length < 30) continue;

    const opening = trainFlows.reduce((s, v) => s + v, 0); // relative open
    let band: ForecastBand;
    try {
      band = bootstrapForecast(trainFlows.slice(-90), opening, { horizon_days: horizonDays });
    } catch {
      continue;
    }

    const actualNet = (monthsOfFlows.get(target) ?? []).reduce((s, f) => s + f.net_paise, 0);
    const actualClose = opening + actualNet;
    const predicted = band.p50;
    const errorPaise = Math.abs(predicted - actualClose);
    const errorPct = Math.abs(actualClose) > 0 ? (errorPaise / Math.abs(actualClose)) * 100 : 0;

    entries.push({
      month: target,
      predicted_p50_paise: predicted,
      actual_close_paise: actualClose,
      error_paise: errorPaise,
      error_pct: Math.round(errorPct * 10) / 10,
    });
  }

  if (monthKeys.length < BACKTEST_MIN_MONTHS) {
    return {
      ok: false,
      note: `Backtest needs at least ${BACKTEST_MIN_MONTHS} months of history - you have ${monthKeys.length}.`,
      months_tested: entries.length,
      mean_abs_error_pct: null,
      entries,
    };
  }

  const mape =
    entries.length > 0
      ? Math.round((entries.reduce((s, e) => s + e.error_pct, 0) / entries.length) * 10) / 10
      : null;

  return {
    ok: entries.length > 0,
    note: entries.length > 0 ? "walk-forward, seed 42" : "no complete months to test",
    months_tested: entries.length,
    mean_abs_error_pct: mape,
    entries,
  };
}

export { ESSENTIAL_CATEGORIES };
