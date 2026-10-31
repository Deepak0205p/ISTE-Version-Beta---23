"use client";

/**
 * /upload — client-side CSV streaming/parse preview + upload, then the live
 * ledger showing raw and cleaned narrations side by side.
 *
 * The CSV is read in the browser first (instant preview + adapter hint),
 * then POSTed to /api/upload which runs the strict server-side normalizer
 * with balance reconciliation.
 */
import { useCallback, useState } from "react";
import { FileSpreadsheet, FileText, Loader2, ScanLine, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LedgerTable } from "@/components/ledger-table";
import { useLedger } from "@/lib/clientHooks";
import { detectAdapter } from "@/config/bankAdapters";

const ACCEPT = ".csv,.pdf";

type UploadRow = {
  file: string;
  ok: boolean;
  adapter?: string;
  parsed?: number;
  rejected?: number;
  skipped_identical?: number;
  code?: string;
  message: string;
  rejected_detail?: string[];
};

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [accountLabel, setAccountLabel] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [preview, setPreview] = useState<{ header: string; adapter: string | null; lines: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading } = useLedger(refreshKey);
  const bump = () => setRefreshKey((k) => k + 1);

  const addFiles = useCallback(async (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) =>
      /\.(csv|pdf)$/i.test(f.name),
    );
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...incoming.filter((f) => !seen.has(f.name + f.size))];
    });
    setError(null);
    setRows([]);

    // client-side preview for the first CSV — instant feedback while reading
    const firstCsv = incoming.find((f) => /\.csv$/i.test(f.name));
    if (firstCsv) {
      setReading(true);
      try {
        const text = await firstCsv.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const header = lines[0] ?? "";
        setPreview({
          header,
          adapter: detectAdapter(header)?.id ?? null,
          lines: lines.length - 1,
        });
      } catch {
        setPreview(null);
      } finally {
        setReading(false);
      }
    } else {
      setPreview(null);
    }
  }, []);

  async function upload() {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setRows([]);
    try {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      body.append("account_label", accountLabel.trim() || "default");
      if (pdfPassword.trim()) body.append("pdf_password", pdfPassword.trim());

      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { ok: boolean; uploads?: UploadRow[]; message?: string };

      if (!json.uploads) {
        setError(json.message ?? "Upload failed.");
      } else {
        setRows(json.uploads);
        if (json.uploads.some((u) => u.ok)) {
          // run the hygiene pipeline automatically after a good upload
          await fetch("/api/ingest", { method: "POST" });
          bump();
          setFiles([]);
          setPreview(null);
        }
      }
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Badge variant="secondary">Step 1</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Upload statements
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          CSV or PDF from any account. HDFC-style and SBI-style CSVs are
          auto-detected from the header row; every running balance is
          reconciled and any mismatched row is rejected, not guessed.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="text-primary size-5" />
              Add files
            </CardTitle>
            <CardDescription>
              Multiple files, multiple accounts · 3,000 rows parse in under 2
              seconds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              htmlFor="statement-drop"
              className={`border-input bg-muted/40 hover:border-primary/60 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                dragging ? "border-primary bg-muted" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void addFiles(e.dataTransfer.files);
              }}
            >
              <input
                id="statement-drop"
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => void addFiles(e.target.files)}
              />
              <span className="bg-background flex size-11 items-center justify-center rounded-full border">
                <FileSpreadsheet className="text-muted-foreground size-5" />
              </span>
              <span className="text-sm">
                <span className="text-foreground font-medium">Click to browse</span> or drag
                files here
              </span>
              <span className="text-muted-foreground text-xs">CSV and PDF</span>
            </label>

            {reading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}

            {preview && (
              <div className="border-border bg-muted/40 space-y-1 rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Client-side preview</span>
                  {preview.adapter ? (
                    <Badge variant="outline">detected: {preview.adapter}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                      unknown header
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{preview.lines} data rows (approx)</p>
                <p className="bg-background border-border truncate rounded border px-2 py-1 font-mono">
                  {preview.header}
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Account label (e.g. HDFC salary · ····1234)"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                aria-label="Account label"
              />
              <Input
                type="password"
                placeholder="PDF open password (optional)"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                aria-label="PDF password"
              />
            </div>

            <Button onClick={upload} disabled={files.length === 0 || busy} className="w-full">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Uploading…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
            </Button>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li
                    key={f.name + f.size}
                    className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {/\.pdf$/i.test(f.name) ? (
                        <FileText className="text-muted-foreground size-4 shrink-0" />
                      ) : (
                        <FileSpreadsheet className="text-muted-foreground size-4 shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                      {(f.size / 1024).toFixed(0)} KB
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        className="hover:text-destructive"
                        onClick={() =>
                          setFiles((prev) =>
                            prev.filter((x) => x.name + x.size !== f.name + f.size),
                          )
                        }
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <div
                className="border-red-500/40 bg-red-500/10 rounded-lg border px-3 py-2 text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            {rows.length > 0 && (
              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <li
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      r.ok
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-amber-500/40 bg-amber-500/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={r.ok ? "default" : "outline"}>
                        {r.ok ? "ingested" : r.code ?? "failed"}
                      </Badge>
                      <span className="truncate font-medium">{r.file}</span>
                    </div>
                    <p className="mt-1 text-xs">{r.message}</p>
                    {r.ok && (
                      <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                        parsed {r.parsed} · rejected {r.rejected ?? 0} · identical skipped{" "}
                        {r.skipped_identical ?? 0}
                        {r.adapter && ` · adapter ${r.adapter}`}
                      </p>
                    )}
                    {!!r.rejected_detail?.length && (
                      <ul className="text-muted-foreground mt-1 space-y-0.5 font-mono text-[11px]">
                        {r.rejected_detail.map((d, j) => (
                          <li key={j}>• {d}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter className="text-muted-foreground flex items-center gap-2 text-xs">
            <ScanLine className="size-3.5" />
            Password-protected and scanned PDFs fail loudly with a clear message — we
            never guess rows.
          </CardFooter>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">What happens next</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-3 text-sm">
              <p>
                <span className="text-foreground font-medium">1. Normalizer</span> — dates
                → ISO 8601, money → integer paise, balance column reconciled row by row.
              </p>
              <p>
                <span className="text-foreground font-medium">2. Hygiene</span> —
                Fellegi-Sunter M/P/U dedup (P-class asks, never deletes), transfer
                pairing, failed-UPI netting, MAD anomaly flags.
              </p>
              <p>
                <span className="text-foreground font-medium">3. Categorize</span> —
                alias dictionary → deterministic rules → LLM only for what falls
                through. Your corrections teach the dictionary.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardContent className="flex items-baseline justify-between p-4 text-sm">
              <span className="text-muted-foreground">Ledger status</span>
              {loading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <span className="font-mono">
                  {data?.totals.txns ?? 0} txns · {data?.totals.accounts ?? 0} accounts
                </span>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <LedgerTable
        txns={data?.transactions ?? []}
        loading={loading}
        counts={data?.counts}
        onCorrected={bump}
      />
    </div>
  );
}
