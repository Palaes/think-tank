# Language

## Goal

One language serves four surfaces:

- prompt templates
- the Prisms dynamic prompt
- TextForge scripts
- Agora actions, message configuration, and metadata

The syntax is shared. The dialect is configured per task. A surface only enables the forms it needs.

## Expressions

An expression is a balanced `{...}` region.

```text
{@variable}
{@function: 10}
{@function: a=10 "positional args with quote parsing with escapes"}
{@include: Prompts/Personality.md}
{a|b}
{a+b}
```

The scanner reads left to right and tracks nested braces. It does not use a single regular expression.

### Escaping

- `\{` produces a literal `{`
- `\}` produces a literal `}`
- `\\` produces a literal backslash
- Other backslash sequences are preserved in text and interpreted inside quoted arguments

Escaping must work in prompts, Prisms scripts, and TextForge input.

### Variables and functions

- `{@name}` resolves a variable first.
- If no variable exists, a zero-argument function may resolve.

- `{@name: args}` calls a function.
- `{@name args}` also calls a function when arguments are present.
- The colon is optional.

This supports both:

```text
{@randomDigits: 6}
{@randomDigits 6}
```

The name space is explicit. A dialect registers its variables and functions. An unknown name is an error in strict mode and is left literal otherwise.

### Selection

```text
{a|b|c}
```

The engine chooses one option with the dialect's random source. A seeded random makes a generation reproducible.

Selection is off in prompt templates by default because ordinary prompt text often contains `|`. It is on in the Prisms dynamic prompt.

### Combination

```text
{a+b+c}
```

The engine expands the expression into every combination. This is the Prisms batching form. It is off in ordinary prompts and on in the Prisms dynamic prompt and TextForge where requested.

Nested expressions are expanded before the selection or combination is evaluated.

### Comments

Unmarked `{...}` is literal text by default. This protects ordinary prompts and JSON fragments.

Prisms currently treats any unmatched `{...}` as a comment and logs it. That is a source of destructive surprises. In the unified language:

- `//` at the start of a line is a command-language comment.
- `{# ... #}` is a template comment when the dialect enables it.
- Unmarked braces remain literal.

## Dialects

```typescript
interface LanguageDialect {
	expressions: boolean;
	selections: boolean;
	combinations: boolean;
	commands: boolean;
	legacyDoubleBraces: boolean;
	legacySlashCommands: boolean;
	legacyColonCommands: boolean;
	negativeLines: boolean;
	unmarkedBraces: "literal" | "comment";
}
```

Suggested settings:

```typescript
const promptDialect: LanguageDialect = {
	expressions: true,
	selections: false,
	combinations: false,
	commands: false,
	legacyDoubleBraces: true,
	legacySlashCommands: false,
	legacyColonCommands: false,
	negativeLines: false,
	unmarkedBraces: "literal"
};

const prismsDialect: LanguageDialect = {
	expressions: true,
	selections: true,
	combinations: true,
	commands: true,
	legacyDoubleBraces: false,
	legacySlashCommands: true,
	legacyColonCommands: false,
	negativeLines: true,
	unmarkedBraces: "literal"
};

const textForgeDialect: LanguageDialect = {
	expressions: true,
	selections: false,
	combinations: true,
	commands: true,
	legacyDoubleBraces: true,
	legacySlashCommands: false,
	legacyColonCommands: true,
	negativeLines: false,
	unmarkedBraces: "literal"
};
```

The built-in variable and function tables also come from the dialect. Prompt templates get `ARK`, `USER`, `MODEL`, `THINK`, and `include`. Prisms gets `times`, `for`, `randomDigits`, `randomLetters`, `localIndex`, `globalIndex`, `source-prompt`, and `source-negative`. TextForge gets its state variables and channel functions.

## Commands

Canonical form:

```text
@command: positional "quoted positional" key=value rest of the line
```

The canonical prefix is `@` because Agora already uses it for actions. `/command:` and `:command` remain legacy aliases for Prisms and TextForge during migration.

Rules:

- A command starts at the beginning of a line, after optional whitespace.
- `//` starts a comment.
- A command can take a body. Body lines continue until a blank line or the next command line.
- `-` at the start of a line is the Prisms negative-prompt shorthand only when the dialect enables `negativeLines`.
- `\@` at the start of a line escapes a literal `@`.

Examples:

```text
@image: describe @id=2026-09-18-00085
@image: list @dir=portraits "sunset"
@image: view @id=2026-09-18-00085
@model: Gemma-cloud
@document: write @id=notes/plan @from=10 @to=20
replacement text
```

The first positional value after the command name is the subcommand when the handler is a group:

```text
@image: list ...
```

The action registry therefore maps `image` to a handler that receives `list` as its first positional.

## Arguments

```typescript
interface Arguments {
	positional: string[];
	named: Dict<string>;
	rest: string;
}

class ArgumentParser {
	public static parse(text: string): Arguments;
}
```

Rules:

- Whitespace separates arguments.
- `"..."` and `'...'` group text.
- `\"`, `\'`, `\\`, `\n`, `\t`, and `\s` are recognized inside quoted text.
- `key=value` is a named argument.
- `@key=value` is accepted as an alias for `key=value`.
- A named value may be quoted.
- An empty named value is allowed.
- `rest` is the raw remainder when the command declares that it wants one. Otherwise, quote the value.

The same parser handles action parameters, command arguments, and metadata attributes.

## Metadata

The model-facing and stream-facing metadata keeps the `[[...]]` frame:

```text
[[author=name date=2026-09-18 time=10:30]]
[[message role=user name=John time=1726650000000]]
[[image id=2026-09-18-00085 thumb=... full=...]]
[[document id=notes/plan]]
```

The inside is parsed with the same argument parser. This removes the current ad-hoc `split(/\s+/)` and `indexOf("=")` code in `ContextView.processMeta()`.

Metadata remains a separate frame from commands:

- `@` lines are instructions from the user or the Ark.
- `[[...]]` is structural metadata in the transcript or stream.

Do not overload one as the other.

## Streaming

The stream parser must be incremental:

- hold an incomplete `[[...]]`
- hold a trailing `[` that may become `[[`
- hold a trailing newline that may separate the next metadata block
- unescape `\[`, `\]`, and `\\`
- never read rendered text back from the DOM

The same parser serves the chat view and any preview that consumes a stream.

## Prompt Expansion

The prompt provider supplies:

```typescript
interface TemplateContext {
	variables: Dict<string>;
	functions: Dict<TemplateFunction>;
	random: Random;
	include: (path: string) => Promise<string>;
}

class TemplateEngine {
	public static async expand(text: string, context: TemplateContext, dialect: LanguageDialect): Promise<string[]>;
}
```

The result is an array because combinations can produce more than one variant. A caller that needs one prompt uses the first result or rejects multiple results.

Legacy `{{...}}` forms are normalized during migration:

```text
{{ARK}}                  -> {@ARK}
{{USER}}                 -> {@USER}
{{MODEL}}                -> {@MODEL}
{{THINK}}                -> {@THINK}
{{Prompts/Personality.md}} -> {@include: Prompts/Personality.md}
```

Nested includes work because the expression scanner is balanced and the include resolver runs on the resolved path.

The current `{{...}}` expansion already supports nested includes by repeatedly matching the innermost braces, so a path like `{{Arks/{{ARK}}/Personality.md}}` resolves today. The unified engine must preserve that behavior while adding escaping, a structural scan, dialect control, and protection against replacement text causing an unintended expansion.

## Migration Order

1. Add `ArgumentParser` and use it for `[[...]]` metadata and action arguments.
2. Add `TemplateEngine` and use it for prompt expansion with `legacyDoubleBraces` on.
3. Move Prisms `BasePreprocessor` and `STDPreprocessor` onto the engine with the Prisms dialect.
4. Move Prisms `/command:` parsing onto `CommandLine` with `legacySlashCommands` on.
5. Move TextForge `:command` parsing onto `CommandLine` with `legacyColonCommands` on.
6. Replace the Agora action regex with `CommandLine`.
7. Remove legacy flags one surface at a time after its stored scripts and prompts are migrated.

## Open Decisions

- Canonical named argument spelling: `id=value` or `@id=value`. The parser accepts both; the documents and examples should choose one.
- Canonical command prefix: `@` or `/`. `@` fits the current action syntax.
- Whether zero-argument functions require `{@name:}` to distinguish them from variables.
- Whether `{# ... #}` is needed for template comments, or `//` is enough for the command surfaces.