import { useCallback, useEffect, useState } from "react";
import type { MemoryEntry, MemoryScope } from "@axi/gateway-contracts";
import {
  approveMemoryEntry,
  clearMemory,
  deleteMemoryEntry,
  exportMemory,
  listMemoryEntries,
  rejectMemoryEntry,
} from "../../memory-client";

const PROJECT_ID = "ai-resource-orchestration";

interface MemoryManagerBodyProps {
  /** Forwarded by the dialog so the manager can refresh when the
   *  user re-enters the memory section without remounting the body. */
  refreshKey?: string;
}

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const truncate = (value: string, limit = 80): string => (value.length <= limit ? value : `${value.slice(0, limit - 1)}…`);

export function MemoryManagerBody({ refreshKey }: MemoryManagerBodyProps) {
  const [entries, setEntries] = useState<ReadonlyArray<MemoryEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingClear, setPendingClear] = useState<MemoryScope | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const list = await listMemoryEntries();
      setEntries(list);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取本地记忆条目。");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const handleApprove = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await approveMemoryEntry(id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "批准失败");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleReject = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await rejectMemoryEntry(id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "拒绝失败");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await deleteMemoryEntry(id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleClear = useCallback(async () => {
    if (!pendingClear) return;
    setBusy(true);
    try {
      await clearMemory(pendingClear, pendingClear === "project" ? { projectId: PROJECT_ID } : {});
      setPendingClear(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "清空失败");
    } finally {
      setBusy(false);
    }
  }, [pendingClear, refresh]);

  const handleExport = useCallback(async () => {
    try {
      const payload = await exportMemory();
      if (typeof window === "undefined") return;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `memory-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出失败");
    }
  }, []);

  return (
    <>
      <div className="memory-manager-actions">
        <button type="button" onClick={() => void refresh()} disabled={busy}>刷新</button>
        <button type="button" onClick={() => void handleExport()} disabled={busy}>导出脱敏 JSON</button>
        <button type="button" onClick={() => setPendingClear("global")} disabled={busy}>清空 global</button>
        <button type="button" onClick={() => setPendingClear("project")} disabled={busy}>清空 project</button>
      </div>
      {pendingClear && (
        <div className="memory-manager-confirm" role="alert">
          <p>确认清空 {pendingClear === "global" ? "global" : `project (${PROJECT_ID})`} 记忆吗?此操作不可恢复。</p>
          <button type="button" onClick={() => void handleClear()} disabled={busy}>确认清空</button>
          <button type="button" onClick={() => setPendingClear(null)} disabled={busy}>取消</button>
        </div>
      )}
      {error && <p className="memory-manager-error" role="alert">{error}</p>}
      {entries === null ? (
        <p className="memory-manager-loading">正在读取本地记忆条目…</p>
      ) : entries.length === 0 ? (
        <p className="memory-manager-empty">当前没有任何本地记忆条目。</p>
      ) : (
        <ul className="memory-manager-list">
          {entries.map((entry) => (
            <li key={entry.id} className={`memory-entry memory-entry-${entry.status}`}>
              <div className="memory-entry-meta">
                <span className={`status-pill status-${entry.status}`}>{entry.status}</span>
                <span className="memory-entry-kind">{entry.kind}</span>
                <span className="memory-entry-scope">{entry.scope}{entry.projectId ? `:${entry.projectId}` : ""}</span>
                <span className="memory-entry-updated">{formatTimestamp(entry.updatedAt)}</span>
              </div>
              <p className="memory-entry-summary">{truncate(entry.summary)}</p>
              <p className="memory-entry-facts">{truncate(JSON.stringify(entry.facts), 120)}</p>
              <div className="memory-entry-actions">
                {entry.status === "pending" && (
                  <>
                    <button type="button" onClick={() => void handleApprove(entry.id)} disabled={busy}>批准</button>
                    <button type="button" onClick={() => void handleReject(entry.id)} disabled={busy}>拒绝</button>
                  </>
                )}
                <button type="button" onClick={() => void handleDelete(entry.id)} disabled={busy}>删除</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
