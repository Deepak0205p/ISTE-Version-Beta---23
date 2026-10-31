/**
 * The LLM boundary (Build Bible §4, §11).
 *
 * Three jobs, all schema-constrained, temperature 0, JSON mode:
 *   Job 1  parse the user's question        → {item, price_inr, horizon}
 *   Job 2  parse a messy UPI narration      → {merchant, direction, category, confidence}
 *   Job 3  phrase a computed verdict        → sentence (numbers as strings)
 *
 * HARD RULES enforced here:
 *   - the LLM NEVER receives ledger data in Job 1 (question parser)
 *   - Job 2 receives redacted merchant substrings + amount bands only
 *     (no account numbers, no names, no full narrations with refs)
 *   - Job 3 receives the receipt numbers pre-formatted as STRINGS and is
 *     told, explicitly, not to recompute — arithmetic is not its job
 *   - validate → retry once → fall back; the pipeline never blocks on the LLM
 *
 * Providers: Gemini 2.5 Flash (default) or a local Ollama instance — same
 * JSON contract, base-URL swap only (offline insurance).
 */
import { categorize, redactForLlm, type CategorizeResult } from "@/lib/categorizer";
import type { Question, Verdict } from "@/lib/types";

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type LlmProvider = "gemini" | "ollama";

export function activeProvider(): LlmProvider {
  return process.env.LLM_PROVIDER === "ollama" ? "ollama" : "gemini";
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

/** temperature 0 + JSON mime type are frozen (Build Bible §11). */
const TEMPERATURE = 0;

type JsonSchema = Record<string, unknown>;

const QUESTION_SCHEMA: JsonSchema = {
  type: "object",
  required: ["item", "price_inr", "horizon"],
  properties: {
    item: { type: "string" },
    price_inr: { type: "number", minimum: 0 },
    horizon: { enum: ["next_month", "this_month", "custom_date"] },
    custom_date: { type: "string" },
  },
  additionalProperties: false,
};

const NARRATION_SCHEMA: JsonSchema = {
  type: "object",
  required: ["merchant", "direction", "category", "confidence"],
  properties: {
    merchant: { type: "string" },
    direction: { enum: ["debit", "credit"] },
    category: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  additionalProperties: false,
};

const PHRASE_SCHEMA: JsonSchema = {
  type: "object",
  required: ["sentence"],
  properties: {
    sentence: { type: "string" },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Transport: one JSON contract, two base URLs
// ---------------------------------------------------------------------------

async function callLlmJson(system: string, user: string, schema: JsonSchema): Promise<unknown> {
  const provider = activeProvider();
  const raw =
    provider === "ollama"
      ? await callOllama(system, user, schema)
      : await callGemini(system, user, schema);

  // validate against the schema's required keys; caller retries once
  const required = (schema.required as string[] | undefined) ?? [];
  if (typeof raw !== "object" || raw === null) {
    throw new Error("LLM response was not a JSON object");
  }
  for (const key of required) {
    if (!(key in raw)) throw new Error(`LLM response missing required key "${key}"`);
  }
  return raw;
}

async function callGemini(system: string, user: string, schema: JsonSchema): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey,
    ...(process.env.GEMINI_BASE_URL
      ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } }
      : {}),
  });

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: user,
    config: {
      systemInstruction: system,
      temperature: TEMPERATURE,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    },
  });

  const text = res.text ?? "";
  return JSON.parse(stripFences(text));
}

async function callOllama(system: string, user: string, schema: JsonSchema): Promise<unknown> {
  const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      temperature: TEMPERATURE,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", schema, strict: true },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return JSON.parse(stripFences(text));
}

function stripFences(text: string): string {
  const t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : t;
}

/** One retry, then the caller's fallback (never blocks the pipeline). */
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

// ---------------------------------------------------------------------------
// Job 1 — question parser (LLM never sees ledger data in this call)
// ---------------------------------------------------------------------------

const QUESTION_SYSTEM = `You convert a user's affordability question into JSON.
Rules:
- price_inr is the price in rupees as a plain number (20k, 20,000, ₹20000 and "20 thousand" all become 20000).
- horizon: "next_month" unless the user says this month, else "custom_date" (ISO) .
- item: a 1-4 word item description.
- Output JSON only. No prose. No arithmetic - extract the number, do not compute anything.`;

/**
 * Question → JSON. Falls back to a deterministic parser when the LLM is
 * unreachable or returns invalid JSON — offline-first by design.
 */
export async function parseQuestion(text: string): Promise<{
  question: Question;
  source: "llm" | "fallback";
}> {
  try {
    const raw = await withOneRetry(() => callLlmJson(QUESTION_SYSTEM, text, QUESTION_SCHEMA));
    const q = raw as Partial<Question>;
    if (typeof q.price_inr !== "number" || !q.item || !q.horizon) {
      throw new Error("invalid shape");
    }
    return {
      question: {
        item: String(q.item),
        price_inr: q.price_inr,
        horizon: q.horizon,
        ...(q.custom_date ? { custom_date: String(q.custom_date) } : {}),
      },
      source: "llm",
    };
  } catch {
    return { question: fallbackParseQuestion(text), source: "fallback" };
  }
}

/**
 * Deterministic regex fallback: extracts ₹ amounts with Indian number words.
 * Used when no API key / no Wi-Fi — the demo must still answer.
 */
export function fallbackParseQuestion(text: string): Question {
  const lower = text.toLowerCase();
  const item = extractItem(lower);
  const price = extractPrice(lower);
  const horizon: Question["horizon"] = lower.includes("this month") ? "this_month" : "next_month";
  return { item, price_inr: price, horizon };
}

function extractItem(lower: string): string {
  const stop = new Set([
    "can", "i", "afford", "a", "an", "the", "for", "next", "month", "this",
    "buy", "purchase", "of", "in", "rs", "inr", "₹", "price", "cost", "me", "on",
  ]);
  const words = lower
    .replace(/[₹,]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stop.has(w) && !/^\d/.test(w));
  return words.slice(0, 4).join(" ") || "purchase";
}

function extractPrice(lower: string): number {
  // 20k / 2.5k
  const k = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  // 1.5 lakh / 2 lakhs / 1 l
  const lakh = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  // plain number with ₹ or "price" nearby — strip commas first
  const plain = lower.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/);
  if (plain) return Math.round(parseFloat(plain[1].replace(/,/g, "")));
  const bare = lower.match(/(\d[\d,]*\.\d+|\d[\d,]*)/);
  if (bare) return Math.round(parseFloat(bare[1].replace(/,/g, "")));
  return 0;
}

// ---------------------------------------------------------------------------
// Job 2 — narration parser (redacted input only)
// ---------------------------------------------------------------------------

const NARRATION_SYSTEM = `You classify ONE bank-transaction merchant descriptor.
Input is already redacted: merchant tokens and an amount band only.
Output JSON: merchant (short brand name), direction (debit|credit), category
(one of: income, housing, utilities, groceries, dining, transport, shopping,
entertainment, health, insurance, emi, education, refunds, charges, cash,
transfer, uncategorized), confidence (0-1).
Use "uncategorized" with low confidence when unsure. Never invent numbers.`;

export async function parseNarration(
  narration: string,
  amountPaise: number,
  fallback?: Pick<LedgerTxnFallback, "clean_narration" | "amount_paise">,
): Promise<CategorizeResult> {
  const redacted = redactForLlm(fallback?.clean_narration ?? narration, amountPaise);

  try {
    const raw = await withOneRetry(() =>
      callLlmJson(
        NARRATION_SYSTEM,
        JSON.stringify(redacted), // account numbers/names never leave this box
        NARRATION_SCHEMA,
      ),
    );
    const r = raw as { merchant?: string; direction?: string; category?: string; confidence?: number };
    const confidence = typeof r.confidence === "number" ? r.confidence : 0.5;

    // below threshold → honest "uncategorized" rather than guessing
    if (confidence < 0.6 || !r.category) {
      return { category: "uncategorized", source: "llm", matched_on: redacted.merchant, confidence };
    }
    return {
      category: String(r.category),
      source: "llm",
      matched_on: redacted.merchant,
      confidence,
    };
  } catch {
    // fallback: the deterministic layers (dict/rules) already ran
    return categorize(fallback ?? { clean_narration: narration, amount_paise: amountPaise });
  }
}

type LedgerTxnFallback = { clean_narration: string; amount_paise: number };

// ---------------------------------------------------------------------------
// Job 3 — verdict phrasing (numbers arrive as STRINGS, never recomputed)
// ---------------------------------------------------------------------------

export type PhraseInput = {
  verdict: Verdict;
  reason: string;
  /** All pre-formatted, all from code — the LLM may not do arithmetic. */
  strings: {
    price: string;
    buffer: string;
    p10: string;
    p50: string;
    p90: string;
    shortfall_worst: string;
    shortfall_median: string;
    months: string;
  };
};

const PHRASE_SYSTEM = `You phrase a financial verdict as ONE plain sentence for a
non-expert user. You receive every number ALREADY FORMATTED as a string.
Rules:
- Never recompute, round, add, subtract or reinterpret any number.
- Never add numbers that are not in the input.
- For verdict REFUSED, use the provided reason verbatim.
- Keep it under 35 words. No markdown.`;

export async function phraseVerdict(input: PhraseInput): Promise<{
  sentence: string;
  source: "llm" | "fallback";
}> {
  if (input.verdict === "REFUSED") {
    return { sentence: input.reason, source: "fallback" };
  }

  try {
    const raw = await withOneRetry(() =>
      callLlmJson(PHRASE_SYSTEM, JSON.stringify(input), PHRASE_SCHEMA),
    );
    const sentence = (raw as { sentence?: string }).sentence;
    if (!sentence || typeof sentence !== "string") throw new Error("no sentence");
    return { sentence, source: "llm" };
  } catch {
    return { sentence: fallbackPhrase(input), source: "fallback" };
  }
}

/** Offline phrasing — mirrors the LLM template, still no arithmetic. */
export function fallbackPhrase(input: PhraseInput): string {
  const s = input.strings;
  switch (input.verdict) {
    case "YES":
      return `Yes — you can afford ₹${s.price}. Even the worst-case path (₹${s.p10}) clears the price plus a ₹${s.buffer} safety buffer.`;
    case "TIGHT":
      return `Tight — affordable on the median path (₹${s.p50}), but short by ₹${s.shortfall_worst} in the worst case. Delay or trim the buffer consciously.`;
    case "NO":
      return `No — the median path falls ₹${s.shortfall_median} short of ₹${s.price} plus the ₹${s.buffer} buffer. This purchase raises overdraft risk.`;
    default:
      return input.reason;
  }
}
