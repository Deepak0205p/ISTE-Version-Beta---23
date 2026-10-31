/**
 * GET /api/forecast — 30-day P10/P50/P90 band from the current ledger.
 * Pure functions, seed 42, reproducible on stage.
 */
import { NextRequest, NextResponse } from "next/server";
import { forecastOnly } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  void _request;
  try {
    const result = forecastOnly();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Forecast failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
