# OpenCut Desktop (Tauri 2)

This fork keeps the two OpenCut generations available as separate Tauri 2 apps:

| Edition | Tauri project | Frontend source | Product identity | State |
|---|---|---|---|---|
| Classic | `apps/desktop-tauri` | Pinned `opencut-classic` Git submodule | `OpenCut Classic` / `app.opencut.desktop.classic` | Complete Classic editor; standalone server and Bun runtime are bundled in release builds. |
| New | `apps/desktop-tauri-new` | `apps/web` from the rewrite | `OpenCut New` / `app.opencut.desktop.new` | Standalone Tauri shell bundles the rewrite's static frontend. The editor route is still a preview because the upstream rewrite is not feature-complete. |

The two apps can be installed side by side and keep separate Windows application identities. New release builds bundle their frontend files directly; they do not run Docker, the root web app as a service, or a server on localhost. Development uses a local Vite server on `127.0.0.1:1420` and fails if that port is occupied. Classic development and its embedded release server use `127.0.0.1:14382`.

## Why Tauri 2

Use stable Tauri 2 for both shells. Classic reuses the existing editor instead of pretending the rewrite is complete. New is a separate app that packages the current rewrite UI and can evolve with the new Rust-core architecture. Its installer is self-contained, but its editing features are limited to what upstream has implemented so far.

Classic release builds bundle the Bun runtime, Next.js server, frontend, and WASM editor. The app does not use Docker, PostgreSQL, Redis, inherited environment secrets, or a separately managed web service. Project and media metadata stay in the WebView's local IndexedDB for the stable `127.0.0.1:14382` origin. Account login, feedback submission, telemetry, and the online Freesound browser are disabled in Desktop; import local audio from the Media panel instead.

New release builds compile the rewrite frontend in Tauri mode and bundle `apps/web/dist-tauri/client` as Tauri assets. The Desktop build omits remote Google Fonts and router developer tools, so the installed UI has no font CDN or local web-server dependency. It uses only Tauri's core window permissions until a native capability is needed.

## Windows prerequisites

1. Windows 10/11 and the Microsoft Edge WebView2 Runtime.
2. Visual Studio Build Tools 2022 with **Desktop development with C++**, including MSVC x64/x86 tools and a Windows 10/11 SDK. Check with:

   ```powershell
   & 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe' -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
   ```

3. Install the repository-pinned toolchain with Proto, as described in the root README (`proto use`). This provides the Bun, Moon, and Rust versions pinned in `.prototools`.
4. For installer builds, use the Rust MSVC target. Tauri builds both MSI and NSIS installers.

The MSVC C++ workload must be present before building the native app. On this machine Visual Studio Build Tools are installed at `C:\BuildTools`, including MSVC 14.44; verify the native toolchain from a Visual Studio Developer PowerShell if the Rust build cannot find the linker or Windows SDK.

## Install and run

From `D:\OpenCut-tauri` in PowerShell, install the pinned toolchain and frontend/Tauri CLI dependencies:

```powershell
proto use
git submodule update --init --recursive
Push-Location apps/web
bun install --frozen-lockfile
Pop-Location
Push-Location apps/desktop-tauri/classic
bun install --filter @opencut/web --frozen-lockfile
Pop-Location
Push-Location apps/desktop-tauri
bun install --frozen-lockfile
Pop-Location
Push-Location apps/desktop-tauri-new
bun install --frozen-lockfile
Pop-Location
```

Run the Classic edition:

```powershell
Push-Location apps/desktop-tauri
bun run dev
Pop-Location
```

Run the New edition:

```powershell
Push-Location apps/desktop-tauri-new
bun run dev
Pop-Location
```

The Tauri CLI starts the matching frontend command for each edition. New development uses `127.0.0.1:1420`; Classic development uses `127.0.0.1:14382`. Both bind only to loopback, fail on a port conflict, and do not stop or take over another local service.

## Build installers

Build the Classic Windows installers:

```powershell
Push-Location apps/desktop-tauri
bun run build
Pop-Location
```

Build the New Windows installers:

```powershell
Push-Location apps/desktop-tauri-new
bun run build
Pop-Location
```

Artifacts are emitted under `target/release/bundle/`, including NSIS `.exe` and MSI `.msi` packages. Classic builds the standalone Next server and includes Bun; New builds the rewrite's Vite/TanStack client and embeds the static files in the Tauri app. Both packages use the offline WebView2 installer mode. Before public distribution, configure Windows code signing and a Tauri updater signing key; the updater is intentionally not wired until release infrastructure exists.

## Tauri plugin catalogue and decisions

Official catalogue: <https://v2.tauri.app/plugin/>. Official plugins consist of Rust crates and, where provided, JavaScript bindings. Add a plugin only with its capability-specific permissions in `src-tauri/capabilities/default.json`.

| Official plugin | Purpose | OpenCut desktop decision |
|---|---|---|
| Autostart | Launch at login | Not needed for an editor |
| Barcode Scanner | Scan codes with mobile camera | Mobile only; not needed |
| Biometric | Mobile biometric auth | Mobile only; not needed |
| CLI | Parse command-line arguments | Later, for batch/project launch workflows |
| Clipboard | Native clipboard access | Later if browser clipboard APIs are insufficient |
| Deep Linking | Register URL protocols | Later, when project deep links are defined |
| Dialog | Native open/save/message dialogs | **Installed now** for media and project selection |
| File System | Scoped native file access | **Installed now**; grant project/media paths deliberately |
| Geolocation | Device location | Not needed |
| Global Shortcut | System-wide keyboard shortcuts | Later only for global shortcuts; editor shortcuts are in-app |
| Haptics | Mobile vibration | Mobile only |
| HTTP Client | Native HTTP requests | Later if native networking is needed |
| Localhost | Embed a localhost server in production | Not needed for static SPA |
| Logging | Native log targets | **Installed now** for diagnostics |
| NFC | Read/write NFC tags | Mobile only |
| Notifications | Native notifications | Later for long exports/background tasks |
| Opener | Open URLs/files in another app | **Installed now** for exported media and help links |
| OS Information | Read OS metadata | Later if platform-specific UI needs it |
| Persisted Scope | Persist granted filesystem scopes | Later if selected folder access must survive restarts |
| Positioner | Place windows in common positions | Not needed yet |
| Process | Exit/restart the app | Not needed for initial shell |
| Shell | Launch child processes | Later for FFmpeg/FFprobe sidecars; restrict command allowlists |
| Single Instance | Keep one app process/window | **Installed now** |
| SQL | SQL database access | Not needed while project persistence design is unsettled |
| Store | Persistent key/value settings | **Installed now** for preferences; not a media/project database |
| Stronghold | Encrypted secrets storage | Later if the desktop stores credentials |
| Updater | In-app updates | Later after signed releases and update hosting are configured |
| Upload | Upload files over HTTP | Later if cloud uploads are implemented |
| Websocket | Native websocket client | Later if native services need websocket connections |
| Window State | Restore window dimensions/position | **Installed now** |

The official site also lists `tauri-plugin-clipboard-manager` (native clipboard), `tauri-plugin-barcode-scanner`, and `tauri-plugin-biometric`; those map to the relevant rows above. Mobile-specific camera, biometric, geolocation, haptics, and NFC workflows are not part of this Windows-first setup.

### Installed in the Classic desktop shell

- `tauri-plugin-dialog`
- `tauri-plugin-fs`
- `tauri-plugin-log`
- `tauri-plugin-opener`
- `tauri-plugin-single-instance`
- `tauri-plugin-store`
- `tauri-plugin-window-state`
- `@tauri-apps/cli` (desktop build/dev CLI)

The New shell currently installs no optional Rust plugins. It has only `core:default` Tauri permissions because the rewrite preview does not yet call native APIs. Add a plugin to `apps/desktop-tauri-new/src-tauri/Cargo.toml` and its least-privilege permission to `capabilities/default.json` when implementing a concrete New-edition workflow; do not grant Classic's filesystem or dialog access automatically.

Rust plugin versions use the compatible Tauri 2 release line (`"2"`), resolved and locked by Cargo. Tauri frontend APIs should be added as the UI starts using each capability; the initial shell does not pretend to expose file import/export before those flows exist.

## Other project dependencies and next integrations

- Keep Classic sourced from the pinned Classic submodule. Advance New with the main rewrite without mixing its files into the Classic app.
- Continue using the shared Rust workspace for native editing/rendering crates as those are designed upstream.
- Evaluate FFmpeg/FFprobe as bundled sidecars only when rendering/export implementation starts. At that point add `tauri-plugin-shell` with a narrow binary/argument allowlist and package licensing/attribution for each binary.
- Do not add an updater, auto-start, SQL database, cloud API key storage, or unrestricted shell access without a concrete feature requirement.
- `tauri-ui` can be used as a scaffolding/reference project, but it is not a runtime dependency and this app already has an OpenCut frontend to reuse.

## Official plugin catalogue extensions

The official Tauri plugin page also lists community-maintained extensions. These are separate from the official plugins above and need independent compatibility, maintenance, and security review before adoption. Names currently listed by Tauri include:

`sentry-tauri`, `tauri-awesome-rpc`, `tauri-nspanel`, `tauri-nspopover-plugin`, `tauri-plugin-android-battery-optimization`, `tauri-plugin-android-fs`, `tauri-plugin-aptabase`, `tauri-plugin-auth`, `tauri-plugin-blec`, `tauri-plugin-cache`, `tauri-plugin-clipboard`, `tauri-plugin-context-menu`, `tauri-plugin-desktop-underlay`, `tauri-plugin-device-info`, `tauri-plugin-dragout`, `tauri-plugin-drpc`, `tauri-plugin-esc-pos`, `tauri-plugin-fs-pro`, `tauri-plugin-graphql`, `tauri-plugin-iap`, `tauri-plugin-in-app-review`, `tauri-plugin-ios-photos`, `tauri-plugin-js`, `tauri-plugin-keep-screen-on`, `tauri-plugin-libsql`, `tauri-plugin-macos-permissions`, `tauri-plugin-mobile-sharetarget`, `tauri-plugin-mqtt`, `tauri-plugin-network`, `tauri-plugin-nosleep`, `tauri-plugin-ota`, `tauri-plugin-pinia`, `tauri-plugin-prevent-default`, `tauri-plugin-python`, `tauri-plugin-screenshots`, `tauri-plugin-serialport`, `tauri-plugin-serialplugin`, `tauri-plugin-sharesheet`, `tauri-plugin-svelte`, `tauri-plugin-system-info`, `tauri-plugin-tcp`, `tauri-plugin-thermal-printer`, `tauri-plugin-tracing`, `tauri-plugin-udp`, `tauri-plugin-velesdb`, `tauri-plugin-view`, `tauri-plugin-widgets`, `tauri-remote-ui`, and `taurpc`.

These are not installed in the starter. Most are unrelated to an editor's first desktop window; reconsider an individual one when a concrete feature needs it.
