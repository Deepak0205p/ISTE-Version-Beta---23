import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectAdapter, getAdapter } from "@/config/bankAdapters";
import { normalizeBankCsv } from "@/lib/csvNormalizer";
import { monthsOfData } from "@/lib/mathEngine";
import type { LedgerTxn } from "@/lib/types";

const fixtures = path.join(process.cwd(), "fixtures");

function load(name: string) {
  return fs.readFileSync(path.join(fixtures, name), "utf8");
}

function parse(name: string, account = "test-acc") {
  const csv = load(name);
  const adapter = detectAdapter(csv.split(/\r?\n/, 1)[0] ?? "");
  expect(adapter, `no adapter detected for ${name}`).toBeTruthy();
  const res = normalizeBankCsv(csv, adapter!, account);
  return { adapter: adapter!, res };
}

/**
 * Every spec fixture must survive the strict normalizer end-to-end:
 * lakh-formatted (1,25,000.00) quoted cells, balance chain intact,
 * zero rejections — these are real files, not hand-made strings.
 */
describe("fixture files parse end-to-end", () => {
  const hdfcFiles: [string, number][] = [
    ["rohan_hdfc_14mo.csv", 210],
    ["arjun_hdfc_2mo_thin.csv", 71],
    ["chai_failed_reversal.csv", 3],
    ["hdfc_salary_in.csv", 1],
    ["chai_twice.csv", 2],
    ["hdfc_aug_oct_full.csv", 210],
    ["hdfc_sep_oct_partial.csv", 40],
  ];

  for (const [name, expected] of hdfcFiles) {
    it(`${name}: ${expected} rows, no balance rejections`, () => {
      const { adapter, res } = parse(name);
      expect(adapter.id).toBe("hdfc");
      expect(res.rows).toHaveLength(expected);
      expect(res.rejected).toHaveLength(0);
      expect(res.stats.balance_reconciled).toBe(true);
      // every money value is an integer paise
      expect(res.rows.every((r) => Number.isInteger(r.amount_paise))).toBe(true);
      // dates are ISO 8601
      expect(res.rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))).toBe(true);
    });
  }

  it("meera_lumpy_8mo.csv (SBI adapter): 72 rows, no rejections", () => {
    const { adapter, res } = parse("meera_lumpy_8mo.csv");
    expect(adapter.id).toBe("sbi");
    expect(res.rows).toHaveLength(72);
    expect(res.rejected).toHaveLength(0);
    // includes the ₹45,000 anomaly credit
    expect(res.rows.some((r) => r.amount_paise === 4500000)).toBe(true);
  });

  it("sbi_transfer_out.csv (SBI adapter): 2 rows, no rejections", () => {
    const { adapter, res } = parse("sbi_transfer_out.csv");
    expect(adapter.id).toBe("sbi");
    expect(res.rows).toHaveLength(2);
    expect(res.rejected).toHaveLength(0);
    expect(res.rows[0].amount_paise).toBe(-17200000); // ₹1,72,000 debit
  });

  it("personas have the expected history spans", () => {
    const rohan = parse("rohan_hdfc_14mo.csv").res.rows as LedgerTxn[];
    expect(monthsOfData(rohan)).toBeGreaterThanOrEqual(13);

    const arjun = parse("arjun_hdfc_2mo_thin.csv").res.rows as LedgerTxn[];
    const arjunMonths = monthsOfData(arjun);
    expect(arjunMonths).toBeLessThan(3); // REFUSED persona
    expect(arjunMonths).toBeGreaterThan(1.5);
  });

  it("stress_3000.csv: 3,000 rows reconcile, parses in < 2s", () => {
    const csv = load("stress_3000.csv");
    const adapter = getAdapter("hdfc")!;
    const t0 = performance.now();
    const res = normalizeBankCsv(csv, adapter, "stress");
    const elapsed = performance.now() - t0;
    expect(res.rows).toHaveLength(3000);
    expect(res.rejected).toHaveLength(0);
    expect(elapsed).toBeLessThan(2000);
  });
});
