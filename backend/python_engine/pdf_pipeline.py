# Adapted from https://github.com/benjamin-awd/monopoly src/monopoly/pipeline.py (AGPL-3.0 — studied approach only, reimplemented from scratch)
"""
PDF Bank Statement -> Transaction CSV Pipeline.
Reimplemented cleanly using pdfplumber and pure-Python text table extraction.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple

try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # type: ignore


@dataclass
class PdfTransactionRow:
    date: str  # ISO 8601 YYYY-MM-DD
    description: str
    amount_paise: int  # signed: debit < 0, credit > 0
    balance_paise: Optional[int] = None
    account_id: str = "PDF-ACCT"


@dataclass
class PdfExtractionOutcome:
    ok: bool
    rows: List[PdfTransactionRow] = field(default_factory=list)
    error_code: Optional[str] = None
    message: str = ""
    safety_check_passed: bool = True


DATE_PATTERNS = [
    (re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})\b"), "%d/%m/%Y"),
    (re.compile(r"^(\d{1,2})-(\d{1,2})-(\d{4})\b"), "%d-%m-%Y"),
    (re.compile(r"^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b"), "%d %b %Y"),
    (re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})\b"), "%Y-%m-%d"),
]

AMOUNT_TOKEN_RE = re.compile(
    r"(?:₹|Rs\.?|INR)?\s*([+-]?[\d,]+\.\d{2})\s*(Dr|Cr|DR|CR)?\b"
)


def parse_date_prefix(line: str) -> Tuple[Optional[str], str]:
    """Extract leading date token and convert to ISO 8601 (YYYY-MM-DD)."""
    stripped = line.strip()
    for regex, fmt in DATE_PATTERNS:
        m = regex.match(stripped)
        if m:
            raw_date = m.group(0)
            rest = stripped[m.end() :].strip()
            try:
                dt = datetime.strptime(raw_date, fmt)
                return dt.strftime("%Y-%m-%d"), rest
            except ValueError:
                continue
    return None, stripped


def parse_pdf_text_lines(text: str, account_id: str = "PDF-ACCT") -> PdfExtractionOutcome:
    """
    Parse extracted PDF text lines into structured transactions and perform
    balance reconciliation safety checks where running balances are present.
    """
    cleaned = text.replace("\u00a0", " ").strip()
    if len(cleaned) < 40:
        return PdfExtractionOutcome(
            ok=False,
            error_code="NO_TEXT_LAYER",
            message="Scanned PDF with no extractable text layer. Please upload a CSV or text-based PDF.",
        )

    rows: List[PdfTransactionRow] = []
    for raw_line in cleaned.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        iso_date, remainder = parse_date_prefix(line)
        if not iso_date:
            continue

        matches = list(AMOUNT_TOKEN_RE.finditer(remainder))
        if not matches:
            continue

        # Remove amount tokens from narration
        first_amt_start = matches[0].start()
        narration = remainder[:first_amt_start].strip()
        if not narration:
            narration = AMOUNT_TOKEN_RE.sub(" ", remainder).strip()
        narration = re.sub(r"\s+", " ", narration)

        # Determine signed amount and optional closing balance
        amt_str, direction = matches[0].group(1), matches[0].group(2)
        val_paise = int(round(float(amt_str.replace(",", "")) * 100))

        if direction:
            if direction.lower() == "dr":
                val_paise = -abs(val_paise)
            else:
                val_paise = abs(val_paise)
        elif not amt_str.startswith("+") and not amt_str.startswith("-"):
            # Heuristic: if narration has SALARY/CREDIT/NEFT CR, positive; else negative debit
            if re.search(r"\b(SALARY|CREDIT|CR|REFUND|INWARD)\b", narration, re.I):
                val_paise = abs(val_paise)
            else:
                val_paise = -abs(val_paise)

        bal_paise: Optional[int] = None
        if len(matches) >= 2:
            bal_str = matches[-1].group(1)
            bal_paise = int(round(float(bal_str.replace(",", "")) * 100))

        rows.append(
            PdfTransactionRow(
                date=iso_date,
                description=narration or "PDF TRANSACTION",
                amount_paise=val_paise,
                balance_paise=bal_paise,
                account_id=account_id,
            )
        )

    if not rows:
        return PdfExtractionOutcome(
            ok=False,
            error_code="NO_TABLE_FOUND",
            message="No transaction rows found in PDF statement.",
        )

    # Safety check: verify running balance continuity if balances exist
    safety_ok = True
    for i in range(1, len(rows)):
        prev_b = rows[i - 1].balance_paise
        curr_b = rows[i].balance_paise
        if prev_b is not None and curr_b is not None:
            if abs((prev_b + rows[i].amount_paise) - curr_b) > 100:
                safety_ok = False
                break

    return PdfExtractionOutcome(
        ok=True,
        rows=rows,
        message=f"Extracted {len(rows)} transactions from PDF statement.",
        safety_check_passed=safety_ok,
    )


def extract_pdf_bytes(pdf_bytes: bytes, account_id: str = "PDF-ACCT") -> PdfExtractionOutcome:
    """Extract text from PDF bytes using pdfplumber (with raw stream fallback)."""
    if b"/Encrypt" in pdf_bytes:
        return PdfExtractionOutcome(
            ok=False,
            error_code="PASSWORD_PROTECTED",
            message="PDF statement is password-protected.",
        )

    extracted_text = ""
    if pdfplumber is not None:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                pages_text = [page.extract_text() or "" for page in pdf.pages]
                extracted_text = "\n".join(pages_text)
        except Exception:
            extracted_text = ""

    if not extracted_text.strip():
        # Fallback: extract literal text strings from PDF content stream `( ... ) Tj`
        literals = re.findall(rb"\(([^()\\]*(?:\\.[^()\\]*)*)\)", pdf_bytes)
        decoded_lines = [lit.decode("latin-1", errors="ignore") for lit in literals]
        extracted_text = "\n".join(decoded_lines)

    return parse_pdf_text_lines(extracted_text, account_id=account_id)
