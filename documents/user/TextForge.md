# TextForge

TextForge is a small scripting language for moving and transforming text. It runs as a command-line tool and as a local web page. The same script works in both.

This guide is for using TextForge.

## What It Is

- a line-based command language
- channels that hold text, like `stdin`, `main` and `stdout`
- variables and `{{...}}` substitutions
- text operations such as split, merge, replace and clean
- an optional model call through Ollama for rewriting and summarizing

It is useful for prompt processing, batch text cleanup, and turning one text into many chunks.

## First Run

Start the web server from the repository root:

```sh
node server/textforge.js
```

Open `http://localhost:8093/ui/`. The bundled TextForge app uses `http://127.0.0.1:8083/ui/` instead.

The command-line tool runs without a server:

```sh
node tool/textforge.js
```

With no arguments it reads the default script file and then the script from standard input. With arguments it runs the default script and then the commands from the arguments.

The macOS bundler can install a `textforge` command that wraps the bundled tool.

> TextForge has no security features yet. Use it on localhost only. See the warning in `ReadMe.md`.

## Files and Settings

TextForge stores its files under `~/ThinkTank/TextForge`.

```text
~/ThinkTank/TextForge
├── settings.json
├── textforgerc.tf
├── Prompts
└── Scripts
```

`settings.json` is optional. It can define variables, channels and named scripts:

```json
{
	"variables": {
		"Style": "Prompts/Style.md"
	},
	"channels": {
		"main": "Prompts/Start.txt"
	},
	"scripts": {
		"Summarize": "Scripts/Summarize.tf"
	}
}
```

- A variable value is a file path, relative to the TextForge root.
- A channel value is a file path whose text is loaded into that channel before the script runs.
- A script is a file the web page can load into the script box.

`textforgerc.tf` is the default script that the command-line tool always runs first.

## Script Syntax

A script is a sequence of commands. A command name ends with a colon, and its parameters follow.

```text
set: name value
print: {{name}}
```

- Separate commands with newlines or spaces.
- Quote a parameter with `"..."`, `'...'` or `` `...` `` when it contains spaces.
- Start a comment with `//`.
- A command with no parameters uses its defaults.

The command-line form is the same, but the shell handles quoting:

```sh
node tool/textforge.js add: "hello" print: "{{main}}"
```

## Channels

A channel is a queue of text blocks. The standard channels are:

- `stdin` is the input text in the web page or standard input in the CLI.
- `main` is the working text.
- `stdout` is the final output.
- `original` is a copy of the input made by the server before the script runs.

A channel name that contains `/` or `.` is a file path in the CLI. The web server only allows its own channels.

Most commands read from a source channel and write to a target channel. Both default to `main`; the source and target are positional parameters.

```text
read: stdin main
split: 2000 main chunks
print: {{chunks}}
```

## Variables

`set` stores a value:

```text
set: tone calm
print: "The tone is {{tone}}."
```

`{{...}}` looks in variables first, then in channels. `{{main}}` therefore inserts the text of the `main` channel. Some commands also set `index` and `count`.

Variables that affect the model call:

```text
set: model llama3.1
set: temp 0.4
set: numPredict 2048
```

## Commands

### set

```text
set: name value
```

Stores a variable. The value is expanded first.

### print

```text
print: value
```

Writes the value to the output stream.

### add

```text
add: value [target]
```

Appends the value to a channel, by default `main`. The value is written as it is.

### read

```text
read: [source] [target]
```

Copies every block from the source to the target without expanding values. The defaults are `stdin` and `main`.

### write

```text
write: [target] [source]
```

Copies every block from the source to the target and expands variables in each block. The defaults are `stdout` and `main`.

### copy

```text
copy: [target] [source]
```

Copies the source to the target and keeps the text available in the source for later commands. The defaults are `stdout` and `main`.

### split

```text
split: [limit] [source] [target]
```

Breaks the text into blocks of about `limit` characters, default 2000. It prefers to break at a space, a newline, a blank line or a `<split/>` marker, so the blocks stay readable. The source and target default to `main`.

### merge

```text
merge: [separator] [source] [target]
```

Joins the blocks of a channel with a separator, default two newlines.

### replace

```text
replace: pattern replacement [source] [target]
```

Replaces a regular expression globally.

### clean

```text
clean: [source] [target]
```

Normalizes line endings, spacing, quotes, ellipses and dashes, and trims the text. It is meant for text that came from a model or a clipboard.

### process

```text
process: prompt [source] [target]
```

Sends each block to the model with the prompt and writes the answer to the target. The source and target default to `main`.

The model call uses Ollama by default:

```text
set: APIType ollama
set: APIHost http://localhost:11434/api/chat
set: model qwen3.5:9b
```

`process` also reads these variables:

- `limit` is the size of each block sent to the model, default 2000.
- `context` keeps the previous block as context when true, default false.
- `print` streams the model output while it arrives, default true.

The default local endpoint is `http://localhost:11434/api/chat`. Change `APIHost`, `APIKey`, `APIType` and `model` when you use another provider or model.

### run

```text
run: [source]
```

Reads a channel and executes its text as a script. The source defaults to `stdin`. This is how the CLI loads `textforgerc.tf` and how one script can call another.

## Examples

### Summarize each paragraph

```text
set: model llama3.1
split: 1500
process: "Summarize this paragraph, plain text, no formatting."
merge: ", "
print: {{main}}
```

### Replace and clean

```text
read: stdin main
replace: cat dog
clean: main main
print: {{main}}
```

### Use a stored script

```sh
node tool/textforge.js run: "$HOME/ThinkTank/TextForge/Scripts/Summarize.tf"
```

## The Web Page

The page has three boxes:

- the script on top
- the input on the left
- the output on the right

`run` streams the result into the output. `apply` moves the output into the input for another pass. `copy` copies the output. `clear` empties the three boxes. The page remembers them in local storage, and the script list loads the named scripts from `settings.json`.

## The Command Line

```sh
node tool/textforge.js add: "hello" print: "{{main}}"
```

The tool always runs `textforgerc.tf` first, then the arguments. Without arguments it also reads a script from standard input.

A file channel is any name with `/` or `.` in it:

```sh
node tool/textforge.js read: input.txt main print: "{{main}}"
```

The CLI resolves file channels from the current directory. The web server resolves settings files from the TextForge root and does not open arbitrary files from a script.
