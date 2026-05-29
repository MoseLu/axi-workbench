#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import platform
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path
from typing import Any

from outlook_imap_codes import DEFAULT_CREDENTIALS, TOKEN_SCOPE, parse_markdown_table


DEVICE_CODE_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode"
TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
DEFAULT_IMAP_CONFIG = Path(__file__).with_name("imap_accounts.json")
DEVICE_LOGIN_SCOPE = f"openid profile email {TOKEN_SCOPE}"


def select_account_verification_uri(verification_uri: str, email: str | None = None) -> str:
    parsed = urllib.parse.urlparse(verification_uri)
    query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
    query["prompt"] = "login"
    if email:
        query["login_hint"] = email
    return urllib.parse.urlunparse(
        parsed._replace(query=urllib.parse.urlencode(query))
    )


def open_private_browser(verification_uri: str) -> bool:
    if platform.system() == "Darwin":
        profile_dir = tempfile.mkdtemp(prefix="imap-ms-auth-")
        try:
            subprocess.run(
                [
                    "open",
                    "-na",
                    "Google Chrome",
                    "--args",
                    f"--user-data-dir={profile_dir}",
                    "--incognito",
                    "--no-first-run",
                    verification_uri,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return True
        except (OSError, subprocess.CalledProcessError):
            pass
    return webbrowser.open(verification_uri)


def default_client_id(credentials: Path = DEFAULT_CREDENTIALS) -> str:
    accounts = parse_markdown_table(credentials)
    client_ids = {account.client_id for account in accounts if account.client_id}
    if len(client_ids) != 1:
        raise RuntimeError(f"Cannot infer a single Microsoft client_id from {credentials}")
    return next(iter(client_ids))


def post_form(url: str, payload: dict[str, str], timeout: int = 25) -> dict[str, Any]:
    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            details = json.loads(body)
        except json.JSONDecodeError:
            details = {"error": f"http_{exc.code}", "error_description": body[:300]}
        error = details.get("error", f"http_{exc.code}")
        description = details.get("error_description", "")
        raise RuntimeError(f"{error}: {description[:300]}") from exc


def request_device_code(client_id: str) -> dict[str, Any]:
    return post_form(
        DEVICE_CODE_ENDPOINT,
        {
            "client_id": client_id,
            "scope": DEVICE_LOGIN_SCOPE,
        },
    )


def decode_jwt_payload(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    payload = parts[1]
    padded = payload + "=" * (-len(payload) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        decoded = json.loads(raw.decode("utf-8", errors="replace"))
    except (ValueError, json.JSONDecodeError):
        return {}
    return decoded if isinstance(decoded, dict) else {}


def token_identity_email(token_payload: dict[str, Any]) -> str:
    id_token = str(token_payload.get("id_token") or "")
    claims = decode_jwt_payload(id_token)
    for key in ("preferred_username", "email", "upn", "unique_name"):
        value = str(claims.get(key) or "").strip()
        if "@" in value:
            return value
    return ""


def token_access_summary(token_payload: dict[str, Any]) -> str:
    access_token = str(token_payload.get("access_token") or "")
    claims = decode_jwt_payload(access_token)
    if not claims:
        return ""
    parts: list[str] = []
    audience = str(claims.get("aud") or "").strip()
    scopes = str(claims.get("scp") or "").strip()
    app = str(claims.get("app_displayname") or claims.get("azp_name") or "").strip()
    if audience:
        parts.append(f"aud={audience}")
    if scopes:
        parts.append(f"scp={scopes}")
    if app:
        parts.append(f"app={app}")
    return ", ".join(parts)


def poll_token(client_id: str, device_code: str, interval: int, expires_in: int) -> dict[str, Any]:
    deadline = time.time() + expires_in
    wait_seconds = max(1, interval)
    while time.time() < deadline:
        time.sleep(wait_seconds)
        try:
            return post_form(
                TOKEN_ENDPOINT,
                {
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "client_id": client_id,
                    "device_code": device_code,
                },
            )
        except RuntimeError as exc:
            message = str(exc)
            if message.startswith("authorization_pending:"):
                continue
            if message.startswith("slow_down:"):
                wait_seconds += 5
                continue
            raise
    raise TimeoutError("Microsoft device login expired before authorization completed")


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"accounts": []}
    return json.loads(path.read_text(encoding="utf-8"))


def upsert_outlook_account(config: dict[str, Any], email: str, client_id: str, refresh_token: str) -> dict[str, Any]:
    accounts = config.setdefault("accounts", [])
    if not isinstance(accounts, list):
        raise ValueError("imap_accounts.json field 'accounts' must be a list")

    normalized = email.lower()
    entry = {
        "email": email,
        "auth_type": "oauth2",
        "provider": "outlook",
        "client_id": client_id,
        "refresh_token": refresh_token,
    }
    for index, item in enumerate(accounts):
        if isinstance(item, dict) and str(item.get("email", "")).lower() == normalized:
            accounts[index] = {**item, **entry}
            return config
    accounts.append(entry)
    return config


def write_config(path: Path, config: dict[str, Any]) -> None:
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Get a Microsoft OAuth refresh token for Outlook IMAP.")
    parser.add_argument("email", help="Outlook/Hotmail address to authorize.")
    parser.add_argument("--client-id", help="Microsoft OAuth public client ID. Defaults to the existing table client_id.")
    parser.add_argument("--config", type=Path, default=DEFAULT_IMAP_CONFIG, help=f"IMAP config path. Default: {DEFAULT_IMAP_CONFIG}")
    parser.add_argument("--no-open", action="store_true", help="Do not open the verification URL in the browser.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    client_id = args.client_id or default_client_id()
    device = request_device_code(client_id)
    verification_uri = select_account_verification_uri(
        str(device.get("verification_uri") or "https://microsoft.com/devicelogin"),
        args.email,
    )
    user_code = str(device.get("user_code") or "")
    device_code = str(device.get("device_code") or "")
    if not device_code or not user_code:
        raise RuntimeError(f"Microsoft did not return a device code: {device}")

    print(f"Open: {verification_uri}")
    print(f"Code: {user_code}")
    print(f"Login as: {args.email}")
    print("Waiting for Microsoft authorization...")
    if not args.no_open:
        open_private_browser(verification_uri)

    token = poll_token(
        client_id=client_id,
        device_code=device_code,
        interval=int(device.get("interval") or 5),
        expires_in=int(device.get("expires_in") or 900),
    )
    refresh_token = str(token.get("refresh_token") or "")
    if not refresh_token:
        raise RuntimeError("Microsoft did not return refresh_token; check that offline_access is allowed")

    config = upsert_outlook_account(load_json(args.config), args.email, client_id, refresh_token)
    write_config(args.config, config)
    print(f"Updated {args.config}")
    print("Token stored locally; it was not printed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
