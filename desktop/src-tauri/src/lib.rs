//! Ruta CAE desktop: a native window around the same web app (app/), so it
//! runs offline, keeps its own data, and can be pinned to the taskbar/dock.
//! External links (YouTube, resources) open in the system browser.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Ruta CAE");
}
