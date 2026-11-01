import os
import io
import re
import base64
import logging
from typing import List, Optional, Any, Dict
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

logger = logging.getLogger("GmailStatementFetcher")
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Complete Comprehensive Roster of Indian Banks and Credit Card Providers
INDIAN_BANK_PATTERNS: Dict[str, List[str]] = {
    "HDFC Bank": ["HDFC", "HDFCBANK"],
    "State Bank of India (SBI)": ["SBI", "SBICARD", "STATE BANK"],
    "ICICI Bank": ["ICICI", "ICICIBANK"],
    "Axis Bank": ["AXIS", "AXISBANK"],
    "Kotak Mahindra Bank": ["KOTAK", "KOTAKBANK"],
    "IndusInd Bank": ["INDUSIND"],
    "Bank of Baroda": ["BOB", "BANKOFBARODA", "BOB FINANCIAL", "BOBCARD"],
    "IDFC FIRST Bank": ["IDFC", "IDFCFIRST", "IDFCBANK"],
    "RBL Bank": ["RBL", "RBLBANK", "RATNAKAR"],
    "Yes Bank": ["YES BANK", "YESBANK"],
    "Punjab National Bank (PNB)": ["PNB", "PUNJAB NATIONAL"],
    "Canara Bank": ["CANARA", "CANARABANK"],
    "Union Bank of India": ["UNION BANK", "UNIONBANK"],
    "Federal Bank": ["FEDERAL BANK", "FEDERALBANK"],
    "AU Small Finance Bank": ["AU BANK", "AUBANK", "AU SMALL FINANCE"],
    "Standard Chartered Bank": ["STANDARD CHARTERED", "STANCHARTERED", "SC.COM"],
    "HSBC India": ["HSBC"],
    "American Express": ["AMERICAN EXPRESS", "AMEX"],
    "OneCard": ["ONECARD", "FPL TECH"],
    "Citibank India": ["CITI", "CITIBANK"],
    "IDBI Bank": ["IDBI", "IDBIBANK"],
    "Central Bank of India": ["CENTRAL BANK"],
    "Indian Bank": ["INDIAN BANK", "INDIANBANK"],
    "Bank of India (BOI)": ["BANK OF INDIA", "BOI"],
    "UCO Bank": ["UCO BANK", "UCOBANK"],
    "South Indian Bank": ["SOUTH INDIAN BANK", "SIB"],
    "Bandhan Bank": ["BANDHAN"],
    "Karur Vysya Bank": ["KARUR VYSYA", "KVB"],
    "Jupiter Money / CSB": ["JUPITER", "CSB BANK"],
    "Fi Money / Federal": ["FI MONEY", "EPIFI"],
}

class EmailAttachment:
    def __init__(self, message_id: str, sender: str, subject: str, filename: str, content: io.BytesIO, date: str):
        self.message_id = message_id
        self.sender = sender
        self.subject = subject
        self.filename = filename
        self.content = content
        self.date = date

    def detect_bank_name(self) -> str:
        """
        Scans sender email, subject line, and filename across all Indian bank patterns.
        """
        combined = f"{self.sender} {self.subject} {self.filename}".upper()
        
        for bank_canonical, keywords in INDIAN_BANK_PATTERNS.items():
            for kw in keywords:
                if kw in combined:
                    return bank_canonical

        return "Unknown Indian Bank"


class GmailStatementFetcher:
    """
    Ingests bank e-statement PDFs directly via Gmail API using OAuth 2.0.
    Stores all attachments strictly in-memory (io.BytesIO), never writing to disk.
    Supports all commercial, public, private and neo-banks in India.
    """
    def __init__(
        self,
        service: Optional[Any] = None,
        credentials_path: str = "credentials.json",
        token_path: str = "token.json"
    ):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.service = service

    def authenticate(self) -> None:
        if self.service:
            return

        creds = None
        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_path):
                    raise FileNotFoundError(
                        f"OAuth Client Secret credentials file '{self.credentials_path}' not found."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
            with open(self.token_path, "w") as token:
                token.write(creds.to_json())

        self.service = build("gmail", "v1", credentials=creds)

    def fetch_statement_attachments(
        self,
        query: Optional[str] = None,
        max_results: int = 25
    ) -> List[EmailAttachment]:
        """
        Comprehensive search across all Indian bank domains and generic e-statement attachments.
        """
        if not self.service:
            self.authenticate()

        # Broad, all-encompassing Indian bank statement query
        search_query = query or (
            'subject:(statement OR "e-statement" OR estatement OR "card statement" OR "account statement") '
            'has:attachment filename:pdf'
        )

        logger.info(f"Executing Gmail API search query: {search_query}")
        results = self.service.users().messages().list(userId="me", q=search_query, maxResults=max_results).execute()
        messages = results.get("messages", [])
        logger.info(f"Gmail returned {len(messages)} matching messages for statement query.")

        attachments: List[EmailAttachment] = []

        for msg_meta in messages:
            msg_id = msg_meta["id"]
            try:
                msg = self.service.users().messages().get(userId="me", id=msg_id).execute()
                payload = msg.get("payload", {})
                headers = payload.get("headers", [])

                sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "Unknown")
                subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "")
                date_str = next((h["value"] for h in headers if h["name"].lower() == "date"), "")

                # Traverse MIME parts for PDF attachments
                parts = [payload]
                while parts:
                    part = parts.pop()
                    if part.get("parts"):
                        parts.extend(part.get("parts"))

                    filename = part.get("filename", "")
                    body = part.get("body", {})
                    attachment_id = body.get("attachmentId")

                    if filename.lower().endswith(".pdf") and attachment_id:
                        att = self.service.users().messages().attachments().get(
                            userId="me", messageId=msg_id, id=attachment_id
                        ).execute()
                        file_data = base64.urlsafe_b64decode(att["data"].encode("UTF-8"))
                        
                        stream = io.BytesIO(file_data)
                        stream.seek(0)

                        attachments.append(EmailAttachment(
                            message_id=msg_id,
                            sender=sender,
                            subject=subject,
                            filename=filename,
                            content=stream,
                            date=date_str
                        ))
            except Exception as e:
                logger.warning(f"Error reading message {msg_id}: {e}")

        return attachments
