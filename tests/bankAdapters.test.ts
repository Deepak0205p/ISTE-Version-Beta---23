import { describe, expect, it } from "vitest";
import { bankAdapters, detectAdapter, getAdapter } from "@/config/bankAdapters";

describe("bank adapters (Phase 1 config)", () => {
  it("ships HDFC-style and SBI-style adapters", () => {
    expect(bankAdapters.map((a) => a.id).sort()).toEqual(["hdfc", "sbi"]);
  });

  it("every adapter satisfies the strict contract fields", () => {
    for (const a of bankAdapters) {
      expect(a.date_col.length).toBeGreaterThan(0);
      expect(a.narration_col.length).toBeGreaterThan(0);
      expect(a.ref_col.length).toBeGreaterThan(0);
      expect(a.balance_col.length).toBeGreaterThan(0);
      expect(a.date_format).toBeTruthy();
      expect(["signed", "dr_cr_pair", "single_with_flag"]).toContain(a.amount_mode);
    }
  });

  it("HDFC adapter matches the Build Bible §6 example row", () => {
    const hdfc = getAdapter("hdfc");
    expect(hdfc).toBeDefined();
    expect(hdfc!.date_col).toBe("Date");
    expect(hdfc!.narration_col).toBe("Narration");
    expect(hdfc!.ref_col).toBe("Chq/Ref No");
    expect(hdfc!.balance_col).toBe("Closing Balance");
    expect(hdfc!.date_format).toBe("%d/%m/%Y");
    expect(hdfc!.amount_mode).toBe("dr_cr_pair");
  });

  it("SBI adapter matches the Build Bible §6 example row", () => {
    const sbi = getAdapter("sbi");
    expect(sbi).toBeDefined();
    expect(sbi!.date_col).toBe("Txn Date");
    expect(sbi!.narration_col).toBe("Description");
    expect(sbi!.ref_col).toBe("Ref No./Cheque No");
    expect(sbi!.balance_col).toBe("Balance");
    expect(sbi!.date_format).toBe("%d %b %Y");
  });

  it("auto-detects a bank from its header line", () => {
    const hdfcHeader =
      "Date,Narration,Chq/Ref No,Withdrawal (Dr),Deposit (Cr),Closing Balance";
    expect(detectAdapter(hdfcHeader)?.id).toBe("hdfc");

    const sbiHeader =
      "Txn Date,Description,Ref No./Cheque No,Withdrawal Amt.,Deposit Amt.,Balance";
    expect(detectAdapter(sbiHeader)?.id).toBe("sbi");

    expect(detectAdapter("foo,bar,baz")).toBeUndefined();
  });
});
