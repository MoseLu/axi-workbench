// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::thread;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

fn main() {
    // Check for Python availability
    let python_check = Command::new("python")
        .arg("--version")
        .output();

    if python_check.is_err() {
        eprintln!("Error: Python not found. Please install Python 3.10+ to run Mini-Agent Desktop.");
        std::process::exit(1);
    }

    // Start the Python server in a background thread
    let server_thread = thread::spawn(|| {
        // Wait for app to initialize
        thread::sleep(Duration::from_secs(3));

        // Try to start the Python server using uv
        let result = Command::new("python")
            .args([
                "-m",
                "uvicorn",
                "local_server:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8765",
                "--reload",
            ])
            .current_dir("..")
            .spawn();

        match result {
            Ok(_child) => {
                println!("✓ Python server started on http://127.0.0.1:8765");
            }
            Err(e) => {
                eprintln!("✗ Failed to start Python server: {}", e);
            }
        }
    });

    // Build and run the Tauri application
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Create system tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Handle window close to minimize to tray instead
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        // Hide window instead of closing
                        let _ = window_clone.hide();
                        api.prevent_close();
                    }
                });
            }

            println!("✓ Mini-Agent Desktop started successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Wait for server thread
    let _ = server_thread.join();
}
