import os
import io
import sys
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

from .user_profile import UserProfile, generate_bank_passwords
from .pdf_decryptor import decrypt_statement_stream, DecryptionError
from .email_fetcher import GmailStatementFetcher, EmailAttachment
from .gemini_parser import GeminiStatementParser, StatementData
from .firestore_storage import FirestoreStatementRepository

load_dotenv()
logger = logging.getLogger("StatementIngestionPipeline")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

class StatementIngestionService:
    """
    End-to-End Orchestrator:
    1. Reads user profile identifiers.
    2. Dynamically derives password strategies per bank.
    3. Fetches attachments from Gmail via OAuth 2.0 or accepts custom streams.
    4. Decrypts PDF strictly in-memory via pikepdf.
    5. Extracts structured financial data and hidden charges via Gemini multimodal API.
    6. Stores records idempotently in Firebase Firestore.
    """
    def __init__(
        self,
        user_profile: UserProfile,
        gemini_api_key: Optional[str] = None,
        firestore_repo: Optional[FirestoreStatementRepository] = None,
        gmail_fetcher: Optional[GmailStatementFetcher] = None,
    ):
        self.user = user_profile
        self.gemini_parser = GeminiStatementParser(api_key=gemini_api_key)
        self.firestore_repo = firestore_repo
        self.gmail_fetcher = gmail_fetcher or GmailStatementFetcher()

    def process_pdf_stream(
        self,
        pdf_stream: io.BytesIO,
        bank_hint: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> StatementData:
        """
        Processes a single in-memory statement stream.
        """
        # Step 1: Generate candidates
        candidates = generate_bank_passwords(self.user, bank_hint)
        logger.info(f"Generated {len(candidates)} candidate password variations for bank hint: '{bank_hint}'")

        # Step 2: In-memory Decryption
        try:
            decrypted_stream, used_pwd = decrypt_statement_stream(pdf_stream, candidates)
            logger.info(f"Successfully unlocked PDF using strategy: '{used_pwd if used_pwd else 'Unencrypted document'}'")
        except DecryptionError as de:
            logger.error(f"Decryption failed: {de}")
            raise

        # Step 3: Multimodal Extraction via Gemini
        logger.info("Sending decrypted PDF stream to Gemini API for structured extraction...")
        statement_data = self.gemini_parser.parse_statement(decrypted_stream, detected_bank=bank_hint)
        logger.info(
            f"Extraction successful: Bank={statement_data.bank_name}, Card=..{statement_data.card_last_4_digits}, "
            f"Total Due=₹{statement_data.total_amount_due:,.2f}, Transactions={len(statement_data.transactions)}"
        )
        if statement_data.hidden_charges_detected:
            logger.warning(f"HIDDEN CHARGES DETECTED: {statement_data.hidden_charges_summary}")

        # Step 4: Idempotent Firestore Storage
        if self.firestore_repo:
            target_user_id = user_id or self.user.pan_number
            doc_id = self.firestore_repo.save_statement(target_user_id, statement_data, raw_metadata=metadata)
            logger.info(f"Statement persisted idempotently in Firestore with ID: {doc_id}")

        return statement_data

    def run_gmail_ingestion(self, user_id: Optional[str] = None) -> List[StatementData]:
        """
        Polls Gmail for matching credit card statements, decrypts and parses them.
        """
        logger.info("Checking Gmail for credit card e-statements...")
        attachments = self.gmail_fetcher.fetch_statement_attachments()
        logger.info(f"Found {len(attachments)} matching e-statement PDF attachments.")

        results = []
        for att in attachments:
            bank = att.detect_bank_name()
            logger.info(f"Processing attachment '{att.filename}' from '{att.sender}' (Detected Bank: {bank})")
            try:
                data = self.process_pdf_stream(
                    pdf_stream=att.content,
                    bank_hint=bank,
                    user_id=user_id,
                    metadata={"subject": att.subject, "from": att.sender, "date": att.date}
                )
                results.append(data)
            except Exception as e:
                logger.error(f"Failed to process '{att.filename}': {e}", exc_info=True)

        return results
