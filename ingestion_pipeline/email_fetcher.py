import os
import io
import base64
from typing import List, Optional, Dict, Any, Generator
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

class EmailAttachment:
    def __init__(self, message_id: str, sender: str, subject: str, filename: str, content: io.BytesIO, date: str):
        self.message_id = message_id
        self.sender = sender
        self.subject = subject
        self.filename = filename
        self.content = content
        self.date = date

    def detect_bank_name(self) -> str:
        text = f"{self.sender} {self.subject} {self.filename}".upper()
        if "HDFC" in text:
            return "HDFC"
        if "SBI" in text or "SBICARD" in text:
            return "SBI"
        if "ICICI" in text:
            return "ICICI"
        if "AXIS" in text:
            return "AXIS"
        if "KOTAK" in text:
            return "KOTAK"
        if "AMEX" in text or "AMERICAN EXPRESS" in text:
            return "AMEX"
        return "UNKNOWN"


class GmailStatementFetcher:
    """
    Ingests bank e-statement PDFs directly via Gmail API using OAuth 2.0.
    Stores all attachments strictly in-memory (io.BytesIO), never writing to disk.
    """
    def __init__(self, credentials_path: str = "credentials.json", token_path: str = "token.json"):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.service = None

    def authenticate(self) -> None:
        creds = None
        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_path):
                    raise FileNotFoundError(
                        f"OAuth Client Secret credentials file '{self.credentials_path}' not found. "
                        "Download it from Google Cloud Console."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
            with open(self.token_path, "w") as token:
                token.write(creds.to_json())

        self.service = build("gmail", "v1", credentials=creds)

    def fetch_statement_attachments(
        self,
        query: str = 'from:(*@hdfcbank.com OR *@sbicard.com OR *@icicibank.com OR *@axisbank.com) subject:("statement" OR "e-statement") has:attachment',
        max_results: int = 10
    ) -> List[EmailAttachment]:
        if not self.service:
            self.authenticate()

        results = self.service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
        messages = results.get("messages", [])
        attachments: List[EmailAttachment] = []

        for msg_meta in messages:
            msg_id = msg_meta["id"]
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

        return attachments
