import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

for env_path in [
    Path(__file__).parent.parent / "backend" / ".env",
    Path(__file__).parent.parent / ".env",
    Path("backend/.env"),
    Path(".env"),
]:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)

import firebase_admin
from firebase_admin import credentials, firestore
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build, Resource

logger = logging.getLogger("AuthManager")
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

LOCAL_TOKEN_FILE = Path(__file__).parent.parent / "backend" / "data" / "gmail_tokens.json"

def get_firestore_client() -> Optional[firestore.firestore.Client]:
    """
    Initializes and returns Cloud Firestore client if service account credentials exist.
    Never throws ADC DefaultCredentialsError.
    """
    try:
        service_account_path = (
            os.environ.get("FIREBASE_SERVICE_ACCOUNT")
            or os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        )
        project_id = os.environ.get("FIREBASE_PROJECT_ID") or ""

        if not firebase_admin._apps:
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred, {"projectId": project_id})
                return firestore.client()
            else:
                # Do not trigger ADC throw in local dev
                return None
        return firestore.client()
    except Exception as e:
        logger.debug(f"Firestore Admin not available: {e}")
        return None


def save_user_tokens(user_id: str, token_data: Dict[str, Any]) -> None:
    """
    Persists tokens locally in backend/data/gmail_tokens.json and mirrors to Firestore if available.
    """
    # 1. Local disk persistence
    try:
        LOCAL_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        tokens_map = {}
        if LOCAL_TOKEN_FILE.exists():
            try:
                with open(LOCAL_TOKEN_FILE, "r", encoding="utf-8") as f:
                    tokens_map = json.load(f)
            except Exception:
                tokens_map = {}
        tokens_map[user_id] = token_data
        with open(LOCAL_TOKEN_FILE, "w", encoding="utf-8") as f:
            json.dump(tokens_map, f, indent=2)
    except Exception as le:
        logger.warning(f"Failed to write local token file: {le}")

    # 2. Firestore persistence
    try:
        db = get_firestore_client()
        if db:
            token_ref = db.collection("users").document(user_id).collection("tokens").document("gmail")
            token_ref.set(token_data, merge=True)
    except Exception as fe:
        logger.warning(f"Could not persist tokens to Firestore (fallback to local): {fe}")


def load_user_tokens(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves stored tokens from local storage or Firestore.
    """
    # 1. Local file first
    if LOCAL_TOKEN_FILE.exists():
        try:
            with open(LOCAL_TOKEN_FILE, "r", encoding="utf-8") as f:
                tokens_map = json.load(f)
                if user_id in tokens_map:
                    return tokens_map[user_id]
        except Exception:
            pass

    # 2. Firestore fallback
    try:
        db = get_firestore_client()
        if db:
            token_ref = db.collection("users").document(user_id).collection("tokens").document("gmail")
            snap = token_ref.get()
            if snap.exists:
                return snap.to_dict()
    except Exception:
        pass

    return None


class OAuthConfigurationError(Exception):
    pass


class TokenNotFoundError(Exception):
    pass


class TokenRevokedOrInvalidError(Exception):
    pass


def get_oauth_client_config(redirect_uri: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieves Google OAuth 2.0 client configuration from environment variables.
    """
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    effective_redirect = redirect_uri or os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

    if not client_id or not client_secret:
        raise OAuthConfigurationError(
            "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables. "
            "Please configure your Google OAuth 2.0 credentials in backend/.env"
        )

    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [effective_redirect, "http://localhost:8000/auth/google/callback", "http://localhost:3000/auth/google/callback"],
        }
    }


def create_oauth_flow(state: Optional[str] = None, redirect_uri: Optional[str] = None) -> Flow:
    """
    Builds the Google OAuth 2.0 Flow instance.
    """
    client_config = get_oauth_client_config(redirect_uri=redirect_uri)
    effective_redirect = redirect_uri or os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    
    flow = Flow.from_client_config(
        client_config=client_config,
        scopes=GMAIL_SCOPES,
        state=state
    )
    flow.redirect_uri = redirect_uri or os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    return flow


def generate_authorization_url(user_id: str, redirect_uri: Optional[str] = None) -> str:
    """
    Generates a Google OAuth 2.0 consent URL for a specific user.
    """
    if not user_id or not user_id.strip():
        raise ValueError("A valid user_id is required to generate the authorization URL.")

    flow = create_oauth_flow(state=user_id, redirect_uri=redirect_uri)
    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true"
    )
    return authorization_url


def handle_oauth_callback(code: str, state: str) -> Dict[str, Any]:
    """
    Exchanges authorization code for credentials and securely persists
    them under users/{userId}/tokens/gmail and local storage.
    """
    if not code:
        raise ValueError("Authorization code is missing from callback.")
    if not state:
        raise ValueError("Missing state (userId) in callback payload.")

    user_id = state
    flow = create_oauth_flow(state=user_id, redirect_uri=redirect_uri)

    # Allow insecure transport in development localhost environments
    if os.environ.get("NODE_ENV") != "production":
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    flow.fetch_token(code=code)
    credentials = flow.credentials

    token_data = {
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "updatedAt": datetime.utcnow().isoformat()
    }

    save_user_tokens(user_id, token_data)

    return {
        "success": True,
        "userId": user_id,
        "message": "Gmail tokens saved successfully."
    }


def get_user_gmail_service(user_id: str) -> Resource:
    """
    Fetches the user's stored refresh token, refreshes it,
    and returns an initialized Google Gmail API service resource.
    """
    if not user_id:
        raise ValueError("userId is required to fetch Gmail credentials.")

    token_data = load_user_tokens(user_id)

    if not token_data or not token_data.get("refresh_token"):
        raise TokenNotFoundError(f"No Gmail authorization tokens found for user '{user_id}'.")

    refresh_token = token_data.get("refresh_token")
    client_id = token_data.get("client_id") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = token_data.get("client_secret") or os.environ.get("GOOGLE_CLIENT_SECRET")
    token_uri = token_data.get("token_uri") or "https://oauth2.googleapis.com/token"

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=GMAIL_SCOPES
    )

    try:
        creds.refresh(Request())
    except RefreshError as re:
        raise TokenRevokedOrInvalidError(f"Failed to refresh user credentials: {re}")
    except Exception as e:
        raise TokenRevokedOrInvalidError(f"Unexpected error refreshing credentials: {e}")

    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    return service
