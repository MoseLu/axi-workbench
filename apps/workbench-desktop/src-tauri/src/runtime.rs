use std::fs::{create_dir_all, read_to_string, OpenOptions};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::collections::HashMap;
#[cfg(unix)]
use std::os::unix::process::CommandExt;

use serde::Serialize;

const LOCAL_GATEWAY_HOST: &str = "127.0.0.1";
const LOCAL_GATEWAY_PORT: u16 = 8088;
pub const LOCAL_HTTPS_PORT: u16 = 8443;
pub const LOCAL_HTTPS_ORIGIN: &str = "https://workbench.axiomaticworld.com:8443";

#[derive(Clone, Debug, Serialize)]
pub struct LocalRuntimeStatus {
    pub mode: String,
    pub phase: String,
    pub services: HashMap<String, String>,
    #[serde(rename = "gatewayOrigin")]
    pub gateway_origin: String,
    pub error: Option<String>,
    #[serde(rename = "logPath")]
    pub log_path: Option<String>,
}

fn initial_services() -> HashMap<String, String> {
    [
        "control-plane",
        "identity-adapter",
        "platform-core",
        "api-gateway",
        "local-https",
    ]
    .into_iter()
    .map(|name| (name.to_string(), "starting".to_string()))
    .collect()
}

pub fn local_project_mode() -> bool {
    matches!(option_env!("AXI_DESKTOP_LOCAL"), Some("true"))
}

pub struct LocalRuntime {
    child: Mutex<Option<Child>>,
    pub prefer_local: AtomicBool,
    status: Mutex<LocalRuntimeStatus>,
}

impl Default for LocalRuntime {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            prefer_local: AtomicBool::new(false),
            status: Mutex::new(LocalRuntimeStatus {
                mode: "local-project".to_string(),
                phase: "discovering".to_string(),
                services: initial_services(),
                gateway_origin: LOCAL_HTTPS_ORIGIN.to_string(),
                error: None,
                log_path: None,
            }),
        }
    }
}

impl Drop for LocalRuntime {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn terminate_process_tree(process: &mut Child) {
    #[cfg(unix)]
    {
        let process_group = -(process.id() as libc::pid_t);
        // The supervisor is placed in its own process group before spawn. Killing
        // the group also reaches the Go/Node services it started.
        unsafe {
            let _ = libc::kill(process_group, libc::SIGTERM);
        }
    }

    let deadline = Instant::now() + Duration::from_secs(2);
    while Instant::now() < deadline {
        if process.try_wait().ok().flatten().is_some() {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    let _ = process.kill();
    let _ = process.wait();
}

pub fn is_workbench_root(path: &Path) -> bool {
    path.join("services/api-gateway/scripts/dev-run.sh").is_file()
        && path.join("services/control-plane/scripts/dev-run.sh").is_file()
}

pub fn discover_workspace_root() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("AXI_WORKBENCH_ROOT") {
        let path = PathBuf::from(explicit);
        if is_workbench_root(&path) {
            return Some(path);
        }
    }
    let compiled = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
    compiled.canonicalize().ok().filter(|path| is_workbench_root(path))
}

pub fn local_gateway_listening() -> bool {
    let address = format!("{LOCAL_GATEWAY_HOST}:{LOCAL_GATEWAY_PORT}")
        .parse()
        .expect("static loopback socket");
    TcpStream::connect_timeout(&address, Duration::from_millis(400)).is_ok()
}

pub fn local_https_listening() -> bool {
    let address = format!("{LOCAL_GATEWAY_HOST}:{LOCAL_HTTPS_PORT}")
        .parse()
        .expect("static loopback socket");
    TcpStream::connect_timeout(&address, Duration::from_millis(400)).is_ok()
}

pub fn repaired_path() -> std::ffi::OsString {
    let mut parts: Vec<String> = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        for extra in [".local/bin", ".cargo/bin", "go/bin"] {
            parts.push(format!("{home}/{extra}"));
        }
    }
    for extra in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ] {
        parts.push(extra.to_string());
    }
    if let Ok(existing) = std::env::var("PATH") {
        for item in existing.split(':') {
            if !item.is_empty() && !parts.iter().any(|known| known == item) {
                parts.push(item.to_string());
            }
        }
    }
    parts.join(":").into()
}

pub fn find_bin(name: &str) -> PathBuf {
    for dir in std::env::split_paths(&repaired_path()) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return candidate;
        }
    }
    PathBuf::from(name)
}

impl LocalRuntime {
    pub fn shutdown(&self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(mut process) = child.take() {
                terminate_process_tree(&mut process);
            }
        }
    }

    pub fn snapshot(&self) -> LocalRuntimeStatus {
        self.status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_else(|_| LocalRuntimeStatus {
                mode: "local-project".to_string(),
                phase: "failed".to_string(),
                services: initial_services(),
                gateway_origin: LOCAL_HTTPS_ORIGIN.to_string(),
                error: Some("desktop runtime status lock failed".to_string()),
                log_path: None,
            })
    }

    pub fn begin_start(&self) -> bool {
        let Ok(mut status) = self.status.lock() else {
            return false;
        };
        if matches!(status.phase.as_str(), "starting" | "ready") {
            return false;
        }
        status.phase = "starting".to_string();
        status.error = None;
        for value in status.services.values_mut() {
            *value = "starting".to_string();
        }
        true
    }

    fn set_log_path(&self, path: &Path) {
        if let Ok(mut status) = self.status.lock() {
            status.log_path = Some(path.display().to_string());
        }
    }

    fn child_exited(&self) -> bool {
        let Ok(mut child) = self.child.lock() else {
            return true;
        };
        match child.as_mut() {
            Some(process) => process.try_wait().ok().flatten().is_some(),
            None => true,
        }
    }

    fn runtime_log_tail(&self) -> Option<String> {
        let path = self.snapshot().log_path?;
        let content = read_to_string(path).ok()?;
        let lines: Vec<&str> = content.lines().rev().take(6).collect();
        if lines.is_empty() {
            None
        } else {
            Some(lines.into_iter().rev().collect::<Vec<_>>().join(" | "))
        }
    }

    pub fn mark_ready(&self) {
        if let Ok(mut status) = self.status.lock() {
            status.phase = "ready".to_string();
            status.error = None;
            for value in status.services.values_mut() {
                *value = "ready".to_string();
            }
        }
    }

    pub fn mark_failed(&self, error: impl Into<String>) {
        if let Ok(mut status) = self.status.lock() {
            status.phase = "failed".to_string();
            status.error = Some(error.into());
            for value in status.services.values_mut() {
                if value == "starting" {
                    *value = "failed".to_string();
                }
            }
        }
    }

    pub fn ensure_from_workspace(&self, root: &Path, log_path: &Path) -> Result<(), String> {
        self.set_log_path(&log_path);
        if local_gateway_listening() {
            if local_https_listening() {
                self.prefer_local.store(true, Ordering::SeqCst);
                return Ok(());
            }
        }

        let script = root.join("apps/workbench-desktop/scripts/ensure-local-runtime.mjs");
        if !script.is_file() {
            return Err(format!("missing desktop runtime script: {}", script.display()));
        }

        let node = find_bin("node");
        create_dir_all(log_path.parent().unwrap_or(root))
            .map_err(|error| format!("无法创建本机服务日志目录: {error}"))?;
        let stdout = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(|error| format!("无法打开本机服务日志: {error}"))?;
        let stderr = stdout
            .try_clone()
            .map_err(|error| format!("无法复制本机服务日志句柄: {error}"))?;
        let mut command = Command::new(&node);
        command
            .arg(&script)
            .arg("--supervise")
            .current_dir(root)
            .env("PATH", repaired_path())
            .env("AXI_WORKBENCH_ROOT", root)
            .env("AXI_DESKTOP_SUPERVISOR", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr));

        #[cfg(unix)]
        unsafe {
            command.pre_exec(|| {
                if libc::setpgid(0, 0) == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }

        let child = command
            .spawn()
            .map_err(|error| {
                format!("failed to spawn desktop runtime with {}: {error}", node.display())
            })?;

        {
            let mut slot = self
                .child
                .lock()
                .map_err(|_| "desktop runtime lock failed".to_string())?;
            *slot = Some(child);
        }

        let started = Instant::now();
        let ready = loop {
            if local_gateway_listening() && local_https_listening() {
                break true;
            }
            if self.child_exited() || started.elapsed() >= Duration::from_secs(60) {
                break false;
            }
            std::thread::sleep(Duration::from_millis(250));
        };
        if ready {
            self.prefer_local.store(true, Ordering::SeqCst);
            Ok(())
        } else {
            let detail = self.runtime_log_tail().unwrap_or_else(|| "无更多日志".to_string());
            Err(format!(
                "本机 Gateway/HTTPS 入口未能就绪（127.0.0.1:8088/8443）；启动日志：{}；最后日志：{}",
                log_path.display(), detail
            ))
        }
    }

    pub fn preferred_base_url(&self, requested: Option<&str>) -> Option<String> {
        if self.prefer_local.load(Ordering::SeqCst) {
            return Some(LOCAL_HTTPS_ORIGIN.to_string());
        }
        requested
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }
}

#[cfg(test)]
mod tests {
    use super::{discover_workspace_root, is_workbench_root, LocalRuntime, LOCAL_HTTPS_ORIGIN};
    use std::path::PathBuf;

    #[test]
    fn compiled_manifest_resolves_to_workbench_root() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
        assert!(is_workbench_root(&root));
        assert!(discover_workspace_root().is_some());
    }

    #[test]
    fn repaired_path_includes_user_local_bin() {
        let path = super::repaired_path();
        let path = path.to_string_lossy();
        assert!(
            path.contains("/.local/bin") || path.contains("/opt/homebrew/bin"),
            "GUI-launched PATH must include a user or Homebrew bin dir, got {path}"
        );
        let node = super::find_bin("node");
        assert!(
            node.is_file() || node == std::path::Path::new("node"),
            "find_bin(node) should resolve a real binary when one exists"
        );
    }

    #[test]
    fn prefers_local_gateway_once_marked_ready() {
        let runtime = LocalRuntime::default();
        assert_eq!(
            runtime.preferred_base_url(Some("https://workbench.axiomaticworld.com")),
            Some("https://workbench.axiomaticworld.com".to_string())
        );
        runtime.prefer_local.store(true, std::sync::atomic::Ordering::SeqCst);
        assert_eq!(
            runtime.preferred_base_url(Some("https://workbench.axiomaticworld.com")),
            Some("https://workbench.axiomaticworld.com:8443".to_string())
        );
    }

    #[test]
    fn runtime_status_starts_discovering_and_transitions_to_ready() {
        let runtime = LocalRuntime::default();
        assert_eq!(runtime.snapshot().phase, "discovering");
        assert!(runtime.begin_start());
        assert_eq!(runtime.snapshot().phase, "starting");
        runtime.mark_ready();
        let status = runtime.snapshot();
        assert_eq!(status.phase, "ready");
        assert!(status.services.values().all(|value| value == "ready"));
        assert_eq!(status.gateway_origin, LOCAL_HTTPS_ORIGIN);
    }

    #[test]
    fn failed_runtime_exposes_actionable_error_without_public_fallback() {
        let runtime = LocalRuntime::default();
        assert!(runtime.begin_start());
        runtime.mark_failed("证书不存在");
        let status = runtime.snapshot();
        assert_eq!(status.phase, "failed");
        assert_eq!(status.error.as_deref(), Some("证书不存在"));
        assert_eq!(
            runtime.preferred_base_url(Some("https://workbench.axiomaticworld.com:8443")),
            Some("https://workbench.axiomaticworld.com:8443".to_string())
        );
    }
}
