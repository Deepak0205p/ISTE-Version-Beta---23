/**
 * AI-powered Statement Parser using Google Gemini
 * Replaces heuristic/regex based bank parsers for PDF and CSV files.
 */
import { normalizeNarration, txnHash } from "./ledgerHygiene.js";
import type { LedgerTxn } from "./types.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

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
 * Call Gemini 3.5 Flash Lite API directly with structured output
 */
async function callGeminiForStatement(
  parts: Array<Record<string, unknown>>
): Promise<ExtractedAiTxn[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "AQ.Ab8RN6J-sF1BtzwQ-AsK0lq1ET7uBX4JjTXQJGlkTjdoFAZxbw";
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts,
      },
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return [];
  }

  try {
    const cleaned = text.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed as ExtractedAiTxn[];
    }
    if (parsed && Array.isArray((parsed as { transactions?: ExtractedAiTxn[] }).transactions)) {
      return (parsed as { transactions: ExtractedAiTxn[] }).transactions;
    }
    return [];
  } catch (err) {
    console.error("Failed to parse Gemini output as JSON:", text, err);
    throw new Error("AI output was not valid JSON transactions.");
  }
}

/**
 * Parse a bank statement (PDF, CSV, or Text) directly using Gemini AI
 */
export async function parseStatementWithAi(
  buffer: Buffer,
  filename: string,
  accountId: string
): Promise<AiParseResult> {
  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith(".pdf");
  const isCsv = lower.endsWith(".csv") || lower.endsWith(".txt");

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
  } else if (isCsv) {
    const textContent = buffer.toString("utf8");
    parts = [
      {
        text: `Extract all transaction records from this bank statement data (${filename}) for account "${accountId}":\n\n${textContent}`,
      },
    ];
  } else {
    // Attempt text decode by default
    const textContent = buffer.toString("utf8");
    parts = [
      {
        text: `Extract all transaction records from this statement (${filename}):\n\n${textContent}`,
      },
    ];
  }

  const rawTxns = await callGeminiForStatement(parts);

  const rows: LedgerTxn[] = [];

  for (const item of rawTxns) {
    if (!item.date || typeof item.amount !== "number" || isNaN(item.amount)) {
      continue;
    }

    // Determine direction and signed paise
    const isCredit = item.type === "credit" || item.amount > 0;
    const absPaise = Math.round(Math.abs(item.amount) * 100);
    const amountPaise = isCredit ? absPaise : -absPaise;

    const rawNarration = item.raw_narration || item.narration || "Statement Transaction";
    const cleanNarration = item.narration || normalizeNarration(rawNarration);
    const category = item.category || "other";
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

  return {
    ok: true,
    rows,
    totalFound: rows.length,
  };
}
