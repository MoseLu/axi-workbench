#!/usr/bin/env python3
"""
Read Outlook/Hotmail verification codes via IMAP XOAUTH2.

The script expects the Markdown table generated from the user's local Outlook
account list. It does not print refresh tokens or persist access tokens.
"""

from __future__ import annotations

import argparse
import email
import email.utils
import imaplib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from email.message import Message
from pathlib import Path
from typing import Iterable


BUNDLED_CREDENTIALS = Path(__file__).with_name("11个outlook_整理表格.md")
DESKTOP_CREDENTIALS = Path("/Users/mose/Desktop/11个outlook_整理表格.md")
DEFAULT_CREDENTIALS = BUNDLED_CREDENTIALS if BUNDLED_CREDENTIALS.exists() else DESKTOP_CREDENTIALS
TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
TOKEN_SCOPE = "https://outlook.office.com/IMAP.AccessAsUser.All offline_access"
IMAP_HOST = "outlook.office365.com"
IMAP_PORT = 993
DEFAULT_FROM_FILTER = "openai.com"
DEFAULT_MAILBOXES = ("INBOX", "Junk", "Deleted")
CODE_RE = re.compile(r"(?<!\d)(\d{4,8})(?!\d)")
CONTEXT_RE = re.compile(
    r"(code|verification|verify|security|otp|验证码|校验码|验证|安全代码|一次性|登录码)",
    re.IGNORECASE,
)
VERIFICATION_SUBJECT_RE = re.compile(
    r"(验证码|校验码|临时.*码|verification\s*code|verify\s+your|one[-\s]?time|otp|login\s*code)",
    re.IGNORECASE,
)
NON_VERIFICATION_SUBJECT_RE = re.compile(
    r"(新套餐|套餐|订阅|subscription|plan|receipt|invoice|billing|payment)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Account:
    index: str
    label: str
    email: str
    password: str
    client_id: str
    refresh_token: str
    auth_type: str = "oauth2"
    host: str = IMAP_HOST
    port: int = IMAP_PORT


@dataclass(frozen=True)
class MessageSummary:
    account: Account
    mailbox: str
    subject: str
    from_addr: str
    date: str
    code: str | None


def strip_ticks(value: str) -> str:
    value = value.strip()
    if value.startswith("`") and value.endswith("`"):
        value = value[1:-1]
    return value.replace(r"\|", "|")


def parse_markdown_table(path: Path) -> list[Account]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rows: list[Account] = []
    in_full_table = False

    for line in text.splitlines():
        if line.startswith("## 完整凭据表"):
            in_full_table = True
            continue
        if not in_full_table:
            continue
        if not line.startswith("|") or not re.match(r"\|\s*\d+\s*\|", line):
            continue

        cells = [strip_ticks(cell) for cell in line.strip().strip("|").split("|")]
        if len(cells) < 6:
            continue
        rows.append(
            Account(
                index=cells[0],
                label=cells[1],
                email=cells[2],
                password=cells[3],
                client_id=cells[4],
                refresh_token=cells[5],
            )
        )

    if not rows:
        raise ValueError(f"No account rows found in {path}")
    return rows


def choose_accounts(accounts: list[Account], selector: str) -> list[Account]:
    if selector.lower() == "all":
        return accounts

    selected = [
        account
        for account in accounts
        if selector in {account.index, account.label, account.email}
    ]
    if not selected:
        available = ", ".join(f"{a.index}:{a.label}:{a.email}" for a in accounts)
        raise ValueError(f"Account not found: {selector}. Available: {available}")
    return selected


def exchange_access_token(account: Account) -> str:
    if account.auth_type != "oauth2":
        raise RuntimeError(f"token exchange is not available for auth_type={account.auth_type}")
    form = urllib.parse.urlencode(
        {
            "client_id": account.client_id,
            "grant_type": "refresh_token",
            "refresh_token": account.refresh_token,
            "scope": TOKEN_SCOPE,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        TOKEN_ENDPOINT,
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"error": "http_error", "error_description": raw[:300]}
        error = payload.get("error", f"http_{exc.code}")
        description = payload.get("error_description", "")
        raise RuntimeError(f"token exchange failed: {error}: {description[:240]}") from exc

    access_token = payload.get("access_token")
    if not access_token:
        raise RuntimeError(f"token exchange failed: {payload.get('error', 'no access_token')}")
    return access_token


def connect_imap(account: Account, access_token: str | None = None) -> imaplib.IMAP4_SSL:
    imap = imaplib.IMAP4_SSL(account.host, account.port, timeout=25)
    if account.auth_type == "password":
        imap.login(account.email, account.password)
        return imap
    if account.auth_type != "oauth2":
        raise RuntimeError(f"Unsupported IMAP auth_type: {account.auth_type}")
    if not access_token:
        raise RuntimeError("OAuth2 access token is required")
    auth_string = f"user={account.email}\x01auth=Bearer {access_token}\x01\x01"
    imap.authenticate("XOAUTH2", lambda _: auth_string.encode("utf-8"))
    return imap


def decode_header(value: str | None) -> str:
    if not value:
        return ""
    parts: list[str] = []
    for chunk, encoding in email.header.decode_header(value):
        if isinstance(chunk, bytes):
            parts.append(chunk.decode(encoding or "utf-8", errors="replace"))
        else:
            parts.append(chunk)
    return "".join(parts)


def message_text(msg: Message) -> str:
    chunks: list[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type not in {"text/plain", "text/html"}:
                continue
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            chunks.append(payload.decode(charset, errors="replace"))
    else:
        payload = msg.get_payload(decode=True)
        if payload is not None:
            charset = msg.get_content_charset() or "utf-8"
            chunks.append(payload.decode(charset, errors="replace"))

    text = "\n".join(chunks)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text)


def extract_code(subject: str, body: str) -> str | None:
    if not is_verification_message(subject):
        return None

    candidates = list(CODE_RE.finditer(subject + " " + body))
    if not candidates:
        return None

    scored: list[tuple[int, int, str]] = []
    haystack = subject + " " + body
    for match in candidates:
        start = max(0, match.start() - 40)
        end = min(len(haystack), match.end() + 40)
        context = haystack[start:end]
        score = 2 if CONTEXT_RE.search(context) else 0
        if len(match.group(1)) == 6:
            score += 1
        scored.append((score, -match.start(), match.group(1)))

    scored.sort(reverse=True)
    return scored[0][2]


def is_verification_message(subject: str) -> bool:
    subject = subject.strip()
    if not subject:
        return False
    if NON_VERIFICATION_SUBJECT_RE.search(subject):
        return False
    return bool(VERIFICATION_SUBJECT_RE.search(subject))


def message_timestamp(date: str) -> float:
    try:
        parsed = email.utils.parsedate_to_datetime(date)
    except (TypeError, ValueError, IndexError, OverflowError):
        return 0.0
    if parsed is None:
        return 0.0
    return parsed.timestamp()


def list_mailbox_count(imap: imaplib.IMAP4_SSL) -> int:
    status, boxes = imap.list()
    if status != "OK":
        raise RuntimeError(f"list mailboxes failed: {status}")
    return len(boxes or [])


def latest_messages(
    account: Account,
    limit: int,
    from_filter: str | None,
    mailboxes: Iterable[str] = DEFAULT_MAILBOXES,
) -> list[MessageSummary]:
    access_token = exchange_access_token(account) if account.auth_type == "oauth2" else None
    summaries: list[MessageSummary] = []
    search_terms = ["ALL"]
    if from_filter:
        search_terms = ["FROM", f'"{from_filter}"']

    for mailbox in mailboxes:
        imap = connect_imap(account, access_token)
        try:
            status, _ = imap.select(mailbox, readonly=True)
            if status != "OK":
                continue

            status, data = imap.search(None, *search_terms)
            if status != "OK":
                continue

            ids = (data[0] or b"").split()
            for msg_id in reversed(ids[-limit:]):
                status, fetched = imap.fetch(msg_id, "(BODY.PEEK[])")
                if status != "OK" or not fetched:
                    continue
                raw = next((item[1] for item in fetched if isinstance(item, tuple)), None)
                if not raw:
                    continue
                msg = email.message_from_bytes(raw)
                subject = decode_header(msg.get("Subject"))
                from_addr = decode_header(msg.get("From"))
                date = decode_header(msg.get("Date"))
                body = message_text(msg)
                summaries.append(
                    MessageSummary(
                        account=account,
                        mailbox=mailbox,
                        subject=subject,
                        from_addr=from_addr,
                        date=date,
                        code=extract_code(subject, body),
                    )
                )
        except (TimeoutError, imaplib.IMAP4.abort, imaplib.IMAP4.error, OSError):
            continue
        finally:
            try:
                imap.logout()
            except Exception:
                pass

    summaries.sort(key=lambda summary: message_timestamp(summary.date), reverse=True)
    return summaries


def command_check(accounts: Iterable[Account]) -> int:
    exit_code = 0
    print("idx\tlabel\temail\ttoken\timap\tmailboxes\tinbox")
    for account in accounts:
        try:
            access_token = exchange_access_token(account) if account.auth_type == "oauth2" else None
            imap = connect_imap(account, access_token)
            try:
                mailbox_count = list_mailbox_count(imap)
                status, data = imap.select("INBOX", readonly=True)
                inbox_count = (data or [b"0"])[0].decode("utf-8", errors="replace")
                print(
                    f"{account.index}\t{account.label}\t{account.email}\tOK\tOK\t"
                    f"{mailbox_count}\t{inbox_count if status == 'OK' else status}"
                )
            finally:
                imap.logout()
        except Exception as exc:
            exit_code = 1
            print(
                f"{account.index}\t{account.label}\t{account.email}\tFAIL\tFAIL\t-\t"
                f"{str(exc).splitlines()[0][:160]}"
            )
    return exit_code


def command_latest(accounts: Iterable[Account], limit: int, from_filter: str | None) -> int:
    exit_code = 0
    print("idx\tlabel\temail\tmailbox\tdate\tfrom\tcode\tsubject")
    for account in accounts:
        try:
            summaries = latest_messages(account, limit=limit, from_filter=from_filter)
            for summary in summaries:
                print(
                    "\t".join(
                        [
                            account.index,
                            account.label,
                            account.email,
                            summary.mailbox,
                            summary.date,
                            summary.from_addr,
                            summary.code or "",
                            summary.subject,
                        ]
                    )
                )
        except Exception as exc:
            exit_code = 1
            print(
                f"{account.index}\t{account.label}\t{account.email}\t-\t-\t-\tERROR\t"
                f"{str(exc).splitlines()[0][:160]}"
            )
    return exit_code


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Read Outlook verification codes via IMAP.")
    parser.add_argument(
        "--credentials",
        type=Path,
        default=DEFAULT_CREDENTIALS,
        help=f"Markdown credentials table. Default: {DEFAULT_CREDENTIALS}",
    )
    parser.add_argument(
        "--account",
        default="all",
        help="Account selector: all, row index, label, or email. Default: all",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("check", help="Check token exchange and IMAP login.")

    latest = subparsers.add_parser("latest", help="Print recent messages and extracted codes.")
    latest.add_argument("--limit", type=int, default=3, help="Recent message count per account.")
    latest.add_argument(
        "--from",
        dest="from_filter",
        default=DEFAULT_FROM_FILTER,
        help="Optional sender filter. Default: openai.com. Use --from '' to search all mail.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    accounts = choose_accounts(parse_markdown_table(args.credentials), args.account)

    if args.command == "check":
        return command_check(accounts)
    if args.command == "latest":
        return command_latest(accounts, limit=args.limit, from_filter=args.from_filter)
    raise AssertionError(f"Unhandled command: {args.command}")


if __name__ == "__main__":
    sys.exit(main())
