"use client";

/**
 * Single-screen dashboard: ask → verdict + band + buffer + receipt, plus a
 * category-spend breakdown and a monthly-trend chart, the live ledger,
 * data-health warnings, and the one-click wipe.
 */
import { useMemo, useState, useTransition } from "react";
import {
  Calculator,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  CreditCard,
} from "lucide-react";
import { UploadPanel } from "@/components/upload-panel";
import { LedgerTable } from "@/components/ledger-table";
import { VerdictCard } from "@/components/verdict-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLedger } from "@/lib/clientHooks";
import { CATEGORY_LABELS } from "@/lib/categorizer";

const pillars = [
  {
    icon: Calculator,
    title: "Code does the math",
    body: "Every rupee figure comes from a unit-tested pure function — the LLM only parses and phrases.",
  },
  {
    icon: ShieldCheck,
    title: "Never touches data silently",
    body: "Possible duplicates are flagged and asked about. Nothing is auto-deleted, ever.",
  },
  {
    icon: Lock,
    title: "Local-first",
    body: "One SQLite file on your machine. No cloud database, no account, no upload to a server.",
  },
];

export default function AffordabilityDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading } = useLedger(refreshKey);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wiping, startWipe] = useTransition();
  const [wipeMsg, setWipeMsg] = useState<string | null>(null);
  const bump = () => setRefreshKey((k) => k + 1);

  const rawTxns = useMemo(() => data?.transactions ?? [], [data]);
  const txns = rawTxns;

  // --- client-side aggregates for the dashboard charts --------------------
  const categorySpend = useMemo(() => {
    const by = new Map<string, number>();
    for (const t of txns) {
      if (t.type !== "normal" || t.amount_paise >= 0) continue;
      if (t.flags.whatif_removed || t.flags.user_duplicate) continue;
      const cat = t.category && t.category !== "uncategorized" ? t.category : "uncategorized";
      by.set(cat, (by.get(cat) ?? 0) + -t.amount_paise);
    }
    return [...by.entries()]
      .map(([cat, paise]) => ({ cat, paise }))
      .sort((a, b) => b.paise - a.paise)
      .slice(0, 8);
  }, [txns]);

  const monthlyTrend = useMemo(() => {
    const by = new Map<string, { spend: number; income: number }>();
    for (const t of txns) {
      if (t.type !== "normal" || t.amount_paise === 0) continue;
      if (t.flags.whatif_removed || t.flags.user_duplicate) continue;
      const m = t.date.slice(0, 7);
      const entry = by.get(m) ?? { spend: 0, income: 0 };
      if (t.amount_paise < 0) entry.spend += -t.amount_paise;
      else if (!t.flags.one_off_income) entry.income += t.amount_paise;
      by.set(m, entry);
    }
    return [...by.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-12)
      .map(([month, v]) => ({ month, ...v }));
  }, [txns]);

  function wipe() {
    startWipe(async () => {
      try {
        const res = await fetch("/api/wipe", { method: "POST" });
        const json = await res.json();
        setWipeMsg(json.ok ? "All local data erased — fresh start." : (json.message ?? "Wipe failed"));
      } catch {
        setWipeMsg("Wipe failed — is the server running?");
      } finally {
        setWipeOpen(false);
        bump();
        setTimeout(() => setWipeMsg(null), 5000);
      }
    });
  }

  const warnings = data?.warnings ?? [];
  const accounts = data?.accounts ?? [];
  const maxCat = categorySpend[0]?.paise ?? 1;
  const maxTrend = Math.max(1, ...monthlyTrend.map((m) => Math.max(m.spend, m.income)));

  return (
    <div className="space-y-10">
      <section className="space-y-4 text-center">
        <Badge variant="secondary" className="mx-auto">
          Money Matters · Transparent Affordability
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Can I afford ₹X next month?
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-sm sm:text-base">
          Upload bank statements from more than one account and ask one
          question. You get a verdict you can trust — with a receipt that shows
          inputs, formula, and the exact numbers behind it.
        </p>
      </section>

      {/* --- data health + privacy bar ---------------------------------- */}
      {(warnings.length > 0 || wipeMsg || accounts.length > 0) && (
        <section className="space-y-3">
          {warnings.map((w) => (
            <div
              key={w}
              className="border-amber-500/40 bg-amber-500/10 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              role="alert"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {w}
            </div>
          ))}
          {wipeMsg && (
            <div
              className="border-emerald-500/40 bg-emerald-500/10 rounded-lg border px-3 py-2 text-sm"
              role="status"
            >
              {wipeMsg}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {accounts.map((a) => (
                <Badge key={a.id} variant="outline" className="font-mono">
                  <CreditCard className="mr-1 size-3" />
                  {a.label} ····{a.last4 ?? "????"}
                </Badge>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
              onClick={() => setWipeOpen(true)}
              disabled={wiping}
            >
              <Trash2 className="size-3.5" />
              Erase all data
            </Button>
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <VerdictCard onAsked={bump} />

        <div className="grid content-start gap-4">
          {/* --- category spend ---------------------------------------- */}
          {categorySpend.length > 0 && (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Where the money goes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categorySpend.map((c) => (
                  <div key={c.cat} className="space-y-0.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span>{CATEGORY_LABELS[c.cat] ?? c.cat}</span>
                      <span className="font-mono tabular-nums">
                        ₹{Math.round(c.paise / 100).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 rounded-full">
                      <div
                        className="bg-primary/70 h-1.5 rounded-full"
                        style={{ width: `${Math.max(3, (c.paise / maxCat) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* --- monthly trend ----------------------------------------- */}
          {monthlyTrend.length > 1 && (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Monthly trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  {monthlyTrend.map((m) => (
                    <div key={m.month} className="flex-1 text-center">
                      <div className="flex h-24 items-end justify-center gap-0.5">
                        <div
                          className="bg-emerald-500/60 w-1/2 rounded-t"
                          style={{ height: `${Math.max(2, (m.income / maxTrend) * 100)}%` }}
                          title={`Income ₹${Math.round(m.income / 100).toLocaleString("en-IN")}`}
                        />
                        <div
                          className="bg-red-500/60 w-1/2 rounded-t"
                          style={{ height: `${Math.max(2, (m.spend / maxTrend) * 100)}%` }}
                          title={`Spend ₹${Math.round(m.spend / 100).toLocaleString("en-IN")}`}
                        />
                      </div>
                      <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                        {m.month.slice(2)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground mt-2 text-[10px]">
                  <span className="text-emerald-600 dark:text-emerald-400">▮</span> income ·{" "}
                  <span className="text-red-600 dark:text-red-400">▮</span> spend
                </p>
              </CardContent>
            </Card>
          )}

          {pillars.map((p) => (
            <Card key={p.title} className="border-border/70 shadow-sm">
              <CardContent className="flex items-start gap-3 p-4">
                <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <p.icon className="text-foreground size-4" />
                </span>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">{p.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{p.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-6">
          <UploadPanel onUploaded={bump} compact />
        </div>
        <div className="grid content-start gap-6">
          <LedgerTable
            txns={txns}
            loading={loading}
            counts={data?.counts}
            onCorrected={bump}
          />
        </div>
      </section>

      {/* --- wipe confirmation ----------------------------------------- */}
      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Erase all local data?</DialogTitle>
            <DialogDescription>
              This deletes every transaction, account, learned alias, and saved
              verdict from this machine&apos;s SQLite file. Nothing was ever
              uploaded anywhere — this is the only copy, and it will be gone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-start">
            <Button variant="outline" size="sm" onClick={() => setWipeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={wipe}
              disabled={wiping}
            >
              <Trash2 className="size-3.5" />
              {wiping ? "Erasing…" : "Yes, erase everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

