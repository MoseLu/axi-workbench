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

/// Extract the most likely OTP code from a free-form message body.
///
/// The heuristic looks for short numeric tokens (4-8 digits) that are
/// surrounded by word boundaries and not glued to other digits, mirroring the
/// behaviour of the Python `extract_otp_from_body` helper.
pub fn extract_otp_code(body: &str) -> Option<String> {
    let bytes = body.as_bytes();
    let mut best: Option<(usize, String)> = None;

    let mut i = 0;
    while i < bytes.len() {
        if bytes[i].is_ascii_digit() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_digit() {
                i += 1;
            }
            let end = i;
            let len = end - start;

            let left_ok = start == 0 || !bytes[start - 1].is_ascii_alphanumeric();
            let right_ok = end == bytes.len() || !bytes[end].is_ascii_alphanumeric();

            if (4..=8).contains(&len) && left_ok && right_ok {
                let candidate = body[start..end].to_string();
                match best {
                    Some((existing, _)) if existing >= len => {}
                    _ => best = Some((len, candidate)),
                }
            }
        } else {
            i += 1;
        }
    }

    best.map(|(_, code)| code)
}

/// Parse a minimal IMAP server response line.
///
/// Returns `Ok(tag)` for tagged completions like `A001 OK ...`,
/// `Ok(action)` for untagged status like `* OK ...`, or `Err(message)`
/// for protocol-level errors like `A001 BAD ...`.
pub fn parse_imap_response(line: &str) -> Result<ImapResponseKind, String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Err("empty IMAP response".to_string());
    }

    let mut parts = trimmed.splitn(3, ' ');
    let tag = parts.next().unwrap_or("").to_string();
    let status = parts.next().unwrap_or("").to_string();
    let message = parts.next().unwrap_or("").to_string();

    if tag.is_empty() || status.is_empty() {
        return Err(format!("malformed IMAP response: {line:?}"));
    }

    if tag == "*" {
        Ok(ImapResponseKind::Untagged { status, message })
    } else {
        Ok(ImapResponseKind::Tagged { tag, status, message })
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum ImapResponseKind {
    Tagged { tag: String, status: String, message: String },
    Untagged { status: String, message: String },
}

#[cfg(test)]
mod tests {
    use super::{extract_otp_code, parse_imap_response, project_root, ImapResponseKind};

    #[test]
    fn resolves_project_root_from_tauri_manifest_dir() {
        let root = project_root().expect("project root");
        assert!(root.join("backend").join("imap_service.py").exists());
    }

    // ---- extract_otp_code ---------------------------------------------------

    #[test]
    fn extract_otp_finds_six_digit_token() {
        let body = "Your verification code is 482913. It expires in 5 minutes.";
        assert_eq!(extract_otp_code(body).as_deref(), Some("482913"));
    }

    #[test]
    fn extract_otp_prefers_longer_candidate() {
        let body = "Older 1234 then newer 987654 inside.";
        assert_eq!(extract_otp_code(body).as_deref(), Some("987654"));
    }

    #[test]
    fn extract_otp_ignores_phone_numbers() {
        let body = "Call 18005551234 if you need help with code 246810.";
        assert_eq!(extract_otp_code(body).as_deref(), Some("246810"));
    }

    #[test]
    fn extract_otp_returns_none_when_no_match() {
        let body = "Plain text without any numeric code.";
        assert_eq!(extract_otp_code(body), None);
    }

    #[test]
    fn extract_otp_rejects_long_digit_runs() {
        let body = "Tracking 12345678901234 shipped yesterday.";
        assert_eq!(extract_otp_code(body), None);
    }

    // ---- parse_imap_response ------------------------------------------------

    #[test]
    fn parses_tagged_ok_response() {
        let parsed = parse_imap_response("A001 OK LOGIN completed").expect("parse ok");
        assert_eq!(
            parsed,
            ImapResponseKind::Tagged {
                tag: "A001".to_string(),
                status: "OK".to_string(),
                message: "LOGIN completed".to_string(),
            }
        );
    }

    #[test]
    fn parses_tagged_no_response() {
        let parsed = parse_imap_response("A002 NO Authentication failed").expect("parse no");
        assert_eq!(parsed, ImapResponseKind::Tagged {
            tag: "A002".to_string(),
            status: "NO".to_string(),
            message: "Authentication failed".to_string(),
        });
    }

    #[test]
    fn parses_untagged_capability() {
        let parsed = parse_imap_response("* OK [CAPABILITY IMAP4rev1] ready").expect("parse untagged");
        assert_eq!(parsed, ImapResponseKind::Untagged {
            status: "OK".to_string(),
            message: "[CAPABILITY IMAP4rev1] ready".to_string(),
        });
    }

    #[test]
    fn parse_rejects_empty_input() {
        assert!(parse_imap_response("").is_err());
        assert!(parse_imap_response("   ").is_err());
    }

    #[test]
    fn parse_rejects_malformed_input() {
        assert!(parse_imap_response("OK").is_err());
    }
}
