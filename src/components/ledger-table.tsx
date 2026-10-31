"use client";

/**
 * Live ledger table.
 *
 * - raw narration AND cleaned narration side by side
 * - flag vocabulary: transfer / card bill / possible dup / netted / anomaly
 * - the P-class dialog: "Is this a genuine 2nd payment?" — user decides,
 *   both rows always kept
 * - "Mark as Real" for anomalies
 * - correction loop with a counted toast AND Undo (alias dropped, rows
 *   restored)
 */
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Loader2,
  Repeat2,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_OPTIONS } from "@/lib/categorizer";
import type { LedgerTxn } from "@/lib/types";

type Props = {
  txns: LedgerTxn[];
  loading: boolean;
  onCorrected?: () => void;
};

type ToastState = {
  message: string;
  undo?: {
    txn_id: number;
    pattern: string | null;
    previous_category: string | null;
  };
};

export function LedgerTable({
  txns,
  loading,
  counts,
  onCorrected,
}: Props & {
  counts?: {
    dup_p: number;
    transfers: number;
    card_bills: number;
    netted: number;
    anomalies: number;
    user_duplicates: number;
  };
}) {
  const [correcting, setCorrecting] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dupCandidate, setDupCandidate] = useState<LedgerTxn | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function showToast(message: string, undo?: ToastState["undo"]) {
    setToast({ message, undo });
    setTimeout(() => setToast(null), undo ? 12000 : 4000);
  }

  function correct(txn: LedgerTxn, category: string) {
    if (!txn.id) return;
    setCorrecting(txn.id);
    startTransition(async () => {
      try {
        const res = await fetch("/api/correction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txn_id: txn.id, category }),
        });
        const json = await res.json();
        if (json.ok) {
          showToast(
            `${json.updated} similar transaction(s) updated → ${category}`,
            {
              txn_id: txn.id!,
              pattern: json.pattern ?? null,
              previous_category: json.previous_category ?? null,
            },
          );
          onCorrected?.();
        } else {
          showToast(json.message ?? "Correction failed");
        }
      } finally {
        setCorrecting(null);
      }
    });
  }

  function undo(toastState: NonNullable<ToastState["undo"]>) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/correction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "undo_correction", ...toastState }),
        });
        const json = await res.json();
        if (json.ok) {
          setToast({ message: json.message ?? "Undone." });
          setTimeout(() => setToast(null), 4000);
          onCorrected?.();
        }
      } finally {
        setToast(null);
      }
    });
  }

  function decide(txn: LedgerTxn, action: "mark_real" | "mark_duplicate") {
    if (!txn.id) return;
    setActing(txn.id);
    startTransition(async () => {
      try {
        const res = await fetch("/api/correction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txn_id: txn.id, action }),
        });
        const json = await res.json();
        showToast(json.message ?? "Saved.");
        setDupCandidate(null);
        onCorrected?.();
      } finally {
        setActing(null);
      }
    });
  }

  if (loading) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>Loading transactions…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (txns.length === 0) {
    return (
      <Card id="ledger" className="border-border/70 scroll-mt-20 shadow-sm">
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>No transactions yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm">
            <Repeat2 className="size-6 opacity-50" />
            <p>Upload a CSV or PDF to build your ledger.</p>
            <p className="text-xs">
              Fresh account? We will say REFUSED rather than bluff a forecast
              until 3 months of history exist.
            </p>
            <a
              href="/upload"
              className="border-input bg-background hover:bg-muted inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors"
            >
              Go to upload
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="ledger" className="border-border/70 scroll-mt-20 shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Ledger</CardTitle>
          <CardDescription>
            Raw and cleaned narrations side by side — flagged rows are asked
            about, never auto-deleted.
          </CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant="secondary">{txns.length} rows</Badge>
          {!!counts?.dup_p && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
              {counts.dup_p} possible dupes
            </Badge>
          )}
          {!!counts?.transfers && (
            <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400">
              {counts.transfers} transfers
            </Badge>
          )}
          {!!counts?.card_bills && (
            <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400">
              {counts.card_bills} card bills
            </Badge>
          )}
          {!!counts?.netted && (
            <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
              {counts.netted} netted
            </Badge>
          )}
          {!!counts?.anomalies && (
            <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
              {counts.anomalies} anomalies
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {toast && (
          <div
            className="border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            role="status"
          >
            <span>{toast.message}</span>
            {toast.undo && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0"
                onClick={() => undo(toast.undo!)}
              >
                <Undo2 className="size-3.5" />
                Undo
              </Button>
            )}
          </div>
        )}

        <div className="border-border overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Date</TableHead>
                <TableHead className="w-1/3">Raw narration</TableHead>
                <TableHead className="hidden md:table-cell w-1/4">Cleaned</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-44 text-right">Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.slice(0, 300).map((row) => (
                <TableRow
                  key={`${row.txn_hash}-${row.id ?? 0}`}
                  className={row.type !== "normal" ? "opacity-80" : undefined}
                >
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.date}
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate font-mono text-xs" title={row.raw_narration}>
                    {row.raw_narration}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[10rem] truncate font-mono text-xs hidden md:table-cell">
                    {row.clean_narration}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Select
                      value={row.category ?? "uncategorized"}
                      onValueChange={(v) => correct(row, v ?? "uncategorized")}
                      disabled={correcting === row.id}
                    >
                      <SelectTrigger className="h-7 w-[8.5rem] text-xs" aria-label="Category">
                        {correcting === row.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-sm tabular-nums ${
                      row.amount_paise < 0 ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {row.amount_paise < 0 ? (
                        <ArrowDownRight className="size-3.5 opacity-60" />
                      ) : (
                        <ArrowUpRight className="size-3.5 opacity-60" />
                      )}
                      {formatPaise(row.amount_paise)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <FlagBadges
                      row={row}
                      onAskDuplicate={() => setDupCandidate(row)}
                      onMarkReal={() => decide(row, "mark_real")}
                      busy={acting === row.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {txns.length > 300 && (
          <p className="text-muted-foreground text-xs">
            Showing first 300 of {txns.length} rows.
          </p>
        )}
      </CardContent>

      {/* --- the near-duplicate / anomaly decision dialog --------------- */}
      <Dialog open={!!dupCandidate} onOpenChange={(o) => !o && setDupCandidate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dupCandidate?.flags.mad_anomaly && !dupCandidate.flags.dup_p
                ? "Mark as real?"
                : "Is this a genuine 2nd payment?"}
            </DialogTitle>
            <DialogDescription>
              {dupCandidate && (
                <>
                  <span className="font-mono">
                    {dupCandidate.date} · {formatPaise(dupCandidate.amount_paise)} ·{" "}
                    {dupCandidate.clean_narration}
                  </span>
                  <br />
                  {dupCandidate.flags.dup_p
                    ? "This looks like a duplicate of a nearby row (same amount, near-identical narration). Nothing is deleted — you decide."
                    : "This amount was flagged as unusual for your history. If it really happened, mark it real and it counts."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-start">
            {dupCandidate?.flags.dup_p && (
              <Button
                variant="outline"
                size="sm"
                disabled={acting === dupCandidate?.id}
                onClick={() => dupCandidate && decide(dupCandidate, "mark_duplicate")}
              >
                No, it&apos;s a duplicate
              </Button>
            )}
            <Button
              size="sm"
              disabled={acting === dupCandidate?.id}
              onClick={() => dupCandidate && decide(dupCandidate, "mark_real")}
            >
              <Check className="size-3.5" />
              Yes, {dupCandidate?.flags.dup_p ? "genuine 2nd payment" : "mark as real"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FlagBadges({
  row,
  onAskDuplicate,
  onMarkReal,
  busy,
}: {
  row: LedgerTxn;
  onAskDuplicate: () => void;
  onMarkReal: () => void;
  busy: boolean;
}) {
  const badges: React.ReactNode[] = [];

  if (row.type === "transfer") {
    badges.push(
      <Badge key="t" variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400">
        <Repeat2 className="mr-1 size-3" />
        transfer
      </Badge>,
    );
  }
  if (row.type === "card_bill") {
    badges.push(
      <Badge key="cb" variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400">
        card bill
      </Badge>,
    );
  }
  if (row.type === "netted" || row.flags.netted) {
    badges.push(
      <Badge key="n" variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
        netted
      </Badge>,
    );
  }
  if (row.flags.one_off_income) {
    badges.push(
      <Badge key="o" variant="outline" className="border-teal-500/40 text-teal-600 dark:text-teal-400">
        one-off income
      </Badge>,
    );
  }
  if (row.flags.dup_p && !row.flags.user_kept && !row.flags.user_duplicate) {
    badges.push(
      <button key="d" type="button" onClick={onAskDuplicate} disabled={busy}>
        <Badge
          variant="outline"
          className="border-amber-500/40 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
        >
          <AlertTriangle className="mr-1 size-3" />
          possible dup · decide
        </Badge>
      </button>,
    );
  }
  if (row.flags.mad_anomaly || (row.flags.anomaly_reasons?.length ?? 0) > 0) {
    if (!row.flags.user_kept) {
      badges.push(
        <button key="a" type="button" onClick={onMarkReal} disabled={busy} title={row.flags.anomaly_reasons?.join(" · ")}>
          <Badge
            variant="outline"
            className="border-red-500/40 text-red-600 hover:bg-red-500/20 dark:text-red-400"
          >
            <AlertTriangle className="mr-1 size-3" />
            {row.flags.anomaly_reasons?.[0] ?? "anomaly"} · mark real
          </Badge>
        </button>,
      );
    }
  }
  if (row.flags.user_kept) {
    badges.push(
      <Badge key="k" variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
        <Check className="mr-1 size-3" />
        real (your call)
      </Badge>,
    );
  }
  if (row.flags.user_duplicate) {
    badges.push(
      <Badge key="ud" variant="outline" className="border-muted text-muted-foreground">
        duplicate (your call)
      </Badge>,
    );
  }

  if (badges.length === 0) {
    return <span className="text-muted-foreground/60 text-xs">—</span>;
  }
  return <span className="inline-flex flex-wrap justify-end gap-1">{badges}</span>;
}

function formatPaise(paise: number): string {
  const sign = paise < 0 ? "−" : "+";
  const [whole, frac] = (Math.abs(paise) / 100).toFixed(2).split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest === "" ? last3 : `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
  const s = `${sign}₹${grouped}`;
  return frac === "00" ? s : `${s}.${frac}`;
}
