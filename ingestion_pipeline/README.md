# Credit Card Statement Ingestion & Multimodal Analytics Pipeline

A production-grade Python FinTech backend for automated e-statement ingestion, in-memory decryption, Gemini multimodal parsing with deterministic Pydantic schemas, and idempotent Firestore persistence.

---

## 🏗️ Architecture & Ingestion Flow

```
[Gmail API (OAuth 2.0)]
         │
         ▼ (Encrypted PDF in-memory stream: io.BytesIO)
[Dynamic Password Permutator (`user_profile.py`)]
         │  (HDFC, SBI, ICICI, Axis, Kotak, PAN matrix)
         ▼
[In-Memory Decryptor (`pdf_decryptor.py` via `pikepdf`)]
         │
         ▼ (Decrypted PDF stream: io.BytesIO - Zero Disk I/O)
[Gemini Multimodal Document Extractor (`gemini_parser.py`)]
         │  (Gemini 2.5 Flash / 1.5 Pro with structured Pydantic schema)
         ▼
[Idempotent Cloud Firestore Repository (`firestore_storage.py`)]
```

---

## 🔒 Security & Privacy Guarantees
* **Zero Disk Persistence:** All PDF streams (encrypted and decrypted) reside exclusively in memory (`io.BytesIO`). Decrypted credentials and statements are never written to disk.
* **Deterministic Deduplication:** Ingestion writes are keyed idempotently:
  ```python
  statement_id = sha256(f"{bank_name}_{card_last_4}_{statement_date}_{total_amount_due}")
  ```

---

## 🚀 Quickstart

### 1. Requirements
* Python 3.10+
* `pip install -r requirements.txt` (or `pip install pikepdf google-genai google-api-python-client google-auth-oauthlib firebase-admin pydantic python-dotenv`)

### 2. Environment Configuration
Create a `.env` file or export:
```env
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_SERVICE_ACCOUNT=path/to/serviceAccountKey.json # Optional, defaults to ADC
```

### 3. Verification Test
```bash
python -m ingestion_pipeline.test_pipeline
```
