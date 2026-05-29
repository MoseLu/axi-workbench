#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from imap_code_app import (  # noqa: E402
    IMAP_ACCOUNT_CONFIG,
    OUTLOOK_DOMAINS,
    SHARED_PASSWORD,
    CodeAccount,
    fetch_otp_site_code,
    load_accounts,
    otp_message_timestamp,
    source_label,
)
from outlook_imap_codes import DEFAULT_FROM_FILTER, latest_messages, message_timestamp  # noqa: E402
from outlook_imap_codes import Account, connect_imap  # noqa: E402
from outlook_oauth_device_login import (  # noqa: E402
    default_client_id,
    load_json,
    open_private_browser,
    poll_token,
    request_device_code,
    select_account_verification_uri,
    token_access_summary,
    token_identity_email,
    upsert_outlook_account,
    write_config,
)


def account_to_view(account: CodeAccount) -> dict[str, Any]:
    domain = account.email.rsplit("@", 1)[-1].lower()
    is_oauth_token_account = (
        account.imap_account is not None
        and account.imap_account.auth_type == "oauth2"
        and bool(account.imap_account.refresh_token)
    )
    uses_outlook_password = (
        account.source == "imap"
        and account.imap_account is not None
        and account.imap_account.auth_type == "password"
        and domain in OUTLOOK_DOMAINS
    )
    available = account.source in {"imap", "otp"} and not uses_outlook_password
    can_authorize = domain in OUTLOOK_DOMAINS and (account.source == "pool" or uses_outlook_password)
    return {
        "id": account.index,
        "index": account.index,
        "label": account.label,
        "email": account.email,
        "source": account.source,
        "sourceLabel": source_label(account.source),
        "note": "已导入 token" if is_oauth_token_account else "",
        "available": available,
        "canAuthorize": can_authorize,
        "accountPassword": SHARED_PASSWORD if available else "",
        "emailPassword": account.password if available else "",
        "isCockpit": getattr(account, "is_cockpit", False),
    }


def message_to_view(message: object) -> dict[str, str] | None:
    if not isinstance(message, dict):
        return None
    return {
        "mailbox": str(message.get("mailbox") or ""),
        "from": str(message.get("from") or ""),
        "subject": str(message.get("subject") or ""),
        "date": str(message.get("date") or ""),
    }


def receive_payload(
    *,
    kind: str,
    code: str = "",
    message: object = None,
    stale: bool = False,
    error: str = "",
) -> dict[str, Any]:
    status_label = "等待新验证码..."
    status_kind = "info"
    if kind == "done":
        status_label = "已接收最新验证码"
        status_kind = "ok"
    elif kind == "waiting":
        status_label = "旧验证码已显示，继续等待新码..." if stale and code else "未找到新验证码，继续等待..."
        status_kind = "warn"
    elif kind == "timeout":
        if code:
            status_label = "超时，仅显示旧验证码"
        elif stale:
            status_label = "超时，旧验证码已忽略"
        else:
            status_label = "超时，未找到新验证码"
        status_kind = "warn"
    elif kind == "error":
        status_label = error[:120] or "接收失败"
        status_kind = "bad"

    return {
        "status": kind,
        "statusLabel": status_label,
        "statusKind": status_kind,
        "code": code,
        "message": message_to_view(message),
        "stale": stale,
        "error": error,
    }


def list_accounts_payload() -> dict[str, Any]:
    accounts = load_accounts()
    views = [account_to_view(account) for account in accounts]
    stats = {
        "total": len(views),
        "imap": sum(1 for account in views if account["source"] == "imap"),
        "otp": sum(1 for account in views if account["source"] == "otp"),
        "pool": sum(1 for account in views if account["source"] == "pool"),
        "available": sum(1 for account in views if account["available"]),
    }
    return {"accounts": views, "stats": stats}


def receive_code(account_id: str) -> dict[str, Any]:
    account = next((item for item in load_accounts() if item.index == account_id), None)
    if account is None:
        return receive_payload(kind="error", error=f"账号不存在: {account_id}")
    if account.source == "pool":
        return receive_payload(kind="error", error="该账号没有接码凭据")

    deadline = time.time() + 65
    started_after = time.time() - 90
    last_payload: dict[str, Any] = {}
    try:
        if account.source == "otp":
            while time.time() <= deadline:
                data = fetch_otp_site_code(account)
                latest = data.get("latest_mail") if isinstance(data.get("latest_mail"), dict) else {}
                code = str(data.get("verification_code") or "")
                received_at = latest.get("received_at")
                timestamp = otp_message_timestamp(received_at)
                is_fresh = bool(code) and (not timestamp or timestamp >= started_after)
                last_payload = {
                    "code": code if is_fresh else "",
                    "message": {
                        "mailbox": "OTP",
                        "from": latest.get("from") or "",
                        "subject": latest.get("subject") or "",
                        "date": received_at or "",
                    },
                    "stale": bool(code and not is_fresh),
                }
                if is_fresh:
                    return receive_payload(kind="done", **last_payload)
                time.sleep(5)
            return receive_payload(kind="timeout", **last_payload)

        if not account.imap_account:
            return receive_payload(kind="error", error="IMAP account missing credentials")

        while time.time() <= deadline:
            summaries = latest_messages(account.imap_account, limit=10, from_filter=DEFAULT_FROM_FILTER)
            code_summaries = [summary for summary in summaries if summary.code]
            chosen = next(
                (summary for summary in code_summaries if message_timestamp(summary.date) >= started_after),
                None,
            )
            visible = chosen or (code_summaries[0] if code_summaries else (summaries[0] if summaries else None))
            last_payload = {
                "code": chosen.code if chosen else ((visible.code or "") if visible else ""),
                "message": {
                    "mailbox": visible.mailbox,
                    "from": visible.from_addr,
                    "subject": visible.subject,
                    "date": visible.date,
                }
                if visible
                else None,
                "stale": bool(code_summaries and not chosen),
            }
            if chosen:
                return receive_payload(kind="done", **last_payload)
            time.sleep(5)
        return receive_payload(kind="timeout", **last_payload)
    except Exception as exc:
        return receive_payload(kind="error", error=str(exc))


def begin_outlook_authorization(
    account_id: str,
    *,
    accounts: list[CodeAccount] | None = None,
    client_id: str | None = None,
    request_device_code_fn=request_device_code,
    open_browser_fn=open_private_browser,
) -> dict[str, Any]:
    account_rows = accounts if accounts is not None else load_accounts()
    account = next((item for item in account_rows if item.index == account_id), None)
    if account is None:
        return {"status": "error", "statusLabel": f"账号不存在: {account_id}", "statusKind": "bad"}
    domain = account.email.rsplit("@", 1)[-1].lower()
    if domain not in OUTLOOK_DOMAINS:
        return {"status": "error", "statusLabel": "该邮箱不支持 Microsoft 授权", "statusKind": "bad"}

    resolved_client_id = client_id or default_client_id()
    device = request_device_code_fn(resolved_client_id)
    verification_uri = select_account_verification_uri(
        str(device.get("verification_uri") or "https://microsoft.com/devicelogin"),
        account.email,
    )
    user_code = str(device.get("user_code") or "")
    device_code = str(device.get("device_code") or "")
    if not user_code or not device_code:
        return {"status": "error", "statusLabel": "Microsoft 未返回授权码", "statusKind": "bad"}
    try:
        open_browser_fn(verification_uri)
    except Exception:
        pass
    return {
        "status": "pending",
        "statusLabel": f"浏览器已打开，输入 {user_code}",
        "statusKind": "info",
        "email": account.email,
        "clientId": resolved_client_id,
        "deviceCode": device_code,
        "userCode": user_code,
        "verificationUri": verification_uri,
        "interval": int(device.get("interval") or 5),
        "expiresIn": int(device.get("expires_in") or 900),
    }


def validate_oauth_token_for_email(email: str, access_token: str) -> None:
    account = Account(
        index="",
        label=email.split("@", 1)[0],
        email=email,
        password="",
        client_id="",
        refresh_token="",
        auth_type="oauth2",
    )
    imap = connect_imap(account, access_token)
    try:
        imap.select("INBOX", readonly=True)
    finally:
        try:
            imap.logout()
        except Exception:
            pass


def complete_outlook_authorization(
    *,
    email: str,
    client_id: str,
    device_code: str,
    interval: int,
    expires_in: int,
    config_path: Path = IMAP_ACCOUNT_CONFIG,
    poll_token_fn=poll_token,
    validate_oauth_token_fn=validate_oauth_token_for_email,
) -> dict[str, Any]:
    token = poll_token_fn(
        client_id=client_id,
        device_code=device_code,
        interval=interval,
        expires_in=expires_in,
    )
    refresh_token = str(token.get("refresh_token") or "")
    access_token = str(token.get("access_token") or "")
    if not access_token:
        return {"status": "error", "statusLabel": "Microsoft 未返回 access_token", "statusKind": "bad"}
    if not refresh_token:
        return {"status": "error", "statusLabel": "Microsoft 未返回 refresh_token", "statusKind": "bad"}
    signed_in_email = token_identity_email(token)
    if signed_in_email and signed_in_email.lower() != email.lower():
        return {
            "status": "error",
            "statusLabel": f"Microsoft 实际登录的是 {signed_in_email}，不是 {email}",
            "statusKind": "bad",
            "error": "token identity mismatch",
        }
    try:
        validate_oauth_token_fn(email, access_token)
    except Exception as exc:
        identity_note = f"（Microsoft 登录：{signed_in_email}）" if signed_in_email else "（未返回可识别的登录邮箱）"
        access_note = token_access_summary(token)
        access_detail = f"；token {access_note}" if access_note else ""
        detail = str(exc).strip()
        detail_note = f"：{detail[:80]}" if detail else ""
        return {
            "status": "error",
            "statusLabel": f"Microsoft 已授权，但 IMAP 登录 {email} 失败{identity_note}{access_detail}{detail_note}",
            "statusKind": "bad",
            "error": str(exc),
        }

    config = upsert_outlook_account(load_json(config_path), email, client_id, refresh_token)
    write_config(config_path, config)
    account = next(
        (item for item in load_accounts(cockpit_emails=[email], imap_config_path=config_path) if item.email.lower() == email.lower()),
        None,
    )
    return {
        "status": "done",
        "statusLabel": "授权已完成，IMAP 已启用",
        "statusKind": "ok",
        "account": account_to_view(account) if account else None,
    }


def write_payload(payload: dict[str, Any]) -> int:
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="JSON bridge for the IMAP code desktop UI.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("list-accounts")
    receive = subparsers.add_parser("receive-code")
    receive.add_argument("account_id")
    begin_auth = subparsers.add_parser("begin-outlook-authorization")
    begin_auth.add_argument("account_id")
    complete_auth = subparsers.add_parser("complete-outlook-authorization")
    complete_auth.add_argument("--email", required=True)
    complete_auth.add_argument("--client-id", required=True)
    complete_auth.add_argument("--device-code", required=True)
    complete_auth.add_argument("--interval", type=int, required=True)
    complete_auth.add_argument("--expires-in", type=int, required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "list-accounts":
        return write_payload(list_accounts_payload())
    if args.command == "receive-code":
        return write_payload(receive_code(args.account_id))
    if args.command == "begin-outlook-authorization":
        return write_payload(begin_outlook_authorization(args.account_id))
    if args.command == "complete-outlook-authorization":
        return write_payload(
            complete_outlook_authorization(
                email=args.email,
                client_id=args.client_id,
                device_code=args.device_code,
                interval=args.interval,
                expires_in=args.expires_in,
            )
        )
    raise ValueError(f"Unknown command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
