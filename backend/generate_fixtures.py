"""
Generates synthetic PS4 bank statement fixtures (2 CSVs + 1 sample PDF from different accounts + 1 short <3mo CSV):
- fixtures/ps4/hdfc_primary_3mo.csv (Account 1: HDFC format — 3 months: Jan, Feb, Mar 2025)
  Contains:
    * Salary credits (₹1,20,000/mo on Jan 01, Feb 01, Mar 01)
    * Rent (₹25,000/mo on Jan 05, Feb 05, Mar 05)
    * Groceries (BigBasket ₹4,500/mo on Jan 10, Feb 10, Mar 10)
    * Subscription 1: NETFLIX (₹649/mo on Jan 15, Feb 15, Mar 15)
    * Subscription 2: SPOTIFY (₹199/mo on Jan 18, Feb 18, Mar 18)
    * One near-duplicate charge: SWIGGY ORDER ₹540 on Mar 20 and Mar 21 (same account, 1 day apart -> flagged as possible duplicate charge)
    * One large anomaly / new merchant: LUXURY WATCH EMPORIUM ₹48,000 on Mar 25 (>95th percentile + new high-value merchant)
    * Seeded exact duplicate pair across files: UPI-AMAZON-PRIME-SEED-DUP ₹1,499 on 12/03/2025 (present in hdfc_primary_3mo.csv AND sbi_secondary_3mo.csv so when merged it appears ONCE!)
- fixtures/ps4/sbi_secondary_3mo.csv (Account 2: SBI format)
  Contains:
    * The overlapping/duplicate row UPI-AMAZON-PRIME-SEED-DUP ₹1,499 on 12 Mar 2025 (same ref & date & amount -> collapsed so seeded duplicate pair appears ONCE)
    * Groceries: BLINKIT GROCERY ₹1,200 on 14 Jan 2025, 14 Feb 2025, 14 Mar 2025
- fixtures/ps4/icici_statement.pdf (Account 3: valid PDF with extractable text layer)
  Contains:
    * 22/01/2025 UPI-YOUTUBE-PREMIUM-SUB 189.00 Dr 45000.00 Cr
    * 22/02/2025 UPI-YOUTUBE-PREMIUM-SUB 189.00 Dr 44811.00 Cr
    * 22/03/2025 UPI-YOUTUBE-PREMIUM-SUB 189.00 Dr 185000.00 Cr
- fixtures/ps4/short_1mo.csv (< 3 months of statements for 'data too short' check)
"""

from __future__ import annotations
import os


def build_minimal_pdf(lines: list[str]) -> bytes:
    """Create a valid single-page PDF with extractable text lines."""
    content_ops = ["BT", "/F1 10 Tf", "50 760 Td", "14 TL"]
    for line in lines:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content_ops.append(f"({escaped}) Tj T*")
    content_ops.append("ET")
    stream_bytes = "\n".join(content_ops).encode("latin-1")

    objs: list[bytes] = []
    objs.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objs.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objs.append(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    )
    objs.append(
        f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode("latin-1")
        + stream_bytes
        + b"\nendstream\nendobj\n"
    )
    objs.append(
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    )

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objs:
        offsets.append(len(out))
        out.extend(obj)

    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objs) + 1}\n".encode("latin-1"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))

    out.extend(
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode(
            "latin-1"
        )
    )
    return bytes(out)


def generate_all_fixtures(base_dir: str = "fixtures/ps4") -> None:
    os.makedirs(base_dir, exist_ok=True)

    # 1. HDFC Primary 3-Month CSV
    hdfc_csv = """Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/01/2025,NEFT-SALARY-ACME CORP INDIA,REF1001,01/01/2025,,120000.00,150000.00
05/01/2025,UPI-LANDLORD RENT JAN,REF1002,05/01/2025,25000.00,,125000.00
10/01/2025,UPI-BIGBASKET GROCERY,REF1003,10/01/2025,4500.00,,120500.00
15/01/2025,UPI-NETFLIX SUBSCRIPTION,REF1004,15/01/2025,649.00,,119851.00
18/01/2025,UPI-SPOTIFY INDIA,REF1005,18/01/2025,199.00,,119652.00
01/02/2025,NEFT-SALARY-ACME CORP INDIA,REF2001,01/02/2025,,120000.00,239652.00
05/02/2025,UPI-LANDLORD RENT FEB,REF2002,05/02/2025,25000.00,,214652.00
10/02/2025,UPI-BIGBASKET GROCERY,REF2003,10/02/2025,4800.00,,209852.00
15/02/2025,UPI-NETFLIX SUBSCRIPTION,REF2004,15/02/2025,649.00,,209203.00
18/02/2025,UPI-SPOTIFY INDIA,REF2005,18/02/2025,199.00,,209004.00
01/03/2025,NEFT-SALARY-ACME CORP INDIA,REF3001,01/03/2025,,120000.00,329004.00
05/03/2025,UPI-LANDLORD RENT MAR,REF3002,05/03/2025,25000.00,,304004.00
10/03/2025,UPI-BIGBASKET GROCERY,REF3003,10/03/2025,4200.00,,299804.00
12/03/2025,UPI-AMAZON-PRIME-SEED-DUP,REF9999,12/03/2025,1499.00,,298305.00
15/03/2025,UPI-NETFLIX SUBSCRIPTION,REF3004,15/03/2025,649.00,,297656.00
18/03/2025,UPI-SPOTIFY INDIA,REF3005,18/03/2025,199.00,,297457.00
20/03/2025,UPI-SWIGGY FOOD ORDER,REF3006,20/03/2025,540.00,,296917.00
21/03/2025,UPI-SWIGGY FOOD ORDER,REF3007,21/03/2025,540.00,,296377.00
25/03/2025,POS-LUXURY WATCH EMPORIUM,REF3008,25/03/2025,48000.00,,185000.00
"""
    with open(os.path.join(base_dir, "hdfc_primary_3mo.csv"), "w", encoding="utf-8") as f:
        f.write(hdfc_csv)

    # 2. SBI Secondary 3-Month CSV (contains overlapping seeded duplicate row REF9999 + Blinkit rows)
    sbi_csv = """Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
14 Jan 2025,14 Jan 2025,UPI-BLINKIT GROCERY,SBI101,1200.00,,42000.00
14 Feb 2025,14 Feb 2025,UPI-BLINKIT GROCERY,SBI201,1200.00,,40800.00
12 Mar 2025,12 Mar 2025,UPI-AMAZON-PRIME-SEED-DUP,REF9999,1499.00,,39301.00
14 Mar 2025,14 Mar 2025,UPI-BLINKIT GROCERY,SBI301,1200.00,,185000.00
"""
    with open(os.path.join(base_dir, "sbi_secondary_3mo.csv"), "w", encoding="utf-8") as f:
        f.write(sbi_csv)

    # 3. Sample PDF statement from 3rd account (ICICI)
    pdf_lines = [
        "ICICI BANK STATEMENT OF ACCOUNT - ACCT 3303",
        "Date Narration Debit Credit Balance",
        "22/01/2025 UPI-YOUTUBE-PREMIUM-SUB 189.00 Dr 185378.00 Cr",
        "22/02/2025 UPI-YOUTUBE-PREMIUM-SUB 189.00 Dr 185189.00 Cr",
        "22/03/2025 UPI-YOUTUBE-PREMIUM-SUB 189.00 Dr 185000.00 Cr",
    ]
    pdf_bytes = build_minimal_pdf(pdf_lines)
    with open(os.path.join(base_dir, "icici_statement.pdf"), "wb") as f:
        f.write(pdf_bytes)

    # 4. Short < 3 months CSV (1 month only)
    short_csv = """Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/03/2025,NEFT-SALARY-ACME CORP INDIA,REF9001,01/03/2025,,120000.00,145000.00
05/03/2025,UPI-LANDLORD RENT MAR,REF9002,05/03/2025,25000.00,,120000.00
10/03/2025,UPI-BIGBASKET GROCERY,REF9003,10/03/2025,4200.00,,115800.00
"""
    with open(os.path.join(base_dir, "short_1mo.csv"), "w", encoding="utf-8") as f:
        f.write(short_csv)


if __name__ == "__main__":
    generate_all_fixtures()
    print("Generated fixtures in fixtures/ps4/")
