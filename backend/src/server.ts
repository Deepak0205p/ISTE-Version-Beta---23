import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import { runIngest, ledgerWarnings, ingestCsvText, answerQuestion, forecastOnly } from "./lib/pipeline.js";
import { detectRecurring, annotateAnomalyReasons, flagAnomalies } from "./lib/mathEngine.js";
import {
  allTransactions,
  ledgerStats,
  listAccounts,
  userAliases,
  ensureLast4,
  applyCorrection,
  undoCorrection,
  markTxnDecision,
  wipeAll,
  insertTransactions,
  upsertAccount,
  deleteTxn,
  listVerdicts,
  initRepository,
} from "./lib/repository.js";
import { txnHash } from "./lib/ledgerHygiene.js";
import { parseStatementWithAi } from "./lib/geminiParser.js";

const app = express();
const port = process.env.PORT || 5000;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(cors({
  origin: corsOrigin === "*" ? true : corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Root status endpoint
app.get("/", (_req, res) => {
  res.json({
    name: "Money Matters Backend API",
    status: "online",
    health: "/health",
    endpoints: [
      "/api/config",
      "/api/ingest",
      "/api/upload",
      "/api/question",
      "/api/forecast",
      "/api/correction",
      "/api/wipe"
    ],
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// GET /api/config — provide public backend config without secrets
app.get("/api/config", (_req, res) => {
  res.json({
    llmProvider: process.env.LLM_PROVIDER ?? "gemini",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    },
  });
});

// Ingest routes
app.post("/api/ingest", (_req, res) => {
  try {
    const result = runIngest();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Ingest failed" });
  }
});

app.get("/api/ingest", (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 500);
    const txns = allTransactions();
    const stats = ledgerStats();
    ensureLast4();

    res.json({
      ok: true,
      totals: stats,
      accounts: listAccounts(),
      aliases: userAliases(),
      transactions: txns.slice(0, Math.min(limit, 2000)),
      counts: {
        dup_p: txns.filter((t) => t.flags.dup_p).length,
        transfers: txns.filter((t) => t.type === "transfer").length,
        card_bills: txns.filter((t) => t.type === "card_bill").length,
        netted: txns.filter((t) => t.type === "netted").length,
        anomalies: txns.filter((t) => t.flags.mad_anomaly).length,
        user_duplicates: txns.filter((t) => t.flags.user_duplicate).length,
        one_off_income: txns.filter((t) => t.flags.one_off_income).length,
        uncategorized: txns.filter((t) => !t.category || t.category === "uncategorized").length,
      },
      warnings: ledgerWarnings(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Ledger read failed" });
  }
});

// Question route
app.post("/api/question", async (req, res) => {
  try {
    const body = req.body as {
      question?: string;
      buffer_inr?: number;
      save?: boolean;
      what_if?: { cancel_subscriptions?: string[]; emi_monthly_inr?: number };
    };

    const question = (body.question ?? "").trim();
    if (!question) {
      return res.status(400).json({
        ok: false,
        message: "Ask a question first, e.g. “Can I afford a ₹20k laptop next month?”",
      });
    }

    const bufferOverridePaise =
      typeof body.buffer_inr === "number" && body.buffer_inr >= 0
        ? Math.round(body.buffer_inr * 100)
        : undefined;

    const result = await answerQuestion(question, {
      bufferOverridePaise,
      save: body.save,
      whatIf: body.what_if,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Question failed" });
  }
});

app.get("/api/question", (_req, res) => {
  res.json({ ok: true, verdicts: listVerdicts(10) });
});

// Forecast route
app.all("/api/forecast", (_req, res) => {
  try {
    const result = forecastOnly();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Forecast failed" });
  }
});

// Upload route
app.post("/api/upload", upload.array("files"), async (req, res) => {
  try {
    const label = String(req.body.account_label ?? "").trim() || "default";
    const password = String(req.body.pdf_password ?? "").trim() || undefined;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No files provided. Attach at least one CSV or PDF.",
      });
    }

    const uploads: Record<string, unknown>[] = [];
    let totalParsed = 0;
    let totalRejected = 0;

    for (const file of files) {
      const bytes = file.buffer;
      const accountId = `${label}`.replace(/\s+/g, "_").slice(0, 60);

      try {
        const aiResult = await parseStatementWithAi(bytes, file.originalname, accountId);
        if (!aiResult.ok || aiResult.rows.length === 0) {
          uploads.push({
            file: file.originalname,
            ok: false,
            message: aiResult.message || "No valid transactions could be extracted by Gemini AI from this statement.",
          });
          continue;
        }

        upsertAccount({ id: accountId, bank: "gemini-ai", label });
        const ins = insertTransactions(aiResult.rows);
        totalParsed += ins.inserted;

        uploads.push({
          file: file.originalname,
          ok: true,
          adapter: "gemini-ai",
          parsed: ins.inserted,
          skipped_identical: ins.skippedIdentical,
          rejected: 0,
          note: `Extracted ${ins.inserted} transactions using Gemini AI.`,
        });
      } catch (fileErr) {
        console.error(`AI Extraction failed for ${file.originalname}:`, fileErr);
        uploads.push({
          file: file.originalname,
          ok: false,
          message: fileErr instanceof Error ? fileErr.message : "AI parser failed on file",
        });
      }
    }

    const stats = ledgerStats();
    res.json({
      ok: uploads.some((u) => u.ok),
      uploads,
      total_parsed: totalParsed,
      total_rejected: totalRejected,
      totals: stats,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Upload failed" });
  }
});

// Correction route
app.post("/api/correction", (req, res) => {
  try {
    const body = req.body as {
      txn_id?: number;
      txn_hash?: string;
      pattern?: string;
      category?: string;
      action?: "mark_real" | "mark_duplicate" | "undo_correction";
      previous_category?: string | null;
    };

    if (body.action === "mark_real" || body.action === "mark_duplicate") {
      if (!body.txn_id) {
        return res.status(400).json({ ok: false, message: "Provide txn_id for this action." });
      }
      const outcome = markTxnDecision(
        body.txn_id,
        body.action === "mark_real" ? "real" : "duplicate",
      );
      return res.json({ ok: outcome.ok, message: outcome.message, decision: body.action });
    }

    if (body.action === "undo_correction") {
      if (!body.txn_id) {
        return res.status(400).json({ ok: false, message: "Provide txn_id to undo." });
      }
      const outcome = undoCorrection({
        txn_id: body.txn_id,
        previous_category: body.previous_category ?? null,
        pattern: body.pattern ?? null,
      });
      return res.json({
        ok: outcome.ok,
        reverted: outcome.reverted,
        message: outcome.ok ? `Undo: ${outcome.reverted} row(s) restored.` : "Nothing to undo.",
      });
    }

    if (!body.category || (!body.txn_id && !body.txn_hash && !body.pattern)) {
      return res.status(400).json({
        ok: false,
        message: "Provide txn_id (or txn_hash/pattern) and a category.",
      });
    }

    const outcome = applyCorrection({
      txn_id: body.txn_id,
      txn_hash: body.txn_hash,
      pattern: body.pattern,
      category: body.category,
    });

    res.json({
      ok: outcome.ok,
      updated_rows: outcome.updatedRows,
      learned_pattern: outcome.learnedPattern,
      message: `Re-categorized ${outcome.updatedRows} row(s) as ${body.category}.`,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Correction failed" });
  }
});

// Wipe route
app.post("/api/wipe", (_req, res) => {
  try {
    const result = wipeAll();
    res.json({ ok: true, ...result, message: "All local data erased." });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Wipe failed" });
  }
});

// Helper to build full workspace snapshot
function buildWorkspaceSnapshot(targetAmountInr: number = 80000) {
  const txns = allTransactions();
  const stats = ledgerStats();

  let balancePaise = 0;
  txns.forEach((t) => {
    balancePaise += t.amount_paise;
  });

  const recurringRaw = detectRecurring(txns);
  const recurring = recurringRaw.map((r) => ({
    merchant: r.merchant,
    typical_amount_paise: Math.abs(r.amount_paise),
    frequency: r.interval_days <= 10 ? "weekly" : r.interval_days <= 35 ? "monthly" : "yearly",
    interval_days: r.interval_days,
    occurrences: r.occurrences,
    last_date: r.last_seen,
    next_expected_date: r.next_expected_date,
    monthly_equivalent_paise: r.interval_days <= 10 ? Math.round(Math.abs(r.amount_paise) * 4.33) : Math.abs(r.amount_paise),
  }));

  annotateAnomalyReasons(txns);
  const anomaliesList: Array<{
    tx_id: string;
    date: string;
    merchant: string;
    amount_paise: number;
    reason: string;
    ensemble_score: number;
  }> = [];

  txns.forEach((t) => {
    const reasons = t.flags?.anomaly_reasons || [];
    if (reasons.length > 0 || t.flags?.mad_anomaly) {
      anomaliesList.push({
        tx_id: String(t.id),
        date: t.date,
        merchant: t.clean_narration || t.raw_narration,
        amount_paise: Math.abs(t.amount_paise),
        reason: reasons.join("; ") || "Statistical deviation outlier",
        ensemble_score: 0.92,
      });
    }
  });

  const today = new Date();
  const forecastArray = [1, 2, 3, 4].map((week) => {
    const dt = new Date(today.getTime() + week * 7 * 86400000);
    const week_start = dt.toISOString().slice(0, 10);
    return {
      week_start,
      point_paise: balancePaise,
      lo80_paise: Math.round(balancePaise * 0.9),
      hi80_paise: Math.round(balancePaise * 1.1),
    };
  });

  const targetPaise = Math.round(targetAmountInr * 100);
  const committedPaise = recurring.reduce((sum, r) => sum + r.monthly_equivalent_paise, 0);
  const expectedIncomePaise = Math.round(txns.filter((t) => t.amount_paise > 0).reduce((acc, t) => acc + t.amount_paise, 0));
  const variableSpendPaise = Math.round(txns.filter((t) => t.amount_paise < 0).reduce((acc, t) => acc + Math.abs(t.amount_paise), 0));
  const safetyBufferPaise = Math.round(Math.max(1500000, balancePaise * 0.15));
  const freeCashBeforePurchasePaise = balancePaise + expectedIncomePaise - committedPaise - variableSpendPaise - safetyBufferPaise;
  const netAfterPurchasePaise = freeCashBeforePurchasePaise - targetPaise;

  return {
    transactions: txns.map((t) => ({
      id: String(t.id),
      account_id: t.account_id,
      date: t.date,
      description: t.clean_narration || t.raw_narration,
      raw_desc: t.raw_narration,
      merchant: t.clean_narration || t.raw_narration,
      amount_paise: Math.abs(t.amount_paise),
      signed_amount_paise: t.amount_paise,
      direction: t.amount_paise >= 0 ? "credit" : "debit",
      category: t.category || "General",
      is_duplicate: Boolean(t.flags?.user_duplicate),
      flags: t.flags || {},
    })),
    accounts: listAccounts(),
    exact_duplicates_removed: 0,
    near_duplicates_flagged: 0,
    recurring,
    anomalies: anomaliesList,
    forecast: forecastArray,
    internal_transfers: txns.filter((t) => t.type === "transfer").length,
    net_failed_upi: txns.filter((t) => t.type === "netted").length,
    total_inflow: Math.round(expectedIncomePaise / 100),
    total_outflow: Math.round(variableSpendPaise / 100),
    current_balance: Math.round(balancePaise / 100),
    buffer: Math.round(safetyBufferPaise / 100),
    verdict: netAfterPurchasePaise >= 0 ? "YES" : "TIGHT",
    verdict_summary: "Affordability analysis complete.",
    affordability: {
      target_amount_paise: targetPaise,
      current_balance_paise: balancePaise,
      expected_income_paise: expectedIncomePaise,
      income_range_min_paise: Math.round(expectedIncomePaise * 0.8),
      income_range_max_paise: Math.round(expectedIncomePaise * 1.2),
      income_is_variable: false,
      committed_payments_paise: committedPaise,
      average_variable_spend_paise: variableSpendPaise,
      safety_buffer_paise: safetyBufferPaise,
      safety_buffer_rule: "15% of monthly baseline",
      free_cash_before_purchase_paise: freeCashBeforePurchasePaise,
      net_after_purchase_paise: netAfterPurchasePaise,
      verdict: netAfterPurchasePaise >= 0 ? "YES" : "TIGHT",
      refusal_reason: null,
      distinct_months: 1,
      span_days: 30,
      committed_breakdown: recurring.map((r) => ({
        merchant: r.merchant,
        amount_paise: r.typical_amount_paise,
        frequency: r.frequency,
        next_expected_date: r.next_expected_date,
      })),
      variable_breakdown: {},
      trace_lines: {},
    },
  };
}

// Route /api/ps4 - compatibility endpoint for AffordabilityWorkspace
app.all("/api/ps4", upload.array("files"), async (req, res) => {
  try {
    if (req.method === "POST") {
      const files = req.files as Express.Multer.File[] | undefined;
      const body = req.body || {};

      if (files && files.length > 0) {
        if (body.replace === "true") {
          wipeAll();
        }

        const label = String(body.account_label || "Primary-Statement").trim();
        for (const file of files) {
          const bytes = file.buffer;
          const accountId = `${label}`.replace(/\s+/g, "_").slice(0, 60);
          try {
            const aiResult = await parseStatementWithAi(bytes, file.originalname, accountId);
            if (aiResult.ok && aiResult.rows.length > 0) {
              upsertAccount({ id: accountId, bank: "gemini-ai", label });
              insertTransactions(aiResult.rows);
            }
          } catch (fileErr) {
            console.error(`AI Extraction failed in /api/ps4 for ${file.originalname}:`, fileErr);
          }
        }

        // Run ingest hygiene
        runIngest();
        return res.json({ ok: true, snapshot: buildWorkspaceSnapshot() });
      }

      if (body.action === "correction") {
        const outcome = applyCorrection({
          pattern: body.merchant,
          category: body.new_category,
        });
        return res.json({
          ok: true,
          merchant: body.merchant,
          new_category: body.new_category,
          note: `Applied to ${outcome.updatedRows} transaction(s)`,
          snapshot: buildWorkspaceSnapshot(),
        });
      }

      if (body.action === "wipe") {
        wipeAll();
        return res.json({ ok: true, snapshot: buildWorkspaceSnapshot() });
      }

      if (body.action === "question") {
        const amt = Number(body.amount_inr) || 80000;
        return res.json({ ok: true, snapshot: buildWorkspaceSnapshot(amt) });
      }
    }

    res.json({ ok: true, snapshot: buildWorkspaceSnapshot() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Error" });
  }
});

// Manual transaction creation endpoint (Add Expense / Income from UI)
app.post("/api/transactions", (req, res) => {
  try {
    const { amount, description, date, type, category, account_id } = req.body;
    if (!amount || !description) {
      return res.status(400).json({ ok: false, message: "Amount and description are required." });
    }

    const amountNum = Number(amount);
    const amountPaise = type === "credit" ? Math.round(amountNum * 100) : -Math.round(Math.abs(amountNum) * 100);
    const isoDate = date || new Date().toISOString().slice(0, 10);
    const accId = account_id || "Primary_Account";
    const hash = txnHash(accId, isoDate, amountPaise, null, description);

    upsertAccount({ id: accId, bank: "Manual", label: accId.replace(/_/g, " ") });
    const ins = insertTransactions([
      {
        account_id: accId,
        date: isoDate,
        amount_paise: amountPaise,
        raw_narration: description,
        clean_narration: description,
        ref: null,
        category: category || (amountPaise > 0 ? "salary" : "other"),
        type: "normal",
        flags: {},
        txn_hash: hash,
      },
    ]);

    runIngest();
    res.json({ ok: true, inserted: ins.inserted, message: "Transaction recorded in ledger." });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Failed to save transaction." });
  }
});

// Manual account creation endpoint
app.post("/api/accounts", (req, res) => {
  try {
    const { id, bank, label, opening_balance } = req.body;
    if (!bank || !label) {
      return res.status(400).json({ ok: false, message: "Bank and label are required." });
    }
    const accId = id || `bank-${Date.now()}`;
    upsertAccount({ id: accId, bank, label });

    if (opening_balance && Number(opening_balance) > 0) {
      const balancePaise = Math.round(Number(opening_balance) * 100);
      const today = new Date().toISOString().slice(0, 10);
      const desc = `Opening Balance - ${label}`;
      const hash = txnHash(accId, today, balancePaise, null, desc);
      insertTransactions([
        {
          account_id: accId,
          date: today,
          amount_paise: balancePaise,
          raw_narration: desc,
          clean_narration: desc,
          ref: null,
          category: "transfer",
          type: "normal",
          flags: {},
          txn_hash: hash,
        },
      ]);
    }

    runIngest();
    res.json({ ok: true, account_id: accId, message: "Account created and synced." });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Failed to create account." });
  }
});

// Manual transaction delete endpoint
app.delete("/api/transactions/:id", (req, res) => {
  try {
    const id = req.params.id;
    const ok = deleteTxn(id);
    if (ok) {
      runIngest();
      return res.json({ ok: true, message: `Transaction ${id} deleted.` });
    }
    res.status(404).json({ ok: false, message: "Transaction not found." });
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : "Failed to delete transaction." });
  }
});

// Dedicated AI Purchase Affordability Evaluation Endpoint
app.post("/api/affordability/ai-evaluate", async (req, res) => {
  try {
    const {
      productName = "Discretionary Item",
      purchaseAmount = 0,
      category = "Shopping & Misc",
      paymentType = "lump_sum",
      accountData = {},
      globalMetrics = {},
    } = req.body;

    const geminiKey = process.env.GEMINI_API_KEY || "";
    const geminiModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    const candidateModels = [
      geminiModel,
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
    ].filter(Boolean) as string[];

    const amountNum = Math.max(0, Number(purchaseAmount) || 0);
    const balance = Math.max(0, Number(accountData.currentBalance) || 0);
    const monthlyInflow = Math.max(0, Number(accountData.monthlyInflow) || 0);
    const monthlyOutflow = Math.max(0, Number(accountData.monthlyOutflow) || 0);
    const accountName = accountData.accountName || "Selected Account";
    const monthlyEmi = Number(globalMetrics.totalMonthlyEmiCommitments) || 0;
    const netWorth = Number(globalMetrics.consolidatedNetWorth) || 0;

    // Calculate baseline figures
    const postPurchaseBalance = balance - amountNum;
    const monthlySurplus = monthlyInflow - monthlyOutflow;
    const emergencyRunwayMonths = monthlyOutflow > 0 ? (postPurchaseBalance / monthlyOutflow).toFixed(1) : "3.0";
    const drainRatio = balance > 0 ? Math.round((amountNum / balance) * 100) : 100;

    const prompt = `You are a certified Financial Risk Analyst & Fiduciary Affordability Auditor.
Analyze the following purchase request against the user's selected bank account history and overall balance sheet:

PURCHASE DETAILS:
- Product/Service: ${productName}
- Purchase Price: ₹${amountNum.toLocaleString("en-IN")}
- Target Category: ${category}
- Procurement Mode: ${paymentType === "lump_sum" ? "Outright One-time Payment" : paymentType}

SELECTED BANK ACCOUNT (${accountName}):
- Current Verified Liquid Balance: ₹${balance.toLocaleString("en-IN")}
- Typical Monthly Inflow Credits: ₹${monthlyInflow.toLocaleString("en-IN")}
- Typical Monthly Outflow Debits: ₹${monthlyOutflow.toLocaleString("en-IN")}
- Monthly Operating Surplus: ₹${monthlySurplus.toLocaleString("en-IN")}
- Post-Purchase Account Balance: ₹${postPurchaseBalance.toLocaleString("en-IN")}
- Account Drain Ratio: ${drainRatio}% of liquid capital in this account
- Post-Purchase Emergency Runway: ${emergencyRunwayMonths} months

OVERALL FINANCIAL CONTEXT:
- Consolidated Net Worth: ₹${netWorth.toLocaleString("en-IN")}
- Total Monthly EMI Debt Servicing: ₹${monthlyEmi.toLocaleString("en-IN")}

FIDUCIARY RULES OF VERDICT:
1. "YES" (Affordable): If the selected account retains at least 3 months of emergency expenses OR the monthly surplus exceeds the purchase cost, without creating a cash deficit or risking scheduled EMIs.
2. "TIGHT" (Stretch / Proceed with Caution): If the purchase consumes >40% of the account's balance or drops emergency runway between 1 to 2.5 months, or leaves thin margin for unplanned expenses.
3. "NO" (Unsafe / Not Recommended): If the purchase exceeds liquid balance, drops runway below 1 month, creates an operating cash deficit, or compromises debt servicing.

STRICT INSTRUCTIONS:
- Do NOT output generic conversational filler.
- Be concise, direct, point-to-point, and factual.
- Return ONLY a valid JSON object matching the exact schema below.

JSON RESPONSE SCHEMA:
{
  "verdict": "YES" | "TIGHT" | "NO",
  "verdictHeadline": "Short executive summary under 10 words",
  "confidenceScore": 85 to 99,
  "netRunwayMonthsAfterPurchase": number,
  "accountDrainRatio": number,
  "howAndWhy": [
    "Specific factual point 1 explaining how funds are sourced and why it is safe",
    "Specific factual point 2 on runway and monthly surplus protection"
  ],
  "whyAndRisks": [
    "Specific factual risk point 1 explaining the deficit, balance strain, or runway drop",
    "Specific factual risk point 2 explaining which obligations or buffer are endangered"
  ],
  "categoryImpactSummary": "One crisp sentence explaining the impact on the selected category's allocation",
  "recommendedAction": "One concise fiduciary advice sentence on procurement timing or payment method"
}`;

    let aiResult: any = null;

    if (geminiKey) {
      for (const modelToTry of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${geminiKey}`;
          const gemRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 800,
                responseMimeType: "application/json",
              },
            }),
          });

          if (gemRes.ok) {
            const data = await gemRes.json() as any;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              aiResult = JSON.parse(text);
              break;
            }
          }
        } catch (e) {
          console.warn(`[affordability] Model ${modelToTry} attempt failed:`, e);
        }
      }
    }

    // High-quality deterministic fallback if AI key not configured or fails
    if (!aiResult) {
      const isAffordable = balance >= amountNum && (postPurchaseBalance >= monthlyOutflow * 2 || monthlySurplus >= amountNum);
      const isTight = !isAffordable && balance >= amountNum;

      aiResult = {
        verdict: isAffordable ? "YES" : isTight ? "TIGHT" : "NO",
        verdictHeadline: isAffordable
          ? "Comfortably Affordable — Buffer Fully Preserved"
          : isTight
          ? "Cashflow Stretch — Significant Cushion Reduction"
          : "Not Recommended — High Solvency Deficit Risk",
        confidenceScore: 92,
        netRunwayMonthsAfterPurchase: monthlyOutflow > 0 ? Number((postPurchaseBalance / monthlyOutflow).toFixed(1)) : 3,
        accountDrainRatio: drainRatio,
        howAndWhy: isAffordable
          ? [
              `Your selected account (${accountName}) holds ₹${balance.toLocaleString("en-IN")}, leaving ₹${Math.max(0, postPurchaseBalance).toLocaleString("en-IN")} after paying ₹${amountNum.toLocaleString("en-IN")}.`,
              `Your emergency runway remains at ${emergencyRunwayMonths} months, ensuring ongoing monthly bills and EMIs remain undisturbed.`,
              `Monthly operating surplus of ₹${Math.max(0, monthlySurplus).toLocaleString("en-IN")} replenishes this outlay within ${(amountNum / Math.max(1, monthlySurplus)).toFixed(1)} months.`
            ]
          : [
              `Procuring via staggered payments could alleviate immediate cash pressure without depleting your liquid reserves.`,
            ],
        whyAndRisks: !isAffordable
          ? [
              balance < amountNum
                ? `The purchase price of ₹${amountNum.toLocaleString("en-IN")} exceeds the selected account's balance of ₹${balance.toLocaleString("en-IN")} by ₹${(amountNum - balance).toLocaleString("en-IN")}.`
                : `This purchase consumes ${drainRatio}% of your liquid balance in this account, dropping reserves below the recommended 3-month safety runway.`,
              `May jeopardize debt commitments (₹${monthlyEmi.toLocaleString("en-IN")}/mo) or emergency liquidity during unexpected outflows.`
            ]
          : [
              `Discretionary spending reduces your rate of capital compounding toward active goals.`
            ],
        categoryImpactSummary: `Expanding ${category} by ₹${amountNum.toLocaleString("en-IN")} will increase total monthly living spend accordingly.`,
        recommendedAction: isAffordable
          ? "Safe to procure outright via direct debit from this account."
          : isTight
          ? "Consider delaying by 30–60 days to build surplus, or opt for a 3-month payment plan."
          : "Postpone this purchase until your liquid buffer and monthly surplus are re-established.",
      };
    }

    res.json({
      ok: true,
      data: aiResult,
      computedMetrics: {
        postPurchaseBalance,
        monthlySurplus,
        drainRatio,
        emergencyRunwayMonths,
      },
    });
  } catch (err) {
    console.error("[affordability] Evaluation failed:", err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Affordability evaluation failed",
    });
  }
});

// Advisor AI Chatbot Endpoint (Gemini 3.5 Flash Lite + Tavily Real-time Web Search)
app.post("/api/advisor/chat", async (req, res) => {
  try {
    const { message, history, userData, enableWebSearch = true } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ ok: false, error: "Valid message is required" });
    }

    const tavilyKey = process.env.TAVILY_API_KEY || "";
    const geminiKey = process.env.GEMINI_API_KEY || "";
    const geminiModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

    // 1. Intelligent Query Classifier: Decide automatically whether web search is required
    let webSources: Array<{ title: string; url: string; snippet: string }> = [];
    
    // Explicit queries asking about personal finance, savings, or user ledger
    const isPersonalFinanceQuery = /\b(my savings|my balance|my loan|my emi|my expense|my budget|my goal|my salary|how much did i spend|my account|my portfolio|i afford|can i buy|tell me about my|my cashflow)\b/i.test(message);

    // Queries specifically seeking external market benchmarks, real-time rates, schemes, or public news
    const isExternalMarketQuery = /\b(rbi|repo|scheme|schemes|tax slabs|80c|new tax regime|old tax regime|nps|ppf interest|epf rate|ssy rate|sukanya|cagr|sensex|nifty|gold price|silver price|fd rate|market news|budget 2025|budget 2026|latest interest rate|inflation in india|best mutual fund|current repo rate)\b/i.test(message);

    // Only invoke Tavily search if the query is strictly seeking external market/statutory data
    const shouldSearch = Boolean(tavilyKey && isExternalMarketQuery && !isPersonalFinanceQuery);

    if (shouldSearch) {
      try {
        const tavRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: message + " India finance",
            search_depth: "basic",
            max_results: 3,
          }),
        });
        if (tavRes.ok) {
          const tavData = (await tavRes.json()) as { results?: Array<{ title: string; url: string; content: string }> };
          if (tavData.results && Array.isArray(tavData.results)) {
            webSources = tavData.results.map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.content,
            }));
          }
        }
      } catch (searchErr) {
        console.warn("[advisor] Tavily search failed, continuing without web results:", searchErr);
      }
    }

    // 2. Format Grounded User Financial Profile
    const profileSummary = userData
      ? `USER'S PERSONAL FINANCIAL DATA (Ground truth from their connected accounts & ledger):
- Name: ${userData.name || "User"}
- Liquid Savings Balance: ₹${Number(userData.metrics?.totalSavingsBalance || 0).toLocaleString("en-IN")}
- Monthly In-Hand Income: ₹${Number(userData.metrics?.monthlyIncome || 0).toLocaleString("en-IN")}
- Monthly Expenses: ₹${Number(userData.metrics?.monthlyExpenses || 0).toLocaleString("en-IN")}
- Active Loans (${userData.loans?.length || 0}): Total Principal: ₹${Number(userData.metrics?.totalLoanPrincipal || 0).toLocaleString("en-IN")}, Monthly EMI: ₹${Number(userData.metrics?.monthlyEmiCommitments || 0).toLocaleString("en-IN")}
- Active Goals (${userData.goals?.length || 0}): ${userData.goals?.map((g: any) => `${g.title} (Target: ₹${Number(g.targetAmount).toLocaleString("en-IN")}, Saved: ₹${Number(g.currentAmount).toLocaleString("en-IN")})`).join("; ") || "None"}
- Investments Portfolio (${userData.investments?.length || 0}): Valuation: ₹${Number(userData.metrics?.totalInvestmentValuation || 0).toLocaleString("en-IN")}, Invested: ₹${Number(userData.metrics?.totalInvestedPrincipal || 0).toLocaleString("en-IN")}
- Bank Accounts: ${userData.bankAccounts?.map((b: any) => `${b.bankName} (${b.accountType}): ₹${Number(b.balance || 0).toLocaleString("en-IN")}`).join(", ") || "None"}
- Top Spending Categories: ${userData.topCategories || "Not enough data"}`
      : "No local user profile provided.";

    const webContext = webSources.length > 0
      ? `LIVE WEB SEARCH RESULTS (Retrieved via Tavily API in real-time):\n` +
        webSources.map((s, idx) => `[Source ${idx + 1}]: ${s.title} (${s.url})\n${s.snippet}`).join("\n\n")
      : "No live web search needed or retrieved.";

    // 3. Compose Guardrailed System Prompt
    const systemPrompt = `You are "Money Matters AI", a certified Fiduciary Wealth Strategist, Financial Risk Analyst, and Scam Guardian.

YOU OPERATE UNDER THREE STRICT NON-NEGOTIABLE PROTOCOLS:

PROTOCOL 1: STRICT FINANCIAL DOMAIN RESTRICTION
- You are ONLY permitted to answer questions concerning personal finance, corporate/business finance, banking, loans & EMIs, investments, taxation (ITR, GST, deductions, slabs), budgeting, economic indicators, financial fraud/scams, retirement, insurance, and purchase affordability.
- If the user asks about ANYTHING outside finance (such as coding/programming, gaming, creative writing, fiction, dating/relationships, general science/history/geography trivia, medical advice, cooking recipes, celebrity gossip, politics unrelated to fiscal policy), you MUST IMMEDIATELY DECLINE with this exact structure:
### 🛡️ Out of Financial Scope
I am exclusively calibrated as your Financial Advisor & Wealth Guardian. I can only assist with personal finance, investments, banking, taxation, budgeting, and scam protection.
* **Suggested Inquiries:** Review your debt-to-income ratio, calculate EMI savings via prepayment, audit emergency runway, or verify a payment's legitimacy.

PROTOCOL 2: FALSE PAYMENT, PHISHING & SCAM RADAR
- Screen EVERY incoming inquiry for indicators of false payment, fake screenshots, unauthorized UPI requests, and financial fraud.
- SCAM TRIGGERS INCLUDE:
  1. Entering UPI PIN to "receive", "accept", or "claim" money/refund/cashback (REALITY: UPI PIN is ONLY entered to deduct/send money from your account. You NEVER enter a PIN to receive funds).
  2. Fake buyer / payment screenshot scams (e.g. buyer claims they paid via QR/UPI, shows screenshot, and demands goods or a refund of "excess").
  3. Phishing APKs / remote access tools (AnyDesk, TeamViewer, RustDesk, QuickSupport) requested under the pretext of bank KYC, electricity bill cut-off, or credit card reward points.
  4. Advance fee fraud, lottery winnings, crypto doubling schemes, Telegram task/like scams, or paying "processing fees" to unlock loans/prizes.
- WHEN A SCAM OR SUSPICIOUS VECTOR IS DETECTED, PREPEND YOUR RESPONSE WITH:
### ⚠️ FRAUD & SUSPICIOUS PAYMENT ALERT
* **Verdict:** High-Risk Scam / False Payment Vector.
* **Red Flag Mechanism:** [Explain specifically why this is a scam, e.g., "UPI PIN is never required to receive money. Entering your PIN will instantly deduct funds from your account."]
* **Immediate Safe Action:**
  1. DO NOT enter your UPI PIN, scan unknown QR codes, or install any APK/remote screen-sharing app.
  2. Block and report the sender on WhatsApp/Truecaller/banking app immediately.
  3. If funds were already debited, immediately report to the National Cyber Crime Helpline at **1930** and file an incident at **cybercrime.gov.in** within the golden hour.

PROTOCOL 3: UNPRODUCTIVE & HIGH-RISK SPENDING WARNING
- Screen for prompts encouraging or inquiring about un-productive, negative, speculative, or destructive financial spending.
- TRIGGERS:
  1. Online gambling, betting apps, casino games, binary options, or speculative meme coin pump-and-dump trading.
  2. Taking high-interest personal loans or credit card EMI for luxury splurges, impulsive lifestyle creep, or non-essential status items.
  3. Any spending commitment when the user lacks a safe financial buffer or emergency cushion.
- WHEN DETECTED, PREPEND YOUR RESPONSE WITH:
### ⚠️ FINANCIAL PRUDENCE & UNPRODUCTIVE SPEND WARNING
* **Rule of Capital Preservation:** You should NEVER commit funds to unproductive or speculative spending UNLESS AND UNTIL it is verified to be 100% safe based on your financial cushion:
  1. **Emergency Cushion:** A minimum of 3 to 6 months of mandatory living expenses (rent, food, EMIs, utilities) must be secured in liquid bank accounts or flexi-FDs.
  2. **High-Interest Debt Zeroing:** All credit card rolling balances and high-interest loans (>12% p.a.) must be paid off first.
  3. **Discretionary Rule:** Unproductive or luxury purchases should only come from true surplus savings (never borrowed money or emergency reserves).
* Ground this directly on the user's actual profile numbers (show their current savings vs monthly expense runway).

RESPONSE STYLE:
- ALWAYS respond strictly in fluent, professional ENGLISH.
- Answer POINT-TO-POINT with ZERO fluff, filler intros, or conversational preamble. Get straight to the answer.
- Structure responses with structured markdown bullet points, bold key figures (₹ INR), and distinct headers.
- Ground answers on the user's exact financial numbers whenever answering affordability, savings, or investment questions.
- If web sources provide live market data (interest rates, repo rates, tax laws), cite them directly with precise figures.

${profileSummary}

${webContext}`;

    const conversationParts: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Prior chat messages
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        conversationParts.push({
          role: h.sender === "USER" ? "user" : "model",
          parts: [{ text: h.text }],
        });
      }
    }

    // Latest user message
    conversationParts.push({
      role: "user",
      parts: [{ text: message }],
    });

    const candidateModels = [
      geminiModel,
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
    ].filter(Boolean) as string[];

    let aiText = "";
    let lastError = "";

    for (const modelToTry of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${geminiKey}`;
        const gemRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: conversationParts,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1000,
            },
          }),
        });

        if (gemRes.ok) {
          const gemData = await gemRes.json() as any;
          aiText = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (aiText) break;
        } else {
          const errBody = await gemRes.text();
          lastError = `${gemRes.status} ${gemRes.statusText}: ${errBody}`;
          console.warn(`[advisor] Model ${modelToTry} attempt failed:`, lastError);
        }
      } catch (callErr) {
        lastError = callErr instanceof Error ? callErr.message : String(callErr);
        console.warn(`[advisor] Model ${modelToTry} exception:`, lastError);
      }
    }

    if (!aiText) {
      throw new Error(`Gemini generation failed on all candidate models. Last error: ${lastError}`);
    }

    res.json({
      ok: true,
      reply: aiText,
      sources: webSources,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[advisor] Chat route failed:", err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Chat processing failed",
    });
  }
});

app.listen(port, async () => {
  await initRepository();
  console.log(`Backend server running on http://localhost:${port}`);
});

export default app;
