/**
 * Repository layer — the only module that talks to the SQLite file.
 * Route handlers call this; pure functions never do.
 */
import { getDb } from "@/lib/db";
import { categorize, type UserAlias } from "@/lib/categorizer";
import { fnv1aHex } from "@/lib/ledgerHygiene";
import { getAdapter } from "@/config/bankAdapters";
import type { LedgerTxn, TxnFlags, Verdict } from "@/lib/types";

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type AccountRow = {
  id: string;
  bank: string;
  label: string;
  last4: string | null;
};

export function upsertAccount(input: {
  id: string;
  bank: string;
  label: string;
  last4?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO accounts (id, bank, label, last4) VALUES (@id, @bank, @label, @last4)
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, last4 = excluded.last4`,
    )
    .run({ id: input.id, bank: input.bank, label: input.label, last4: input.last4 ?? null });
}

export function listAccounts(): AccountRow[] {
  return getDb()
    .prepare("SELECT id, bank, label, last4 FROM accounts ORDER BY rowid")
    .all() as AccountRow[];
}

/**
 * Every account gets a masked display id (•••• 4821) derived deterministically
 * from its id — we never store or show a real account number.
 */
export function ensureLast4(): void {
  const db = getDb();
  const rows = db.prepare("SELECT id, last4 FROM accounts").all() as {
    id: string;
    last4: string | null;
  }[];
  const upd = db.prepare("UPDATE accounts SET last4 = ? WHERE id = ?");
  for (const r of rows) {
    if (!r.last4) upd.run(fnv1aHex(r.id).slice(-4).toUpperCase(), r.id);
  }
}

/** One-click data wipe: every table, keeping the schema. Demo hygiene. */
export function wipeAll(): { wiped: true; deleted: Record<string, number> } {
  const db = getDb();
  const deleted: Record<string, number> = {};
  const run = db.transaction(() => {
    for (const table of ["transactions", "accounts", "verdicts", "category_aliases"]) {
      const info = db.prepare(`DELETE FROM ${table}`).run();
      deleted[table] = info.changes;
    }
    try {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'transactions'").run();
    } catch {
      /* sqlite_sequence absent on a fresh file — autoincrement starts over anyway */
    }
  });
  run();
  return { wiped: true, deleted };
}

/**
 * "Mark as Real" / "Mark as Duplicate" — the user's P-class and anomaly
 * decisions are remembered in flags and honored by totals().
 */
export function markTxnDecision(
  txn_id: number,
  decision: "real" | "duplicate",
): { ok: boolean; message: string } {
  const db = getDb();
  const row = db
    .prepare("SELECT id, flags FROM transactions WHERE id = ?")
    .get(txn_id) as { id: number; flags: string } | undefined;
  if (!row) return { ok: false, message: `Transaction ${txn_id} not found.` };

  let flags: TxnFlags = {};
  try {
    flags = JSON.parse(row.flags) as TxnFlags;
  } catch {
    flags = {};
  }

  if (decision === "real") {
    // user vouches for it: anomaly cleared, row counted as real spend/income
    flags = {
      ...flags,
      user_kept: true,
      user_duplicate: false,
      dup_p: false,
      mad_anomaly: false,
      anomaly_possible: false,
      anomaly_reasons: [],
    };
  } else {
    flags = { ...flags, user_duplicate: true, user_kept: false };
  }

  updateTxnFlags(txn_id, flags);
  return {
    ok: true,
    message:
      decision === "real"
        ? "Marked as a real transaction — anomaly cleared, amount counted."
        : "Marked as a duplicate — row stays visible but is excluded from totals.",
  };
}

export function resolveAccountId(label: string, bank: string): string {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM accounts WHERE label = ? COLLATE NOCASE")
    .get(label) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = `${bank}-${label}`.replace(/\s+/g, "_").slice(0, 60);
  upsertAccount({ id, bank, label });
  return id;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

type TxnRow = {
  id: number;
  account_id: string;
  date: string;
  amount_paise: number;
  raw_narration: string;
  clean_narration: string;
  ref: string | null;
  category: string | null;
  type: LedgerTxn["type"];
  flags: string;
  txn_hash: string;
};

function rowToTxn(r: TxnRow): LedgerTxn {
  let flags: TxnFlags = {};
  try {
    flags = JSON.parse(r.flags) as TxnFlags;
  } catch {
    flags = {};
  }
  return { ...r, flags };
}

/**
 * Insert normalized rows. M-class duplicates (identical txn_hash) are
 * skipped at the DB boundary — same CSV uploaded twice must not double the
 * ledger. P-class rows insert normally; the hygiene layer flags them.
 */
export function insertTransactions(txns: LedgerTxn[]): {
  inserted: number;
  skippedIdentical: number;
} {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO transactions
       (account_id, date, amount_paise, raw_narration, clean_narration, ref, category, type, flags, txn_hash)
     VALUES (@account_id, @date, @amount_paise, @raw_narration, @clean_narration, @ref, @category, @type, @flags, @txn_hash)`,
  );

  let inserted = 0;
  let skipped = 0;
  const run = db.transaction((rows: LedgerTxn[]) => {
    for (const t of rows) {
      const info = insert.run({
        account_id: t.account_id,
        date: t.date,
        amount_paise: t.amount_paise,
        raw_narration: t.raw_narration,
        clean_narration: t.clean_narration,
        ref: t.ref,
        category: t.category,
        type: t.type,
        flags: JSON.stringify(t.flags),
        txn_hash: t.txn_hash,
      });
      if (info.changes > 0) inserted++;
      else skipped++;
    }
  });
  run(txns);

  return { inserted, skippedIdentical: skipped };
}

export function allTransactions(): LedgerTxn[] {
  const rows = getDb()
    .prepare("SELECT * FROM transactions ORDER BY date ASC, id ASC")
    .all() as TxnRow[];
  return rows.map(rowToTxn);
}

export function updateTxnFlags(id: number, flags: TxnFlags): void {
  getDb().prepare("UPDATE transactions SET flags = ? WHERE id = ?").run(JSON.stringify(flags), id);
}

export function updateTxnCategory(id: number, category: string): void {
  getDb().prepare("UPDATE transactions SET category = ? WHERE id = ?").run(category, id);
}

export function updateTxnType(id: number, type: LedgerTxn["type"]): void {
  getDb().prepare("UPDATE transactions SET type = ? WHERE id = ?").run(type, id);
}

/** Persist hygiene outcomes (flags + type) computed by pure functions. */
export function persistHygiene(txns: LedgerTxn[]): void {
  const db = getDb();
  const upd = db.prepare(
    "UPDATE transactions SET flags = ?, type = ?, category = ? WHERE txn_hash = ?",
  );
  const run = db.transaction((rows: LedgerTxn[]) => {
    for (const t of rows) {
      if (!t.id && !t.txn_hash) continue;
      upd.run(JSON.stringify(t.flags), t.type, t.category, t.txn_hash);
    }
  });
  run(txns);
}

// ---------------------------------------------------------------------------
// Category aliases (the correction loop)
// ---------------------------------------------------------------------------

export function userAliases(): UserAlias[] {
  const rows = getDb()
    .prepare(
      "SELECT pattern, category FROM category_aliases WHERE source = 'user' ORDER BY hits DESC",
    )
    .all() as { pattern: string; category: string }[];
  return rows;
}

/**
 * Learn from a correction: write the alias AND bump its hit counter, so the
 * next identical merchant auto-categorizes forever after.
 */
export function learnAlias(pattern: string, category: string): { learned: boolean } {
  const db = getDb();
  db.prepare(
    `INSERT INTO category_aliases (pattern, category, source, hits)
     VALUES (?, ?, 'user', 1)
     ON CONFLICT(pattern, category) DO UPDATE SET hits = hits + 1`,
  ).run(pattern.toUpperCase(), category);
  return { learned: true };
}

/** Apply a correction: relabel one transaction + retro-fix matching rows. */
export function applyCorrection(input: {
  txn_id?: number;
  txn_hash?: string;
  pattern?: string;
  category: string;
}): {
  updated: number;
  alias_learned: boolean;
  pattern: string | null;
  /** So the client can offer Undo: what the row was before. */
  previous_category: string | null;
} {
  const db = getDb();
  let target: { id: number; clean_narration: string; txn_hash: string; category: string | null } | undefined;

  if (input.txn_id) {
    target = db
      .prepare("SELECT id, clean_narration, txn_hash, category FROM transactions WHERE id = ?")
      .get(input.txn_id) as typeof target;
  } else if (input.txn_hash) {
    target = db
      .prepare("SELECT id, clean_narration, txn_hash, category FROM transactions WHERE txn_hash = ?")
      .get(input.txn_hash) as typeof target;
  }
  if (!target) return { updated: 0, alias_learned: false, pattern: null, previous_category: null };

  // Alias pattern = the first two stable merchant-ish tokens IN NARRATION
  // ORDER (so "UPI/CHAI POINT 20" learns "CHAI POINT", which also matches
  // "UPI/CHAI POINT CP"); rails and ref numbers are stripped.
  const STOP = new Set(["UPI", "P2A", "P2M", "NEFT", "IMPS", "RTGS", "NACH", "TFR", "PAY"]);
  const pattern =
    input.pattern ??
    target.clean_narration
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w))
      .slice(0, 2)
      .join(" ")
      .trim();

  if (!pattern) {
    return { updated: 0, alias_learned: false, pattern: null, previous_category: null };
  }

  const run = db.transaction(() => {
    // relabel this row and every row whose narration contains the pattern
    const info = db
      .prepare(
        `UPDATE transactions SET category = ?
         WHERE id = ? OR upper(clean_narration) LIKE ?`,
      )
      .run(input.category, target!.id, `%${pattern}%`);
    learnAlias(pattern, input.category);
    return info.changes;
  });
  const updated = run();

  return { updated, alias_learned: true, pattern, previous_category: target.category };
}

/**
 * Undo a correction: restore the row's previous category, relabel the
 * propagated rows back to uncategorized (the categorizer re-runs on them),
 * and drop the learned alias so it stops firing.
 */
export function undoCorrection(input: {
  txn_id: number;
  previous_category: string | null;
  pattern: string | null;
}): { ok: boolean; reverted: number } {
  const db = getDb();
  const row = db
    .prepare("SELECT id, clean_narration FROM transactions WHERE id = ?")
    .get(input.txn_id) as { id: number; clean_narration: string } | undefined;
  if (!row) return { ok: false, reverted: 0 };

  const run = db.transaction(() => {
    let reverted = 0;
    if (input.pattern) {
      const info = db
        .prepare(
          `UPDATE transactions SET category = 'uncategorized'
           WHERE upper(clean_narration) LIKE ? AND category != 'uncategorized'`,
        )
        .run(`%${input.pattern.toUpperCase()}%`);
      reverted += info.changes;
      db.prepare(
        "DELETE FROM category_aliases WHERE pattern = ? AND source = 'user'",
      ).run(input.pattern.toUpperCase());
    }
    const restore = db
      .prepare("UPDATE transactions SET category = ? WHERE id = ?")
      .run(input.previous_category ?? "uncategorized", input.txn_id);
    reverted += restore.changes;
    return reverted;
  });
  const reverted = run();
  return { ok: true, reverted };
}

export function allAliases(): { pattern: string; category: string; hits: number }[] {
  return getDb()
    .prepare("SELECT pattern, category, hits FROM category_aliases ORDER BY hits DESC")
    .all() as { pattern: string; category: string; hits: number }[];
}

// ---------------------------------------------------------------------------
// Categorization pass
// ---------------------------------------------------------------------------

export function categorizeAll(): void {
  const aliases = userAliases();
  const db = getDb();
  const rows = db
    .prepare("SELECT id, clean_narration, amount_paise, category, type FROM transactions")
    .all() as {
    id: number;
    clean_narration: string;
    amount_paise: number;
    category: string | null;
    type: string;
  }[];

  const upd = db.prepare("UPDATE transactions SET category = ? WHERE id = ?");
  const run = db.transaction(() => {
    for (const r of rows) {
      if (r.type === "transfer" || r.type === "card_bill") {
        upd.run("transfer", r.id);
        continue;
      }
      if (r.category && r.category !== "uncategorized") continue; // keep user/dict answers
      const res = categorize(
        { clean_narration: r.clean_narration, amount_paise: r.amount_paise },
        aliases,
      );
      upd.run(res.category, r.id);
    }
  });
  run();
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

export function saveVerdict(input: {
  question: unknown;
  receipt: unknown;
  verdict: Verdict;
}): number {
  const info = getDb()
    .prepare(
      "INSERT INTO verdicts (question_json, receipt_json, verdict) VALUES (?, ?, ?)",
    )
    .run(JSON.stringify(input.question), JSON.stringify(input.receipt), input.verdict);
  return Number(info.lastInsertRowid);
}

export function listVerdicts(limit = 20): {
  id: number;
  question_json: string;
  receipt_json: string;
  verdict: string;
  created_at: string;
}[] {
  return getDb()
    .prepare("SELECT id, question_json, receipt_json, verdict, created_at FROM verdicts ORDER BY id DESC LIMIT ?")
    .all(limit) as never;
}

export function getVerdict(id: number): {
  id: number;
  question_json: string;
  receipt_json: string;
  verdict: string;
  created_at: string;
} | undefined {
  return getDb()
    .prepare("SELECT id, question_json, receipt_json, verdict, created_at FROM verdicts WHERE id = ?")
    .get(id) as never;
}

// ---------------------------------------------------------------------------
// Stats for empty/loaded states
// ---------------------------------------------------------------------------

export function ledgerStats(): {
  txns: number;
  accounts: number;
  first_date: string | null;
  last_date: string | null;
} {
  const db = getDb();
  const s = db
    .prepare(
      "SELECT COUNT(*) AS n, MIN(date) AS first_date, MAX(date) AS last_date FROM transactions",
    )
    .get() as { n: number; first_date: string | null; last_date: string | null };
  const a = db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number };
  return { txns: s.n, accounts: a.n, first_date: s.first_date, last_date: s.last_date };
}

/** Current balance = sum of all flows + opening balance (0 if never set). */
export function currentBalancePaise(): number {
  const row = getDb()
    .prepare(
      "SELECT COALESCE(SUM(amount_paise), 0) AS s FROM transactions WHERE type = 'normal'",
    )
    .get() as { s: number };
  return row.s;
}

export function bankLabelFor(accountId: string): string {
  const row = getDb().prepare("SELECT bank FROM accounts WHERE id = ?").get(accountId) as
    | { bank: string }
    | undefined;
  return row?.bank ?? getAdapter(accountId.split("-")[0])?.id ?? "unknown";
}
