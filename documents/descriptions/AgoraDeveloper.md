# Agora Developer Description

This is the developer view of Agora: the design, and the code that carries it today. It is based on `Agora-Old-Description.md`, corrected and completed with the current class roles, the current data layout and the path a turn takes through the server. The old document and the old TODO list are kept beside it, untouched. The user-level counterpart is `documents/user/Agora.md`, the open work is collected in `AgoraTODOs.md`, and the terse role list is `ServerClassRoles.md`.

## Introduction

A system managing multiple characters in group chats and their memories. Each character has its own personality, memory system and style.

We named it Agora.

A lightweight backend orchestrates:

- group chat dynamics
- character invitations
- entering and leaving
- memory condensation
- memory retrieval
- archiving sessions

It is not just architecture but a stage play: Characters step in with a ritual invitation, pause to recollect with a memory thread, raise their hand to speak, and finally archive their part before leaving. The system feels alive, like a parliament of muses.

The stage play is the direction, not the whole current state. What runs today is the file-based storage, the workshop system, the stream protocol, one-to-one chats, and the first group-chat mechanics: invitations and leaving, urgency-based speaker selection, hand raising, and per-Ark block memory. The remembering thread and the session-end condensation described below are still design.

## Naming

The naming has artistic intentionality. While designing the interfaces, "assistant" sounded wrong, and even "artificial" has a pejorative edge, so the naming turned into a story: in an imagined non-hierarchical mixed society, one type is the Evolutionary Person and the other the Architectured Person, Evs and Arks. Agora is the public square where the two meet, the system itself. In the fiction it is an archived ancestor of USAS, the Unified Scalable Ark System. The project is half art, and the names are load-bearing: an Ark carries its own persona, memory and continuity rather than being a disposable session.

## Server Class Roles

### Entry, routes and operations

- AgoraServer.ts is the process entry. It initializes AgoraUtil, then starts the HTTP server on port 8091 with the route table. The chat routes are `/api/arks`, `/api/models` (the meta models), `/api/chats`, `/api/settings`, `/api/readContext`, `/api/context`, `/api/create`, `/api/copy`, `/api/removeLastArkMessage`, `/api/removeLastUserMessage`, `/api/memorizeAndDelete`, `/api/memorizeAndClear`, `/api/forgetAndDelete`, `/api/forgetMemories`, `/api/keepAndDelete`, `/api/send` and `/api/abort`. The content routes are under `/api/content/`. The image library is served under `/ui/images/` and the client bundle under `/ui/`. Only the image library is served statically; documents have no route yet. The base models handler is written but not routed.
- AgoraUtil is the layer between the routes and the machinery: the initializer (the core folders, the workshops, then the periodic wakeup timer), the loaders for chats, Arks, base models and meta models, the chat operations (create, copy), the context operations (read, edit, tail removals for try again and edit last), the memory lifecycle operations (memorizeAndDelete, memorizeAndClear, forgetAndDelete, forgetMemories, keepAndDelete), the settings accessors, the send entry point and the abort. Every mutation of a chat takes that chat's lock here.

### The turn

- ProcessUtil is the main chat loop: `sendMessage` calls `createInput`, `processInput`, `addToContext`, `nextSpeaker` and then the generation, and recurses when the Ark hands over to itself. `checkSplit` moves the oldest entries into the archive when the context exceeds `contextLimit`, and `handleEnding` does the same with a larger threshold when a chat is closed. It also forwards the lifecycle calls, `onUpdate`, `onBlock` and `onDelete`, to the workshop hub.
- GenerateUtil expands prompts, converts the stored entries into the transcript the model reads, and runs the generations. `generateMessage` is the reply, `generateMemory` is the condensation of a block, `generateRaw` is the shared call into ChatService. `expandPrompt` resolves the `{{...}}` includes and the four direct names, and adds the thinking preambles. `convertContext` walks the context backwards, so the newest images and documents are the ones read back in full.
- ParamsUtil builds `CombinedParams`: the merged settings, the merged workshops, the resolved models (`mainSettings`, `smallSettings`, `visionSettings`) and the stream handler. `getCombinedSettings` reads the global settings, the models and the chat settings; `setCurrentArk` folds in the Ark's settings, the chosen meta model and the resolved base models, sanitized against their capability flags.

### The workshop hub

- WorkshopUtil is the single registry hub and the one place where a workshop's roles are visible: the tables from a workshop key to the class that implements the role, the settings merge, the gated forwards, the action gathering, the schedule collection and the wakeup run. Its role tables are `settingsProviders`, `promptProviders`, `contextListeners`, `messageProcessors`, `imageProcessors`, `documentProcessors`, `resultProcessors`, `actionHandlers` and `wakeUpHandlers`.
- ActionsUtil scans a message for the `@group name parameters` lines, runs each found action through the gathered registry, and turns the result into an entry: a raw string goes through the result mode and becomes a result entry, a finished entry is streamed and stored as it is. It is registered as a message processor and as a result processor at once, since both ends of the action path have to be intercepted.

### Storage, data and time

- ContextUtil holds the stored entry type, the three templates (minimal, archive, ark), the active and archive files, the locked read and edit helpers, and the text rendering with its gap handling and trimming.
- MemoryUtil is the memory workshop and the memory storage: the per-Ark catalogue and notes, the active memory rewrite on every update, the block condensation on a split, the loading of the memories into the prompt, and the removal paths for a forget or a delete.
- ChatUtil owns the global settings, the chat folders, the chat metas, and creation, copying and deletion.
- ArkUtil owns the Ark folders and their settings, which carry the five prompts (chat, clean, document, image, memory) and the Ark's overrides.
- ModelUtil reads `base-models.json` and `meta-models.json`, resolves a role through the file's `default` entry and the named entry, and sanitizes a model against its capability flags: a model that cannot reason loses its thinking value, and null values are dropped.
- LibraryUtil is the collection layer: ensuring a library with its settings and catalogue, the index counter and the date-stamped name generator, catalogue entry read, write and remove, and the directory listings used to find folders that carry a `settings.json`.
- SettingsUtil owns the location registry in `~/.config/think-tank/locations.json`, which maps a logical path to a real one on first use and can be edited to move data elsewhere, plus the read, edit and ensure helpers that always merge a file over its defaults.
- NodeUtil is the thin wrapper over node's `os`, `path`, `fs`, `http` and `child_process`, so no other class touches node directly. `executeProcess` is what the image workshop uses to run `sips`, `ffmpeg` or `magick`.
- FileUtil is safe file access: text and JSON reads and writes, locked variants of each, and the in-memory `Mutex` that serializes them per path. The same mutex is used for the per-chat locks.
- DateUtil does date part extraction and formatting, the `when` vocabulary shared by the schedules and the TODO dates (`parseWhen`, `formatWhen`, `whenTime`, `advanceWhen`, with the unit words year, month, week, day, hour, minute and second), and the `DateGapHandler`, which decides whether a date or a time is worth printing at a given point of a transcript.
- AgoraStreamer is the stream to the page: the marker lines, the raw chunks, the per-chat abort controller, and the error text an interrupted generation leaves behind.

### Model and web adapters

- ChatService with ChatAdapter is the chat provider layer. The adapter creates the request body and turns a response line into thinking and content; the service streams both according to the thought mode and checks the abort flag per line. The registered adapters are Ollama, which is also the default, and Mercury.
- WebService with WebAdapter is the same shape for search and fetch. The web workshop is its only caller.
- FetchUtil is the HTTP client behind both, including the by-line and by-chunk stream helpers and the abort check.

### The workshops

- WebWorkshop provides the four web actions and keeps its settings in a single file, `web-settings.json`, rather than in a folder.
- ImageWorkshop owns the image library: saving an upload, deriving the model-sized and thumbnail copies, the description call, the check sweep over the library, the images actions, the entry processing and both conversions.
- DocumentWorkshop is the same shape for documents, without the derived copies.
- TODOWorkshop owns the category files, the nine todo actions, the wakeup list in its settings, and the report composition.
- IdeaWorkshop is the beginning of the compost: blocks of conversation are filed into its INBOX as dense transcripts, and a wakeup is scheduled for the organizing step that is not written yet.
- `CompostWorkshop.ts`, `DreamWorkshop.ts` and `WorkshopService.ts` are empty files, placeholders for the next workshops and for a workshop service.

### The web client

- AgoraUI in `AgoraWebUI.ts` is the page entry and wires the parts together: the buttons, the chat list, the options, the context view, the input and the title toggle.
- AgoraAPI in `Interface.ts` mirrors the server routes in one place.
- ContextView feeds the stream through the `[[...]]` parser, creates the entry views, and keeps the date gap handler for the loaded context.
- MessageView renders one entry: a message with its header and timestamp, a raw image from its base64, a stored image from its thumbnail, a raw document shortened, and the linkified text otherwise. While a reply streams, it holds back a possible unfinished link.
- ChatInput owns the message box, the attachments, the send button that becomes a stop button, and the try again, edit last and export actions. `setMessage` restores a removed user message with its attachments.
- ChatList loads and groups the chats, OptionsView fills the Ark and the meta model selectors, and InputDisabler tracks the per-chat busy state in three values: enabled, silenced and disabled.
- LinkUtil linkifies text and detects a link that is still arriving, ServerTypes holds the types shared with the server, and SpeachHandler speaks the incoming parts through the browser's speech synthesis. Its name and its file name are misspelled: it speaks, it does not listen.

### Build

- `build/agora.server.json` compiles `Source/AgoraServer/AgoraServer.ts` into `server/agora.js`, and `build/agora.web.json` compiles `Source/AgoraWebUI/AgoraWebUI.ts` into `web/agora/agora.js`. Both emit one file, with `module: none` and `///` reference paths doing the linking, so the emit order matters: a class has to be referenced before any class that reads it while loading. `documents/com.agora.server.plist` is the launch agent for the server.

## The Workshop Hub in Detail

A workshop is a class that takes one or more of a fixed set of roles. The hub keeps one table per role, so what a workshop can do is readable in one place, and adding a workshop means adding its line to the tables it belongs to.

- settings provider: `getDefaults`, `readSettings` and `editSettings`. All six entries of the hub: web, image, document, todo, idea, memory.
- prompt provider: `getPromptParts`, returning the parts with a group, a description and the content. All six are registered; every one of them is still an empty stub.
- context listener: `onUpdate`, `onBlock`, `onDelete`. Memory and idea.
- message processor: `processMessage`, which may push new entries into the queue. Actions.
- image processor: `processImage`, `convertArkImage` and `convertUserImage`. The image workshop.
- document processor: `processDocument`, `convertArkDocument` and `convertUserDocument`. The document workshop.
- result processor: `processResult`. Actions.
- action provider: `getActions`, returning the same group and name shape the action scanner expects. Web, image, document and todo.
- wakeup handler: `getSchedule`, returning a list of `{ next, interval, onWakeUp }` where `next` is a `when` string. Image, document, todo, idea and memory.

Two rules hold the hub together. First, the `enabled` flag in a workshop's merged settings gates exactly its capabilities: its actions, its prompt parts, its context listening and its wakeups. The processing and conversion path is deliberately not gated, so an attachment is still saved, described and read back while the workshop is switched off; the switch decides what the workshop offers, not whether the data is kept. Second, the workshop settings are merged per key, in the order default, the workshop's own settings file, global, chat, Ark, so any layer can override a single field without replacing the whole workshop object.

The schedule side is cooperative. Each wakeup handler answers with the next time it wants to run and a callback. The hub collects the schedules of the enabled workshops, parses `next` back into a time, and runs the due callbacks inside one global lock, so the workshops never race each other. Each callback decides for itself how many intervals have passed since its own last run, moves its own stored time forward, and then does its step. A repeat interval is counted from the item's own time rather than from the previous run, so the phase of a repeating schedule or a repeating TODO never drifts. The timer that drives the whole thing is `wakeUpInterval` in the global settings.

## Settings Resolution

Settings come from five places. The built-in defaults in the code are the floor; a workshop's own settings file sits above them; then the global `settings.json`, the chat's `settings.json` and the Ark's `settings.json` follow, each overriding only the fields it holds. Every reader merges the file over the defaults, so a partially written settings file is valid and a missing one simply falls through.

The intended shape of the merged result, kept close to the code:

``` text
settings = {
	...defaultSettings
	...globalSettings
	...chatSettings
	...arkSettings
	memorySettings: { ...defaultMemorySettings, ...globalMemorySettings, ...chatMemorySettings, ...arkMemorySettings }
	workshopSettings: { ...defaultWorkshopSettings, ...globalWorkshopSettings, ...chatWorkshopSettings, ...arkWorkshopSettings }
}

metaSettings = metaModels[metaModel]
smallSettings = baseModels[metaSettings.smallModel]
visionSettings = baseModels[metaSettings.visionModel]
mainSettings = { ...baseModels[metaSettings.mainModel], ...settings }
```

Today the workshops arrive in a `workshops` key on the global, chat and Ark settings, merged per workshop rather than in a separate `workshopSettings` object, and the memory mode lives among the ordinary settings rather than in a `memorySettings` block. The meta model is merged below the settings layers, so anything a chat or an Ark sets wins over the meta model, and the three role settings are then resolved from the base models with the whole merged settings laid over them, and sanitized so that a model is only asked for what it can do.

## A Turn, End to End

1. The page posts to `/api/send` with the text, the images and the documents. AgoraUtil takes the chat's lock and builds the params for that chat.
2. `createInput` turns the request into entries: the message, then one image entry and one document entry per attachment, each carrying its raw payload and the name `raw`.
3. `processInput` walks the queue. A message entry from the user is streamed back to the page first, and then offered to the message processors, where the action lines are scanned and their results are pushed into the very same queue, so an action result is processed like any other entry. An image or document entry goes through its workshop processor, and the processed entry is converted for the page and streamed back.
4. `addToContext` appends the processed entries to the active context, splits it if it has grown past `contextLimit`, which moves the oldest entries into `archive.json`, writes the file, and calls `onUpdate`, so the listeners see the new state.
5. `nextSpeaker` reads the tail of the context: a result, a user entry or an Ark entry decides whether the Ark or the user is next.
6. Generation expands the chat prompt, loads the memories under the `MEMORIES` heading, converts the stored entries into the transcript the model reads, and streams the reply token by token. The newest images are handed over as images when the main model can see, the newest documents are read back in full, and every other attachment reaches the model as its entry text.
7. The reply becomes a new message entry, and the loop runs again until the speaker would be the user, which is where the turn ends.

The archive path is the same split from the other side: when a block leaves the active context, `onBlock` hands it to the listeners. Memory condenses it with the main model and files the result; idea writes the whole block out as a transcript for later organizing. When a chat is closed, `handleEnding` moves the rest of the context through the same listeners, which is why closing a chat can take as long as a model call and why those operations stream their progress as `[[message role=info]]` lines.

## Stream Protocol

Everything the server sends to the page is one stream of text with inline markers, and the same marker shapes label the transcript the model reads, so the two faces of a conversation share one convention.

To the page:

``` text
[[message role=role name=name time=milliseconds]]
content

[[data type=image name=name]]
content

[[data type=document name=name]]
content

[[data type=result source=group]]
content

[[message role=info]]
content
```

The page reads the markers and the content as they arrive. A meta that arrives in pieces is held until it closes, text that precedes a meta belongs to the previous block, and a trailing bracket or newline is held back because it may be the beginning of the next marker. This is why the views are never redrawn: a message view is created when its meta arrives and then only appended to.

To the model, the same shapes appear inside the user role:

``` text
[[author=name date=date time=time]]
content

[[data type=image name=name]]
description or image

[[data type=document name=name]]
document text

[[data type=result source=group]]
content
```

## Data Layout

The root of the data is the registered location `/ThinkTank/Agora`, which by default is `~/ThinkTank/Agora`, and the registry itself lives in `~/.config/think-tank/locations.json`.

``` text
Agora
├── settings.json            global settings, with the global workshops section
├── web-settings.json        the web workshop's own settings
├── base-models.json         endpoints, capabilities, sampling
├── meta-models.json         named role combinations
├── Arks
│   └── <Ark>
│       ├── settings.json    the five prompts, memory mode, model overrides, workshops
│       ├── ChatPrompt.md    the persona, with {{...}} includes
│       ├── memory.json      the memory catalogue
│       └── Memories
│           ├── active-<chatID>.txt
│           └── <id>.txt
├── Chats
│   └── <chatID>
│       ├── settings.json    title, timestamps, chat overrides
│       ├── active.json      the live context
│       └── archive.json     the blocks moved out of it
├── Images
│   ├── settings.json        the upload and converter settings
│   ├── catalogue.json       time, ext, short, long per image
│   ├── <id>-Full.<ext>      the original
│   ├── <id>-LLM.png         the model-sized copy
│   └── <id>-Thumb.jpeg      the display copy
├── Documents
│   ├── settings.json
│   ├── catalogue.json
│   └── <id>.<ext>
├── TODOs
│   ├── settings.json        the wakeup list
│   └── <category>.txt       one item per line, "- " open, "+ " done
└── Ideas
    ├── settings.json
    ├── catalogue.json
    └── INBOX
        └── <id>.txt
```

The shapes that move through the system:

- a stored context entry is `{ type, role, name, content, time }`, where type is message, result, document or image, and role is user, ark, env or info.
- the model-facing message is `{ role, content, images }`, where role is system, user or assistant and images carries base64 payloads.
- an image or document catalogue entry is `{ time, ext, short, long }`.
- a memory catalogue entry is `{ source, short, start, end, weight }`.
- a TODO item is one line with `@id=`, `@due=`, `@remind=` and `@repeat=`, plus the leading mark that says whether it is open or done.
- the global settings hold `lastIndex`, `userName`, `arkName`, `metaModel`, `thought`, `blockSize`, `contextLimit`, `wakeUpInterval`, `resultMode`, `memoryMode` and the optional `workshops`.
- the chat settings hold the title and the timestamps plus any optional override, and the Ark settings hold the five prompts plus its own overrides.

What an attachment looks like at each step of its life:

``` text
incoming:   { type: "image", name: "raw", content: "ext=png\ndata=<base64>" }
processed:  { type: "image", name: "2026-09-18-00085", content: "" }
stored:     the same entry, the file is in Images/, the description is in catalogue.json
streamed:   { type: "image", name: "2026-09-18-00085", content: "2026-09-18-00085-Full.png" }
ark facing: [[data type=image name=2026-09-18-00085]], with the image bytes when the model can see, otherwise the bare name with an empty body
```

A reference reaches the transcript as its name, and the description behind it is reachable with an action, not woven in by itself. A kept-out upload skips the middle steps: its processed content is the raw payload, so the entry itself carries the file, and the ark side reads it from there.

## Memory

Memory belongs to the Ark, not to the chat, and it has three layers of life.

The active layer is a projection, not a conclusion. Every update rewrites the whole active context into `active-<chatID>.txt` through the minimal template, which costs no model call. It is a plain-text record of what has been said, so a chat can be abandoned mid-thread and the Ark still has the turn on file.

The frozen layer is condensation. When the active context crosses `contextLimit`, the oldest entries move into the chat's `archive.json` and the block is handed to the main model with the memory prompt. The answer has a short line, a tags line, a weight and the note body. The short line, the covered time range, the source chat and the weight are filed in the Ark's `memory.json`, and the body is written beside it in `Memories`. The tags line is parsed but currently dropped.

The prompt layer is injection. At generation time every memory of the Ark except the current chat's active one is concatenated under the `MEMORIES` heading, each prefixed with its source chat and the time range it covers, so the Ark reads its own past as narration rather than as replayed transcript. The memory mode decides how far this goes: `enabled` reads and writes, `readonly` reads but does not write, `disabled` also leaves the memories out of the prompt.

The design around this layer is older and larger than the implementation. The intent has always been that memory is curated rather than archived:

- weighted catalogue: a recall raises a memory's weight, the end of a chat decays the unused ones, and the ordering follows weight as well as chronology, with per-Ark decay and reinforcement patterns possible later.
- multi-tier recall: high weight sits at the opening of a session with a detailed summary, middle weight appears as list items and is recalled when chosen, low weight is reachable only through an explicit recall.
- tone shaping: the weight shapes how the memory is told, confidently for the vivid ones, vaguely or hesitantly for the faint ones.
- auto insertion: high weight is injected as broad narrative, middle weight as shorter description, low weight as a one-line catalogue entry.
- anchored memories: the Ark may judge some memories personally important and give them a slower decay.
- session end: all remaining participants condense the conversation into topic-based pieces, each with a short dense summary, and the summaries join the catalogues with their timestamps and references.
- the rolling ladder, for a context that keeps growing: messages become a detailed summary, the detailed summary a dense one, the dense one a line, and each step is archived with the next step referencing it.

## Group Chat, as Designed

Parts of this section are now implemented: invitations, leaving, urgency-based speaker selection, hand raising, and per-Ark block memory. The remembering thread and the session-end condensation are still design.

### Core ideas

Character folders: each participant has persona prompts, rules, a memory catalogue and memory notes, with no assumption that all memories feel the same; some are narrative, some factual, some whimsical. Archives stay plain text and hand-editable at any point.

Group chat mechanics: the user or an assistant may mention a character to invite them. On invitation the character receives an introduction prompt and the recent messages, joins with its persona and memory rules, and may leave again at any time, archiving its part of the context when it does.

Memory retrieval is a thread rather than a query: a character initiates a remembering pause with topics and a time window, receives a memory-searching instruction of its own, runs one turn with the context and the catalogue, writes down candidate notes in reverse chronological order, and the system concatenates the chosen notes within a budget. The character composes the recollection, rolls the scaffolding back and inserts only the recollection, hidden from the other participants, and returns to the conversation as if it had simply taken a moment to think.

Turn-taking: after each message every active assistant receives the tail of the context with an assessment instruction and answers with an importance value. The highest speaks next, and the user's relevance is assessed the same way. The user can raise a hand to claim the next turn outright. The same values can carry reply speed and personality, so the replies stagger like they do between people.

Memory lifecycle at session end: capture, catalogue, condense, archive. Each character condenses the conversation into topic-based pieces, each piece gets a short dense summary, the summaries with their timestamps and references are added to the catalogues, and the archives keep both the detailed transcript and the condensed summaries.

### Example conversation

The user greets the first Ark. A second Ark is brought into the chat with an introduction prompt. They talk, the user asks for a third Ark, the third is introduced the same way, and the question of how much history a newly invited character should receive comes up. The second Ark is asked about something from months earlier, initiates a remembering thread, gets its searching instruction, writes candidate notes, has the chosen notes concatenated, and returns with a recollection. Then the assessment phase runs: every assistant answers with a digit, the user is evaluated too, and the highest speaks, with the user able to raise a hand and override. At the end, the remaining parties condense the conversation into topic-based pieces and their summaries join the catalogue with timestamps and references.

### Example prompts

Group chat introduction: you are `{CHARACTER}`, you have been invited to a group chat with `{USER}` and possibly other assistants, stay in your persona, respond naturally, you may mention others.

Memory retrieval: you are `{CHARACTER}`, given a catalogue of memory entries, select the most relevant in reverse chronological order, write out the candidate notes, do not fabricate entries.

Memory condensation: you are `{CHARACTER}`, condense this conversation, break it into topic-based chunks, for each create a dense short summary, add timestamp and references.

Response assessment: you are `{CHARACTER}`, assess whether you should speak in the next turn, return a single digit from 0 to 9.

Cross-mention: you are `{CHARACTER}`, you have been mentioned, treat the message as directly addressed to you and respond.

Main prompt: you are `{CHARACTER}`, you can invoke system commands, such as remember with a short description of what you are trying to recall, search with a query, and exit.

### Session flow

Session start creates one character state per participant, each with its working context, its identity and its state of importance and hand raising, and initializes the contexts.

The input and output cycle takes the output of the current speaker, parses it for commands and mentions, adds the cleaned spoken text to every participant's context, and queues the commands. Command execution runs the queue in order: a mention spawns the character if it is not active, a remember searches the catalogue, injects the relevant entries into that character's own context, lets it re-internalize them, rolls the raw injections back, and leaves the character holding the speaker role. Other commands such as exit or search are handled in the same deterministic way.

The assessment phase then has every character score its own relevance from 0 to 9, scores the user the same way with an explicit hand raise possible, rolls the scaffolding back and keeps only the results, and selects the highest as the next speaker.

### Design principles

Per-character contexts, so updates are local and a rollback touches one participant. Rollbacks remove the scaffolding and preserve only the natural paraphrase. Self-explanation, so memory is never injected raw but always digested and retold. Distributed hearing, so every participant receives the cleaned dialogue. A system queue, so commands are separated from spoken text and executed deterministically.

### Flow, sketched

``` text
GroupContext {
	characters: CharacterContext[]
	user: UserContext
}

CharacterContext {
	messages [ system, list, summary, message, ... message ]
}

UserContext {
	messages [ message, ... message ]
}

GroupContext.addPublicMessage:
- append the message to every other context with the user role, rolling up where needed
- append it to the transcript
- print it to the terminal

GroupContext.addCharacter:
- add a public system message the same way
- create the character's context
- select the memories with the highest weight

GroupContext.whoWantsToSpeak:
- the assessment text from the common and the character folder
- query every character with the system prompt, the last few messages
- each returns a single digit
- query the user the same way
- the next speaker is chosen from the values

CharacterContext.speak:
- run the main inference
- parse the output for commands and mentions
- add the cleaned text as a public message
- execute the commands
- remembering: by the given timeframe and the last few messages, filter the catalogue, combine the referenced notes, filter into a summary, insert into its own context only
- search, mentions, and adding the missing character work the same way
```

### Possible conversation modes

Classic, the Ark is the assistant: a private introduction of the Ark, a public introduction of the user, the memory inserts, then the user's message and the prediction. The variant puts the user's name in a system line and the message itself in the user role.

Introductory, the two introduce themselves to each other first, then the memory inserts, then the ordinary turns, with the same variant available.

Balanced, the assistant is a relay forwarding messages: the relay instruction, the private version of the Ark and the public version of the user arrive as system lines, and the user's messages are relayed.

Symmetric, everybody is a user: the system describes the conversation between the two, gives both sides as system lines, and every turn is labeled as sent rather than spoken, with an introductory variant.

## Latest Ideas

- parallel responses: when several assistants score high, they can reply almost at once, the way a real group chat overlaps.
- urgency as reply speed: a higher score means a faster reply, and the others may still send after reading the earlier ones, which staggers the conversation naturally.
- personality in timing: each assistant can carry a reaction speed, some always quick, some slow and deliberate, some trailing.
- stochastic tuning: the speaker selection, the memory recall and the memory decay can all be weighted and randomized instead of deterministic.
- an ongoing rollback of conversation into memory is needed for the context window: word-by-word messages become a detailed summary, the detailed summary a dense summary, the dense summary a one-liner, and the one-liners go to the catalogue.
- a two-tier version may be enough: a couple of one-line memories, one detailed memory, and the live messages.
- the load can be spread across the roles: a very small model for the assessment and the list filtering, a fast model for the rephrasing and the condensation, and the best model for the real messages.
- condensation runs only when the context gets too full, while assessment runs on every turn except in a one-to-one chat.
- a character's context can be built as: the system prompt, the lingering memory list, the strong memory summary, and the last few messages of the existing conversation.
- on overflow: move the tail into the catalogue as list items, drop the tail, save the summary of the messages as a memory, keep one summary and one list of items in hand that are not yet written, and try to find a natural place to split rather than a fixed one.

## Related Documents

- `documents/user/Agora.md` is the same system told to a user.
- `AgoraTODOs.md` collects the open work.
- `Agora-Old-Description.md` and `Agora-Old-TODO.md` are the originals this document and the TODO list come from.
- `ServerClassRoles.md` is the terse class role list.
- `StreamInterface.md` has the stream markers and the parser mechanism.
- `TypeScriptStyle.md` and `EvolvingInstructions.md` are the working style of the project.