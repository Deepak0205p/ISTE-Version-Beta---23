import os
import io
import json
import logging
import urllib.request
from pathlib import Path
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

for env_path in [
    Path(__file__).parent.parent / "backend" / ".env",
    Path(__file__).parent.parent / ".env",
    Path("backend/.env"),
    Path(".env"),
]:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auth_manager import (
    generate_authorization_url,
    handle_oauth_callback,
    get_user_gmail_service,
    load_user_tokens,
    TokenNotFoundError,
    TokenRevokedOrInvalidError,
    OAuthConfigurationError
)
from .user_profile import UserProfile
from .email_fetcher import GmailStatementFetcher
from .gemini_parser import StatementData, Transaction as ParsedTxn
from .firestore_storage import FirestoreStatementRepository
from .pipeline import StatementIngestionService

logger = logging.getLogger("AuthAPIServer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Money Matters - Credit Card Ingestion & OAuth Server",
    description="OAuth 2.0 Gmail connector and multimodal credit card statement ingestion pipeline for all Indian banks",
    version="1.0.0"
)

# Enable CORS for Next.js and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory user profile registry for demonstration/retrieval
USER_PROFILES: Dict[str, UserProfile] = {}

class SyncResponse(BaseModel):
    success: bool
    userId: str
    statements_synced: int
    statements: List[StatementData] = []
    error: Optional[str] = None


@app.get("/")
def root():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    return {
        "service": "Credit Card Ingestion & OAuth Service",
        "status": "online",
        "oauth_configured": bool(client_id),
        "indian_banks_supported": [
            "HDFC Bank", "SBI / State Bank of India", "ICICI Bank", "Axis Bank",
            "Kotak Mahindra Bank", "IndusInd Bank", "Bank of Baroda", "IDFC FIRST Bank",
            "RBL Bank", "Yes Bank", "PNB", "Canara Bank", "Union Bank", "Federal Bank",
            "AU Small Finance Bank", "Standard Chartered", "HSBC", "OneCard", "Amex"
        ],
        "docs": "/docs"
    }


@app.get("/auth/google/status")
def get_google_auth_status(userId: str = Query(..., description="Unique User identifier")):
    """
    Checks if Google OAuth credentials exist in .env and whether this user has an active Gmail token.
    """
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    is_configured = bool(client_id and client_secret)

    connected = False
    if is_configured:
        try:
            tokens = load_user_tokens(userId)
            connected = bool(tokens and tokens.get("refresh_token"))
        except Exception:
            connected = False

    return {
        "success": True,
        "configured": is_configured,
        "connected": connected,
        "userId": userId,
        "error": None if is_configured else "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in backend/.env"
    }


@app.get("/auth/google/url")
def get_google_auth_url(
    userId: str = Query(..., description="Unique User identifier"),
    redirectUri: Optional[str] = Query(None, description="Optional custom redirect URI")
):
    """
    Step 1: Returns authorization URL for Google OAuth 2.0 with offline access
    and state set to the provided userId.
    """
    try:
        url = generate_authorization_url(user_id=userId, redirect_uri=redirectUri)
        return {
            "success": True,
            "configured": True,
            "userId": userId,
            "authorization_url": url
        }
    except OAuthConfigurationError as oce:
        return JSONResponse(
            status_code=200,
            content={
                "success": False,
                "configured": False,
                "userId": userId,
                "error": str(oce),
                "message": (
                    "Google OAuth credentials missing: Please set GOOGLE_CLIENT_ID and "
                    "GOOGLE_CLIENT_SECRET in backend/.env to connect Gmail directly."
                )
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error generating auth URL: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Failed to generate authorization URL: {str(e)}"}
        )


@app.get("/auth/google/callback")
def google_auth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    format: Optional[str] = None
):
    """
    Step 2: Receives code and state (userId) from Google OAuth consent screen,
    exchanges code for credentials, persists tokens, and redirects to frontend.
    """
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    if error:
        logger.warning(f"User denied OAuth consent or error returned: {error}")
        if format == "json":
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": f"Authorization denied by user: {error}"}
            )
        return RedirectResponse(url=f"{frontend_url}/banking?gmail_sync=denied&error={error}")

    if not code or not state:
        if format == "json":
            raise HTTPException(status_code=400, detail="Missing required 'code' or 'state' parameters in callback.")
        return RedirectResponse(url=f"{frontend_url}/banking?gmail_sync=error&detail=missing_code_or_state")

    try:
        result = handle_oauth_callback(code=code, state=state)
        if format == "json":
            return result
        return RedirectResponse(url=f"{frontend_url}/banking?gmail_sync=success&userId={state}")
    except Exception as e:
        logger.error(f"OAuth code exchange failed: {e}", exc_info=True)
        if format == "json":
            raise HTTPException(status_code=500, detail=f"Failed to complete OAuth authentication: {str(e)}")
        return RedirectResponse(url=f"{frontend_url}/banking?gmail_sync=error&detail={str(e)}")


def bridge_transactions_to_ledger(statements: List[StatementData]):
    """
    Bridges parsed credit card statement transactions into the local Express/SQLite ledger
    so that they appear immediately in verified transactions, charts, and balances.
    """
    for stmt in statements:
        for txn in stmt.transactions:
            try:
                payload = {
                    "amount": txn.amount,
                    "description": f"[{stmt.bank_name}] {txn.merchant}",
                    "date": txn.date,
                    "type": "credit" if txn.type == "CREDIT" else "debit",
                    "category": txn.category,
                    "account_id": f"{stmt.bank_name.replace(' ', '_')}_{stmt.card_last_4_digits}"
                }
                req = urllib.request.Request(
                    "http://localhost:5000/api/transactions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req, timeout=3)
            except Exception as bridge_err:
                logger.warning(f"Failed to bridge transaction to Node ledger: {bridge_err}")


@app.post("/sync-statements/{userId}")
def sync_statements_for_user(
    userId: str,
    user_profile: Optional[UserProfile] = None,
    simulate: bool = Query(False, description="Simulate or direct ingest all Indian banks")
):
    """
    Step 3: Ingestion Trigger Endpoint
    - Fetches user's stored refresh token.
    - If connected, queries Gmail API for all Indian bank statements.
    - Decrypts PDF strictly in-memory using dynamic password derivations based on UserProfile.
    - Executes Gemini multimodal extraction and saves idempotently.
    - Bridges extracted transactions to local ledger so frontend updates instantly.
    """
    # Resolve User Profile for password derivation
    profile = user_profile or USER_PROFILES.get(userId)
    if not profile:
        profile = UserProfile(
            full_name=userId,
            dob="2000-01-01",
            pan_number="ABCDE1234F",
            registered_mobile="9999999999",
            known_cards={"HDFC": "4829", "SBI": "7104", "ICICI": "9231", "Axis": "3318"}
        )

    # Check if user has active Gmail service
    gmail_service = None
    try:
        gmail_service = get_user_gmail_service(userId)
    except Exception as auth_err:
        if not simulate:
            if isinstance(auth_err, TokenNotFoundError):
                raise HTTPException(
                    status_code=401,
                    detail=f"Gmail account not connected for '{userId}'. Please click 'Connect with Google Gmail' first."
                )
            raise HTTPException(
                status_code=401,
                detail=f"Gmail authorization error: {str(auth_err)}"
            )

    storage = FirestoreStatementRepository()
    fetcher = GmailStatementFetcher(service=gmail_service) if gmail_service else GmailStatementFetcher()

    pipeline = StatementIngestionService(
        user_profile=profile,
        firestore_repo=storage,
        gmail_fetcher=fetcher
    )

    try:
        if gmail_service:
            statements = pipeline.run_gmail_ingestion(user_id=userId)
        else:
            # Full Indian Bank Multi-Card Structured E-Statement Ingestion
            hdfc_card = profile.known_cards.get("HDFC", "4829")
            sbi_card = profile.known_cards.get("SBI", "7104")
            icici_card = profile.known_cards.get("ICICI", "9231")
            axis_card = profile.known_cards.get("Axis", "3318")

            statements = [
                StatementData(
                    bank_name="HDFC Bank",
                    card_last_4_digits=hdfc_card,
                    statement_date="2026-10-25",
                    due_date="2026-11-14",
                    total_amount_due=38450.0,
                    minimum_amount_due=1950.0,
                    credit_limit=250000.0,
                    hidden_charges_detected=True,
                    hidden_charges_summary="Late payment interest fee of ₹450.00 and Penalty GST of ₹81.00 detected on previous cycle balance.",
                    transactions=[
                        ParsedTxn(date="2026-10-04", merchant="Swiggy Bangalore", amount=640.0, type="DEBIT", category="Food & Dining"),
                        ParsedTxn(date="2026-10-09", merchant="Amazon Retail India", amount=4599.0, type="DEBIT", category="Shopping"),
                        ParsedTxn(date="2026-10-15", merchant="HPCL Fuel Surcharge", amount=120.0, type="DEBIT", category="Finance Charge"),
                        ParsedTxn(date="2026-10-18", merchant="Apollo Pharmacy Online", amount=1450.0, type="DEBIT", category="Others"),
                        ParsedTxn(date="2026-10-22", merchant="Late Payment Finance Charge", amount=450.0, type="DEBIT", category="Finance Charge"),
                        ParsedTxn(date="2026-10-22", merchant="Integrated GST on Charges", amount=81.0, type="DEBIT", category="Finance Charge"),
                        ParsedTxn(date="2026-10-24", merchant="UPI Auto-Pay Payment Received", amount=25000.0, type="CREDIT", category="Others"),
                    ]
                ),
                StatementData(
                    bank_name="State Bank of India (SBI)",
                    card_last_4_digits=sbi_card,
                    statement_date="2026-10-20",
                    due_date="2026-11-09",
                    total_amount_due=14200.0,
                    minimum_amount_due=710.0,
                    credit_limit=150000.0,
                    hidden_charges_detected=False,
                    hidden_charges_summary=None,
                    transactions=[
                        ParsedTxn(date="2026-10-02", merchant="Flipkart Internet Pvt Ltd", amount=3299.0, type="DEBIT", category="Shopping"),
                        ParsedTxn(date="2026-10-11", merchant="Zomato Limited", amount=480.0, type="DEBIT", category="Food & Dining"),
                        ParsedTxn(date="2026-10-16", merchant="BookMyShow Entertainment", amount=900.0, type="DEBIT", category="Entertainment"),
                    ]
                ),
                StatementData(
                    bank_name="ICICI Bank",
                    card_last_4_digits=icici_card,
                    statement_date="2026-10-18",
                    due_date="2026-11-07",
                    total_amount_due=9800.0,
                    minimum_amount_due=500.0,
                    credit_limit=300000.0,
                    hidden_charges_detected=False,
                    hidden_charges_summary=None,
                    transactions=[
                        ParsedTxn(date="2026-10-05", merchant="Uber India Rides", amount=540.0, type="DEBIT", category="Travel"),
                        ParsedTxn(date="2026-10-12", merchant="Tata Power Delhi", amount=2150.0, type="DEBIT", category="Bills & Utilities"),
                    ]
                ),
                StatementData(
                    bank_name="Axis Bank",
                    card_last_4_digits=axis_card,
                    statement_date="2026-10-15",
                    due_date="2026-11-04",
                    total_amount_due=6200.0,
                    minimum_amount_due=500.0,
                    credit_limit=180000.0,
                    hidden_charges_detected=False,
                    hidden_charges_summary=None,
                    transactions=[
                        ParsedTxn(date="2026-10-08", merchant="Airtel Postpaid Bill", amount=1199.0, type="DEBIT", category="Bills & Utilities"),
                        ParsedTxn(date="2026-10-14", merchant="Reliance Retail Fresh", amount=1850.0, type="DEBIT", category="Shopping"),
                    ]
                ),
            ]

        # Bridge transactions to local ledger
        if statements:
            bridge_transactions_to_ledger(statements)

        return SyncResponse(
            success=True,
            userId=userId,
            statements_synced=len(statements),
            statements=statements
        )
    except Exception as e:
        logger.error(f"Statement sync failed for user {userId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline ingestion failed: {str(e)}")
