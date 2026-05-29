use crate::app_state::AppState;
use crate::auto_params;
use crate::database::now;
use crate::diagnostics;
use crate::health;
use crate::models::{
    default_terminal_command, AutoParameterInput, AutoParameterResult, CliRoute, DiagnosticDoc,
    HealthCheckResult, OllamaScanResult, Provider, ProviderInput, RequestLog, SetCliRouteInput,
    SetTerminalCommandInput, StartTerminalInput, TerminalCommandConfig, TerminalSessionResult,
    TerminalTranscriptResult, CLI_CLAUDE, CLI_CODEX, CLI_GEMINI,
};
use crate::ollama;
use crate::proxy::PROXY_ORIGIN;
use crate::secrets::SecretStore;
use crate::suite_snapshot;
use crate::url_probe::{normalize_base_url, probe_provider_kind};
use tauri::{AppHandle, State};
use uuid::Uuid;

type CommandResult<T> = Result<T, String>;

#[tauri::command]
pub async fn save_provider(
    state: State<'_, AppState>,
    input: ProviderInput,
) -> CommandResult<Provider> {
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let normalized = normalize_base_url(&input.base_url);
    if normalized.is_empty() {
        return Err("必须填写基础地址。".to_string());
    }

    let existing = state.db.get_provider(&id).map_err(to_command_error)?;
    let key_for_probe = input
        .api_key
        .as_deref()
        .filter(|key| !key.trim().is_empty())
        .map(str::trim)
        .map(str::to_string)
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|provider| state.secrets.get(&provider.secret_ref).ok())
        });
    let provider_type =
        probe_provider_kind(&state.client, &normalized, key_for_probe.as_deref()).await;
    let secret_ref = SecretStore::secret_ref_for_provider(&id);

    if let Some(api_key) = input
        .api_key
        .as_deref()
        .filter(|key| !key.trim().is_empty())
    {
        state
            .secrets
            .set(&secret_ref, api_key.trim())
            .map_err(to_command_error)?;
    }

    let timestamp = now();
    let provider = Provider {
        id: id.clone(),
        name: input.name.trim().to_string(),
        base_url: normalized,
        provider_type,
        default_model: input
            .default_model
            .and_then(|model| non_empty(model.trim())),
        secret_ref,
        created_at: existing
            .as_ref()
            .map(|provider| provider.created_at.clone())
            .unwrap_or_else(|| timestamp.clone()),
        updated_at: timestamp,
    };
    state
        .db
        .upsert_provider(&provider)
        .map_err(to_command_error)?;

    let models = health::discover_models(
        &state.client,
        &provider,
        key_for_probe.as_deref().unwrap_or_default(),
    )
    .await
    .unwrap_or_default();
    if !models.is_empty() {
        state
            .db
            .replace_provider_models(&provider.id, &models)
            .map_err(to_command_error)?;
    }

    Ok(provider)
}

#[tauri::command]
pub fn list_providers(state: State<'_, AppState>) -> CommandResult<Vec<Provider>> {
    state.db.list_providers().map_err(to_command_error)
}

#[tauri::command]
pub async fn test_provider(
    state: State<'_, AppState>,
    provider_id: String,
) -> CommandResult<HealthCheckResult> {
    health::test_provider(state.inner(), &provider_id)
        .await
        .map_err(to_command_error)
}

#[tauri::command]
pub async fn scan_ollama(state: State<'_, AppState>) -> CommandResult<OllamaScanResult> {
    Ok(ollama::scan(state.inner()).await)
}

#[tauri::command]
pub async fn set_cli_route(
    state: State<'_, AppState>,
    input: SetCliRouteInput,
) -> CommandResult<CliRoute> {
    validate_cli(&input.cli)?;
    if input.enabled && input.provider_id.is_none() {
        return Err("启用 CLI 路由时必须指定提供方。".to_string());
    }

    let route = CliRoute {
        cli: input.cli,
        provider_id: input.provider_id,
        model: input.model.and_then(|model| non_empty(model.trim())),
        enabled: input.enabled,
        updated_at: now(),
    };
    state.db.upsert_route(&route).map_err(to_command_error)?;
    if route.enabled {
        state
            .proxy
            .ensure_running()
            .await
            .map_err(to_command_error)?;
        state
            .cli_config
            .takeover(&route.cli, PROXY_ORIGIN)
            .map_err(to_command_error)?;
    }
    Ok(route)
}

#[tauri::command]
pub fn list_cli_routes(state: State<'_, AppState>) -> CommandResult<Vec<CliRoute>> {
    state.db.list_routes().map_err(to_command_error)
}

#[tauri::command]
pub async fn toggle_all_proxy(
    state: State<'_, AppState>,
    enabled: bool,
) -> CommandResult<Vec<CliRoute>> {
    let mut routes = state.db.list_routes().map_err(to_command_error)?;
    if enabled {
        state
            .proxy
            .ensure_running()
            .await
            .map_err(to_command_error)?;
        for route in routes
            .iter_mut()
            .filter(|route| route.provider_id.is_some())
        {
            route.enabled = true;
            route.updated_at = now();
            state.db.upsert_route(route).map_err(to_command_error)?;
            state
                .cli_config
                .takeover(&route.cli, PROXY_ORIGIN)
                .map_err(to_command_error)?;
        }
    } else {
        state.cli_config.restore(None).map_err(to_command_error)?;
        for route in &mut routes {
            route.enabled = false;
            route.updated_at = now();
            state.db.upsert_route(route).map_err(to_command_error)?;
        }
    }
    state.db.list_routes().map_err(to_command_error)
}

#[tauri::command]
pub async fn toggle_cli_proxy(
    state: State<'_, AppState>,
    cli: String,
    enabled: bool,
) -> CommandResult<CliRoute> {
    validate_cli(&cli)?;
    let mut route = state
        .db
        .get_route(&cli)
        .map_err(to_command_error)?
        .ok_or_else(|| "未找到 CLI 路由。".to_string())?;

    if enabled && route.provider_id.is_none() {
        return Err("启用 CLI 路由时必须指定提供方。".to_string());
    }

    if enabled {
        state
            .proxy
            .ensure_running()
            .await
            .map_err(to_command_error)?;
        state
            .cli_config
            .takeover(&cli, PROXY_ORIGIN)
            .map_err(to_command_error)?;
    } else {
        state
            .cli_config
            .restore(Some(&cli))
            .map_err(to_command_error)?;
    }

    route.enabled = enabled;
    route.updated_at = now();
    state.db.upsert_route(&route).map_err(to_command_error)?;
    Ok(route)
}

#[tauri::command]
pub fn restore_cli_configs(state: State<'_, AppState>) -> CommandResult<Vec<CliRoute>> {
    state.cli_config.restore(None).map_err(to_command_error)?;
    let mut routes = state.db.list_routes().map_err(to_command_error)?;
    for route in &mut routes {
        route.enabled = false;
        route.updated_at = now();
        state.db.upsert_route(route).map_err(to_command_error)?;
    }
    state.db.list_routes().map_err(to_command_error)
}

#[tauri::command]
pub fn list_request_logs(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> CommandResult<Vec<RequestLog>> {
    state
        .db
        .list_request_logs(limit.unwrap_or(200).clamp(1, 1_000))
        .map_err(to_command_error)
}

#[tauri::command]
pub fn refresh_diagnostics_docs(state: State<'_, AppState>) -> CommandResult<Vec<DiagnosticDoc>> {
    diagnostics::seed(&state.db).map_err(to_command_error)
}

#[tauri::command]
pub fn derive_auto_parameters(input: AutoParameterInput) -> CommandResult<AutoParameterResult> {
    Ok(auto_params::derive(input))
}

#[tauri::command]
pub fn list_terminal_commands(
    state: State<'_, AppState>,
) -> CommandResult<Vec<TerminalCommandConfig>> {
    state.db.list_terminal_commands().map_err(to_command_error)
}

#[tauri::command]
pub fn set_terminal_command(
    state: State<'_, AppState>,
    input: SetTerminalCommandInput,
) -> CommandResult<TerminalCommandConfig> {
    validate_cli(&input.cli)?;
    let command = input.command.trim();
    if command.is_empty() {
        return Err("终端命令不能为空。".to_string());
    }

    state
        .db
        .upsert_terminal_command(&input.cli, command)
        .map_err(to_command_error)
}

#[tauri::command]
pub async fn start_terminal_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: StartTerminalInput,
) -> CommandResult<TerminalSessionResult> {
    validate_cli(&input.cli)?;

    if let Some(route) = state.db.get_route(&input.cli).map_err(to_command_error)? {
        if route.enabled {
            state
                .proxy
                .ensure_running()
                .await
                .map_err(to_command_error)?;
            state
                .cli_config
                .takeover(&input.cli, PROXY_ORIGIN)
                .map_err(to_command_error)?;
        }
    }

    let command = state
        .db
        .get_terminal_command(&input.cli)
        .map_err(to_command_error)?
        .map(|config| config.command)
        .or_else(|| default_terminal_command(&input.cli).map(str::to_string))
        .ok_or_else(|| format!("不支持的 CLI：{}", input.cli))?;

    state.terminal.start(
        app,
        &input.cli,
        &input.session_id,
        &command,
        input.rows.unwrap_or(28),
        input.cols.unwrap_or(100),
    )?;

    Ok(TerminalSessionResult {
        cli: input.cli,
        session_id: input.session_id,
        command,
        started: true,
    })
}

#[tauri::command]
pub fn write_terminal_input(
    state: State<'_, AppState>,
    cli: String,
    data: String,
) -> CommandResult<()> {
    state.terminal.write(&cli, &data)
}

#[tauri::command]
pub fn read_terminal_transcript(
    state: State<'_, AppState>,
    cli: String,
) -> CommandResult<TerminalTranscriptResult> {
    state.terminal.transcript(&cli)
}

#[tauri::command]
pub fn resize_terminal_session(
    state: State<'_, AppState>,
    cli: String,
    rows: u16,
    cols: u16,
) -> CommandResult<()> {
    state.terminal.resize(&cli, rows, cols)
}

#[tauri::command]
pub fn stop_terminal_session(state: State<'_, AppState>, cli: String) -> CommandResult<()> {
    state.terminal.stop(&cli)
}

#[tauri::command]
pub fn get_axi_suite_snapshot() -> CommandResult<crate::models::AxiSuiteSnapshot> {
    Ok(suite_snapshot::build_axi_suite_snapshot())
}

fn validate_cli(cli: &str) -> CommandResult<()> {
    match cli {
        CLI_CLAUDE | CLI_CODEX | CLI_GEMINI => Ok(()),
        _ => Err(format!("不支持的 CLI：{cli}")),
    }
}

fn non_empty(value: &str) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value.trim().to_string())
    }
}

fn to_command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}
