# Prisms

Prisms is a browser control panel for Draw Things image generation. It keeps projects and their history as files, runs generations through `draw-things-cli` or the Draw Things HTTP API, and gives the prompt a small command and wildcard language.

This guide is for using Prisms.

## What It Is

- a prompt box with plain generation commands
- a project list, a queue and a generation history
- import of existing images with their Draw Things metadata
- upscaling through Real-ESRGAN
- presets for repeatable parameter sets
- keyboard-driven selection of generated images

Draw Things does the actual generation. Prisms arranges the parameters, submits jobs, stores the results and shows them.

## Requirements

- Node.js
- Draw Things with `draw-things-cli` available in `PATH` (`brew install draw-things-cli`), or Draw Things running with its HTTP API
- Draw Things model files
- optional: `realesrgan-ncnn-vulkan` and its models for upscaling

The `install.sh` in the repository root can install Node, `draw-things-cli` and the optional upscaler dependencies. Draw Things is installed separately or with `brew install --cask draw-things`.

## First Run

Start the server from the repository root:

```sh
node server/prisms.js
```

Open `http://localhost:8092/ui/`. The bundled Prisms app uses `http://127.0.0.1:8082/ui/` instead.

By default the server listens on port 8092 and expects the Draw Things HTTP API on port 7860. Both can be changed:

```sh
node server/prisms.js --port 8094 --target-port 7861
```

On first start Prisms creates `~/ThinkTank/Prisms` and copies `server/defaults.json` into `~/ThinkTank/Prisms/settings.json`.

> Prisms has no security features yet. Use it on localhost only. See the warning in `ReadMe.md`.

## Settings

Edit `~/ThinkTank/Prisms/settings.json` and reload the page.

```json
{
	"combinedLines": 8,
	"generationMode": "CLI",
	"drawThingsTool": "draw-things-cli",
	"models": {
		"SD-15": {
			"DreamShaper 8.0": "dreamshaper_8.0_f16.ckpt"
		}
	},
	"LoRAs": {
		"SD-15": {
			"Hyper SD-15 8 LoRA": "hyper_sd_15_8_lora_f16.ckpt"
		}
	},
	"controls": {
		"SD-15": {
			"canny": "controlnet_canny_1.x_v1.1_f16.ckpt"
		}
	},
	"samplers": {
		"sampler": {
			"DDIM Normal": "DDIM",
			"DPM++ 2M Karras": "DPM++ 2M Karras"
		}
	},
	"presets": {}
}
```

- `models`, `LoRAs`, `controls` and `samplers` are grouped by category. The displayed name is the key; the stored value is what Draw Things receives.
- Spaces in the displayed name become dashes in commands. `DreamShaper 8.0` is `/model: DreamShaper-8.0`.
- `generationMode` is `CLI` or `HTTP`.
- `drawThingsTool` is the CLI command name or path.
- `combinedLines` sets the height of the combined prompt box.

The Draw Things models are read from `~/ThinkTank/Prisms/Models/DrawThings`. The upscaler uses the `realesrgan-ncnn-vulkan` command from `PATH` and reads its models from `~/ThinkTank/Prisms/Models/RealESRGAN`. Both paths are resolved through the location registry, so either can be moved by adding an entry to `~/.config/think-tank/locations.json`.

## The Combined Prompt

The large prompt box is called the combined prompt. It is both the positive prompt and the script for the generation.

- Plain lines are the positive prompt.
- Lines starting with `-` are the negative prompt.
- Lines starting with `/` are commands.
- Lines starting with `//` are comments.
- Blocks separated by an empty line are separate generations.
- A block without positive text is folded into the previous block.

Example:

```text
a quiet harbour at dawn, soft light
- blurry, text, watermark

/model: DreamShaper-8.0
/size: 1024 768
/steps: 30
a quiet harbour at night
```

This produces two generations with different prompts and settings.

## Wildcards

The prompt is unrolled before it is submitted.

```text
{kitten|cat} and {puppy+dog} friends
```

- `{a|b}` chooses one value at random.
- `{a+b}` produces every combination, one generation per value.
- `{@name=value}` assigns a value to a variable.
- `{@name}` inserts that variable.
- `{5:8:0.5}` walks from 5 to 8 in steps of 0.5.
- `{@num:4}`, `{@word:6}` make random digits or letters.
- `{@i}` is the local block index; `{@n}` is the global generation index.

Because wildcards also expand inside commands, a variable can drive a parameter:

```text
{@model={LOLModel+SADModel}}
/model: {@model}
black hat
- cap
/generate
```

The two special variables `{@source-prompt}` and `{@source-negative}` receive the prompt of the selected source image.

## Commands

Commands start with `/`. The colon after the name is optional.

```text
/model: DreamShaper-8.0
/model DreamShaper-8.0
```

The main commands are:

| Command | Meaning |
| --- | --- |
| `/generate` | run a generation now |
| `/defaults` | reset the parameters to the defaults |
| `/reset` | reset the parameters to the values on page load |
| `/empty` | clear the positive and negative prompt |
| `/model` | choose the base model |
| `/refinerModel` | choose the refiner |
| `/lora` | set a LoRA slot, index, file and weight |
| `/control` | set a control slot, index, file and weight |
| `/sampler` | choose the sampler |
| `/seed` | set or advance the seed |
| `/seedMode` | choose the seed mode |
| `/size` | set width and height |
| `/aspect` | swap the resolution to horizontal or vertical |
| `/enableHiRes` | turn hi-res fix on |
| `/setHiRes` | set hi-res width, height and strength |
| `/disableHiRes` | turn hi-res fix off |

Every scalar generation parameter also has a command with the same name, for example `/steps:`, `/CFG:`, `/shift:`, `/SSS:`, `/strength:`, `/batchCount:`, `/width:` and `/height:`.

A generation runs when a block contains positive text. `/generate` forces one even when the block has none.

## Generating

1. Choose a project, or create one.
2. Set the parameters in the collapsible panels.
3. Write the combined prompt.
4. Press `generate`.

The number of images depends on `batchCount` and on how many combinations the wildcards produce. The server creates one history entry per generation and queues them in order.

If images are selected, they are used as sources. The prompt may refer to `{@source-prompt}` and `{@source-negative}`. The aspect of each source is matched automatically.

## History

The history is shown newest first.

- Click an image to select it.
- Shift-click selects a range.
- `Ctrl` or `Cmd` with a click toggles one image in the selection.
- `Alt` with a click opens the full-screen preview.
- Arrow keys move the selection cursor.
- `Shift` with the arrow keys grows the selection.
- `Ctrl` or `Cmd` with the arrow keys moves the selected images in the project order.
- Space opens the full-screen preview at the selection.
- `Ctrl` or `Cmd` with `Delete` removes the selection.

The selected images also feed `create project`, `assign params` and the upscaler.

## Projects

A project is a folder under `~/ThinkTank/Prisms`. Each project has its own `history.json`, `queue.json` and image files.

- `create project` moves the selected images into a new project. Select at least one image first.
- `rename project` renames the folder.
- `reindex project` renumbers the image files and history entries.
- `import images` adds existing images to the current project.
- dropping image files anywhere on the page also imports them.

Imported images keep the generation parameters that Draw Things wrote into them, so you can continue from an existing picture.

## Parameters

- `copy parameters` puts the current UI parameters on the clipboard as JSON.
- `paste parameters` reads that JSON back into the UI.
- `assign params` writes the current UI parameters onto the selected history entries, so the history matches the parameters you want to keep.
- `save preset` stores the current UI parameters under a name. Loading a preset applies it again.

With one image selected, `assign params` also takes the prompt and seed from the UI. With several images selected, it keeps each image's own prompt and seed and replaces only the remaining parameters.

## Upscaling

1. Select one or more images.
2. Choose an upscaler in `upscale with`.

Prisms runs `realesrgan-ncnn-vulkan` on the source image and adds the result to the history as a new entry.

## Data Layout

```text
~/ThinkTank/Prisms
├── settings.json
├── Models
│   ├── DrawThings
│   └── RealESRGAN
└── <Project>
    ├── history.json
    ├── queue.json
    └── <image files>
```

The project history stores the flattened Draw Things parameters and the image name. The queue is persisted, so a server restart resumes the jobs still waiting in it.

## Keyboard

| Key | Action |
| --- | --- |
| arrow keys | move the selection cursor |
| Shift + arrow keys | grow the selection |
| Ctrl or Cmd + arrow keys | move the selected images |
| Space | full-screen preview |
| Ctrl or Cmd + Delete | remove the selected images |

Keys are ignored while a text field, text area or select is focused.
