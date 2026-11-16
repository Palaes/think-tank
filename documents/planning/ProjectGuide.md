# Project Guide

## Purpose

This document records the common structuring and building practices for the ThinkTank projects: Agora, Prisms, and TextForge. It is the shared reference for source layout, build configuration, dependency policy, and code style.

Three preferences run through everything:

- no source dependencies
- stateless servers
- minimalist UI

## No Source Dependencies

The projects use the language runtime and its standard library directly. They do not depend on npm packages, frameworks, bundlers, or generated client libraries.

- Server code uses Node core modules through `Common/NodeUtil.ts`. No other class touches `os`, `path`, `fs`, `http`, or `child_process` directly.
- Browser code uses the DOM, `fetch`, `FileReader`, `localStorage`, and other browser APIs directly.
- External programs are called through adapters and shell execution: `ollama`, `ffmpeg`, `draw-things-cli`, and `realesrgan-ncnn-vulkan`.
- Shared TypeScript is linked with `/// <reference path="..." />` comments and multiple build configurations, not with modules or a package manager.
- Small utilities such as `XSRandom`, `Catalogue`, and `ParameterList` are source files, not dependencies.

Adding a dependency requires an explicit decision. Prefer a short local implementation or standard-library call.

## Runtime Dependencies

- `ollama 0.40.3`
- `ffmpeg 9.0.2`, callable from the shell
- `draw-things-cli dev`, callable from the shell
- `draw-things-cli` models, downloaded or installed by the user
- `realesrgan-ncnn-vulkan`, redistributed
- `realesrgan` models, redistributed

External tool paths should come from `SettingsUtil.getLocation()` or from adapter settings. They must not be hardcoded to a developer machine.

## Build Dependencies

- `node 26.10.0`
- `npm 11.19.1`
- `tsc 5.3.3`

`npm` is used to install and run the TypeScript compiler, not to install runtime packages.

## Build Model

Each application compiles to one JavaScript file:

```text
Source/AgoraServer/AgoraServer.ts    -> server/agora.js
Source/AgoraWebUI/AgoraWebUI.ts      -> web/agora-ui/main.js
Source/SettingsEditor/SettingsEditor.ts
  + Source/AgoraWebUI/Interface.ts   -> web/agora-conf/main.js
Source/PrismsServer/PrismsServer.ts  -> server/prisms.js
Source/PrismsWebUI/SDControl.ts      -> web/prisms/main.js
Source/TextForge/Main.ts             -> tool/textforge.js  (intended; the current build config is stale)
```

The build configurations live in `build/`. They use:

```json
{
	"compilerOptions": {
		"target": "ES2020",
		"module": "none",
		"removeComments": true,
		"strictNullChecks": false,
		"outFile": "../server/agora.js"
	},
	"files": [
		"../Source/AgoraServer/AgoraServer.ts"
	]
}
```

The emit order matters. A class must be referenced before any class that reads it while loading. Global declarations share one namespace per bundle, so names must not collide accidentally.

Development watchers are started by `develop.sh`. Servers are restarted with `entr` when their bundles change.

The TextForge build was out of date: `build/textforge.tool.json` named `Source/TextForge/TextForge.ts`. Phase 1 points it at `Source/TextForgeTool/Main.ts`; Phase 2 repairs the stale Common paths and the missing `ConfigUtil`.

## Source Layout

Current layout:

```text
Source/
  Common/          shared standard-library wrappers and text utilities
  Adapters/        chat, web, image, speech, and tool adapters
  AgoraServer/     Agora routes and chat machinery
  AgoraWebUI/      Agora chat client
  PrismsServer/    Prisms routes, storage, and generation
  PrismsWebUI/     Prisms control client
  PrismsLibrary/   shared Prisms types, catalogues, and image metadata
  ContentServer/   server-side content storage and editing helpers
  ContentWebUI/    settings editor and editor utilities
  Workshops/       Agora workshops
  Language/        collected parsers, still separate implementations
  TextForgeTool/   script CLI tool
```

Target layout:

```text
Source/
  Common/
  ContentServer/
  ContentWebUI/
  Language/
  Adapters/
  Workshops/
  Widgets/
  AgoraServer/
  AgoraWebUI/
  PrismsServer/
  PrismsWebUI/
  PrismsLibrary/
  TextForgeCore/
  TextForgeTool/
  TextForgeServer/
  TextForgeWebUI/
```

The target layout is described in `ContentManagement.md`, `Language.md`, and `UIPatterns.md`.

## Data and Settings

Durable data lives under locations registered in `~/.config/think-tank/locations.json`. The default roots are:

```text
~/ThinkTank/Agora
~/ThinkTank/Prisms
```

Settings resolution is layered:

```text
code defaults
  < library or workshop settings file
  < global settings
  < chat settings
  < Ark settings
```

Every reader merges its file over the defaults, so a partial file is valid and a missing file falls through. Writes are serialized per path with `FileUtil.lock()`.

## Style

- Use tabs for indentation.
- Use double quotes for strings.
- Use semicolons at the end of statements.
- Put the opening brace on the same line as its statement.
- Use braces even for one statement.
- Prefer `null` over `undefined` for absent values.
- Annotate function return types.
- One declaration per statement.
- Prefer explicit loops and branches over clever expressions.
- Use `for-of` when a plain loop reads clearer.
- Match the surrounding code before applying a general rule.
- Add comments only when they explain intent, constraints, or a non-obvious tradeoff.

## Server and UI Preferences

- Servers are stateless in the durable sense. Restarting a process must not lose data, and no request should depend on a previous request being served by the same process. See `ServerModel.md`.
- The UI is plain HTML, CSS, and JavaScript. It uses small widgets, declarative binding, keyboard shortcuts, and local storage only for view state. See `UIPatterns.md`.
- Settings pages and direct editing are one content-management layer, not a set of ad-hoc file endpoints. See `ContentManagement.md`.
- Syntax for prompts, scripts, commands, and metadata is one language with per-task dialects. See `Language.md`.