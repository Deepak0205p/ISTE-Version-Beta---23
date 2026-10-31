# Credit Card Statement Ingestion & OAuth 2.0 Ingestion Pipeline

A production-grade Python FinTech backend for automated e-statement ingestion, Google OAuth 2.0 Gmail connector, in-memory decryption, Gemini multimodal parsing with deterministic Pydantic schemas, and idempotent Firestore persistence.

---

## 🏗️ Architecture & Ingestion Flow

```
1. [User connects Gmail]
   GET /auth/google/url?userId={userId}
            │  (access_type=offline, prompt=consent, scope=gmail.readonly, state=userId)
            ▼
   Google Consent Screen
            │
            ▼
   GET /auth/google/callback?code={code}&state={userId}
            │  (Exchange code -> Refresh Token)
            ▼
   Stored in Firestore: `users/{userId}/tokens/gmail`

2. [Ingestion Trigger]
   POST /sync-statements/{userId}
            │
            ▼
   Fetch & Refresh Gmail Token (`get_user_gmail_service`)
            │
            ▼ (Encrypted PDF in-memory stream: io.BytesIO)
   Dynamic Password Permutator (`user_profile.py`)
            │  (HDFC, SBI, ICICI, Axis, Kotak, PAN matrix)
            ▼
   In-Memory Decryptor (`pdf_decryptor.py` via `pikepdf`)
            │
            ▼ (Decrypted PDF stream: io.BytesIO - Zero Disk I/O)
   Gemini Multimodal Document Extractor (`gemini_parser.py`)
            │  (Gemini 2.5 Flash with structured Pydantic schema)
            ▼
   Idempotent Cloud Firestore Repository (`firestore_storage.py`)
```

---

## 🔒 Security & Privacy Guarantees
* **Zero Disk Persistence:** All PDF streams (encrypted and decrypted) reside exclusively in memory (`io.BytesIO`). Decrypted credentials and statements are never written to disk.
* **Offline Access & Automatic Refresh:** Refreshes tokens via `credentials.refresh(Request())` transparently.
* **Deterministic Deduplication:** Ingestion writes are keyed idempotently:
  ```python
  statement_id = sha256(f"{bank_name}_{card_last_4}_{statement_date}_{total_amount_due}")
  ```

---

## 🔑 Environment Configuration

Create a `.env` file with:
```env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Gemini AI Key
GEMINI_API_KEY=your_gemini_api_key

# Firebase Firestore (Optional if using Application Default Credentials)
FIREBASE_SERVICE_ACCOUNT=path/to/serviceAccountKey.json
```

---

## 🚀 Running the Server & Testing

### Run Server:
```bash
uvicorn ingestion_pipeline.server:app --host 0.0.0.0 --port 8000 --reload
```

### Run Unit Tests:
```bash
python -m unittest ingestion_pipeline.test_auth
python -m ingestion_pipeline.test_pipeline
```
