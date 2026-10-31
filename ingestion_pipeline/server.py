import os
import logging
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from .auth_manager import (
    generate_authorization_url,
    handle_oauth_callback,
    get_user_gmail_service,
    TokenNotFoundError,
    TokenRevokedOrInvalidError,
    OAuthConfigurationError
)
from .user_profile import UserProfile
from .email_fetcher import GmailStatementFetcher
from .gemini_parser import StatementData
from .firestore_storage import FirestoreStatementRepository
from .pipeline import StatementIngestionService

logger = logging.getLogger("AuthAPIServer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Money Matters - Credit Card Ingestion & OAuth Server",
    description="OAuth 2.0 Gmail connector and multimodal credit card statement ingestion pipeline",
    version="1.0.0"
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
    return {
        "service": "Credit Card Ingestion & OAuth Service",
        "status": "online",
        "docs": "/docs"
    }


@app.get("/auth/google/url")
def get_google_auth_url(userId: str = Query(..., description="Unique User identifier")):
    """
    Step 1: Returns authorization URL for Google OAuth 2.0 with offline access
    and state set to the provided userId.
    """
    try:
        url = generate_authorization_url(user_id=userId)
        return {"success": True, "userId": userId, "authorization_url": url}
    except OAuthConfigurationError as oce:
        raise HTTPException(status_code=500, detail=str(oce))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error generating auth URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate authorization URL.")


@app.get("/auth/google/callback")
def google_auth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None
):
    """
    Step 2: Receives code and state (userId) from Google OAuth consent screen,
    exchanges code for credentials, and persists tokens to Firestore.
    """
    if error:
        logger.warning(f"User denied OAuth consent or error returned: {error}")
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": f"Authorization denied by user: {error}"}
        )

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing required 'code' or 'state' parameters in callback.")

    try:
        result = handle_oauth_callback(code=code, state=state)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"OAuth code exchange failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to complete OAuth authentication: {str(e)}")


@app.post("/sync-statements/{userId}")
def sync_statements_for_user(userId: str, user_profile: Optional[UserProfile] = None):
    """
    Step 3: Ingestion Trigger Endpoint
    - Fetches the user's stored refresh token from Firestore.
    - Automatically refreshes credentials to initialize Google Gmail client.
    - Passes the authenticated Gmail client into StatementIngestionService.
    - Decrypts in-memory, executes Gemini multimodal extraction, and saves idempotently to Firestore.
    """
    try:
        # Retrieve authenticated Gmail client
        gmail_service = get_user_gmail_service(userId)
    except TokenNotFoundError as tnfe:
        raise HTTPException(
            status_code=401,
            detail=f"{str(tnfe)} Please initiate OAuth via /auth/google/url?userId={userId}"
        )
    except TokenRevokedOrInvalidError as trie:
        raise HTTPException(
            status_code=401,
            detail=f"Token invalid or revoked: {str(trie)}. Re-authorization required."
        )
    except Exception as e:
        logger.error(f"Failed to acquire user Gmail service: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to initialize Gmail client.")

    # Resolve User Profile for password derivation
    profile = user_profile or USER_PROFILES.get(userId)
    if not profile:
        # Provide default fallback profile structure
        profile = UserProfile(
            full_name=userId,
            dob="2000-01-01",
            pan_number="ABCDE1234F",
            registered_mobile="9999999999",
            known_cards={}
        )

    fetcher = GmailStatementFetcher(service=gmail_service)
    storage = FirestoreStatementRepository()
    pipeline = StatementIngestionService(
        user_profile=profile,
        firestore_repo=storage,
        gmail_fetcher=fetcher
    )

    try:
        statements = pipeline.run_gmail_ingestion(user_id=userId)
        return SyncResponse(
            success=True,
            userId=userId,
            statements_synced=len(statements),
            statements=statements
        )
    except Exception as e:
        logger.error(f"Statement sync failed for user {userId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline ingestion failed: {str(e)}")
