use crate::cli_config::CliConfigManager;
use crate::database::Database;
use crate::diagnostics;
use crate::proxy::ProxyRuntime;
use crate::secrets::SecretStore;
use crate::terminal::TerminalRuntime;
use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub secrets: SecretStore,
    pub client: Client,
    pub cli_config: CliConfigManager,
    pub proxy: ProxyRuntime,
    pub terminal: TerminalRuntime,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Result<Self> {
        let data_dir = match app.path().app_data_dir() {
            Ok(path) => path,
            Err(_) => dirs::data_dir()
                .map(|path| path.join("Axi Coder"))
                .ok_or_else(|| anyhow!("缺少应用数据目录。"))?,
        };
        let db = Database::open(&data_dir.join("axi-coder.sqlite"))?;
        diagnostics::seed(&db)?;

        let secrets = SecretStore::new();
        let client = Client::builder()
            .timeout(Duration::from_secs(45))
            .build()
            .context("构建 HTTP 客户端失败。")?;
        let home_dir = dirs::home_dir().ok_or_else(|| anyhow!("缺少主目录。"))?;
        let cli_config = CliConfigManager::new(db.clone(), home_dir);
        let proxy = ProxyRuntime::new(db.clone(), secrets.clone(), client.clone());
        let terminal = TerminalRuntime::default();

        Ok(Self {
            db,
            secrets,
            client,
            cli_config,
            proxy,
            terminal,
        })
    }
}
