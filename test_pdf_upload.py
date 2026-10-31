import urllib.request
import json

pdf_sample = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 12 Tf
50 750 Td
(Date: 2026-02-01 Narration: SALARY CREDIT Amount: 75000.00 Cr) Tj
0 -20 Td
(Date: 2026-02-05 Narration: UBER RIDE Amount: 350.00 Dr) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000196 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
366
%%EOF"""

boundary = "----WebKitFormBoundaryXf8R1jWq"
body = bytearray()
body.extend(f"--{boundary}\r\n".encode())
body.extend(b'Content-Disposition: form-data; name="account_label"\r\n\r\n')
body.extend(b"HDFC-Savings\r\n")
body.extend(f"--{boundary}\r\n".encode())
body.extend(b'Content-Disposition: form-data; name="files"; filename="bank_stmt.pdf"\r\nContent-Type: application/pdf\r\n\r\n')
body.extend(pdf_sample + b"\r\n")
body.extend(f"--{boundary}--\r\n".encode())

req = urllib.request.Request(
    "http://localhost:5000/api/upload",
    data=bytes(body),
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        print("Direct Backend status:", resp.status)
        print(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("Direct Backend HTTP Error:", e.code, e.read().decode("utf-8"))
except Exception as e:
    print("Direct Backend Error:", e)

req_front = urllib.request.Request(
    "http://localhost:3000/api/upload",
    data=bytes(body),
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)
try:
    with urllib.request.urlopen(req_front, timeout=30) as resp:
        print("Via Next.js status:", resp.status)
        print(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("Via Next.js HTTP Error:", e.code, e.read().decode("utf-8"))
except Exception as e:
    print("Via Next.js Error:", e)
