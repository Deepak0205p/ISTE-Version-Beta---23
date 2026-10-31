/**
 * Storage repository:
 * - Local-first persistent JSON storage (.data/local_repository.json)
 * - Firebase Firestore cloud sync when credentials are provided
 * - Structured collections: accounts, transactions, category_aliases, verdicts, users
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirebaseAdmin, isFirestoreConfigured } from "./firebaseAdmin.js";
import { categorize } from "./categorizer.js";
import type { LedgerTxn, TxnFlags } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../.data");
const LOCAL_STORAGE_FILE = path.join(DATA_DIR, "local_repository.json");

export type AccountRow = {
  id: string;
  bank: string;
  label: string;
  last4: string | null;
  created_at?: string;
};

export type CategoryAliasRow = {
  pattern: string;
  category: string;
  user_defined: number;
  created_at?: string;
};

export type UserAlias = {
  pattern: string;
  category: string;
  hits?: number;
};

export type VerdictRecord = {
  id?: number | string;
  query_text: string;
  item_name: string | null;
  target_price_paise: number | null;
  horizon_days: number;
  verdict: "YES" | "TIGHT" | "NO" | "REFUSED";
  p10_paise: number | null;
  p50_paise: number | null;
  p90_paise: number | null;
  buffer_paise: number | null;
  safety_ratio: number | null;
  receipt_json: string;
  created_at?: string;
};

let accountsCache: Map<string, AccountRow> = new Map();
let txnsCache: Map<string, LedgerTxn> = new Map();
let aliasesCache: Map<string, CategoryAliasRow> = new Map();
let verdictsCache: VerdictRecord[] = [];
let initialized = false;
let firestoreSyncActive = false;
let nextTxnId = 1;
let saveDebounceTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------------------
// Local Persistence Helpers
// ---------------------------------------------------------------------------

function loadLocalData(): boolean {
  try {
    if (!fs.existsSync(LOCAL_STORAGE_FILE)) return false;
    const raw = fs.readFileSync(LOCAL_STORAGE_FILE, "utf8");
    if (!raw.trim()) return false;
    const data = JSON.parse(raw);

    if (Array.isArray(data.accounts)) {
      accountsCache.clear();
      data.accounts.forEach((acc: AccountRow) => accountsCache.set(acc.id, acc));
    }
    if (Array.isArray(data.transactions)) {
      txnsCache.clear();
      data.transactions.forEach((t: LedgerTxn) => {
        txnsCache.set(t.txn_hash, t);
        if (t.id && t.id >= nextTxnId) nextTxnId = t.id + 1;
      });
    }
    if (Array.isArray(data.aliases)) {
      aliasesCache.clear();
      data.aliases.forEach((a: CategoryAliasRow) => aliasesCache.set(a.pattern, a));
    }
    if (Array.isArray(data.verdicts)) {
      verdictsCache = data.verdicts;
    }
    if (typeof data.nextTxnId === "number" && data.nextTxnId > nextTxnId) {
      nextTxnId = data.nextTxnId;
    }
    return true;
  } catch (err) {
    console.warn("[Repository] Error reading local storage file:", err instanceof Error ? err.message : err);
    return false;
  }
}

function persistLocalDataNow(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const snapshot = {
      accounts: Array.from(accountsCache.values()),
      transactions: Array.from(txnsCache.values()),
      aliases: Array.from(aliasesCache.values()),
      verdicts: verdictsCache,
      nextTxnId,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  } catch (err) {
    console.warn("[Repository] Error persisting local storage:", err instanceof Error ? err.message : err);
  }
}

function scheduleSaveLocalData(): void {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    persistLocalDataNow();
  }, 120);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export async function initRepository(): Promise<void> {
  if (initialized) return;

  // 1. Always load local cache first so data is instantly available
  const hasLocal = loadLocalData();

  // 2. If Firestore credentials are not configured, use local storage mode gracefully
  if (!isFirestoreConfigured()) {
    initialized = true;
    firestoreSyncActive = false;
    const accCount = accountsCache.size;
    const txnCount = txnsCache.size;
    console.log(
      `ℹ️  [Storage] Local storage active (${txnCount} txns, ${accCount} accounts from .data/local_repository.json).`
    );
    return;
  }

  // 3. If credentials exist, sync with Firestore
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      initialized = true;
      firestoreSyncActive = false;
      return;
    }

    const { db } = admin;

    const accSnap = await db.collection("accounts").get();
    accSnap.forEach((doc) => {
      accountsCache.set(doc.id, doc.data() as AccountRow);
    });

    const txnSnap = await db.collection("transactions").get();
    txnSnap.forEach((doc) => {
      const data = doc.data() as LedgerTxn;
      txnsCache.set(doc.id, data);
      if (data.id && data.id >= nextTxnId) nextTxnId = data.id + 1;
    });

    const aliasSnap = await db.collection("category_aliases").get();
    aliasSnap.forEach((doc) => {
      aliasesCache.set(doc.id, doc.data() as CategoryAliasRow);
    });

    const verdSnap = await db.collection("verdicts").orderBy("created_at", "desc").limit(20).get();
    verdSnap.forEach((doc) => {
      verdictsCache.push({ id: doc.id, ...(doc.data() as VerdictRecord) });
    });

    firestoreSyncActive = true;
    initialized = true;
    scheduleSaveLocalData();
    console.log(`✅ [Storage] Firestore connected. Synced ${txnsCache.size} transaction(s).`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  [Storage] Firestore unavailable (${msg}). Fallback to local storage active.`);
    firestoreSyncActive = false;
    initialized = true;
  }
}

export function isFirestoreSyncActive(): boolean {
  return firestoreSyncActive;
}

// ---------------------------------------------------------------------------
// Account Operations
// ---------------------------------------------------------------------------

export function upsertAccount(input: {
  id: string;
  bank: string;
  label: string;
  last4?: string | null;
}) {
  const row: AccountRow = {
    id: input.id,
    bank: input.bank,
    label: input.label,
    last4: input.last4 ?? null,
    created_at: new Date().toISOString(),
  };
  accountsCache.set(input.id, row);
  scheduleSaveLocalData();

  if (firestoreSyncActive) {
    try {
      const admin = getFirebaseAdmin();
      if (admin) {
        admin.db.collection("accounts").doc(input.id).set(row, { merge: true }).catch(() => {});
      }
    } catch {}
  }
}

export function listAccounts(): AccountRow[] {
  return Array.from(accountsCache.values());
}

export function ensureLast4(): void {
  for (const acc of accountsCache.values()) {
    if (!acc.last4) {
      acc.last4 = acc.id.slice(-4).padStart(4, "0");
      upsertAccount(acc);
    }
  }
}

export function resolveAccountId(label: string, bank: string): string {
  const slug = (label || bank).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "account-1";
}

export function bankLabelFor(accountId: string): string {
  const acc = accountsCache.get(accountId);
  return acc?.label ?? accountId;
}

// ---------------------------------------------------------------------------
// Transaction Operations
// ---------------------------------------------------------------------------

export function insertTransactions(txns: LedgerTxn[]): {
  inserted: number;
  skippedIdentical: number;
} {
  let inserted = 0;
  let skippedIdentical = 0;
  const toSave: LedgerTxn[] = [];

  for (const row of txns) {
    if (txnsCache.has(row.txn_hash)) {
      skippedIdentical++;
      continue;
    }
    if (!row.id) {
      row.id = nextTxnId++;
    }
    txnsCache.set(row.txn_hash, row);
    toSave.push(row);
    inserted++;
  }

  if (inserted > 0) {
    scheduleSaveLocalData();
  }

  if (firestoreSyncActive && toSave.length > 0) {
    try {
      const admin = getFirebaseAdmin();
      if (admin) {
        const batch = admin.db.batch();
        toSave.slice(0, 400).forEach((t) => {
          const ref = admin.db.collection("transactions").doc(t.txn_hash);
          batch.set(ref, t);
        });
        batch.commit().catch(() => {});
      }
    } catch {}
  }

  return { inserted, skippedIdentical };
}

export function allTransactions(): LedgerTxn[] {
  return Array.from(txnsCache.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function updateTxnFlags(id: number, flags: TxnFlags): void {
  for (const t of txnsCache.values()) {
    if (t.id === id) {
      t.flags = { ...t.flags, ...flags };
      scheduleSaveLocalData();
      if (firestoreSyncActive) {
        try {
          const admin = getFirebaseAdmin();
          if (admin) {
            admin.db.collection("transactions").doc(t.txn_hash).update({ flags: t.flags }).catch(() => {});
          }
        } catch {}
      }
      break;
    }
  }
}

export function updateTxnCategory(id: number, category: string): void {
  for (const t of txnsCache.values()) {
    if (t.id === id) {
      t.category = category;
      scheduleSaveLocalData();
      if (firestoreSyncActive) {
        try {
          const admin = getFirebaseAdmin();
          if (admin) {
            admin.db.collection("transactions").doc(t.txn_hash).update({ category }).catch(() => {});
          }
        } catch {}
      }
      break;
    }
  }
}

export function updateTxnType(id: number, type: LedgerTxn["type"]): void {
  for (const t of txnsCache.values()) {
    if (t.id === id) {
      t.type = type;
      scheduleSaveLocalData();
      if (firestoreSyncActive) {
        try {
          const admin = getFirebaseAdmin();
          if (admin) {
            admin.db.collection("transactions").doc(t.txn_hash).update({ type }).catch(() => {});
          }
        } catch {}
      }
      break;
    }
  }
}

export function persistHygiene(txns: LedgerTxn[]): void {
  for (const t of txns) {
    if (txnsCache.has(t.txn_hash)) {
      txnsCache.set(t.txn_hash, t);
    }
  }
  scheduleSaveLocalData();
}

export function categorizeAll(): void {
  const aliases = Array.from(aliasesCache.values()).map((a) => ({
    pattern: a.pattern,
    category: a.category,
  }));

  for (const t of txnsCache.values()) {
    if (!t.category || t.category === "uncategorized") {
      const match = categorize(
        { clean_narration: t.clean_narration || t.raw_narration || "", amount_paise: t.amount_paise },
        aliases,
      );
      t.category = match.category;
    }
  }
  scheduleSaveLocalData();
}

// ---------------------------------------------------------------------------
// Category Aliases Operations
// ---------------------------------------------------------------------------

export function userAliases(): UserAlias[] {
  return Array.from(aliasesCache.values())
    .filter((a) => a.user_defined === 1)
    .map((a) => ({ pattern: a.pattern, category: a.category, hits: 1 }));
}

export function allAliases(): { pattern: string; category: string; hits: number }[] {
  return Array.from(aliasesCache.values()).map((a) => ({
    pattern: a.pattern,
    category: a.category,
    hits: 1,
  }));
}

export function learnAlias(pattern: string, category: string): { learned: boolean } {
  const norm = pattern.trim();
  if (!norm) return { learned: false };

  const row: CategoryAliasRow = {
    pattern: norm,
    category,
    user_defined: 1,
    created_at: new Date().toISOString(),
  };
  aliasesCache.set(norm, row);
  scheduleSaveLocalData();

  if (firestoreSyncActive) {
    try {
      const admin = getFirebaseAdmin();
      if (admin) {
        admin.db.collection("category_aliases").doc(norm).set(row).catch(() => {});
      }
    } catch {}
  }

  return { learned: true };
}

export function applyCorrection(input: {
  txn_id?: number;
  txn_hash?: string;
  pattern?: string;
  category: string;
}) {
  let updatedRows = 0;
  let learnedPattern: string | null = null;

  for (const t of txnsCache.values()) {
    if ((input.txn_id && t.id === input.txn_id) || (input.txn_hash && t.txn_hash === input.txn_hash)) {
      t.category = input.category;
      updatedRows++;
      if (!learnedPattern) {
        const narr = t.clean_narration || t.raw_narration || "";
        learnedPattern = narr ? narr.slice(0, 30).trim() : input.pattern || null;
        if (learnedPattern) {
          learnAlias(learnedPattern, input.category);
        }
      }
    }
  }

  if (updatedRows > 0) {
    scheduleSaveLocalData();
  }

  return { ok: true, updatedRows, learnedPattern };
}

export function undoCorrection(input: {
  txn_id: number;
  previous_category?: string | null;
  pattern?: string | null;
}) {
  let reverted = 0;
  for (const t of txnsCache.values()) {
    if (t.id === input.txn_id) {
      t.category = input.previous_category || "uncategorized";
      reverted++;
    }
  }
  if (input.pattern) {
    aliasesCache.delete(input.pattern);
    if (firestoreSyncActive) {
      try {
        const admin = getFirebaseAdmin();
        if (admin) {
          admin.db.collection("category_aliases").doc(input.pattern).delete().catch(() => {});
        }
      } catch {}
    }
  }

  if (reverted > 0 || input.pattern) {
    scheduleSaveLocalData();
  }

  return { ok: true, reverted };
}

export function markTxnDecision(txnId: number, decision: "real" | "duplicate") {
  for (const t of txnsCache.values()) {
    if (t.id === txnId) {
      if (decision === "real") {
        t.flags.mad_anomaly = false;
        t.flags.user_kept = true;
      } else {
        t.flags.user_duplicate = true;
      }
      scheduleSaveLocalData();
      if (firestoreSyncActive) {
        try {
          const admin = getFirebaseAdmin();
          if (admin) {
            admin.db.collection("transactions").doc(t.txn_hash).update({ flags: t.flags }).catch(() => {});
          }
        } catch {}
      }
      return { ok: true, message: `Transaction marked as ${decision}.` };
    }
  }
  return { ok: false, message: "Transaction not found." };
}

// ---------------------------------------------------------------------------
// Verdicts Operations
// ---------------------------------------------------------------------------

export function saveVerdict(input: {
  query_text: string;
  item_name?: string | null;
  target_price_paise?: number | null;
  horizon_days?: number;
  verdict: "YES" | "TIGHT" | "NO" | "REFUSED";
  p10_paise?: number | null;
  p50_paise?: number | null;
  p90_paise?: number | null;
  buffer_paise?: number | null;
  safety_ratio?: number | null;
  receipt_json: string;
}): number {
  const id = Date.now();
  const record: VerdictRecord = {
    id,
    query_text: input.query_text,
    item_name: input.item_name ?? null,
    target_price_paise: input.target_price_paise ?? null,
    horizon_days: input.horizon_days ?? 30,
    verdict: input.verdict,
    p10_paise: input.p10_paise ?? null,
    p50_paise: input.p50_paise ?? null,
    p90_paise: input.p90_paise ?? null,
    buffer_paise: input.buffer_paise ?? null,
    safety_ratio: input.safety_ratio ?? null,
    receipt_json: input.receipt_json,
    created_at: new Date().toISOString(),
  };

  verdictsCache.unshift(record);
  scheduleSaveLocalData();

  if (firestoreSyncActive) {
    try {
      const admin = getFirebaseAdmin();
      if (admin) {
        admin.db.collection("verdicts").doc(String(id)).set(record).catch(() => {});
      }
    } catch {}
  }

  return id;
}

export function listVerdicts(limit = 20): VerdictRecord[] {
  return verdictsCache.slice(0, limit);
}

export function getVerdict(id: number): VerdictRecord | null {
  return verdictsCache.find((v) => Number(v.id) === id) || null;
}

// ---------------------------------------------------------------------------
// Aggregation & State Helpers
// ---------------------------------------------------------------------------

export function ledgerStats() {
  const txns = Array.from(txnsCache.values());
  const accounts = Array.from(accountsCache.values());
  const dates = txns.map((t) => t.date).filter(Boolean).sort();

  return {
    txns: txns.length,
    accounts: accounts.length,
    first_date: dates[0] || null,
    last_date: dates[dates.length - 1] || null,
  };
}

export function currentBalancePaise(): number {
  let bal = 0;
  for (const t of txnsCache.values()) {
    if (t.type === "credit") bal += t.amount_paise;
    else if (t.type === "debit") bal -= t.amount_paise;
  }
  return bal;
}

export function wipeAll(): { wiped: true; deleted: Record<string, number> } {
  const counts = {
    accounts: accountsCache.size,
    transactions: txnsCache.size,
    category_aliases: aliasesCache.size,
    verdicts: verdictsCache.length,
  };

  accountsCache.clear();
  txnsCache.clear();
  aliasesCache.clear();
  verdictsCache = [];

  persistLocalDataNow();

  if (firestoreSyncActive) {
    try {
      const admin = getFirebaseAdmin();
      if (admin) {
        ["accounts", "transactions", "category_aliases", "verdicts"].forEach((col) => {
          admin.db.collection(col).listDocuments().then((docs) => {
            docs.forEach((d) => d.delete().catch(() => {}));
          }).catch(() => {});
        });
      }
    } catch {}
  }

  return { wiped: true, deleted: counts };
}
