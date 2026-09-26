import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActiveSessionPreference,
  SessionEntryOutcome,
  SessionRecord,
  SessionResultSnapshot,
  SessionSummary,
} from "@axi/gateway-contracts";
import { activeSessionPreferenceSchema } from "@axi/gateway-contracts";
import { localDateKey } from "@axi/resource-session/helpers";
import { projectResultSnapshot } from "@axi/resource-session/projection";
import {
  appendSessionEntry,
  createSession,
  deleteSession,
  getSession,
  listSessions,
  patchSession,
} from "../session-client";

const PROJECT_ID = "ai-resource-orchestration";
const PREFERENCE_KEY = "axi.workbench.activeSession";

export type SessionManagerStatus = "loading" | "ready" | "unavailable" | "unsynced";

export interface UseSessionManager {
  dateKey: string;
  status: SessionManagerStatus;
  statusMessage: string | null;
  sessions: SessionSummary[];
  activeSession: SessionRecord | null;
  activeSessionId: string | null;
  refresh: () => Promise<void>;
  createManual: () => Promise<SessionRecord | null>;
  switchTo: (sessionId: string) => Promise<void>;
  rename: (sessionId: string, title: string) => Promise<void>;
  remove: (sessionId: string) => Promise<void>;
  persistUserEntry: (input: { text: string; runId: string }) => Promise<{ sessionId: string | null; ok: boolean }>;
  persistOutcome: (input: {
    text: string;
    runId: string;
    outcome: SessionEntryOutcome;
    result?: Parameters<typeof projectResultSnapshot>[0];
  }) => Promise<boolean>;
  snapshotRevision: number;
}

const readPreference = (): ActiveSessionPreference | null => {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFERENCE_KEY);
    if (!raw) return null;
    const parsed = activeSessionPreferenceSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const writePreference = (value: ActiveSessionPreference | null): void => {
  if (typeof localStorage === "undefined") return;
  try {
    if (!value) {
      localStorage.removeItem(PREFERENCE_KEY);
      return;
    }
    localStorage.setItem(PREFERENCE_KEY, JSON.stringify(value));
  } catch {
    // navigation preference is best-effort
  }
};

export const useSessionManager = (): UseSessionManager => {
  const [dateKey] = useState(() => localDateKey());
  const [status, setStatus] = useState<SessionManagerStatus>("loading");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [snapshotRevision, setSnapshotRevision] = useState(0);
  const activeRef = useRef<SessionRecord | null>(null);
  const revisionRef = useRef(0);
  activeRef.current = activeSession;

  const remember = useCallback((record: SessionRecord | null) => {
    setActiveSession(record);
    activeRef.current = record;
    revisionRef.current = record?.revision ?? 0;
    setSnapshotRevision((value) => value + 1);
    if (!record) {
      writePreference(null);
      return;
    }
    writePreference({
      projectId: record.projectId,
      dateKey: record.dateKey,
      sessionId: record.id,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const refresh = useCallback(async () => {
    const listed = await listSessions();
    if (listed === null) {
      setStatus("unavailable");
      setStatusMessage("暂时无法加载历史");
      return;
    }
    setSessions(listed);
    const preference = readPreference();
    const todayDaily = listed.find((item) => item.dateKey === dateKey && item.kind === "daily" && item.status === "active");
    let targetId: string | null = null;
    if (preference && preference.dateKey === dateKey && listed.some((item) => item.id === preference.sessionId && item.status === "active")) {
      targetId = preference.sessionId;
    } else if (todayDaily) {
      targetId = todayDaily.id;
    }
    if (!targetId) {
      remember(null);
      setStatus("ready");
      setStatusMessage(null);
      return;
    }
    const detail = await getSession(targetId);
    if (!detail) {
      remember(null);
      setStatus("ready");
      setStatusMessage(null);
      return;
    }
    remember(detail);
    setStatus("ready");
    setStatusMessage(null);
  }, [dateKey, remember]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createManual = useCallback(async (): Promise<SessionRecord | null> => {
    const created = await createSession({ projectId: PROJECT_ID, dateKey, kind: "manual" });
    if (!created) {
      setStatus("unsynced");
      setStatusMessage("暂时无法新建会话");
      return null;
    }
    const detail = await getSession(created.session.id);
    if (!detail) return null;
    remember(detail);
    const listed = await listSessions();
    if (listed) setSessions(listed);
    return detail;
  }, [dateKey, remember]);

  const switchTo = useCallback(async (sessionId: string) => {
    const detail = await getSession(sessionId);
    if (!detail) {
      setStatusMessage("会话已不存在");
      await refresh();
      return;
    }
    remember(detail);
  }, [remember, refresh]);

  const rename = useCallback(async (sessionId: string, title: string) => {
    const summary = await patchSession(sessionId, { title });
    if (!summary) {
      setStatusMessage("重命名失败");
      return;
    }
    setSessions((items) => items.map((item) => item.id === sessionId ? summary : item));
    if (activeRef.current?.id === sessionId) {
      setActiveSession({ ...activeRef.current, title: summary.title, revision: summary.revision });
    }
  }, []);

  const remove = useCallback(async (sessionId: string) => {
    const ok = await deleteSession(sessionId, { confirm: true });
    if (!ok) {
      setStatusMessage("删除失败");
      return;
    }
    const listed = await listSessions();
    if (listed) setSessions(listed);
    if (activeRef.current?.id === sessionId) {
      const daily = listed?.find((item) => item.dateKey === dateKey && item.kind === "daily" && item.status === "active");
      if (daily) {
        const detail = await getSession(daily.id);
        remember(detail);
      } else {
        remember(null);
      }
    }
  }, [dateKey, remember]);

  const persistUserEntry = useCallback(async (input: { text: string; runId: string }): Promise<{ sessionId: string | null; ok: boolean }> => {
    try {
      let current = activeRef.current;
      if (!current) {
        const created = await createSession({ projectId: PROJECT_ID, dateKey, kind: "daily" });
        if (!created) {
          setStatus("unsynced");
          setStatusMessage("历史未同步");
          return { sessionId: null, ok: false };
        }
        const detail = await getSession(created.session.id);
        if (!detail) return { sessionId: created.session.id, ok: false };
        current = detail;
        remember(detail);
      }
      const sessionId = current.id;
      const appended = await appendSessionEntry(sessionId, {
        entry: { role: "user", text: input.text, runId: input.runId },
        expectedRevision: current.revision,
      });
      if (!appended) {
        setStatus("unsynced");
        setStatusMessage("历史未同步");
        return { sessionId, ok: false };
      }
      const next = await getSession(sessionId);
      if (next && activeRef.current?.id === sessionId) remember(next);
      const listed = await listSessions(dateKey);
      if (listed) {
        setSessions((existing) => {
          const others = existing.filter((item) => item.dateKey !== dateKey);
          return [...listed, ...others];
        });
      }
      setStatus((value) => value === "unavailable" ? "unavailable" : "ready");
      return { sessionId, ok: true };
    } catch (error) {
      if (error instanceof Error && error.name === "SessionConflictError" && activeRef.current) {
        const fresh = await getSession(activeRef.current.id);
        if (fresh) remember(fresh);
      }
      setStatus("unsynced");
      setStatusMessage("历史未同步");
      return { sessionId: activeRef.current?.id ?? null, ok: false };
    }
  }, [dateKey, remember]);

  const persistOutcome = useCallback(async (input: {
    text: string;
    runId: string;
    outcome: SessionEntryOutcome;
    result?: Parameters<typeof projectResultSnapshot>[0];
    keepalive?: boolean;
  }): Promise<boolean> => {
    const current = activeRef.current;
    if (!current) return false;
    const sessionId = current.id;
    try {
      const snapshot: SessionResultSnapshot | undefined = input.result
        ? projectResultSnapshot(input.result)
        : undefined;
      const appended = await appendSessionEntry(sessionId, {
        entry: {
          role: "assistant",
          text: input.text,
          runId: input.runId,
          outcome: input.outcome,
          ...(snapshot ? { result: snapshot } : {}),
        },
        expectedRevision: current.revision,
      }, { keepalive: input.keepalive });
      if (!appended) {
        setStatus("unsynced");
        return false;
      }
      if (input.keepalive) return true;
      const next = await getSession(sessionId);
      if (activeRef.current?.id !== sessionId) return true;
      if (next) {
        setActiveSession(next);
        activeRef.current = next;
        revisionRef.current = next.revision;
      }
      return true;
    } catch {
      if (activeRef.current?.id === sessionId) setStatus("unsynced");
      return false;
    }
  }, []);

  const grouped = useMemo(() => sessions, [sessions]);

  return {
    dateKey,
    status,
    statusMessage,
    sessions: grouped,
    activeSession,
    activeSessionId: activeSession?.id ?? null,
    refresh,
    createManual,
    switchTo,
    rename,
    remove,
    persistUserEntry,
    persistOutcome,
    snapshotRevision,
  };
};
