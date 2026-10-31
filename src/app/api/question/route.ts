/**
 * POST /api/question — "Can I afford ₹X next month?" → verdict + receipt.
 *
 * LLM Job 1 parses the question (JSON mode, temperature 0); code computes
 * everything; LLM Job 3 phrases the sentence with numbers as strings.
 */
import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/pipeline";

export const runtime = "nodejs";
/** LLM calls can take a few seconds on a cold venue network. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: string;
      buffer_inr?: number;
      save?: boolean;
      what_if?: { cancel_subscriptions?: string[]; emi_monthly_inr?: number };
    };

    const question = (body.question ?? "").trim();
    if (!question) {
      return NextResponse.json(
        { ok: false, message: "Ask a question first, e.g. “Can I afford a ₹20k laptop next month?”" },
        { status: 400 },
      );
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
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Question failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { listVerdicts } = await import("@/lib/repository");
  return NextResponse.json({ ok: true, verdicts: listVerdicts(10) });
}
