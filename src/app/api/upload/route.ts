/**
 * POST /api/upload — CSV/PDF files (multi) + account label.
 * Parses locally: CSV via adapter normalizer, PDF via pdf-parse with
 * password / no-text-layer failure paths. Inserts into SQLite.
 */
import { NextRequest, NextResponse } from "next/server";
import { ingestCsvText } from "@/lib/pipeline";
import { extractPdfTransactions } from "@/lib/pdfExtractor";
import { insertTransactions, upsertAccount, ledgerStats } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const label = String(form.get("account_label") ?? "").trim() || "default";
    const password = String(form.get("pdf_password") ?? "").trim() || undefined;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No files provided. Attach at least one CSV or PDF." },
        { status: 400 },
      );
    }

    const uploads: Record<string, unknown>[] = [];
    let totalParsed = 0;
    let totalRejected = 0;

    for (const file of files) {
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const bytes = Buffer.from(await file.arrayBuffer());

      if (isPdf) {
        const pdf = await extractPdfTransactions(bytes, `${label}`, password);
        if (!pdf.ok) {
          uploads.push({ file: file.name, ok: false, code: pdf.code, message: pdf.message });
          continue;
        }
        upsertAccount({ id: label, bank: "pdf", label });
        const ins = insertTransactions(pdf.rows);
        totalParsed += ins.inserted;
        uploads.push({
          file: file.name,
          ok: true,
          parsed: ins.inserted,
          skipped_identical: ins.skippedIdentical,
          note: "PDF text extraction is best-effort; verify the ledger against your bank app.",
        });
        continue;
      }

      const text = bytes.toString("utf8");
      const out = ingestCsvText(text, label);

      if (!out.ok) {
        uploads.push({ file: file.name, ok: false, message: out.message });
        continue;
      }

      upsertAccount({ id: out.account_id, bank: out.adapter, label });
      const ins = insertTransactions(out.rows);
      totalParsed += ins.inserted;
      totalRejected += out.rejected;
      uploads.push({
        file: file.name,
        ok: true,
        adapter: out.adapter,
        parsed: ins.inserted,
        skipped_identical: ins.skippedIdentical,
        rejected: out.rejected,
        rejected_detail: out.rejected_detail,
        message: out.message,
      });
    }

    const stats = ledgerStats();
    return NextResponse.json({
      ok: uploads.some((u) => u.ok),
      uploads,
      account_label: label,
      parsed_rows: totalParsed,
      rejected_rows: totalRejected,
      totals: stats,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { listAccounts, ledgerStats } = await import("@/lib/repository");
  return NextResponse.json({
    ok: true,
    accounts: listAccounts(),
    totals: ledgerStats(),
  });
}
