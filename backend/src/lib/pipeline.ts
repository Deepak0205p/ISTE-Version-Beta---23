/**
 * Orchestration — glue between pure functions, the DB, and (optionally) the
 * LLM. Route handlers stay thin; nothing here does arithmetic by hand —
 * it only sequences mathEngine / hygiene calls.
 */
import { detectAdapter } from "@/config/bankAdapters";
import { normalizeBankCsv } from "@/lib/csvNormalizer";
import {
  allTransactions,
  categorizeAll,
  currentBalancePaise,
  ensureLast4,
  ledgerStats,
  listAccounts,
  persistHygiene,
  saveVerdict,
} from "@/lib/repository";
import {
  flagAnomalies,
  dailyNetFlows,
  computeBuffer,
  bootstrapForecast,
  computeVerdict,
  monthsOfData,
  markOneOffIncome,
  detectRecurring,
  annotateAnomalyReasons,
  projectDailyCashFloor,
  backtestScorecard,
  medianDailyVariableSpend,
  merchantKey,
  MIN_MONTHS_FOR_VERDICT,
  type VerdictResult,
} from "@/lib/mathEngine";
import { runHygiene, totals } from "@/lib/ledgerHygiene";
import { buildReceipt, VERDICT_DISPLAY, type Receipt } from "@/lib/receipt";
import { phraseVerdict, parseQuestion } from "@/lib/llm";
import type { LedgerTxn, Question, Verdict, WhatIf } from "@/lib/types";

// ---------------------------------------------------------------------------
// Upload + ingest
// ---------------------------------------------------------------------------

export type UploadOutcome = {
  ok: true;
  account_id: string;
  adapter: string;
  parsed: number;
  rejected: number;
  rejected_detail: string[];
  skipped_identical: number;
  message: string;
  rows: LedgerTxn[];
  alerts: string[];
} | {
  ok: false;
  message: string;
};

export function ingestCsvText(
  csvText: string,
  label: string,
): UploadOutcome {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? "";
  const adapter = detectAdapter(firstLine);
  if (!adapter) {
    return {
      ok: false,
      message:
        "Could not detect the bank format from the header row. Supported: HDFC-style and SBI-style exports — or add an adapter in src/config/bankAdapters.ts.",
    };
  }

  const accountId = `${adapter.id}-${label}`.replace(/\s+/g, "_").slice(0, 60);

  let result;
  try {
    result = normalizeBankCsv(csvText, adapter, accountId);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  // File-level honesty alerts: reversed export, missing-row date gaps.
  const alerts: string[] = [];
  if (result.stats.reversed_alert) {
    alerts.push(
      "This export is newest-first (reversed date order). Rows were sorted by date on import — if rows look missing, re-export oldest-first.",
    );
  }
  if (result.stats.date_gaps.length > 0) {
    const worst = result.stats.date_gaps.reduce((a, b) => (b.days > a.days ? b : a));
    alerts.push(
      `Possible missing rows: ${result.stats.date_gaps.length} date gap(s) over 15 days, biggest ${worst.days} days (${worst.from} → ${worst.to}).`,
    );
  }

  return {
    ok: true,
    account_id: accountId,
    adapter: adapter.id,
    parsed: result.stats.parsed,
    rejected: result.rejected.length,
    rejected_detail: result.rejected
      .slice(0, 5)
      .map((r) => r.rejected?.reason ?? "unknown"),
    skipped_identical: 0,
    message: result.stats.balance_reconciled
      ? `Parsed ${result.stats.parsed} rows from ${adapter.label}; every running balance reconciled.`
      : `Parsed ${result.stats.parsed} rows; ${result.stats.rejected_balance} rows rejected for balance mismatch.`,
    rows: result.rows,
    alerts,
  };
}

export type IngestSummary = {
  summary: {
    transactions: number;
    accounts: number;
    merged_duplicates: number;
    flagged_duplicates: number;
    transfers: number;
    netted_failed_upi: number;
    card_bills: number;
    one_off_income: number;
    anomalies: number;
    recurring: number;
    categorized: number;
    uncategorized: number;
  };
  anomaly_note: string;
  /** Data-health warnings: date gaps, stale history. */
  warnings: string[];
};

/** Date-gap (>15 days) and staleness (>45 days) warnings for the dashboard. */
export function ledgerWarnings(): string[] {
  const txns = allTransactions();
  const warnings: string[] = [];
  if (txns.length === 0) return warnings;

  const dates = [...new Set(txns.map((t) => t.date))].sort();
  let biggestGap = 0;
  let gapFrom = "";
  let gapTo = "";
  for (let i = 1; i < dates.length; i++) {
    const days = Math.round(
      (Date.parse(dates[i] + "T00:00:00Z") - Date.parse(dates[i - 1] + "T00:00:00Z")) / 86_400_000,
    );
    if (days > biggestGap) {
      biggestGap = days;
      gapFrom = dates[i - 1];
      gapTo = dates[i];
    }
  }
  if (biggestGap > 15) {
    warnings.push(
      `No transactions for ${biggestGap} days (${gapFrom} → ${gapTo}) — rows may be missing from your statements.`,
    );
  }

  const last = dates[dates.length - 1];
  const staleDays = Math.round(
    (Date.now() - Date.parse(last + "T00:00:00Z")) / 86_400_000,
  );
  if (staleDays > 45) {
    warnings.push(
      `Your newest transaction is ${staleDays} days old (${last}) — the forecast may be stale. Upload a recent statement.`,
    );
  }
  return warnings;
}

/**
 * Full ingest pipeline: categorize → hygiene (dedup, card bills, transfers,
 * netting) → one-off income + recurring + anomaly reasons → persist.
 * Pure math, deterministic every run.
 */
export function runIngest(): IngestSummary {
  // 1. categorization (dict + rules; LLM layer only where those miss)
  categorizeAll();
  ensureLast4();

  // 2-3. hygiene on an in-memory copy, then flags on the cleaned ledger
  const raw = allTransactions();
  const hygiene = runHygiene(raw);
  const oneOffs = markOneOffIncome(hygiene.txns);
  const flagged = flagAnomalies(hygiene.txns);
  annotateAnomalyReasons(hygiene.txns);
  const recurring = detectRecurring(hygiene.txns);
  hygiene.summary.anomalies = flagged.flagged.size;

  // 4. persist flags/types back to SQLite
  persistHygiene(hygiene.txns);

  // 5. category pass after hygiene (transfers get "transfer")
  categorizeAll();

  const stats = ledgerStats();
  const final = allTransactions();
  const uncategorized = final.filter(
    (t) => !t.category || t.category === "uncategorized",
  ).length;

  return {
    summary: {
      transactions: stats.txns,
      accounts: stats.accounts,
      merged_duplicates: hygiene.summary.merged_duplicates,
      flagged_duplicates: hygiene.summary.flagged_duplicates,
      transfers: hygiene.summary.transfers,
      netted_failed_upi: hygiene.summary.netted_failed_upi,
      card_bills: hygiene.summary.card_bills,
      one_off_income: oneOffs,
      anomalies: hygiene.summary.anomalies,
      recurring: recurring.length,
      categorized: stats.txns - uncategorized,
      uncategorized,
    },
    anomaly_note: flagged.note,
    warnings: ledgerWarnings(),
  };
}

// ---------------------------------------------------------------------------
// What-if sandbox (pure)
// ---------------------------------------------------------------------------

export type WhatIfResult = {
  txns: LedgerTxn[];
  applied: string[];
};

/** Cancel subscriptions / convert to EMI — rows are flagged, never deleted. */
export function applyWhatIf(txns: LedgerTxn[], whatIf?: WhatIf): WhatIfResult {
  if (!whatIf || (!whatIf.cancel_subscriptions?.length && !whatIf.emi_monthly_inr)) {
    return { txns, applied: [] };
  }
  const applied: string[] = [];
  const working = txns.map((t) => ({ ...t, flags: { ...t.flags } }));

  for (const sub of whatIf.cancel_subscriptions ?? []) {
    const needle = sub.trim().toUpperCase();
    if (!needle) continue;
    let hit = 0;
    for (const t of working) {
      if (t.type !== "normal" || t.amount_paise >= 0) continue;
      const mk = merchantKey(t.clean_narration).toUpperCase();
      if (mk.includes(needle) || (needle.includes(mk) && mk.length > 2)) {
        t.flags = { ...t.flags, whatif_removed: true };
        hit++;
      }
    }
    if (hit > 0) applied.push(`cancelled “${sub}” (${hit} row(s) removed from the scenario)`);
  }

  if (whatIf.emi_monthly_inr && whatIf.emi_monthly_inr > 0) {
    applied.push(`purchase converted to EMI of ₹${whatIf.emi_monthly_inr.toLocaleString("en-IN")}/month`);
  }

  return { txns: working, applied };
}

// ---------------------------------------------------------------------------
// Forecast + verdict + receipt (the heart)
// ---------------------------------------------------------------------------

export type QuestionResult = {
  ok: boolean;
  verdict: Verdict;
  verdict_display: string;
  banner: string | null;
  sentence: string;
  receipt: Receipt;
  question: Question;
  whatif: { applied: string[] };
  /** Local verdict inputs so the UI can recompute instantly on slider move. */
  live: {
    band: { p10: number; p50: number; p90: number };
    buffer_paise: number;
    price_paise: number;
    months_of_data: number;
  };
  llm: Receipt["llm"];
  verdict_id?: number;
};

export async function answerQuestion(
  rawQuestion: string,
  opts: { bufferOverridePaise?: number; save?: boolean; whatIf?: WhatIf } = {},
): Promise<{ ok: false; message: string } | QuestionResult> {
  const stats = ledgerStats();

  if (stats.txns === 0) {
    return { ok: false, message: "No transactions yet — upload a statement first." };
  }

  // Job 1: LLM parses the question (never sees ledger data).
  const parsed = await parseQuestion(rawQuestion);
  const question = parsed.question;

  const rawTxns = allTransactions();

  // What-if sandbox: cancelled subscriptions drop out of the scenario.
  const scenario = applyWhatIf(rawTxns, opts.whatIf);
  const txns = scenario.txns;

  // --- pure math -----------------------------------------------------------
  const months = monthsOfData(txns);
  const buffer = computeBuffer(txns);

  // hygiene counters + totals BEFORE the verdict gates
  const hygiene = runHygiene(txns);
  const flaggedDupes = hygiene.txns.filter((x) => x.flags.dup_p).length;
  const t = totals(hygiene.txns);
  const oneOffs = hygiene.txns.filter((x) => x.flags.one_off_income).length;

  const balance = currentBalancePaise();
  const flows = dailyNetFlows(txns);
  let band;
  try {
    band = bootstrapForecast(
      flows.slice(-90).map((f) => f.net_paise),
      balance,
    );
  } catch {
    band = bootstrapForecast(
      flows.map((f) => f.net_paise),
      balance,
      { block_days: Math.max(2, Math.min(30, flows.length)) },
    );
  }

  // EMI what-if: the monthly installment becomes the thing to afford.
  const emiMonthlyPaise = opts.whatIf?.emi_monthly_inr
    ? Math.round(opts.whatIf.emi_monthly_inr * 100)
    : 0;
  const pricePaise = emiMonthlyPaise > 0 ? emiMonthlyPaise : Math.round(question.price_inr * 100);

  const bufferPaise = opts.bufferOverridePaise ?? buffer.buffer_paise;
  let verdictResult: VerdictResult = computeVerdict({
    band,
    price_paise: pricePaise,
    buffer_paise: bufferPaise,
    months_of_data: months,
  });

  // Gatekeeper: no confirmed income at all → REFUSED (never fake affordability)
  if (verdictResult.verdict !== "REFUSED" && t.income_paise === 0) {
    verdictResult = {
      verdict: "REFUSED",
      shortfall_worst_case_paise: 0,
      shortfall_median_paise: 0,
      target_paise: pricePaise + bufferPaise,
      reason:
        "No regular income found in this history - a forecast would be a guess. Upload a statement that includes your salary or income.",
      banner: "Cannot forecast: No income found in your statements",
      months_of_data: months,
    };
  }

  // extras for the receipt
  const recurring = detectRecurring(hygiene.txns);
  const committedMonthly = recurring
    .filter((r) => r.kind !== "salary" && r.amount_paise < 0)
    .reduce((sum, r) => sum + Math.abs(r.amount_paise) * (30.44 / r.interval_days), 0);
  const variableBurn = medianDailyVariableSpend(hygiene.txns);
  const cashFloor = projectDailyCashFloor(balance, flows);
  const backtest = backtestScorecard(hygiene.txns);
  const anomalyRun = flagAnomalies(hygiene.txns);
  annotateAnomalyReasons(hygiene.txns);

  const anomalies = hygiene.txns.filter((x) => x.flags.mad_anomaly);
  const nettedRows = hygiene.txns.filter((x) => x.type === "netted");
  const transferRows = hygiene.txns.filter((x) => x.type === "transfer" || x.type === "card_bill");

  const trace: Receipt["trace"] = {
    top_debits: [...hygiene.txns]
      .filter((x) => x.amount_paise < 0)
      .sort((a, b) => a.amount_paise - b.amount_paise)
      .slice(0, 5)
      .map((x) => ({
        date: x.date,
        narration: x.clean_narration,
        amount_inr: Math.round(x.amount_paise / 100),
        category: x.category,
      })),
    anomaly_rows: anomalies.slice(0, 5).map((x) => ({
      date: x.date,
      narration: x.clean_narration,
      amount_inr: Math.round(x.amount_paise / 100),
    })),
    duplicate_rows: hygiene.txns
      .filter((x) => x.flags.dup_p)
      .slice(0, 5)
      .map((x) => ({
        date: x.date,
        narration: x.clean_narration,
        amount_inr: Math.round(x.amount_paise / 100),
      })),
    transfer_rows: transferRows.slice(0, 4).map((x) => ({
      date: x.date,
      narration: x.clean_narration,
      amount_inr: Math.round(x.amount_paise / 100),
    })),
    netted_rows: nettedRows.slice(0, 4).map((x) => ({
      date: x.date,
      narration: x.clean_narration,
      amount_inr: Math.round(x.amount_paise / 100),
    })),
  };

  const cardBills = hygiene.txns.filter((x) => x.type === "card_bill").length;

  const receipt = buildReceipt({
    question,
    window: {
      from: stats.first_date ?? "",
      to: stats.last_date ?? "",
      accounts: listAccounts().map((a) => a.id),
      txns: stats.txns,
    },
    balanceTodayPaise: balance,
    band,
    buffer: opts.bufferOverridePaise
      ? { ...buffer, buffer_paise: opts.bufferOverridePaise }
      : buffer,
    excluded: {
      internal_transfers: hygiene.summary.transfers,
      netted_failed_upi: hygiene.summary.netted_failed_upi,
      card_bills: cardBills,
      one_off_income: oneOffs,
    },
    flags: {
      possible_duplicates: flaggedDupes,
      merged_duplicates: hygiene.summary.merged_duplicates,
      mad_anomalies: anomalyRun.flagged.size,
      anomaly_note: anomalyRun.note,
    },
    totals: { income_paise: t.income_paise, spend_paise: t.spend_paise },
    confirmedIncomePaise: t.income_paise,
    committedOutflowsPaise: committedMonthly,
    variableBurnPaise: variableBurn,
    verdict: verdictResult.verdict,
    verdictBanner: verdictResult.banner,
    shortfallWorstPaise: verdictResult.shortfall_worst_case_paise,
    monthsOfData: months,
    cashFloor,
    recurring,
    backtest,
    trace,
    llm: {
      question_source: parsed.source,
      phrasing_source: "fallback",
      provider: process.env.LLM_PROVIDER ?? "gemini",
    },
  });

  // Job 3: LLM phrases the sentence — numbers arrive as strings.
  const phrase = await phraseVerdict({
    verdict: verdictResult.verdict,
    reason: verdictResult.reason,
    strings: {
      price: (pricePaise / 100).toLocaleString("en-IN"),
      buffer: (bufferPaise / 100).toLocaleString("en-IN"),
      p10: (band.p10 / 100).toLocaleString("en-IN"),
      p50: (band.p50 / 100).toLocaleString("en-IN"),
      p90: (band.p90 / 100).toLocaleString("en-IN"),
      shortfall_worst: (Math.max(0, verdictResult.shortfall_worst_case_paise) / 100).toLocaleString("en-IN"),
      shortfall_median: (Math.max(0, verdictResult.shortfall_median_paise) / 100).toLocaleString("en-IN"),
      months: String(months),
    },
  });

  receipt.llm = {
    question_source: parsed.source,
    phrasing_source: phrase.source,
    provider: process.env.LLM_PROVIDER ?? "gemini",
  };

  let verdictId: number | undefined;
  if (opts.save !== false) {
    verdictId = saveVerdict({ question, receipt, verdict: verdictResult.verdict });
  }

  return {
    ok: true,
    verdict: verdictResult.verdict,
    verdict_display: VERDICT_DISPLAY[verdictResult.verdict],
    banner: verdictResult.banner ?? null,
    sentence:
      verdictResult.verdict === "REFUSED" ? verdictResult.reason : phrase.sentence,
    receipt,
    question,
    whatif: { applied: scenario.applied },
    live: {
      band: { p10: band.p10, p50: band.p50, p90: band.p90 },
      buffer_paise: bufferPaise,
      price_paise: pricePaise,
      months_of_data: months,
    },
    llm: receipt.llm,
    verdict_id: verdictId,
  };
}

/** Lightweight forecast for the chart (no question yet). */
export function forecastOnly(): {
  ok: boolean;
  band: { p10: number; p50: number; p90: number } | null;
  meta: Record<string, unknown>;
  balance_paise: number;
  months_of_data: number;
  needs: string | null;
} {
  const stats = ledgerStats();

  if (stats.txns === 0) {
    return {
      ok: false,
      band: null,
      meta: {},
      balance_paise: 0,
      months_of_data: 0,
      needs: "empty",
    };
  }

  const txns = allTransactions();
  const months = monthsOfData(txns);
  const flows = dailyNetFlows(txns);
  const balance = currentBalancePaise();

  const band = bootstrapForecast(
    flows.slice(-90).map((f) => f.net_paise),
    balance,
  );

  return {
    ok: true,
    band: { p10: band.p10, p50: band.p50, p90: band.p90 },
    meta: {
      method: band.method,
      draws: band.draws,
      block_days: band.block_days,
      seed: band.seed,
      horizon_days: band.horizon_days,
    },
    balance_paise: balance,
    months_of_data: months,
    needs: months < MIN_MONTHS_FOR_VERDICT ? "more_history" : null,
  };
}

export { type LedgerTxn };
