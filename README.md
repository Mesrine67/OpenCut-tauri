<table width="100%">
  <tr>
    <td align="left" width="120">
      <img src="https://assets.opencut.app/branding/symbol.svg" alt="OpenCut Logo" width="100" />
    </td>
    <td align="right">
      <h1>OpenCut</h1>
      <h3 style="margin-top: -10px;">A free and open source video editor for web, desktop, and mobile.</h3>
    </td>
  </tr>
</table>

[![Discord](https://img.shields.io/discord/1386309140057690133?label=Discord&logo=discord&logoColor=fff&color=5865F2&style=flat)](https://discord.gg/zmR9N35cjK)
[![X](https://img.shields.io/badge/follow-%40opencutapp-000?logo=x&logoColor=fff&style=flat)](https://x.com/opencutapp)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat)](LICENSE)

## Status

**OpenCut is being rewritten from the ground up.** What's coming:

- An Editor API
- First-class third party plugins (made possible by a plugin-first architecture)
- Desktop, mobile, and browser from one codebase (Rust core)
- MCP server (for AI agents)
- Headless mode (automation, batch rendering)
- A scripting tab directly in the editor

You can still find the previous version at [opencut-app/opencut-classic](https://github.com/opencut-app/opencut-classic), which is the one to reach for today. [opencut.app](https://opencut.app) still runs the classic version. The rewrite will live at [new.opencut.app](https://new.opencut.app) until it's ready to take over.

## Development

Install [proto](https://moonrepo.dev/proto) if you haven't already:

**Linux, macOS, WSL:**

```sh
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)
```

**Windows (PowerShell):**

```powershell
irm https://moonrepo.dev/install/proto.ps1 | iex
```

If shims fail to run, allow local scripts for your user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

From the repo root:

```sh
proto use    # installs the tools pinned in .prototools
```

```sh
moon run web:dev       # localhost:5173
moon run api:dev       # localhost:8787
moon run desktop-tauri-classic:dev # OpenCut Classic editor in Tauri 2
moon run desktop-tauri-new:dev     # current rewrite frontend in Tauri 2
```

The Classic desktop embeds the working Classic editor from a pinned upstream submodule. The New desktop bundles the rewrite's current web frontend as local assets, with no separately running web service in the installed app. The rewrite is still under construction, so its editor route remains a preview while upstream completes [tracking issue #811](https://github.com/OpenCut-app/OpenCut/issues/811).

For native Windows prerequisites, Tauri plugin choices, separate development commands, and MSI/NSIS builds, see [TAURI_SETUP.md](TAURI_SETUP.md).

## Contributing

Desktop-specific work for this fork belongs in [Mesrine67/OpenCut-tauri](https://github.com/Mesrine67/OpenCut-tauri). For the upstream web editor, use [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut); its current repository only accepts pull requests from collaborators.

## Sponsors

OpenCut is supported by companies that believe in open source creator tools.

- [**fal.ai**](https://fal.ai?utm_source=github-opencut&utm_campaign=oss): Generative image, video, and audio models all in one place.

Want your logo here? Reach out at [sponsor@opencut.app](mailto:sponsor@opencut.app).

## License

[MIT](LICENSE)
