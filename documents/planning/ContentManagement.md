# Content Management

## Purpose

Settings pages and the direct editing API edit stored content. They are not config, and they are not the chat or generation domain. The layer has two sides, kept in separate folders:

- `Source/ContentServer/` for the server primitives and routes
- `Source/ContentWebUI/` for the editor and client API helpers

Domain classes keep their domain names and defaults. They delegate storage mechanics to this layer.

## Concepts

### JSONFile

A single JSON file with read, raw read, edit, and write operations.

```typescript
class JSONFile {
	public static async read<Type>(path: string): Promise<Type>;
	public static async readRaw<Type>(path: string): Promise<Type>;
	public static async edit<Type>(path: string, change: (data: Type) => void): Promise<Type>;
	public static async write<Type>(path: string, data: Type): Promise<void>;
}
```

`read` merges over defaults. `readRaw` returns the file as stored. `edit` locks, reads raw, changes, and writes.

Used by: `ModelUtil`, global settings, Prisms settings, Prisms history, any single-file store.

### FolderWithSettings

A folder whose children carry `settings.json`.

```typescript
class FolderWithSettings {
	public static async list(root: string): Promise<string[]>;
	public static async create(root: string, name: string, defaults: any): Promise<string>;
	public static async rename(root: string, oldName: string, newName: string): Promise<string>;
	public static async remove(root: string, name: string): Promise<string>;
	public static async readSettings(root: string, name: string, defaults: any): Promise<any>;
	public static async readRawSettings(root: string, name: string): Promise<any>;
}
```

The folder name is the identity. Rename moves the folder. Remove deletes it recursively.

Used by: `ChatUtil`, `ArkUtil`, Prisms projects.

### RawTextFile

A plain text file or a folder of plain text files.

```typescript
class RawTextFile {
	public static async list(root: string, ext?: string): Promise<string[]>;
	public static async read(path: string): Promise<string>;
	public static async write(path: string, content: string): Promise<string>;
	public static async rename(path: string, newPath: string): Promise<void>;
	public static async remove(path: string): Promise<void>;
}
```

Used by: `TodoUtil`, `PromptUtil`, memory note files, TextForge files.

### Library

A folder with settings, a catalogue, and stored files. Entries are mapped by name.

```typescript
class Library<EntryType> {
	public constructor(root: string, defaults: any);
	public async ensure(): Promise<void>;
	public async list(): Promise<string[]>;
	public async readEntry(name: string): Promise<EntryType>;
	public async writeEntry(name: string, entry: EntryType): Promise<EntryType>;
	public async removeEntry(name: string): Promise<void>;
	public async nextName(): Promise<string>;
	public async listFiles(): Promise<string[]>;
}
```

The catalogue file holds:

```json
{
	"lastIndex": 12,
	"entries": {
		"2026-09-18-00012": { }
	}
}
```

`lastIndex` is only for name generation. Entries are the catalogue.

Library names may contain a relative path such as `portraits/2026-09-18-00012`. That is how `@image list @dir=` and subfolders work.

Used by: `MemoryUtil`, `ImageWorkshop`, `DocumentWorkshop`, Prisms project history.

### ImageStorage

Image libraries add variants. The variant set is:

```text
full    the original upload or generated image
llm     the model-sized copy, when the model must receive pixels
thumb   the display copy
```

```typescript
type ImageVariant = "full" | "llm" | "thumb";

interface ImageRecord {
	id: string;
	time: number;
	ext: string;
	variants: Dict<string>;
	metadata: any;
}

class ImageStorage {
	public async save(id: string, ext: string, data: string): Promise<ImageRecord>;
	public async read(id: string, variant: ImageVariant): Promise<string>;
	public async list(): Promise<string[]>;
	public async remove(id: string): Promise<void>;
	public async rename(oldID: string, newID: string): Promise<void>;
}
```

Agora’s current layout is:

```text
Images/
  settings.json
  catalogue.json
  <id>-Full.<ext>
  <id>-LLM.png
  <id>-Thumb.jpeg
```

Prisms’ current layout is:

```text
<project>/
  history.json
  <id>.png
```

The first implementation keeps both physical layouts behind `ImageStorage`. The UI receives variant URLs in stream metadata, so the physical layout can change later without touching `MessageView`.

## Server Routes

`AgoraServer.ts` keeps the chat routes. The direct editing routes move to `ContentRoutes.ts`.

Current routes:

```text
/api/content/raw
/api/content/context
/api/content/prompts
/api/content/prompt
/api/content/ark
/api/content/documents
/api/content/document
/api/content/memories
/api/content/memory
/api/content/models
/api/content/model
/api/content/images
/api/content/image
/api/content/todos
/api/content/todo
```

The URLs share the `/api/content/` prefix. The handlers move.

Do not replace them with one generic path endpoint. Each resource has its own handler, its own allowed root, and its own validation. A generic “read or write this path” endpoint turns the content layer into a file server.

## Domain Mapping

| Domain | Primitive |
| --- | --- |
| `ChatUtil` | `FolderWithSettings` |
| `ArkUtil` | `FolderWithSettings` |
| `ModelUtil` | `JSONFile` |
| `TodoUtil` | `RawTextFile` |
| `PromptUtil` | `RawTextFile` |
| `MemoryUtil` | `Library` |
| `ImageWorkshop` | `Library` + `ImageStorage` |
| `DocumentWorkshop` | `Library` |
| Prisms `ProjectStore` | `FolderWithSettings` + `Library` |

Domain classes keep their defaults, prompt text, actions, and conversions. They stop implementing locking, catalogue parsing, and file naming.

## Client Side

`SettingsEditor` and `EditorUtil` move into `ContentWebUI/`.

The shared editor already has the right shape:

```typescript
interface EditorSource {
	select?: string;
	onSelect?: (entries: EditorEntry[]) => void;
	getListData: () => Promise<EditorEntry[]>;
	readItem: (data: any) => Promise<string | EditorImage | any>;
	updateItem: (data: any, value: string | any) => Promise<string | EditorImage | any>;
}
```

Add a page descriptor so the seven settings pages do not repeat the shell and the standard button wiring:

```typescript
interface EditorAction {
	label: string;
	handler: () => Promise<void>;
	enabled?: (selection: EditorEntry[]) => boolean;
}

interface EditorPage {
	title: string;
	source: EditorSource;
	actions: EditorAction[];
}
```

`ContentAPI` holds the client calls for `/api/content/*`. `AgoraAPI` keeps only chat calls.

## Safety

The content layer is the single place where a user-supplied name becomes a path.

- Normalize and validate every name before it reaches `NodeUtil.getPath()`.
- Reject empty names, `.` and `..`, separators where they are not allowed, and control characters.
- Allow relative paths only for libraries that explicitly support directories.
- Resolve the final path and verify it stays under the resource root.
- Limit request body size before decoding.
- Validate the `Host` header before `new URL()`.
- Keep external command strings out of editable settings where possible; prefer a command file or an adapter setting that the settings merge cannot reach.

## Migration

The move is mechanical:

1. Add the `ContentServer` primitives.
2. Move `LibraryUtil` into `ContentServer/Library.ts`.
3. Move `SettingsEditor` and `EditorUtil` into `ContentWebUI/`.
4. Move the `/api/content/*` handlers into `ContentServer/ContentRoutes.ts`.
5. Rewire `ArkUtil`, `ChatUtil`, `ModelUtil`, `TodoUtil`, `PromptUtil`, `MemoryUtil`, and the two attachment workshops.
6. Split `AgoraAPI` into `AgoraAPI` and `ContentAPI`.

No behavior change is required in this phase. The new primitives must reproduce the existing locking, merging, and naming behavior first.