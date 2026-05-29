import unittest

import base64
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from imap_code_app import Account
import backend.imap_service as imap_service
from outlook_oauth_device_login import open_private_browser, select_account_verification_uri, token_access_summary, upsert_outlook_account


def unsigned_jwt(claims: dict[str, str]) -> str:
    def encode(payload: dict[str, str]) -> str:
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

    return f"{encode({'alg': 'none'})}.{encode(claims)}."


class OutlookOAuthDeviceLoginTest(unittest.TestCase):
    def test_upsert_adds_outlook_oauth_account(self):
        config = {"accounts": []}

        updated = upsert_outlook_account(config, "user@outlook.com", "client-id", "refresh-token")

        self.assertEqual(
            updated,
            {
                "accounts": [
                    {
                        "email": "user@outlook.com",
                        "auth_type": "oauth2",
                        "provider": "outlook",
                        "client_id": "client-id",
                        "refresh_token": "refresh-token",
                    }
                ]
            },
        )

    def test_upsert_preserves_existing_fields_when_replacing_token(self):
        config = {
            "accounts": [
                {
                    "email": "User@Outlook.com",
                    "label": "User",
                    "refresh_token": "old-token",
                }
            ]
        }

        updated = upsert_outlook_account(config, "user@outlook.com", "client-id", "new-token")

        self.assertEqual(len(updated["accounts"]), 1)
        self.assertEqual(updated["accounts"][0]["label"], "User")
        self.assertEqual(updated["accounts"][0]["refresh_token"], "new-token")
        self.assertEqual(updated["accounts"][0]["auth_type"], "oauth2")

    def test_begin_authorization_returns_device_code_and_opens_browser(self):
        opened: list[str] = []
        account = imap_service.CodeAccount("1", "user", "user@outlook.com", "", "pool")

        def fake_request_device_code(client_id: str):
            self.assertEqual(client_id, "client-id")
            return {
                "verification_uri": "https://microsoft.com/devicelogin",
                "user_code": "ABCD-EFGH",
                "device_code": "device-code",
                "interval": 2,
                "expires_in": 600,
            }

        payload = imap_service.begin_outlook_authorization(
            "1",
            accounts=[account],
            client_id="client-id",
            request_device_code_fn=fake_request_device_code,
            open_browser_fn=opened.append,
        )

        self.assertEqual(
            opened,
            ["https://microsoft.com/devicelogin?prompt=login&login_hint=user%40outlook.com"],
        )
        self.assertEqual(payload["status"], "pending")
        self.assertEqual(payload["email"], "user@outlook.com")
        self.assertEqual(payload["userCode"], "ABCD-EFGH")
        self.assertEqual(payload["deviceCode"], "device-code")

    def test_verification_uri_forces_account_picker_and_preserves_query(self):
        uri = select_account_verification_uri("https://microsoft.com/devicelogin?mkt=zh-CN")

        self.assertEqual(
            uri,
            "https://microsoft.com/devicelogin?mkt=zh-CN&prompt=login",
        )

    def test_private_browser_uses_fresh_chrome_profile_on_macos(self):
        with (
            patch("outlook_oauth_device_login.platform.system", return_value="Darwin"),
            patch("outlook_oauth_device_login.tempfile.mkdtemp", return_value="/tmp/imap-ms-auth-test"),
            patch("outlook_oauth_device_login.subprocess.run") as run,
        ):
            self.assertTrue(open_private_browser("https://microsoft.com/devicelogin"))

        command = run.call_args.args[0]
        self.assertIn("--user-data-dir=/tmp/imap-ms-auth-test", command)
        self.assertIn("--incognito", command)
        self.assertEqual(command[-1], "https://microsoft.com/devicelogin")

    def test_token_access_summary_decodes_audience_and_scopes(self):
        summary = token_access_summary(
            {
                "access_token": unsigned_jwt(
                    {
                        "aud": "https://outlook.office.com",
                        "scp": "IMAP.AccessAsUser.All",
                        "app_displayname": "Thunderbird",
                    }
                )
            }
        )

        self.assertIn("aud=https://outlook.office.com", summary)
        self.assertIn("scp=IMAP.AccessAsUser.All", summary)
        self.assertIn("app=Thunderbird", summary)

    def test_complete_authorization_writes_config_and_returns_view(self):
        with TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "imap_accounts.json"

            payload = imap_service.complete_outlook_authorization(
                email="user@outlook.com",
                client_id="client-id",
                device_code="device-code",
                interval=0,
                expires_in=5,
                config_path=config_path,
                poll_token_fn=lambda **_kwargs: {
                    "access_token": "access-token",
                    "refresh_token": "refresh-token",
                    "id_token": unsigned_jwt({"preferred_username": "user@outlook.com"}),
                },
                validate_oauth_token_fn=lambda email, token: None,
            )

            self.assertEqual(payload["status"], "done")
            self.assertEqual(payload["account"]["email"], "user@outlook.com")
            self.assertTrue(payload["account"]["available"])
            self.assertIn("refresh-token", config_path.read_text(encoding="utf-8"))

            configured = imap_service.load_accounts(cockpit_emails=["user@outlook.com"], imap_config_path=config_path)
            self.assertEqual(configured[0].source, "imap")
            self.assertIsInstance(configured[0].imap_account, Account)

    def test_complete_authorization_rejects_wrong_microsoft_account(self):
        with TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "imap_accounts.json"

            def reject(_email: str, _token: str) -> None:
                raise RuntimeError("LOGIN failed")

            payload = imap_service.complete_outlook_authorization(
                email="jessicastokes5281@outlook.com",
                client_id="client-id",
                device_code="device-code",
                interval=0,
                expires_in=5,
                config_path=config_path,
                poll_token_fn=lambda **_kwargs: {
                    "access_token": unsigned_jwt(
                        {
                            "aud": "https://outlook.office.com",
                            "scp": "IMAP.AccessAsUser.All",
                            "app_displayname": "Thunderbird",
                        }
                    ),
                    "refresh_token": "refresh-token",
                    "id_token": unsigned_jwt({"preferred_username": "jessicastokes5281@outlook.com"}),
                },
                validate_oauth_token_fn=reject,
            )

            self.assertEqual(payload["status"], "error")
            self.assertIn("IMAP 登录 jessicastokes5281@outlook.com 失败", payload["statusLabel"])
            self.assertIn("scp=IMAP.AccessAsUser.All", payload["statusLabel"])
            self.assertFalse(config_path.exists())

    def test_complete_authorization_rejects_id_token_mismatch_before_imap(self):
        with TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "imap_accounts.json"

            payload = imap_service.complete_outlook_authorization(
                email="ianalvarez9236@outlook.com",
                client_id="client-id",
                device_code="device-code",
                interval=0,
                expires_in=5,
                config_path=config_path,
                poll_token_fn=lambda **_kwargs: {
                    "access_token": "access-token",
                    "refresh_token": "refresh-token",
                    "id_token": unsigned_jwt({"preferred_username": "sayxgeigh837@outlook.com"}),
                },
                validate_oauth_token_fn=lambda _email, _token: self.fail("IMAP should not be called"),
            )

            self.assertEqual(payload["status"], "error")
            self.assertIn("sayxgeigh837@outlook.com", payload["statusLabel"])
            self.assertIn("ianalvarez9236@outlook.com", payload["statusLabel"])
            self.assertFalse(config_path.exists())


if __name__ == "__main__":
    unittest.main()
