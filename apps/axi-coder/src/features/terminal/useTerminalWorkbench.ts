import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { Terminal as XTerm } from "@xterm/xterm";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { AppRouteKey } from "../../app/appRegistry";
import { cliLabel, errorMessage, trimTerminalTranscript } from "../../app/format";
import { api, isTauri } from "../../lib/api";
import { defaultTerminalCommands, type TerminalCli } from "./TerminalPage";

type TerminalOutputEvent = { cli: TerminalCli; sessionId: string; data: string };
type TerminalExitEvent = { cli: TerminalCli; sessionId: string; message: string };

type TerminalWorkbenchOptions = {
  activeRoute: AppRouteKey;
  busy: string | null;
  onBusyChange: (busy: string | null) => void;
  onNavigate: (route: AppRouteKey) => void;
  onNotice: (notice: string) => void;
};

const emptyTerminalRunning: Record<TerminalCli, boolean> = {
  claude: false,
  codex: false,
  gemini: false,
};

export function useTerminalWorkbench({ activeRoute, busy, onBusyChange, onNavigate, onNotice }: TerminalWorkbenchOptions) {
  const [activeTerminal, setActiveTerminal] = useState<TerminalCli>("claude");
  const [terminalCommands, setTerminalCommands] = useState<Record<TerminalCli, string>>(defaultTerminalCommands);
  const [terminalSettingsOpen, setTerminalSettingsOpen] = useState(false);
  const [terminalDraftCommand, setTerminalDraftCommand] = useState(defaultTerminalCommands.claude);
  const [terminalRunning, setTerminalRunning] = useState<Record<TerminalCli, boolean>>(emptyTerminalRunning);
  const [terminalEventsReady, setTerminalEventsReady] = useState(!isTauri);

  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const terminalFitRef = useRef<FitAddon | null>(null);
  const activeRouteRef = useRef<AppRouteKey>(activeRoute);
  const activeTerminalRef = useRef<TerminalCli>(activeTerminal);
  const terminalCommandsRef = useRef<Record<TerminalCli, string>>(terminalCommands);
  const terminalRunningRef = useRef<Record<TerminalCli, boolean>>(terminalRunning);
  const terminalSettingsOpenRef = useRef(terminalSettingsOpen);
  const terminalTranscriptRef = useRef<Record<TerminalCli, string>>({ claude: "", codex: "", gemini: "" });
  const terminalBootLinesRef = useRef<Record<TerminalCli, string>>({ claude: "", codex: "", gemini: "" });
  const terminalSessionIdsRef = useRef<Record<TerminalCli, string | null>>({ claude: null, codex: null, gemini: null });
  const terminalStartingRef = useRef<Set<TerminalCli>>(new Set());

  useEffect(() => {
    void refreshTerminalCommands();
  }, []);

  useEffect(() => {
    activeRouteRef.current = activeRoute;
  }, [activeRoute]);

  useEffect(() => {
    activeTerminalRef.current = activeTerminal;
  }, [activeTerminal]);

  useEffect(() => {
    terminalCommandsRef.current = terminalCommands;
  }, [terminalCommands]);

  useEffect(() => {
    terminalRunningRef.current = terminalRunning;
  }, [terminalRunning]);

  useEffect(() => {
    terminalSettingsOpenRef.current = terminalSettingsOpen;
    if (terminalSettingsOpen) {
      setTerminalDraftCommand(terminalCommands[activeTerminal]);
    }
  }, [activeTerminal, terminalCommands, terminalSettingsOpen]);

  useEffect(() => {
    const focusIfTerminalVisible = () => focusTerminalSoon();
    const focusIfVisible = () => {
      if (document.visibilityState === "visible") {
        focusTerminalSoon();
      }
    };

    window.addEventListener("focus", focusIfTerminalVisible);
    document.addEventListener("visibilitychange", focusIfVisible);

    return () => {
      window.removeEventListener("focus", focusIfTerminalVisible);
      document.removeEventListener("visibilitychange", focusIfVisible);
    };
  }, []);

  useEffect(() => {
    if (!isTauri) {
      return;
    }

    let outputUnlisten: UnlistenFn | undefined;
    let exitUnlisten: UnlistenFn | undefined;
    void (async () => {
      try {
        outputUnlisten = await listen<TerminalOutputEvent>("terminal-output", (event) => {
          if (terminalSessionIdsRef.current[event.payload.cli] !== event.payload.sessionId) {
            return;
          }
          appendTerminalOutput(event.payload.cli, event.payload.data);
        });
        exitUnlisten = await listen<TerminalExitEvent>("terminal-exit", (event) => {
          if (terminalSessionIdsRef.current[event.payload.cli] !== event.payload.sessionId) {
            return;
          }
          terminalSessionIdsRef.current[event.payload.cli] = null;
          setTerminalRunningState(event.payload.cli, false);
          appendTerminalOutput(event.payload.cli, `\r\n\x1b[31m[Axi Coder]\x1b[0m ${event.payload.message}\r\n`);
        });
        setTerminalEventsReady(true);
      } catch (err) {
        appendTerminalOutput(
          activeTerminalRef.current,
          `\r\n\x1b[31m[Axi Coder] 无法注册 Tauri 事件监听器：${String(err)}\x1b[0m\r\n`,
        );
      }
    })();

    return () => {
      outputUnlisten?.();
      exitUnlisten?.();
    };
  }, []);

  useEffect(() => {
    if (activeRoute !== "/terminal" || !terminalElementRef.current || terminalRef.current) {
      return;
    }

    const term = new XTerm({
      allowProposedApi: true,
      convertEol: true,
      cursorBlink: true,
      fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.18,
      scrollback: 6000,
      theme: {
        background: "var(--axi-bg-page, #0b0f16)",
        cursor: "var(--axi-text-inverse, #ffffff)",
        foreground: "var(--axi-text, #e6edf3)",
        selectionBackground: "var(--axi-primary, #244f8f)",
      },
    });
    const fit = new FitAddon();
    terminalRef.current = term;
    terminalFitRef.current = fit;

    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = "11";

    term.loadAddon(fit);
    term.open(terminalElementRef.current);
    focusTerminalSoon();

    const fitTerminal = () => {
      fit.fit();
      void api.resizeTerminalSession(activeTerminalRef.current, term.rows, term.cols).catch(() => undefined);
    };
    const dataDisposable = term.onData((data) => {
      void api.writeTerminalInput(activeTerminalRef.current, data).catch(() => undefined);
    });
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      void api.resizeTerminalSession(activeTerminalRef.current, rows, cols).catch(() => undefined);
    });
    window.addEventListener("resize", fitTerminal);
    window.setTimeout(fitTerminal, 0);

    return () => {
      window.removeEventListener("resize", fitTerminal);
      dataDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
      terminalRef.current = null;
      terminalFitRef.current = null;
    };
  }, [activeRoute]);

  useEffect(() => {
    if (activeRoute !== "/terminal" || !terminalEventsReady) {
      return;
    }

    window.setTimeout(() => {
      terminalFitRef.current?.fit();
      renderTerminalTranscript(activeTerminal);
      void startTerminal(activeTerminal);
      focusTerminal();
    }, 0);
  }, [activeTerminal, activeRoute, terminalEventsReady]);

  async function refreshTerminalCommands() {
    try {
      const configs = await api.listTerminalCommands();
      const next = { ...defaultTerminalCommands };
      for (const config of configs) {
        next[config.cli] = config.command;
      }
      setTerminalCommands(next);
      terminalCommandsRef.current = next;
      if (!terminalSettingsOpenRef.current) {
        setTerminalDraftCommand(next[activeTerminalRef.current]);
      }
    } catch (error) {
      onNotice(errorMessage(error));
    }
  }

  function openTerminalView(cli: TerminalCli = activeTerminalRef.current) {
    setActiveTerminal(cli);
    onNavigate("/terminal");
  }

  function openTerminalSettings() {
    setTerminalDraftCommand(terminalCommandsRef.current[activeTerminalRef.current]);
    setTerminalSettingsOpen(true);
  }

  async function saveTerminalSettings() {
    const cli = activeTerminalRef.current;
    const command = terminalDraftCommand.trim();
    if (!command) {
      onNotice("终端命令不能为空");
      return;
    }

    onBusyChange(`terminal-command-${cli}`);
    onNotice("");
    try {
      const saved = await api.setTerminalCommand(cli, command);
      const next = { ...terminalCommandsRef.current, [saved.cli]: saved.command };
      setTerminalCommands(next);
      terminalCommandsRef.current = next;
      setTerminalSettingsOpen(false);
      onNotice(`${cliLabel(cli)} 终端命令已保存`);
      await startTerminal(cli, true);
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      onBusyChange(null);
    }
  }

  function setTerminalRunningState(cli: TerminalCli, running: boolean) {
    const next = { ...terminalRunningRef.current, [cli]: running };
    terminalRunningRef.current = next;
    setTerminalRunning(next);
  }

  function focusTerminal() {
    if (activeRouteRef.current !== "/terminal" || terminalSettingsOpenRef.current) {
      return;
    }
    terminalRef.current?.focus();
  }

  function focusTerminalSoon() {
    window.setTimeout(focusTerminal, 0);
  }

  function appendTerminalOutput(cli: TerminalCli, data: string) {
    terminalTranscriptRef.current[cli] = trimTerminalTranscript(terminalTranscriptRef.current[cli] + data);
    if (activeTerminalRef.current === cli) {
      terminalRef.current?.write(data);
    }
  }

  function replaceTerminalTranscript(cli: TerminalCli, data: string) {
    terminalTranscriptRef.current[cli] = trimTerminalTranscript(data);
    if (activeTerminalRef.current === cli) {
      renderTerminalTranscript(cli);
    }
  }

  async function syncTerminalTranscript(cli: TerminalCli, sessionId: string) {
    try {
      const result = await api.readTerminalTranscript(cli);
      if (result.sessionId !== sessionId || terminalSessionIdsRef.current[cli] !== sessionId) {
        return;
      }

      const bootLine = terminalBootLinesRef.current[cli] ?? "";
      const nextTranscript = trimTerminalTranscript(bootLine + result.data);
      if (nextTranscript.length > terminalTranscriptRef.current[cli].length) {
        replaceTerminalTranscript(cli, nextTranscript);
      }
    } catch {
      // Live terminal events remain the primary path; transcript sync is a recovery path.
    }
  }

  function renderTerminalTranscript(cli: TerminalCli) {
    const term = terminalRef.current;
    if (!term) {
      return;
    }

    term.reset();
    const transcript = terminalTranscriptRef.current[cli];
    if (transcript) {
      term.write(transcript);
    }
  }

  async function startTerminal(cli: TerminalCli, restart = false) {
    if (terminalStartingRef.current.has(cli) || (!restart && terminalRunningRef.current[cli])) {
      return;
    }

    terminalStartingRef.current.add(cli);
    const term = terminalRef.current;
    const command = terminalCommandsRef.current[cli] || defaultTerminalCommands[cli];
    const sessionId = crypto.randomUUID();
    terminalSessionIdsRef.current[cli] = sessionId;
    const bootLine = `\x1b[2m$ ${command}\x1b[0m\r\n`;
    terminalBootLinesRef.current[cli] = bootLine;
    if (activeTerminalRef.current === cli) {
      terminalTranscriptRef.current[cli] = bootLine;
      term?.reset();
      term?.write(bootLine);
      focusTerminalSoon();
    }
    setTerminalRunningState(cli, true);

    try {
      const rows = term?.rows ?? 28;
      const cols = term?.cols ?? 100;
      const result = await api.startTerminalSession(cli, sessionId, rows, cols);
      if (result.started) {
        for (const delayMs of [80, 300, 1000]) {
          window.setTimeout(() => {
            void syncTerminalTranscript(cli, sessionId);
          }, delayMs);
        }
      }
      if (!isTauri) {
        appendTerminalOutput(
          cli,
          `\r\n\x1b[32m[Axi Coder]\x1b[0m ${cliLabel(result.cli)} 模拟终端已启动，真实 CLI 会在 Tauri 桌面环境中运行。\r\n`,
        );
      }
    } catch (error) {
      if (terminalSessionIdsRef.current[cli] === sessionId) {
        terminalSessionIdsRef.current[cli] = null;
      }
      setTerminalRunningState(cli, false);
      appendTerminalOutput(cli, `\r\n\x1b[31m[Axi Coder] 终端启动失败：${errorMessage(error)}\x1b[0m\r\n`);
    } finally {
      terminalStartingRef.current.delete(cli);
    }
  }

  return {
    activeTerminal,
    busy,
    terminalCommands,
    terminalDraftCommand,
    terminalElementRef,
    terminalRunning,
    terminalSettingsOpen,
    focusTerminal,
    openTerminalSettings,
    openTerminalView,
    saveTerminalSettings,
    setActiveTerminal,
    setTerminalDraftCommand,
    setTerminalSettingsOpen,
  };
}
