import { describe, expect, it } from "vitest";
import {
  normalizeBankCsv,
  parseAmountToPaise,
  parseBankDate,
  parseCsv,
} from "@/lib/csvNormalizer";
import { getAdapter } from "@/config/bankAdapters";

// ---------------------------------------------------------------------------
// test_amount_parsing
// ---------------------------------------------------------------------------

describe("test_amount_parsing", () => {
  it('“1,234.50” Dr column → 123450 paise, negative sign', () => {
    const hdfc = getAdapter("hdfc")!;
    // HDFC layout: debit in the Withdrawal column, credit in Deposit
    const csv = [
      "Date,Narration,Chq/Ref No,Withdrawal (Dr),Deposit (Cr),Closing Balance",
      `01/10/2026,POS PURCHASE,R1,"1,234.50",,98765.50`,
    ].join("\n");

    const res = normalizeBankCsv(csv, hdfc, "acc");
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].amount_paise).toBe(-123450);
    expect(Number.isInteger(res.rows[0].amount_paise)).toBe(true);
  });

  it("currency symbols and thousands commas are stripped", () => {
    expect(parseAmountToPaise("₹1,234.50")).toBe(123450);
    expect(parseAmountToPaise("1,00,000.00")).toBe(10000000);
    expect(parseAmountToPaise("45,000")).toBe(4500000);
    expect(parseAmountToPaise("$250")).toBe(25000);
  });

  it("parenthesised negatives and leading minus both go negative", () => {
    expect(parseAmountToPaise("(500.00)")).toBe(-50000);
    expect(parseAmountToPaise("-42.10")).toBe(-4210);
  });

  it("Dr/Cr suffix marks direction", () => {
    expect(parseAmountToPaise("500.00 Dr")).toBe(-50000);
    expect(parseAmountToPaise("500.00 Cr")).toBe(50000);
  });

  it("non-numeric cells return null (rejected, not guessed)", () => {
    expect(parseAmountToPaise("")).toBeNull();
    expect(parseAmountToPaise("N/A")).toBeNull();
    expect(parseAmountToPaise("abc")).toBeNull();
  });

  it("zero paise is preserved exactly (no float drift)", () => {
    expect(parseAmountToPaise("0.00")).toBe(0);
    expect(parseAmountToPaise("0.10")).toBe(10);
    expect(parseAmountToPaise("0.01")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// dates
// ---------------------------------------------------------------------------

describe("date parsing", () => {
  it("DD/MM/YYYY → ISO", () => {
    expect(parseBankDate("31/12/2026", "%d/%m/%Y")).toBe("2026-12-31");
    expect(parseBankDate("1/2/2026", "%d/%m/%Y")).toBe("2026-02-01");
  });

  it("DD-MM-YYYY → ISO", () => {
    expect(parseBankDate("05-10-2026", "%d-%m-%Y")).toBe("2026-10-05");
  });

  it("DD Mon YYYY → ISO (SBI style)", () => {
    expect(parseBankDate("1 Oct 2026", "%d %b %Y")).toBe("2026-10-01");
    expect(parseBankDate("05-Sep-2026", "%d-%b-%Y")).toBe("2026-09-05");
  });

  it("garbage → null", () => {
    expect(parseBankDate("not-a-date", "%d/%m/%Y")).toBeNull();
    expect(parseBankDate("", "%d/%m/%Y")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CSV tokenizer
// ---------------------------------------------------------------------------

describe("parseCsv", () => {
  it("handles quoted fields, embedded commas and CRLF", () => {
    const rows = parseCsv('a,"b,c","say ""hi"""\r\nd,e,f\r\n');
    expect(rows[0]).toEqual(["a", "b,c", 'say "hi"']);
    expect(rows[1]).toEqual(["d", "e", "f"]);
  });

  it("drops fully empty rows (trailing newline)", () => {
    expect(parseCsv("a,b\n\n")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// balance reconciliation — the strict validation check
// ---------------------------------------------------------------------------

describe("balance reconciliation", () => {
  const header = "Date,Narration,Chq/Ref No,Withdrawal (Dr),Deposit (Cr),Closing Balance";
  const hdfc = getAdapter("hdfc")!;

  it("accepts a perfectly reconciling file", () => {
    const csv = [
      header,
      "01/10/2026,SALARY CR,S1,,72000.00,72000.00",
      "02/10/2026,RENT OUT,R2,18000.00,,54000.00",
      "03/10/2026,CHAI,R3,20.00,,53980.00",
    ].join("\n");

    const res = normalizeBankCsv(csv, hdfc, "acc");
    expect(res.rows).toHaveLength(3);
    expect(res.rejected).toHaveLength(0);
    expect(res.stats.balance_reconciled).toBe(true);
  });

  it("rejects a row whose balance does not reconcile (and says which line)", () => {
    const csv = [
      header,
      "01/10/2026,SALARY CR,S1,,72000.00,72000.00",
      "02/10/2026,RENT OUT,R2,18000.00,,99999.00", // wrong: should be 54000
      "03/10/2026,CHAI,R3,20.00,,53980.00",
    ].join("\n");

    const res = normalizeBankCsv(csv, hdfc, "acc");
    expect(res.rows).toHaveLength(2); // bad row excluded from the ledger
    expect(res.rejected).toHaveLength(1);
    expect(res.rejected[0].rejected?.reason).toMatch(/balance mismatch at line 3/);
    expect(res.stats.balance_reconciled).toBe(false);
    expect(res.stats.rejected_balance).toBe(1);
  });

  it("first row establishes the baseline without a previous balance", () => {
    const csv = [header, "01/10/2026,OPENING,O1,,500.00,500.00"].join("\n");
    const res = normalizeBankCsv(csv, hdfc, "acc");
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].amount_paise).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// SBI-style adapter path (Dr/Cr pair + DD Mon YYYY)
// ---------------------------------------------------------------------------

describe("SBI adapter end-to-end", () => {
  it("parses a small SBI export with balance validation", () => {
    const sbi = getAdapter("sbi")!;
    const csv = [
      "Txn Date,Description,Ref No./Cheque No,Withdrawal Amt.,Deposit Amt.,Balance",
      "01 Oct 2026,IMPS SALARY CR,918273,,72000.00,72000.00",
      "02 Oct 2026,UPI-BLINKIT GGN,918274,642.50,,71357.50",
      "03 Oct 2026,UPI-RENT P2A,918275,18000.00,,53357.50",
    ].join("\n");

    const res = normalizeBankCsv(csv, sbi, "sbi-acc");
    expect(res.rows).toHaveLength(3);
    expect(res.rows[0].amount_paise).toBe(7200000);
    expect(res.rows[1].amount_paise).toBe(-64250);
    expect(res.rows[2].amount_paise).toBe(-1800000);
    expect(res.rows[0].date).toBe("2026-10-01");
    expect(res.stats.balance_reconciled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// txn hash stability (feeds dedup)
// ---------------------------------------------------------------------------

describe("transaction hash", () => {
  it("same logical row → same hash across uploads; any field change → new hash", async () => {
    const { txnHash } = await import("@/lib/ledgerHygiene");
    const a = txnHash("hdfc-x", "2026-10-01", -2000, "R1", "UPI/CHAI POINT 20");
    const b = txnHash("hdfc-x", "2026-10-01", -2000, "R1", "UPI/CHAI POINT 20");
    expect(a).toBe(b);

    expect(txnHash("other", "2026-10-01", -2000, "R1", "UPI/CHAI POINT 20")).not.toBe(a);
    expect(txnHash("hdfc-x", "2026-10-02", -2000, "R1", "UPI/CHAI POINT 20")).not.toBe(a);
    expect(txnHash("hdfc-x", "2026-10-01", -1999, "R1", "UPI/CHAI POINT 20")).not.toBe(a);
    expect(txnHash("hdfc-x", "2026-10-01", -2000, "R2", "UPI/CHAI POINT 20")).not.toBe(a);
    expect(txnHash("hdfc-x", "2026-10-01", -2000, "R1", "UPI/CHAI POINT 21")).not.toBe(a);
  });

  it("is case-insensitive on narration (banks shout)", async () => {
    const { txnHash } = await import("@/lib/ledgerHygiene");
    expect(txnHash("a", "2026-10-01", -1, null, "upi chai")).toBe(
      txnHash("a", "2026-10-01", -1, null, "UPI CHAI"),
    );
  });
});
