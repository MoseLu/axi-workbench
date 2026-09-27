import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import type { SessionSummary } from "@axi/gateway-contracts";

export interface SessionDrawerProps {
  open: boolean;
  embedded?: boolean;
  dateKey: string;
  sessions: readonly SessionSummary[];
  activeSessionId: string | null;
  statusMessage: string | null;
  busy?: boolean;
  onClose: () => void;
  onCreate: () => void;
  onSelect: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
}

interface SessionGroup {
  key: string;
  label: string;
  items: SessionSummary[];
}

const groupSessions = (sessions: readonly SessionSummary[], today: string): SessionGroup[] => {
  const buckets = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const list = buckets.get(session.dateKey) ?? [];
    list.push(session);
    buckets.set(session.dateKey, list);
  }
  const keys = [...buckets.keys()].sort((left, right) => right.localeCompare(left));
  return keys.map((key) => {
    const recent = (() => {
      const todayDate = new Date(`${today}T00:00:00`);
      const that = new Date(`${key}T00:00:00`);
      const delta = Math.round((todayDate.getTime() - that.getTime()) / 86_400_000);
      if (key === today) return "今天";
      if (delta > 0 && delta <= 7) return "最近";
      return "更早";
    })();
    const heading = key === today ? "今天" : `${recent} · ${key}`;
    return {
      key,
      label: heading,
      items: buckets.get(key) ?? [],
    };
  });
};

export function SessionDrawer({
  open,
  embedded = false,
  dateKey,
  sessions,
  activeSessionId,
  statusMessage,
  busy = false,
  onClose,
  onCreate,
  onSelect,
  onRename,
  onDelete,
}: SessionDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmId(null);
      setEditingId(null);
      return undefined;
    }
    if (!embedded) closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, open, onClose]);

  const groups = useMemo(() => groupSessions(sessions, dateKey), [sessions, dateKey]);

  if (!open) return null;

  const stop = (event: MouseEvent<HTMLElement>) => event.stopPropagation();

  const submitRename = (sessionId: string) => {
    const title = draft.trim();
    if (title) onRename(sessionId, title);
    setEditingId(null);
  };

  const panel = (
      <aside
        id="session-drawer"
        className={`session-drawer${embedded ? " session-drawer-embedded" : ""}`}
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : "true"}
        aria-label={embedded ? undefined : "会话"}
        aria-labelledby={embedded ? "settings-session-title" : undefined}
        onClick={embedded ? undefined : stop}
      >
        <header className="session-drawer-header">
          <h2 id={embedded ? "settings-session-title" : undefined} className="session-drawer-title">会话</h2>
          <div className="session-drawer-header-actions">
            <button type="button" onClick={onCreate} disabled={busy}>
              新建会话
            </button>
            {!embedded && (
              <button
                ref={closeRef}
                type="button"
                className="session-drawer-close"
                onClick={onClose}
                aria-label="关闭会话列表"
              >
                ×
              </button>
            )}
          </div>
        </header>
        {statusMessage && <p className="session-drawer-status" role="status">{statusMessage}</p>}
        <div className="session-drawer-body">
          {groups.length === 0 && (
            <div className="session-drawer-empty">
              <p>还没有已保存的会话。</p>
              <button type="button" onClick={onCreate} disabled={busy}>开始新会话</button>
            </div>
          )}
          {groups.map((group) => (
            <section key={group.key} className="session-drawer-group">
              <h3 className="session-drawer-group-title">{group.label}</h3>
              <ul className="session-drawer-list">
                {group.items.map((session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <li key={session.id}>
                      <div className={`session-drawer-item${active ? " is-active" : ""}`}>
                        {editingId === session.id ? (
                          <input
                            aria-label="会话标题"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => submitRename(session.id)}
                            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                              if (event.key === "Enter") submitRename(session.id);
                              if (event.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="session-drawer-item-main"
                            onClick={() => onSelect(session.id)}
                            aria-current={active ? "true" : undefined}
                          >
                            <span className="session-drawer-item-title">
                              {session.title || "未命名会话"}
                              {session.kind === "daily" ? <span className="session-drawer-badge">当日</span> : null}
                            </span>
                            <span className="session-drawer-item-meta">
                              {session.messageCount} 条 · {new Date(session.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </button>
                        )}
                        <div className="session-drawer-item-actions">
                          <button
                            type="button"
                            aria-label={`重命名 ${session.title || "会话"}`}
                            disabled={busy}
                            onClick={() => {
                              setEditingId(session.id);
                              setDraft(session.title);
                            }}
                          >
                            重命名
                          </button>
                          {confirmId === session.id ? (
                            <>
                              <button
                                type="button"
                                className="is-danger"
                                disabled={busy}
                                onClick={() => {
                                  onDelete(session.id);
                                  setConfirmId(null);
                                }}
                              >
                                确认删除
                              </button>
                              <button type="button" onClick={() => setConfirmId(null)}>取消</button>
                            </>
                          ) : (
                            <button
                              type="button"
                              aria-label={`删除 ${session.title || "会话"}`}
                              disabled={busy}
                              onClick={() => setConfirmId(session.id)}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </aside>
  );

  if (embedded) return panel;
  return (
    <div
      className="session-drawer-backdrop"
      onClick={onClose}
      data-testid="session-drawer-backdrop"
    >
      {panel}
    </div>
  );
}
