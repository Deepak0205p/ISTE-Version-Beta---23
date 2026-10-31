import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 1 DB smoke tests — the connection opens a single local file and
 * creates exactly the four tables the Build Bible §11 specifies.
 * Uses a throwaway path so the real ledger.db is never touched.
 */
const TMP_DB = process.env.LEDGER_DB_PATH_TEST ??
  `data/test-ledger-${process.pid}.db`;

// Re-stub before EVERY test: a module-scope stub would be undone by
// unstubAllEnvs() in afterEach, letting later tests open the REAL ledger.db
// (and its DELETE FROM transactions would wipe live demo data).
beforeEach(() => {
  vi.stubEnv("LEDGER_DB_PATH", TMP_DB);
});

type DbLike = {
  close(): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
};

let openDb: DbLike | null = null;

async function freshDb(): Promise<DbLike> {
  vi.resetModules();
  const mod = await import("@/lib/db");
  openDb = mod.getDb() as unknown as DbLike;
  return openDb;
}

afterEach(async () => {
  // Close first — Windows locks the file (and its -wal/-shm) while open.
  const g = globalThis as { __ledgerDb?: { close(): void } };
  openDb?.close();
  openDb = null;
  g.__ledgerDb = undefined;
  vi.resetModules();

  const fs = await import("node:fs");
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = TMP_DB + suffix;
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
  vi.unstubAllEnvs();
});

describe("sqlite connection", () => {
  it("creates exactly four tables: accounts, transactions, category_aliases, verdicts", async () => {
    const db = await freshDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => (r as { name: string }).name);

    expect(tables).toEqual([
      "accounts",
      "category_aliases",
      "transactions",
      "verdicts",
    ]);
  });

  it("rejects an invalid verdict state (CHECK constraint)", async () => {
    const db = await freshDb();
    expect(() =>
      db
        .prepare("INSERT INTO verdicts (question_json, receipt_json, verdict) VALUES (?, ?, ?)")
        .run("{}", "{}", "MAYBE"),
    ).toThrow(/CHECK constraint/i);
  });

  it("stores amounts as integer paise with a unique txn_hash", async () => {
    const db = await freshDb();
    // Idempotent: a crashed earlier run may have left rows behind.
    db.prepare("DELETE FROM transactions").run();
    db.prepare("DELETE FROM accounts").run();
    db.prepare(
      "INSERT INTO accounts (id, bank, label, last4) VALUES (?, ?, ?, ?)",
    ).run("acc-1", "hdfc", "HDFC salary", "1234");

    const insert = db.prepare(
      `INSERT INTO transactions
       (account_id, date, amount_paise, raw_narration, clean_narration, ref, txn_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // "1,234.50" Dr → -123450 paise (integer, no float drift)
    insert.run("acc-1", "2026-10-01", -123450, "UPI/CHAI POINT 20", "UPI/CHAI POINT 20", "R1", "h1");

    expect(() =>
      insert.run("acc-1", "2026-10-01", -123450, "UPI/CHAI POINT 20", "UPI/CHAI POINT 20", "R1", "h1"),
    ).toThrow(/UNIQUE/i);

    const row = db
      .prepare("SELECT amount_paise FROM transactions WHERE txn_hash = ?")
      .get("h1") as { amount_paise: number };
    expect(Number.isInteger(row.amount_paise)).toBe(true);
    expect(row.amount_paise).toBe(-123450);
  });
});
