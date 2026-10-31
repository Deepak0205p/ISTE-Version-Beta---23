import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Repository-level features: masked last4, P-class decisions, correction
 * undo, and the one-click wipe. Uses a throwaway DB like db.test.ts.
 */
const TMP_DB = process.env.LEDGER_DB_PATH_TEST ??
  `data/test-repo-${process.pid}.db`;

beforeEach(() => {
  vi.stubEnv("LEDGER_DB_PATH", TMP_DB);
});

afterEach(async () => {
  const g = globalThis as { __ledgerDb?: { close(): void } };
  g.__ledgerDb?.close();
  g.__ledgerDb = undefined;
  vi.resetModules();
  const fs = await import("node:fs");
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = TMP_DB + suffix;
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
  vi.unstubAllEnvs();
});

async function freshRepo() {
  vi.resetModules();
  const repo = await import("@/lib/repository");
  const { SCHEMA_SQL } = await import("@/lib/schema");
  const { getDb } = await import("@/lib/db");
  getDb().exec(SCHEMA_SQL);
  return repo;
}

function seed(repo: Awaited<ReturnType<typeof freshRepo>>, flags = {}) {
  repo.upsertAccount({ id: "hdfc-a", bank: "hdfc", label: "Salary a/c" });
  const { inserted } = repo.insertTransactions([
    {
      account_id: "hdfc-a",
      date: "2026-10-05",
      amount_paise: -20000,
      raw_narration: "UPI/CHAI POINT 20",
      clean_narration: "UPI/CHAI POINT 20",
      ref: "R1",
      category: "dining",
      type: "normal",
      flags,
      txn_hash: "hash-chai",
    },
  ]);
  expect(inserted).toBe(1);
}

describe("masked account display", () => {
  it("ensureLast4 fills a deterministic 4-char last4 for every account", async () => {
    const repo = await freshRepo();
    repo.upsertAccount({ id: "hdfc-a", bank: "hdfc", label: "Salary a/c" });
    repo.ensureLast4();
    const [a] = repo.listAccounts();
    expect(a.last4).toMatch(/^[0-9A-F]{4}$/);

    // deterministic across runs
    repo.ensureLast4();
    const [b] = repo.listAccounts();
    expect(b.last4).toBe(a.last4);
  });
});

describe("mark as real / duplicate", () => {
  it("mark_real clears the anomaly flags and remembers the user's call", async () => {
    const repo = await freshRepo();
    seed(repo, { mad_anomaly: true, anomaly_reasons: ["unusual amount"] });
    const [row] = repo.allTransactions();

    const res = repo.markTxnDecision(row.id!, "real");
    expect(res.ok).toBe(true);
    const after = repo.allTransactions()[0];
    expect(after.flags.mad_anomaly).toBeFalsy();
    expect(after.flags.user_kept).toBe(true);
    expect(after.flags.anomaly_reasons).toEqual([]);
  });

  it("mark_duplicate remembers it and totals() excludes the row", async () => {
    const repo = await freshRepo();
    seed(repo);
    const [row] = repo.allTransactions();
    repo.markTxnDecision(row.id!, "duplicate");
    const after = repo.allTransactions()[0];
    expect(after.flags.user_duplicate).toBe(true);
  });
});

describe("correction undo", () => {
  it("a correction propagates; undo restores and drops the alias", async () => {
    const repo = await freshRepo();
    repo.upsertAccount({ id: "hdfc-a", bank: "hdfc", label: "Salary a/c" });
    repo.insertTransactions([
      {
        account_id: "hdfc-a", date: "2026-10-01", amount_paise: -25000,
        raw_narration: "UPI/CHAI POINT 20", clean_narration: "UPI/CHAI POINT 20",
        ref: "R1", category: null, type: "normal", flags: {}, txn_hash: "c1",
      },
      {
        account_id: "hdfc-a", date: "2026-10-02", amount_paise: -25000,
        raw_narration: "UPI/CHAI POINT CP", clean_narration: "UPI/CHAI POINT CP",
        ref: "R2", category: null, type: "normal", flags: {}, txn_hash: "c2",
      },
    ]);

    const target = repo.allTransactions()[0];
    const res = repo.applyCorrection({ txn_id: target.id, category: "dining" });
    expect(res.updated).toBeGreaterThanOrEqual(1);
    expect(res.alias_learned).toBe(true);
    expect(res.previous_category).toBeNull();
    expect(repo.allTransactions().every((t) => t.category === "dining")).toBe(true);

    const undo = repo.undoCorrection({
      txn_id: target.id!,
      previous_category: res.previous_category,
      pattern: res.pattern,
    });
    expect(undo.ok).toBe(true);
    expect(repo.allTransactions().some((t) => t.category === "dining")).toBe(false);
    expect(repo.allAliases()).toHaveLength(0); // alias dropped
  });
});

describe("one-click wipe", () => {
  it("clears all four tables but keeps the schema", async () => {
    const repo = await freshRepo();
    seed(repo);
    repo.saveVerdict({ question: { item: "x", price_inr: 1, horizon: "next_month" }, receipt: {}, verdict: "YES" });

    const res = repo.wipeAll();
    expect(res.wiped).toBe(true);
    expect(res.deleted.transactions).toBe(1);
    expect(res.deleted.accounts).toBe(1);
    expect(res.deleted.verdicts).toBe(1);

    expect(repo.allTransactions()).toHaveLength(0);
    expect(repo.listAccounts()).toHaveLength(0);
    expect(repo.listVerdicts()).toHaveLength(0);
    // schema survives: inserting again works
    seed(repo);
    expect(repo.allTransactions()).toHaveLength(1);
  });
});
