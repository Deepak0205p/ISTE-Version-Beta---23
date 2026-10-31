import os
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from .gemini_parser import StatementData

class FirestoreStatementRepository:
    """
    Idempotent Firestore storage layer for credit card statements and itemized transactions.
    Constructs deterministic document keys:
      statement_id = sha256(f"{bank_name}_{card_last_4}_{statement_date}_{total_amount_due}")
    Ensures safe, duplicate-proof re-ingestion.
    """
    def __init__(self, service_account_path: Optional[str] = None):
        self.service_account_path = (
            service_account_path
            or os.environ.get("FIREBASE_SERVICE_ACCOUNT")
            or os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        )
        self.project_id = os.environ.get("FIREBASE_PROJECT_ID") or "money-matters-207e8"
        self._init_firebase()
        self.db = firestore.client()

    def _init_firebase(self) -> None:
        if not firebase_admin._apps:
            if self.service_account_path and os.path.exists(self.service_account_path):
                cred = credentials.Certificate(self.service_account_path)
                firebase_admin.initialize_app(cred, {"projectId": self.project_id})
            else:
                # Fallback to Application Default Credentials with explicit projectId
                firebase_admin.initialize_app(options={"projectId": self.project_id})

    @staticmethod
    def generate_statement_id(statement: StatementData) -> str:
        unique_key = f"{statement.bank_name.upper().strip()}_{statement.card_last_4_digits}_{statement.statement_date}_{statement.total_amount_due:.2f}"
        return hashlib.sha256(unique_key.encode("utf-8")).hexdigest()

    def save_statement(self, user_id: str, statement: StatementData, raw_metadata: Optional[Dict[str, Any]] = None) -> str:
        statement_id = self.generate_statement_id(statement)
        doc_ref = self.db.collection("users").document(user_id).collection("credit_card_statements").document(statement_id)

        statement_payload = statement.model_dump()
        statement_payload["statement_id"] = statement_id
        statement_payload["user_id"] = user_id
        statement_payload["ingested_at"] = datetime.utcnow().isoformat()
        if raw_metadata:
            statement_payload["metadata"] = raw_metadata

        # Idempotent write using merge=True
        doc_ref.set(statement_payload, merge=True)

        # Batch write individual transactions into subcollection for fast querying
        batch = self.db.batch()
        txns_collection = doc_ref.collection("transactions")
        
        for idx, txn in enumerate(statement.transactions):
            txn_key = f"{txn.date}_{txn.amount:.2f}_{txn.type}_{txn.merchant[:20]}"
            txn_id = hashlib.sha256(txn_key.encode("utf-8")).hexdigest()
            txn_ref = txns_collection.document(txn_id)
            
            txn_data = txn.model_dump()
            txn_data["txn_id"] = txn_id
            txn_data["statement_id"] = statement_id
            batch.set(txn_ref, txn_data, merge=True)

        batch.commit()
        return statement_id
