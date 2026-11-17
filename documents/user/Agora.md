# Agora

Agora is a local-first conversational workspace around large language models. It runs as a small local server and is used through an ordinary web page. Conversations, personas, prompts, memories and attachments are all plain files.

This guide is for using Agora. The developer view lives in `documents/descriptions/AgoraDeveloper.md`.

## What It Is

- a chat client with saved conversations
- reusable personas called Arks
- model roles for the main reply, the small jobs and vision
- a file library for images and documents
- memories written and recalled by the Ark
- plain-text actions instead of native tool calling
- workshops for TODOs, ideas, dreams, speech and web access

There is no database. A conversation is a folder, a memory is a text file and a prompt is Markdown. You can inspect, back up or edit everything with normal tools.

## First Run

1. Install Ollama and make sure it runs locally.
2. Pull at least one chat model, for example `ollama pull llama3.1`.
3. Start the server from the repository root.

```sh
node server/agora.js
```

4. Open `http://localhost:8091/ui/`. The bundled Agora app uses `http://127.0.0.1:8081/ui/` instead.
5. Open `Ark – model`, then `manage models`, edit the `default` entry, and set `model` to the model you pulled. Set `vision` to false unless that model can actually see images.

On first start Agora creates its data folders under `~/ThinkTank/Agora`, a placeholder Ark named `Nemo`, and the global settings file. The location registry at `~/.config/think-tank/locations.json` maps logical names such as `/ThinkTank/Agora` to real paths. Edit it if you want the data somewhere else.

> Agora has no security features yet. Use it on localhost only. See the warning in `ReadMe.md`.

## Models

Open `Ark – model` above the chat, then `manage models`, or edit `~/ThinkTank/Agora/models.json` directly.

A model entry describes one endpoint:

```json
{
	"models": {
		"local": {
			"display": "Local / Llama",
			"APIType": "ollama",
			"APIHost": "http://localhost:11434/api/chat",
			"APIKey": "",
			"model": "llama3.1",
			"chat": true,
			"vision": false,
			"think": false,
			"temp": 0.35,
			"topP": 0.85,
			"topK": 35,
			"numCtx": 32768,
			"numKeep": 8192,
			"numPredict": 8192
		}
	}
}
```

- `chat` makes the model available in the chat selector.
- `vision` allows it to receive images.
- `think` passes the reasoning preference to the provider.
- `tweak` is an extra system prompt for this model.
- `variants` creates named presets such as `Local instant` and `Local high`, each overriding a few fields.

The `default` entry is the fallback. Agora resolves the main, small and vision roles from the model settings, so a cheap model can do the bookkeeping while a stronger model writes the replies.

## Arks

An Ark is the character you talk to. An Ark is a folder under `~/ThinkTank/Agora/Arks` with a `settings.json` and any Markdown prompts you add.

Create an Ark with `manage Arks`, then `create`. The Ark editor lists every global prompt and every Ark prompt, and lets you edit the Ark's JSON settings as well.

The Ark settings are ordinary JSON:

```json
{
	"generate": {
		"prompt": "You are {{ARK}}. Stay in character and write plain text."
	},
	"process": {
		"useClock": true,
		"useArchive": true
	},
	"memory": {
		"allowRead": true,
		"allowWrite": true
	}
}
```

Prompt files may include each other:

```text
{{Prompts/BaseStyle.md}}
{{Arks/{{ARK}}/Personality.md}}
```

Four names expand without a file: `{{ARK}}`, `{{USER}}`, `{{MODEL}}` and `{{THINK}}`. Every other `{{...}}` is a path relative to the Agora data root. A missing file leaves a literal `null` in the prompt, so check the spelling.

The Ark editor edits the Markdown prompts and the raw settings. The chat menu can also override the Ark per chat without changing the Ark itself.

## Chats

The sidebar keeps every conversation.

- `create` starts a new chat.
- `rename` changes its title.
- `copy` duplicates the conversation and its settings without reusing the memory or archive settings.
- `clear` removes the context but keeps the chat.
- `delete` removes the chat folder after asking whether the Ark should remember it.
- `archive` condenses what remains and moves the context into the archive, then blocks new messages.

The title button opens the chat list. The menu beside it opens the global, chat and Ark settings, the model choices and the editor pages.

`try again` removes the last Ark reply. `edit last` brings the last user message back into the input, with its attachments when they were kept raw. `save chat` files the full conversation transcript into the Documents library.

## Attachments

Use `attach` or drop files onto the message box.

- Images are sent to the vision model when it can see.
- Text documents are read back in full for recent turns.
- Older attachments enter the conversation by name and can be pulled back with an action.

The image and document workshops have an upload mode:

- `raw` keeps the file in the conversation only.
- `save` stores it in the library without describing it.
- `describe` stores it and asks a model for a short and a long description.

Stored files live under `Images/Images` and `Documents/Documents`, with a catalogue entry per file. Images also get a model-sized copy and a thumbnail when `sips`, `ffmpeg` or `magick` is available.

Manage both libraries from the menu: `manage images` and `manage documents`.

## Actions

An Ark can run actions by writing lines inside its reply. The current syntax joins the group and the action with a hyphen:

```text
@web-fetch https://example.com
@document-list
@image-view 2026-09-18-00085
@todo-add due=1d buy tea
@idea-create name=Garden a garden that remembers
@dream-dream
@chat-call Nemo
```

The current groups are:

- `web`: `fetch`, `search`, `wide-search`, `deep-search`
- `document`: `list`, `search`, `read`
- `image`: `list`, `search`, `view`
- `todo`: `add`, `list`, `cats`, `done`, `edit`, `remove`, `remind`, `cancel`
- `idea`: `create`, `list`, `details`, `update`, `contemplate`, `delete`, `move`, `copy`
- `dream`: `dream`
- `chat`: `call`, `leave`

The raw result of an action can be streamed as it is, cleaned, or passed through the small model. That mode is the `actions.generate` setting. The exact vocabulary the Ark sees comes from the prompt parts of the enabled workshops, so it stays in the same plain-text layer as the rest of the configuration.

The `document-search` and `image-search` actions are still empty stubs.

## Memory

Memory belongs to the Ark, not to the chat.

- Every update keeps an active memory reference per chat. The content is not copied; recall reads the chat's active context and shortens it to `activeEntries` entries. This costs no model call.
- When the context grows past `minContextSize`, the oldest block moves into `archive.json` and the Ark writes a memory from it.
- Frozen memories live in the Ark's `Memories` folder and in its `catalogue.json`.
- At generation time the memories are placed in the system prompt, not replayed as transcript.

Use `learn` and `recall` in the chat menu to allow writing and reading. `manage memory` opens the memory editor for the current Ark.

The memory prompt and the collection limits are in the Ark settings:

```json
{
	"memory": {
		"model": "default",
		"prompt": "Write a memory paragraph for yourself, plain text.",
		"activeLimit": 5,
		"activeEntries": 10,
		"activeLines": 2,
		"activeLength": 200,
		"shortLimit": 300,
		"longLimit": 30,
		"allowRead": true,
		"allowWrite": true
	}
}
```

## Group Chats

A chat starts with the user and one Ark. The user can invite more Arks:

```text
@chat-call Nemo
```

An Ark can leave with `@chat-leave`, except the Ark that owns the chat.

When more than two members are present, Agora asks every member how urgently it wants to speak next, scores the answers with how long each has been waiting, and picks the next speaker. If the inference fails, every member gets a neutral urgency and the waiting time still decides.

While a reply is streaming, the send button becomes `hand`. Pressing it raises your hand, and the current generation hands the next turn to you. A second press turns the button into `stop` and aborts the generation.

## Workshops

- `documents` and `images` keep the attachment libraries.
- `todos` keeps one text file per category under `TODOs`. An item is `- text @id=... @due=... @repeat=...`; a done item starts with `+`.
- `ideas` collects conversation blocks in `Ideas/INBOX`, then files, summarizes and contemplates them.
- `dreams` writes a memory from fragments of older memories.
- `web` provides fetch and search.
- `speech` streams reply audio when the TTS settings point at a speech endpoint.

Workshop settings live under the data root or in the global settings, and can be switched off in the global, chat or Ark settings.

## TODOs

TODO dates accept relative and sparse absolute forms:

```text
1d
2w
30m
3M
1Y
2026-09
09-18-15:00
```

A reminder is a scheduled wakeup that delivers a report into a chat. The TODO workshop can also check due items on a schedule.

Manage categories and text from `manage todos`.

## Settings

Settings are layered. A value from a higher layer overrides the same key below it:

```text
code defaults
  < workshop settings file
  < global settings
  < Ark settings
  < chat settings
```

A missing file or key falls through. The JSON files are safe to edit by hand while the server runs.

The important global settings are:

- `process.userName`, `process.arkName`
- `generate.mainModel`, `generate.visionModel`, `generate.smallModel`
- `generate.thinking`, `generate.prompt`
- `memory.allowRead`, `memory.allowWrite`
- `workshop.interval`

## Data Layout

```text
~/ThinkTank/Agora
├── settings.json
├── models.json
├── Prompts
├── Arks
│   └── <Ark>
│       ├── settings.json
│       ├── <prompt>.md
│       ├── catalogue.json
│       └── Memories
├── Chats
│   └── <chatID>
│       ├── settings.json
│       ├── active.json
│       └── archive.json
├── Images
├── Documents
├── TODOs
├── Ideas
├── Dream
└── Web
```

The data roots are registered in `~/.config/think-tank/locations.json`. Move a root by editing that file, not by moving files behind the server.

## Export and Copy

`save chat` asks the server for the full transcript of the archive and the active context and files it as a document in the Documents library. The menu's `copy chat` puts the same text on the clipboard. The sidebar's `copy` button makes a new chat with a copy of the history, and switches off archiving, memory writes and reads, and idea updates for the new chat. All of these are ordinary file operations, so a conversation can leave Agora and come back without a special format.