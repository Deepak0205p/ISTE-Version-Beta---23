"use client";

/**
 * Receipt panel — renders the receipt JSON so every on-screen number traces
 * to named transactions (Build Bible §9.4). Top of the panel: the 6-line
 * structured receipt (starting balance → cash floor & verdict).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type Receipt = {
  question: { item: string; price_inr: number; horizon: string };
  data_window: { from: string; to: string; accounts: string[]; txns: number };
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
  totals: { income_inr: number; spend_inr: number };
  verdict: string;
  verdict_display: string;
  verdict_banner: string | null;
  shortfall_worst_case_inr: number;
  months_of_data: number;
  lines?: {
    n: number;
    label: string;
    value_inr: number;
    note: string;
  }[];
  cash_floor?: {
    start_inr: number;
    min_inr: number;
    min_date: string;
    end_inr: number;
    points: { date: string; balance_inr: number }[];
  };
  recurring?: {
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
  backtest?: {
    ok: boolean;
    note: string;
    months_tested: number;
    mean_abs_error_pct: number | null;
    entries: { month: string; predicted_inr: number; actual_inr: number; error_pct: number }[];
  };
  trace: {
    top_debits: { date: string; narration: string; amount_inr: number; category: string | null }[];
    anomaly_rows: { date: string; narration: string; amount_inr: number }[];
    duplicate_rows: { date: string; narration: string; amount_inr: number }[];
    transfer_rows: { date: string; narration: string; amount_inr: number }[];
    netted_rows: { date: string; narration: string; amount_inr: number }[];
  };
  llm: { question_source: string; phrasing_source: string; provider: string };
  computed_by: string;
};

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-mono text-xs tabular-nums">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-border border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:text-foreground flex w-full items-center justify-between py-1.5 text-left text-xs font-medium"
      >
        {title}
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function TraceList({
  rows,
  empty,
}: {
  rows: { date: string; narration: string; amount_inr: number }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-muted-foreground text-xs">{empty}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted-foreground font-mono shrink-0">{r.date}</span>
          <span className="truncate font-mono">{r.narration}</span>
          <span className="font-mono tabular-nums shrink-0">
            ₹{r.amount_inr.toLocaleString("en-IN")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReceiptPanel({ receipt }: { receipt: Receipt }) {
  const r = receipt;
  return (
    <div className="border-border bg-muted/30 space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Receipt</h4>
        <span className="text-muted-foreground font-mono text-[10px]">{r.computed_by}</span>
      </div>

      {/* ---- the 6-line structured receipt ------------------------------ */}
      {r.lines && r.lines.length > 0 && (
        <div className="border-border space-y-1.5 rounded-lg border bg-background/60 p-3">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase">
            The answer, in six lines
          </p>
          {r.lines.map((line) => (
            <div key={line.n} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-muted-foreground font-mono shrink-0 w-4">{line.n}.</span>
              <span className="flex-1">
                <span className="font-medium">{line.label}</span>
                <span className="text-muted-foreground block text-[10px] leading-snug">
                  {line.note}
                </span>
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums shrink-0">
                ₹{line.value_inr.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-x-6 sm:grid-cols-2">
        <div>
          <Row label="Question" value={`₹${r.question.price_inr.toLocaleString("en-IN")} · ${r.question.item}`} />
          <Row label="Data window" value={`${r.data_window.from} → ${r.data_window.to}`} />
          <Row label="Accounts" value={r.data_window.accounts.join(", ") || "—"} />
          <Row label="Transactions" value={r.data_window.txns} />
          <Row label="History" value={`${r.months_of_data} months`} />
        </div>
        <div>
          <Row label="Balance today" value={`₹${r.balance_today_inr.toLocaleString("en-IN")}`} />
          <Row label="Income (net)" value={`₹${r.totals.income_inr.toLocaleString("en-IN")}`} />
          <Row label="Spend (net)" value={`₹${r.totals.spend_inr.toLocaleString("en-IN")}`} />
          <Row label="Verdict" value={`${r.verdict_display} (${r.verdict})`} />
          <Row
            label="Shortfall (worst case)"
            value={
              r.shortfall_worst_case_inr > 0
                ? `₹${r.shortfall_worst_case_inr.toLocaleString("en-IN")}`
                : "—"
            }
          />
        </div>
      </div>

      <Section title="Forecast (moving-block bootstrap)" defaultOpen>
        <Row label="P10 · worst case" value={`₹${r.forecast.p10.toLocaleString("en-IN")}`} />
        <Row label="P50 · median plan" value={`₹${r.forecast.p50.toLocaleString("en-IN")}`} />
        <Row label="P90 · best case" value={`₹${r.forecast.p90.toLocaleString("en-IN")}`} />
        <Row
          label="Method"
          value={`${r.forecast.method} · ${r.forecast.draws} draws · ${r.forecast.block_days}d block · seed ${r.forecast.seed}`}
        />
      </Section>

      <Section title="Safety buffer = max(MAB, 15-day burn, volatility)" defaultOpen>
        <Row label="Buffer total" value={`₹${r.buffer_inr.toLocaleString("en-IN")}`} />
        <Row label="MAB headroom" value={`₹${r.buffer_parts.mab_headroom.toLocaleString("en-IN")}`} />
        <Row label="15-day burn (essentials)" value={`₹${r.buffer_parts.fifteen_day_burn.toLocaleString("en-IN")}`} />
        <Row label="Volatility cushion" value={`₹${r.buffer_parts.volatility_cushion.toLocaleString("en-IN")}`} />
        <Row label="→ dominant branch" value={r.buffer_parts.dominant_branch} />
        <Row
          label={`Worst month overshoot (${r.buffer_parts.worst_month})`}
          value={`₹${r.buffer_parts.worst_month_overshoot.toLocaleString("en-IN")}`}
        />
        <Row label="One week essentials" value={`₹${r.buffer_parts.one_week_essentials.toLocaleString("en-IN")}`} />
        <Row label="Median monthly variable" value={`₹${r.buffer_parts.median_monthly_variable.toLocaleString("en-IN")}`} />
        <Row label="Median daily essential" value={`₹${r.buffer_parts.median_daily_essential.toLocaleString("en-IN")}`} />
      </Section>

      {/* ---- day-by-day cash floor ------------------------------------- */}
      {r.cash_floor && (
        <Section title={`Daily cash floor (lowest ₹${r.cash_floor.min_inr.toLocaleString("en-IN")} on ${r.cash_floor.min_date})`}>
          <CashFloorSpark points={r.cash_floor.points} />
          <Row label="Start" value={`₹${r.cash_floor.start_inr.toLocaleString("en-IN")}`} />
          <Row label="Lowest projected day" value={`₹${r.cash_floor.min_inr.toLocaleString("en-IN")} · ${r.cash_floor.min_date}`} />
          <Row label="End (day 30)" value={`₹${r.cash_floor.end_inr.toLocaleString("en-IN")}`} />
        </Section>
      )}

      {/* ---- recurring commitments -------------------------------------- */}
      {r.recurring && (
        <Section
          title={`Recurring commitments (${r.recurring.count} · ₹${r.recurring.monthly_committed_inr.toLocaleString("en-IN")}/mo)`}
        >
          {r.recurring.items.length === 0 ? (
            <p className="text-muted-foreground text-xs">No recurring commitments detected.</p>
          ) : (
            <ul className="space-y-1">
              {r.recurring.items.map((it, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-mono">{it.merchant}</span>
                  <span className="text-muted-foreground shrink-0">
                    {it.kind} · every {it.interval_days}d · next {it.next_expected_date} · {it.confidence}
                  </span>
                  <span className="font-mono tabular-nums shrink-0">
                    ₹{it.amount_inr.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* ---- backtest scorecard ----------------------------------------- */}
      {r.backtest && (
        <Section title={`Backtest scorecard (${r.backtest.months_tested} months · ${r.backtest.mean_abs_error_pct ?? "—"}% MAPE)`}>
          {!r.backtest.ok ? (
            <p className="text-muted-foreground text-xs">{r.backtest.note}</p>
          ) : (
            <ul className="space-y-1">
              {r.backtest.entries.map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-mono shrink-0">{e.month}</span>
                  <span className="text-muted-foreground">
                    P50 ₹{e.predicted_inr.toLocaleString("en-IN")} vs actual ₹
                    {e.actual_inr.toLocaleString("en-IN")}
                  </span>
                  <span className="font-mono tabular-nums shrink-0">{e.error_pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Excluded & flagged">
        <Row label="Internal transfers excluded" value={r.excluded.internal_transfers} />
        <Row label="Credit-card bills eliminated" value={r.excluded.card_bills} />
        <Row label="Failed UPI pairs netted" value={r.excluded.netted_failed_upi} />
        <Row label="One-off credits excluded from income" value={r.excluded.one_off_income} />
        <Row label="Possible duplicates (flagged, kept)" value={r.flags.possible_duplicates} />
        <Row label="Identical rows merged (M-class)" value={r.flags.merged_duplicates} />
        <Row label="MAD anomalies" value={`${r.flags.mad_anomalies} (${r.flags.anomaly_note})`} />
      </Section>

      <Section title="Trace · named transactions behind the numbers">
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
              Top debits (spend drivers)
            </p>
            <TraceList rows={r.trace.top_debits} empty="No debits in window." />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
              Anomalies (excluded from median income)
            </p>
            <TraceList rows={r.trace.anomaly_rows} empty="No anomalies flagged." />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
              Possible duplicates (kept, awaiting your call)
            </p>
            <TraceList rows={r.trace.duplicate_rows} empty="No possible duplicates." />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
              Internal transfers (excluded from income & spend)
            </p>
            <TraceList rows={r.trace.transfer_rows} empty="No internal transfers." />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
              Netted failed UPIs (contribute nothing)
            </p>
            <TraceList rows={r.trace.netted_rows} empty="No failed-UPI pairs." />
          </div>
        </div>
      </Section>

      <Section title="Provenance">
        <Row label="Question parser" value={r.llm.question_source} />
        <Row label="Verdict phrasing" value={r.llm.phrasing_source} />
        <Row label="LLM provider" value={r.llm.provider} />
        <p className="text-muted-foreground mt-1 text-[10px]">
          Arithmetic: pure functions only. The LLM never computes a rupee figure.
        </p>
      </Section>
    </div>
  );
}

/** Tiny deterministic sparkline of the projected balance. */
function CashFloorSpark({ points }: { points: { date: string; balance_inr: number }[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.balance_inr);
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values);
  const x = (i: number) => (i / (points.length - 1)) * 320;
  const y = (v: number) => 60 - ((v - lo) / Math.max(1, hi - lo)) * 52;

  return (
    <svg viewBox="0 0 320 64" className="mb-1 h-16 w-full" role="img" aria-label="Daily cash floor">
      <polygon
        points={`0,${y(lo)} ${values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} 320,${y(lo)}`}
        fill="var(--color-chart-1, #888)"
        opacity="0.18"
      />
      <polyline
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        fill="none"
        stroke="var(--color-chart-1, #888)"
        strokeWidth="2"
      />
      <line x1="0" y1={y(0)} x2="320" y2={y(0)} stroke="var(--color-chart-2, #c44)" strokeWidth="1" strokeDasharray="4 3" />
    </svg>
  );
}
