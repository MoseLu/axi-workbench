import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClarificationOption,
  ConversationContext,
  MemoryContributionRequest,
  MemoryScope,
  MemorySettings,
  ResourceCandidate,
  RunResult,
  SessionEntryOutcome,
  SessionRecord,
} from "@axi/gateway-contracts";
import { SESSION_LIMITS } from "@axi/gateway-contracts";
import type { Planner } from "@axi/resource-orchestrator/browser";
import { runPlanner } from "../gateway-client";
import { contributeMemory } from "../memory-client";
import { makeMessageId, type ConversationMessage } from "../lib/format";
import { elapsedLabelFromMs, isUnavailableProviderResultFor, resultCopyTextFor } from "../lib/result-presentation";
import type { AssistantTurn, ConversationRun } from "../lib/conversation-turns";
import { conversationFromSession } from "../lib/session-snapshot";
import { useImagePreviewLock } from "./useImagePreviewLock";

const PROJECT_ID = "ai-resource-orchestration";

const COPY_FEEDBACK_MS = 1400;

export type { ConversationRun } from "../lib/conversation-turns";

export interface UseRunSession {
  // composer
  input: string;
  setInput: (value: string) => void;
  // run result + side effects
  lastInput: string;
  result: RunResult | null;
  runs: ConversationRun[];
  history: ConversationMessage[];
  isRunning: boolean;
  runningElapsedLabel: string;
  // message actions
  copiedMessageId: string | null;
  editingMessageId: string | null;
  cancel: () => void;
  copyMessage: (message: ConversationMessage) => Promise<void>;
  copyTurn: (turn: AssistantTurn) => Promise<void>;
  editMessage: (message: ConversationMessage) => void;
  cancelEdit: () => void;
  submitEditedMessage: (messageId: string, value: string) => Promise<void> | void;
  // submit / clarification
  submit: (rawInput: string, replaceMessageId?: string, options?: { allowFlagged?: boolean; memorySettings?: MemorySettings }) => Promise<void>;
  chooseClarification: (runId: string, option: ClarificationOption) => Promise<void> | void;
  retry: (runId: string) => Promise<void> | void;
  // preview
  previewIndex: number | null;
  previewZoom: number;
  imageItems: ResourceCandidate[];
  previewItem: ResourceCandidate | undefined;
  openPreview: (runId: string, item: ResourceCandidate) => void;
  closePreview: () => void;
  movePreview: (delta: number) => void;
  changePreviewZoom: (delta: number) => void;
  // derived
  latestUserMessageId: string | undefined;
  hasProviderWarning: boolean;
}

export interface SessionRuntimeAdapter {
  status: "loading" | "ready" | "unavailable" | "unsynced";
  dateKey: string;
  activeSessionId: string | null;
  snapshot: SessionRecord | null;
  persistUserEntry: (input: { text: string; runId: string }) => Promise<{ sessionId: string | null; ok: boolean }>;
  persistOutcome: (input: {
    text: string;
    runId: string;
    outcome: SessionEntryOutcome;
    result?: RunResult;
    keepalive?: boolean;
  }) => Promise<boolean>;
}

export interface UseRunSessionOptions {
  memoryEnabled?: boolean;
  generateEnabled?: boolean;
  defaultScope?: MemoryScope;
  defaultProjectId?: string;
  session?: SessionRuntimeAdapter;
}

const conversationFromHistory = (
  sessionId: string,
  dateKey: string,
  history: readonly ConversationMessage[],
): ConversationContext => {
  const turns = history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role, text: message.text }));
  const windowed = turns.slice(-SESSION_LIMITS.contextTurns);
  let total = windowed.reduce((sum, turn) => sum + turn.text.length, 0);
  while (windowed.length && total > SESSION_LIMITS.contextChars) {
    const removed = windowed.shift();
    total -= removed?.text.length ?? 0;
  }
  return { sessionId, dateKey, turns: windowed };
};

/**
 * Owns the conversation → planner dispatch → preview state machine for the
 * workbench. The planner is responsible for reaching providers (today via
 * `runPlanner` → `apps/gateway`), but everything the React tree needs to
 * render lives here: history, result, in-flight tracking, copy feedback,
 * in-place editing, and the image preview overlay.
 */
export const useRunSession = (planner: Planner, options: UseRunSessionOptions = {}): UseRunSession => {
  const memoryEnabled = options.memoryEnabled ?? false;
  const generateEnabled = options.generateEnabled ?? false;
  const defaultScope = options.defaultScope ?? "global";
  const defaultProjectId = options.defaultProjectId;
  const sessionAdapter = options.session;
  const memoryOptionsRef = useRef({ memoryEnabled, generateEnabled, defaultScope, defaultProjectId });
  memoryOptionsRef.current = { memoryEnabled, generateEnabled, defaultScope, defaultProjectId };
  const sessionAdapterRef = useRef(sessionAdapter);
  sessionAdapterRef.current = sessionAdapter;
  const [input, setInput] = useState("");
  const [lastInput, setLastInput] = useState("");
  const [runs, setRuns] = useState<ConversationRun[]>([]);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runningElapsedMs, setRunningElapsedMs] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [previewRunId, setPreviewRunId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  const abortRef = useRef<AbortController | null>(null);
  const runningStartedAtRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const inFlightRunIdRef = useRef<string | null>(null);
  const interruptedFlushedRef = useRef(false);

  const flushInterrupted = useCallback((keepalive: boolean) => {
    if (!isRunningRef.current || interruptedFlushedRef.current) return;
    const adapter = sessionAdapterRef.current;
    const runId = inFlightRunIdRef.current;
    if (!adapter?.activeSessionId || !runId) return;
    interruptedFlushedRef.current = true;
    void adapter.persistOutcome({
      text: "上次回复未完成。",
      runId,
      outcome: "interrupted",
      keepalive,
    });
  }, []);

  // Abort in-flight work on unmount. Page refresh/close uses pagehide so
  // the interrupted outcome can still be written with keepalive.
  useEffect(() => {
    const onPageHide = () => flushInterrupted(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      flushInterrupted(false);
      abortRef.current?.abort();
      runningStartedAtRef.current = null;
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
    };
  }, [flushInterrupted]);

  useEffect(() => {
    if (!isRunning || runningStartedAtRef.current === null) return undefined;
    const updateElapsed = () => {
      const startedAt = runningStartedAtRef.current;
      if (startedAt === null) return;
      setRunningElapsedMs(Math.max(0, Date.now() - startedAt));
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const hydratedIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const adapter = sessionAdapterRef.current;
    if (!adapter || adapter.status === "loading") return;
    const nextId = adapter.activeSessionId;
    if (hydratedIdRef.current === nextId) return;
    if (isRunningRef.current && hydratedIdRef.current == null && nextId) {
      hydratedIdRef.current = nextId;
      return;
    }
    if (isRunningRef.current) flushInterrupted(false);
    hydratedIdRef.current = nextId;
    abortRef.current?.abort();
    abortRef.current = null;
    runningStartedAtRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);
    setPreviewRunId(null);
    setPreviewIndex(null);
    if (adapter.snapshot) {
      const mapped = conversationFromSession(adapter.snapshot);
      setHistory(mapped.history);
      setRuns(mapped.runs);
      return;
    }
    if (adapter.status !== "unavailable") {
      setHistory([]);
      setRuns([]);
    }
  }, [sessionAdapter?.activeSessionId, sessionAdapter?.status, sessionAdapter?.snapshot, flushInterrupted]);

  const cancel = useCallback(() => {
    flushInterrupted(false);
    abortRef.current?.abort();
    abortRef.current = null;
    runningStartedAtRef.current = null;
    isRunningRef.current = false;
    inFlightRunIdRef.current = null;
    setIsRunning(false);
  }, [flushInterrupted]);

  const submit = useCallback(async (rawInput: string, replaceMessageId?: string, runOptions: { allowFlagged?: boolean; memorySettings?: MemorySettings } = {}) => {
    const value = rawInput.trim();
    if (!value || isRunning) return;
    const userMessageId = replaceMessageId || makeMessageId();
    const runId = makeMessageId();
    if (isRunningRef.current) flushInterrupted(false);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRunIdRef.current = runId;
    interruptedFlushedRef.current = false;
    setInput("");
    setLastInput(value);
    setEditingMessageId(null);
    setHistory((items) => {
      if (!replaceMessageId) return [...items, { id: userMessageId, role: "user", text: value, at: Date.now() }];
      const index = items.findIndex((item) => item.id === userMessageId);
      if (index < 0) return [...items, { id: userMessageId, role: "user", text: value, at: Date.now() }];
      return [...items.slice(0, index), { ...items[index], text: value, at: Date.now() }];
    });
    setRuns((items) => [
      ...items.filter((run) => run.userMessageId !== userMessageId),
      { id: runId, userMessageId, input: value, result: null, completedAt: null },
    ]);
    setPreviewRunId(null);
    setPreviewIndex(null);
    setPreviewZoom(1);
    runningStartedAtRef.current = Date.now();
    setRunningElapsedMs(0);
    isRunningRef.current = true;
    setIsRunning(true);
    const adapter = sessionAdapterRef.current;
    try {
      if (adapter) {
        const persisted = await adapter.persistUserEntry({ text: value, runId });
        if (persisted.sessionId) hydratedIdRef.current = persisted.sessionId;
      }
    } catch {
      // Persistence failure must not block the live resource query.
    }
    if (abortRef.current !== controller) return;
    try {
      const currentMemoryOptions = {
        ...memoryOptionsRef.current,
        ...(runOptions.memorySettings ? {
          memoryEnabled: runOptions.memorySettings.useMemory,
          generateEnabled: runOptions.memorySettings.generateMemory,
          defaultScope: runOptions.memorySettings.defaultScope,
          defaultProjectId: runOptions.memorySettings.defaultProjectId,
        } : {}),
      };
      const conversation = adapter?.activeSessionId
        ? conversationFromHistory(
          adapter.activeSessionId,
          adapter.dateKey,
          history.filter((item) => !replaceMessageId || item.id !== replaceMessageId),
        )
        : undefined;
      const next = await runPlanner(planner, {
        input: value,
        signal: controller.signal,
        allowFlagged: runOptions.allowFlagged,
        memoryEnabled: currentMemoryOptions.memoryEnabled,
        memoryScope: currentMemoryOptions.defaultScope,
        memoryProjectId: currentMemoryOptions.defaultScope === "project" ? currentMemoryOptions.defaultProjectId : undefined,
        conversation,
      });
      if (abortRef.current !== controller) return;
      setRuns((items) => items.map((run) => run.id === runId ? { ...run, result: next, completedAt: Date.now() } : run));
      const isQuantityConfirmation = next.clarification?.some((option) => option.id === "confirm-requested-quantity" || option.id === "show-all-results");
      const isSafetyConfirmation = next.clarification?.some((option) => option.id === "allow-flagged");
      const assistantText = next.error || (isQuantityConfirmation ? next.explanation || "请确认展示范围。" : isSafetyConfirmation ? "我找到的图片需要安全确认后才能展示。" : next.state === "clarifying" ? "请补充一点描述。" : `${next.items.length} 个结果已找到。`);
      // Failed runs already have a structured AssistantResult with the
      // response summary, diagnostics, and retry affordance. Successful
      // presenting runs render their candidates directly. Only clarification
      // or cancellation needs a plain conversational reply.
      if (next.state !== "presenting" && next.state !== "failed" && !isUnavailableProviderResultFor(next)) {
        setHistory((items) => [...items, { id: makeMessageId(), role: "assistant", text: assistantText, at: Date.now() }]);
      }
      const outcome: SessionEntryOutcome = next.state === "clarifying"
        ? "clarifying"
        : next.state === "cancelled"
          ? "cancelled"
          : next.state === "failed"
            ? "failed"
            : "presenting";
      void adapter?.persistOutcome({
        text: assistantText,
        runId,
        outcome,
        result: next,
      });

      // MEM-MVP-015 — post-run contribution. Generation is independent
      // from reading: the user may generate memory while useMemory is
      // still off. The gateway applies the final policy decision after
      // its idle delay, so failed / external-context runs are rejected
      // server-side even if this client sends their outcome metadata.
      if (currentMemoryOptions.generateEnabled && next.state === "presenting") {
        const metadata = next.memoryMetadata ?? { toolIds: [], usedExternalContext: false };
        const contribution: MemoryContributionRequest = {
          sessionId: runId,
          ...(currentMemoryOptions.defaultScope === "project" ? { projectId: currentMemoryOptions.defaultProjectId || PROJECT_ID } : {}),
          userInput: value,
          summary: value,
          outcome: "presenting",
          usedExternalContext: metadata.usedExternalContext,
          toolIds: metadata.toolIds,
        };
        void contributeMemory(contribution, { signal: controller.signal }).catch(() => undefined);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        runningStartedAtRef.current = null;
        isRunningRef.current = false;
        inFlightRunIdRef.current = null;
        setIsRunning(false);
      }
    }
  }, [isRunning, planner, history, flushInterrupted]);

  const chooseClarification = useCallback((runId: string, option: ClarificationOption) => {
    const run = runs.find((item) => item.id === runId);
    if (!run) return;
    void submit(`${run.input}；${option.value}`, undefined, { allowFlagged: option.id === "allow-flagged" });
  }, [submit, runs]);

  const retry = useCallback((runId: string) => {
    const run = runs.find((item) => item.id === runId);
    if (!run) return;
    void submit(run.input, run.userMessageId);
  }, [submit, runs]);

  /** Copies `text` and flags `feedbackId` as copied for a short beat. The id is
   * a message id for user bubbles and a run id for assistant results, so both
   * hover bars can share one piece of feedback state. */
  const copyText = useCallback(async (feedbackId: string, text: string) => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        const copyTarget = document.createElement("textarea");
        copyTarget.value = text;
        copyTarget.setAttribute("readonly", "true");
        copyTarget.style.position = "fixed";
        copyTarget.style.opacity = "0";
        document.body.appendChild(copyTarget);
        copyTarget.select();
        copied = document.execCommand("copy");
        copyTarget.remove();
      }
    } catch {
      copied = false;
    }
    if (copied) {
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
      setCopiedMessageId(feedbackId);
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId((current) => current === feedbackId ? null : current);
        copyTimeoutRef.current = null;
      }, COPY_FEEDBACK_MS);
    }
  }, []);

  const copyMessage = useCallback(
    (message: ConversationMessage) => copyText(message.id, message.text),
    [copyText],
  );

  /** Copies a whole assistant turn: the result block's readable text plus any
   * conversational lines that arrived with it, in the order they render. */
  const copyTurn = useCallback((turn: AssistantTurn) => {
    const parts = [
      ...(turn.run?.result ? [resultCopyTextFor(turn.run.result)] : []),
      ...turn.replies.map((reply) => reply.text),
    ].filter((part) => part.trim());
    if (!parts.length) return Promise.resolve();
    return copyText(turn.id, parts.join("\n\n"));
  }, [copyText]);

  const editMessage = useCallback((message: ConversationMessage) => {
    setEditingMessageId(message.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const submitEditedMessage = useCallback((messageId: string, value: string) => {
    void submit(value, messageId);
  }, [submit]);

  const latestRun = runs[runs.length - 1];
  const result = latestRun?.result || null;

  const previewRun = previewRunId === null ? undefined : runs.find((run) => run.id === previewRunId);
  const imageItems = useMemo(
    () => previewRun?.result?.items.filter((item) => item.kind === "image" && item.preview) || [],
    [previewRun],
  );
  const previewItem = previewIndex === null ? undefined : imageItems[previewIndex];

  const openPreview = useCallback((runId: string, item: ResourceCandidate) => {
    const run = runs.find((candidate) => candidate.id === runId);
    const items = run?.result?.items.filter((candidate) => candidate.kind === "image" && candidate.preview) || [];
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) return;
    setPreviewRunId(runId);
    setPreviewIndex(index);
    setPreviewZoom(1);
  }, [runs]);

  const closePreview = useCallback(() => {
    setPreviewRunId(null);
    setPreviewIndex(null);
    setPreviewZoom(1);
  }, []);

  const movePreview = useCallback((delta: number) => {
    if (!imageItems.length) return;
    setPreviewIndex((current) => current === null ? 0 : (current + delta + imageItems.length) % imageItems.length);
    setPreviewZoom(1);
  }, [imageItems.length]);

  const changePreviewZoom = useCallback((delta: number) => {
    setPreviewZoom((current) => Math.min(3, Math.max(.5, Number((current + delta).toFixed(2)))));
  }, []);

  useImagePreviewLock({
    open: previewIndex !== null,
    onClose: closePreview,
    onMove: movePreview,
  });

  const latestUserMessageId = useMemo(
    () => [...history].reverse().find((message) => message.role === "user")?.id,
    [history],
  );

  const hasProviderWarning = Boolean(result?.warnings.some((warning) => /provider 不可用/iu.test(warning)));

  return {
    input,
    setInput,
    lastInput,
    result,
    runs,
    history,
    isRunning,
    runningElapsedLabel: elapsedLabelFromMs(runningElapsedMs),
    copiedMessageId,
    editingMessageId,
    cancel,
    copyMessage,
    copyTurn,
    editMessage,
    cancelEdit,
    submitEditedMessage,
    submit,
    chooseClarification,
    retry,
    previewIndex,
    previewZoom,
    imageItems,
    previewItem,
    openPreview,
    closePreview,
    movePreview,
    changePreviewZoom,
    latestUserMessageId,
    hasProviderWarning,
  };
};
