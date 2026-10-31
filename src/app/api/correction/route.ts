/**
 * POST /api/correction — the correction loop, the P-class dialog, and Undo.
 *
 *   { txn_id, category }                        relabel + learn alias (propagates)
 *   { action: "undo_correction", txn_id, ... }  revert a relabel, drop the alias
 *   { txn_id, action: "mark_real" }             "Mark as Real" for anomalies
 *   { txn_id, action: "mark_duplicate" }        confirmed duplicate (kept, excluded)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  applyCorrection,
  undoCorrection,
  markTxnDecision,
  allAliases,
} from "@/lib/repository";
import { CATEGORY_OPTIONS } from "@/lib/categorizer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      txn_id?: number;
      txn_hash?: string;
      pattern?: string;
      category?: string;
      action?: "mark_real" | "mark_duplicate" | "undo_correction";
      previous_category?: string | null;
    };

    // --- anomaly / duplicate decisions -----------------------------------
    if (body.action === "mark_real" || body.action === "mark_duplicate") {
      if (!body.txn_id) {
        return NextResponse.json(
          { ok: false, message: "Provide txn_id for this action." },
          { status: 400 },
        );
      }
      const res = markTxnDecision(
        body.txn_id,
        body.action === "mark_real" ? "real" : "duplicate",
      );
      return NextResponse.json({ ok: res.ok, message: res.message, decision: body.action });
    }

    // --- undo a previous correction --------------------------------------
    if (body.action === "undo_correction") {
      if (!body.txn_id) {
        return NextResponse.json(
          { ok: false, message: "Provide txn_id to undo." },
          { status: 400 },
        );
      }
      const res = undoCorrection({
        txn_id: body.txn_id,
        previous_category: body.previous_category ?? null,
        pattern: body.pattern ?? null,
      });
      return NextResponse.json({
        ok: res.ok,
        reverted: res.reverted,
        message: res.ok ? `Undo: ${res.reverted} row(s) restored.` : "Nothing to undo.",
      });
    }

    // --- standard relabel (learns an alias) --------------------------------
    if (!body.category || (!body.txn_id && !body.txn_hash && !body.pattern)) {
      return NextResponse.json(
        { ok: false, message: "Provide txn_id (or txn_hash/pattern) and a category." },
        { status: 400 },
      );
    }
    if (!CATEGORY_OPTIONS.some((c) => c.value === body.category)) {
      return NextResponse.json(
        { ok: false, message: `Unknown category "${body.category}".`, options: CATEGORY_OPTIONS },
        { status: 400 },
      );
    }

    const result = applyCorrection({
      txn_id: body.txn_id,
      txn_hash: body.txn_hash,
      pattern: body.pattern,
      category: body.category!,
    });

    return NextResponse.json({
      ok: result.updated > 0 || result.alias_learned,
      category: body.category,
      updated: result.updated,
      alias_learned: result.alias_learned,
      pattern: result.pattern,
      previous_category: result.previous_category,
      aliases: allAliases(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Correction failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, aliases: allAliases(), options: CATEGORY_OPTIONS });
}
