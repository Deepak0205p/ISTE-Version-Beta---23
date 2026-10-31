"""
Generate the two PDF trap fixtures from docs/fixtures_spec.md:

  fixtures/locked_statement.pdf    — password-protected (RC4-128, password: demo123)
  fixtures/scanned_statement.pdf   — image-only, no text layer (the "scan")

Pure stdlib (zlib) for the base PDFs + pypdf for encryption.
Run:  python scripts/make-pdf-fixtures.py
"""
import os
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "fixtures")
os.makedirs(OUT, exist_ok=True)


def assemble(objects):
    """Join PDF object bodies into a complete PDF byte string."""
    body = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_pos = len(body)
    xref = f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        xref += f"{off:010d} 00000 n \n".encode()
    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return body + xref + trailer


def text_pdf():
    """A normal HDFC-style statement PDF with a real text layer."""
    lines = [
        "HDFC BANK LIMITED  -  Account Statement",
        "Account Name: R. Sharma   Account No: XXXXXXXX4321",
        "",
        "Date        Narration                                  Withdrawal   Deposit    Balance",
        "01/10/2026  UPI/IMPS/SALARY OCT/ACCR                                        72000.00  106210.00",
        "02/10/2026  UPI/P2A/918273451/R K PROPERTIES/RENT   18000.00              88210.00",
        "05/10/2026  UPI/BLINKIT 8823 GGN                       642.50              87567.50",
        "06/10/2026  UPI/CHAI POINT 20                           20.00              87547.50",
        "07/10/2026  UPI/ZOMATO ORDER                           350.00              87197.50",
        "08/10/2026  NACH NETFLIX INDIA                         649.00              86548.50",
        "10/10/2026  ATM CASH WDL                              2000.00              84548.50",
        "12/10/2026  UPI/AIRTEL PREPAID RECHARGE                999.00              83549.50",
        "15/10/2026  NEFT CREDIT INTEREST                                         412.00  83961.50",
        "18/10/2026  UPI/SWIGGY BULBRETAIL                     480.00              83481.50",
        "",
        "This is a computer generated statement.",
    ]
    # Build a content stream that draws each line with Helvetica.
    y = 750
    ops = ["BT", "/F1 10 Tf", "14 TL", f"50 {y} Td"]
    for i, line in enumerate(lines):
        esc = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        if i:
            ops.append("T*")
        ops.append(f"({esc}) Tj")
    ops.append("ET")
    stream = "\n".join(ops).encode("latin-1")

    catalog = b"<< /Type /Catalog /Pages 2 0 R >>"
    pages = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
    page = (
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
    )
    contents = (
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream"
    )
    font = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    return assemble([catalog, pages, page, contents, font])


def scanned_pdf():
    """Image-only PDF: a 120x160 gray 'scan' with NO text layer at all."""
    width, height = 120, 160
    # Fake scan: white background with a dark border + a few "text" bars.
    rows = []
    for yy in range(height):
        row = bytearray()
        for xx in range(width):
            edge = xx in (0, width - 1) or yy in (0, height - 1)
            bar = (8 <= yy <= 14 and 10 <= xx <= width - 10) or (
                20 <= yy <= 100 and xx % 17 < 11 and yy % 7 in (0, 1)
            )
            row.append(40 if (edge or bar) else 245)
        rows.append(bytes(row))
    raw = b"".join(rows)
    data = zlib.compress(raw, 9)

    image = (
        f"<< /Type /XObject /Subtype /Image /Width {width} /Height {height} "
        f"/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode "
        f"/Length {len(data)} >>\nstream\n".encode()
        + data
        + b"\nendstream"
    )
    # Content: place the image over most of the page. No text operators.
    content = b"q 512 0 0 680 50 60 cm /Im0 Do Q"
    contents = (
        f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream"
    )

    catalog = b"<< /Type /Catalog /Pages 2 0 R >>"
    pages = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
    page = (
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>"
    )
    return assemble([catalog, pages, page, contents, image])


def encrypt_pdf(src_path, dst_path, password="demo123"):
    from pypdf import PdfWriter

    writer = PdfWriter(clone_from=src_path)
    # RC4-128 for maximum pdf.js compatibility across pdf-parse versions.
    writer.encrypt(user_password=password, algorithm="RC4-128")
    with open(dst_path, "wb") as fh:
        writer.write(fh)


def main():
    text_path = os.path.join(OUT, "_text_base.pdf")
    scanned_path = os.path.join(OUT, "scanned_statement.pdf")
    locked_path = os.path.join(OUT, "locked_statement.pdf")

    with open(text_path, "wb") as fh:
        fh.write(text_pdf())
    with open(scanned_path, "wb") as fh:
        fh.write(scanned_pdf())
    encrypt_pdf(text_path, locked_path)
    os.remove(text_path)  # base file is an intermediate, not a fixture

    for name in ("locked_statement.pdf", "scanned_statement.pdf"):
        size = os.path.getsize(os.path.join(OUT, name))
        print(f"wrote {name} ({size} bytes)")


if __name__ == "__main__":
    main()
