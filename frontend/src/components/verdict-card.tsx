"use client";

/**
 * The verdict card — question box, sentence, band chart, the interactive
 * safety-buffer slider, and the what-if sandbox (cancel a subscription,
 * convert the purchase to an EMI).
 *
 * Slider behavior (the "judge-poke" feature): moving the slider recomputes
 * the verdict LOCALLY through the same pure function (computeVerdict) the
 * server used — no network, no LLM, instant. The LLM-phrased sentence from
 * the server is shown for the original ask; local recompute shows a code-
 * generated sentence so receipt and sentence never disagree.
 */
import { useState, useTransition } from "react";
import { HelpCircle, Loader2, Send, Receipt as ReceiptIcon, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeVerdict, formatVerdictSentence, paiseToInrWords } from "@/lib/mathEngine";
import { VERDICT_DISPLAY } from "@/lib/receipt";
import type { Verdict } from "@/lib/types";
import { ReceiptPanel, type Receipt } from "@/components/receipt-panel";

type Answer = {
  verdict: Verdict;
  verdict_display: string;
  banner: string | null;
  sentence: string;
  receipt: Receipt;
  whatif: { applied: string[] };
  live: {
    band: { p10: number; p50: number; p90: number };
    buffer_paise: number;
    price_paise: number;
    months_of_data: number;
  };
  llm: { question_source: string; phrasing_source: string; provider: string };
};

const VERDICT_STYLES: Record<Verdict, string> = {
  YES: "border-[#16A579]/40 bg-[#E7F5EF] dark:bg-[#16A579]/15 text-[#16A579] font-medium",
  TIGHT: "border-[#C98A32]/40 bg-[#FBF1DD] dark:bg-[#C98A32]/15 text-[#C98A32] font-medium",
  NO: "border-[#D95C52]/40 bg-[#FBE9E7] dark:bg-[#D95C52]/15 text-[#D95C52] font-medium",
  REFUSED: "border-[#8A847B]/40 bg-[#EFEEE9] dark:bg-[#8A847B]/15 text-[#8A847B] font-medium",
};

export function VerdictCard({
  onAsked,
}: {
  onAsked?: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // slider state (paise); synced to the server answer, then moved locally
  const [bufferPaise, setBufferPaise] = useState(0);
  const [bufferTouched, setBufferTouched] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // what-if sandbox state
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [cancelSubs, setCancelSubs] = useState<string[]>([]);
  const [emiMonthly, setEmiMonthly] = useState("");

  function ask() {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setBufferTouched(false);
    const what_if =
      cancelSubs.length > 0 || Number(emiMonthly) > 0
        ? {
            cancel_subscriptions: cancelSubs,
            emi_monthly_inr: Number(emiMonthly) > 0 ? Number(emiMonthly) : undefined,
          }
        : undefined;
    startTransition(async () => {
      try {
        const res = await fetch("/api/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, what_if }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.message ?? "Something went wrong.");
          setAnswer(null);
          return;
        }
        setAnswer(json as Answer);
        setBufferPaise(json.live.buffer_paise);
        onAsked?.();
      } catch {
        setError("Network error — is the dev server running?");
      }
    });
  }

  function toggleSub(merchant: string) {
    setCancelSubs((s) =>
      s.includes(merchant) ? s.filter((m) => m !== merchant) : [...s, merchant],
    );
  }

  // ---- instant local recompute on slider move -----------------------------
  let liveVerdict: Verdict = answer?.verdict ?? "REFUSED";
  let liveSentence = answer?.sentence ?? "";
  let liveShortfall = 0;

  if (answer) {
    const v = computeVerdict({
      band: answer.live.band,
      price_paise: answer.live.price_paise,
      buffer_paise: bufferPaise,
      months_of_data: answer.live.months_of_data,
    });
    liveVerdict = v.verdict;
    liveShortfall = Math.max(0, v.shortfall_worst_case_paise);

    if (bufferTouched) {
      liveSentence =
        v.verdict === "REFUSED"
          ? v.reason
          : formatVerdictSentence(v.verdict, {
              price: paiseToInrWords(answer.live.price_paise),
              buffer: paiseToInrWords(bufferPaise),
              p10: paiseToInrWords(answer.live.band.p10),
              p50: paiseToInrWords(answer.live.band.p50),
              shortfall: paiseToInrWords(
                v.verdict === "NO"
                  ? Math.max(0, v.shortfall_median_paise)
                  : Math.max(0, v.shortfall_worst_case_paise),
              ),
            });
    }
  }

  const subs = answer?.receipt.recurring?.items.filter((i) => i.kind !== "salary") ?? [];

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="text-primary size-5" />
          Ask the one question
        </CardTitle>
        <CardDescription>
          The LLM only parses your sentence — every rupee below is computed by
          unit-tested code.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Can I afford a ₹20k laptop next month?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            aria-label="Your affordability question"
            disabled={pending}
          />
          <Button onClick={ask} disabled={pending || !question.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {pending ? "Thinking…" : "Ask"}
          </Button>
        </div>

        {/* --- what-if sandbox ------------------------------------------- */}
        <div className="border-border rounded-lg border">
          <button
            type="button"
            onClick={() => setShowWhatIf((s) => !s)}
            className="hover:text-foreground flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
          >
            <span className="inline-flex items-center gap-1.5">
              <FlaskConical className="size-3.5" />
              What-if sandbox
              {(cancelSubs.length > 0 || Number(emiMonthly) > 0) && (
                <Badge variant="secondary" className="ml-1">
                  active
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground">{showWhatIf ? "−" : "+"}</span>
          </button>
          {showWhatIf && (
            <div className="border-border space-y-3 border-t px-3 py-3">
              {subs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs">
                    Cancel a subscription (recomputed server-side, row never deleted):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {subs.map((s) => (
                      <button
                        key={s.merchant}
                        type="button"
                        onClick={() => toggleSub(s.merchant)}
                        className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                          cancelSubs.includes(s.merchant)
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-input hover:bg-muted"
                        }`}
                      >
                        {cancelSubs.includes(s.merchant) ? "✕ " : ""}
                        {s.merchant} ₹{s.amount_inr.toLocaleString("en-IN")}/{s.interval_days}d
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-xs" htmlFor="emi">
                  Or convert the purchase to EMI (₹/month):
                </label>
                <Input
                  id="emi"
                  className="h-7 w-28 text-xs"
                  inputMode="numeric"
                  placeholder="4999"
                  value={emiMonthly}
                  onChange={(e) => setEmiMonthly(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <p className="text-muted-foreground text-[11px]">
                Press Ask again — the verdict, band, and receipt rebuild with the
                scenario applied.
              </p>
            </div>
          )}
        </div>

        {pending && (
          <div className="space-y-2" aria-label="Parsing question">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <div className="border-amber-500/40 bg-amber-500/10 text-sm rounded-lg border px-3 py-2">
            {error}
          </div>
        )}

        {answer && !pending && (
          <div className="space-y-4">
            {/* --- INSUFFICIENT DATA banner (Gray #8A847B) ------------------- */}
            {answer.verdict === "REFUSED" && answer.banner && (
              <div
                className="border-[#8A847B]/40 bg-[#EFEEE9] dark:bg-[#8A847B]/15 text-[#8A847B] rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-2"
                role="alert"
              >
                <span>⚪</span>
                <span>{answer.banner}</span>
              </div>
            )}

            {answer.whatif.applied.length > 0 && (
              <div className="border-emerald-500/40 bg-emerald-500/10 rounded-lg border px-3 py-2 text-xs">
                What-if applied: {answer.whatif.applied.join(" · ")}
              </div>
            )}

            <div
              className={`rounded-lg border px-4 py-3 ${VERDICT_STYLES[liveVerdict]}`}
              role="status"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm leading-relaxed">{liveSentence}</p>
                <span className="text-right">
                  <span className="block font-mono text-xl font-bold">
                    {bufferTouched ? VERDICT_DISPLAY[liveVerdict] : answer.verdict_display}
                  </span>
                  {liveVerdict !== answer.verdict && (
                    <span className="font-mono text-[10px] opacity-70">
                      server said {answer.verdict_display}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* --- band chart (live numbers) ----------------------------- */}
            <div className="border-border rounded-lg border p-3">
              <div className="text-muted-foreground mb-2 flex items-center justify-between text-xs">
                <span>Forecast band · 30 days</span>
                <span className="font-mono">
                  P10 {paiseToInrWords(answer.live.band.p10)} · P50{" "}
                  {paiseToInrWords(answer.live.band.p50)} · P90{" "}
                  {paiseToInrWords(answer.live.band.p90)}
                </span>
              </div>
              <BandChart
                p10={answer.live.band.p10}
                p50={answer.live.band.p50}
                p90={answer.live.band.p90}
              />
            </div>

            {/* --- interactive buffer slider ----------------------------- */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Safety buffer {bufferTouched && "(adjusted locally)"}
                </span>
                <span className="font-mono font-medium tabular-nums">
                  ₹{paiseToInrWords(bufferPaise)}
                </span>
              </div>
              <Slider
                value={[bufferPaise]}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : typeof v === "number" ? v : bufferPaise;
                  setBufferPaise(next);
                  setBufferTouched(true);
                }}
                min={0}
                max={Math.max(5000000, answer.live.buffer_paise * 3)}
                step={50000}
                aria-label="Safety buffer"
              />
              <p className="text-muted-foreground text-xs">
                Recomputed locally via <code className="font-mono">computeVerdict()</code> —
                price ₹{paiseToInrWords(answer.live.price_paise)}, worst case ₹
                {paiseToInrWords(answer.live.band.p10)}
                {liveShortfall > 0 && `, short by ₹${paiseToInrWords(liveShortfall)}`}.
              </p>
            </div>

            {/* --- provenance + receipt --------------------------------- */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">question: {answer.llm.question_source}</Badge>
                <Badge variant="outline">phrasing: {answer.llm.phrasing_source}</Badge>
                <Badge variant="outline">{answer.receipt.data_window.txns} txns</Badge>
                <Badge variant="outline">
                  {answer.receipt.data_window.from} → {answer.receipt.data_window.to}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReceipt((s) => !s)}
              >
                <ReceiptIcon className="size-4" />
                {showReceipt ? "Hide receipt" : "Show receipt"}
              </Button>
            </div>

            {showReceipt && <ReceiptPanel receipt={answer.receipt} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact P10–P90 envelope + median line, no recharts dependency needed. */
function BandChart({ p10, p50, p90 }: { p10: number; p50: number; p90: number }) {
  const values = [p10, p50, p90];
  const lo = Math.min(...values) * 0.98;
  const hi = Math.max(...values) * 1.02;
  const y = (v: number) => 64 - ((v - lo) / Math.max(1, hi - lo)) * 56;

  return (
    <svg viewBox="0 0 320 72" className="h-24 w-full" role="img" aria-label="Forecast band">
      <polyline
        points={`0,${y(p90)} 160,${y((p90 + p50) / 2)} 320,${y(p90)}`}
        fill="none"
        stroke="var(--color-chart-3, #888)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
      <polygon
        points={`0,${y(p90)} 320,${y(p90)} 320,${y(p10)} 0,${y(p10)}`}
        fill="var(--color-chart-1, #888)"
        opacity="0.18"
      />
      <polyline
        points={`0,${y(p50)} 160,${y(p50)} 320,${y(p50)}`}
        fill="none"
        stroke="var(--color-chart-1, #888)"
        strokeWidth="2"
      />
      <polyline
        points={`0,${y(p10)} 160,${y((p10 + p50) / 2)} 320,${y(p10)}`}
        fill="none"
        stroke="var(--color-chart-2, #888)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
    </svg>
  );
}
