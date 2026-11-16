- Redistribute real-esrgan-ncc-vulkan?
- prompts and alerts do not work in the swift app
- Utilize decision models and fast local deciders
- Add memory loading config to settings
- Reduce cost of the whole system
- Provide examples in documentations
- Better organize documentations

- Description of the main message flow (setting based - does it include time, etc)
- Check all defaults writing or perhaps include a starting data folder in the repo
+ Possibly create an install script
- review URI encode trhing
- Description prefix with filename

Look at [AgoraUtil.ts](../../Source/AgoraServer/AgoraUtil.ts)

ProcessUtil should take over here:

ProcessUtil.clear(params, remember):
- if (remember true)
	- saves memories and calls workshop onBlock per block
	- clears contexts
	- calls workshop utils update
- else
	- clears contexts
	- calls workshop utils update
	- removes chat memories

ProcessUtil.delete(params, remember):
- if (remember true)
	- saves memories and calls workshop onBlock per block
	- deletes folder
	- calls workshop utils update
- else
	- deletes folder
	- calls workshop utils update
	- removes chat memories

ProcessUtil.edit(chatID, index, entries):

# Agora TODOs

Empty message handling:
- Solution 1:
	- Send message for empty content too
	- Handle double-new-lin in such cases
- Redesign context concept
	- Group entries sent in one message
	- Lots of collateral code changes

Attachment and result display:
- minimum box size
- maximum box width
- allow multiple attachements next to each other in the UI

- streamInfo and streamError
- add error role to ContextRoles
- handle error roles too

## Agora Server – Models

+ Capability parameters for models
+ Action support params for Arks
- per-model think param dictionary

## Agora Server – Memory

+ Dropping older active memories
- Automatic memory consolidation
	+ Set up scheduling
	- add memory-version or some sort of cleanup book-keeping
	- edit memories in batch to prevent topic bleed-through
	- create prose summary for the very oldest memories
- Save memory tagline to catalogue
- cleaner parsing of generated memory
+ Implement blocked memory mechanism
+ Improve memory recall based on recency and weight
- topic change detection after every user message
	- Insterts tag before entry
	- Generate memory instantly?
	- Keep it combed into context?

## Agora Server – Docs

New actions:
- @doc list
- @doc search regex
- @doc stat ID (lines, words, chars, created, updated)
- @doc read ID
- @doc read ID:Line
- @doc read ID:From:To
- @doc write ID \n text with multiple lines
- @doc write ID:Line \n text with multiple lines
- @doc write ID:From:To \n text with multiple lines
- @dic rename ID new
- negative indices allowed including negativ 0

## Agora Server – Idea

Process wakeup:
- Iterate on items in INBOX
- Move from INBOX to SOURCES
- Detect all topics it fits
	- Use descriptions
	- May create new topic
- Extract the related parts
- Reinterpret for the idea
- Generate new insights
- adds it to the topic
	- ID.txt (in SOURCES)
	- ID-Filtered.txt (in the idea)
	- ID-Reinterpret.txt (in the idea)
	- ID-Insights.txt (in the idea)
- updates idea main documents
	- TOC or structured summary
	- List of sources
	- updated time

Report wakeup:
- new inshights
- dormant ideas

New actions:
- @idea list
- @idea show ID
- @idea rename ID new

## Agora Server – Other

- Random chat wakeup to allow Ark to write
- Limit iteration and wakeup amount
+ Per chat and per Ark configuring
+ Better prompt and chat context creation
+ Two-tier image and document description

Dreaming workshop:
- Schedules dreaming cycles
- chooses random sentences and expressions from memory
- appends them ideas from web shearch based on them
- builds a dream-stroy from those bits and pieces
- creates a final memory from the dream

Canonical ordering:
- message
- image
- document
- result
- memory
- dream
- idea
- todo

## Agora Server – Workshops

- image description insert handling
- attachment upload add info with ID
- document description insert handling
- implement image catalogue corrections
- implement document catalogue corrections
- Do not descript attachments immediately
- Implement promp parts based dynamic prompting
- Implement image and document search action
- Web workshop maxLength and maxCount come from settings
- convertUserEntry is asymmetric to the other forwards
- Implement full-entry-input-actions
- Regex search for TODO workshop too
- Process image as:
	- ID-Large.jpeg with 1536 size
	- ID-Thimb.jpeg with 768 size

Attachment description pipeline:
- uploads are saved with an empty short
	- the chat renders a blank block
	- featch from the server to resolve

## Agora Server – Generation

- improve time meta handling
- ark-time-gap
- user-time-gap
- memory-time-gap
- Time gap settings
- Time zone handling
- resolve parameters in the includes too
	- {{Arks/{{ARK}}/Personality.md}}
	- {{Prompts/{{MODEL}}/Think-{{THINK}}.md}}
	- {{Prompts/Clean-Result.md}}
- always add the full date and time to the last user message

## Agora Server – TODOs

- the TODO workshop should track statistics for insights
- the TODO workshop should move to text based storage

## Agora Server – Architecture

- Namespaces instead of classes
- Check HTML and CSS sources
- Do not lock index key as lastIndex
- Remconsider NodeUtil getPath usage
- Address possible performance issues
- Better error handling all around the project

Group chat implementation:
- maximum number of Ark turns
- member urgency inference
- user hand raising mechanism

## Agora Server – Security

- Sanitize every value that becomes a file name component
	- chatID reaching the chat, ark, and memory paths
	- ext from the document and image upload parsing
	- one toSafeName used at all sinks instead of per-site asserts
- Move image convert commands out of settings into a command file
	- unreachable by the settings endpoint and the combined settings merge
	- detection writes it only when missing, so a hand-edited file survives
- Guard the host header before new URL in startServer
- Limit request body size (decodeAll currently unbounded)

## Agora UI – Settings

+ settings sidebar toggle
- extra system prompt
- icons for model capabilities
- Allow grouping models too
- Custom themes for each Ark

## Agora UI – Other

- Click away while generate should stop streaming
- Check all disable input places
+ Click away should close the settings menu
- better actions status messages

## Going for Namespaces

``` typescript
namespace ImageWorkshop {
	interface Settings {
		enabled: boolean;
		lastIndex: number;
		convertLLMCommand: string;
		convertThumbCommand: string;
		prompt: string;
	}

	interface Entry {
		time: number;
		short: string,
		long: string;
		ext: string;
	}

	const rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Images");
	const settingsPath = `${rootPath}/settings.json`;
	const cataloguePath = `${rootPath}/catalogue.json`;

	const defaults: Settings = {
		enabled: true,
		lastIndex: 0,
		convertLLMCommand: "",
		convertThumbCommand: "",
		prompt: "Describe this image, plain text, no formatting.\n\nUse this template:\n\nShort: [one line summary]\n[detailed description of the image]"
	};

	export async function initialize() {
		const commands = await detectCommands();
		await LibraryUtil.ensure(rootPath, { ...defaults, ...commands });
		await WorkshopUtil.scheduleEvery("image-main", "1d");
	}
}
```