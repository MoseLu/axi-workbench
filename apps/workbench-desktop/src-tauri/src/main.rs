// Workbench Mac App — binary entry point.
// 在桌面平台调用 lib::run()；在移动端使用 tauri 的 mobile entry point。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    workbench_desktop_lib::run();
}