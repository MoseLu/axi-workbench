// Workbench Mac App — Tauri 2 shell entry
// 复用 apps/workbench 的现有 SPA UI，只在外层套 macOS 原生壳。

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Listener, Manager, WindowEvent,
};

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Login closes the application; the main window hides to the tray.
fn should_hide_on_close(label: &str) -> bool {
    label != "login"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // 单实例锁：第二次启动激活已有窗口，不开新进程
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(main) = app.get_webview_window("main") {
                if main.is_visible().unwrap_or(false) {
                    let _ = main.show();
                    let _ = main.unminimize();
                    let _ = main.set_focus();
                    return;
                }
            }
            if let Some(login) = app.get_webview_window("login") {
                let _ = login.show();
                let _ = login.unminimize();
                let _ = login.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![])
        .setup(|app| {
            build_app_menu(app.handle())?;
            build_tray(app.handle())?;
            register_ipc_listeners(app.handle().clone());
            // 登录窗保留 macOS 标准三颗交通灯，并允许绿色按钮执行原生缩放。
            if let Some(login) = app.get_webview_window("login") {
                let _ = login.set_resizable(true);
                let _ = login.set_maximizable(true);
                let _ = login.set_minimizable(true);
                let _ = login.set_closable(true);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if should_hide_on_close(window.label()) {
                    // 主窗关闭 = 隐藏到托盘；通过 Tray → Quit 退出。
                    let _ = window.hide();
                    api.prevent_close();
                } else {
                    // 登录窗关闭 = 明确退出，避免留下无窗口的单实例进程。
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Workbench Mac App");
}

fn build_app_menu(app: &AppHandle) -> tauri::Result<()> {
    // App 菜单
    let app_about = MenuItemBuilder::with_id("app_about", "About Workbench").build(app)?;
    let app_hide = MenuItemBuilder::with_id("app_hide", "Hide Workbench")
        .accelerator("CmdOrCtrl+H")
        .build(app)?;
    let app_quit = MenuItemBuilder::with_id("app_quit", "Quit Workbench")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;
    let app_menu = SubmenuBuilder::new(app, "Workbench")
        .item(&app_about)
        .separator()
        .item(&app_hide)
        .item(&app_quit)
        .build()?;

    // File 菜单
    let file_new = MenuItemBuilder::with_id("file_new", "New Tab")
        .accelerator("CmdOrCtrl+T")
        .build(app)?;
    let file_close = MenuItemBuilder::with_id("file_close", "Close Window")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&file_new)
        .separator()
        .item(&file_close)
        .build()?;

    // Edit 菜单（标准 macOS 编辑动作，壳层只发事件给 web）
    let edit_undo = MenuItemBuilder::with_id("edit_undo", "Undo")
        .accelerator("CmdOrCtrl+Z")
        .build(app)?;
    let edit_redo = MenuItemBuilder::with_id("edit_redo", "Redo")
        .accelerator("Shift+CmdOrCtrl+Z")
        .build(app)?;
    let edit_cut = MenuItemBuilder::with_id("edit_cut", "Cut")
        .accelerator("CmdOrCtrl+X")
        .build(app)?;
    let edit_copy = MenuItemBuilder::with_id("edit_copy", "Copy")
        .accelerator("CmdOrCtrl+C")
        .build(app)?;
    let edit_paste = MenuItemBuilder::with_id("edit_paste", "Paste")
        .accelerator("CmdOrCtrl+V")
        .build(app)?;
    let edit_select_all = MenuItemBuilder::with_id("edit_select_all", "Select All")
        .accelerator("CmdOrCtrl+A")
        .build(app)?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&edit_undo)
        .item(&edit_redo)
        .separator()
        .item(&edit_cut)
        .item(&edit_copy)
        .item(&edit_paste)
        .item(&edit_select_all)
        .build()?;

    // View 菜单
    let view_reload = MenuItemBuilder::with_id("view_reload", "Reload")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let view_toggle_devtools = MenuItemBuilder::with_id("view_toggle_devtools", "Toggle Developer Tools")
        .accelerator("Alt+CmdOrCtrl+I")
        .build(app)?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&view_reload)
        .item(&view_toggle_devtools)
        .build()?;

    // Window 菜单
    let window_minimize = MenuItemBuilder::with_id("window_minimize", "Minimize")
        .accelerator("CmdOrCtrl+M")
        .build(app)?;
    let window_zoom = MenuItemBuilder::with_id("window_zoom", "Zoom").build(app)?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&window_minimize)
        .item(&window_zoom)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app, event| match event.id().as_ref() {
        "app_quit" => {
            app.exit(0);
        }
        "app_hide" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        "view_reload" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("window.location.reload()");
            }
        }
        "view_toggle_devtools" => {
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                if window.is_devtools_open() {
                    window.close_devtools();
                } else {
                    window.open_devtools();
                }
            }
        }
        "window_minimize" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.minimize();
            }
        }
        "window_zoom" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
            }
        }
        id => {
            // 其余事件透传给 web 端，web 可监听 `native-menu` 自定义事件
            let _ = app.emit("native-menu", id.to_string());
        }
    });

    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItemBuilder::with_id("tray_show", "Show Workbench").build(app)?;
    let hide_item = MenuItemBuilder::with_id("tray_hide", "Hide Workbench").build(app)?;
    let quit_item = MenuItemBuilder::with_id("tray_quit", "Quit").build(app)?;
    let tray_menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&hide_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Workbench")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray_show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray_hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "tray_quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ===== IPC: web → shell =====
// 协议定义见 apps/workbench-desktop/src/contracts.ts 与
// docs/specs/2026-09-01-workbench-mac-packaging/DESIGN.md §3。
//
// 当前实现：
//   * shell://unread   → 更新 macOS Dock 红点 + 托盘 title
//   * shell://notify   → 推 macOS 系统通知（点击后唤起主窗口 + 跳 url）
//
// 所有失败均静默降级（不弹错误 UI，不影响 SPA 体验）。

#[derive(Deserialize)]
struct ShellUnreadPayload {
    count: i64,
}

#[derive(Deserialize)]
struct ShellNotifyPayload {
    title: String,
    #[serde(default)]
    body: String,
    #[serde(default)]
    url: Option<String>,
    /// 同 tag 通知合并（M5 引入 macOS UNNotificationRequest.identifier 后启用）。
    #[allow(dead_code)]
    #[serde(default)]
    tag: Option<String>,
}

#[derive(Deserialize, Default)]
struct ShellLoginFailedPayload {
    #[serde(default)]
    reason: Option<String>,
}

fn register_ipc_listeners(app: AppHandle) {
    let app_for_unread = app.clone();
    app.listen("shell://unread", move |event| {
        let payload: ShellUnreadPayload = match serde_json::from_str(event.payload()) {
            Ok(p) => p,
            Err(err) => {
                eprintln!("[shell] shell://unread payload parse error: {err}");
                return;
            }
        };
        if payload.count < 0 {
            eprintln!("[shell] shell://unread negative count ignored: {}", payload.count);
            return;
        }
        let count = payload.count as u64;
        apply_unread(&app_for_unread, count);
    });

    let app_for_notify = app.clone();
    app.listen("shell://notify", move |event| {
        let payload: ShellNotifyPayload = match serde_json::from_str(event.payload()) {
            Ok(p) => p,
            Err(err) => {
                eprintln!("[shell] shell://notify payload parse error: {err}");
                return;
            }
        };
        let title = payload.title.trim();
        if title.is_empty() {
            return;
        }
        deliver_notification(
            &app_for_notify,
            title,
            &payload.body,
            payload.url.as_deref(),
            payload.tag.as_deref(),
        );
    });

    // shell://login-success：登录窗 → 主窗。
    let app_for_login = app.clone();
    app.listen("shell://login-success", move |_event| {
        switch_to_main(&app_for_login);
    });

    // shell://login-failed：仅记录，不做 UI 行为（web 端已自带错误态）。
    let _ = app.listen("shell://login-failed", move |event| {
        let payload: ShellLoginFailedPayload =
            serde_json::from_str(event.payload()).unwrap_or_default();
        if let Some(reason) = payload.reason {
            eprintln!("[shell] login failed: {reason}");
        }
    });

    // shell://logout：主窗 → 登录窗。
    let app_for_logout = app.clone();
    app.listen("shell://logout", move |_event| {
        switch_to_login(&app_for_logout);
    });
}

/// 关闭 login 窗、显示 main 窗；如 main 已存在只 show。
fn switch_to_main(app: &AppHandle) {
    if let Some(login) = app.get_webview_window("login") {
        let _ = login.hide();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    } else {
        eprintln!("[shell] main window missing in tauri.conf.json");
    }
}

/// 关闭 main 窗、显示 login 窗。
fn switch_to_login(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    if let Some(login) = app.get_webview_window("login") {
        let _ = login.show();
        let _ = login.unminimize();
        let _ = login.set_focus();
    }
}

fn apply_unread(app: &AppHandle, count: u64) {
    // macOS Dock 红点（Tauri 2 提供 `set_badge_label`）
    if let Some(window) = app.get_webview_window("main") {
        let label = if count == 0 { None } else { Some(count.to_string()) };
        let _ = window.set_badge_label(label);
    }
    // 托盘 title（macOS 菜单栏图标右侧显示）
    if let Some(tray) = app.tray_by_id("main-tray") {
        let title = if count == 0 {
            "Workbench".to_string()
        } else {
            format!("Workbench ({count})")
        };
        let _ = tray.set_title(Some(&title));
    }
}

/// 同 tag 通知在 `MERGE_WINDOW` 内的后续推送会被**丢弃**（保留最后一次）。
/// macOS 11+ 已不再支持直接覆盖系统通知，因此采用"短时窗去重"策略：
/// 收到新通知时，若同 tag 在窗口内已经发过，跳过本次；让最近一条自然送达。
/// 实战中 web 端应保证高频更新走 debounce（200ms 级），shell 端此窗口兜底。
const MERGE_WINDOW: Duration = Duration::from_millis(1500);

static NOTIFY_DEDUPE: once_cell::sync::Lazy<Mutex<HashMap<String, Instant>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));

fn deliver_notification(
    app: &AppHandle,
    title: &str,
    body: &str,
    url: Option<&str>,
    tag: Option<&str>,
) {
    if let Some(tag) = tag {
        let mut map = NOTIFY_DEDUPE.lock().expect("NOTIFY_DEDUPE poisoned");
        let now = Instant::now();
        if let Some(prev) = map.get(tag) {
            if now.duration_since(*prev) < MERGE_WINDOW {
                // 窗口内已有同 tag 推送，吞掉本次；保留 last-seen。
                map.insert(tag.to_string(), now);
                return;
            }
        }
        map.insert(tag.to_string(), now);
        // 定期清理过期 entry，避免长跑内存增长
        map.retain(|_, t| now.duration_since(*t) < MERGE_WINDOW * 4);
    }

    use tauri_plugin_notification::NotificationExt;

    let title_owned = title.to_string();
    let body_owned = body.to_string();
    let url_owned = url.map(|u| u.to_string());

    let result = app
        .notification()
        .builder()
        .title(title_owned)
        .body(body_owned)
        .show();

    if let Err(err) = result {
        eprintln!("[shell] notification failed: {err}");
        return;
    }

    // 同步唤起主窗口（macOS 系统通知出现在通知中心，不强制抢焦点）；
    // 若用户点击通知，再次触发 focus。
    if let Some(window) = app.get_webview_window("main") {
        if let Some(target) = url_owned {
            let js = format!(
                "window.history.pushState({{}}, '', {json}); window.dispatchEvent(new PopStateEvent('popstate'));",
                json = serde_json::json!(target),
            );
            let _ = window.eval(&js);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::should_hide_on_close;

    #[test]
    fn login_close_exits_instead_of_hiding() {
        assert!(!should_hide_on_close("login"));
    }

    #[test]
    fn main_close_stays_in_the_tray() {
        assert!(should_hide_on_close("main"));
    }
}
