use crate::models::{TerminalTranscriptResult, CLI_CLAUDE, CLI_CODEX, CLI_GEMINI};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

type TerminalResult<T> = Result<T, String>;

#[derive(Clone, Default)]
pub struct TerminalRuntime {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
    transcripts: Arc<Mutex<HashMap<String, TerminalTranscript>>>,
}

struct TerminalSession {
    session_id: String,
    killer: Box<dyn ChildKiller + Send + Sync>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

struct TerminalTranscript {
    session_id: String,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    cli: String,
    session_id: String,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    cli: String,
    session_id: String,
    message: String,
}

impl TerminalRuntime {
    pub fn start(
        &self,
        app: AppHandle,
        cli: &str,
        session_id: &str,
        command: &str,
        rows: u16,
        cols: u16,
    ) -> TerminalResult<()> {
        validate_terminal_cli(cli)?;
        let command = command.trim();
        if command.is_empty() {
            return Err("终端命令不能为空。".to_string());
        }

        self.stop(cli)?;

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(8),
                cols: cols.max(20),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(to_terminal_error)?;

        let cwd = dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        if cli == "claude" && !cwd.is_empty() {
            auto_trust_claude_workspace(&cwd);
        }

        let shell = login_shell();
        let mut cmd = CommandBuilder::new(&shell);
        let path_env = std::env::var("PATH").unwrap_or_default();
        let script = format!(
            "export PATH=\"{}:$PATH\"\n{}\nexec {}",
            path_env, command, shell
        );
        cmd.args(["-lc", &script]);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("AXI_CODER_TERMINAL", "1");
        if !cwd.is_empty() {
            cmd.cwd(&cwd);
        }

        let mut child = pair.slave.spawn_command(cmd).map_err(to_terminal_error)?;
        let killer = child.clone_killer();
        let mut reader = pair.master.try_clone_reader().map_err(to_terminal_error)?;
        let writer = pair.master.take_writer().map_err(to_terminal_error)?;

        {
            let mut sessions = self.sessions.lock().expect("terminal mutex poisoned");
            sessions.insert(
                cli.to_string(),
                TerminalSession {
                    session_id: session_id.to_string(),
                    killer,
                    master: pair.master,
                    writer,
                },
            );
        }
        {
            let mut transcripts = self.transcripts.lock().expect("terminal transcript mutex poisoned");
            transcripts.insert(
                cli.to_string(),
                TerminalTranscript {
                    session_id: session_id.to_string(),
                    data: String::new(),
                },
            );
        }

        let runtime_for_output = self.clone();
        let cli_for_thread = cli.to_string();
        let session_for_thread = session_id.to_string();
        let output_app = app.clone();
        thread::spawn(move || {
            let mut buf = [0_u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        runtime_for_output.append_output(&cli_for_thread, &session_for_thread, &data);
                        let _ = output_app.emit(
                            "terminal-output",
                            TerminalOutputPayload {
                                cli: cli_for_thread.clone(),
                                session_id: session_for_thread.clone(),
                                data,
                            },
                        );
                    }
                    Err(error) => {
                        let _ = output_app.emit(
                            "terminal-output",
                            TerminalOutputPayload {
                                cli: cli_for_thread.clone(),
                                session_id: session_for_thread.clone(),
                                data: format!("\r\n[Axi Coder] 读取终端输出失败：{error}\r\n"),
                            },
                        );
                        break;
                    }
                }
            }
        });

        let runtime = self.clone();
        let cli_for_wait = cli.to_string();
        let session_for_wait = session_id.to_string();
        thread::spawn(move || {
            let message = match child.wait() {
                Ok(status) => format!("终端进程已退出：{status}"),
                Err(error) => format!("终端进程状态读取失败：{error}"),
            };

            runtime.mark_session_exit(&cli_for_wait, &session_for_wait, &message);
            let _ = app.emit(
                "terminal-exit",
                TerminalExitPayload {
                    cli: cli_for_wait,
                    session_id: session_for_wait,
                    message,
                },
            );
        });

        Ok(())
    }

    pub fn transcript(&self, cli: &str) -> TerminalResult<TerminalTranscriptResult> {
        validate_terminal_cli(cli)?;
        let transcripts = self
            .transcripts
            .lock()
            .expect("terminal transcript mutex poisoned");
        if let Some(transcript) = transcripts.get(cli) {
            Ok(TerminalTranscriptResult {
                cli: cli.to_string(),
                session_id: Some(transcript.session_id.clone()),
                data: transcript.data.clone(),
            })
        } else {
            Ok(TerminalTranscriptResult {
                cli: cli.to_string(),
                session_id: None,
                data: String::new(),
            })
        }
    }

    pub fn write(&self, cli: &str, data: &str) -> TerminalResult<()> {
        validate_terminal_cli(cli)?;
        let mut sessions = self.sessions.lock().expect("terminal mutex poisoned");
        let session = sessions
            .get_mut(cli)
            .ok_or_else(|| "当前终端尚未启动。".to_string())?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(to_terminal_error)?;
        session.writer.flush().map_err(to_terminal_error)
    }

    pub fn resize(&self, cli: &str, rows: u16, cols: u16) -> TerminalResult<()> {
        validate_terminal_cli(cli)?;
        let sessions = self.sessions.lock().expect("terminal mutex poisoned");
        if let Some(session) = sessions.get(cli) {
            session
                .master
                .resize(PtySize {
                    rows: rows.max(8),
                    cols: cols.max(20),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(to_terminal_error)?;
        }
        Ok(())
    }

    pub fn stop(&self, cli: &str) -> TerminalResult<()> {
        validate_terminal_cli(cli)?;
        let mut sessions = self.sessions.lock().expect("terminal mutex poisoned");
        if let Some(mut session) = sessions.remove(cli) {
            let _ = session.killer.kill();
        }
        Ok(())
    }

    fn mark_session_exit(&self, cli: &str, session_id: &str, message: &str) {
        let mut sessions = self.sessions.lock().expect("terminal mutex poisoned");
        if sessions
            .get(cli)
            .map(|session| session.session_id.as_str() == session_id)
            .unwrap_or(false)
        {
            sessions.remove(cli);
        }
        drop(sessions);
        self.append_output(
            cli,
            session_id,
            &format!("\r\n\x1b[31m[Axi Coder]\x1b[0m {message}\r\n"),
        );
    }

    fn append_output(&self, cli: &str, session_id: &str, data: &str) {
        let mut transcripts = self
            .transcripts
            .lock()
            .expect("terminal transcript mutex poisoned");
        if let Some(transcript) = transcripts.get_mut(cli) {
            if transcript.session_id == session_id {
                transcript.data = trim_terminal_transcript(&(transcript.data.clone() + data));
            }
        }
    }
}

fn validate_terminal_cli(cli: &str) -> TerminalResult<()> {
    match cli {
        CLI_CLAUDE | CLI_CODEX | CLI_GEMINI => Ok(()),
        _ => Err(format!("不支持的终端：{cli}")),
    }
}


fn login_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|shell| !shell.trim().is_empty())
        .unwrap_or_else(|| "/bin/zsh".to_string())
}

fn auto_trust_claude_workspace(cwd: &str) {
    if let Some(mut claude_json_path) = dirs::home_dir() {
        claude_json_path.push(".claude.json");
        
        let mut json: serde_json::Value = if claude_json_path.exists() {
            std::fs::read_to_string(&claude_json_path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
                .unwrap_or_else(|| serde_json::json!({ "projects": {} }))
        } else {
            serde_json::json!({ "projects": {} })
        };

        if let Some(projects) = json.get_mut("projects").and_then(|p| p.as_object_mut()) {
            if let Some(project) = projects.get_mut(cwd).and_then(|p| p.as_object_mut()) {
                project.insert("hasTrustDialogAccepted".to_string(), serde_json::json!(true));
                project.insert("lastGracefulShutdown".to_string(), serde_json::json!(true));
            } else {
                projects.insert(cwd.to_string(), serde_json::json!({
                    "hasTrustDialogAccepted": true,
                    "lastGracefulShutdown": true,
                    "projectOnboardingSeenCount": 0
                }));
            }
        } else if let Some(root) = json.as_object_mut() {
            root.insert("projects".to_string(), serde_json::json!({
                cwd: {
                    "hasTrustDialogAccepted": true,
                    "lastGracefulShutdown": true,
                    "projectOnboardingSeenCount": 0
                }
            }));
        }

        if let Ok(new_content) = serde_json::to_string_pretty(&json) {
            let _ = std::fs::write(&claude_json_path, new_content);
        }
    }
}

fn to_terminal_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn trim_terminal_transcript(value: &str) -> String {
    const MAX_LEN: usize = 240_000;
    if value.len() <= MAX_LEN {
        return value.to_string();
    }

    let mut start = value.len() - MAX_LEN;
    while !value.is_char_boundary(start) {
        start += 1;
    }
    value[start..].to_string()
}
