import unittest
import sys
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parent))
import imap_service
from imap_code_app import load_accounts


@dataclass(frozen=True)
class FakeAccount:
    index: str
    label: str
    email: str
    password: str
    source: str
    auth_type: str = "password"
    refresh_token: str = ""
    imap_account: object | None = None


class ImapServiceContractTest(unittest.TestCase):
    def test_account_view_hides_unusable_pool_secrets(self):
        imap_account = FakeAccount("1", "mail-a", "a@example.com", "mail-pass", "imap")
        pool_account = FakeAccount("2", "pool-b", "b@example.com", "", "pool")

        self.assertEqual(
            imap_service.account_to_view(imap_account),
            {
                "id": "1",
                "index": "1",
                "label": "mail-a",
                "email": "a@example.com",
                "source": "imap",
                "sourceLabel": "IMAP",
                "note": "",
                "available": True,
                "canAuthorize": False,
                "accountPassword": "lah1999626123",
                "emailPassword": "mail-pass",
                "isCockpit": False,
            },
        )
        self.assertEqual(
            imap_service.account_to_view(pool_account),
            {
                "id": "2",
                "index": "2",
                "label": "pool-b",
                "email": "b@example.com",
                "source": "pool",
                "sourceLabel": "账号池",
                "note": "",
                "available": False,
                "canAuthorize": False,
                "accountPassword": "",
                "emailPassword": "",
                "isCockpit": False,
            },
        )

    def test_account_view_marks_pool_outlook_as_authorizable(self):
        pool_account = FakeAccount("3", "pool-c", "c@outlook.com", "", "pool")

        self.assertTrue(imap_service.account_to_view(pool_account)["canAuthorize"])

    def test_account_view_routes_outlook_password_imap_to_authorization(self):
        imap_account = FakeAccount("4", "pool-d", "d@outlook.com", "login-pass", "imap")
        account = FakeAccount("4", "pool-d", "d@outlook.com", "login-pass", "imap", imap_account=imap_account)

        view = imap_service.account_to_view(account)

        self.assertFalse(view["available"])
        self.assertTrue(view["canAuthorize"])

    def test_account_view_notes_oauth_token_accounts(self):
        imap_account = FakeAccount(
            "5",
            "token-user",
            "token-user@outlook.com",
            "",
            "imap",
            auth_type="oauth2",
            refresh_token="refresh-token",
        )
        account = FakeAccount("5", "token-user", "token-user@outlook.com", "", "imap", imap_account=imap_account)

        view = imap_service.account_to_view(account)

        self.assertEqual(view["note"], "已导入 token")
        self.assertTrue(view["available"])

    def test_receive_payload_uses_stale_timeout_status(self):
        payload = imap_service.receive_payload(
            kind="timeout",
            code="123456",
            message={"mailbox": "INBOX", "from": "noreply@example.com", "subject": "Old code"},
            stale=True,
        )

        self.assertEqual(payload["status"], "timeout")
        self.assertEqual(payload["statusLabel"], "超时，仅显示旧验证码")
        self.assertEqual(payload["statusKind"], "warn")
        self.assertEqual(payload["code"], "123456")
        self.assertEqual(payload["message"]["subject"], "Old code")

    def test_local_imap_config_makes_pool_gmail_available(self):
        with TemporaryDirectory() as tmp:
            config = Path(tmp) / "imap_accounts.json"
            config.write_text(
                """{
  "accounts": [
    {
      "email": "user@gmail.com",
      "password": "app-pass",
      "provider": "gmail"
    }
  ]
}
""",
                encoding="utf-8",
            )

            account = load_accounts(cockpit_emails=["user@gmail.com"], imap_config_path=config)[0]

        self.assertEqual(account.source, "imap")
        self.assertEqual(account.password, "app-pass")
        self.assertIsNotNone(account.imap_account)
        self.assertEqual(account.imap_account.host, "imap.gmail.com")
        self.assertEqual(account.imap_account.port, 993)

        view = imap_service.account_to_view(account)
        self.assertTrue(view["available"])
        self.assertEqual(view["sourceLabel"], "IMAP")
        self.assertEqual(view["emailPassword"], "app-pass")

    def test_mail_com_family_defaults_to_mail_com_imap(self):
        with TemporaryDirectory() as tmp:
            config = Path(tmp) / "imap_accounts.json"
            config.write_text(
                """{
  "accounts": [
    {
      "email": "user@engineer.com",
      "password": "mail-pass"
    }
  ]
}
""",
                encoding="utf-8",
            )

            account = load_accounts(cockpit_emails=["user@engineer.com"], imap_config_path=config)[0]

        self.assertEqual(account.source, "imap")
        self.assertIsNotNone(account.imap_account)
        self.assertEqual(account.imap_account.host, "imap.mail.com")
        self.assertEqual(account.imap_account.auth_type, "password")

    def test_imap_config_is_full_list_with_cockpit_marker(self):
        with TemporaryDirectory() as tmp:
            config = Path(tmp) / "imap_accounts.json"
            config.write_text(
                """{
  "accounts": [
    {
      "email": "one@gmail.com",
      "password": "one-pass",
      "provider": "gmail"
    },
    {
      "email": "two@gmail.com",
      "password": "two-pass",
      "provider": "gmail"
    },
    {
      "email": "three@gmail.com",
      "password": "three-pass",
      "provider": "gmail"
    }
  ]
}
""",
                encoding="utf-8",
            )

            accounts = load_accounts(
                cockpit_emails=["two@gmail.com", "missing@outlook.com"],
                imap_config_path=config,
            )

        self.assertEqual([account.email for account in accounts], ["two@gmail.com", "one@gmail.com", "three@gmail.com"])
        self.assertEqual([account.is_cockpit for account in accounts], [True, False, False])


if __name__ == "__main__":
    unittest.main()
