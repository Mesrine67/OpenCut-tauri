#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{process::Child, sync::Mutex};

#[cfg(not(debug_assertions))]
use std::{
    net::{TcpStream, ToSocketAddrs},
    process::{Command, Stdio},
    thread,
    time::Duration,
};

use tauri::Manager;

struct ClassicServer(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            app.manage(ClassicServer(Mutex::new(None)));

            #[cfg(not(debug_assertions))]
            start_classic_server(app)?;

            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.navigate("http://127.0.0.1:14382/".parse()?)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(server) = window.try_state::<ClassicServer>() {
                    if let Ok(mut child) = server.0.lock() {
                        if let Some(child) = child.as_mut() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run OpenCut Desktop");
}

#[cfg(not(debug_assertions))]
fn start_classic_server(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let resources = app.path().resource_dir()?;
    let server_root = resources.join("resources/classic-server");
    let bun = resources.join("resources/bun.exe");
    drop(std::net::TcpListener::bind(("127.0.0.1", 14382))?);
    let mut command = Command::new(bun);
    command
        .env_clear()
        .arg("desktop-start.cjs")
        .current_dir(&server_root)
        .env("PORT", "14382")
        .env("HOSTNAME", "127.0.0.1")
        .env("NODE_ENV", "production")
        .env("OPENCUT_DESKTOP", "1")
        .env("NEXT_TELEMETRY_DISABLED", "1")
        .env("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:14382")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    for key in ["SystemRoot", "WINDIR", "TEMP", "TMP"] {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let mut child = command.spawn()?;
    let address = ("127.0.0.1", 14382).to_socket_addrs()?.next().ok_or("invalid localhost address")?;
    for _ in 0..100 {
        if TcpStream::connect_timeout(&address, Duration::from_millis(150)).is_ok() {
            let window = app.get_webview_window("main").ok_or("main window is missing")?;
            window.navigate("http://127.0.0.1:14382/".parse()?)?;
            app.manage(ClassicServer(Mutex::new(Some(child))));
            return Ok(());
        }
        if let Some(status) = child.try_wait()? {
            return Err(format!("OpenCut Classic server exited during startup: {status}").into());
        }
        thread::sleep(Duration::from_millis(100));
    }

    let _ = child.kill();
    let _ = child.wait();
    Err("OpenCut Classic server failed to start on 127.0.0.1:14382".into())
}
