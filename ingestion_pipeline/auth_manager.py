import os
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build, Resource

load_dotenv()

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
            "Please configure your OAuth credentials."
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
    Generates offline-access consent URL with user_id encapsulated in state.
    """
    if not user_id or not user_id.strip():
        raise ValueError("userId is required to generate the authorization URL.")

    flow = create_oauth_flow(state=user_id)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true"
    )
    return auth_url


def handle_oauth_callback(code: str, state: str) -> Dict[str, Any]:
    """
    Exchanges authorization code for credentials and saves them idempotently in Firestore.
    """
    if not code:
        raise ValueError("Authorization code is missing in callback request.")
    if not state:
        raise ValueError("State parameter (userId) is missing in callback request.")

    user_id = state.strip()
    flow = create_oauth_flow(state=user_id)
    flow.fetch_token(code=code)

    credentials = flow.credentials
    if not credentials.refresh_token:
        # Check if user already had a refresh token saved
        db = get_firestore_client()
        existing_doc = db.collection("users").document(user_id).collection("tokens").document("gmail").get()
        if existing_doc.exists and "refresh_token" in existing_doc.to_dict():
            refresh_token = existing_doc.to_dict()["refresh_token"]
        else:
            raise ValueError(
                "Google did not return a refresh_token and no existing token was found. "
                "Ensure prompt='consent' and access_type='offline' are configured."
            )
    else:
        refresh_token = credentials.refresh_token

    token_data = {
        "refresh_token": refresh_token,
        "token_uri": credentials.token_uri or "https://oauth2.googleapis.com/token",
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
        "updatedAt": datetime.utcnow().isoformat(),
        "status": "ACTIVE"
    }

    db = get_firestore_client()
    doc_ref = db.collection("users").document(user_id).collection("tokens").document("gmail")
    doc_ref.set(token_data, merge=True)

    return {
        "success": True,
        "userId": user_id,
        "message": "Gmail account connected and credentials stored securely."
    }


def get_user_gmail_service(user_id: str) -> Resource:
    """
    Retrieves stored refresh token from Firestore for user, refreshes credentials,
    and returns an active googleapiclient Gmail service instance.
    """
    db = get_firestore_client()
    doc_ref = db.collection("users").document(user_id).collection("tokens").document("gmail")
    snapshot = doc_ref.get()

    if not snapshot.exists:
        raise TokenNotFoundError(f"No Gmail credentials found for user '{user_id}'. Authorization required.")

    data = snapshot.to_dict()
    refresh_token = data.get("refresh_token")
    client_id = data.get("client_id") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = data.get("client_secret") or os.environ.get("GOOGLE_CLIENT_SECRET")
    token_uri = data.get("token_uri", "https://oauth2.googleapis.com/token")

    if not refresh_token:
        raise TokenNotFoundError(f"Stored token for user '{user_id}' does not contain a valid refresh_token.")

    creds = Credentials(
        token=None,  # Forces refresh
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=GMAIL_SCOPES
    )

    try:
        creds.refresh(Request())
    except RefreshError as re:
        # Update status in Firestore to alert about token revocation
        doc_ref.update({"status": "REVOKED", "revokedAt": datetime.utcnow().isoformat()})
        raise TokenRevokedOrInvalidError(
            f"Failed to refresh Google OAuth token for user '{user_id}'. Token may have been revoked: {str(re)}"
        )

    # Return authenticated Google Gmail v1 client
    return build("gmail", "v1", credentials=creds)
