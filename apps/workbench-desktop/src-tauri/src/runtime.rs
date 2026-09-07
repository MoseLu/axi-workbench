use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const LOCAL_GATEWAY_HOST: &str = "127.0.0.1";
const LOCAL_GATEWAY_PORT: u16 = 8088;

pub struct LocalRuntime {
    child: Mutex<Option<Child>>,
    pub prefer_local: AtomicBool,
}

impl Default for LocalRuntime {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            prefer_local: AtomicBool::new(false),
        }
    }
}

impl Drop for LocalRuntime {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(mut process) = child.take() {
                let _ = process.kill();
                let _ = process.wait();
            }
        }
    }
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

fn repaired_path() -> std::ffi::OsString {
    let extras = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
    ];
    let mut parts: Vec<String> = extras.iter().map(|value| (*value).to_string()).collect();
    if let Ok(existing) = std::env::var("PATH") {
        for item in existing.split(':') {
            if !item.is_empty() && !parts.iter().any(|known| known == item) {
                parts.push(item.to_string());
            }
        }
    }
    parts.join(":").into()
}

fn wait_for_local_gateway(timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if local_gateway_listening() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    local_gateway_listening()
}

impl LocalRuntime {
    pub fn ensure_from_workspace(&self, root: &Path) -> Result<(), String> {
        if local_gateway_listening() {
            self.prefer_local.store(true, Ordering::SeqCst);
            return Ok(());
        }

        let script = root.join("apps/workbench-desktop/scripts/ensure-local-runtime.mjs");
        if !script.is_file() {
            return Err(format!("missing desktop runtime script: {}", script.display()));
        }

        let child = Command::new("node")
            .arg(&script)
            .arg("--supervise")
            .current_dir(root)
            .env("PATH", repaired_path())
            .env("AXI_WORKBENCH_ROOT", root)
            .stdin(Stdio::null())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|error| format!("failed to spawn desktop runtime: {error}"))?;

        {
            let mut slot = self
                .child
                .lock()
                .map_err(|_| "desktop runtime lock failed".to_string())?;
            *slot = Some(child);
        }

        if wait_for_local_gateway(Duration::from_secs(60)) {
            self.prefer_local.store(true, Ordering::SeqCst);
            Ok(())
        } else {
            Err("local Gateway did not become ready on 127.0.0.1:8088".to_string())
        }
    }

    pub fn preferred_base_url(&self, requested: Option<&str>) -> Option<String> {
        if self.prefer_local.load(Ordering::SeqCst) {
            return Some(format!("http://{LOCAL_GATEWAY_HOST}:{LOCAL_GATEWAY_PORT}"));
        }
        requested
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }
}

#[cfg(test)]
mod tests {
    use super::{discover_workspace_root, is_workbench_root, LocalRuntime};
    use std::path::PathBuf;

    #[test]
    fn compiled_manifest_resolves_to_workbench_root() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
        assert!(is_workbench_root(&root));
        assert!(discover_workspace_root().is_some());
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
            Some("http://127.0.0.1:8088".to_string())
        );
    }
}
