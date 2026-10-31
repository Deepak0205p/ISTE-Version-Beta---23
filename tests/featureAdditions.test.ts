import { describe, expect, it } from "vitest";
import {
  ANOMALY_REASONS,
  annotateAnomalyReasons,
  backtestScorecard,
  detectRecurring,
  markOneOffIncome,
  medianDailyVariableSpend,
  merchantKey,
  projectDailyCashFloor,
  dailyNetFlows,
} from "@/lib/mathEngine";
import {
  markCardBills,
  markTransfers,
  runHygiene,
  totals,
} from "@/lib/ledgerHygiene";
import { applyWhatIf } from "@/lib/pipeline";
import { normalizeBankCsv } from "@/lib/csvNormalizer";
import { getAdapter } from "@/config/bankAdapters";
import { BUILTIN_ALIASES, categorize } from "@/lib/categorizer";
import { VERDICT_DISPLAY } from "@/lib/receipt";
import type { LedgerTxn } from "@/lib/types";

let seq = 0;
function txn(p: Partial<LedgerTxn> & { date: string; amount_paise: number }): LedgerTxn {
  seq++;
  return {
    account_id: "acc-a",
    raw_narration: p.raw_narration ?? "NARRATION",
    clean_narration: p.clean_narration ?? p.raw_narration ?? "NARRATION",
    ref: p.ref ?? null,
    category: p.category ?? null,
    type: "normal",
    flags: {},
    txn_hash: `h${seq}`,
    ...p,
  } as LedgerTxn;
}

// ---------------------------------------------------------------------------
// Recurring commitments engine
// ---------------------------------------------------------------------------

describe("recurring commitments engine", () => {
  it("finds a monthly Netflix with High confidence and a next date", () => {
    const txns = ["2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05"].map((d) =>
      txn({ date: d, amount_paise: -59900, raw_narration: "NACH NETFLIX INDIA", category: "entertainment" }),
    );
    const out = detectRecurring(txns);
    const nf = out.find((r) => r.merchant.includes("NETFLIX"));
    expect(nf).toBeTruthy();
    expect(nf!.interval_days).toBeGreaterThanOrEqual(28);
    expect(nf!.interval_days).toBeLessThanOrEqual(32);
    expect(nf!.next_expected_date).toBe("2026-11-04"); // last + median gap
    expect(nf!.occurrences).toBe(5);
    expect(nf!.confidence).toBe("High");
    expect(nf!.kind).toBe("subscription");
  });

  it("salary shows up as kind=salary, EMI as kind=emi", () => {
    const txns = [
      ...["2026-08-01", "2026-09-01", "2026-10-01"].map((d) =>
        txn({ date: d, amount_paise: 7200000, raw_narration: "NEFT SALARY CREDIT", category: "income" }),
      ),
      ...["2026-08-05", "2026-09-05", "2026-10-05"].map((d) =>
        txn({ date: d, amount_paise: -1250000, raw_narration: "HDFC LOAN EMI", category: "emi" }),
      ),
    ];
    const out = detectRecurring(txns);
    expect(out.some((r) => r.kind === "salary")).toBe(true);
    expect(out.some((r) => r.kind === "emi")).toBe(true);
  });

  it("ignores groups with fewer than 3 occurrences", () => {
    const txns = [
      txn({ date: "2026-09-01", amount_paise: -59900, raw_narration: "NETFLIX" }),
      txn({ date: "2026-10-01", amount_paise: -59900, raw_narration: "NETFLIX" }),
    ];
    expect(detectRecurring(txns)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// One-off income (bonus ≠ salary)
// ---------------------------------------------------------------------------

describe("one-off income detection", () => {
  it("flags a one-off bonus that never repeats, keeps monthly salary regular", () => {
    const txns = [
      ...["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"].map((d) =>
        txn({ date: d, amount_paise: 2000000, raw_narration: "NEFT SALARY CREDIT", category: "income" }),
      ),
      txn({ date: "2026-09-15", amount_paise: 10000000, raw_narration: "IMPS FESTIVE BONUS", category: "income" }),
    ];
    const flagged = markOneOffIncome(txns);
    expect(flagged).toBe(1);
    const bonus = txns.find((t) => t.clean_narration.includes("BONUS"))!;
    expect(bonus.flags.one_off_income).toBe(true);
    const salary = txns.find((t) => t.clean_narration.includes("SALARY"))!;
    expect(salary.flags.one_off_income).toBeFalsy();
  });

  it("a big credit that recurred within 60 days is NOT one-off", () => {
    const txns = [
      txn({ date: "2026-09-01", amount_paise: 4500000, raw_narration: "IMPS CLIENT PAYMENT" }),
      txn({ date: "2026-10-10", amount_paise: 4500000, raw_narration: "IMPS CLIENT PAYMENT" }),
      txn({ date: "2026-08-01", amount_paise: 100000, raw_narration: "UPI SMALL" }),
    ];
    expect(markOneOffIncome(txns)).toBe(0);
  });

  it("totals() excludes one-off credits from regular income", () => {
    const txns = [
      txn({ date: "2026-10-01", amount_paise: 7200000, raw_narration: "SALARY" }),
      txn({ date: "2026-10-02", amount_paise: 4500000, raw_narration: "BONUS", flags: { one_off_income: true } }),
    ];
    const t = totals(txns);
    expect(t.income_paise).toBe(7200000);
    expect(t.excluded_one_off_income).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The four exact anomaly reasons
// ---------------------------------------------------------------------------

describe("anomaly reasons", () => {
  it("duplicate, p95, and new-high-value-merchant reasons use exact strings", () => {
    const txns: LedgerTxn[] = [];
    // a busy history of small spends so ₹25k lands above p95
    for (let i = 1; i <= 30; i++) {
      txns.push(
        txn({
          date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
          amount_paise: -20000 - i * 100,
          raw_narration: `UPI/BLINKIT ${i}`,
          category: "groceries",
        }),
      );
    }
    // new merchant, high value
    txns.push(
      txn({ date: "2026-10-05", amount_paise: -2500000, raw_narration: "POS CROMA ELECTRONICS", category: "shopping" }),
    );
    // P-class duplicate pair
    txns.push(
      txn({ date: "2026-10-06", amount_paise: -20000, raw_narration: "UPI/CHAI POINT 20", ref: "R1", flags: { dup_p: true } }),
      txn({ date: "2026-10-07", amount_paise: -20000, raw_narration: "UPI/CHAI POINT 20", ref: "R2", flags: { dup_p: true } }),
    );

    const flagged = annotateAnomalyReasons(txns);
    expect(flagged).toBeGreaterThanOrEqual(3);

    const croma = txns.find((t) => t.clean_narration.includes("CROMA"))!;
    expect(croma.flags.anomaly_reasons).toContain(ANOMALY_REASONS.new_merchant);
    expect(croma.flags.anomaly_reasons).toContain(ANOMALY_REASONS.p95);

    const chai = txns.find((t) => t.clean_narration.includes("CHAI"))!;
    expect(chai.flags.anomaly_reasons).toContain(ANOMALY_REASONS.duplicate_charge);
  });

  it("subscription price jump > 20% gets the exact price-jump reason", () => {
    const txns = [
      txn({ date: "2026-08-05", amount_paise: -59900, raw_narration: "NACH NETFLIX INDIA", category: "entertainment" }),
      txn({ date: "2026-09-05", amount_paise: -59900, raw_narration: "NACH NETFLIX INDIA", category: "entertainment" }),
      txn({ date: "2026-10-05", amount_paise: -89900, raw_narration: "NACH NETFLIX INDIA", category: "entertainment" }),
    ];
    annotateAnomalyReasons(txns);
    const latest = txns[2];
    expect(latest.flags.anomaly_reasons).toContain(ANOMALY_REASONS.price_jump);
  });
});

// ---------------------------------------------------------------------------
// Daily cash floor
// ---------------------------------------------------------------------------

describe("daily cash floor", () => {
  it("projects day-by-day using the median daily net flow, deterministically", () => {
    const flows = [
      { date: "2026-10-01", net_paise: -100000 },
      { date: "2026-10-02", net_paise: -100000 },
      { date: "2026-10-03", net_paise: -100000 },
    ];
    const floor = projectDailyCashFloor(1000000, flows, 5);
    expect(floor.points).toHaveLength(5);
    expect(floor.points[0].projected_balance_paise).toBe(900000); // 10L - 10k
    expect(floor.points[4].projected_balance_paise).toBe(500000);
    expect(floor.floor_paise).toBe(500000);
    expect(floor.floor_date).toBe("2026-10-08");
    // deterministic: same input, same output
    const again = projectDailyCashFloor(1000000, flows, 5);
    expect(again.floor_paise).toBe(floor.floor_paise);
  });

  it("median daily variable spend includes zero days", () => {
    const txns = [
      txn({ date: "2026-10-01", amount_paise: -100000, category: "dining" }),
      txn({ date: "2026-10-05", amount_paise: -100000, category: "dining" }),
    ];
    // 5 days, values: 1000,0,0,0,1000 → median 0
    expect(medianDailyVariableSpend(txns)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Backtest scorecard
// ---------------------------------------------------------------------------

describe("forecast backtest scorecard", () => {
  function syntheticMonths(n: number): LedgerTxn[] {
    const txns: LedgerTxn[] = [];
    for (let m = 0; m < n; m++) {
      const mm = String(m + 1).padStart(2, "0");
      for (let d = 1; d <= 28; d++) {
        const dd = String(d).padStart(2, "0");
        txns.push(
          txn({ date: `2026-${mm}-${dd}`, amount_paise: -20000 - (d % 5) * 1000, category: "dining" }),
        );
      }
      txns.push(txn({ date: `2026-${mm}-01`, amount_paise: 7200000, category: "income", raw_narration: "SALARY" }));
    }
    return txns;
  }

  it("needs at least 4 months and says so honestly", () => {
    const res = backtestScorecard(syntheticMonths(3));
    expect(res.ok).toBe(false);
    expect(res.note).toMatch(/at least 4 months/);
  });

  it("walks forward over complete months with seed 42", () => {
    const res = backtestScorecard(syntheticMonths(6));
    expect(res.ok).toBe(true);
    expect(res.months_tested).toBeGreaterThanOrEqual(4);
    expect(res.mean_abs_error_pct).not.toBeNull();
    for (const e of res.entries) {
      expect(e.month).toMatch(/^\d{4}-\d{2}$/);
      expect(e.error_pct).toBeGreaterThanOrEqual(0);
    }
    // deterministic
    const again = backtestScorecard(syntheticMonths(6));
    expect(again.entries).toEqual(res.entries);
  });
});

// ---------------------------------------------------------------------------
// What-if sandbox (pure)
// ---------------------------------------------------------------------------

describe("what-if sandbox", () => {
  it("cancel a subscription → rows flagged, flows change, nothing deleted", () => {
    const txns = [
      txn({ date: "2026-10-01", amount_paise: -59900, raw_narration: "NACH NETFLIX INDIA" }),
      txn({ date: "2026-10-02", amount_paise: -20000, raw_narration: "UPI/BLINKIT" }),
    ];
    const res = applyWhatIf(txns, { cancel_subscriptions: ["NETFLIX"] });
    expect(res.applied).toHaveLength(1);
    expect(txns[0].flags.whatif_removed).toBeFalsy(); // input untouched

    const sum = (l: LedgerTxn[]) => l.reduce((s, t) => s + t.amount_paise, 0);
    // the Netflix debit is gone from the scenario's flows…
    expect(dailyNetFlows(res.txns).reduce((s, f) => s + f.net_paise, 0))
      .toBe(dailyNetFlows(txns).reduce((s, f) => s + f.net_paise, 0) + 59900);
    expect(sum(res.txns)).toBe(sum(txns)); // …but the row itself is kept
    expect(res.txns).toHaveLength(2); // row kept, just flagged
  });

  it("no what-if → identical ledger", () => {
    const txns = [txn({ date: "2026-10-01", amount_paise: -100 })];
    expect(applyWhatIf(txns, undefined).txns).toBe(txns);
  });
});

// ---------------------------------------------------------------------------
// Card-bill elimination + ±2-day transfer window
// ---------------------------------------------------------------------------

describe("card bills and transfer window", () => {
  it("a debit paying your own credit card becomes type=card_bill, excluded from spend", () => {
    const txns = [
      txn({ date: "2026-10-05", amount_paise: -4200000, raw_narration: "NEFT HDFC CARD PAYMENT 1234" }),
      txn({ date: "2026-10-06", amount_paise: -50000, raw_narration: "UPI/BLINKIT" }),
    ];
    const marked = markCardBills(txns);
    expect(marked).toBe(1);
    expect(txns[0].type).toBe("card_bill");
    const t = totals(txns);
    expect(t.spend_paise).toBe(50000); // card bill excluded
  });

  it("transfer window is ±2 days (weekend settle)", () => {
    const txns = [
      txn({ account_id: "hdfc-a", date: "2026-10-01", amount_paise: -1000000, raw_narration: "TFR OUT" }),
      txn({ account_id: "sbi-b", date: "2026-10-03", amount_paise: 1000000, raw_narration: "TFR IN" }),
    ];
    expect(markTransfers(txns)).toBe(1);
    expect(txns[0].type).toBe("transfer");
    expect(txns[1].type).toBe("transfer");
  });

  it("3 days apart is NOT a transfer", () => {
    const txns = [
      txn({ account_id: "hdfc-a", date: "2026-10-01", amount_paise: -1000000, raw_narration: "TFR OUT" }),
      txn({ account_id: "sbi-b", date: "2026-10-04", amount_paise: 1000000, raw_narration: "TFR IN" }),
    ];
    expect(markTransfers(txns)).toBe(0);
  });

  it("runHygiene reports card_bills in the summary and stays idempotent", () => {
    const ledger = [
      txn({ date: "2026-10-05", amount_paise: -4200000, raw_narration: "HDFC CARD PAYMENT" }),
      txn({ date: "2026-10-06", amount_paise: -50000, raw_narration: "UPI/BLINKIT" }),
    ];
    const first = runHygiene(ledger);
    expect(first.summary.card_bills).toBe(1);
    const second = runHygiene(first.txns);
    expect(second.summary.card_bills).toBe(first.summary.card_bills);
  });
});

// ---------------------------------------------------------------------------
// Reversed sort + missing-row gap alerts
// ---------------------------------------------------------------------------

describe("sort order and date gap alerts", () => {
  const header = "Date,Narration,Chq/Ref No,Withdrawal (Dr),Deposit (Cr),Closing Balance";

  it("newest-first file → reversed_alert, chain reconciles after reversing", () => {
    // descending file order, balances consistent chronologically
    const csv = [
      header,
      '05/10/2026,UPI/B,REF2,,100.00,"1,100.00"',
      '03/10/2026,UPI/A,REF1,200.00,,"1,000.00"',
    ].join("\n");
    const res = normalizeBankCsv(csv, getAdapter("hdfc")!, "acc");
    expect(res.rows).toHaveLength(2);
    expect(res.rejected).toHaveLength(0);
    expect(res.stats.sort_order).toBe("descending");
    expect(res.stats.reversed_alert).toBe(true);
  });

  it("a >15-day hole in the dates shows up as a missing-row warning", () => {
    const csv = [
      header,
      '01/10/2026,UPI/A,REF1,100.00,,"99,900.00"',
      '20/10/2026,UPI/B,REF2,100.00,,"99,800.00"',
    ].join("\n");
    const res = normalizeBankCsv(csv, getAdapter("hdfc")!, "acc");
    expect(res.rows).toHaveLength(2);
    expect(res.stats.date_gaps.length).toBe(1);
    expect(res.stats.date_gaps[0].days).toBe(19);
    expect(res.stats.biggest_gap_days).toBe(19);
  });

  it("clean ascending file → no alerts", () => {
    const csv = [
      header,
      '01/10/2026,UPI/A,REF1,100.00,,"99,900.00"',
      '02/10/2026,UPI/B,REF2,100.00,,"99,800.00"',
    ].join("\n");
    const res = normalizeBankCsv(csv, getAdapter("hdfc")!, "acc");
    expect(res.stats.reversed_alert).toBe(false);
    expect(res.stats.date_gaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Lexicon + display names
// ---------------------------------------------------------------------------

describe("tier-2 lexicon and verdict display", () => {
  it("BUILTIN_ALIASES has at least 120 patterns incl. SIP/EMI/salary/investments", () => {
    expect(BUILTIN_ALIASES.length).toBeGreaterThanOrEqual(120);
    const cats = new Set(BUILTIN_ALIASES.map((a) => a.category));
    expect(cats.has("investments")).toBe(true);
    const pats = BUILTIN_ALIASES.map((a) => a.pattern.toUpperCase());
    expect(pats.some((p) => p.includes("SIP"))).toBe(true);
    expect(pats.some((p) => p.includes("LOAN"))).toBe(true);
    expect(pats.some((p) => p.includes("SALARY"))).toBe(true);
    expect(pats.some((p) => p.includes("ZERODHA"))).toBe(true);
  });

  it("a SIP narration categorizes as investments", () => {
    const res = categorize({ clean_narration: "UPI/ZERODHA SIP 5000", amount_paise: -500000 });
    expect(res.category).toBe("investments");
  });

  it("verdict display names map exactly (DB keeps frozen codes)", () => {
    expect(VERDICT_DISPLAY.YES).toBe("AFFORDABLE");
    expect(VERDICT_DISPLAY.TIGHT).toBe("TIGHT");
    expect(VERDICT_DISPLAY.NO).toBe("NOT AFFORDABLE");
    expect(VERDICT_DISPLAY.REFUSED).toBe("CANNOT FORECAST");
  });

  it("merchantKey strips refs and keeps merchant tokens", () => {
    expect(merchantKey("UPI/NETFLIX 8827261 P2M")).toBe("NETFLIX");
  });
});
