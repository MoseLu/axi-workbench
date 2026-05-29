#!/usr/bin/env python3
"""
Local web UI for reading Outlook verification codes.

Run with:
    python3 imap_code_web.py

Then open:
    http://127.0.0.1:8765
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from dataclasses import replace

from outlook_imap_codes import (
    DEFAULT_CREDENTIALS,
    DEFAULT_FROM_FILTER,
    choose_accounts,
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


def default_credential_sources() -> tuple[Path, ...]:
    if all(path.exists() for path in BUNDLED_CREDENTIAL_SOURCES):
        return BUNDLED_CREDENTIAL_SOURCES
    return DEFAULT_CREDENTIAL_SOURCES

HTML = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Axi Verification Inbox</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --line: #d9dee8;
      --text: #172033;
      --muted: #647084;
      --primary: #1666d8;
      --primary-dark: #0d4faa;
      --ok: #0d7a47;
      --warn: #9a5b00;
      --bad: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
    }
    header {
      padding: 18px 22px 12px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }
    h1 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 650;
      letter-spacing: 0;
    }
    .sub {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }
    main { padding: 18px 22px 28px; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
      margin-bottom: 14px;
    }
    label {
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
    }
    input[type="text"] {
      width: min(320px, 80vw);
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 10px;
      color: var(--text);
      background: #fff;
      font: inherit;
    }
    button {
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 12px;
      background: #fff;
      color: var(--text);
      font: inherit;
      cursor: pointer;
      white-space: nowrap;
    }
    button.primary {
      border-color: var(--primary);
      background: var(--primary);
      color: #fff;
    }
    button.primary:hover { background: var(--primary-dark); }
    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--line);
      background: var(--panel);
    }
    table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
    }
    th {
      background: #edf1f6;
      color: #39465a;
      font-size: 12px;
      font-weight: 650;
    }
    tr:last-child td { border-bottom: 0; }
    .idx { width: 54px; color: var(--muted); }
    .label { width: 150px; }
    .email { min-width: 260px; }
    .code-cell {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .copy-field {
      height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 9px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0;
      color: var(--text);
      background: #fff;
      cursor: copy;
    }
    .copy-field:focus {
      outline: 2px solid rgba(22, 102, 216, 0.22);
      border-color: var(--primary);
    }
    .label-field { width: 126px; }
    .email-field { width: 238px; }
    .password-field { width: 180px; }
    .username-field { width: 120px; }
    .age-field { width: 80px; }
    .code {
      width: 120px;
      font-size: 16px;
      font-weight: 650;
    }
    .top-status {
      align-self: center;
      min-width: 120px;
      color: var(--muted);
      font-size: 12px;
      padding-bottom: 10px;
    }
    .top-status.ok { color: var(--ok); }
    .top-status.warn { color: var(--warn); }
    .top-status.bad { color: var(--bad); }
    .status {
      min-width: 140px;
      color: var(--muted);
      font-size: 12px;
    }
    .status.ok { color: var(--ok); }
    .status.warn { color: var(--warn); }
    .status.bad { color: var(--bad); }
    .meta {
      max-width: 360px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .meta strong { color: #39465a; font-weight: 600; }
    @media (max-width: 720px) {
      header, main { padding-left: 14px; padding-right: 14px; }
      .toolbar { align-items: stretch; }
      label, .toolbar button { width: 100%; }
      input[type="text"] { width: 100%; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Axi Verification Inbox</h1>
    <p class="sub">本地页面只显示账号和验证码结果，refresh token 留在本机 Python 服务端。</p>
  </header>
  <main>
    <div class="toolbar">
      <label>
        统一用户名
        <input id="sharedUsername" class="copy-field username-field" readonly data-name="统一用户名" value="Mose">
      </label>
      <label>
        统一年龄
        <input id="sharedAge" class="copy-field age-field" readonly data-name="统一年龄" value="35">
      </label>
      <label>
        统一密码
        <input id="sharedPassword" class="copy-field password-field" readonly data-name="统一密码" value="lah1999626123">
      </label>
      <span id="topStatus" class="top-status">点击字段可复制</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="idx">序号</th>
            <th class="label">标签</th>
            <th class="email">邮箱</th>
            <th>验证码</th>
            <th>操作</th>
            <th>状态</th>
            <th>最近邮件</th>
          </tr>
        </thead>
        <tbody id="accountsBody">
          <tr><td colspan="7">加载中...</td></tr>
        </tbody>
      </table>
    </div>
  </main>
  <script>
    const state = { accounts: [] };
    const body = document.querySelector("#accountsBody");
    const sharedUsername = document.querySelector("#sharedUsername");
    const sharedAge = document.querySelector("#sharedAge");
    const sharedPassword = document.querySelector("#sharedPassword");
    const topStatus = document.querySelector("#topStatus");

    function text(value) {
      return value == null ? "" : String(value);
    }

    function setStatus(row, message, kind = "") {
      const el = row.querySelector(".status");
      el.className = `status ${kind}`;
      el.textContent = message;
    }

    function setTopStatus(message, kind = "") {
      topStatus.className = `top-status ${kind}`;
      topStatus.textContent = message;
    }

    function setMeta(row, result) {
      const el = row.querySelector(".meta");
      if (!result || !result.message) {
        el.textContent = "";
        return;
      }
      const msg = result.message;
      el.innerHTML = `<strong>${escapeHtml(text(msg.mailbox))}</strong> · ${escapeHtml(text(msg.from))}<br>${escapeHtml(text(msg.subject))}`;
    }

    function escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function rowFor(account) {
      return document.querySelector(`tr[data-account="${CSS.escape(account.index)}"]`);
    }

    async function loadAccounts() {
      body.innerHTML = `<tr><td colspan="7">加载中...</td></tr>`;
      const response = await fetch("/api/accounts");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "加载账号失败");
      state.accounts = payload.accounts;
      body.innerHTML = state.accounts.map(account => `
        <tr data-account="${escapeHtml(account.index)}">
          <td class="idx">${escapeHtml(account.index)}</td>
          <td class="label">
            <input class="copy-field label-field" readonly data-name="标签" value="${escapeHtml(account.label)}">
          </td>
          <td class="email">
            <input class="copy-field email-field" readonly data-name="邮箱" value="${escapeHtml(account.email)}">
          </td>
          <td>
            <div class="code-cell">
              <input class="copy-field code" readonly data-name="验证码">
            </div>
          </td>
          <td><button class="receive primary">接收</button></td>
          <td class="status">待接收</td>
          <td class="meta"></td>
        </tr>
      `).join("");

      for (const account of state.accounts) {
        const row = rowFor(account);
        row.querySelector(".receive").addEventListener("click", () => receiveCode(account));
        row.querySelectorAll(".copy-field").forEach(input => {
          input.addEventListener("click", () => selectAndCopy(input, row));
        });
      }
    }

    async function receiveCode(account) {
      const row = rowFor(account);
      const button = row.querySelector(".receive");
      const codeInput = row.querySelector(".code");
      const startedAt = Math.floor(Date.now() / 1000) - 90;

      button.disabled = true;
      setStatus(row, "等待新验证码...");
      setMeta(row, null);
      try {
        let payload = null;
        const deadline = Date.now() + 65000;
        while (Date.now() <= deadline) {
          const params = new URLSearchParams({
            account: account.index,
            limit: "10",
            after: String(startedAt)
          });
          const response = await fetch(`/api/receive?${params}`);
          payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "接收失败");
          if (payload.code) break;
          codeInput.value = "";
          setStatus(row, payload.stale_code_seen ? "只有旧验证码，继续等待..." : "未找到新验证码，继续等待...", "warn");
          setMeta(row, payload);
          await sleep(5000);
        }
        if (payload && payload.code) {
          codeInput.value = payload.code;
          setStatus(row, "已接收最新验证码", "ok");
          setMeta(row, payload);
        } else {
          codeInput.value = "";
          setStatus(row, "超时，未找到新验证码", "warn");
          if (payload) setMeta(row, payload);
        }
      } catch (error) {
        setStatus(row, error.message, "bad");
      } finally {
        button.disabled = false;
      }
    }

    async function selectAndCopy(input, row) {
      input.focus();
      input.select();
      const value = input.value.trim();
      const name = input.dataset.name || "内容";
      if (!value) {
        row ? setStatus(row, `${name}为空`, "warn") : setTopStatus(`${name}为空`, "warn");
        return;
      }
      try {
        await copyText(value);
        row ? setStatus(row, `${name}已复制`, "ok") : setTopStatus(`${name}已复制`, "ok");
      } catch (error) {
        row ? setStatus(row, `${name}复制失败`, "bad") : setTopStatus(`${name}复制失败`, "bad");
      }
    }

    async function copyText(value) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return;
      }
      const ok = document.execCommand("copy");
      if (!ok) throw new Error("copy failed");
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    sharedUsername.addEventListener("click", () => selectAndCopy(sharedUsername, null));
    sharedAge.addEventListener("click", () => selectAndCopy(sharedAge, null));
    sharedPassword.addEventListener("click", () => selectAndCopy(sharedPassword, null));
    loadAccounts().catch(error => {
      body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    });
  </script>
</body>
</html>
"""


class CodeWebHandler(BaseHTTPRequestHandler):
    server: "CodeWebServer"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        try:
            if parsed.path == "/":
                self.write_html(HTML)
            elif parsed.path == "/api/accounts":
                self.handle_accounts()
            elif parsed.path == "/api/receive":
                self.handle_receive(urllib.parse.parse_qs(parsed.query))
            else:
                self.write_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
        except Exception as exc:
            self.write_json({"error": str(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def handle_accounts(self) -> None:
        accounts = self.server.load_accounts()
        self.write_json(
            {
                "accounts": [
                    {"index": account.index, "label": account.label, "email": account.email}
                    for account in accounts
                ]
            }
        )

    def handle_receive(self, query: dict[str, list[str]]) -> None:
        selector = first_query(query, "account", "1")
        limit = int(first_query(query, "limit", "10"))
        limit = max(1, min(30, limit))
        from_filter = first_query(query, "from", "").strip() or DEFAULT_FROM_FILTER
        after = parse_float(first_query(query, "after", "0"))

        accounts = self.server.load_accounts()
        account = choose_accounts(accounts, selector)[0]
        summaries = latest_messages(account, limit=limit, from_filter=from_filter)
        code_summaries = [summary for summary in summaries if summary.code]
        chosen = next(
            (
                summary
                for summary in code_summaries
                if after <= 0 or message_timestamp(summary.date) >= after
            ),
            None,
        )
        visible = chosen or (code_summaries[0] if code_summaries else (summaries[0] if summaries else None))

        self.write_json(
            {
                "account": {"index": account.index, "label": account.label, "email": account.email},
                "code": chosen.code if chosen else None,
                "message": {
                    "mailbox": visible.mailbox,
                    "from": visible.from_addr,
                    "subject": visible.subject,
                    "date": visible.date,
                }
                if visible
                else None,
                "checked": len(summaries),
                "stale_code_seen": bool(code_summaries and not chosen),
            }
        )

    def write_html(self, html: str) -> None:
        data = html.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def write_json(self, payload: dict[str, object], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class CodeWebServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], credentials: tuple[Path, ...]) -> None:
        super().__init__(server_address, CodeWebHandler)
        self.credentials = credentials

    def load_accounts(self):
        if len(self.credentials) >= 2:
            label_accounts = parse_markdown_table(self.credentials[0])
            mail_accounts = parse_markdown_table(self.credentials[1])
            return [
                replace(mail_account, index=str(index), label=label_account.label)
                for index, (label_account, mail_account) in enumerate(
                    zip(label_accounts, mail_accounts), 1
                )
            ]

        accounts = parse_markdown_table(self.credentials[0])
        return [replace(account, index=str(index)) for index, account in enumerate(accounts, 1)]


def first_query(query: dict[str, list[str]], key: str, default: str) -> str:
    values = query.get(key)
    if not values:
        return default
    return values[0]


def parse_float(value: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local web UI for Outlook IMAP codes.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--credentials",
        type=Path,
        nargs="*",
        default=list(default_credential_sources()),
        help="Markdown credentials table(s). Defaults to bundled account tables when present.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    credentials = tuple(args.credentials)
    for path in credentials:
        if not path.exists():
            print(f"Credentials file not found: {path}", file=sys.stderr)
            return 1

    server = CodeWebServer((args.host, args.port), credentials)
    print(f"Serving IMAP code UI at http://{args.host}:{args.port}")
    for path in credentials:
        print(f"Credentials table: {path}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
