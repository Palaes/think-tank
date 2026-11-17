# ThinkTank

ThinkTank is a local suite of three tools built from one TypeScript source tree:

- **Agora** is a local-first conversational workspace with reusable personas called Arks, memories, attachments, actions and workshops.
- **Prisms** is a browser control panel for Draw Things image generation, with projects, history, prompt wildcards and upscaling.
- **TextForge** is a small scripting language for moving and transforming text, available as a CLI and a web page.

They share one idea: Keep the data in ordinary files, keep the server free of durable in-memory state, and keep the interface plain.

## WARNING

ThinkTank has no security features yet. There is no authentication, no authorization, no TLS, no CSRF protection, no request size limit, no safe file-name handling and no host validation. The servers are meant for localhost only, and they do not enforce that bound by themselves.

Do not expose any of these servers to a network, a public interface or an untrusted browser. The data folders are not encrypted, so treat any API keys stored in them as plain text.

## Call for Help

Security is the largest missing piece of the project. Contributions are welcome for authentication, localhost-only binding, request limits, safe path and file-name handling, and a content security policy. The open security notes are in [documents/TODOs/AgoraTODOs.md](documents/TODOs/AgoraTODOs.md).

## The Projects

### Agora

Agora is a private chat environment around large language models. A conversation is a folder, an Ark is a directory of settings and prompts, a memory is a text file, and an attachment has a catalogue entry beside its file.

Use it for:

- one-to-one or group conversations with several Arks
- long-lived personas with their own memory
- images and documents that are described once and recalled later
- plain-text actions for web, documents, images, TODOs, ideas and dreams
- a chat that can be saved or copied with ordinary tools

Start with [documents/user/Agora.md](documents/user/Agora.md).

### Prisms

Prisms puts a clear control surface on Draw Things. It keeps projects and their history on disk, turns a combined prompt into one or more generations, and can import existing images, reuse their metadata and upscale results.

Use it for:

- repeatable Draw Things parameter sets
- prompts with choices, combinations and parameter walks
- a project history that is easy to inspect and back up
- image import, parameter reassignment and Real-ESRGAN upscaling

Start with [documents/user/Prisms.md](documents/user/Prisms.md).

### TextForge

TextForge is a line-based text scripting language. Channels, variables and a few commands are enough to split, merge, replace, clean and rewrite text, with an optional model call through Ollama.

Use it for:

- prompt processing and text cleanup
- splitting a long text into model-sized blocks
- batch rewrites with a local model
- one script that works in the terminal and in the browser

Start with [documents/user/TextForge.md](documents/user/TextForge.md).

## Design Philosophy

### Transparent Files

There is no database. Durable data lives under three roots:

``` text
~/ThinkTank/Agora
~/ThinkTank/Prisms
~/ThinkTank/TextForge
```

The registry at `~/.config/think-tank/locations.json` maps logical names to real paths, so any root can be moved without changing the code. Settings, catalogues, histories and queues are JSON or plain text. Prompts and memories are Markdown or text. Everything can be read, edited, copied and versioned outside the application.

### Stateless Servers

A server holds no durable business state in process memory. Every request reconstructs what it needs from files and from the request itself. Restarting a server does not lose data.

Only coordination state lives in memory: locks, abort controllers, stream writers, a queue runner flag and the scheduler timer. The durable state is always the files on disk.

### No Source Dependencies

The server uses Node's core modules through a thin `NodeUtil` wrapper. The browser uses the DOM, `fetch`, `FileReader` and `localStorage` directly. Shared TypeScript is linked with `/// <reference path="..." />` comments, not with a package manager.

External programs are reached through adapters: `ollama`, `ffmpeg`, `sips` or `magick`, `draw-things-cli` and `realesrgan-ncnn-vulkan`. Adding a dependency is a deliberate decision, not a default.

### Vanilla UI

The interface is plain HTML, CSS and JavaScript. There is no framework, no client-side router and no template language in the browser. The pages use small widgets, declarative bindings and local storage only for view state. The server is the source of truth.

### Simple Build System

Each application compiles to one JavaScript file with `tsc`:

``` text
Source/AgoraServer/AgoraServer.ts -> server/agora.js
Source/AgoraWebUI/AgoraWebUI.ts -> web/agora-ui/main.js
Source/PrismsServer/PrismsServer.ts -> server/prisms.js
Source/PrismsWebUI/SDControl.ts -> web/prisms-ui/main.js
Source/TextForgeServer/Main.ts -> server/textforge.js
Source/TextForgeTool/Main.ts -> tool/textforge.js
```

The build configurations live in `build/`. The emit order matters, because the referenced files share one namespace per bundle.

## Requirements

- macOS for the bundled apps
- servers themselves only need Node.js
- Node.js and TypeScript for building
- Ollama or OpenAI compatible LLM API
- Draw Things or `draw-things-cli`
- Optional `realesrgan-ncnn-vulkan`

## Install

Run the install script from the repository root:

``` sh
sh install.sh
```

It asks before installing Homebrew, Node.js, Ollama, ffmpeg, draw-things-cli and TypeScript, then offers to open the Real-ESRGAN macOS download. Draw Things is installed separately from [drawthings.ai](https://drawthings.ai/) or with `brew install --cask draw-things`.

On first run Ollama needs at least one model:

``` sh
ollama pull llama3.1
```

Then open Agora's `manage models` page and set the `default` entry's `model` to `llama3.1`; the shipped entry has an empty model name.

TypeScript is a build dependency.
Version 5.3.3 is used in this project.

## Build

Compile the bundles once:

``` sh
tsc -p build/agora.server.json
tsc -p build/agora.web.json
tsc -p build/settings.web.json
tsc -p build/prisms.server.json
tsc -p build/prisms.web.json
tsc -p build/textforge.server.json
tsc -p build/textforge.web.json
tsc -p build/textforge.tool.json
```

For development, `build/develop.sh` starts a TypeScript watcher for each server and web bundle and restarts the servers when their bundles change. It uses `entr`:

``` sh
brew install entr
sh build/develop.sh
```

## Run

Start each server from the repository root:

``` sh
node server/agora.js
node server/prisms.js
node server/textforge.js
```

Open:

- Agora: `http://localhost:8091/ui/`
- Prisms: `http://localhost:8092/ui/`
- TextForge: `http://localhost:8093/ui/`

`build/develop.sh` uses the same ports.
Direct `node server/...` runs use the same defaults.

## macOS Apps

The `bundler` folder builds `.app` bundles and DMGs for Agora, Prisms and TextForge. Each app starts its own Node server from the app's resources and can install the server as a background service.

```sh
brew install create-dmg
cd bundler
node bundle.js build
node bundle.js dmg
```

See [bundler/README.md](bundler/README.md) for the service and CLI installation commands.

### Bundled and Source Versions

The source tree and the app bundles run the same servers on different ports.

- Source runs use `8091`, `8092` and `8093` by default, and `build/develop.sh` passes those ports explicitly.
- App bundles use `8081` for Agora, `8082` for Prisms and `8083` for TextForge. The app passes its configured port to the server with `--port`.
- The bundle carries its own compiled server and web resources, so it does not need a checkout. It still reads the same `~/ThinkTank` data roots and the same `~/.config/think-tank/locations.json`.
- The background service runs the app's server through launchd. Logs go to `~/Library/Logs/ThinkTank/`.
- The app and its server can run together with a source server as long as they use different ports.
- The apps are ad-hoc signed and the DMGs are not notarized. TextForge also installs the `textforge` wrapper at `~/.local/bin/textforge`.

## Documents

- [Agora user guide](documents/user/Agora.md)
- [Prisms user guide](documents/user/Prisms.md)
- [TextForge user guide](documents/user/TextForge.md)
- [Project guide](documents/planning/ProjectGuide.md)
- [Server model](documents/planning/ServerModel.md)
- [UI patterns](documents/planning/UIPatterns.md)

## Special Thanks

- **Ollama** for the local model runtime and the simple streaming API.
- **Liu Liu** for Draw Things, which makes local image generation approachable.
- **Draw Things Community** for all help and the draw-things-cli tool.

## License

ThinkTank is released under the MIT License. See [License.md](License.md).