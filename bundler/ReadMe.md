# ThinkTank Bundler

Builds macOS app bundles for Agora, Prisms, and TextForge.

Each app is a small Swift program with a `WKWebView`. The app starts its Node server from its own `Contents/Resources`, waits for the port, and loads the web UI. When opened, it offers to install the server as a background service and, for TextForge, to install the `textforge` command.

## Requirements

- macOS with Xcode Command Line Tools (`swiftc`, `codesign`)
- Node.js
- `create-dmg` from Homebrew (`brew install create-dmg`)

## Commands

```sh
cd bundler

node bundle.js list
node bundle.js build
node bundle.js build Agora
node bundle.js dmg
node bundle.js dmg TextForge
node bundle.js clean

node bundle.js service install Agora
node bundle.js service uninstall Agora
node bundle.js service status Agora

node bundle.js cli install TextForge
node bundle.js cli uninstall TextForge
```

`build` produces `dist/<App>.app`. `dmg` also produces `dist/<App>.dmg`.

The `service` and `cli` commands run the built app's executable with the same actions the app menu exposes. They look for the app in `dist`, `~/Applications`, then `/Applications`.

## App layout

```text
dist/Agora.app/
  Contents/
    Info.plist
    MacOS/Agora
    Resources/
      server/agora.js
      web/agora-ui/
      web/content/
```

The server runs with `Contents/Resources` as its working directory, so its relative `./web/...` routes resolve inside the app. The app also passes `--port` from its config: Agora uses 8081, Prisms 8082 and TextForge 8083. The source-tree servers use 8091, 8092 and 8093 instead.

## Service and command line

The background service is a per-user LaunchAgent at `~/Library/LaunchAgents/<bundle id>.server.plist`. It runs `node <app>/Contents/Resources/<server script>` with the resources folder as its working directory. Logs go to `~/Library/Logs/ThinkTank/<App>.log`.

TextForge installs `~/.local/bin/textforge`, a wrapper for the bundled `tool/textforge.js`. The tool is copied to `~/Library/Application Support/ThinkTank/TextForge`, so the app can move after installation.

The app is signed ad-hoc. The DMG is not signed or notarized.
