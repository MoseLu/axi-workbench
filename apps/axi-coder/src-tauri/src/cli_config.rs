use crate::database::{ConfigBackup, Database};
use crate::models::{CLI_CLAUDE, CLI_CODEX, CLI_GEMINI};
use anyhow::{anyhow, Context, Result};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

const PLACEHOLDER_TOKEN: &str = "axi-coder-proxy-token";
const AXI_BEGIN: &str = "# BEGIN AXI CODER MANAGED";
const AXI_END: &str = "# END AXI CODER MANAGED";

#[derive(Clone)]
pub struct CliConfigManager {
    db: Database,
    home_dir: PathBuf,
}

impl CliConfigManager {
    pub fn new(db: Database, home_dir: PathBuf) -> Self {
        Self { db, home_dir }
    }

    pub fn takeover(&self, cli: &str, proxy_origin: &str) -> Result<()> {
        match cli {
            CLI_CLAUDE => self.takeover_claude(proxy_origin),
            CLI_CODEX => self.takeover_codex(proxy_origin),
            CLI_GEMINI => self.takeover_gemini(proxy_origin),
            other => Err(anyhow!("不支持的 CLI：{other}")),
        }
    }

    pub fn restore(&self, cli: Option<&str>) -> Result<()> {
        let backups = self.db.list_config_backups(cli)?;
        for backup in backups {
            self.restore_backup(&backup)?;
        }
        self.db.clear_config_backups(cli)?;
        Ok(())
    }

    fn takeover_claude(&self, proxy_origin: &str) -> Result<()> {
        let path = self.home_dir.join(".claude").join("settings.json");
        self.backup_file_once(CLI_CLAUDE, "settings", &path)?;

        let mut value = read_json_object(&path)?;
        let object = value
            .as_object_mut()
            .ok_or_else(|| anyhow!("Claude 设置必须是 JSON 对象。"))?;
        let env = object.entry("env").or_insert_with(|| json!({}));
        let env_object = env
            .as_object_mut()
            .ok_or_else(|| anyhow!("Claude 设置中的 env 必须是 JSON 对象。"))?;
        env_object.insert(
            "ANTHROPIC_BASE_URL".to_string(),
            Value::String(proxy_origin.trim_end_matches('/').to_string()),
        );
        env_object.insert(
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            Value::String(PLACEHOLDER_TOKEN.to_string()),
        );
        write_json(&path, &value)
    }

    fn takeover_codex(&self, proxy_origin: &str) -> Result<()> {
        let codex_dir = self.home_dir.join(".codex");
        let config_path = codex_dir.join("config.toml");
        let auth_path = codex_dir.join("auth.json");
        self.backup_file_once(CLI_CODEX, "config", &config_path)?;
        self.backup_file_once(CLI_CODEX, "auth", &auth_path)?;

        let existing = fs::read_to_string(&config_path).unwrap_or_default();
        let cleaned = remove_managed_block(&existing);
        let next_config = set_codex_provider(&cleaned, proxy_origin);
        write_text(&config_path, &next_config)?;

        let mut auth = read_json_object(&auth_path)?;
        let object = auth
            .as_object_mut()
            .ok_or_else(|| anyhow!("Codex 认证文件必须是 JSON 对象。"))?;
        object.insert(
            "OPENAI_API_KEY".to_string(),
            Value::String(PLACEHOLDER_TOKEN.to_string()),
        );
        write_json(&auth_path, &auth)
    }

    fn takeover_gemini(&self, proxy_origin: &str) -> Result<()> {
        let path = self.home_dir.join(".gemini").join(".env");
        self.backup_file_once(CLI_GEMINI, "env", &path)?;

        let existing = fs::read_to_string(&path).unwrap_or_default();
        let next = set_env_lines(
            &existing,
            &[
                ("GOOGLE_GEMINI_BASE_URL", proxy_origin.trim_end_matches('/')),
                ("GEMINI_API_KEY", PLACEHOLDER_TOKEN),
            ],
        );
        write_text(&path, &next)
    }

    fn backup_file_once(&self, cli: &str, file_kind: &str, path: &Path) -> Result<()> {
        let already_backed_up = self
            .db
            .list_config_backups(Some(cli))?
            .iter()
            .any(|backup| backup.file_kind == file_kind);
        if already_backed_up {
            return Ok(());
        }

        let content = fs::read_to_string(path).ok();
        self.db.save_config_backup(
            cli,
            file_kind,
            &path.to_string_lossy(),
            content.is_some(),
            content.as_deref(),
        )
    }

    fn restore_backup(&self, backup: &ConfigBackup) -> Result<()> {
        let path = PathBuf::from(&backup.file_path);
        if backup.existed {
            let content = backup.content.as_deref().unwrap_or_default();
            write_text(&path, content)
                .with_context(|| format!("恢复失败：{}", backup.file_path))?;
        } else if path.exists() {
            fs::remove_file(&path)
                .with_context(|| format!("删除受管文件失败：{}", backup.file_path))?;
        }
        Ok(())
    }
}

fn read_json_object(path: &Path) -> Result<Value> {
    match fs::read_to_string(path) {
        Ok(text) if !text.trim().is_empty() => {
            serde_json::from_str(&text).with_context(|| format!("解析失败：{}", path.display()))
        }
        _ => Ok(json!({})),
    }
}

fn write_json(path: &Path, value: &Value) -> Result<()> {
    let text = serde_json::to_string_pretty(value)?;
    write_text(path, &(text + "\n"))
}

fn write_text(path: &Path, text: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("创建失败：{}", parent.display()))?;
    }
    fs::write(path, text).with_context(|| format!("写入失败：{}", path.display()))
}

fn remove_managed_block(input: &str) -> String {
    let mut output = Vec::new();
    let mut skipping = false;
    for line in input.lines() {
        if line.trim() == AXI_BEGIN {
            skipping = true;
            continue;
        }
        if skipping && line.trim() == AXI_END {
            skipping = false;
            continue;
        }
        if !skipping {
            output.push(line);
        }
    }
    output.join("\n").trim_end().to_string()
}

fn set_codex_provider(existing: &str, proxy_origin: &str) -> String {
    let base_url = format!("{}/v1", proxy_origin.trim_end_matches('/'));
    let mut saw_model_provider = false;
    let mut lines = Vec::new();

    for line in existing.lines() {
        if line.trim_start().starts_with("model_provider") {
            lines.push("model_provider = \"axi_coder\"".to_string());
            saw_model_provider = true;
        } else {
            lines.push(line.to_string());
        }
    }

    if !saw_model_provider {
        lines.push("model_provider = \"axi_coder\"".to_string());
    }

    lines.push(AXI_BEGIN.to_string());
    lines.push("[model_providers.axi_coder]".to_string());
    lines.push("name = \"Axi Coder 本地代理\"".to_string());
    lines.push(format!("base_url = \"{base_url}\""));
    lines.push("env_key = \"OPENAI_API_KEY\"".to_string());
    lines.push(AXI_END.to_string());
    lines.push(String::new());
    lines.join("\n")
}

fn set_env_lines(existing: &str, updates: &[(&str, &str)]) -> String {
    let keys = updates.iter().map(|(key, _)| *key).collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    let mut lines = Vec::new();

    for line in existing.lines() {
        let key = line.split_once('=').map(|(key, _)| key.trim());
        if let Some(key) = key {
            if keys.contains(key) {
                let value = updates
                    .iter()
                    .find(|(candidate, _)| *candidate == key)
                    .map(|(_, value)| *value)
                    .unwrap_or_default();
                lines.push(format!("{key}={value}"));
                seen.insert(key.to_string());
                continue;
            }
        }
        lines.push(line.to_string());
    }

    for (key, value) in updates {
        if !seen.contains(*key) {
            lines.push(format!("{key}={value}"));
        }
    }

    lines.join("\n").trim_end().to_string() + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;

    #[test]
    fn writes_and_restores_claude_codex_and_gemini_configs() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(&temp.path().join("axi.db")).unwrap();
        let manager = CliConfigManager::new(db, temp.path().to_path_buf());
        let proxy = "http://127.0.0.1:15721";

        let claude_path = temp.path().join(".claude/settings.json");
        write_text(&claude_path, "{\"env\":{\"KEEP\":\"yes\"}}\n").unwrap();
        manager.takeover(CLI_CLAUDE, proxy).unwrap();
        let claude = fs::read_to_string(&claude_path).unwrap();
        assert!(claude.contains("ANTHROPIC_BASE_URL"));
        manager.restore(Some(CLI_CLAUDE)).unwrap();
        assert_eq!(
            fs::read_to_string(&claude_path).unwrap(),
            "{\"env\":{\"KEEP\":\"yes\"}}\n"
        );

        manager.takeover(CLI_CODEX, proxy).unwrap();
        let codex_config = fs::read_to_string(temp.path().join(".codex/config.toml")).unwrap();
        assert!(codex_config.contains("model_providers.axi_coder"));
        let codex_auth = fs::read_to_string(temp.path().join(".codex/auth.json")).unwrap();
        assert!(codex_auth.contains("OPENAI_API_KEY"));
        manager.restore(Some(CLI_CODEX)).unwrap();
        assert!(!temp.path().join(".codex/config.toml").exists());

        manager.takeover(CLI_GEMINI, proxy).unwrap();
        let gemini = fs::read_to_string(temp.path().join(".gemini/.env")).unwrap();
        assert!(gemini.contains("GOOGLE_GEMINI_BASE_URL=http://127.0.0.1:15721"));
        manager.restore(Some(CLI_GEMINI)).unwrap();
        assert!(!temp.path().join(".gemini/.env").exists());
    }
}
