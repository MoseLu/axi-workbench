mod app_state;
mod auto_params;
mod cli_config;
mod commands;
mod database;
mod diagnostics;
mod health;
mod models;
mod ollama;
mod proxy;
mod secrets;
mod suite_snapshot;
mod terminal;
mod url_probe;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = app_state::AppState::new(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_provider,
            commands::list_providers,
            commands::test_provider,
            commands::scan_ollama,
            commands::set_cli_route,
            commands::list_cli_routes,
            commands::toggle_all_proxy,
            commands::toggle_cli_proxy,
            commands::restore_cli_configs,
            commands::list_request_logs,
            commands::refresh_diagnostics_docs,
            commands::derive_auto_parameters,
            commands::list_terminal_commands,
            commands::set_terminal_command,
            commands::start_terminal_session,
            commands::write_terminal_input,
            commands::read_terminal_transcript,
            commands::resize_terminal_session,
            commands::stop_terminal_session,
            commands::get_axi_suite_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("运行 Axi Coder 时发生错误。");
}
