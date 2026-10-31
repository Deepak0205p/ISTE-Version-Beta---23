import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText, rowsFromPdfText } from "@/lib/pdfExtractor";

const fixtures = path.join(process.cwd(), "fixtures");

function read(name: string): Buffer {
  return fs.readFileSync(path.join(fixtures, name));
}

// Spec §5 / §6 fixtures: fail loudly, never a stack trace, never a silent
// partial parse — and with the right password, parse normally.

describe("test_pdf_password_detected", () => {
  it("locked PDF with no password → PASSWORD_PROTECTED + CSV path offered", async () => {
    const res = await extractPdfText(read("locked_statement.pdf"));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("PASSWORD_PROTECTED");
    expect(res.message).toMatch(/password-protected/i);
    expect(res.message).toMatch(/CSV/i);
    expect(res.message).not.toMatch(/at .*\.js:\d+/); // never a stack trace
  });

  it("locked PDF with the documented password (demo123) parses normally", async () => {
    const res = await extractPdfText(read("locked_statement.pdf"), "demo123");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.text).toMatch(/HDFC BANK LIMITED/);
    expect(res.text).toMatch(/01\/10\/2026/);
  });
});

describe("test_pdf_scanned_no_text_layer", () => {
  it("image-only PDF → NO_TEXT_LAYER message asking for CSV, no fabricated rows", async () => {
    const text = await extractPdfText(read("scanned_statement.pdf"));
    expect(text.ok).toBe(true); // the file itself parses fine…
    if (!text.ok) return;
    const rows = rowsFromPdfText(text.text, "acc");
    expect(rows.ok).toBe(false); // …but there is no text to read
    if (rows.ok) return;
    expect(rows.code).toBe("NO_TEXT_LAYER");
    expect(rows.message).toMatch(/scanned/i);
    expect(rows.message).toMatch(/CSV/i);
  });

  it("text present but no table → NO_TABLE_FOUND, nothing guessed", () => {
    const res = rowsFromPdfText(
      "random legal boilerplate without any dates or money figures, repeated well past the minimum text threshold so the failure is clearly about table detection rather than a missing text layer in the document",
      "acc",
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("NO_TABLE_FOUND");
  });
});
