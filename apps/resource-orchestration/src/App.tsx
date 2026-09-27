import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiSvgIcon } from "@axi/core";
import type { Planner } from "@axi/resource-orchestrator/browser";
import { Composer } from "./components/composer/Composer";
import { EmptyConversation } from "./components/conversation/EmptyConversation";
import { MessageBubble } from "./components/conversation/MessageBubble";
import { AssistantTurn } from "./components/conversation/AssistantTurn";
import { ImagePreviewModal } from "./components/preview/ImagePreviewModal";
import { SettingsDialog, type SettingsSectionId } from "./components/settings/SettingsDialog";
import { useRunSession } from "./hooks/useRunSession";
import { useSessionManager } from "./hooks/useSessionManager";
import { useMemorySettings } from "./hooks/useMemorySettings";
import { useTheme } from "./hooks/useTheme";
import { conversationTurnsFor } from "./lib/conversation-turns";
import { makePlanner } from "./lib/planner";

export function App() {
  const planner = useMemo<Planner>(() => makePlanner(), []);
  // Settings are persisted by the gateway, so load them before the first
  // request. The default remains OFF while the gateway is unavailable.
  const memorySettings = useMemorySettings({ autoFetch: true });
  const theme = useTheme();
  const sessions = useSessionManager();
  const session = useRunSession(planner, {
    memoryEnabled: memorySettings.settings.useMemory,
    generateEnabled: memorySettings.settings.generateMemory,
    defaultScope: memorySettings.settings.defaultScope,
    defaultProjectId: memorySettings.settings.defaultProjectId,
    session: {
      status: sessions.status,
      dateKey: sessions.dateKey,
      activeSessionId: sessions.activeSessionId,
      snapshot: sessions.activeSession,
      persistUserEntry: sessions.persistUserEntry,
      persistOutcome: sessions.persistOutcome,
    },
  });
  const submit = useCallback(async (value: string) => {
    const loadedSettings = await memorySettings.ensureLoaded();
    await session.submit(value, undefined, { memorySettings: loadedSettings });
  }, [memorySettings.ensureLoaded, session.submit]);
  const conversationLogRef = useRef<HTMLDivElement>(null);
  const turns = useMemo(
    () => conversationTurnsFor(session.history, session.runs),
    [session.history, session.runs],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("session");

  useEffect(() => {
    const log = conversationLogRef.current;
    if (!log || !session.runs.length) return;
    log.scrollTop = log.scrollHeight;
  }, [session.runs]);

  const openSettings = useCallback((section: SettingsSectionId = "session") => {
    setActiveSection(section);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    session.cancel();
    void sessions.switchTo(sessionId);
  }, [session.cancel, sessions.switchTo]);

  const createManualSession = useCallback(() => {
    session.cancel();
    void sessions.createManual();
  }, [session.cancel, sessions.createManual]);

  const previewVisible =
    !settingsOpen && session.previewItem !== undefined && session.previewIndex !== null;

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-actions">
          {sessions.statusMessage && (
            <span className="session-status" role="status">{sessions.statusMessage}</span>
          )}
          <button
            className="app-topbar-icon-button"
            type="button"
            aria-label="设置"
            title="设置"
            onClick={() => openSettings()}
          >
            <AxiSvgIcon name="settings" size={18} />
          </button>
        </div>
      </header>
      <section className="workspace-grid">
        <aside className="conversation-panel">
          <div ref={conversationLogRef} className="conversation-log" aria-live="polite">
            {session.history.length === 0 && <EmptyConversation />}
            {turns.map((turn) => turn.kind === "user" ? (
              <MessageBubble
                key={turn.id}
                message={turn.message}
                copied={session.copiedMessageId === turn.id}
                disabled={session.isRunning}
                editable={turn.id === session.latestUserMessageId}
                editing={session.editingMessageId === turn.id}
                onCopy={session.copyMessage}
                onEdit={session.editMessage}
                onCancelEdit={session.cancelEdit}
                onSubmitEdit={(value) => session.submitEditedMessage(turn.id, value)}
              />
            ) : (
              <AssistantTurn
                key={turn.id}
                turn={turn}
                copied={session.copiedMessageId === turn.id}
                onCopy={() => session.copyTurn(turn)}
                onChooseClarification={session.chooseClarification}
                onPreview={session.openPreview}
                onRetry={session.retry}
              />
            ))}
            {session.isRunning && (
              <div className="message message-assistant pending-run" aria-live="polite">
                <span className="pending-run-elapsed">{session.runningElapsedLabel}</span>
                <p className="typing" aria-label="正在加载"><i /><i /><i /></p>
              </div>
            )}
          </div>
          {!session.editingMessageId && (
            <Composer
              value={session.input}
              isRunning={session.isRunning}
              onChange={session.setInput}
              onSubmit={() => { void submit(session.input); }}
              onCancel={session.cancel}
            />
          )}
        </aside>
      </section>
      {previewVisible && (
        <ImagePreviewModal
          item={session.previewItem!}
          index={session.previewIndex!}
          total={session.imageItems.length}
          zoom={session.previewZoom}
          onClose={session.closePreview}
          onMove={session.movePreview}
          onZoom={session.changePreviewZoom}
        />
      )}
      <SettingsDialog
        open={settingsOpen}
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        onClose={closeSettings}
        theme={theme.choice}
        onThemeChange={theme.setChoice}
        onMemorySettingsChanged={memorySettings.apply}
        sessionDateKey={sessions.dateKey}
        sessionItems={sessions.sessions}
        activeSessionId={sessions.activeSessionId}
        sessionStatusMessage={sessions.statusMessage}
        sessionBusy={sessions.status === "loading"}
        onCreateSession={createManualSession}
        onSelectSession={switchSession}
        onRenameSession={(sessionId, title) => { void sessions.rename(sessionId, title); }}
        onDeleteSession={(sessionId) => { void sessions.remove(sessionId); }}
      />
    </main>
  );
}
