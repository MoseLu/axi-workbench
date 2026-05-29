use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodeAccountView {
    id: String,
    index: String,
    label: String,
    email: String,
    source: String,
    source_label: String,
    note: String,
    available: bool,
    can_authorize: bool,
    account_password: String,
    email_password: String,
    is_cockpit: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct AccountStats {
    total: usize,
    imap: usize,
    otp: usize,
    pool: usize,
    available: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct AccountListPayload {
    accounts: Vec<CodeAccountView>,
    stats: AccountStats,
}

#[derive(Debug, Serialize, Deserialize)]
struct MessageView {
    mailbox: String,
    from: String,
    subject: String,
    date: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReceiveCodeResult {
    status: String,
    status_label: String,
    status_kind: String,
    code: String,
    message: Option<MessageView>,
    stale: bool,
    error: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookAuthorizationBeginResult {
    status: String,
    status_label: String,
    status_kind: String,
    email: Option<String>,
    client_id: Option<String>,
    device_code: Option<String>,
    user_code: Option<String>,
    verification_uri: Option<String>,
    interval: Option<u64>,
    expires_in: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookAuthorizationCompleteResult {
    status: String,
    status_label: String,
    status_kind: String,
    account: Option<CodeAccountView>,
}

fn project_root() -> Result<PathBuf, String> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "Cannot resolve project root".to_string())
}

fn run_bridge_json<T>(args: &[&str]) -> Result<T, String>
where
    T: DeserializeOwned,
{
    let root = project_root()?;
    let output = Command::new("python3")
        .arg(root.join("backend").join("imap_service.py"))
        .args(args)
        .current_dir(&root)
        .output()
        .map_err(|error| format!("Failed to start Python bridge: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            format!("Python bridge failed with status {}", output.status)
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout).map_err(|error| {
        let stdout = String::from_utf8_lossy(&output.stdout);
        format!("Python bridge returned invalid JSON: {error}; output={stdout}")
    })
}

async fn run_bridge_json_background<T>(args: Vec<String>) -> Result<T, String>
where
    T: DeserializeOwned + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let refs: Vec<&str> = args.iter().map(String::as_str).collect();
        run_bridge_json(&refs)
    })
    .await
    .map_err(|error| format!("Python bridge task failed: {error}"))?
}

#[tauri::command]
async fn list_accounts() -> Result<AccountListPayload, String> {
    run_bridge_json_background(vec!["list-accounts".to_string()]).await
}

#[tauri::command]
async fn receive_code(account_id: String) -> Result<ReceiveCodeResult, String> {
    run_bridge_json_background(vec!["receive-code".to_string(), account_id]).await
}

#[tauri::command]
async fn begin_outlook_authorization(account_id: String) -> Result<OutlookAuthorizationBeginResult, String> {
    run_bridge_json_background(vec!["begin-outlook-authorization".to_string(), account_id]).await
}

#[tauri::command]
async fn complete_outlook_authorization(
    email: String,
    client_id: String,
    device_code: String,
    interval: u64,
    expires_in: u64,
) -> Result<OutlookAuthorizationCompleteResult, String> {
    run_bridge_json_background(vec![
        "complete-outlook-authorization".to_string(),
        "--email".to_string(),
        email,
        "--client-id".to_string(),
        client_id,
        "--device-code".to_string(),
        device_code,
        "--interval".to_string(),
        interval.to_string(),
        "--expires-in".to_string(),
        expires_in.to_string(),
    ])
    .await
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_accounts,
            receive_code,
            begin_outlook_authorization,
            complete_outlook_authorization
        ])
        .run(tauri::generate_context!())
        .expect("error while running IMAP code tool");
}

#[cfg(test)]
mod tests {
    use super::project_root;

    #[test]
    fn resolves_project_root_from_tauri_manifest_dir() {
        let root = project_root().expect("project root");
        assert!(root.join("backend").join("imap_service.py").exists());
    }
}
