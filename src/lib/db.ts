/**
 * Local SQLite connection — one file, zero setup, no cloud (Build Bible §5).
 *
 * The database is an artifact: it lives at <repo>/data/ledger.db, resets
 * between demo runs by deleting the file, and can be inspected on stage.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { SCHEMA_SQL } from "./schema";

const DB_PATH =
  process.env.LEDGER_DB_PATH ?? join(process.cwd(), "data", "ledger.db");

/** Reuse one handle across Next.js dev-server hot reloads. */
const globalForDb = globalThis as unknown as { __ledgerDb?: Database.Database };

function open(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__ledgerDb) {
    globalForDb.__ledgerDb = open();
  }
  return globalForDb.__ledgerDb;
}

export { DB_PATH };
