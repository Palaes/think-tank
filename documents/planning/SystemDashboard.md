# System Dashboard

## Purpose

A small, separate server that stays up when the main ThinkTank server is down. It is the control surface for the data root: start, stop, restart, and inspect the apps without depending on their code paths.

This is a feature idea, not an agreed phase. Record the shape here until it is scheduled.

## Why Separate

The dashboard must survive the failures it reports. If it lived inside `AgoraServer`, a bad Agora build, a stalled generation, or a crashing workshop would take the dashboard down with it.

- one small process with no generation, no workshop initialization, and no adapters
- its own port and its own static page
- its own log stream, so a broken app can still be read
- it may start and stop app processes, but it must not share their event loop

The app servers stay stateless as described in `ServerModel.md`. The dashboard holds only process supervision state.

## Restart ThinkTank Server

The dashboard can restart the main server without the user opening a terminal.

- send a stop request to the supervised process, then wait for the exit
- start the same command again after the stop completes
- report the exit code, the last output lines, and the new process id
- never start a second copy while the first is still running
- keep a restart from being lost when the dashboard itself restarts

The supervised command is configuration, not a hardcoded path. A small process table is enough:

```text
id: agora
command: node server/agora.js
state: running | stopped | failed
pid: ...
lastExit: ...
```

## Maintenance Modes

A maintenance mode is a safe way to keep editing content while the normal runtime is disabled.

### Content Edit Only

- start only the content edit APIs and the settings pages
- do not start chat generation, workshop schedules, or adapters
- do not call `AgoraUtil.initialize()`
- do not call `WorkshopUtil.initialize()`

`AgoraUtil.initialize()` currently initializes Arks, chats, models, and workshops. A maintenance process needs the storage helpers that those initializers use, but not the chat lifecycle or the scheduler.

The clean separation is a content server entry that wires only the `/api/content/*` handlers and their domain stores. The same process should still serve the content pages and the static image and document routes.

### When to Use It

- the main server fails to start
- a workshop or adapter is blocking startup
- the user wants to fix settings or content before restarting
- a migration needs the data root to be quiescent

## Non-Goals

- the dashboard is not a second content editor
- it does not expose a generic file read or write endpoint
- it does not run generation, contemplation, or schedules
- it does not replace the single-writer rule for a data root

## Open Decisions

- whether the dashboard starts the app as a child process or only signals an existing supervisor
- whether the content-only mode is a flag on the main server or a separate entry point
- how the dashboard authenticates, given that the servers currently bind without a host
- whether the dashboard and content-only mode share a build target
