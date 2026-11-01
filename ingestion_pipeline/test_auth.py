import os
import unittest
from unittest.mock import MagicMock, patch
from ingestion_pipeline.auth_manager import (
    generate_authorization_url,
    handle_oauth_callback,
    get_user_gmail_service,
    TokenNotFoundError,
    OAuthConfigurationError
)

class TestOAuthManager(unittest.TestCase):
    def setUp(self):
        os.environ["GOOGLE_CLIENT_ID"] = "mock_client_id.apps.googleusercontent.com"
        os.environ["GOOGLE_CLIENT_SECRET"] = "mock_client_secret"
        os.environ["GOOGLE_REDIRECT_URI"] = "http://localhost:8000/auth/google/callback"

    def test_missing_client_config(self):
        del os.environ["GOOGLE_CLIENT_ID"]
        with self.assertRaises(OAuthConfigurationError):
            generate_authorization_url("user_123")
        os.environ["GOOGLE_CLIENT_ID"] = "mock_client_id.apps.googleusercontent.com"

    def test_generate_authorization_url_offline_and_consent(self):
        url = generate_authorization_url("user_test_99")
        self.assertIn("https://accounts.google.com/o/oauth2/auth", url)
        self.assertIn("access_type=offline", url)
        self.assertIn("prompt=consent", url)
        self.assertIn("state=user_test_99", url)
        self.assertIn("gmail.readonly", url)

    @patch("ingestion_pipeline.auth_manager.get_firestore_client")
    def test_token_not_found(self, mock_firestore):
        mock_db = MagicMock()
        mock_doc = MagicMock()
        mock_doc.get.return_value.exists = False
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value = mock_doc
        mock_firestore.return_value = mock_db

        with self.assertRaises(TokenNotFoundError):
            get_user_gmail_service("non_existent_user")

    @patch("ingestion_pipeline.auth_manager.get_firestore_client")
    @patch("ingestion_pipeline.auth_manager.build")
    @patch("ingestion_pipeline.auth_manager.Credentials")
    def test_get_user_gmail_service_success(self, mock_creds_cls, mock_build, mock_firestore):
        mock_db = MagicMock()
        mock_doc = MagicMock()
        mock_doc.get.return_value.exists = True
        mock_doc.get.return_value.to_dict.return_value = {
            "refresh_token": "valid_refresh_token",
            "client_id": "test_client_id",
            "client_secret": "test_client_secret",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value = mock_doc
        mock_firestore.return_value = mock_db

        mock_creds_instance = MagicMock()
        mock_creds_cls.return_value = mock_creds_instance
        mock_build.return_value = MagicMock()

        service = get_user_gmail_service("user_valid_1")
        mock_creds_instance.refresh.assert_called_once()
        mock_build.assert_called_with("gmail", "v1", credentials=mock_creds_instance, cache_discovery=False)
        self.assertIsNotNone(service)

if __name__ == "__main__":
    unittest.main()
