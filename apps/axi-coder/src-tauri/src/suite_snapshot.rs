use crate::models::{AxiDesktopStatus, AxiMobileStatus, AxiNotifyContract, AxiSuiteSnapshot};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const ANDROID_PACKAGE_NAME: &str = "com.mosscoder.notify";
const AXI_NOTIFY_ANDROID_REF: &str = "workspace://project/axi-notify/android-app";

pub fn build_axi_suite_snapshot() -> AxiSuiteSnapshot {
    let mobile_project_path = resolve_axi_notify_android_root();
    let latest_goal70_artifact = mobile_project_path
        .as_ref()
        .and_then(|path| find_latest_goal70_artifact(&path.join("docs").join("verification")).ok().flatten())
        .map(|path| path.display().to_string());

    AxiSuiteSnapshot {
        product_name: "Axi Coder".to_string(),
        desktop: AxiDesktopStatus {
            shell: "tauri".to_string(),
            status: "local-desktop-ready".to_string(),
            capabilities: vec![
                "provider profiles".to_string(),
                "CLI routes".to_string(),
                "proxy takeover and restore".to_string(),
                "terminal sessions".to_string(),
                "request logs".to_string(),
                "Ollama scan".to_string(),
            ],
        },
        mobile: AxiMobileStatus {
            owner: "axi-mobile".to_string(),
            package_name: ANDROID_PACKAGE_NAME.to_string(),
            project_path: mobile_project_path
                .map(|path| path.display().to_string())
                .unwrap_or_else(|| AXI_NOTIFY_ANDROID_REF.to_string()),
            latest_goal70_artifact,
            deep_links: vec![
                "axi://chat".to_string(),
                "axi://todo".to_string(),
                "axi://workbench".to_string(),
            ],
        },
        notify: AxiNotifyContract {
            owner: "axi-notify".to_string(),
            endpoints: vec!["POST /v1/events".to_string(), "GET /v1/events".to_string()],
            auth_header: "X-Axi-Notify-Api-Key".to_string(),
        },
    }
}

fn resolve_axi_notify_android_root() -> Option<PathBuf> {
    if let Ok(path) = env::var("AXI_NOTIFY_ANDROID_ROOT") {
        return non_empty_path(path);
    }
    if let Ok(path) = env::var("AXI_NOTIFY_ROOT") {
        return non_empty_path(path).map(|root| root.join("android-app"));
    }
    if let Ok(path) = env::var("AXI_WORKSPACE_ROOT") {
        return non_empty_path(path).map(|root| root.join("projects").join("axi-notify").join("android-app"));
    }
    None
}

fn non_empty_path(path: String) -> Option<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

pub fn find_latest_goal70_artifact(verification_dir: &Path) -> std::io::Result<Option<PathBuf>> {
    if !verification_dir.exists() {
        return Ok(None);
    }

    let mut candidates = Vec::new();
    for entry in fs::read_dir(verification_dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if !file_type.is_dir() {
            continue;
        }
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if name.starts_with("goal70-") {
            candidates.push(entry.path());
        }
    }

    candidates.sort_by(|left, right| {
        left.file_name()
            .unwrap_or_default()
            .cmp(right.file_name().unwrap_or_default())
    });
    Ok(candidates.pop())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_latest_goal70_artifact_by_directory_name() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir(temp.path().join("goal70-20260525-085453")).unwrap();
        fs::create_dir(temp.path().join("goal70-20260525-093736")).unwrap();
        fs::create_dir(temp.path().join("other-run")).unwrap();

        let latest = find_latest_goal70_artifact(temp.path()).unwrap().unwrap();

        assert!(latest.ends_with("goal70-20260525-093736"));
    }

    #[test]
    fn missing_goal70_artifact_returns_none() {
        let temp = tempfile::tempdir().unwrap();

        let latest = find_latest_goal70_artifact(&temp.path().join("missing")).unwrap();

        assert!(latest.is_none());
    }

    #[test]
    fn snapshot_exposes_contract_names_without_secret_values() {
        let snapshot = build_axi_suite_snapshot();
        let serialized = serde_json::to_string(&snapshot).unwrap();

        assert_eq!(snapshot.product_name, "Axi Coder");
        assert_eq!(snapshot.mobile.package_name, ANDROID_PACKAGE_NAME);
        assert!(snapshot.mobile.deep_links.contains(&"axi://chat".to_string()));
        assert!(snapshot.notify.endpoints.contains(&"POST /v1/events".to_string()));
        assert_eq!(snapshot.notify.auth_header, "X-Axi-Notify-Api-Key");
        for forbidden in ["sk-", "Bearer ", "access_token", "refresh_token", "fcmToken"] {
            assert!(!serialized.contains(forbidden));
        }
    }
}
