#!/usr/bin/env python3
from __future__ import annotations

import queue
import threading
import time
import tkinter as tk
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from dataclasses import replace
from dataclasses import dataclass
from pathlib import Path
from tkinter import ttk

try:
    import AppKit
except Exception:
    AppKit = None  # type: ignore[assignment]

from outlook_imap_codes import (
    DEFAULT_CREDENTIALS,
    DEFAULT_FROM_FILTER,
    Account,
    latest_messages,
    message_timestamp,
    parse_markdown_table,
)


EXTRA_CREDENTIALS = Path("/Users/mose/Desktop/11个邮箱_整理表格.md")
DEFAULT_CREDENTIAL_SOURCES = (DEFAULT_CREDENTIALS, EXTRA_CREDENTIALS)
BUNDLED_CREDENTIAL_SOURCES = (
    Path(__file__).with_name("11个outlook_整理表格.md"),
    Path(__file__).with_name("11个邮箱_整理表格.md"),
)
OTP_ACCOUNT_CONFIG = Path(__file__).with_name("otp_accounts.json")
IMAP_ACCOUNT_CONFIG = Path(__file__).with_name("imap_accounts.json")
COCKPIT_ACCOUNT_INDEX = Path.home() / ".antigravity_cockpit" / "codex_accounts.json"
SHARED_USERNAME = "Mose"
SHARED_AGE = "35"
SHARED_PASSWORD = "lah1999626123"
OTP_RETRY_STATUS_CODES = {502, 503, 504, 530}
FONT_FAMILY = "Helvetica Neue"
BG = "#f5f5f7"
CARD_BG = "#ffffff"
TEXT = "#1d1d1f"
MUTED = "#6e6e73"
BORDER = "#d2d2d7"
FIELD_BG = "#f5f5f7"
BLUE = "#0071e3"
BLUE_ACTIVE = "#0077ed"
GREEN = "#34c759"
ORANGE = "#ff9f0a"
RED = "#ff3b30"
SOURCE_COLORS = {
    "imap": ("#e8f2ff", "#0066cc"),
    "otp": ("#eaf8ef", "#1f7a3f"),
    "pool": ("#f0f0f3", "#6e6e73"),
}
TAG_STYLES = {
    "info": ("#eef2f7", "#64748b"),
    "imap": ("#e8f2ff", "#0066cc"),
    "otp": ("#eaf8ef", "#1f7a3f"),
    "pool": ("#f0f0f3", "#6e6e73"),
    "ok": ("#ecfdf3", "#16803c"),
    "warn": ("#fff7e6", "#b86b00"),
    "bad": ("#fff1f0", "#cf1322"),
}
TABLE_HEADERS = ("序号", "类型", "邮箱", "账号密码", "邮箱密码", "验证码", "状态", "最近邮件", "操作")
TABLE_WIDTHS = (44, 62, 260, 108, 118, 82, 122, 190, 76)
TABLE_TEXT_WIDTHS = (4, 6, 26, 10, 11, 8, 11, 18, 6)
COMPACT_TABLE_WIDTHS = {0: 42, 2: 210, 5: 72, 6: 92, 8: 66}
COMPACT_TEXT_WIDTHS = {0: 3, 2: 19, 5: 6, 6: 8, 8: 4}
MEDIUM_TABLE_WIDTHS = {0: 42, 1: 58, 2: 230, 5: 76, 6: 108, 8: 70}
MEDIUM_TEXT_WIDTHS = {0: 3, 1: 5, 2: 22, 5: 7, 6: 9, 8: 5}
MINIMAL_COLUMNS = {0, 2, 5, 6, 8}
MEDIUM_COLUMNS = {0, 1, 2, 5, 6, 8}
WIDE_COLUMNS = {0, 1, 2, 3, 4, 5, 6, 8}
ALL_COLUMNS = set(range(len(TABLE_HEADERS)))
PAGE_SIZE = 12
FILTER_ITEMS = (
    ("all", "全部", "A"),
    ("imap", "IMAP", "I"),
    ("gmail", "Gmail", "G"),
    ("mail", "Mail", "M"),
    ("outlook", "Outlook", "O"),
    ("otp", "OTP", "T"),
    ("other", "其他", "+"),
)
OUTLOOK_DOMAINS = {"outlook.com", "outlook.jp", "hotmail.com"}
MAIL_COM_DOMAINS = {"mail.com", "email.com", "europe.com", "engineer.com", "politician.com"}
IMAP_PROVIDER_DEFAULTS = {
    "gmail": {"host": "imap.gmail.com", "port": 993},
    "mail.com": {"host": "imap.mail.com", "port": 993},
    "outlook": {"host": "outlook.office365.com", "port": 993},
}


@dataclass(frozen=True)
class CodeAccount:
    index: str
    label: str
    email: str
    password: str
    source: str
    imap_account: Account | None = None
    otp_token: str | None = None
    otp_site: str | None = None
    is_cockpit: bool = False


def source_label(source: str) -> str:
    return {"imap": "IMAP", "otp": "OTP", "pool": "账号池"}.get(source, source.upper())


def default_credential_sources() -> tuple[Path, ...]:
    if all(path.exists() for path in BUNDLED_CREDENTIAL_SOURCES):
        return BUNDLED_CREDENTIAL_SOURCES
    return DEFAULT_CREDENTIAL_SOURCES


def load_otp_overrides() -> dict[str, dict[str, str]]:
    if not OTP_ACCOUNT_CONFIG.exists():
        return {}
    payload = json.loads(OTP_ACCOUNT_CONFIG.read_text(encoding="utf-8"))
    return {str(item["index"]): item for item in payload.get("accounts", [])}


def infer_imap_provider(email: str) -> str:
    domain = email.rsplit("@", 1)[-1].lower()
    if domain == "gmail.com":
        return "gmail"
    if domain in MAIL_COM_DOMAINS:
        return "mail.com"
    if domain in OUTLOOK_DOMAINS:
        return "outlook"
    return "custom"


def imap_account_from_config(index: str, item: dict[str, object]) -> Account:
    email = str(item.get("email") or "").strip()
    if not email:
        raise ValueError("imap_accounts.json entry is missing email")
    provider = str(item.get("provider") or infer_imap_provider(email)).lower()
    defaults = IMAP_PROVIDER_DEFAULTS.get(provider, {})
    host = str(item.get("host") or defaults.get("host") or "").strip()
    if not host:
        raise ValueError(f"imap_accounts.json entry for {email} is missing host")
    auth_type = str(item.get("auth_type") or item.get("authType") or "password").lower()
    password = str(item.get("password") or "")
    client_id = str(item.get("client_id") or item.get("clientId") or "")
    refresh_token = str(item.get("refresh_token") or item.get("refreshToken") or "")
    if auth_type == "password" and not password:
        raise ValueError(f"imap_accounts.json entry for {email} is missing password")
    if auth_type == "oauth2" and (not client_id or not refresh_token):
        raise ValueError(f"imap_accounts.json entry for {email} is missing OAuth credentials")
    return Account(
        index=index,
        label=str(item.get("label") or email.split("@", 1)[0]),
        email=email,
        password=password,
        client_id=client_id,
        refresh_token=refresh_token,
        auth_type=auth_type,
        host=host,
        port=int(item.get("port") or defaults.get("port") or 993),
    )


def load_imap_config_accounts(config_path: Path = IMAP_ACCOUNT_CONFIG) -> list[Account]:
    if not config_path.exists():
        return []
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    rows: list[Account] = []
    for index, item in enumerate(payload.get("accounts", []), 1):
        if not isinstance(item, dict):
            continue
        account = imap_account_from_config(str(item.get("index") or index), item)
        rows.append(account)
    return rows


def load_imap_overrides(config_path: Path = IMAP_ACCOUNT_CONFIG) -> dict[str, Account]:
    return {account.email.lower(): account for account in load_imap_config_accounts(config_path)}


def load_cockpit_account_emails() -> list[str]:
    if not COCKPIT_ACCOUNT_INDEX.exists():
        return []
    payload = json.loads(COCKPIT_ACCOUNT_INDEX.read_text(encoding="utf-8"))
    emails: list[str] = []
    for summary in payload.get("accounts", []):
        email = str(summary.get("email") or "").strip()
        if email:
            emails.append(email)
    return emails


def load_accounts(
    credentials: tuple[Path, ...] | None = None,
    *,
    cockpit_emails: list[str] | None = None,
    imap_config_path: Path = IMAP_ACCOUNT_CONFIG,
) -> list[CodeAccount]:
    credentials = credentials or default_credential_sources()
    if len(credentials) >= 2:
        label_accounts = parse_markdown_table(credentials[0])
        mail_accounts = parse_markdown_table(credentials[1])
        accounts = [
            replace(mail_account, index=str(index), label=label_account.label)
            for index, (label_account, mail_account) in enumerate(zip(label_accounts, mail_accounts), 1)
        ]
    else:
        accounts = [
            replace(account, index=str(index))
            for index, account in enumerate(parse_markdown_table(credentials[0]), 1)
        ]

    overrides = load_otp_overrides()
    imap_config_accounts = load_imap_config_accounts(imap_config_path)
    imap_by_email = {account.email.lower(): account for account in accounts}
    imap_by_email.update({account.email.lower(): account for account in imap_config_accounts})
    otp_by_email = {item["email"].lower(): item for item in overrides.values()}
    cockpit_emails = cockpit_emails if cockpit_emails is not None else load_cockpit_account_emails()
    cockpit_email_set = {email.lower() for email in cockpit_emails}
    if imap_config_accounts:
        by_email = {account.email.lower(): account for account in imap_config_accounts}
        rows: list[CodeAccount] = []
        ordered_accounts: list[Account] = []
        used_emails: set[str] = set()
        for email in cockpit_emails:
            normalized = email.lower()
            account = by_email.get(normalized)
            if account and normalized not in used_emails:
                ordered_accounts.append(account)
                used_emails.add(normalized)
        for account in imap_config_accounts:
            normalized = account.email.lower()
            if normalized not in used_emails:
                ordered_accounts.append(account)
                used_emails.add(normalized)

        for account in ordered_accounts:
            normalized = account.email.lower()
            override = otp_by_email.get(normalized)
            if override:
                rows.append(
                    CodeAccount(
                        index=account.index,
                        label=override.get("label") or account.label,
                        email=override["email"],
                        password=override.get("password", ""),
                        source="otp",
                        otp_token=override["token"],
                        otp_site=override["site"].rstrip("/"),
                        is_cockpit=normalized in cockpit_email_set,
                    )
                )
                continue
            rows.append(
                CodeAccount(
                    index=account.index,
                    label=account.label,
                    email=account.email,
                    password=account.password,
                    source="imap",
                    imap_account=account,
                    is_cockpit=normalized in cockpit_email_set,
                )
            )
        return rows

    if cockpit_emails:
        rows: list[CodeAccount] = []
        for index, email in enumerate(cockpit_emails, 1):
            normalized = email.lower()
            override = otp_by_email.get(normalized)
            imap_account = imap_by_email.get(normalized)
            if override:
                rows.append(
                    CodeAccount(
                        index=str(index),
                        label=override.get("label") or email.split("@", 1)[0],
                        email=email,
                        password=override.get("password", ""),
                        source="otp",
                        otp_token=override["token"],
                        otp_site=override["site"].rstrip("/"),
                        is_cockpit=True,
                    )
                )
            elif imap_account:
                rows.append(
                    CodeAccount(
                        index=str(index),
                        label=imap_account.label,
                        email=email,
                        password=imap_account.password,
                        source="imap",
                        imap_account=imap_account,
                        is_cockpit=True,
                    )
                )
            else:
                rows.append(
                    CodeAccount(
                        index=str(index),
                        label=email.split("@", 1)[0],
                        email=email,
                        password="",
                        source="pool",
                        is_cockpit=True,
                    )
                )
        return rows

    rows = []
    consumed_override_indexes: set[str] = set()
    for account in accounts:
        override = overrides.get(account.index)
        if override:
            consumed_override_indexes.add(account.index)
            rows.append(
                CodeAccount(
                    index=account.index,
                    label=override.get("label") or account.label,
                    email=override["email"],
                    password=override.get("password", ""),
                    source="otp",
                    otp_token=override["token"],
                    otp_site=override["site"].rstrip("/"),
                )
            )
            continue
        rows.append(
            CodeAccount(
                index=account.index,
                label=account.label,
                email=account.email,
                password=account.password,
                source="imap",
                imap_account=account,
            )
        )
    extra_overrides = [
        item
        for index, item in overrides.items()
        if index not in consumed_override_indexes
    ]
    extra_overrides.sort(key=lambda item: int(item["index"]) if str(item.get("index", "")).isdigit() else 9999)
    for override in extra_overrides:
        index = str(override["index"])
        rows.append(
            CodeAccount(
                index=index,
                label=override.get("label") or override["email"].split("@", 1)[0],
                email=override["email"],
                password=override.get("password", ""),
                source="otp",
                otp_token=override["token"],
                otp_site=override["site"].rstrip("/"),
            )
        )
    return rows


def fetch_otp_site_code(account: CodeAccount) -> dict[str, object]:
    if not account.otp_site or not account.otp_token:
        raise RuntimeError("OTP account missing site or token")
    headers = {
        "Content-Type": "application/json",
        "Origin": account.otp_site,
        "Referer": account.otp_site + "/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15",
    }
    opened = otp_json_request(
        account.otp_site + "/api/open",
        headers=headers,
        data={"mailbox_token": account.otp_token},
    )
    box_session = opened.get("box_session")
    if not box_session:
        raise RuntimeError("OTP site did not return a session")

    payload = otp_json_request(
        account.otp_site + "/api/code",
        headers={**headers, "Authorization": "Bearer " + box_session},
    )
    return payload.get("data") or {}


def otp_json_request(url: str, headers: dict[str, str], data: dict[str, str] | None = None) -> dict[str, object]:
    body = json.dumps(data).encode("utf-8") if data is not None else None
    last_error: Exception | None = None
    for attempt in range(3):
        request = urllib.request.Request(url, data=body, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace").strip()
            last_error = exc
            if exc.code not in OTP_RETRY_STATUS_CODES or attempt == 2:
                if exc.code == 530 and "1033" in error_body:
                    raise RuntimeError("OTP站点暂不可用（HTTP 530 / Cloudflare 1033）") from exc
                detail = f": {error_body[:120]}" if error_body else ""
                raise RuntimeError(f"OTP站点返回 HTTP {exc.code}{detail}") from exc
            time.sleep(1.5 * (attempt + 1))
    if last_error:
        raise last_error
    raise RuntimeError("OTP site request failed")


def otp_message_timestamp(value: object) -> float:
    if not isinstance(value, str) or not value.strip():
        return 0.0
    text = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text[:19], fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


class ImapCodeApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Codex 接码")
        self.geometry("1420x760")
        self.minsize(680, 520)
        self.result_queue: queue.Queue[tuple[str, dict[str, object]]] = queue.Queue()
        self.rows: dict[str, dict[str, object]] = {}
        self.accounts: list[CodeAccount] = []
        self.filter_mode = tk.StringVar(value="all")
        self.filter_buttons: dict[str, tk.Canvas] = {}
        self.filter_titles: dict[str, str] = {}
        self.scroll_indicator_hide_job: str | None = None
        self.info_dialog: tk.Toplevel | None = None
        self.tooltip: tk.Toplevel | None = None
        self.tooltip_job: str | None = None
        self.header_widgets: dict[int, tk.Label] = {}
        self.visible_columns = ALL_COLUMNS.copy()
        self.current_visible_count = 0
        self.current_page = 1

        self._configure_style()
        self._build_shell()
        self._build_sidebar()
        self._build_table()
        self._build_pagination()
        self._build_global_scroll_indicator()
        self._load_accounts()
        self.after(100, self._patch_native_window)
        self.after(200, self._drain_results)

    def _configure_style(self) -> None:
        self.configure(bg=BG)
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Header.TFrame", background=BG)
        style.configure("Card.TFrame", background=CARD_BG)

    def _build_shell(self) -> None:
        self.shell = tk.Canvas(self, bg=BG, highlightthickness=0, bd=0)
        self.shell.pack(fill="both", expand=True)
        self.sidebar = tk.Frame(self.shell, bg=BG, width=58)
        self.sidebar.pack_propagate(False)
        self.content_shell = tk.Frame(self.shell, bg=BG)
        self.sidebar_window = self.shell.create_window(56, 180, window=self.sidebar, anchor="nw", width=58)
        self.content_window = self.shell.create_window(132, 42, window=self.content_shell, anchor="nw")

        self.content_glass = tk.Canvas(self.content_shell, bg=BG, highlightthickness=0, bd=0)
        self.content_glass.place(x=0, y=0, relwidth=1, relheight=1)

        def draw_content_glass(_event: tk.Event | None = None) -> None:
            self.content_glass.delete("all")
            width = max(1, self.content_glass.winfo_width())
            height = max(1, self.content_glass.winfo_height())
            self._rounded_rect(self.content_glass, 2, 2, width - 2, height - 2, 18, fill="#fbfbfd", outline="#e8e8ed")

        self.content_glass.bind("<Configure>", draw_content_glass)
        self.content = tk.Frame(self.content_shell, bg="#fbfbfd")
        self.content.pack(fill="both", expand=True, padx=14, pady=(14, 64))
        self.shell.bind("<Configure>", self._layout_shell)

    @staticmethod
    def _mix_color(start: str, end: str, ratio: float) -> str:
        start_rgb = tuple(int(start[index : index + 2], 16) for index in (1, 3, 5))
        end_rgb = tuple(int(end[index : index + 2], 16) for index in (1, 3, 5))
        mixed = tuple(round(a + (b - a) * ratio) for a, b in zip(start_rgb, end_rgb))
        return f"#{mixed[0]:02x}{mixed[1]:02x}{mixed[2]:02x}"

    def _draw_background(self, width: int, height: int) -> None:
        self.shell.delete("bg")
        steps = max(1, height // 3)
        for step in range(steps):
            ratio = step / max(1, steps - 1)
            color = self._mix_color("#eef3ff", "#f7fbf8", ratio)
            y1 = round(height * step / steps)
            y2 = round(height * (step + 1) / steps)
            self.shell.create_rectangle(0, y1, width, y2, fill=color, outline=color, tags=("bg",))
        self.shell.tag_lower("bg")

    def _layout_shell(self, event: tk.Event) -> None:
        width = max(1, event.width)
        height = max(1, event.height)
        self._draw_background(width, height)
        sidebar_height = min(max(430, height - 170), 560)
        sidebar_y = max(62, (height - sidebar_height) // 2)
        self.shell.itemconfigure(self.sidebar_window, width=58, height=sidebar_height)
        self.shell.coords(self.sidebar_window, 56, sidebar_y)
        content_x = 132
        content_y = 42
        self.shell.coords(self.content_window, content_x, content_y)
        self.shell.itemconfigure(
            self.content_window,
            width=max(1, width - content_x - 18),
            height=max(1, height - content_y - 18),
        )

    @staticmethod
    def _rounded_rect(canvas: tk.Canvas, x1: int, y1: int, x2: int, y2: int, radius: int, **kwargs: object) -> None:
        radius = min(radius, max(0, (x2 - x1) // 2), max(0, (y2 - y1) // 2))
        points = (
            x1 + radius,
            y1,
            x2 - radius,
            y1,
            x2,
            y1,
            x2,
            y1 + radius,
            x2,
            y2 - radius,
            x2,
            y2,
            x2 - radius,
            y2,
            x1 + radius,
            y2,
            x1,
            y2,
            x1,
            y2 - radius,
            x1,
            y1 + radius,
            x1,
            y1,
        )
        canvas.create_polygon(points, smooth=True, **kwargs)

    def _patch_native_window(self) -> None:
        if AppKit is None:
            return
        try:
            app = AppKit.NSApplication.sharedApplication()
            for window in app.windows():
                if str(window.title()) != self.title():
                    continue
                behavior = int(window.collectionBehavior())
                behavior &= ~int(AppKit.NSWindowCollectionBehaviorFullScreenPrimary)
                behavior &= ~int(AppKit.NSWindowCollectionBehaviorFullScreenAllowsTiling)
                behavior |= int(AppKit.NSWindowCollectionBehaviorFullScreenNone)
                window.setCollectionBehavior_(behavior)
                if hasattr(window, "setTitleVisibility_"):
                    window.setTitleVisibility_(AppKit.NSWindowTitleHidden)
                if hasattr(window, "setTitlebarAppearsTransparent_"):
                    window.setTitlebarAppearsTransparent_(True)
                zoom_button = window.standardWindowButton_(AppKit.NSWindowZoomButton)
                if zoom_button is not None:
                    zoom_button.setEnabled_(True)
                return
        except Exception:
            return

    def _build_global_scroll_indicator(self) -> None:
        self.scroll_indicator = tk.Canvas(self, width=12, bg=BG, highlightthickness=0, bd=0)
        self.scroll_indicator.place(relx=1.0, rely=0.0, relheight=1.0, anchor="ne", x=-2)
        self.scroll_indicator.bind("<Configure>", lambda _event: self._refresh_scroll_indicator())
        self.scroll_thumb = self.scroll_indicator.create_line(
            6,
            0,
            6,
            0,
            width=7,
            fill="#d0d0d5",
            capstyle="round",
            state="hidden",
        )
        self.bind("<Configure>", lambda _event: self._refresh_scroll_indicator())

    def _build_sidebar(self) -> None:
        capsule_bg = tk.Canvas(self.sidebar, bg=BG, highlightthickness=0, bd=0)
        capsule_bg.place(x=3, y=0, width=52, relheight=1, height=-70)

        def draw_capsule(_event: tk.Event | None = None) -> None:
            capsule_bg.delete("all")
            width = max(1, capsule_bg.winfo_width())
            height = max(1, capsule_bg.winfo_height())
            self._rounded_rect(capsule_bg, 1, 1, width - 1, height - 1, 999, fill="#fbfbfd", outline="#ececf1")

        capsule_bg.bind("<Configure>", draw_capsule)

        capsule = tk.Frame(self.sidebar, bg="#fbfbfd", bd=0)
        capsule.place(x=6, y=22, width=46, relheight=1, height=-114)

        nav = tk.Frame(capsule, bg="#fbfbfd")
        nav.pack(side="top", fill="x", padx=0, pady=(18, 8))
        for mode, title, icon_text in FILTER_ITEMS:
            button = tk.Canvas(
                nav,
                width=42,
                height=42,
                bg="#fbfbfd",
                highlightthickness=0,
                bd=0,
                cursor="pointinghand",
            )
            button.bind("<Button-1>", lambda _event, value=mode: self._set_filter(value))
            button.bind("<Enter>", lambda _event, widget=button, text=title: self._schedule_tooltip(widget, text))
            button.bind("<Leave>", lambda _event: self._hide_tooltip())
            button.pack(anchor="center", pady=(0, 12))
            self.filter_buttons[mode] = button
            self.filter_titles[mode] = title

        self.info_button_shell = tk.Frame(self.sidebar, bg=BG)
        self.info_button_shell.place(x=4, rely=1, y=-54, width=50, height=50, anchor="nw")
        self._draw_standalone_info_button()
        self._refresh_filter_buttons()

    def _draw_standalone_info_button(self) -> None:
        button_bg = tk.Canvas(self.info_button_shell, bg=BG, highlightthickness=0, bd=0)
        button_bg.place(x=0, y=0, relwidth=1, relheight=1)

        def draw_button(_event: tk.Event | None = None) -> None:
            button_bg.delete("all")
            self._rounded_rect(button_bg, 3, 3, 47, 47, 16, fill="#fbfbfd", outline="#ececf1")

        button_bg.bind("<Configure>", draw_button)
        self._build_info_button(self.info_button_shell, bg="#fbfbfd").place(relx=0.5, rely=0.5, anchor="center")
        self.info_button_shell.lift()

    def _build_info_button(self, parent: tk.Frame, bg: str = BG) -> tk.Canvas:
        icon = tk.Canvas(parent, width=40, height=40, bg=bg, highlightthickness=0, bd=0, cursor="pointinghand")
        icon.create_rectangle(0, 0, 40, 40, fill=bg, outline=bg, tags=("hit",))
        icon.create_oval(3, 3, 37, 37, fill=FIELD_BG, outline=FIELD_BG, tags=("hit",))
        icon.create_rectangle(10, 11, 31, 29, outline=TEXT, width=1.6, tags=("hit",))
        icon.create_oval(13, 15, 19, 21, outline=TEXT, width=1.4, tags=("hit",))
        icon.create_arc(11, 20, 21, 31, start=20, extent=140, outline=TEXT, width=1.4, style="arc", tags=("hit",))
        for y in (16, 20, 24):
            icon.create_line(22, y, 28, y, fill=TEXT, width=1.6, capstyle="round", tags=("hit",))
        icon.bind("<Button-1>", lambda _event: self._show_info_dialog())
        icon.bind("<ButtonRelease-1>", lambda _event: self._show_info_dialog())
        icon.bind("<Enter>", lambda _event, widget=icon: self._schedule_tooltip(widget, "codex账户信息"))
        icon.bind("<Leave>", lambda _event: self._hide_tooltip())
        icon.tag_bind("hit", "<Button-1>", lambda _event: self._show_info_dialog())
        icon.tag_bind("hit", "<ButtonRelease-1>", lambda _event: self._show_info_dialog())
        icon.tag_bind("hit", "<Enter>", lambda _event, widget=icon: self._schedule_tooltip(widget, "codex账户信息"))
        icon.tag_bind("hit", "<Leave>", lambda _event: self._hide_tooltip())
        return icon

    def _schedule_tooltip(self, widget: tk.Widget, text: str) -> None:
        self._hide_tooltip()
        self.tooltip_job = self.after(350, lambda: self._show_tooltip(widget, text))

    def _show_tooltip(self, widget: tk.Widget, text: str) -> None:
        self.tooltip_job = None
        tooltip = tk.Toplevel(self)
        self.tooltip = tooltip
        tooltip.withdraw()
        tooltip.overrideredirect(True)
        tooltip.configure(bg="#2c2c2e")
        label = tk.Label(tooltip, text=text, bg="#2c2c2e", fg=CARD_BG, font=(FONT_FAMILY, 12), padx=10, pady=6)
        label.pack()
        tooltip.update_idletasks()
        tooltip_width = tooltip.winfo_reqwidth()
        x = widget.winfo_rootx() + widget.winfo_width() - tooltip_width
        y = widget.winfo_rooty() + widget.winfo_height() + 6
        tooltip.geometry(f"+{max(0, x)}+{max(0, y)}")
        tooltip.deiconify()

    def _hide_tooltip(self) -> None:
        if self.tooltip_job:
            self.after_cancel(self.tooltip_job)
            self.tooltip_job = None
        if self.tooltip and self.tooltip.winfo_exists():
            self.tooltip.destroy()
        self.tooltip = None

    def _show_info_dialog(self) -> None:
        if self.info_dialog and self.info_dialog.winfo_exists():
            self.info_dialog.lift()
            self.info_dialog.focus_force()
            return
        dialog = tk.Toplevel(self)
        self.info_dialog = dialog
        dialog.withdraw()
        dialog.title("统一信息")
        dialog.configure(bg=CARD_BG)
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()

        body = tk.Frame(dialog, bg=CARD_BG, padx=28, pady=24)
        body.pack(fill="both", expand=True)
        tk.Label(body, text="统一信息", font=(FONT_FAMILY, 18, "bold"), fg=TEXT, bg=CARD_BG, anchor="center").pack(fill="x")

        for label, value in (
            ("统一用户名", SHARED_USERNAME),
            ("统一年龄", SHARED_AGE),
            ("统一密码", SHARED_PASSWORD),
        ):
            tk.Label(body, text=label, font=(FONT_FAMILY, 12), fg=MUTED, bg=CARD_BG, anchor="center").pack(fill="x", pady=(16, 4))
            value_label = tk.Label(
                body,
                text=value,
                width=24,
                font=(FONT_FAMILY, 15),
                bg=FIELD_BG,
                fg=TEXT,
                highlightthickness=1,
                highlightbackground=BORDER,
                padx=12,
                pady=8,
                cursor="pointinghand",
                anchor="center",
            )
            value_label.pack(anchor="center")
            value_label.bind("<Button-1>", lambda _event, widget=value_label, name=label: self._copy_label_value(widget, name, None))

        dialog.protocol("WM_DELETE_WINDOW", dialog.destroy)

        dialog.update_idletasks()
        dialog_width = dialog.winfo_reqwidth()
        dialog_height = dialog.winfo_reqheight()
        x = self.winfo_rootx() + (self.winfo_width() - dialog_width) // 2
        y = self.winfo_rooty() + (self.winfo_height() - dialog_height) // 2
        dialog.geometry(f"+{max(0, x)}+{max(0, y)}")
        dialog.deiconify()
        dialog.focus_force()

    def _build_table(self) -> None:
        container = tk.Frame(self.content, bg="#fbfbfd", padx=0)
        container.pack(fill="both", expand=True, pady=(0, 8))

        table_shell = tk.Frame(container, bg="#fbfbfd")
        table_shell.pack(fill="both", expand=True, padx=(0, 14))

        self.canvas = tk.Canvas(table_shell, bg="#fbfbfd", highlightthickness=0)
        self.table = tk.Frame(self.canvas, bg=CARD_BG, padx=2, pady=2)
        self.table.bind("<Configure>", self._on_table_configure)
        self.table_window = self.canvas.create_window((0, 0), window=self.table, anchor="nw")
        self.canvas.bind("<Configure>", self._sync_table_width)
        self.canvas.pack(fill="both", expand=True)
        self._bind_wheel_scroll()

        for col, (title, width) in enumerate(zip(TABLE_HEADERS, TABLE_WIDTHS)):
            label = tk.Label(
                self.table,
                text=title,
                width=TABLE_TEXT_WIDTHS[col],
                font=(FONT_FAMILY, 12, "bold"),
                fg=MUTED,
                bg=CARD_BG,
                padx=5,
                pady=10,
                anchor="center",
                bd=1,
                relief="solid",
            )
            label.grid(row=0, column=col, sticky="nsew")
            self.header_widgets[col] = label
            weight = 1 if title == "最近邮件" else 0
            self.table.grid_columnconfigure(col, minsize=width, weight=weight)
        self.bind("<Configure>", self._handle_responsive_layout, add="+")

    def _build_pagination(self) -> None:
        self.pagination = tk.Frame(self.content_shell, bg="#fbfbfd")
        self.pagination.place(relx=0, rely=1, relwidth=1, width=-28, height=48, anchor="sw", x=14, y=-14)
        self.pagination_info = tk.Label(
            self.pagination,
            text="显示 0 - 0 条，共 0 条",
            bg="#fbfbfd",
            fg=MUTED,
            font=(FONT_FAMILY, 12),
            anchor="w",
        )
        self.pagination_info.pack(side="left", padx=(10, 0))
        self.page_next = tk.Label(
            self.pagination,
            text="下一页",
            bg="#fbfbfd",
            fg="#a1a1aa",
            font=(FONT_FAMILY, 12),
            padx=10,
            cursor="pointinghand",
        )
        self.page_next.bind("<Button-1>", lambda _event: self._next_page())
        self.page_next.pack(side="right", padx=(0, 18))
        self.page_current = tk.Label(
            self.pagination,
            text="第 1 / 1 页",
            bg="#fbfbfd",
            fg=TEXT,
            font=(FONT_FAMILY, 12, "bold"),
            padx=10,
        )
        self.page_current.pack(side="right")
        self.page_prev = tk.Label(
            self.pagination,
            text="上一页",
            bg="#fbfbfd",
            fg="#a1a1aa",
            font=(FONT_FAMILY, 12),
            padx=10,
            cursor="pointinghand",
        )
        self.page_prev.bind("<Button-1>", lambda _event: self._prev_page())
        self.page_prev.pack(side="right")

    def _page_count(self, total: int) -> int:
        return max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)

    def _prev_page(self) -> None:
        if self.current_page <= 1:
            return
        self.current_page -= 1
        self.canvas.yview_moveto(0)
        self._apply_filter()

    def _next_page(self) -> None:
        total = sum(1 for account in self.accounts if self._matches_filter(account, self.filter_mode.get()))
        if self.current_page >= self._page_count(total):
            return
        self.current_page += 1
        self.canvas.yview_moveto(0)
        self._apply_filter()

    def _on_table_configure(self, _event: tk.Event) -> None:
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        self._refresh_scroll_indicator()

    def _sync_table_width(self, event: tk.Event) -> None:
        self._update_visible_columns(event.width)
        self.canvas.itemconfigure(self.table_window, width=max(event.width, self.table.winfo_reqwidth()))
        self._refresh_scroll_indicator()

    def _handle_responsive_layout(self, event: tk.Event) -> None:
        if event.widget is self:
            self._update_visible_columns(event.width)

    def _columns_for_width(self, width: int) -> set[int]:
        if width < 980:
            return MINIMAL_COLUMNS
        if width < 1160:
            return MEDIUM_COLUMNS
        if width < 1360:
            return WIDE_COLUMNS
        return ALL_COLUMNS

    def _width_for_column(self, column: int, columns: set[int]) -> int:
        if columns == MINIMAL_COLUMNS:
            return COMPACT_TABLE_WIDTHS.get(column, TABLE_WIDTHS[column])
        if columns == MEDIUM_COLUMNS:
            return MEDIUM_TABLE_WIDTHS.get(column, TABLE_WIDTHS[column])
        return TABLE_WIDTHS[column]

    def _text_width_for_column(self, column: int, columns: set[int]) -> int:
        if columns == MINIMAL_COLUMNS:
            return COMPACT_TEXT_WIDTHS.get(column, TABLE_TEXT_WIDTHS[column])
        if columns == MEDIUM_COLUMNS:
            return MEDIUM_TEXT_WIDTHS.get(column, TABLE_TEXT_WIDTHS[column])
        return TABLE_TEXT_WIDTHS[column]

    def _update_visible_columns(self, width: int | None = None) -> None:
        columns = self._columns_for_width(width or self.winfo_width())
        if columns == self.visible_columns:
            return
        self.visible_columns = columns
        for col, widget in self.header_widgets.items():
            if col in columns:
                widget.configure(width=self._text_width_for_column(col, columns))
                widget.grid()
            else:
                widget.grid_remove()
        for col in range(len(TABLE_HEADERS)):
            minsize = self._width_for_column(col, columns) if col in columns else 0
            weight = 1 if col == 2 or (col == 7 and col in columns) else 0
            self.table.grid_columnconfigure(col, minsize=minsize, weight=weight)
        for widgets in self.rows.values():
            self._configure_row_widths(widgets)
        self._apply_filter()

    def _refresh_scroll_indicator(self) -> None:
        if not hasattr(self, "canvas") or not hasattr(self, "scroll_indicator") or not hasattr(self, "scroll_thumb"):
            return
        bbox = self.canvas.bbox("all")
        canvas_height = self.canvas.winfo_height()
        indicator_height = self.scroll_indicator.winfo_height()
        if not bbox or canvas_height <= 1 or indicator_height <= 1 or bbox[3] - bbox[1] <= canvas_height:
            self.scroll_indicator.itemconfigure(self.scroll_thumb, state="hidden")
            return
        top, bottom = self.canvas.yview()
        track_top = 44
        track_bottom = max(track_top + 1, indicator_height - 4)
        y1 = track_top + (track_bottom - track_top) * top
        y2 = track_top + (track_bottom - track_top) * bottom
        if y2 - y1 < 32:
            if bottom >= 0.999:
                y2 = track_bottom
                y1 = y2 - 32
            elif top <= 0.001:
                y1 = track_top
                y2 = y1 + 32
            else:
                center = (y1 + y2) / 2
                y1 = max(track_top, center - 16)
                y2 = min(track_bottom, center + 16)
        self.scroll_indicator.coords(self.scroll_thumb, 6, y1, 6, y2)
        self.scroll_indicator.itemconfigure(self.scroll_thumb, state="normal")

    def _show_scroll_indicator(self) -> None:
        self._refresh_scroll_indicator()
        if self.scroll_indicator_hide_job:
            self.after_cancel(self.scroll_indicator_hide_job)
        self.scroll_indicator_hide_job = self.after(5000, self._hide_scroll_indicator)

    def _hide_scroll_indicator(self) -> None:
        self.scroll_indicator_hide_job = None
        self.scroll_indicator.itemconfigure(self.scroll_thumb, state="hidden")

    def _bind_wheel_scroll(self) -> None:
        self.bind_all("<MouseWheel>", self._on_mouse_wheel, add="+")
        self.bind_all("<Button-4>", self._on_mouse_wheel, add="+")
        self.bind_all("<Button-5>", self._on_mouse_wheel, add="+")

    def _on_mouse_wheel(self, event: tk.Event) -> str | None:
        bbox = self.canvas.bbox("all")
        if not bbox or bbox[3] - bbox[1] <= self.canvas.winfo_height():
            return None
        if getattr(event, "num", None) == 4:
            units = -3
        elif getattr(event, "num", None) == 5:
            units = 3
        else:
            delta = getattr(event, "delta", 0)
            if delta == 0:
                return None
            scale = 3 if abs(delta) >= 120 else 4
            units = -int(delta / 120 * scale) if abs(delta) >= 120 else -int(delta * scale)
            if units == 0:
                units = -1 if delta > 0 else 1
        self.canvas.yview_scroll(units, "units")
        self._show_scroll_indicator()
        return "break"

    def _set_filter(self, mode: str) -> None:
        self.filter_mode.set(mode)
        self.current_page = 1
        self._refresh_filter_buttons()
        self.canvas.yview_moveto(0)
        self._apply_filter()

    def _refresh_filter_buttons(self) -> None:
        selected = self.filter_mode.get()
        for mode, button in self.filter_buttons.items():
            active = mode == selected
            icon_text = next((item[2] for item in FILTER_ITEMS if item[0] == mode), mode[:1].upper())
            button.delete("all")
            if active:
                self._rounded_rect(button, 4, 4, 38, 38, 10, fill=BLUE, outline=BLUE)
                fill = CARD_BG
            else:
                self._rounded_rect(button, 4, 4, 38, 38, 10, fill="#fbfbfd", outline="#fbfbfd")
                fill = TEXT
            button.create_text(21, 21, text=icon_text, fill=fill, font=(FONT_FAMILY, 12, "bold"))

    @staticmethod
    def _email_domain(account: CodeAccount) -> str:
        return account.email.rsplit("@", 1)[-1].lower() if "@" in account.email else ""

    def _matches_filter(self, account: CodeAccount, mode: str) -> bool:
        domain = self._email_domain(account)
        if mode == "all":
            return True
        if mode == "imap":
            return account.source == "imap"
        if mode == "otp":
            return account.source == "otp"
        if mode == "gmail":
            return domain == "gmail.com"
        if mode == "mail":
            return domain == "mail.com"
        if mode == "outlook":
            return domain in OUTLOOK_DOMAINS
        if mode == "other":
            return account.source not in {"imap", "otp"} and domain not in OUTLOOK_DOMAINS | {"gmail.com", "mail.com"}
        return True

    def _load_accounts(self) -> None:
        try:
            self.accounts = load_accounts()
        except Exception as exc:
            tk.Label(
                self.table,
                text=f"加载账号失败：{exc}",
                fg=RED,
                bg=CARD_BG,
                font=(FONT_FAMILY, 13),
                padx=12,
                pady=12,
            ).grid(row=1, column=0, columnspan=9, sticky="w")
            return

        for row_index, account in enumerate(self.accounts, 1):
            self._add_account_row(row_index, account)
        self._apply_filter()
        self.canvas.yview_moveto(0)

    def _add_account_row(self, row_index: int, account: CodeAccount) -> None:
        bg = CARD_BG if row_index % 2 else "#fbfbfd"
        widgets: dict[str, object] = {"account": account, "grid_widgets": []}

        def cell_label(
            text: str,
            column: int,
            foreground: str = TEXT,
            font_size: int = 13,
            cursor: str = "",
            width_chars: int | None = None,
        ) -> tk.Label:
            label = tk.Label(
                self.table,
                text=text,
                width=width_chars or 0,
                bg=bg,
                fg=foreground,
                font=(FONT_FAMILY, font_size),
                padx=8,
                pady=11,
                anchor="center",
                justify="center",
                bd=1,
                relief="solid",
                cursor=cursor,
            )
            label.grid(row=row_index, column=column, sticky="nsew")
            widgets["grid_widgets"].append((label, column))
            return label

        def tag_cell(text: str, column: int, kind: str = "info") -> tk.Label:
            frame = tk.Frame(self.table, bg=bg, padx=5, pady=9, bd=1, relief="solid")
            frame.grid(row=row_index, column=column, sticky="nsew")
            widgets["grid_widgets"].append((frame, column))
            tag_bg, tag_fg = TAG_STYLES.get(kind, TAG_STYLES["info"])
            padx = 10 if text else 0
            pady = 4 if text else 0
            tag = tk.Label(
                frame,
                text=text,
                bg=tag_bg,
                fg=tag_fg,
                font=(FONT_FAMILY, 12, "bold"),
                padx=min(padx, 8),
                pady=pady,
                anchor="center",
            )
            if text:
                tag.pack(anchor="center")
            return tag

        cell_label(account.index, 0, MUTED, width_chars=4)
        widgets["type"] = tag_cell(source_label(account.source), 1, account.source)
        widgets["email"] = cell_label(account.email, 2, TEXT, 13, "pointinghand", 26)
        widgets["email"].bind("<Button-1>", lambda _event, widget=widgets["email"]: self._copy_label_value(widget, "邮箱", row_index))
        account_password = SHARED_PASSWORD if account.source in {"imap", "otp"} else ""
        widgets["account_password"] = cell_label(account_password, 3, TEXT, 13, "pointinghand" if account_password else "", 10)
        widgets["account_password"].bind(
            "<Button-1>",
            lambda _event, widget=widgets["account_password"]: self._copy_label_value(widget, "账号密码", row_index),
        )
        email_password = account.password if account.source in {"imap", "otp"} else ""
        widgets["email_password"] = cell_label(email_password, 4, TEXT, 13, "pointinghand" if email_password else "", 11)
        widgets["email_password"].bind(
            "<Button-1>",
            lambda _event, widget=widgets["email_password"]: self._copy_label_value(widget, "邮箱密码", row_index),
        )
        widgets["code"] = cell_label("", 5, TEXT, 13, "pointinghand", 8)
        widgets["code"].bind("<Button-1>", lambda _event, widget=widgets["code"]: self._copy_label_value(widget, "验证码", row_index))

        initial_status = "待接收" if account.source in {"imap", "otp"} else ""
        widgets["status"] = tag_cell(initial_status, 6)
        widgets["meta"] = cell_label("", 7, MUTED, 12, width_chars=18)

        button_frame = tk.Frame(self.table, bg=bg, padx=6, pady=8, bd=1, relief="solid")
        button_frame.grid(row=row_index, column=8, sticky="nsew")
        widgets["grid_widgets"].append((button_frame, 8))
        receive = tk.Label(
            button_frame,
            text="接收",
            bg=BLUE,
            fg=CARD_BG,
            highlightthickness=0,
            padx=14,
            pady=6,
            font=(FONT_FAMILY, 12, "bold"),
            cursor="pointinghand",
        )
        if account.source == "pool":
            receive.configure(text="不可用", bg="#f2f2f5", fg="#8e8e93", cursor="arrow")
        else:
            receive.bind("<Button-1>", lambda _event, acc=account: self._receive(acc))
        receive.pack(fill="x")
        widgets["button"] = receive
        self.rows[account.index] = widgets
        self._configure_row_widths(widgets)

    def _configure_row_widths(self, widgets: dict[str, object]) -> None:
        columns = self.visible_columns
        width_keys = {
            "email": 2,
            "account_password": 3,
            "email_password": 4,
            "code": 5,
            "meta": 7,
        }
        for key, col in width_keys.items():
            widget = widgets.get(key)
            if isinstance(widget, tk.Label):
                widget.configure(width=self._text_width_for_column(col, columns))
        button = widgets.get("button")
        if isinstance(button, tk.Label):
            button.configure(padx=10 if columns != MINIMAL_COLUMNS else 8)

    def _apply_filter(self) -> None:
        mode = self.filter_mode.get()
        matched_accounts = [account for account in self.accounts if self._matches_filter(account, mode)]
        total_matched = len(matched_accounts)
        page_count = self._page_count(total_matched)
        self.current_page = min(max(1, self.current_page), page_count)
        page_start = (self.current_page - 1) * PAGE_SIZE
        page_end = page_start + PAGE_SIZE
        visible_indices = {account.index for account in matched_accounts[page_start:page_end]}
        visible = 0
        for widgets in self.rows.values():
            account = widgets.get("account")
            if not isinstance(account, CodeAccount):
                continue
            should_show = account.index in visible_indices
            grid_widgets = widgets.get("grid_widgets")
            if not isinstance(grid_widgets, list):
                continue
            for item in grid_widgets:
                widget, column = item
                if should_show and column in self.visible_columns:
                    widget.grid()
                else:
                    widget.grid_remove()
            if should_show:
                visible += 1
        total = len(self.accounts)
        self.current_visible_count = visible
        if hasattr(self, "top_status"):
            self.top_status.configure(text=f"显示 {visible} / {total_matched}")
        if hasattr(self, "pagination_info"):
            start = page_start + 1 if total_matched else 0
            end = min(page_end, total_matched)
            self.pagination_info.configure(text=f"显示 {start} - {end} 条，共 {total_matched} 条", fg=MUTED)
        if hasattr(self, "page_current"):
            self.page_current.configure(text=f"第 {self.current_page} / {page_count} 页")
        if hasattr(self, "page_prev"):
            can_prev = self.current_page > 1
            self.page_prev.configure(fg=TEXT if can_prev else "#a1a1aa", cursor="pointinghand" if can_prev else "arrow")
        if hasattr(self, "page_next"):
            can_next = self.current_page < page_count
            self.page_next.configure(fg=TEXT if can_next else "#a1a1aa", cursor="pointinghand" if can_next else "arrow")
        self.after_idle(self._refresh_scroll_indicator)

    def _copy_label_value(self, label: tk.Label, field_name: str, row: int | None) -> str:
        value = str(label.cget("text")).strip()
        if not value:
            self._set_status(None, f"{field_name}为空", "warn")
            return "break"
        self.clipboard_clear()
        self.clipboard_append(value)
        self._set_status(None, f"{field_name}已复制", "ok")
        return "break"

    def _set_status(self, row: int | None, message: str, kind: str = "") -> None:
        color = {"ok": GREEN, "warn": ORANGE, "bad": RED}.get(kind, MUTED)
        if row is None:
            if hasattr(self, "top_status"):
                self.top_status.configure(text=message, foreground=color)
            elif hasattr(self, "pagination_info"):
                self.pagination_info.configure(text=message, fg=color)
            return
        account_index = str(row)
        status = self.rows.get(account_index, {}).get("status")
        if isinstance(status, tk.Label):
            self._configure_status_tag(status, message, kind or "info")

    @staticmethod
    def _configure_status_tag(status: tk.Label, message: str, kind: str) -> None:
        tag_bg, tag_fg = TAG_STYLES.get(kind, TAG_STYLES["info"])
        status.configure(text=message, bg=tag_bg, fg=tag_fg, padx=10 if message else 0, pady=4 if message else 0)
        if message and not status.winfo_ismapped():
            status.pack(anchor="center")
        elif not message and status.winfo_ismapped():
            status.pack_forget()

    def _receive(self, account: CodeAccount) -> None:
        if account.source == "pool":
            self._set_status(None, "该账号没有接码凭据", "warn")
            return
        row = self.rows[account.index]
        button = row["button"]
        code = row["code"]
        meta = row["meta"]
        if isinstance(button, tk.Label):
            if button.cget("text") != "接收":
                return
            button.configure(text="接收中", bg="#f2f2f5", fg="#8e8e93", cursor="watch")
        if isinstance(code, tk.Label):
            code.configure(text="")
        if isinstance(meta, tk.Label):
            meta.configure(text="")
        self._set_status(int(account.index), "等待新验证码...")
        started_after = time.time() - 90
        thread = threading.Thread(target=self._receive_worker, args=(account, started_after), daemon=True)
        thread.start()

    def _receive_worker(self, account: CodeAccount, started_after: float) -> None:
        deadline = time.time() + 65
        last_payload: dict[str, object] = {}
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
                        self.result_queue.put((account.index, {"kind": "done", **last_payload}))
                        return
                    self.result_queue.put((account.index, {"kind": "waiting", **last_payload}))
                    time.sleep(5)
                self.result_queue.put((account.index, {"kind": "timeout", **last_payload}))
                return

            if not account.imap_account:
                raise RuntimeError("IMAP account missing credentials")

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
                    }
                    if visible
                    else None,
                    "stale": bool(code_summaries and not chosen),
                }
                if chosen:
                    self.result_queue.put((account.index, {"kind": "done", **last_payload}))
                    return
                self.result_queue.put((account.index, {"kind": "waiting", **last_payload}))
                time.sleep(5)
            self.result_queue.put((account.index, {"kind": "timeout", **last_payload}))
        except Exception as exc:
            self.result_queue.put((account.index, {"kind": "error", "error": str(exc)}))

    def _drain_results(self) -> None:
        while True:
            try:
                account_index, payload = self.result_queue.get_nowait()
            except queue.Empty:
                break
            self._apply_result(account_index, payload)
        self.after(200, self._drain_results)

    def _apply_result(self, account_index: str, payload: dict[str, object]) -> None:
        row = self.rows.get(account_index)
        if not row:
            return
        status = row.get("status")
        code = row.get("code")
        meta = row.get("meta")
        button = row.get("button")
        kind = str(payload.get("kind", ""))
        if isinstance(meta, tk.Label):
            meta.configure(text=self._format_meta(payload.get("message")))
        if kind == "done":
            if isinstance(code, tk.Label):
                code.configure(text=str(payload.get("code") or ""))
            if isinstance(status, tk.Label):
                self._configure_status_tag(status, "已接收最新验证码", "ok")
            if isinstance(button, tk.Label):
                button.configure(text="接收", bg=BLUE, fg=CARD_BG, cursor="pointinghand")
        elif kind == "waiting":
            if payload.get("stale") and payload.get("code") and isinstance(code, tk.Label):
                code.configure(text=str(payload.get("code") or ""))
            if payload.get("stale"):
                message = "旧验证码已显示，继续等待新码..." if payload.get("code") else "旧验证码已忽略，继续等待新码..."
            else:
                message = "未找到新验证码，继续等待..."
            if isinstance(status, tk.Label):
                self._configure_status_tag(status, message, "warn")
        elif kind == "timeout":
            if payload.get("code") and isinstance(code, tk.Label):
                code.configure(text=str(payload.get("code") or ""))
            if isinstance(status, tk.Label):
                if payload.get("code"):
                    message = "超时，仅显示旧验证码"
                elif payload.get("stale"):
                    message = "超时，旧验证码已忽略"
                else:
                    message = "超时，未找到新验证码"
                self._configure_status_tag(status, message, "warn")
            if isinstance(button, tk.Label):
                button.configure(text="接收", bg=BLUE, fg=CARD_BG, cursor="pointinghand")
        elif kind == "error":
            if isinstance(status, tk.Label):
                self._configure_status_tag(status, str(payload.get("error") or "接收失败")[:120], "bad")
            if isinstance(button, tk.Label):
                button.configure(text="接收", bg=BLUE, fg=CARD_BG, cursor="pointinghand")

    @staticmethod
    def _format_meta(message: object) -> str:
        if not isinstance(message, dict):
            return ""
        mailbox = str(message.get("mailbox") or "")
        sender = str(message.get("from") or "")
        subject = str(message.get("subject") or "")
        date = str(message.get("date") or "")
        first = " · ".join(part for part in (mailbox, date, sender) if part)
        return f"{first}\n{subject}" if first and subject else first or subject


def main() -> int:
    app = ImapCodeApp()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
