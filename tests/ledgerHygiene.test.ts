import { describe, expect, it } from "vitest";
import {
  applyDedup,
  classifyDuplicates,
  markNettedPairs,
  markTransfers,
  nearIdenticalNarration,
  runHygiene,
  txnHash,
  totals,
} from "@/lib/ledgerHygiene";
import type { LedgerTxn } from "@/lib/types";

function txn(
  partial: Partial<LedgerTxn> & { date: string; amount_paise: number; narration?: string },
): LedgerTxn {
  const narration = partial.narration ?? partial.raw_narration ?? "ROW";
  const account = partial.account_id ?? "hdfc-a";
  const clean = (partial.clean_narration ?? narration).replace(/\s+/g, " ").trim();
  return {
    account_id: account,
    raw_narration: narration,
    clean_narration: clean,
    ref: partial.ref ?? null,
    category: partial.category ?? null,
    type: partial.type ?? "normal",
    flags: partial.flags ?? {},
    txn_hash: partial.txn_hash ?? txnHash(account, partial.date, partial.amount_paise, partial.ref ?? null, clean),
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// test_dup_p_never_autodeleted
// ---------------------------------------------------------------------------

describe("test_dup_p_never_autodeleted", () => {
  /**
   * Overlapping exports: the SAME account, the same ₹20 chai, uploaded in
   * two files that partially overlap.
   *
   *  - identical rows (same hash) → M-class → merged (count = 1 row kept)
   *  - near-identical but not identical (different day/ref) → P-class →
   *    BOTH rows kept, flag raised, NOTHING deleted
   */
  it("overlapping exports: both P-class rows kept, flag raised, no deletion", () => {
    const ledger: LedgerTxn[] = [
      txn({ date: "2026-10-08", amount_paise: -2000, narration: "UPI/CHAI POINT 20", ref: "R1" }),
      txn({ date: "2026-10-09", amount_paise: -2000, narration: "UPI/CHAI POINT 20", ref: "R2" }),
    ];

    const before = ledger.length;
    const result = applyDedup(ledger);

    // count unchanged — nothing deleted
    expect(result.txns).toHaveLength(before);
    expect(result.merged).toBe(0);

    // flag raised on BOTH rows
    expect(result.flaggedPairs).toBe(1);
    expect(result.txns.every((t) => t.flags.dup_p)).toBe(true);
  });

  it("identical rows (same txn_hash) are M-class: merged to one, logged", () => {
    const base = {
      date: "2026-10-08",
      amount_paise: -2000,
      narration: "UPI/CHAI POINT 20",
      ref: "R1",
    };
    const a = txn(base);
    const b = txn(base);
    expect(a.txn_hash).toBe(b.txn_hash);

    const result = applyDedup([a, b]);
    expect(result.txns).toHaveLength(1);
    expect(result.merged).toBe(1);
    expect(result.mergeLog).toHaveLength(1);
    expect(result.mergeLog[0].removed).toBe(1);
  });

  it("same amount on different days with different merchants → U-class (untouched)", () => {
    const ledger: LedgerTxn[] = [
      txn({ date: "2026-10-08", amount_paise: -20000, narration: "UBER RIDE 1", ref: "X" }),
      txn({ date: "2026-10-08", amount_paise: -20000, narration: "SWIGGY ORDER 44", ref: "Y" }),
    ];
    const actions = classifyDuplicates(ledger);
    expect(actions.filter((a) => a.kind === "P")).toHaveLength(0);

    const result = applyDedup(ledger);
    expect(result.txns).toHaveLength(2);
    expect(result.flaggedPairs).toBe(0);
  });

  it("different accounts never P-match (dedup is account-scoped)", () => {
    const ledger: LedgerTxn[] = [
      txn({ account_id: "hdfc-a", date: "2026-10-08", amount_paise: -2000, narration: "UPI/CHAI POINT 20" }),
      txn({ account_id: "sbi-b", date: "2026-10-09", amount_paise: -2000, narration: "UPI/CHAI POINT 20" }),
    ];
    const p = classifyDuplicates(ledger).filter((a) => a.kind === "P");
    expect(p).toHaveLength(0);
  });

  it("near-identical narration ignores embedded reference numbers", () => {
    expect(
      nearIdenticalNarration("UPI/CHAI POINT 20 918273451", "UPI/CHAI POINT 20 556677881"),
    ).toBe(true);
    expect(nearIdenticalNarration("ZOMATO ORDER 8823", "AMAZON PAY")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// test_transfer_pair_excluded
// ---------------------------------------------------------------------------

describe("test_transfer_pair_excluded", () => {
  it("A out 10,000 paise + B in 10,000 paise next day → type=transfer, excluded from spend", () => {
    const ledger: LedgerTxn[] = [
      txn({
        account_id: "hdfc-a",
        date: "2026-10-05",
        amount_paise: -10000, // 10,000 paise = ₹100 out
        narration: "IMPS MOVE TO SBI",
      }),
      txn({
        account_id: "sbi-b",
        date: "2026-10-06",
        amount_paise: 10000, // 10,000 paise in
        narration: "IMPS MOVE FROM HDFC",
      }),
      // a REAL spend in the same window — must be unaffected
      txn({
        account_id: "hdfc-a",
        date: "2026-10-06",
        amount_paise: -500000,
        narration: "RENT PAYMENT",
        category: "housing",
      }),
    ];

    const pairs = markTransfers(ledger);
    expect(pairs).toBe(1);

    expect(ledger[0].type).toBe("transfer");
    expect(ledger[1].type).toBe("transfer");
    expect(ledger[0].flags.transfer).toBe(true);
    expect(ledger[1].flags.transfer).toBe(true);

    // income and spend unchanged: the pair contributes nothing
    const t = totals(ledger);
    expect(t.income_paise).toBe(0); // the inflow is NOT income
    expect(t.spend_paise).toBe(500000); // only the real rent counts
    expect(t.excluded_transfers).toBe(2); // both rows counted as excluded
  });

  it("same account A→A is NOT treated as an inter-account transfer", () => {
    const ledger: LedgerTxn[] = [
      txn({ account_id: "hdfc-a", date: "2026-10-05", amount_paise: -10000, narration: "SELF TFR" }),
      txn({ account_id: "hdfc-a", date: "2026-10-06", amount_paise: 10000, narration: "SELF TFR IN" }),
    ];
    expect(markTransfers(ledger)).toBe(0);
  });

  it("amount mismatch beyond ₹1 tolerance is not a transfer", () => {
    const ledger: LedgerTxn[] = [
      txn({ account_id: "hdfc-a", date: "2026-10-05", amount_paise: -10000, narration: "OUT" }),
      txn({ account_id: "sbi-b", date: "2026-10-06", amount_paise: 10500, narration: "IN" }),
    ];
    expect(markTransfers(ledger)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// test_failed_upi_netted
// ---------------------------------------------------------------------------

describe("test_failed_upi_netted", () => {
  it("fail row + reversal row → net zero, excluded from spend", () => {
    const ledger: LedgerTxn[] = [
      txn({
        date: "2026-10-06",
        amount_paise: -2000,
        narration: "UPI/CHAI POINT FAILED TXN",
      }),
      txn({
        date: "2026-10-06",
        amount_paise: 2000,
        narration: "RVRSL/CHAI POINT FAILED TXN",
      }),
      // a genuine chai later — must still count
      txn({ date: "2026-10-07", amount_paise: -2000, narration: "UPI/CHAI POINT 20" }),
    ];

    const pairs = markNettedPairs(ledger);
    expect(pairs).toBe(1);
    expect(ledger[0].type).toBe("netted");
    expect(ledger[1].type).toBe("netted");
    expect(ledger[0].flags.netted).toBe(true);
    expect(ledger[1].flags.netted).toBe(true);

    // pair contributes 0; only the real chai counts
    const t = totals(ledger);
    expect(t.spend_paise).toBe(2000);
    expect(t.netted_failed_upi).toBe(2); // both rows visibly netted
  });

  it("a reversal beyond 7 days is NOT netted", () => {
    const ledger: LedgerTxn[] = [
      txn({ date: "2026-10-01", amount_paise: -2000, narration: "UPI/FAILED TXN" }),
      txn({ date: "2026-10-20", amount_paise: 2000, narration: "RVRSL TXN" }),
    ];
    expect(markNettedPairs(ledger)).toBe(0);
    expect(totals(ledger).spend_paise).toBe(2000);
  });

  it("the everyday case: naive tools say ₹40, we say ₹20", () => {
    const ledger: LedgerTxn[] = [
      txn({ date: "2026-10-06", amount_paise: -2000, narration: "UPI/CHAI POINT FAILED" }),
      txn({ date: "2026-10-06", amount_paise: 2000, narration: "RVRSL/CHAI POINT" }),
      txn({ date: "2026-10-06", amount_paise: -2000, narration: "UPI/CHAI POINT RETRY" }),
    ];
    markNettedPairs(ledger);
    const t = totals(ledger);
    expect(t.spend_paise).toBe(2000); // ₹20, not ₹40
  });
});

// ---------------------------------------------------------------------------
// full pipeline coherence
// ---------------------------------------------------------------------------

describe("runHygiene pipeline", () => {
  it("dedup + transfers + netting in one deterministic pass", () => {
    const ledger: LedgerTxn[] = [
      txn({ account_id: "hdfc-a", date: "2026-10-05", amount_paise: -1000000, narration: "SALARY MOVE OUT" }),
      txn({ account_id: "sbi-b", date: "2026-10-06", amount_paise: 1000000, narration: "SALARY MOVE IN" }),
      txn({ date: "2026-10-06", amount_paise: -2000, narration: "UPI/FAILED CHAI", ref: "F1" }),
      txn({ date: "2026-10-06", amount_paise: 2000, narration: "RVRSL/CHAI", ref: "F1" }),
      txn({ date: "2026-10-07", amount_paise: -64250, narration: "BLINKIT GGN", category: "groceries" }),
    ];

    const result = runHygiene(ledger);
    expect(result.summary.transfers).toBe(1);
    expect(result.summary.netted_failed_upi).toBe(1);
    expect(result.summary.transactions).toBe(5); // nothing deleted

    const t = totals(result.txns);
    expect(t.income_paise).toBe(0);
    expect(t.spend_paise).toBe(64250);
  });

  it("is idempotent: re-running hygiene on its own output keeps pair counts (receipt rebuild)", () => {
    const ledger: LedgerTxn[] = [
      txn({ account_id: "hdfc-a", date: "2026-10-05", amount_paise: -1000000, narration: "SALARY MOVE OUT" }),
      txn({ account_id: "sbi-b", date: "2026-10-06", amount_paise: 1000000, narration: "SALARY MOVE IN" }),
      txn({ date: "2026-10-06", amount_paise: -2000, narration: "UPI/FAILED CHAI", ref: "F1" }),
      txn({ date: "2026-10-06", amount_paise: 2000, narration: "RVRSL/CHAI", ref: "F1" }),
    ];

    const first = runHygiene(ledger);
    const second = runHygiene(first.txns); // rows now carry type=transfer/netted

    expect(second.summary.transfers).toBe(first.summary.transfers);
    expect(second.summary.netted_failed_upi).toBe(first.summary.netted_failed_upi);
    expect(second.summary.transfers).toBe(1);
    expect(second.summary.netted_failed_upi).toBe(1);
    expect(second.summary.transactions).toBe(first.summary.transactions);
  });
});
