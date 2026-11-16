# Server Model

## Definition

A server is stateless when it holds no durable business state in process memory. Every request reconstructs what it needs from files and from the request itself. Restarting the process is safe, and two requests for the same resource do not depend on being handled by the same process.

Stateless does not mean lock-free or memory-free. It means the in-memory state is coordination state that may be lost.

## Durable State

All durable state lives in files under registered locations:

```text
~/.config/think-tank/locations.json   location registry
~/ThinkTank/Agora/                   chats, Arks, images, documents, memories, todos, ideas
~/ThinkTank/Prisms/                  projects, history, queue, settings
```

The server reads settings and entries from disk on demand. It does not cache them as the source of truth.

Settings are layered in this order:

```text
code defaults
  < workshop or library settings file
  < global settings
  < chat settings
  < Ark settings
```

A read merges the file over the defaults. A write merges a patch over the file. Missing files fall through to defaults.

## In-Memory State

The following may live in memory because losing it only loses coordination, not data:

- the `Mutex` map that serializes access per path
- abort controllers for in-flight generations
- stream response writers
- the flag that prevents more than one queue runner per process
- the timer that wakes the scheduler

The following must not live only in memory:

- chat context and archive
- chat metadata, titles, timestamps
- Ark settings, prompts, memories
- image and document catalogues and files
- TODOs, ideas, schedules
- Prisms projects, history, queue, settings

## Locks

`FileUtil.lock(path)` returns a per-path mutex. A mutation reads, changes, and writes while holding the lock.

```typescript
const lock = await FileUtil.lock(path);
try {
	const data = await FileUtil.readJSONRAW(path) ?? {};
	// change
	await FileUtil.writeJSONRAW(path, data);
} finally {
	lock.release();
}
```

The lock is in-process. That is sufficient because each data root is served by one process. If a second process ever writes the same root, the model needs a real inter-process lock, not a larger mutex.

## Queues and Schedules

Long-running work is persisted, then executed by an ephemeral worker.

- Prisms stores its generation queue in `queue.json`. `executeQueue()` drains it and resumes on restart.
- Agora stores schedules in global settings. `WorkshopUtil` reads them and runs due entries. The timer itself is rebuilt on startup.

Restart rules:

- A queued job that has not started remains queued.
- A job that was `ongoing` when the process stopped cannot still be running. On startup it should become `pending` again, or `error` with a clear reason. It must not stay `ongoing` forever.
- A completed job remains completed.
- Abort controllers are gone after restart. No client may assume it can abort a generation that started in a previous process.

## Request Lifecycle

A request handler should:

1. Decode the body.
2. Validate the resource identifiers and arguments.
3. Lock the smallest path that it mutates.
4. Read the current file state.
5. Apply the change.
6. Write the file.
7. Release the lock.
8. Stream or return the result.

Handlers should not keep references to mutable global objects between requests. Passing a request-scoped handler object into the process is fine; storing it globally is not.

## Reads and Side Effects

A read should not mutate durable state unless the mutation is the point of the endpoint.

Current exception: `ChatUtil.readContext()` updates the chat's `viewed` timestamp. That makes a read have a write side effect. The cleaner model is an explicit acknowledgement endpoint or a separate `markViewed` call from the client. This is a small cleanup, not a blocker.

## Abort and Streaming

`AgoraStreamer` writes the stream and registers an abort controller per chat. This is ephemeral by design.

- Abort is checked per streamed line or chunk.
- An aborted generation leaves an interrupted marker in the stream.
- The stored context is the authority after the stream ends.
- The page must not assume the server remembers a stream object after the request completes.

## Statelessness Checklist

For every new feature, ask:

- If the process restarts now, where does the state come from?
- Is any authoritative value stored only in a map, closure, or timer?
- Can two requests for the same resource race? Which lock prevents it?
- Does a read mutate anything?
- Does a long-running job have a persisted record and a defined restart state?