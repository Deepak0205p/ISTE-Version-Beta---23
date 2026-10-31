/**
 * AI-powered Statement Parser using Google Gemini with Deterministic Fallbacks
 * Parses PDF and CSV bank statements reliably with zero downtime.
 */
import { normalizeNarration, txnHash } from "./ledgerHygiene.js";
import type { LedgerTxn } from "./types.js";

const DEFAULT_API_KEY = "AQ.Ab8RN6J-sF1BtzwQ-AsK0lq1ET7uBX4JjTXQJGlkTjdoFAZxbw";
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

export interface ExtractedAiTxn {
  date: string;
  narration?: string;
  raw_narration?: string;
  amount: number;
  type?: "credit" | "debit";
  category?: string;
  ref?: string;
}

export interface AiParseResult {
  ok: boolean;
  rows: LedgerTxn[];
  message?: string;
  totalFound: number;
}

const SYSTEM_INSTRUCTION = `You are a high-precision bank statement and financial document parser.
Your task is to extract every transaction from the provided bank statement (PDF or CSV or text) into a structured JSON array.

Extraction rules:
1. date: YYYY-MM-DD format (convert any DD/MM/YYYY, DD-MMM-YYYY, or MM/DD/YYYY to ISO YYYY-MM-DD).
2. narration: Clean merchant or beneficiary name (e.g. "Swiggy", "Salary", "Netflix", "Electricity Bill").
3. raw_narration: Full original narration / description from the row or statement.
4. amount: Numeric amount in standard currency (e.g. 450.00 or 85000.00). Positive for credit / deposit / income, negative for debit / withdrawal / expense.
5. type: "credit" if money was received/deposited, "debit" if money was spent/withdrawn.
6. category: One of "salary", "groceries", "dining", "shopping", "entertainment", "utilities", "transport", "transfer", "rent", "investment", "medical", "other".
7. ref: Transaction reference / UTR / cheque number if available, otherwise null.

Ignore opening balances, closing balances, summary totals, or non-transaction headers.
Return ONLY a valid JSON array of objects matching the schema.`;

/**
 * Call Gemini API with automatic model failover
 */
async function callGeminiForStatement(
  parts: Array<Record<string, unknown>>
): Promise<ExtractedAiTxn[]> {
  const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) || process.env.GOOGLE_API_KEY || DEFAULT_API_KEY;

  const modelsToTry = Array.from(new Set(CANDIDATE_MODELS));
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts }],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error (${response.status}) on model ${model}: ${errorBody}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const cleaned = text.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed as ExtractedAiTxn[];
      }
      if (parsed && Array.isArray((parsed as { transactions?: ExtractedAiTxn[] }).transactions)) {
        return (parsed as { transactions: ExtractedAiTxn[] }).transactions;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Gemini model ${model} failed, trying next candidate...`, lastError.message);
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

// ---------------------------------------------------------------------------
// Deterministic Fallback Parsers (No API Needed)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  result.push(cur.trim());
  return result;
}

function normalizeDateToIso(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  }

  // DD Mon YYYY or DD-Mon-YYYY (e.g. 01 Sep 2025, 01-Sep-2025)
  const m2 = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,})[\s\-](\d{4})$/);
  if (m2) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const mo = months[m2[2].slice(0, 3).toLowerCase()];
    if (mo) {
      return `${m2[3]}-${mo}-${m2[1].padStart(2, "0")}`;
    }
  }

  return null;
}

function parseAmountPaise(raw: string): number {
  if (!raw) return 0;
  let s = raw.replace(/[₹$,\s]/g, "");
  let isDebit = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    isDebit = true;
    s = s.slice(1, -1);
  }
  if (/dr$/i.test(s)) {
    isDebit = true;
    s = s.replace(/dr$/i, "");
  }
  if (/cr$/i.test(s)) {
    s = s.replace(/cr$/i, "");
  }
  const val = parseFloat(s);
  if (isNaN(val)) return 0;
  const paise = Math.round(Math.abs(val) * 100);
  return isDebit || val < 0 ? -paise : paise;
}

function guessCategory(narration: string): string {
  const n = narration.toLowerCase();
  if (/salary|payroll|credit interest|dividend|stipend/.test(n)) return "salary";
  if (/swiggy|zomato|eats|starbucks|mcdonald|subway|restaurant|burger|pizza|dine|cafe|coffee/.test(n)) return "dining";
  if (/blinkit|zepto|instamart|grocery|supermarket|dmart|bigbasket|nature basket|market/.test(n)) return "groceries";
  if (/rent|housing|landlord|maintenance|apartment|apartments|horizon/.test(n)) return "rent";
  if (/netflix|spotify|prime|hotstar|youtube|apple|hulu|disney|streamnet|video|ott/.test(n)) return "entertainment";
  if (/uber|ola|rapido|metro|fuel|petrol|diesel|irctc|flight|indigo|air india|shell/.test(n)) return "transport";
  if (/electricity|bescom|tata power|airtel|jio|vodafone|wifi|broadband|water|gas|bill|power & light|apex power/.test(n)) return "utilities";
  if (/hospital|pharmacy|apollo|medplus|clinic|doctor|health|1mg|practo|gym|fitness/.test(n)) return "medical";
  if (/sip|zerodha|groww|mutual fund|uti|hdfc mf|icici pru|securities|nse|bse/.test(n)) return "investment";
  if (/amazon|flipkart|myntra|zara|h&m|ajio|shopping|retail/.test(n)) return "shopping";
  if (/emi|loan|repayment|bajaj finserv|credit card/.test(n)) return "loan";
  if (/transfer|neft|rtgs|imps|upi\/p2p/.test(n)) return "transfer";
  if (/maintenance fee|annual fee|bank fee|service charge/.test(n)) return "fees";
  return "other";
}

export function parseCsvDeterministic(textContent: string, accountId: string): LedgerTxn[] {
  const lines = textContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const lowerHeader = header.map((h) => h.toLowerCase().trim());

  let dateIdx = lowerHeader.findIndex((h) => h === "date" || h.includes("txn date") || h.includes("trans date") || (h.includes("date") && !h.includes("update")));
  let narrIdx = lowerHeader.findIndex((h) => h.includes("narration") || h.includes("desc") || h.includes("particular") || h.includes("remark"));
  let debitIdx = lowerHeader.findIndex((h) => (h === "dr" || h === "debit" || h.includes("withdrawal") || (h.includes("debit") && !h.includes("credit")) || /\bdr\b/i.test(h)) && !h.includes("credit"));
  let creditIdx = lowerHeader.findIndex((h) => (h === "cr" || h === "credit" || h.includes("deposit") || (h.includes("credit") && !h.includes("debit")) || /\bcr\b/i.test(h)) && !h.includes("desc") && !h.includes("particular"));
  let amountIdx = lowerHeader.findIndex((h) => h === "amount" || h.includes("txn amount"));
  let balanceIdx = lowerHeader.findIndex((h) => h.includes("balance") || h.includes("closing") || h.includes("bal"));
  let refIdx = lowerHeader.findIndex((h) => h.includes("ref") || h.includes("chq") || h.includes("utr"));

  if (dateIdx === -1) dateIdx = 0;
  if (narrIdx === -1) narrIdx = 1;

  const rows: LedgerTxn[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length <= Math.max(dateIdx, narrIdx)) continue;

    const rawDate = cols[dateIdx]?.trim();
    const rawNarr = cols[narrIdx]?.trim() || "Transaction";
    if (!rawDate) continue;

    const isoDate = normalizeDateToIso(rawDate);
    if (!isoDate) continue;

    let amountPaise = 0;
    if (debitIdx !== -1 && cols[debitIdx]?.trim()) {
      const parsed = parseAmountPaise(cols[debitIdx]);
      if (parsed !== 0) amountPaise = -Math.abs(parsed);
    }
    if (creditIdx !== -1 && cols[creditIdx]?.trim()) {
      const parsed = parseAmountPaise(cols[creditIdx]);
      if (parsed !== 0) amountPaise = Math.abs(parsed);
    }
    if (amountPaise === 0 && amountIdx !== -1 && cols[amountIdx]?.trim()) {
      amountPaise = parseAmountPaise(cols[amountIdx]);
    }

    let balanceAfterPaise: number | undefined;
    if (balanceIdx !== -1 && cols[balanceIdx]?.trim()) {
      const bParsed = parseAmountPaise(cols[balanceIdx]);
      if (bParsed !== 0) balanceAfterPaise = Math.abs(bParsed);
    }

    if (amountPaise === 0) continue;

    const cleanNarr = normalizeNarration(rawNarr);
    const category = guessCategory(cleanNarr);
    const ref = refIdx !== -1 ? cols[refIdx]?.trim() || null : null;

    rows.push({
      account_id: accountId,
      date: isoDate,
      amount_paise: amountPaise,
      raw_narration: rawNarr,
      clean_narration: cleanNarr,
      category,
      ref,
      type: "normal",
      flags: {},
      txn_hash: txnHash(accountId, isoDate, amountPaise, ref, cleanNarr),
      balance_after_paise: balanceAfterPaise,
    });
  }

  return rows;
}

async function parsePdfDeterministic(buffer: Buffer, accountId: string): Promise<LedgerTxn[]> {
  try {
    let text = "";
    try {
      const mod = (await import("pdf-parse")) as unknown as {
        PDFParse: new (options: { data: Uint8Array }) => {
          getText: () => Promise<{ text: string }>;
          destroy: () => Promise<void>;
        };
      };
      const parser = new mod.PDFParse({ data: new Uint8Array(buffer) });
      const res = await parser.getText();
      text = res.text || "";
      await parser.destroy();
    } catch {
      // Fallback to pdfExtractor if pdf-parse class throws
      const { extractPdfText } = await import("./pdfExtractor.js");
      const ext = await extractPdfText(buffer);
      if (ext.ok) text = ext.text;
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: LedgerTxn[] = [];

    // Regex to match lines containing a date
    const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b/;
    const amountRegex = /\b(?:INR|₹|Rs\.?)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?|\d{3,})\s*(Cr|Dr)?\b/gi;

    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      if (!dateMatch) continue;

      const isoDate = normalizeDateToIso(dateMatch[1]);
      if (!isoDate) continue;

      // Crucial: Strip the date substring so date numbers (e.g. 02, 05, 2026) are NEVER extracted as monetary amounts!
      const lineWithoutDate = line.replace(dateRegex, " ");

      const amounts = Array.from(lineWithoutDate.matchAll(amountRegex));
      if (amounts.length === 0) continue;

      // Extract amount (use first valid amount in the line)
      const amtMatch = amounts[0];
      const parsedPaise = parseAmountPaise(amtMatch[0]);
      if (parsedPaise === 0) continue;

      // Clean narration by removing the date and amounts
      let cleanNarr = lineWithoutDate.replace(amountRegex, "").replace(/[,\t|]/g, " ").trim();
      if (!cleanNarr) cleanNarr = "Bank Transaction";

      let finalPaise = parsedPaise;
      const lowerLine = line.toLowerCase();
      if (/\b(dr|debit|wdl|withdrawal|paid|payment|auto-draft|pos debit)\b/i.test(lowerLine) && !/\b(payroll|salary|credit|deposit)\b/i.test(lowerLine)) {
        finalPaise = -Math.abs(finalPaise);
      } else if (/\b(cr|credit|deposit|payroll|salary|interest)\b/i.test(lowerLine)) {
        finalPaise = Math.abs(finalPaise);
      }

      rows.push({
        account_id: accountId,
        date: isoDate,
        amount_paise: finalPaise,
        raw_narration: line,
        clean_narration: normalizeNarration(cleanNarr),
        category: guessCategory(cleanNarr),
        ref: null,
        type: "normal",
        flags: {},
        txn_hash: txnHash(accountId, isoDate, finalPaise, null, cleanNarr),
      });
    }

    return rows;
  } catch (err) {
    console.warn("PDF deterministic fallback failed:", err);
    return [];
  }
}

/**
 * Parse a bank statement (PDF, CSV, or Text) directly using Gemini AI with deterministic fallback
 */
export async function parseStatementWithAi(
  buffer: Buffer,
  filename: string,
  accountId: string
): Promise<AiParseResult> {
  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith(".pdf");
  const isCsv = lower.endsWith(".csv") || lower.endsWith(".txt");

  let rawTxns: ExtractedAiTxn[] = [];

  try {
    let parts: Array<Record<string, unknown>> = [];

    if (isPdf) {
      const base64Data = buffer.toString("base64");
      parts = [
        {
          text: `Extract all transaction records from this attached PDF bank statement (${filename}) for account "${accountId}".`,
        },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        },
      ];
    } else {
      const textContent = buffer.toString("utf8");
      parts = [
        {
          text: `Extract all transaction records from this bank statement data (${filename}) for account "${accountId}":\n\n${textContent.slice(0, 50000)}`,
        },
      ];
    }

    rawTxns = await callGeminiForStatement(parts);
  } catch (aiErr) {
    console.warn(`AI parsing failed for ${filename}, running deterministic fallback:`, aiErr instanceof Error ? aiErr.message : aiErr);
  }

  // If Gemini succeeded and extracted rows, map them
  if (rawTxns.length > 0) {
    const rows: LedgerTxn[] = [];

    for (const item of rawTxns) {
      if (!item.date || typeof item.amount !== "number" || isNaN(item.amount)) {
        continue;
      }

      let isCredit = false;
      if (item.type === "credit") {
        isCredit = true;
      } else if (item.type === "debit") {
        isCredit = false;
      } else if (item.amount < 0) {
        isCredit = false;
      } else {
        const combined = `${item.narration || ""} ${item.raw_narration || ""}`.toLowerCase();
        if (/debit|withdrawal|dr\b|payment to|paid to|spent|bill|pos debit|fee|charge|uber|swiggy|zomato|blinkit|amazon/i.test(combined)) {
          isCredit = false;
        } else if (/credit|deposit|cr\b|salary|received from|refund|interest/i.test(combined)) {
          isCredit = true;
        } else {
          isCredit = item.amount > 0;
        }
      }
      const absPaise = Math.round(Math.abs(item.amount) * 100);
      const amountPaise = isCredit ? absPaise : -absPaise;

      const rawNarration = item.raw_narration || item.narration || "Statement Transaction";
      const cleanNarration = item.narration || normalizeNarration(rawNarration);
      const category = item.category || guessCategory(cleanNarration);
      const ref = item.ref || null;

      rows.push({
        account_id: accountId,
        date: item.date,
        amount_paise: amountPaise,
        raw_narration: rawNarration,
        clean_narration: cleanNarration,
        category,
        ref,
        type: "normal",
        flags: {},
        txn_hash: txnHash(accountId, item.date, amountPaise, ref, cleanNarration),
      });
    }

    if (rows.length > 0) {
      return { ok: true, rows, totalFound: rows.length };
    }
  }

  // Deterministic fallback
  if (isCsv) {
    const textContent = buffer.toString("utf8");
    const rows = parseCsvDeterministic(textContent, accountId);
    if (rows.length > 0) {
      return { ok: true, rows, totalFound: rows.length };
    }
  } else if (isPdf) {
    const rows = await parsePdfDeterministic(buffer, accountId);
    if (rows.length > 0) {
      return { ok: true, rows, totalFound: rows.length };
    }
  }

  return {
    ok: false,
    rows: [],
    totalFound: 0,
    message: "No valid transactions could be parsed from the provided document.",
  };
}
