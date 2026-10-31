// Phase 1 verification: schema creates exactly four tables, then cleans up.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "data", "ledger.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) fs.rmSync(dbPath);

const db = new Database(dbPath);
const sql = fs.readFileSync(path.join(root, "src", "lib", "schema.ts"), "utf8").split("`")[1];
db.exec(sql);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

console.log("TABLES:", JSON.stringify(tables));
console.log("COUNT:", tables.length, tables.length === 4 ? "(expected 4)" : "(WRONG - expected 4)");

const txCols = db.prepare("PRAGMA table_info(transactions)").all().map((r) => r.name);
console.log("transactions columns:", JSON.stringify(txCols));

db.close();
fs.rmSync(dbPath);
process.exit(tables.length === 4 ? 0 : 1);
