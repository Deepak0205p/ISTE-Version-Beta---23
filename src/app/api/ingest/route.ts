/**
 * POST /api/ingest — run categorization + dedup + transfer detection + MAD.
 * GET  /api/ingest — the cleaned ledger + summary for the UI table.
 */
import { NextRequest, NextResponse } from "next/server";
import { runIngest, ledgerWarnings } from "@/lib/pipeline";
import { allTransactions, ledgerStats, listAccounts, userAliases, ensureLast4 } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = runIngest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Ingest failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 500);
    const txns = allTransactions();
    const stats = ledgerStats();
    ensureLast4();

    return NextResponse.json({
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
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Ledger read failed" },
      { status: 500 },
    );
  }
}
