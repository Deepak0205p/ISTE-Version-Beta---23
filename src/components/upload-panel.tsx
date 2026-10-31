"use client";

/**
 * Compact upload widget for the dashboard (full version lives at /upload).
 */
import { useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ACCEPT = ".csv,.pdf";

export function UploadPanel({
  onUploaded,
  compact = false,
}: {
  onUploaded?: () => void;
  compact?: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [accountLabel, setAccountLabel] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next = Array.from(list).filter((f) => /\.(csv|pdf)$/i.test(f.name));
    if (next.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const fresh = next.filter((f) => !seen.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...prev, ...fresh];
    });
    setResult(null);
  }

  function removeFile(fileToRemove: File) {
    setFiles((prev) =>
      prev.filter(
        (f) => `${f.name}-${f.size}-${f.lastModified}` !== `${fileToRemove.name}-${fileToRemove.size}-${fileToRemove.lastModified}`,
      ),
    );
  }

  async function upload() {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      for (const file of files) {
        body.append("files", file, file.name);
      }
      body.append("account_label", accountLabel.trim() || "default");

      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();

      if (json.ok) {
        await fetch("/api/ingest", { method: "POST" }).catch(() => {});
        setResult({
          ok: true,
          message: json.uploads?.[0]?.message ?? "Uploaded successfully.",
          detail: `parsed ${json.parsed_rows ?? 0} · rejected ${json.rejected_rows ?? 0}`,
        });
        setFiles([]);
        onUploaded?.();
      } else {
        setResult({ ok: false, message: json.message ?? "Upload failed." });
      }
    } catch {
      setResult({ ok: false, message: "Network error — is the dev server running?" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="text-primary size-5" />
          Upload bank statements
        </CardTitle>
        <CardDescription>
          CSV or PDF — HDFC-style and SBI-style CSVs auto-detected. Multiple
          files, multiple accounts.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <label
          htmlFor="dashboard-drop"
          className={`border-input bg-muted/40 hover:border-primary/60 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
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
            addFiles(e.dataTransfer.files);
          }}
        >
          <input
            id="dashboard-drop"
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onClick={(e) => {
              (e.target as HTMLInputElement).value = "";
            }}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="bg-background flex size-11 items-center justify-center rounded-full border">
            <FileSpreadsheet className="text-muted-foreground size-5" />
          </span>
          <span className="text-sm">
            <span className="text-foreground font-medium">Click to browse</span> or drag
            files here
          </span>
          {!compact && (
            <span className="text-muted-foreground text-xs">CSV and PDF · up to 3,000 rows</span>
          )}
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            placeholder="Account label (e.g. HDFC salary · ····1234)"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            aria-label="Account label"
          />
          <Button onClick={upload} disabled={files.length === 0 || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>

        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.name + f.size}
                className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
              >
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                  {(f.size / 1024).toFixed(0)} KB
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    className="hover:text-destructive transition-colors p-0.5 rounded cursor-pointer"
                    onClick={() => removeFile(f)}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {result && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              result.ok
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
            role="status"
          >
            <div className="flex items-center gap-2">
              <Badge variant={result.ok ? "default" : "outline"}>
                {result.ok ? "OK" : "error"}
              </Badge>
              <span>{result.message}</span>
            </div>
            {result.detail && (
              <p className="text-muted-foreground mt-1 font-mono text-xs">{result.detail}</p>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="text-muted-foreground text-xs">
        Files stay on this machine — everything is stored in a local SQLite file, never a
        cloud database.
      </CardFooter>
    </Card>
  );
}
