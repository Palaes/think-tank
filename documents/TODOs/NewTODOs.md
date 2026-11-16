# New Instructions

## Project Descriptions

Need documents about my common project structuring and building practices, preference of no source deps and stateless servers and minimalist UI.

Runtime deps:
- ollama 0.40.3
- ffmpeg 9.0.2 (assume callable in shell)
- draw-things-cli dev (assume callable in shell)
- draw-things-cli models (download or user install)
- realesrgan-ncnn-vulkan (redistributed)
- realesrgan models (redistributed)

Build deps:
- node 26.10.0
- npm 11.19.1
- tsc 5.3.3

## Source Refactor Ideas

Review the sources of the following folders, then propose refactor ideas.
- `Source/AgoraServer/`
- `Source/AgoraWebUI/`
- `Source/PrismsServer/`
- `Source/PrismsWebUI/`,

A starting point from me:

- Create a separate folder in `Source` for the settings page and all of the direct editing API. It is not really `Config` and not really `Settings`, maybe `ContentManagement`.
- Extract the underlying concepts into that folder, for example:
	- Editing `JSONFiles`
	- Editing `FoldersWithSettings`
	- Editing `RawTextFiles`
	- Editing file and entry mapped `Libraries`
- Unify image storage between Prisms and Agora.
- Extract Prisms draw-things access into `Adapters`.
- Extract the upscaler into `Adapters`.

## New Agora Actions and Features

New actions:

- `@image describe @id=` — also callable from the images settings.
- `@image list @dir=` `[search]` — lists all folders and subfolders and their contents, searching in names, short descriptions and long descriptions.
- `@image view @id=` — inserts the image into the context, resolved in the UI as a thumbnail with a gallery that opens on click, and resolved for the LLM via the current logic.

The same set of actions applies to documents.

Additional features:

- `@image generate` — parses the whole entry, sends a confirmation message, then an image message once complete.
- Document editing.
- Knowledge system — marking documents as knowledge for Arks or Chats adds their content to the system prompt.
- Automatic data inclusion via quick inference:
	- Ask: what is the order of relevance to the current conversation of this set?
	- Include up to a limit.
	- May use a decision model.

## Language Unification

The various syntaxes somehow have to be unified.

Current situation:

- Prompt templates use `{{variable|path}}` substitutions.
- Actions use `@action @param=`.
- LLM-facing metadata uses `[[author= date=]]`.
- The stream uses similar meta tags.
- Prisms has a comprehensive, fairly matured template language with `{@var=}`, `{@var}`, `{@function:}`, `{a|b}` for random selections and `{a+b}` for combinatorial batching, but it does not escape them.
- Prisms uses `/command:` positional arguments.
- Textforge uses `:command` positional arguments (with quote parsing).

Proposed unification for substitutions, in prompts, textforge and the Prisms dynamic prompt:

- `{a|b}`
- `{@var}`
- `{@function: 10}`
- `{@function: a=10 "positional args with quote parsing with escapes"}` — the `:` is actually totally optional.
- `\{escaping should work\}`

Language configurable per task for whether `{a|b}` and `{a+b}` are supported, and which variables and functions are built in. This would serve the combined Prisms prompt and textforge.

Proposed unification for commands:

- `@command: arg "other arg" a=named arg rest of the arg as one string`
- Or maybe it should be `/command:`

This would serve:

- Agora message config parsing (just send `/model: Gemma-cloud`)
- Prisms inline commands and textforge scripts
- Even metadata argument parsing

## Reuse Between Agora and Prisms

A lot of things developed for Agora are probably reusable for Prisms if we adjust Prisms slightly.

## UI Unification

Unify UI elements into better encapsulated widgets that can be reused by all projects.