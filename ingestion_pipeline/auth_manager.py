import os
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

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def get_firestore_client() -> firestore.firestore.Client:
    """
    Initializes and returns the shared Cloud Firestore client.
    Reads credentials from FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH,
    falling back to FIREBASE_PROJECT_ID configuration.
    """
    if not firebase_admin._apps:
        service_account_path = (
            os.environ.get("FIREBASE_SERVICE_ACCOUNT")
            or os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        )
        project_id = os.environ.get("FIREBASE_PROJECT_ID") or ""
        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred, {"projectId": project_id})
        else:
            firebase_admin.initialize_app(options={"projectId": project_id})
    return firestore.client()


class OAuthConfigurationError(Exception):
    pass


class TokenNotFoundError(Exception):
    pass


class TokenRevokedOrInvalidError(Exception):
    pass


def get_oauth_client_config() -> Dict[str, Any]:
    """
    Retrieves Google OAuth 2.0 client configuration from environment variables.
    """
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

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
            "redirect_uris": [redirect_uri],
        }
    }


def create_oauth_flow(state: Optional[str] = None) -> Flow:
    """
    Builds the Google OAuth 2.0 Flow instance.
    """
    client_config = get_oauth_client_config()
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    
    flow = Flow.from_client_config(
        client_config=client_config,
        scopes=GMAIL_SCOPES,
        state=state
    )
    flow.redirect_uri = redirect_uri
    return flow


def generate_authorization_url(user_id: str) -> str:
    """
    Generates a Google OAuth 2.0 consent URL for a specific user.
    """
    if not user_id or not user_id.strip():
        raise ValueError("A valid user_id is required to generate the authorization URL.")

    flow = create_oauth_flow(state=user_id)
    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true"
    )
    return authorization_url


def handle_oauth_callback(code: str, state: str) -> Dict[str, Any]:
    """
    Exchanges authorization code for credentials and securely persists
    them in Firestore under users/{userId}/tokens/gmail.
    """
    if not code:
        raise ValueError("Authorization code is missing from callback.")
    if not state:
        raise ValueError("Missing state (userId) in callback payload.")

    user_id = state
    flow = create_oauth_flow(state=user_id)

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

    db = get_firestore_client()
    token_ref = db.collection("users").document(user_id).collection("tokens").document("gmail")
    token_ref.set(token_data, merge=True)

    return {
        "success": True,
        "userId": user_id,
        "message": "Gmail tokens saved successfully."
    }


def get_user_gmail_service(user_id: str) -> Resource:
    """
    Fetches the user's stored refresh token from Firestore, refreshes it,
    and returns an initialized Google Gmail API service resource.
    """
    if not user_id:
        raise ValueError("userId is required to fetch Gmail credentials.")

    db = get_firestore_client()
    token_ref = db.collection("users").document(user_id).collection("tokens").document("gmail")
    snap = token_ref.get()

    if not snap.exists:
        raise TokenNotFoundError(f"No Gmail authorization tokens found for user '{user_id}'.")

    data = snap.to_dict() or {}
    refresh_token = data.get("refresh_token")
    client_id = data.get("client_id") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = data.get("client_secret") or os.environ.get("GOOGLE_CLIENT_SECRET")
    token_uri = data.get("token_uri") or "https://oauth2.googleapis.com/token"

    if not refresh_token:
        raise TokenNotFoundError(f"Stored token document for '{user_id}' does not contain a refresh_token.")

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
