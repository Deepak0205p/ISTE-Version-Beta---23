/**
 * PS4 schema — exactly four tables (Build Bible §11).
 *
 *   accounts          multi-account support
 *   transactions      the ledger; txn_hash feeds dedup (Fellegi-Sunter M/P/U)
 *   category_aliases  correction propagation (user fixes teach the dictionary)
 *   verdicts          audit trail; /api/receipt reads here
 *
 * Money is stored as integer paise everywhere — never floats — so totals
 * reconcile exactly (Build Bible §6).
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY,
  bank         TEXT NOT NULL,
  label        TEXT NOT NULL,
  last4        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     TEXT NOT NULL REFERENCES accounts(id),
  date           TEXT NOT NULL,                 -- ISO 8601 (YYYY-MM-DD)
  amount_paise   INTEGER NOT NULL,              -- debit negative, credit positive
  raw_narration  TEXT NOT NULL,
  clean_narration TEXT NOT NULL,
  ref            TEXT,                          -- dedup key part (Chq/Ref No)
  category       TEXT,
  type           TEXT NOT NULL DEFAULT 'normal'
                 CHECK (type IN ('normal', 'transfer', 'netted')),
  flags          TEXT NOT NULL DEFAULT '{}',    -- JSON: dup_p, mad_anomaly, ...
  txn_hash       TEXT NOT NULL UNIQUE,          -- (account, date, amount, ref, narration)
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_date
  ON transactions (account_id, date);

CREATE TABLE IF NOT EXISTS category_aliases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern     TEXT NOT NULL,                    -- merchant substring
  category    TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'dict'
              CHECK (source IN ('dict', 'user', 'llm')),
  hits        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (pattern, category)
);

CREATE TABLE IF NOT EXISTS verdicts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  question_json TEXT NOT NULL,                  -- LLM-parsed question (Job 1)
  receipt_json  TEXT NOT NULL,                  -- full receipt, Build Bible §9.4
  verdict       TEXT NOT NULL CHECK (verdict IN ('YES', 'TIGHT', 'NO', 'REFUSED')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
