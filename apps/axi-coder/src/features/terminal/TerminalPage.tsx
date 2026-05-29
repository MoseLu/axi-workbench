import { RotateCcw, Save, Settings, X } from "lucide-react";
import type { RefObject } from "react";
import { cliLabel } from "../../app/format";
import type { CliRoute } from "../providers/types";

export type TerminalCli = CliRoute["cli"];

export type TerminalPageProps = {
  activeTerminal: TerminalCli;
  busy: string | null;
  terminalCommands: Record<TerminalCli, string>;
  terminalDraftCommand: string;
  terminalElementRef: RefObject<HTMLDivElement>;
  terminalRunning: Record<TerminalCli, boolean>;
  terminalSettingsOpen: boolean;
  onCloseSettings: () => void;
  onFocusTerminal: () => void;
  onSaveSettings: () => void;
  onSetDraftCommand: (command: string) => void;
  onSetTerminal: (cli: TerminalCli) => void;
  onShowSettings: () => void;
};

const cliNames: TerminalCli[] = ["claude", "codex", "gemini"];
const defaultTerminalCommands: Record<TerminalCli, string> = {
  claude: "claude --dangerously-skip-permissions",
  codex: "codex",
  gemini: "gemini",
};

export function TerminalPage({
  activeTerminal,
  busy,
  terminalCommands,
  terminalDraftCommand,
  terminalElementRef,
  terminalRunning,
  terminalSettingsOpen,
  onCloseSettings,
  onFocusTerminal,
  onSaveSettings,
  onSetDraftCommand,
  onSetTerminal,
  onShowSettings,
}: TerminalPageProps) {
  return (
    <section className="terminal-view">
      <div className="terminal-command-summary terminal-command-bar">
        <div className="terminal-switcher" role="tablist" aria-label="切换终端">
          {cliNames.map((cli) => (
            <button
              aria-selected={activeTerminal === cli}
              className={activeTerminal === cli ? "active" : ""}
              key={cli}
              onClick={() => onSetTerminal(cli)}
              role="tab"
              type="button"
            >
              {cliLabel(cli)}
            </button>
          ))}
        </div>
        <span className={terminalRunning[activeTerminal] ? "terminal-state running" : "terminal-state"}>
          {terminalRunning[activeTerminal] ? "运行中" : "待启动"}
        </span>
        <code>{terminalCommands[activeTerminal]}</code>
        <button className="icon-button" onClick={onShowSettings} title="终端设置" type="button">
          <Settings size={18} />
        </button>
      </div>
      <div className="terminal-frame" onPointerDown={onFocusTerminal}>
        <div className="terminal-toolbar">
          <div className="terminal-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <strong>{cliLabel(activeTerminal)}</strong>
          <span>{terminalCommands[activeTerminal]}</span>
        </div>
        <div className="embedded-terminal" ref={terminalElementRef} />
      </div>
      {terminalSettingsOpen ? (
        <div className="settings-backdrop" role="presentation" onMouseDown={onCloseSettings}>
          <aside className="settings-panel" aria-label="终端设置" onMouseDown={(event) => event.stopPropagation()}>
            <div className="settings-heading">
              <div>
                <p className="eyebrow">设置</p>
                <h2>{cliLabel(activeTerminal)} 终端</h2>
              </div>
              <button className="icon-button subtle" onClick={onCloseSettings} title="关闭" type="button">
                <X size={18} />
              </button>
            </div>
            <label>
              当前终端命令
              <input
                value={terminalDraftCommand}
                onChange={(event) => onSetDraftCommand(event.target.value)}
                placeholder={defaultTerminalCommands[activeTerminal]}
              />
            </label>
            <div className="settings-actions">
              <button type="button" onClick={() => onSetDraftCommand(defaultTerminalCommands[activeTerminal])}>
                <RotateCcw size={16} />
                恢复默认
              </button>
              <button className="primary" type="button" onClick={onSaveSettings} disabled={busy === `terminal-command-${activeTerminal}`}>
                <Save size={16} />
                保存并重启
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export { cliNames, defaultTerminalCommands };
