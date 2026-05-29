import { ChevronLeft, ChevronRight, KeyRound, List, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CodeAccount, RowState } from "../types";

interface AccountsPageProps {
  accounts: CodeAccount[];
  rowStates: Record<string, RowState>;
  filter: string;
  onReceive: (account: CodeAccount) => void;
  onAuthorize: (account: CodeAccount) => void;
  onCopy: (value: string, label: string) => void;
  onScrollbarChange: (scrollbar: {
    visible: boolean;
    thumbHeight: number;
    thumbTop: number;
  }) => void;
}

const outlookDomains = new Set(["outlook.com", "outlook.jp", "hotmail.com"]);
const mailDomains = new Set(["mail.com", "email.com", "europe.com", "engineer.com", "politician.com"]);

export function AccountsPage({
  accounts,
  rowStates,
  filter,
  onReceive,
  onAuthorize,
  onCopy,
  onScrollbarChange,
}: AccountsPageProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const filtered = useMemo(
    () => accounts.filter((account) => matchesFilter(account, filter)),
    [accounts, filter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);
  const visibleAccounts = filtered.slice(pageStart === 0 ? 0 : pageStart - 1, pageEnd);

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize, accounts.length]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  function syncScrollbar() {
    const scrollElement = bodyScrollRef.current;
    if (!scrollElement) return;
    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
    if (maxScroll <= 0) {
      onScrollbarChange({ visible: false, thumbHeight: 100, thumbTop: 0 });
      return;
    }
    const thumbHeight = Math.max((scrollElement.clientHeight / scrollElement.scrollHeight) * 100, 7);
    const thumbTop = (scrollElement.scrollTop / maxScroll) * (100 - thumbHeight);
    onScrollbarChange({ visible: true, thumbHeight, thumbTop });
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncScrollbar);
    window.addEventListener("resize", syncScrollbar);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncScrollbar);
    };
  }, [visibleAccounts.length, pageSize, filter, onScrollbarChange]);

  return (
    <main className="main-content accounts-only fade-in">
      <div className="account-table-shell">
        <div className="account-table-scroll">
          <table className="account-table account-table-header">
            <TableColGroup />
            <thead>
              <tr>
                <th>序号</th>
                <th>类型</th>
                <th>邮箱</th>
                <th>账号密码</th>
                <th>邮箱密码</th>
                <th>验证码</th>
                <th>状态</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
          </table>
          <div
            ref={bodyScrollRef}
            className="account-table-body-scroll"
            onScroll={syncScrollbar}
          >
            <table className="account-table account-table-body">
              <TableColGroup />
              <tbody>
                {visibleAccounts.map((account, rowIndex) => {
                  const state = rowStates[account.id];
                  const authorizationCode = state?.busy && account.canAuthorize ? state.code : "";
                  const statusLabel =
                    state?.statusLabel ?? (account.available ? "待接收" : account.canAuthorize ? "待授权" : "不可用");
                  return (
                    <tr key={account.id}>
                      <td className="muted">{pageStart + rowIndex}</td>
                      <td>
                        <div className="source-cell">
                          <button
                            type="button"
                            className={`source-pill source-${account.source}`}
                            onClick={() => onCopy(account.sourceLabel, "类型")}
                            title="复制类型"
                          >
                            {account.sourceLabel}
                          </button>
                          {account.isCockpit ? (
                            <span className="cockpit-pill" title="Cockpit 账号">
                              Cockpit
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <CopyButton value={account.email} label="邮箱" onCopy={onCopy} />
                      </td>
                      <td>
                        <CopyButton value={account.accountPassword} label="账号密码" onCopy={onCopy} />
                      </td>
                      <td>
                        <CopyButton value={account.emailPassword} label="邮箱密码" onCopy={onCopy} />
                      </td>
                      <td>
                        <CopyButton value={state?.code ?? ""} label="验证码" onCopy={onCopy} mono />
                      </td>
                      <td>
                        {authorizationCode ? (
                          <button
                            type="button"
                            className={`status-pill status-copy is-${state?.statusKind ?? "info"}`}
                            onClick={() => onCopy(authorizationCode, "授权代码")}
                            title="复制授权代码"
                          >
                            {statusLabel}
                          </button>
                        ) : (
                          <span className={`status-pill is-${state?.statusKind ?? "info"}`}>
                            {statusLabel}
                          </span>
                        )}
                      </td>
                      <td>
                        {account.note ? (
                          <span className="note-pill" title={account.note}>
                            {account.note}
                          </span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>
                        {account.available ? (
                          <button
                            className="receive-btn"
                            disabled={state?.busy}
                            onClick={() => onReceive(account)}
                          >
                            {state?.busy ? <RefreshCw size={13} className="spin" /> : null}
                            {state?.busy ? "接收中" : "接收"}
                          </button>
                        ) : account.canAuthorize && authorizationCode ? (
                          <button
                            type="button"
                            className="receive-btn auth-btn"
                            onClick={() => onCopy(authorizationCode, "授权代码")}
                            title="复制授权代码"
                          >
                            <KeyRound size={13} />
                            复制代码
                          </button>
                        ) : account.canAuthorize ? (
                          <button
                            className="receive-btn auth-btn"
                            disabled={state?.busy}
                            onClick={() => onAuthorize(account)}
                          >
                            {state?.busy ? <RefreshCw size={13} className="spin" /> : <KeyRound size={13} />}
                            {state?.busy ? "授权中" : "授权"}
                          </button>
                        ) : (
                          <button className="receive-btn" disabled>
                            不可用
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleAccounts.length === 0 ? (
                  <tr>
                    <td className="empty-table-state" colSpan={9}>
                      没有匹配的账号
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="account-pagination" aria-label="账号分页">
          <div className="pagination-summary">
            显示 {pageStart} - {pageEnd} 条，共 {filtered.length} 条
          </div>
          <div className="pagination-controls">
            <label className="page-size-select">
              <List size={15} />
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="每页显示数量"
              >
                {[10, 20, 30, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} 条/页
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft size={15} />
              上一页
            </button>
            <span className="page-indicator">
              第 {safePage} / {pageCount} 页
            </span>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage >= pageCount}
            >
              下一页
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function TableColGroup() {
  return (
    <colgroup>
      <col className="col-index" />
      <col className="col-source" />
      <col className="col-email" />
      <col className="col-account-password" />
      <col className="col-email-password" />
      <col className="col-code" />
      <col className="col-status" />
      <col className="col-note" />
      <col className="col-action" />
    </colgroup>
  );
}

function CopyButton({
  value,
  label,
  onCopy,
  mono,
}: {
  value: string;
  label: string;
  onCopy: (value: string, label: string) => void;
  mono?: boolean;
}) {
  return (
    <button
      className={`copy-text${mono ? " mono" : ""}`}
      onClick={() => onCopy(value, label)}
      title={value ? `复制${label}` : `${label}为空`}
    >
      <span>{value}</span>
    </button>
  );
}

function matchesFilter(account: CodeAccount, filter: string) {
  if (filter === "all") return true;
  if (filter === "otp") return account.source === "otp";
  const domain = account.email.split("@").pop()?.toLowerCase() ?? "";
  if (filter === "imap") return account.source === "imap" && !outlookDomains.has(domain) && domain !== "gmail.com" && !mailDomains.has(domain);
  if (filter === "outlook") return outlookDomains.has(domain);
  if (filter === "gmail") return domain === "gmail.com";
  if (filter === "mail") return mailDomains.has(domain);
  return true;
}
