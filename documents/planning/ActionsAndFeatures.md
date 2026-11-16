# Actions and Features

## Action Syntax

Canonical action lines use the unified command form:

```text
@image-describe id=2026-09-18-00085
@image-list dir=portraits "sunset"
@image-view id=2026-09-18-00085
@image-generate
```

```text
@document-describe id=notes/plan
@document-list dir=notes "roadmap"
@document-view id=notes/plan
@document-write id=notes/plan from=10 to=20
replacement text
```

The group and action names are joined with a hyphen. Named parameters are `name=value` and come before the rest of the input. The shared argument parser reads them.

The existing `@image list` form is not kept. The scanner uses the hyphenated form.

## Image and Document Actions

### describe

```text
@image-describe id=...
@document-describe id=...
```

- Loads the stored file.
- Uses the configured vision or text model.
- Parses the response into a short line and a long description.
- Writes the catalogue entry.
- Returns a short confirmation entry.

The description generation should return a structured result instead of slicing fixed prefixes such as `lines[0].slice(7)`. Either use a small metadata frame:

```text
Short: one line
Long: detailed description
```

or a JSON object. The parser should fail cleanly when the shape is wrong.

The same operation is callable from the settings pages through `/agora/conf/image` and `/agora/conf/document`, using an explicit `action: "describe"` or `describe: true` request field. The settings page gets a `describe` button for the selected entry.

### list

```text
@image-list dir=portraits "sunset"
@document-list dir=notes "roadmap"
```

- Lists folders and subfolders under the library root.
- Includes each entry's name, short description, and long description in the search scope.
- `dir=` limits the walk to that relative folder.
- The remaining quoted text is the search phrase.
- Search is case-insensitive substring matching by default. Regex search can be added later as an explicit parameter.
- The result is one environment message with a compact table.

Library keys must support relative paths:

```text
portraits/2026-09-18-00085
notes/plan
```

The storage file name is derived from the key. Names are sanitized before they become paths.

### view

```text
@image-view id=...
@document-view id=...
```

- Loads the catalogue entry.
- Returns a context entry of type `image` or `document`.
- The stream carries the entry name and variant URLs.
- The UI renders a thumbnail. A click opens the shared gallery.
- The model receives the image through the existing conversion path when it can see images, and the long description when it cannot. Documents follow the existing full-document or description path.

The action result is a real context entry, not a text placeholder. This lets the normal context conversion logic apply.

### generate

```text
@image-generate
<generation script>
```

The handler parses the whole entry, not only the argument string.

Flow:

1. Parse the entry with the unified command and template language.
2. Build a canonical image generation parameter object.
3. Stream a confirmation info message:

```text
[[message role=info]]
Generating image...
```

4. Call the Draw Things adapter. Register an abort hook with the chat.
5. Save the result through `ImageStorage`.
6. Add a catalogue entry with the prompt as the short description and an empty long description, unless a describe step is requested.
7. Return an image context entry. The normal result processor streams it and stores it.
8. On failure, stream an error info message and leave no pending catalogue entry.

The generation script is the Prisms command language with the Prisms dialect. A minimal entry is:

```text
@image-generate
a quiet harbour at dawn, soft light
```

A fuller entry can use the existing Prisms commands:

```text
@image-generate
@model: sd_xl_base_1.0
@size: 1024 768
@steps: 30
@sampler: DPM++ 2M Karras
a quiet harbour at dawn
- blurry, text, watermark
```

If the action group is used outside a chat, the same handler can return the image record without the stream steps.

## Document Editing

`@document-write` replaces lines in an existing document.

```text
@document-write id=notes/plan from=10 to=20
replacement text
```

- `from` and `to` are one-based line numbers.
- `to` is inclusive.
- Negative indices count from the end, with `-0` meaning the last line.
- If `to` is omitted, the range is one line.
- If both are omitted, the whole document is replaced.
- The body is everything until a blank line or the next command.
- A separate `@document-append` can be added if it reads better than an open-ended range.

The operation locks the document file, reads it, replaces the range, and writes it back. It returns the resulting line count or a short confirmation.

Document creation, rename, upload, and removal already exist in the settings API. The action layer reuses the same domain methods.

## Special Sending Modes

A text-only select sits below the Send button. It looks like the existing text buttons, not like a native form control. The default mode keeps the current behavior. Every other mode applies to one send only and overrides the image and document upload settings.

Modes:

- Send text as local document: the text becomes a document context entry and is not saved to the Documents library.
- Send text as global document: the text is saved to the Documents library under a generated name, then added as a document context entry.
- Send with local attachments: attachments are added raw to the context and are not saved to the Images or Documents libraries.
- Send with global attachments: attachments are saved to the Images or Documents libraries through the normal upload path.

The send request carries the mode. `ProcessUtil.createInput()` and the image and document processors take the override instead of reading only the stored `upload` setting.

Label names, in the short lowercase style of the existing buttons:

```text
normal
text → local
text → global
attach → local
attach → global
```

Alternate wording, when a full phrase reads better on the page:

```text
send as usual
text as draft
text as document
files as draft
files as library
```

## Knowledge

Marking documents as knowledge adds their content to the system prompt for an Ark or a chat.

Settings:

```typescript
interface KnowledgeSettings {
	enabled: boolean;
	documents: string[];
	autoInclude: boolean;
	autoLimit: number;
	decisionModel: string;
}
```

The setting can live under `document` or under a new `knowledge` section. The choice affects merging; a separate section is clearer.

Resolution:

- Documents marked on the Ark are available to every chat with that Ark.
- Documents marked on the chat are available to that chat.
- The chat layer should concatenate with the Ark layer and de-duplicate, not replace the Ark list. Ordinary settings still override.

Prompt injection:

```typescript
DocumentWorkshop.getPromptParts(params): Promise<PromptPart[]>
```

Returns:

```typescript
{
	group: "knowledge",
	description: `Knowledge: ${name}`,
	content: documentText
}
```

`GenerateUtil.generateMessage()` must call `WorkshopUtil.getPromptParts(params)` and append the parts to the system prompt. Today the prompt providers exist but are never consumed.

Order the parts explicitly:

```text
chat prompt
memories
knowledge parts
```

A per-part and total character budget prevents one large document from crowding out the conversation.

## Automatic Inclusion

Automatic inclusion selects relevant documents for the current turn without the user marking each one.

Inputs:

- recent conversation tail
- candidate document names, short descriptions, and long descriptions
- the current limit and budget

Process:

1. If `autoInclude` is off, skip.
2. Build a compact candidate catalogue.
3. Ask the decision model to rank the candidates by relevance to the recent conversation.
4. Parse the ranked identifiers.
5. Include the top entries up to `autoLimit` and the character budget.
6. Cache the result for the current context revision.

The decision prompt:

```text
Given the recent conversation, rank the following documents by relevance.
Return only the identifiers in order, one per line.

Conversation:
...

Documents:
id: ...
short: ...
long: ...

Limit: N
```

Rules:

- Use `decisionModel` when set; otherwise use the small model.
- Do not call `generateMessage` from this path. It would recurse through prompt assembly. Call `ChatService.generate` directly or a small `DecisionUtil` that does not add prompt parts.
- On parse failure, fall back to no automatic inclusion. Do not inject arbitrary text.
- Cache by chat id and a hash of the context tail. Re-run when the tail changes or a document is edited.
- Marked knowledge is always considered before automatic candidates.

## Reuse with Prisms

- The Prisms command engine becomes the image generation command handler.
- The DT CLI and GUI adapters are shared.
- The upscaler adapter is shared.
- The template engine replaces `STDPreprocessor`.
- `ImageStorage` gives both projects the same variant model.
- The gallery and stream widgets are shared.

The action handler should not depend on Prisms page state. It receives a canonical parameter object and returns an image record.

## Open Decisions

- Whether generated images always enter the image library or stay raw in the context unless saved.
- Whether `@image-generate` waits for the image or enqueues a job and streams the image when the queue completes.
- Whether knowledge uses a separate settings section or lives under `document`.
- Whether automatic inclusion ranks all documents or only documents not already marked as knowledge.