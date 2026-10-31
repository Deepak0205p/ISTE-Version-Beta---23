import { describe, expect, it } from "vitest";
import {
  bootstrapForecast,
  computeVerdict,
  computeBuffer,
  dailyNetFlows,
  madFlags,
  median,
  monthsOfData,
  mulberry32,
} from "@/lib/mathEngine";
import type { LedgerTxn } from "@/lib/types";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

function txn(partial: Partial<LedgerTxn> & { date: string; amount_paise: number }): LedgerTxn {
  return {
    account_id: partial.account_id ?? "hdfc-default",
    raw_narration: partial.raw_narration ?? "TEST ROW",
    clean_narration: partial.clean_narration ?? partial.raw_narration ?? "TEST ROW",
    ref: partial.ref ?? null,
    category: partial.category ?? null,
    type: partial.type ?? "normal",
    flags: partial.flags ?? {},
    txn_hash:
      partial.txn_hash ??
      `h-${partial.date}-${partial.amount_paise}-${partial.raw_narration ?? "x"}`,
    ...partial,
  };
}

/** Deterministic 120-day flow series with monthly salary rhythm. */
function sampleFlows(days = 120): number[] {
  const rand = mulberry32(7);
  return Array.from({ length: days }, (_, i) => {
    const salary = i % 30 === 0 ? 7200000 : 0; // ₹72k credit monthly
    const rent = i % 30 === 1 ? -1800000 : 0; // ₹18k rent
    const chai = i % 3 === 0 ? -2000 : 0; // ₹20 chai
    const noise = Math.round((rand() - 0.5) * 400000);
    return salary + rent + chai + noise;
  });
}

// ---------------------------------------------------------------------------
// test_bootstrap_deterministic
// ---------------------------------------------------------------------------

describe("test_bootstrap_deterministic", () => {
  it("same flows, seed 42, run twice → identical P10/P50/P90", () => {
    const flows = sampleFlows();
    const a = bootstrapForecast(flows, 3421000);
    const b = bootstrapForecast(flows, 3421000);

    expect(a).toEqual(b);
    expect(a.p10).toBe(b.p10);
    expect(a.p50).toBe(b.p50);
    expect(a.p90).toBe(b.p90);
    // frozen parameters
    expect(a.draws).toBe(500);
    expect(a.block_days).toBe(30);
    expect(a.seed).toBe(42);
    expect(a.method).toBe("moving-block bootstrap");
    // band ordering must hold: worst ≤ median ≤ best
    expect(a.p10).toBeLessThanOrEqual(a.p50);
    expect(a.p50).toBeLessThanOrEqual(a.p90);
  });

  it("different seed → (almost certainly) different band", () => {
    const flows = sampleFlows();
    const a = bootstrapForecast(flows, 3421000, { seed: 42 });
    const b = bootstrapForecast(flows, 3421000, { seed: 99 });
    expect(a.p50).not.toBe(b.p50);
  });

  it("refuses fewer than a block of history (belt and braces)", () => {
    expect(() => bootstrapForecast([1, 2, 3], 100)).toThrow(/at least 30 days/);
  });
});

// ---------------------------------------------------------------------------
// test_verdict_yes_boundary
// ---------------------------------------------------------------------------

describe("test_verdict_yes_boundary", () => {
  it("YES when P10 equals exactly price + buffer (boundary inclusive)", () => {
    const res = computeVerdict({
      band: { p10: 2000000 + 1840000, p50: 3000000 },
      price_paise: 2000000, // ₹20,000
      buffer_paise: 1840000, // ₹18,400
      months_of_data: 6,
    });
    expect(res.verdict).toBe("YES");
    expect(res.shortfall_worst_case_paise).toBeLessThanOrEqual(0);
  });

  it("one paise below the boundary is TIGHT (median still clears)", () => {
    const res = computeVerdict({
      band: { p10: 2000000 + 1840000 - 1, p50: 4340000 },
      price_paise: 2000000,
      buffer_paise: 1840000,
      months_of_data: 6,
    });
    expect(res.verdict).toBe("TIGHT");
    expect(res.shortfall_worst_case_paise).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// test_verdict_tight
// ---------------------------------------------------------------------------

describe("test_verdict_tight", () => {
  it("P50 clears, P10 short → TIGHT with shortfall = price+buffer - P10", () => {
    const res = computeVerdict({
      band: { p10: 1850000, p50: 4200000 },
      price_paise: 2000000,
      buffer_paise: 1840000,
      months_of_data: 6,
    });
    expect(res.verdict).toBe("TIGHT");
    expect(res.shortfall_worst_case_paise).toBe(2000000 + 1840000 - 1850000);
    expect(res.verdict).not.toBe("NO");
  });

  it("P50 also short → NO", () => {
    const res = computeVerdict({
      band: { p10: 1000000, p50: 1500000 },
      price_paise: 2000000,
      buffer_paise: 1840000,
      months_of_data: 6,
    });
    expect(res.verdict).toBe("NO");
    expect(res.shortfall_median_paise).toBe(2000000 + 1840000 - 1500000);
  });
});

// ---------------------------------------------------------------------------
// test_verdict_refused_thin
// ---------------------------------------------------------------------------

describe("test_verdict_refused_thin", () => {
  it("2.2 months of data → REFUSED with the exact reason string", () => {
    const res = computeVerdict({
      band: { p10: 5000000, p50: 6000000 },
      price_paise: 2000000,
      buffer_paise: 1840000,
      months_of_data: 2.2,
    });
    expect(res.verdict).toBe("REFUSED");
    expect(res.reason).toBe(
      "Only 2.2 months of history - a forecast would be a guess. Add one more month or upload an older statement.",
    );
  });

  it("exactly 3 months is NOT refused (boundary)", () => {
    const res = computeVerdict({
      band: { p10: 5000000, p50: 6000000 },
      price_paise: 2000000,
      buffer_paise: 1840000,
      months_of_data: 3,
    });
    expect(res.verdict).toBe("YES");
  });

  it("monthsOfData computes a realistic span", () => {
    const jan1 = txn({ date: "2026-01-01", amount_paise: 100000 });
    const mar15 = txn({ date: "2026-03-15", amount_paise: 100000 });
    expect(monthsOfData([jan1, mar15])).toBeCloseTo(2.5, 0);
  });
});

// ---------------------------------------------------------------------------
// test_buffer_composition
// ---------------------------------------------------------------------------

describe("test_buffer_composition", () => {
  it("buffer = max(MAB, 15-day burn, volatility cushion) with all parts itemized", () => {
    // 3 months of data, identical structure:
    //   essentials: ₹100 rent every day (housing)
    //   variable: month1 ₹5,000 · month2 ₹7,000 · month3 ₹9,000
    const txns: LedgerTxn[] = [];
    const months = [
      ["2026-07", "2026-07-31", 500000],
      ["2026-08", "2026-08-31", 700000],
      ["2026-09", "2026-09-30", 900000],
    ] as const;

    for (const [m, lastDay, variablePaise] of months) {
      // one daily essential ₹100 for every day of the month
      const days = Number(lastDay.slice(-2));
      for (let d = 1; d <= days; d++) {
        txns.push(
          txn({
            date: `${m}-${String(d).padStart(2, "0")}`,
            amount_paise: -10000,
            category: "housing",
            raw_narration: "RENT",
          }),
        );
      }
      // variable spend: split into 10 chunks across the month
      for (let k = 0; k < 10; k++) {
        txns.push(
          txn({
            date: `${m}-${String(Math.min(days, k + 1)).padStart(2, "0")}`,
            amount_paise: -Math.floor(variablePaise / 10),
            category: "dining",
            raw_narration: "ZOMATO ORDER",
          }),
        );
      }
    }

    const buffer = computeBuffer(txns);

    const monthly = [500000, 700000, 900000];
    const medianMonthly = median(monthly); // 700000
    const worst = 900000;
    const expectedOvershoot = worst - medianMonthly; // 200000
    const expectedEssentials = 10000 * 7; // 70000

    // frozen volatility-cushion formula is intact as branch C
    expect(buffer.worst_month_overshoot_paise).toBe(expectedOvershoot);
    expect(buffer.one_week_essentials_paise).toBe(expectedEssentials);
    expect(buffer.volatility_cushion_paise).toBe(expectedOvershoot + expectedEssentials);
    expect(buffer.volatility_cushion_paise).toBe(270000);
    expect(buffer.fifteen_day_burn_paise).toBe(10000 * 15); // 150000
    expect(buffer.mab_headroom_paise).toBe(1000000); // default MAB ₹10,000

    // with the default MAB, the MAB branch dominates the max()
    expect(buffer.buffer_paise).toBe(1000000);
    expect(buffer.dominant_branch).toBe("mab");
    expect(buffer.worst_month).toBe("2026-09");
  });

  it("MAB = 0 → volatility cushion wins the max()", () => {
    const txns = [
      txn({ date: "2026-08-01", amount_paise: -500000, category: "dining", raw_narration: "ZOMATO" }),
      txn({ date: "2026-09-01", amount_paise: -700000, category: "dining", raw_narration: "ZOMATO" }),
      txn({ date: "2026-10-01", amount_paise: -900000, category: "dining", raw_narration: "ZOMATO" }),
    ];
    const buffer = computeBuffer(txns, 7, 0);
    expect(buffer.dominant_branch).toBe("volatility");
    expect(buffer.buffer_paise).toBe(buffer.volatility_cushion_paise);
  });

  it("15-day burn wins when volatility is flat and MAB is 0", () => {
    // identical ₹200 essentials daily for 3 months, no variable spend at all
    const txns: LedgerTxn[] = [];
    for (const [m, days] of [["2026-08", 31], ["2026-09", 30], ["2026-10", 31]] as const) {
      for (let d = 1; d <= days; d++) {
        txns.push(
          txn({
            date: `${m}-${String(d).padStart(2, "0")}`,
            amount_paise: -20000,
            category: "groceries",
            raw_narration: "BLINKIT",
          }),
        );
      }
    }
    const buffer = computeBuffer(txns, 7, 0);
    expect(buffer.dominant_branch).toBe("fifteen_day_burn");
    expect(buffer.buffer_paise).toBe(20000 * 15); // ₹3,000
  });

  it("single month of history → overshoot term is honestly 0", () => {
    const txns = [txn({ date: "2026-10-01", amount_paise: -500000, category: "dining" })];
    const buffer = computeBuffer(txns);
    expect(buffer.worst_month_overshoot_paise).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// test_mad_zero_guard
// ---------------------------------------------------------------------------

describe("test_mad_zero_guard", () => {
  it("8 identical values → no crash, no flags, 'uniform history'", () => {
    const res = madFlags([500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000]);
    expect(res.mad).toBe(0);
    expect(res.flags).toHaveLength(0);
    expect(res.note).toBe("uniform history");
  });

  it("flags a ₹45,000 credit among normal values (|Mi| > 3.5)", () => {
    const values = [4000000, 4200000, 4100000, 45000000, 4300000, 4400000, 3900000, 4150000, 4050000, 4250000];
    const res = madFlags(values);
    expect(res.flags.map((f) => f.index)).toContain(3);
    expect(res.note).toBe("ok");
  });

  it("n < 10 → at most 1 flag, labeled possible", () => {
    const values = [100, 110, 105, 115, 108, 112, 107, 5000];
    const res = madFlags(values);
    expect(res.flags.length).toBeLessThanOrEqual(1);
    if (res.flags.length === 1) expect(res.flags[0].possible).toBe(true);
    expect(res.note).toBe("small sample");
  });
});

// ---------------------------------------------------------------------------
// daily flows sanity (feeds everything downstream)
// ---------------------------------------------------------------------------

describe("dailyNetFlows", () => {
  it("credits minus debits per day, zero-days included, transfers excluded", () => {
    const txns = [
      txn({ date: "2026-10-01", amount_paise: 7200000, category: "income" }),
      txn({ date: "2026-10-01", amount_paise: -1800000, category: "housing" }),
      txn({ date: "2026-10-03", amount_paise: -2000, category: "dining" }),
      txn({
        date: "2026-10-02",
        amount_paise: -2000000,
        type: "transfer",
        category: "transfer",
      }),
    ];
    const flows = dailyNetFlows(txns, "2026-10-01", "2026-10-03");
    expect(flows).toHaveLength(3);
    expect(flows[0].net_paise).toBe(7200000 - 1800000); // day 1
    expect(flows[1].net_paise).toBe(0); // transfer excluded → 0
    expect(flows[2].net_paise).toBe(-2000);
  });
});
