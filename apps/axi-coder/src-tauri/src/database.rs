use crate::models::{
    default_terminal_command, CliRoute, DiagnosticDoc, DiagnosticRule, NewRequestLog, Provider,
    ProviderKind, ProviderModel, RequestLog, TerminalCommandConfig, CLI_CLAUDE, CLI_CODEX,
    CLI_GEMINI,
};
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("创建失败：{}", parent.display()))?;
        }

        let conn = Connection::open(path)
            .with_context(|| format!("打开 SQLite 数据库失败：{}", path.display()))?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.migrate()?;
        db.ensure_default_routes()?;
        db.ensure_default_terminal_commands()?;
        Ok(db)
    }

    fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let guard = self.conn.lock().expect("数据库互斥锁已损坏");
        f(&guard)
    }

    fn migrate(&self) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute_batch(
                r#"
                PRAGMA journal_mode = WAL;
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS providers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    base_url TEXT NOT NULL,
                    provider_type TEXT NOT NULL,
                    default_model TEXT,
                    secret_ref TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS provider_models (
                    id TEXT PRIMARY KEY,
                    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
                    model_id TEXT NOT NULL,
                    context_window INTEGER,
                    max_output_tokens INTEGER,
                    supports_thinking INTEGER NOT NULL DEFAULT 0,
                    supports_tools INTEGER NOT NULL DEFAULT 0,
                    supports_json INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(provider_id, model_id)
                );

                CREATE TABLE IF NOT EXISTS cli_routes (
                    cli TEXT PRIMARY KEY,
                    provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
                    model TEXT,
                    enabled INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS request_logs (
                    id TEXT PRIMARY KEY,
                    cli TEXT NOT NULL,
                    provider_id TEXT,
                    provider_name TEXT,
                    model TEXT,
                    status TEXT NOT NULL,
                    http_status INTEGER,
                    error_category TEXT,
                    error_reason TEXT,
                    latency_ms INTEGER NOT NULL,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    created_at TEXT NOT NULL,
                    data_source TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS doc_sources (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    fetched_at TEXT NOT NULL,
                    summary TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS diagnostic_rules (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    status_code INTEGER,
                    category TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    suggestion TEXT NOT NULL,
                    source_url TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS config_backups (
                    cli TEXT NOT NULL,
                    file_kind TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    existed INTEGER NOT NULL,
                    content TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(cli, file_kind)
                );

                CREATE TABLE IF NOT EXISTS terminal_commands (
                    cli TEXT PRIMARY KEY,
                    command TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                "#,
            )?;
            Ok(())
        })
    }

    fn ensure_default_routes(&self) -> Result<()> {
        for cli in [CLI_CLAUDE, CLI_CODEX, CLI_GEMINI] {
            self.with_conn(|conn| {
                conn.execute(
                    "INSERT OR IGNORE INTO cli_routes (cli, enabled, updated_at) VALUES (?1, 0, ?2)",
                    params![cli, now()],
                )?;
                Ok(())
            })?;
        }
        Ok(())
    }

    fn ensure_default_terminal_commands(&self) -> Result<()> {
        for cli in [CLI_CLAUDE, CLI_CODEX, CLI_GEMINI] {
            self.with_conn(|conn| {
                conn.execute(
                    "INSERT OR IGNORE INTO terminal_commands (cli, command, updated_at) VALUES (?1, ?2, ?3)",
                    params![cli, default_terminal_command(cli).unwrap_or(cli), now()],
                )?;
                Ok(())
            })?;
        }
        Ok(())
    }

    pub fn upsert_provider(&self, provider: &Provider) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO providers
                    (id, name, base_url, provider_type, default_model, secret_ref, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    base_url = excluded.base_url,
                    provider_type = excluded.provider_type,
                    default_model = excluded.default_model,
                    secret_ref = excluded.secret_ref,
                    updated_at = excluded.updated_at
                "#,
                params![
                    provider.id,
                    provider.name,
                    provider.base_url,
                    provider.provider_type.as_str(),
                    provider.default_model,
                    provider.secret_ref,
                    provider.created_at,
                    provider.updated_at
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_providers(&self) -> Result<Vec<Provider>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, base_url, provider_type, default_model, secret_ref, created_at, updated_at
                 FROM providers ORDER BY updated_at DESC",
            )?;
            let rows = stmt.query_map([], row_to_provider)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(Into::into)
        })
    }

    pub fn get_provider(&self, id: &str) -> Result<Option<Provider>> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, name, base_url, provider_type, default_model, secret_ref, created_at, updated_at
                 FROM providers WHERE id = ?1",
                params![id],
                row_to_provider,
            )
            .optional()
            .map_err(Into::into)
        })
    }

    pub fn replace_provider_models(
        &self,
        provider_id: &str,
        models: &[ProviderModel],
    ) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM provider_models WHERE provider_id = ?1",
                params![provider_id],
            )?;
            for model in models {
                conn.execute(
                    r#"
                    INSERT INTO provider_models
                        (id, provider_id, model_id, context_window, max_output_tokens,
                         supports_thinking, supports_tools, supports_json)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                    "#,
                    params![
                        model.id,
                        model.provider_id,
                        model.model_id,
                        model.context_window,
                        model.max_output_tokens,
                        model.supports_thinking as i64,
                        model.supports_tools as i64,
                        model.supports_json as i64,
                    ],
                )?;
            }
            Ok(())
        })
    }

    #[allow(dead_code)]
    pub fn list_provider_models(&self, provider_id: &str) -> Result<Vec<ProviderModel>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, provider_id, model_id, context_window, max_output_tokens,
                        supports_thinking, supports_tools, supports_json
                 FROM provider_models WHERE provider_id = ?1 ORDER BY model_id",
            )?;
            let rows = stmt.query_map(params![provider_id], |row| {
                Ok(ProviderModel {
                    id: row.get(0)?,
                    provider_id: row.get(1)?,
                    model_id: row.get(2)?,
                    context_window: row.get(3)?,
                    max_output_tokens: row.get(4)?,
                    supports_thinking: row.get::<_, i64>(5)? != 0,
                    supports_tools: row.get::<_, i64>(6)? != 0,
                    supports_json: row.get::<_, i64>(7)? != 0,
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(Into::into)
        })
    }

    pub fn upsert_route(&self, route: &CliRoute) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO cli_routes (cli, provider_id, model, enabled, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5)
                ON CONFLICT(cli) DO UPDATE SET
                    provider_id = excluded.provider_id,
                    model = excluded.model,
                    enabled = excluded.enabled,
                    updated_at = excluded.updated_at
                "#,
                params![
                    route.cli,
                    route.provider_id,
                    route.model,
                    route.enabled as i64,
                    route.updated_at
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_routes(&self) -> Result<Vec<CliRoute>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT cli, provider_id, model, enabled, updated_at FROM cli_routes ORDER BY cli",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(CliRoute {
                    cli: row.get(0)?,
                    provider_id: row.get(1)?,
                    model: row.get(2)?,
                    enabled: row.get::<_, i64>(3)? != 0,
                    updated_at: row.get(4)?,
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(Into::into)
        })
    }

    pub fn get_route(&self, cli: &str) -> Result<Option<CliRoute>> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT cli, provider_id, model, enabled, updated_at FROM cli_routes WHERE cli = ?1",
                params![cli],
                |row| {
                    Ok(CliRoute {
                        cli: row.get(0)?,
                        provider_id: row.get(1)?,
                        model: row.get(2)?,
                        enabled: row.get::<_, i64>(3)? != 0,
                        updated_at: row.get(4)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
        })
    }

    pub fn list_terminal_commands(&self) -> Result<Vec<TerminalCommandConfig>> {
        self.with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT cli, command, updated_at FROM terminal_commands ORDER BY cli")?;
            let rows = stmt.query_map([], row_to_terminal_command)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(Into::into)
        })
    }

    pub fn get_terminal_command(&self, cli: &str) -> Result<Option<TerminalCommandConfig>> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT cli, command, updated_at FROM terminal_commands WHERE cli = ?1",
                params![cli],
                row_to_terminal_command,
            )
            .optional()
            .map_err(Into::into)
        })
    }

    pub fn upsert_terminal_command(
        &self,
        cli: &str,
        command: &str,
    ) -> Result<TerminalCommandConfig> {
        let row = TerminalCommandConfig {
            cli: cli.to_string(),
            command: command.to_string(),
            updated_at: now(),
        };
        self.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO terminal_commands (cli, command, updated_at)
                VALUES (?1, ?2, ?3)
                ON CONFLICT(cli) DO UPDATE SET
                    command = excluded.command,
                    updated_at = excluded.updated_at
                "#,
                params![row.cli, row.command, row.updated_at],
            )?;
            Ok(())
        })?;
        Ok(row)
    }

    pub fn insert_request_log(&self, log: NewRequestLog) -> Result<RequestLog> {
        let row = RequestLog {
            id: Uuid::new_v4().to_string(),
            cli: log.cli,
            provider_id: log.provider_id,
            provider_name: log.provider_name,
            model: log.model,
            status: log.status,
            http_status: log.http_status,
            error_category: log.error_category,
            error_reason: log.error_reason,
            latency_ms: log.latency_ms,
            input_tokens: log.input_tokens,
            output_tokens: log.output_tokens,
            created_at: now(),
            data_source: log.data_source,
        };

        self.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO request_logs
                    (id, cli, provider_id, provider_name, model, status, http_status,
                     error_category, error_reason, latency_ms, input_tokens, output_tokens,
                     created_at, data_source)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
                "#,
                params![
                    row.id,
                    row.cli,
                    row.provider_id,
                    row.provider_name,
                    row.model,
                    row.status,
                    row.http_status,
                    row.error_category,
                    row.error_reason,
                    row.latency_ms,
                    row.input_tokens,
                    row.output_tokens,
                    row.created_at,
                    row.data_source
                ],
            )?;
            Ok(())
        })?;

        Ok(row)
    }

    pub fn list_request_logs(&self, limit: i64) -> Result<Vec<RequestLog>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, cli, provider_id, provider_name, model, status, http_status,
                       error_category, error_reason, latency_ms, input_tokens, output_tokens,
                       created_at, data_source
                FROM request_logs
                ORDER BY created_at DESC
                LIMIT ?1
                "#,
            )?;
            let rows = stmt.query_map(params![limit], |row| {
                Ok(RequestLog {
                    id: row.get(0)?,
                    cli: row.get(1)?,
                    provider_id: row.get(2)?,
                    provider_name: row.get(3)?,
                    model: row.get(4)?,
                    status: row.get(5)?,
                    http_status: row.get(6)?,
                    error_category: row.get(7)?,
                    error_reason: row.get(8)?,
                    latency_ms: row.get(9)?,
                    input_tokens: row.get(10)?,
                    output_tokens: row.get(11)?,
                    created_at: row.get(12)?,
                    data_source: row.get(13)?,
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(Into::into)
        })
    }

    pub fn replace_diagnostics(
        &self,
        docs: &[DiagnosticDoc],
        rules: &[DiagnosticRule],
    ) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM doc_sources", [])?;
            conn.execute("DELETE FROM diagnostic_rules", [])?;

            for doc in docs {
                conn.execute(
                    "INSERT INTO doc_sources (id, provider, title, url, fetched_at, summary)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        doc.id,
                        doc.provider,
                        doc.title,
                        doc.url,
                        doc.fetched_at,
                        doc.summary
                    ],
                )?;
            }

            for rule in rules {
                conn.execute(
                    "INSERT INTO diagnostic_rules
                     (id, provider, status_code, category, reason, suggestion, source_url)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        rule.id,
                        rule.provider,
                        rule.status_code,
                        rule.category,
                        rule.reason,
                        rule.suggestion,
                        rule.source_url
                    ],
                )?;
            }
            Ok(())
        })
    }

    pub fn find_diagnostic_rule(
        &self,
        provider: &str,
        status_code: Option<i64>,
    ) -> Result<Option<DiagnosticRule>> {
        self.with_conn(|conn| {
            conn.query_row(
                r#"
                SELECT id, provider, status_code, category, reason, suggestion, source_url
                FROM diagnostic_rules
                WHERE (provider = ?1 OR provider = 'generic')
                  AND ((status_code IS NULL AND ?2 IS NULL) OR status_code = ?2)
                ORDER BY CASE WHEN provider = ?1 THEN 0 ELSE 1 END
                LIMIT 1
                "#,
                params![provider, status_code],
                |row| {
                    Ok(DiagnosticRule {
                        id: row.get(0)?,
                        provider: row.get(1)?,
                        status_code: row.get(2)?,
                        category: row.get(3)?,
                        reason: row.get(4)?,
                        suggestion: row.get(5)?,
                        source_url: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
        })
    }

    pub fn save_config_backup(
        &self,
        cli: &str,
        file_kind: &str,
        file_path: &str,
        existed: bool,
        content: Option<&str>,
    ) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO config_backups (cli, file_kind, file_path, existed, content, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(cli, file_kind) DO UPDATE SET
                    file_path = excluded.file_path,
                    existed = excluded.existed,
                    content = excluded.content,
                    created_at = excluded.created_at
                "#,
                params![cli, file_kind, file_path, existed as i64, content, now()],
            )?;
            Ok(())
        })
    }

    pub fn list_config_backups(&self, cli: Option<&str>) -> Result<Vec<ConfigBackup>> {
        self.with_conn(|conn| {
            let sql = if cli.is_some() {
                "SELECT cli, file_kind, file_path, existed, content FROM config_backups WHERE cli = ?1"
            } else {
                "SELECT cli, file_kind, file_path, existed, content FROM config_backups"
            };
            let mut stmt = conn.prepare(sql)?;
            let mapper = |row: &rusqlite::Row<'_>| {
                Ok(ConfigBackup {
                    cli: row.get(0)?,
                    file_kind: row.get(1)?,
                    file_path: row.get(2)?,
                    existed: row.get::<_, i64>(3)? != 0,
                    content: row.get(4)?,
                })
            };
            if let Some(cli) = cli {
                let rows = stmt.query_map(params![cli], mapper)?;
                rows.collect::<rusqlite::Result<Vec<_>>>()
                    .map_err(Into::into)
            } else {
                let rows = stmt.query_map([], mapper)?;
                rows.collect::<rusqlite::Result<Vec<_>>>()
                    .map_err(Into::into)
            }
        })
    }

    pub fn clear_config_backups(&self, cli: Option<&str>) -> Result<()> {
        self.with_conn(|conn| {
            if let Some(cli) = cli {
                conn.execute("DELETE FROM config_backups WHERE cli = ?1", params![cli])?;
            } else {
                conn.execute("DELETE FROM config_backups", [])?;
            }
            Ok(())
        })
    }
}

#[derive(Debug, Clone)]
pub struct ConfigBackup {
    #[allow(dead_code)]
    pub cli: String,
    pub file_kind: String,
    pub file_path: String,
    pub existed: bool,
    pub content: Option<String>,
}

pub fn now() -> String {
    Utc::now().to_rfc3339()
}

fn row_to_provider(row: &rusqlite::Row<'_>) -> rusqlite::Result<Provider> {
    let provider_type: String = row.get(3)?;
    Ok(Provider {
        id: row.get(0)?,
        name: row.get(1)?,
        base_url: row.get(2)?,
        provider_type: ProviderKind::from_db(&provider_type),
        default_model: row.get(4)?,
        secret_ref: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn row_to_terminal_command(row: &rusqlite::Row<'_>) -> rusqlite::Result<TerminalCommandConfig> {
    Ok(TerminalCommandConfig {
        cli: row.get(0)?,
        command: row.get(1)?,
        updated_at: row.get(2)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_secret_ref_without_key_material() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(&temp.path().join("axi.db")).unwrap();
        let provider = Provider {
            id: "p1".to_string(),
            name: "DeepSeek".to_string(),
            base_url: "https://api.deepseek.com".to_string(),
            provider_type: ProviderKind::OpenAiChat,
            default_model: Some("deepseek-v4-flash".to_string()),
            secret_ref: "axi-coder-provider-p1".to_string(),
            created_at: now(),
            updated_at: now(),
        };
        db.upsert_provider(&provider).unwrap();
        let saved = db.get_provider("p1").unwrap().unwrap();
        assert_eq!(saved.secret_ref, "axi-coder-provider-p1");
        assert!(!format!("{saved:?}").contains("sk-"));
    }

    #[test]
    fn seeds_and_updates_terminal_commands() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(&temp.path().join("axi.db")).unwrap();

        let configs = db.list_terminal_commands().unwrap();
        assert_eq!(configs.len(), 3);
        assert_eq!(
            db.get_terminal_command(CLI_CLAUDE)
                .unwrap()
                .unwrap()
                .command,
            "claude --dangerously-skip-permissions"
        );
        assert_eq!(
            db.get_terminal_command(CLI_CODEX).unwrap().unwrap().command,
            "codex"
        );

        let saved = db
            .upsert_terminal_command(CLI_CODEX, "codex --profile fast")
            .unwrap();
        assert_eq!(saved.command, "codex --profile fast");
        assert_eq!(
            db.get_terminal_command(CLI_CODEX).unwrap().unwrap().command,
            "codex --profile fast"
        );
    }
}
