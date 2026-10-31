/**
 * The receipt object (Build Bible §9.4) — ships with EVERY answer.
 *
 * Design rule: every number the UI shows must appear here, with enough
 * context to trace it back to named transactions. If a judge asks
 * "where does ₹18,400 of buffer come from?", the answer is two lines in
 * this JSON.
 */
import type {
  BacktestScorecard,
  BufferBreakdown,
  ForecastBand,
  Question,
  RecurringCommitment,
  Verdict,
} from "@/lib/types";

/** Display names for verdicts aligned with Money Matters Color Psychology (4 states). */
export const VERDICT_DISPLAY: Record<Verdict | string, string> = {
  YES: "COMFORTABLE",
  AFFORDABLE: "COMFORTABLE",
  TIGHT: "TIGHT",
  NO: "NOT AFFORDABLE",
  NOT_AFFORDABLE: "NOT AFFORDABLE",
  REFUSED: "INSUFFICIENT DATA",
  CANNOT_FORECAST: "INSUFFICIENT DATA",
};

/** One structured line of the 6-line receipt. */
export type ReceiptLine = {
  n: 1 | 2 | 3 | 4 | 5 | 6;
  label: string;
  value_inr: number;
  note: string;
};

export type Receipt = {
  question: Question;
  data_window: {
    from: string;
    to: string;
    accounts: string[];
    txns: number;
  };
  balance_today_inr: number;
  forecast: {
    p10: number;
    p50: number;
    p90: number;
    method: string;
    draws: number;
    block_days: number;
    seed: number;
  };
  buffer_inr: number;
  buffer_parts: {
    worst_month_overshoot: number;
    one_week_essentials: number;
    median_monthly_variable: number;
    worst_month_variable: number;
    median_daily_essential: number;
    worst_month: string;
    mab_headroom: number;
    fifteen_day_burn: number;
    volatility_cushion: number;
    dominant_branch: string;
  };
  excluded: {
    internal_transfers: number;
    netted_failed_upi: number;
    card_bills: number;
    one_off_income: number;
  };
  flags: {
    possible_duplicates: number;
    merged_duplicates: number;
    mad_anomalies: number;
    anomaly_note: string;
  };
  totals: {
    income_inr: number;
    spend_inr: number;
  };
  verdict: string;
  /** Human verdict: AFFORDABLE / TIGHT / NOT AFFORDABLE / CANNOT FORECAST. */
  verdict_display: string;
  /** Big REFUSED banner ("Cannot forecast: …"), null otherwise. */
  verdict_banner: string | null;
  shortfall_worst_case_inr: number;
  months_of_data: number;
  /** The 6-line structured receipt (demo heart). */
  lines: ReceiptLine[];
  /** Day-by-day projected cash floor (deterministic central path). */
  cash_floor: {
    start_inr: number;
    min_inr: number;
    min_date: string;
    end_inr: number;
    points: { date: string; balance_inr: number }[];
  };
  recurring: {
    count: number;
    monthly_committed_inr: number;
    items: {
      merchant: string;
      amount_inr: number;
      interval_days: number;
      next_expected_date: string;
      confidence: string;
      kind: string;
    }[];
  };
  backtest: {
    ok: boolean;
    note: string;
    months_tested: number;
    mean_abs_error_pct: number | null;
    entries: { month: string; predicted_inr: number; actual_inr: number; error_pct: number }[];
  };
  /** Named transactions behind the biggest numbers (traceability). */
  trace: {
    top_debits: { date: string; narration: string; amount_inr: number; category: string | null }[];
    anomaly_rows: { date: string; narration: string; amount_inr: number }[];
    duplicate_rows: { date: string; narration: string; amount_inr: number }[];
    transfer_rows: { date: string; narration: string; amount_inr: number }[];
    netted_rows: { date: string; narration: string; amount_inr: number }[];
  };
  llm: {
    question_source: "llm" | "fallback";
    phrasing_source: "llm" | "fallback";
    provider: string;
  };
  computed_by: string;
};

export type ReceiptInputs = {
  question: Question;
  window: { from: string; to: string; accounts: string[]; txns: number };
  balanceTodayPaise: number;
  band: ForecastBand;
  buffer: BufferBreakdown;
  excluded: {
    internal_transfers: number;
    netted_failed_upi: number;
    card_bills: number;
    one_off_income: number;
  };
  flags: {
    possible_duplicates: number;
    merged_duplicates: number;
    mad_anomalies: number;
    anomaly_note: string;
  };
  totals: { income_paise: number; spend_paise: number };
  /** Confirmed regular income (one-off bonus already excluded). */
  confirmedIncomePaise: number;
  /** Monthly committed outflows from the recurring engine. */
  committedOutflowsPaise: number;
  /** Median daily variable burn. */
  variableBurnPaise: number;
  verdict: Verdict;
  verdictBanner?: string;
  shortfallWorstPaise: number;
  monthsOfData: number;
  cashFloor: { points: { date: string; projected_balance_paise: number }[]; floor_paise: number; floor_date: string };
  recurring: RecurringCommitment[];
  backtest: BacktestScorecard;
  trace: Receipt["trace"];
  llm: Receipt["llm"];
};

const inr = (paise: number): number => Math.round(paise / 100);

export function buildReceipt(i: ReceiptInputs): Receipt {
  const months = Math.max(1, i.monthsOfData);
  const windowDays = Math.max(30, Math.round(months * 30.44));
  const confirmedMonthly = (i.confirmedIncomePaise / windowDays) * 30.44;

  const lines: ReceiptLine[] = [
    {
      n: 1,
      label: "Starting balance",
      value_inr: inr(i.balanceTodayPaise),
      note: `sum of every non-transfer flow across ${i.window.txns} rows`,
    },
    {
      n: 2,
      label: "Confirmed income (per month)",
      value_inr: inr(confirmedMonthly),
      note: i.excluded.one_off_income
        ? `one-off bonus/gift (${i.excluded.one_off_income} credit(s)) excluded`
        : "salary + recurring credits only",
    },
    {
      n: 3,
      label: "Committed outflows (per month)",
      value_inr: inr(i.committedOutflowsPaise),
      note: `${i.recurring.length} recurring commitment(s): EMI, rent, SIP, subscriptions`,
    },
    {
      n: 4,
      label: "Variable burn rate (per day)",
      value_inr: inr(i.variableBurnPaise),
      note: "median daily non-essential spend",
    },
    {
      n: 5,
      label: "Safety buffer",
      value_inr: inr(i.buffer.buffer_paise),
      note: `max(MAB ₹${inr(i.buffer.mab_headroom_paise).toLocaleString("en-IN")}, 15-day burn ₹${inr(i.buffer.fifteen_day_burn_paise).toLocaleString("en-IN")}, volatility cushion ₹${inr(i.buffer.volatility_cushion_paise).toLocaleString("en-IN")}) — dominant: ${i.buffer.dominant_branch}`,
    },
    {
      n: 6,
      label: "Projected cash floor (30 days)",
      value_inr: inr(i.cashFloor.floor_paise),
      note: `${VERDICT_DISPLAY[i.verdict]} · lowest projected day ${i.cashFloor.floor_date}`,
    },
  ];

  return {
    question: i.question,
    data_window: i.window,
    balance_today_inr: inr(i.balanceTodayPaise),
    forecast: {
      p10: inr(i.band.p10),
      p50: inr(i.band.p50),
      p90: inr(i.band.p90),
      method: i.band.method,
      draws: i.band.draws,
      block_days: i.band.block_days,
      seed: i.band.seed,
    },
    buffer_inr: inr(i.buffer.buffer_paise),
    buffer_parts: {
      worst_month_overshoot: inr(i.buffer.worst_month_overshoot_paise),
      one_week_essentials: inr(i.buffer.one_week_essentials_paise),
      median_monthly_variable: inr(i.buffer.median_monthly_variable_paise),
      worst_month_variable: inr(i.buffer.worst_month_variable_paise),
      median_daily_essential: inr(i.buffer.median_daily_essential_paise),
      worst_month: i.buffer.worst_month,
      mab_headroom: inr(i.buffer.mab_headroom_paise),
      fifteen_day_burn: inr(i.buffer.fifteen_day_burn_paise),
      volatility_cushion: inr(i.buffer.volatility_cushion_paise),
      dominant_branch: i.buffer.dominant_branch,
    },
    excluded: i.excluded,
    flags: i.flags,
    totals: {
      income_inr: inr(i.totals.income_paise),
      spend_inr: inr(i.totals.spend_paise),
    },
    verdict: i.verdict,
    verdict_display: VERDICT_DISPLAY[i.verdict] ?? i.verdict,
    verdict_banner: i.verdictBanner ?? null,
    shortfall_worst_case_inr: inr(i.shortfallWorstPaise),
    months_of_data: i.monthsOfData,
    lines,
    cash_floor: {
      start_inr: inr(i.balanceTodayPaise),
      min_inr: inr(i.cashFloor.floor_paise),
      min_date: i.cashFloor.floor_date,
      end_inr: inr(i.cashFloor.points[i.cashFloor.points.length - 1]?.projected_balance_paise ?? i.balanceTodayPaise),
      points: i.cashFloor.points.map((p) => ({
        date: p.date,
        balance_inr: inr(p.projected_balance_paise),
      })),
    },
    recurring: {
      count: i.recurring.length,
      monthly_committed_inr: inr(i.committedOutflowsPaise),
      items: i.recurring.map((r) => ({
        merchant: r.merchant,
        amount_inr: inr(r.amount_paise),
        interval_days: r.interval_days,
        next_expected_date: r.next_expected_date,
        confidence: r.confidence,
        kind: r.kind,
      })),
    },
    backtest: {
      ok: i.backtest.ok,
      note: i.backtest.note,
      months_tested: i.backtest.months_tested,
      mean_abs_error_pct: i.backtest.mean_abs_error_pct,
      entries: i.backtest.entries.map((e) => ({
        month: e.month,
        predicted_inr: inr(e.predicted_p50_paise),
        actual_inr: inr(e.actual_close_paise),
        error_pct: e.error_pct,
      })),
    },
    trace: i.trace,
    llm: i.llm,
    computed_by: "pure functions, unit-tested, seed 42",
  };
}
