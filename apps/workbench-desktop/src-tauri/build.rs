use std::fs;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-env-changed=AXI_DESKTOP_LOCAL");
    println!("cargo:rerun-if-changed=.build-profile");
    let profile_path = PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("Cargo must provide CARGO_MANIFEST_DIR"),
    )
    .join(".build-profile");
    let profile_mode = fs::read_to_string(profile_path).unwrap_or_default();
    let local_mode = if profile_mode.trim() == "local" {
        "true".to_string()
    } else {
        std::env::var("AXI_DESKTOP_LOCAL").unwrap_or_default()
    };
    println!("cargo:rustc-env=AXI_DESKTOP_LOCAL={local_mode}");
    tauri_build::build()
}
