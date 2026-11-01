import os
import json
import hashlib
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from .gemini_parser import StatementData

logger = logging.getLogger("FirestoreStatementRepository")
LOCAL_STATEMENT_FILE = Path(__file__).parent.parent / "backend" / "data" / "statements.json"

class FirestoreStatementRepository:
    """
    Idempotent storage layer for credit card statements and itemized transactions.
    Persists to Cloud Firestore if credentials are provided, with guaranteed local fallback.
    """
    def __init__(self, service_account_path: Optional[str] = None):
        self.service_account_path = (
            service_account_path
            or os.environ.get("FIREBASE_SERVICE_ACCOUNT")
            or os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        )
        self.project_id = os.environ.get("FIREBASE_PROJECT_ID") or ""
        self.db = self._init_firebase()

    def _init_firebase(self) -> Optional[firestore.firestore.Client]:
        try:
            if not firebase_admin._apps:
                if self.service_account_path and os.path.exists(self.service_account_path):
                    cred = credentials.Certificate(self.service_account_path)
                    firebase_admin.initialize_app(cred, {"projectId": self.project_id})
                    return firestore.client()
                else:
                    return None
            return firestore.client()
        except Exception as e:
            logger.debug(f"Firestore not available: {e}")
            return None

    @staticmethod
    def generate_statement_id(statement: StatementData) -> str:
        unique_key = f"{statement.bank_name.upper().strip()}_{statement.card_last_4_digits}_{statement.statement_date}_{statement.total_amount_due:.2f}"
        return hashlib.sha256(unique_key.encode("utf-8")).hexdigest()

    def save_statement(self, user_id: str, statement: StatementData, raw_metadata: Optional[Dict[str, Any]] = None) -> str:
        statement_id = self.generate_statement_id(statement)
        statement_payload = statement.model_dump()
        statement_payload["statement_id"] = statement_id
        statement_payload["user_id"] = user_id
        statement_payload["ingested_at"] = datetime.utcnow().isoformat()
        if raw_metadata:
            statement_payload["metadata"] = raw_metadata

        # 1. Local storage persistence
        try:
            LOCAL_STATEMENT_FILE.parent.mkdir(parents=True, exist_ok=True)
            existing_data = {}
            if LOCAL_STATEMENT_FILE.exists():
                try:
                    with open(LOCAL_STATEMENT_FILE, "r", encoding="utf-8") as f:
                        existing_data = json.load(f)
                except Exception:
                    existing_data = {}
            user_stmts = existing_data.get(user_id, [])
            # Deduplicate by statement_id
            filtered = [s for s in user_stmts if s.get("statement_id") != statement_id]
            filtered.append(statement_payload)
            existing_data[user_id] = filtered
            with open(LOCAL_STATEMENT_FILE, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, indent=2)
        except Exception as le:
            logger.warning(f"Could not write local statements file: {le}")

        # 2. Firestore persistence
        if self.db:
            try:
                doc_ref = self.db.collection("users").document(user_id).collection("credit_card_statements").document(statement_id)
                doc_ref.set(statement_payload, merge=True)

                batch = self.db.batch()
                txns_collection = doc_ref.collection("transactions")
                for txn in statement.transactions:
                    txn_key = f"{txn.date}_{txn.amount:.2f}_{txn.type}_{txn.merchant[:20]}"
                    txn_id = hashlib.sha256(txn_key.encode("utf-8")).hexdigest()
                    txn_ref = txns_collection.document(txn_id)
                    txn_data = txn.model_dump()
                    txn_data["txn_id"] = txn_id
                    txn_data["statement_id"] = statement_id
                    batch.set(txn_ref, txn_data, merge=True)
                batch.commit()
            except Exception as fe:
                logger.warning(f"Firestore statement write failed: {fe}")

        return statement_id
