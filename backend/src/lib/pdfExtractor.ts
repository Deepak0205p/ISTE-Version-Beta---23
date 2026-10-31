/**
 * PDF statement extraction (Build Bible §6).
 *
 * Two failure modes are certain at hackathons and are handled as FEATURES,
 * not crashes:
 *   1. password-protected PDF  → detect, ask the user to unlock (or accept
 *      the password field and retry)
 *   2. scanned/image PDF       → no text layer → say so and ask for CSV
 *
 * "We chose to fail loudly and honestly" — a silent wrong parse poisons
 * every downstream number.
 */
import { normalizeNarration, txnHash } from "@/lib/ledgerHygiene";
import type { LedgerTxn } from "@/lib/types";

export type PdfFailureCode =
  | "PASSWORD_PROTECTED"
  | "NO_TEXT_LAYER"
  | "NO_TABLE_FOUND"
  | "PARSE_ERROR";

export type PdfExtractResult =
  | { ok: true; rows: LedgerTxn[]; textLength: number }
  | { ok: false; code: PdfFailureCode; message: string };

/** Minimum extractable characters before we call it a scanned document. */
const MIN_TEXT_CHARS = 80;

export async function extractPdfText(
  buffer: Buffer,
  password?: string,
): Promise<
  | { ok: true; text: string }
  | { ok: false; code: PdfFailureCode; message: string }
> {
  let parser:
    | { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> }
    | undefined;
  try {
    // pdf-parse v2 API: PDFParse class; deep import from the package root.
    const mod = (await import("pdf-parse")) as unknown as {
      PDFParse: new (options: { data: Uint8Array; password?: string }) => {
        getText: () => Promise<{ text: string }>;
        destroy: () => Promise<void>;
      };
    };
    parser = new mod.PDFParse({
      data: new Uint8Array(buffer),
      ...(password ? { password } : {}),
    });
    const result = await parser.getText();
    return { ok: true, text: result?.text ?? "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";

    if (
      /password/i.test(message) ||
      /password/i.test(name) ||
      name === "PasswordException" ||
      /encrypted/i.test(message)
    ) {
      return {
        ok: false,
        code: "PASSWORD_PROTECTED",
        message:
          "This PDF is password-protected. Unlock it in your banking app (or provide the open password) — or upload the CSV export instead.",
      };
    }

    return {
      ok: false,
      code: "PARSE_ERROR",
      message: `We could not read this PDF (${message}). Upload the CSV export instead.`,
    };
  } finally {
    if (parser) {
      await parser.destroy().catch(() => undefined);
    }
  }
}

/**
 * Best-effort text → rows: matches lines shaped like `DD/MM/YYYY ... amount`.
 * If nothing matches a table shape, we return NO_TABLE_FOUND rather than
 * inventing rows.
 */
export function rowsFromPdfText(text: string, account_id: string): PdfExtractResult {
  const cleaned = text.replace(/\u00a0/g, " ");
  const visible = cleaned.replace(/\s+/g, " ").trim();

  if (visible.length < MIN_TEXT_CHARS) {
    return {
      ok: false,
      code: "NO_TEXT_LAYER",
      message:
        "This looks like a scanned/image PDF with no text layer. OCR is out of scope for this build — we fail loudly instead of guessing. Please upload the CSV export.",
    };
  }

  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: LedgerTxn[] = [];

  const dateRe =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b|^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b|^(\d{4})-(\d{1,2})-(\d{1,2})\b/;
  const amountRe = /(?:₹|Rs\.?|INR)?\s*([\d,]+\.\d{2})\b(?:\s*(Dr|Cr))?/gi;

  for (const line of lines) {
    const dm = line.match(dateRe);
    if (!dm) continue;

    let iso: string;
    if (dm[1]) {
      iso = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    } else if (dm[4]) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const mo = months.findIndex((m) => m.toLowerCase() === (dm[5] ?? "").toLowerCase());
      if (mo < 0) continue;
      iso = `${dm[6]}-${String(mo + 1).padStart(2, "0")}-${dm[4].padStart(2, "0")}`;
    } else {
      iso = `${dm[7]}-${dm[8].padStart(2, "0")}-${dm[9].padStart(2, "0")}`;
    }

    // collect ALL money-looking tokens in the line
    const amounts: { value: number; dir: string | null }[] = [];
    amountRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = amountRe.exec(line)) !== null) {
      const n = Number(m[1].replace(/,/g, ""));
      if (!Number.isFinite(n)) continue;
      amounts.push({ value: Math.round(n * 100), dir: m[2] ? m[2].toLowerCase() : null });
    }
    if (amounts.length === 0) continue;

    // narration = line minus date and minus the chosen amount
    let narration = line
      .replace(dateRe, " ")
      .replace(amountRe, " ")
      .replace(/\s+/g, " ")
      .trim();

    // signed amount: Dr negative / Cr positive; else the LAST amount is
    // typically the closing balance, so prefer the one with an explicit dir.
    const directed = amounts.find((a) => a.dir);
    const amountPaise = directed
      ? directed.dir === "dr"
        ? -Math.abs(directed.value)
        : Math.abs(directed.value)
      : amounts.length >= 2
        ? amounts[amounts.length - 2].value // heuristic fallback
        : amounts[0].value;

    if (!narration) narration = "PDF ROW";

    const clean = normalizeNarration(narration);
    rows.push({
      account_id,
      date: iso,
      amount_paise: amountPaise,
      raw_narration: narration,
      clean_narration: clean,
      ref: null,
      category: null,
      type: "normal",
      flags: {},
      txn_hash: txnHash(account_id, iso, amountPaise, null, clean),
    });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      code: "NO_TABLE_FOUND",
      message:
        "Text was found but no transaction table could be located in it. Please upload the CSV export so nothing is guessed.",
    };
  }

  return { ok: true, rows, textLength: visible.length };
}

/** One call: bytes → rows or a clear, human-facing failure. */
export async function extractPdfTransactions(
  buffer: Buffer,
  account_id: string,
  password?: string,
): Promise<PdfExtractResult> {
  const text = await extractPdfText(buffer, password);
  if (!text.ok) return text;
  return rowsFromPdfText(text.text, account_id);
}
