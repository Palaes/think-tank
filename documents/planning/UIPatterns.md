# UI Patterns

## Principles

- Plain HTML, CSS, and JavaScript. No framework, no template language in the browser, no client-side router.
- The server is the source of truth. The client holds view state and selection state, not business data.
- One page is one small bootstrap plus shared widgets.
- Prefer text labels and a few simple symbols over icon fonts or image assets.
- Keyboard-first where the page is an editor or a gallery.
- Local storage is for view preferences only: sidebar state, collapsed groups, last selection.

## Shared Widgets

The target is a small `Source/Widgets/` layer:

```text
CollapseGroup     collapsible section with a persisted open state
InputDisabler     per-chat busy state with enabled, silenced, and disabled modes
BoundControls     declarative read and apply for form controls
Gallery           thumbnail, full view, next and previous, keyboard navigation
StreamView        parser and renderer for [[...]] stream metadata
SettingsEditor    list, multi-selection, text or image editing, save
```

Widgets are plain classes or namespaces. They receive DOM elements and callbacks; they do not fetch data themselves unless the widget is the page-level editor.

## Declarative Binding

Prisms already has a useful pattern: controls carry `SDTarget` and `SDType`, and one function reads or applies them.

```html
<input
	id="steps"
	type="number"
	SDTarget="steps"
	SDType="int"
/>
```

Generalize this into `BoundControls`:

```typescript
interface BoundControl {
	target: string;
	type: "bool" | "int" | "float" | "string" | "nest";
}

class BoundControls {
	public static collect(root: HTMLElement): BoundControl[];
	public static read(root: HTMLElement, defaults: any): any;
	public static apply(root: HTMLElement, values: any): void;
}
```

Nested targets such as `loras/0/file` stay supported. Avoid a second binding mechanism in the same page.

## Page Structure

A settings page should be:

```html
<body>
	<div id="sidebar">
		<div id="actionsWrapper"></div>
		<div id="editorList"></div>
	</div>
	<div id="main">
		<div id="titlePanel">
			<button id="titleButton">Edit Images</button>
		</div>
		<div id="contentWrapper">
			<textarea id="editorInput" spellcheck="false"></textarea>
		</div>
		<div id="messageWrapper">
			<div id="messagePanel">
				<button id="saveButton">save</button>
			</div>
		</div>
	</div>
	<script src="main.js"></script>
	<script>
		SettingsPage.initialize({ ... });
	</script>
</body>
```

The page supplies a content source and a few named actions. It should not repeat the shell, the selection logic, or the save handling.

## Stream Rendering

The server sends one text stream with inline markers:

```text
[[message role=user name=John time=...]]
content

[[image id=... thumb=... full=...]]
content

[[document id=...]]
content
```

The client parses markers incrementally. A marker split across chunks is held until it closes. Text before a marker belongs to the previous block. A trailing `[` or newline is held because it may become the next marker.

The same parser should serve the chat view, the settings preview, and any future stream consumer. Storage URLs travel in the marker; the view never builds file names.

## Gallery

Images and documents are shown as a thumbnail or a short block. A click opens a gallery view.

```typescript
interface GalleryItem {
	thumb: string;
	full: string;
	label?: string;
	meta?: any;
}

class Gallery {
	public open(items: GalleryItem[], index: number): void;
	public close(): void;
	public next(): void;
	public previous(): void;
}
```

Use it for:

- images inserted into an Agora chat
- the images settings page
- Prisms history
- document previews where a rendered image exists

## Keyboard

- Arrow keys move within a list or gallery.
- Shift extends a selection.
- Ctrl or Meta moves the selected items.
- Space toggles full-screen preview.
- Escape closes the overlay, menu, or gallery.
- Ctrl or Meta with S saves the editor.

Do not override keys while a text input, textarea, or select has focus, except for explicit editor chords.

## CSS

- Shared theme variables and widget styles live under `web/shared/`.
- Page-specific CSS stays small and local.
- Use system fonts and simple borders.
- Responsive behavior is a small number of layout breakpoints, not a grid framework.
- The narrow layout shows one sidebar at a time.
- No decorative animation beyond state transitions that help comprehension.

## Server-Driven URLs

The UI must not encode storage layout. `MessageView` currently builds `/ui/images/<id>-Thumb.jpeg` and `-Full.jpeg`. That breaks as soon as an image has a different extension or a different store.

Stream metadata should carry:

```text
[[image id=2026-09-18-00085 thumb=/ui/images/2026-09-18-00085-Thumb.jpeg full=/ui/images/2026-09-18-00085-Full.png]]
```

Raw uploaded images may keep their base64 content. Stored images use the URLs.

## Minimal State

The client may keep:

- the current selection
- the current chat or project id
- collapsed groups
- sidebar visibility
- the pending stream buffer

The client must not keep:

- the authoritative chat context
- the authoritative settings
- the authoritative image catalogue
- a mirrored queue or schedule

After a reload, the page should reconstruct everything from the server and local view preferences.