/**
 * POST /api/wipe — one-click data wipe (privacy requirement).
 * Deletes every row from all four tables; the schema stays, the demo
 * starts fresh. Passwords were never stored anywhere to begin with.
 */
import { NextResponse } from "next/server";
import { wipeAll } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = wipeAll();
    return NextResponse.json({ ok: true, ...result, message: "All local data erased." });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Wipe failed" },
      { status: 500 },
    );
  }
}
