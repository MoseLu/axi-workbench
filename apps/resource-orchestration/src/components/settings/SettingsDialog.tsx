import { useCallback } from "react";
import { Modal } from "antd";
import {
  AxiSettingsSection,
  AxiSettingsSegmented,
  AxiSettingsThemeSection,
} from "@axi/settings";
import "@axi/settings/styles.css";
import type { MemorySettings, SessionSummary } from "@axi/gateway-contracts";
import type { ThemeChoice } from "../../hooks/useTheme";
import { MemoryManagerBody } from "../memory/MemoryManagerBody";
import { MemorySettingsBody } from "../memory/MemorySettingsBody";
import { SessionDrawer } from "../session/SessionDrawer";

export type SettingsSectionId = "session" | "memory" | "theme";

interface SettingsDialogProps {
  open: boolean;
  activeSection: SettingsSectionId;
  onChangeSection: (next: SettingsSectionId) => void;
  onClose: () => void;
  theme: ThemeChoice;
  onThemeChange: (next: ThemeChoice) => void;
  onMemorySettingsChanged?: (settings: MemorySettings) => void;
  sessionDateKey: string;
  sessionItems: readonly SessionSummary[];
  activeSessionId: string | null;
  sessionStatusMessage: string | null;
  sessionBusy?: boolean;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const sectionOptions = [
  { label: "会话", value: "session" },
  { label: "记忆", value: "memory" },
  { label: "主题", value: "theme" },
] satisfies Array<{ label: string; value: SettingsSectionId }>;

const SETTINGS_TITLE_ID = "workbench-settings-title";

/**
 * Centered settings modal for the Workbench. Session history is a panel tab
 * here rather than a second top-level drawer; the shared Axi primitives still
 * own section rhythm, segmented navigation, and theme choices.
 */
export function SettingsDialog({
  open,
  activeSection,
  onChangeSection,
  onClose,
  theme,
  onThemeChange,
  onMemorySettingsChanged,
  sessionDateKey,
  sessionItems,
  activeSessionId,
  sessionStatusMessage,
  sessionBusy = false,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: SettingsDialogProps) {
  const setSettingsContentRef = useCallback((node: HTMLDivElement | null) => {
    const dialog = node?.closest<HTMLElement>("[role=dialog]");
    dialog?.setAttribute("aria-labelledby", SETTINGS_TITLE_ID);
  }, []);

  return (
    <Modal
      centered
      className="workbench-settings-modal"
      closable={false}
      footer={null}
      keyboard
      maskClosable
      mask
      open={open}
      width={720}
      onCancel={onClose}
    >
      <div ref={setSettingsContentRef} className="workbench-settings-content" aria-label="设置">
        <header className="workbench-settings-header">
          <div>
            <span className="workbench-settings-kicker">WORKBENCH</span>
            <h2 id={SETTINGS_TITLE_ID}>设置</h2>
          </div>
          <button type="button" className="workbench-settings-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <AxiSettingsSegmented<SettingsSectionId>
          ariaLabel="设置分类"
          className="workbench-settings-tabs"
          options={sectionOptions}
          value={activeSection}
          onChange={onChangeSection}
        />

        <div
          className="workbench-settings-tabpanel"
          role="tabpanel"
          aria-label={activeSection === "session" ? "会话" : activeSection === "memory" ? "记忆" : "主题"}
        >
          {activeSection === "session" ? (
            <SessionDrawer
              open
              embedded
              dateKey={sessionDateKey}
              sessions={sessionItems}
              activeSessionId={activeSessionId}
              statusMessage={sessionStatusMessage}
              busy={sessionBusy}
              onClose={() => undefined}
              onCreate={onCreateSession}
              onSelect={onSelectSession}
              onRename={onRenameSession}
              onDelete={onDeleteSession}
            />
          ) : activeSection === "memory" ? (
            <>
              <AxiSettingsSection
                title="记忆设置"
                description="控制本地记忆的读取、生成和外部上下文保护。"
              >
                <MemorySettingsBody onSettingsChanged={onMemorySettingsChanged} />
              </AxiSettingsSection>
              <AxiSettingsSection
                title="记忆管理"
                description="查看、批准、拒绝或清理已保存的本地记忆。"
              >
                <MemoryManagerBody refreshKey={activeSection} />
              </AxiSettingsSection>
            </>
          ) : (
            <AxiSettingsThemeSection
              value={theme}
              onChange={onThemeChange}
              labels={{
                theme: "外观主题",
                system: "跟随系统",
                light: "浅色",
                dark: "深色",
              }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
