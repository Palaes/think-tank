/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="../Adapters/ChatAdapter.ts" />

/// <reference path="../AgoraServer/AgoraStreamer.ts" />
/// <reference path="../AgoraServer/ArkUtil.ts" />
/// <reference path="../AgoraServer/ChatUtil.ts" />
/// <reference path="../AgoraServer/ContextUtil.ts" />
/// <reference path="../AgoraServer/GenerateUtil.ts" />
/// <reference path="../AgoraServer/MemoryUtil.ts" />
/// <reference path="../AgoraServer/ModelUtil.ts" />
/// <reference path="../AgoraServer/ParamsUtil.ts" />
/// <reference path="../AgoraServer/ProcessUtil.ts" />

/// <reference path="../ContentServer/LibraryUtil.ts" />
/// <reference path="./ImageWorkshop.ts" />

interface IdeaSettings {
	enabled: boolean;
	assignedArk: string;
	selectPrompt: string;
	summaryPrompt: string;
	contemplatePrompt: string;
	entryPrompt: string;
	selectModel?: string;
	summaryModel?: string;
	contemplateModel?: string;
	itemsPerWake: number;
	thinkCount: number;
	deferred: string[];
	lastIndex?: number;
	defaultChat?: string;
}

interface IdeaWorkshopInfo {
	name: string;
	entries: string[];
}

interface IdeaCatalogueEntry {
	time: number;
	kind: string;
	source?: string;
	turns?: number;
	title?: string;
	short?: string;
	long?: string;
	images?: string[];
}

interface IdeaCatalogue {
	created: number;
	lastIndex: number;
	lastExcerptIndex?: number;
	lastNoteIndex?: number;
	entries: Dict<IdeaCatalogueEntry>;
}

interface IdeaTimes {
	created: number;
	first: number;
	last: number;
}

interface IdeaInboxItem {
	name: string;
	path: string;
	baseName: string;
	time: number;
}

interface IdeaInboxResult {
	selected: string[];
	report: string;
	remove: boolean;
	categorization: string;
}

interface IdeaSelection {
	selected: string[];
	response: string;
}

interface IdeaUpdateResult {
	report: string;
}

interface IdeaEntryDescription {
	title: string;
	short: string;
	long: string;
}

interface IdeaOccurrence {
	idea: string;
	key: string;
	entry: IdeaCatalogueEntry;
}

interface IdeaWebResult {
	action: string;
	args: string;
	result: string;
}

namespace IdeaWorkshop {
	export const rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Ideas");
	export const inboxPath = NodeUtil.getPath(rootPath, "INBOX");
	export const settingsPath = NodeUtil.getPath(rootPath, "settings.json");

	export const defaultSettings: IdeaSettings = {
		enabled: true,
		assignedArk: "",
		selectPrompt: "Classify whether the provided text relates to each topic below.\nOutput exactly one line per topic, no other text:\nTopicName: true or TopicName: false\n\nTOPICS:\n\n{{topics}}\n\nEXCERPT:\n\n{{excerpt}}",
		summaryPrompt: "Summarize the following text, plain text, no formatting.\n\n{{content}}",
		contemplatePrompt: "Contemplate on the following ideas, free but grounded associations.\n\nIDEAS:\n\n{{ideas}}",
		entryPrompt: "Describe this material, plain text, no formatting.\nUse this template:\n\nTitle: [short title]\nShort: [one line summary]\n[detailed description]",
		itemsPerWake: 3,
		thinkCount: 1,
		deferred: [],
		defaultChat: null
	};

	export function getActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		if (params.idea.enabled) {
			return {
				idea: {
					create: createAction,
					list: listAction,
					details: detailsAction,
					update: updateAction,
					contemplate: contemplateAction,
					delete: deleteAction,
					move: moveAction,
					copy: copyAction
				}
			};
		}
		return {};
	}

	export async function initialize(): Promise<void> {
		await NodeUtil.makeDirPromise(IdeaWorkshop.rootPath, { recursive: true });
		const settings: any = await SettingsUtil.ensure(IdeaWorkshop.settingsPath, IdeaWorkshop.defaultSettings);
		delete settings.prompt;
		await FileUtil.writeJSONLocked(IdeaWorkshop.settingsPath, settings);
		await NodeUtil.makeDirPromise(IdeaWorkshop.inboxPath, { recursive: true });
		await syncInboxIndex();
		await migrateDescriptions();
		await migrateCatalogueIndexes();
		await WorkshopUtil.scheduleEvery("idea-main", "1h");
	}

	// Existing ideas keep their short seed text in summary.txt, so it becomes the description.
	async function migrateDescriptions(): Promise<void> {
		for (const name of await IdeaWorkshop.listIdeaNames()) {
			const entries = await IdeaWorkshop.readEntries(name);
			if (Object.keys(entries).length) {
				continue;
			}
			const description = IdeaWorkshop.descriptionPath(name);
			if (await FileUtil.exists(description)) {
				continue;
			}
			const summary = IdeaWorkshop.summaryPath(name);
			if (await FileUtil.exists(summary) == false) {
				continue;
			}
			const content = await FileUtil.readTextLocked(summary);
			const trimmed = content?.trim();
			if (trimmed == null || trimmed == "" || trimmed.includes("\n") || trimmed.length > 500) {
				continue;
			}
			try {
				await NodeUtil.renamePromise(summary, description);
			} catch (error) {
				console.warn(error);
			}
		}
	}

	// Every idea keeps its own excerpt and note counters beside its entries.
	async function migrateCatalogueIndexes(): Promise<void> {
		for (const name of await IdeaWorkshop.listIdeaNames()) {
			const catalogue = await IdeaWorkshop.readCatalogue(name);
			const excerptIndex = Math.max(catalogue.lastExcerptIndex ?? 0, IdeaWorkshop.getEntryIndexMax(catalogue.entries, "excerpt"));
			const noteIndex = Math.max(catalogue.lastNoteIndex ?? 0, IdeaWorkshop.getEntryIndexMax(catalogue.entries, "note"));
			if (catalogue.lastExcerptIndex == excerptIndex && catalogue.lastNoteIndex == noteIndex) {
				continue;
			}
			catalogue.lastExcerptIndex = excerptIndex;
			catalogue.lastNoteIndex = noteIndex;
			await IdeaWorkshop.writeCatalogue(name, catalogue);
		}
	}

	// Keeps the shared counter above every existing inbox name, old catalogue included.
	async function syncInboxIndex(): Promise<void> {
		const settingsPath = IdeaWorkshop.settingsPath;
		const raw = await FileUtil.readJSONRAW(settingsPath) ?? {};
		let lastIndex = Number(raw.lastIndex) || 0;
		const oldPath = NodeUtil.getPath(IdeaWorkshop.rootPath, "catalogue.json");
		if (await FileUtil.exists(oldPath)) {
			const old = await FileUtil.readJSONRAW(oldPath);
			if (old?.lastIndex) {
				lastIndex = Math.max(lastIndex, Number(old.lastIndex) || 0);
			}
		}
		for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.inboxPath)) {
			const match = name.match(/-(\d+)\.txt$/);
			if (match) {
				lastIndex = Math.max(lastIndex, Number(match[1]));
			}
		}
		if (typeof raw.lastIndex != "number" || raw.lastIndex != lastIndex) {
			raw.lastIndex = lastIndex;
			await FileUtil.writeJSONLocked(settingsPath, raw);
		}
	}

	export async function readSettings(): Promise<IdeaSettings> {
		return SettingsUtil.read(IdeaWorkshop.settingsPath, IdeaWorkshop.defaultSettings);
	}

	export async function editSettings(overrides: Partial<IdeaSettings>): Promise<IdeaSettings> {
		return SettingsUtil.edit(IdeaWorkshop.settingsPath, overrides, IdeaWorkshop.defaultSettings);
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		if (params.idea.enabled == false) {
			return [];
		}
		return [{
			variable: "ACTIONS",
			description: "Idea actions",
			content: `Idea Actions:
Create an idea:
@idea-create name=Name <description>
List ideas:
@idea-list
Show idea details:
@idea-details name=Name
Run an idea update:
@idea-update [sort=count] [contemplate=count]
Contemplate an idea:
@idea-contemplate name=Name
Delete an idea:
@idea-delete name=Name
Move an entry:
@idea-move from=<Idea|INBOX> item=entry-name to=<Idea|INBOX>
File an INBOX item:
@idea-move from=INBOX item=INBOX-name to=TargetIdea,Idea2
Copy an entry:
@idea-copy from=<Idea|INBOX> item=entry-name to=<Idea|INBOX>
Copy an INBOX item:
@idea-copy from=INBOX item=INBOX-name to=TargetIdea,Idea2`
		}];
	}

	export async function onUpdate(params: CombinedParams, context: ContextEntry[]): Promise<void> {
		// TODO: Nothing to observe yet, the active idea update lands here.
	}

	// Saves the whole block as one dense transcript, filed later by the wakeup.
	export async function onBlock(params: CombinedParams, block: ContextEntry[]): Promise<void> {
		const filtered = block.filter(entry => {
			if (entry.role == "env" || entry.role == "info") {
				if (entry.name == "idea") {
					return false;
				}
				if (entry.name.startsWith("idea-")) {
					return false;
				}
				return true;
			}
			if (entry.role == "user" && entry.content.trim().startsWith("@idea ")) {
				return false;
			}
			return true;
		});
		if (filtered.length == 0) {
			return;
		}
		const preserved = await preserveBlockImages(filtered);
		const { year, month, day, padded } = await LibraryUtil.nextParts(IdeaWorkshop.settingsPath);
		const name = `${year}-${month}-${day}-${padded}`;
		const content = ContextUtil.contextToText(preserved, ContextUtil.archiveTemplate, Infinity);
		const thoughtPath = NodeUtil.getPath(IdeaWorkshop.inboxPath, `${name}.txt`);
		await FileUtil.writeTextLocked(thoughtPath, content);
	}

	// Raw image data cannot sit in the inbox text, so it moves into the image library.
	async function preserveBlockImages(entries: ContextEntry[]): Promise<ContextEntry[]> {
		const result = [];
		for (const entry of entries) {
			if (entry.type == "image" && entry.name == "raw") {
				if (entry.content.trim() == "") {
					continue;
				}
				const ext = ImageWorkshop.detectExt(entry.content);
				const name = await ImageWorkshop.saveUpload(ext, entry.content);
				result.push({ ...entry, name, content: "An uploaded image." });
			} else {
				result.push(entry);
			}
		}
		return result;
	}

	export async function onDelete(params: CombinedParams): Promise<void> {
		// TODO: Nothing to observe yet, the active idea removal lands here.
	}

	// Called by the shared scheduler, anchored to its stored schedule.
	export async function onWakeUp(params: any): Promise<void> {
		const settings = await IdeaWorkshop.readSettings();
		await IdeaWorkshop.runUpdate(settings, "IdeaWorkshop", null, null, false);
	}

	export async function createAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const parsed = IdeaWorkshop.parseNamedArgs(args);
		if (parsed.name == null || parsed.rest == "") {
			return IdeaWorkshop.infoEntry("Usage: @idea-create name=Name <description>");
		}
		const name = await IdeaWorkshop.createIdea(parsed.name, parsed.rest);
		if (name == null) {
			return IdeaWorkshop.infoEntry(`Idea ${parsed.name} already exists.`);
		}
		return IdeaWorkshop.infoEntry(`Created idea: ${name}\n${parsed.rest}`);
	}

	export async function listAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const names = await IdeaWorkshop.listIdeaNames();
		if (names.length == 0) {
			return IdeaWorkshop.resultEntry("idea-list", "There are no ideas.");
		}
		const parts = [];
		for (const name of names) {
			const summary = await IdeaWorkshop.readSummary(name);
			const description = await IdeaWorkshop.readDescriptionFile(name);
			parts.push(`${name}:\n${summary?.trim() || description?.trim() || "No summary yet."}`);
		}
		return IdeaWorkshop.resultEntry("idea-list", parts.join("\n\n"));
	}

	export async function detailsAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const parsed = IdeaWorkshop.parseNamedArgs(args);
		const name = parsed.name ?? IdeaWorkshop.sanitizeName(parsed.rest);
		if (name == null) {
			return IdeaWorkshop.infoEntry("Usage: @idea-details name=Name");
		}
		if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name)) == false) {
			return IdeaWorkshop.infoEntry(`Idea ${name} does not exist.`);
		}
		const content = await IdeaWorkshop.buildIdeaContent(name, true);
		return IdeaWorkshop.resultEntry("idea-details", content);
	}

	// Runs the same wakeup on demand, thinking with the ark of the current chat.
	export async function updateAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const fields = { sort: null, contemplate: null };
		TextUtil.parseMetaFields((args ?? "").trim(), fields);
		const sort = IdeaWorkshop.parseCount(fields.sort);
		const contemplate = IdeaWorkshop.parseCount(fields.contemplate);
		const result = await IdeaWorkshop.runUpdate(params.idea, params.chatID, params.process.arkName, params.handler, true, sort, contemplate);
		if (result.report) {
			return IdeaWorkshop.resultEntry("idea-report", result.report);
		}
		return IdeaWorkshop.infoEntry("Idea update finished with nothing to report.");
	}

	// Explicitly contemplates one idea, bypassing the automatic selection rules.
	export async function contemplateAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const parsed = IdeaWorkshop.parseNamedArgs(args);
		const name = parsed.name ?? IdeaWorkshop.sanitizeName(parsed.rest);
		if (name == null) {
			return IdeaWorkshop.infoEntry("Usage: @idea-contemplate name=Name");
		}
		if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name)) == false) {
			return IdeaWorkshop.infoEntry(`Idea ${name} does not exist.`);
		}
		const arkName = await IdeaWorkshop.resolveArkName(params.idea, params.process.arkName);
		if (arkName == null) {
			return IdeaWorkshop.infoEntry("No ark is available for contemplation.");
		}
		const silentID = `idea-contemplate-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const silent = new AgoraStreamer(silentID, null);
		try {
			const base = await ParamsUtil.getBaseParams(params.chatID, silent);
			const report = await IdeaWorkshop.runContemplation(base, arkName, [ name ], params.handler);
			return IdeaWorkshop.resultEntry("idea-report", report);
		} finally {
			AgoraStreamer.end(silentID);
		}
	}

	export async function deleteAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const parsed = IdeaWorkshop.parseNamedArgs(args);
		const name = parsed.name ?? IdeaWorkshop.sanitizeName(parsed.rest);
		if (name == null) {
			return IdeaWorkshop.infoEntry("Usage: @idea-delete name=Name");
		}
		if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name)) == false) {
			return IdeaWorkshop.infoEntry(`Idea ${name} does not exist.`);
		}
		await IdeaWorkshop.removeIdea(name);
		return IdeaWorkshop.resultEntry("idea-delete", `Deleted idea ${name}.`);
	}

	// Moves an entry between an idea and INBOX, or between ideas, removing every occurrence of it.
	// With from=INBOX, it files that specific INBOX item into the named target ideas.
	export async function moveAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		return await transferAction(params, args, true);
	}

	// Copies an entry between an idea and INBOX, or between ideas, keeping every existing occurrence.
	export async function copyAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		return await transferAction(params, args, false);
	}

	async function transferAction(params: CombinedParams, args: string, removeSource: boolean): Promise<ContextEntry> {
		const fields: Dict<string> = { from: null, to: null, item: null, name: null, entry: null };
		TextUtil.parseMetaFields((args ?? "").trim(), fields);
		const command = removeSource ? "@idea-move" : "@idea-copy";
		const from = (fields["from"] ?? fields["name"])?.trim();
		const to = fields["to"]?.trim();
		const item = (fields["item"] ?? fields["entry"])?.trim();
		if (from == null || to == null || item == null || item == "") {
			return IdeaWorkshop.infoEntry(`Usage: ${command} from=<Idea|INBOX> item=entry-name to=<Idea|INBOX>`);
		}
		if (from == "INBOX") {
			if (to == "INBOX") {
				return IdeaWorkshop.infoEntry(`Cannot transfer INBOX item ${item} to INBOX.`);
			}
			return await IdeaWorkshop.transferInboxItem(params, item, to, removeSource);
		}
		const source = IdeaWorkshop.sanitizeName(from);
		if (source == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(source)) == false) {
			return IdeaWorkshop.infoEntry(`Idea ${from} does not exist.`);
		}
		if (to == "INBOX") {
			return await transferToInbox(params, source, item, removeSource);
		}
		const target = IdeaWorkshop.sanitizeName(to);
		if (target == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(target)) == false) {
			return IdeaWorkshop.infoEntry(`Idea ${to} does not exist.`);
		}
		return await transferIdeaEntry(params, source, target, item, removeSource);
	}

	async function transferIdeaEntry(params: CombinedParams, from: string, to: string, key: string, removeSource: boolean): Promise<ContextEntry> {
		const entries = await IdeaWorkshop.readEntries(from);
		if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
			return IdeaWorkshop.infoEntry(`Idea ${from} has no entry ${key}.`);
		}
		const entryData = entries[key];
		const source = entryData.source ?? key;
		const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(from, key));
		if (content == null) {
			return IdeaWorkshop.infoEntry(`Entry ${key} file is missing.`);
		}
		if (removeSource) {
			const targetEntries = await IdeaWorkshop.readEntries(to);
			if (Object.prototype.hasOwnProperty.call(targetEntries, key) && (targetEntries[key].source ?? key) != source) {
				return IdeaWorkshop.infoEntry(`Idea ${to} already has entry ${key}.`);
			}
			const occurrences = await findOccurrences(source, key);
			const affected = [];
			for (const occurrence of occurrences) {
				await removeOccurrence(occurrence);
				if (affected.includes(occurrence.idea) == false) {
					affected.push(occurrence.idea);
				}
			}
			await writeEntryTo(to, key, entryData, content);
			if (affected.includes(to) == false) {
				affected.push(to);
			}
			const updated = await IdeaWorkshop.regenerateSummaries(params, affected, params.handler);
			const parts = [ `Moved ${key}:`, `Copied to ${to}: ${await IdeaWorkshop.getIdeaShort(to)}` ];
			for (const idea of affected) {
				if (idea != to) {
					parts.push(`Removed from ${idea}: ${key}`);
				}
			}
			if (updated.length) {
				parts.push(`Summary updated: ${updated.join(", ")}`);
			}
			return IdeaWorkshop.resultEntry("idea-move", parts.join("\n"));
		}
		const targetEntries = await IdeaWorkshop.readEntries(to);
		for (const targetKey in targetEntries) {
			if (targetKey == key || targetEntries[targetKey].source == source) {
				return IdeaWorkshop.infoEntry(`Idea ${to} already has this entry.`);
			}
		}
		await writeEntryTo(to, key, entryData, content);
		const updated = await IdeaWorkshop.regenerateSummaries(params, [ to ], params.handler);
		const parts = [ `Copied ${key}:`, `Copied to ${to}: ${await IdeaWorkshop.getIdeaShort(to)}` ];
		if (updated.length) {
			parts.push(`Summary updated: ${updated.join(", ")}`);
		}
		return IdeaWorkshop.resultEntry("idea-copy", parts.join("\n"));
	}

	// The entry text goes back to INBOX as a plain file, without its catalogue metadata.
	async function transferToInbox(params: CombinedParams, from: string, key: string, removeSource: boolean): Promise<ContextEntry> {
		const entries = await IdeaWorkshop.readEntries(from);
		if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
			return IdeaWorkshop.infoEntry(`Idea ${from} has no entry ${key}.`);
		}
		const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(from, key));
		if (content == null) {
			return IdeaWorkshop.infoEntry(`Entry ${key} file is missing.`);
		}
		const name = `${NodeUtil.path.basename(key)}.txt`;
		await FileUtil.writeTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, name), content);
		if (removeSource) {
			await removeOccurrence({ idea: from, key, entry: entries[key] });
		}
		const updated = removeSource ? await IdeaWorkshop.regenerateSummaries(params, [ from ], params.handler) : [];
		const parts = [ `${removeSource ? "Moved" : "Copied"} ${key} to INBOX:`, `File: ${name}` ];
		if (updated.length) {
			parts.push(`Summary updated: ${updated.join(", ")}`);
		}
		return IdeaWorkshop.resultEntry(removeSource ? "idea-move" : "idea-copy", parts.join("\n"));
	}

	export async function transferInboxItem(params: CombinedParams, itemName: string, targetList: string, removeSource: boolean): Promise<ContextEntry> {
		const clean = IdeaWorkshop.sanitizeInboxName(itemName.endsWith(".txt") ? itemName : `${itemName}.txt`);
		const command = removeSource ? "@idea-move" : "@idea-copy";
		if (clean == null) {
			return IdeaWorkshop.infoEntry(`Usage: ${command} from=INBOX item=INBOX-name to=TargetIdea,Idea2`);
		}
		const targets = [];
		for (const name of (targetList ?? "").split(",")) {
			const target = IdeaWorkshop.sanitizeName(name);
			if (target && targets.includes(target) == false) {
				targets.push(target);
			}
		}
		if (targets.length == 0) {
			return IdeaWorkshop.infoEntry(`Usage: ${command} from=INBOX item=INBOX-name to=TargetIdea,Idea2`);
		}
		for (const target of targets) {
			if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(target)) == false) {
				return IdeaWorkshop.infoEntry(`Idea ${target} does not exist.`);
			}
		}
		const content = await IdeaWorkshop.readInbox(clean);
		if (content == null || content.trim() == "") {
			return IdeaWorkshop.infoEntry(`INBOX item ${clean} is empty or missing.`);
		}
		const images = await IdeaWorkshop.readInboxImages(content);
		const baseName = clean.slice(0, -4);
		const item: IdeaInboxItem = { name: clean, path: NodeUtil.getPath(IdeaWorkshop.inboxPath, clean), baseName, time: Date.now() };
		if (params.handler) {
			params.handler.streamInfo(`Describing ${baseName}:`);
		}
		const description = await IdeaWorkshop.describeItem(params, content, images);
		const excerpt = images.length ? `${content}\n\n${description.long}` : content;
		const affected = [];
		const removed = [];
		if (removeSource) {
			for (const occurrence of await findOccurrences(baseName, null)) {
				await removeOccurrence(occurrence);
				if (removed.includes(occurrence.idea) == false) {
					removed.push(occurrence.idea);
				}
				if (affected.includes(occurrence.idea) == false) {
					affected.push(occurrence.idea);
				}
			}
		}
		const keys = [];
		const copied = [];
		const skipped = [];
		for (const target of targets) {
			const key = await IdeaWorkshop.addExcerpt(target, excerpt, baseName, description, images);
			if (key) {
				keys.push(key);
				copied.push(target);
				if (affected.includes(target) == false) {
					affected.push(target);
				}
			} else {
				skipped.push(target);
			}
		}
		if (removeSource) {
			await IdeaWorkshop.removeInbox(clean);
		}
		const updated = await IdeaWorkshop.regenerateSummaries(params, affected, params.handler);
		const parts = [ await IdeaWorkshop.buildMoveReport(item, description, copied, keys, removeSource ? "Moved" : "Copied") ];
		for (const idea of removed) {
			if (copied.includes(idea) == false) {
				parts.push(`Removed from ${idea}: ${baseName}`);
			}
		}
		for (const idea of skipped) {
			parts.push(`Already present in ${idea}`);
		}
		if (updated.length) {
			parts.push(`Summary updated: ${updated.join(", ")}`);
		}
		return IdeaWorkshop.resultEntry(removeSource ? "idea-move" : "idea-copy", parts.join("\n"));
	}

	async function findOccurrences(source: string, key: string): Promise<IdeaOccurrence[]> {
		const result = [];
		for (const idea of await IdeaWorkshop.listIdeaNames()) {
			const entries = await IdeaWorkshop.readEntries(idea);
			for (const current in entries) {
				const entry = entries[current];
				if (entry.source == source || (key != null && current == key)) {
					result.push({ idea, key: current, entry });
				}
			}
		}
		return result;
	}

	async function removeOccurrence(occurrence: IdeaOccurrence): Promise<void> {
		await LibraryUtil.removeEntry(IdeaWorkshop.ideaCataloguePath(occurrence.idea), occurrence.key);
		try {
			await NodeUtil.removePromise(IdeaWorkshop.entryPath(occurrence.idea, occurrence.key));
		} catch {
			// the file may be gone already
		}
	}

	async function writeEntryTo(idea: string, key: string, entry: IdeaCatalogueEntry, content: string): Promise<void> {
		await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(idea, key), content);
		await LibraryUtil.setEntry(IdeaWorkshop.ideaCataloguePath(idea), key, entry);
		await IdeaWorkshop.syncEntryIndex(idea, key);
	}

	// Handles the inbox, then lets the settled ideas be contemplated.
	export async function runUpdate(settings: IdeaSettings, settingsChatID: string, arkName: string, infoHandler: AgoraStreamer, manual: boolean, sort: number = null, contemplate: number = null): Promise<IdeaUpdateResult> {
		if (settings.enabled == false) {
			if (infoHandler) {
				infoHandler.streamInfo("Idea workshop is disabled.");
			}
			return { report: "" };
		}
		const silentID = `idea-workshop-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const silent = new AgoraStreamer(silentID, null);
		try {
			const params = await ParamsUtil.getBaseParams(settingsChatID || "IdeaWorkshop", silent);
			const streamed = infoHandler ? { ...params, handler: infoHandler } : params;
			const count = Math.max(0, sort ?? settings.itemsPerWake ?? IdeaWorkshop.defaultSettings.itemsPerWake);
			const workshop = await IdeaWorkshop.readSettings();
			const deferred = new Set(workshop.deferred ?? []);
			const originalDeferred = Array.from(deferred).join("\n");
			const items = await IdeaWorkshop.listInbox(count, Array.from(deferred));
			const reports: string[] = [];
			if (items.length && infoHandler) {
				infoHandler.streamInfo(`Checking ${items.length} INBOX item(s):`);
			}
			for (const item of items) {
				const result = await IdeaWorkshop.processInboxItem(streamed, item, infoHandler);
				if (result.remove) {
					await NodeUtil.removePromise(item.path);
					deferred.delete(item.baseName);
				} else {
					await IdeaWorkshop.deferInboxItem(item.path);
					deferred.add(item.baseName);
				}
				if (result.report) {
					reports.push(result.report);
				}
				if (result.remove && result.selected.length) {
					const updated = await IdeaWorkshop.regenerateSummaries(params, result.selected, infoHandler);
					if (updated.length && result.report) {
						reports[reports.length - 1] += `\nSummary updated: ${updated.join(", ")}`;
					}
				}
			}
			const updatedDeferred = Array.from(deferred);
			if (updatedDeferred.join("\n") != originalDeferred) {
				await IdeaWorkshop.editSettings({ deferred: updatedDeferred });
			}
			const thinkCount = Math.floor(Math.max(0, contemplate ?? settings.thinkCount ?? IdeaWorkshop.defaultSettings.thinkCount));
			if (thinkCount > 0) {
				const selected = await IdeaWorkshop.selectContemplation(manual, thinkCount);
				if (selected.length) {
					const thinker = await IdeaWorkshop.resolveArkName(settings, arkName);
					if (thinker) {
						const report = await IdeaWorkshop.runContemplation(params, thinker, selected, infoHandler);
						reports.push(report);
					} else if (infoHandler) {
						infoHandler.streamInfo("No ark is available for contemplation.");
					}
				}
			}
			const report = reports.join("\n\n");
			if (manual == false && report) {
				await IdeaWorkshop.sendReport(settings, report);
			}
			return { report };
		} finally {
			AgoraStreamer.end(silentID);
		}
	}

	// Files one INBOX item right away, without waiting for the scheduled wakeup.
	export async function sortInboxItem(name: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeInboxName(name);
		if (clean == null) {
			return null;
		}
		const path = NodeUtil.getPath(IdeaWorkshop.inboxPath, clean);
		const settings = await IdeaWorkshop.readSettings();
		if (settings.enabled == false || await FileUtil.exists(path) == false) {
			return null;
		}
		const silentID = `idea-sort-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const silent = new AgoraStreamer(silentID, null);
		try {
			const params = await ParamsUtil.getBaseParams("IdeaWorkshop", silent);
			const baseName = clean.slice(0, -4);
			const item: IdeaInboxItem = { name: clean, path, baseName, time: Date.now() };
			const result = await IdeaWorkshop.processInboxItem(params, item, null);
			const current = settings.deferred ?? [];
			const deferred = current.filter(entry => entry != baseName);
			if (result.remove) {
				await NodeUtil.removePromise(path);
				if (result.selected.length) {
					await IdeaWorkshop.regenerateSummaries(params, result.selected, null);
				}
			} else {
				await IdeaWorkshop.deferInboxItem(path);
				deferred.push(baseName);
			}
			if (current.join("\n") != deferred.join("\n")) {
				await IdeaWorkshop.editSettings({ deferred });
			}
			return result.report;
		} finally {
			AgoraStreamer.end(silentID);
		}
	}

	export async function runContemplation(params: CombinedParams, arkName: string, names: string[], infoHandler: AgoraStreamer): Promise<string> {
		if (infoHandler) {
			for (const name of names) {
				infoHandler.streamInfo(`Contemplating on ${name}: ${await IdeaWorkshop.getIdeaShort(name)}`);
			}
		}
		const result = await IdeaWorkshop.contemplate(params, arkName, names, infoHandler);
		if (result.note.trim() == "") {
			return `Contemplation of ${names.join(", ")} produced no note.`;
		}
		const streamed = infoHandler ? { ...params, handler: infoHandler } : params;
		if (infoHandler) {
			infoHandler.streamInfo("Describing note:");
		}
		const description = await IdeaWorkshop.describeItem(streamed, result.note);
		const keys = await IdeaWorkshop.saveNote(names, result.note, result.turns, description);
		const updated = await IdeaWorkshop.regenerateSummaries(params, names, infoHandler);
		const parts = [];
		for (let i = 0; i < keys.length; ++i) {
			parts.push(`Saved note ${keys[i]} to ${names[i]}:\nName: ${description.title}\nShort: ${description.short}\nLong: ${description.long}`);
		}
		if (updated.length) {
			parts.push(`Summary updated: ${updated.join(", ")}`);
		}
		return parts.join("\n");
	}

	export async function processInboxItem(params: CombinedParams, item: IdeaInboxItem, infoHandler: AgoraStreamer): Promise<IdeaInboxResult> {
		const content = await FileUtil.readTextLocked(item.path);
		if (content == null || content.trim() == "") {
			return { selected: [], report: null, remove: true, categorization: null };
		}
		const images = await IdeaWorkshop.readInboxImages(content);
		if (infoHandler) {
			infoHandler.streamInfo(`Matching ${item.baseName}:`);
		}
		const names = await IdeaWorkshop.listIdeaNames();
		if (names.length == 0) {
			return { selected: [], report: await IdeaWorkshop.buildClarificationReport(item, content), remove: false, categorization: "no ideas" };
		}
		const topics = await IdeaWorkshop.buildTopics(names);
		// An image is described first so its content can guide the selection.
		let description: IdeaEntryDescription = null;
		if (images.length) {
			if (infoHandler) {
				infoHandler.streamInfo(`Describing ${item.baseName}:`);
			}
			description = await IdeaWorkshop.describeItem(params, content, images);
		}
		const excerpt = description ? `${content}\n\n${description.long}` : content;
		const selection = await IdeaWorkshop.selectTopics(params, topics, excerpt, names);
		const categorization = selection.response.trim() || "no output";
		if (selection.selected.length == 0) {
			return { selected: [], report: await IdeaWorkshop.buildClarificationReport(item, excerpt), remove: false, categorization };
		}
		if (description == null) {
			if (infoHandler) {
				infoHandler.streamInfo(`Describing ${item.baseName}:`);
			}
			description = await IdeaWorkshop.describeItem(params, content, images);
		}
		const keys = [];
		for (const name of selection.selected) {
			keys.push(await IdeaWorkshop.addExcerpt(name, excerpt, item.baseName, description, images));
		}
		return { selected: selection.selected, report: await IdeaWorkshop.buildMoveReport(item, description, selection.selected, keys), remove: true, categorization };
	}

	export async function selectTopics(params: CombinedParams, topics: string, excerpt: string, names: string[]): Promise<IdeaSelection> {
		const fields: Dict<DescriptionField> = {};
		for (const name of names) {
			fields[name] = { name, description: "true or false" };
		}
		const prompt = await IdeaWorkshop.composePrompt(params, IdeaWorkshop.resolveSelectPrompt(params.idea), { topics, excerpt }, fields);
		const model = IdeaWorkshop.resolveIdeaModel(params, params.idea.selectModel, params.generate.mainModel);
		const response = await GenerateUtil.generateRaw(params, model, [ { role: "user", content: prompt } ]);
		const selected = IdeaWorkshop.parseSelection(response, names);
		return { selected, response };
	}

	export async function buildTopics(names: string[]): Promise<string> {
		const lines = [];
		for (const name of names) {
			const description = await IdeaWorkshop.readDescriptionFile(name);
			const text = TextUtil.shortifyLineNicely((description ?? "").replace(/\s+/g, " ").trim(), 500);
			lines.push(`${name}: ${text || "No description yet."}`);
		}
		return lines.join("\n");
	}

	// Image entries are archived as plain [image name] lines.
	export function parseInboxImages(content: string): string[] {
		const result = [];
		const matches = content.matchAll(/^\[image (.+)\]$/gm);
		for (const match of matches) {
			const name = match[1].trim();
			if (result.includes(name) == false) {
				result.push(name);
			}
		}
		return result;
	}

	export async function readInboxImages(content: string): Promise<string[]> {
		const result = [];
		for (const name of IdeaWorkshop.parseInboxImages(content)) {
			const entry = await LibraryUtil.getEntry<ImageCatalogueEntry>(ImageWorkshop.cataloguePath, name);
			if (entry) {
				result.push(name);
			}
		}
		return result;
	}

	export function parseSelection(content: string, names: string[]): string[] {
		const values: Dict<string> = {};
		for (const line of content.split("\n")) {
			const clean = line.trim().replace(/^(?:[-*]|\d+[.)])\s*/, "");
			const index = clean.indexOf(":");
			if (index < 0) {
				continue;
			}
			const key = clean.slice(0, index).trim();
			const value = clean.slice(index + 1).trim();
			for (const name of names) {
				if (name.toLowerCase() == key.toLowerCase()) {
					values[name] = value;
					break;
				}
			}
		}
		const result = [];
		for (const name of names) {
			if ((values[name] ?? "").toLowerCase() != "true") {
				continue;
			}
			if (result.includes(name) == false) {
				result.push(name);
			}
		}
		return result;
	}

	export async function addExcerpt(name: string, content: string, source: string, description: IdeaEntryDescription, images: string[] = []): Promise<string> {
		const entries = await IdeaWorkshop.readEntries(name);
		for (const key in entries) {
			if (entries[key].source == source) {
				return null;
			}
		}
		const index = await IdeaWorkshop.nextExcerptIndex(name, source);
		const title = description.title || "Untitled";
		const key = IdeaWorkshop.buildEntryName(IdeaWorkshop.sourceDate(source), "excerpt", index, title);
		await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(name, key), content);
		const entry: IdeaCatalogueEntry = { time: Date.now(), kind: "excerpt", source, title, short: description.short, long: description.long };
		if (images.length) {
			entry.images = images;
		}
		await LibraryUtil.setEntry(IdeaWorkshop.ideaCataloguePath(name), key, entry);
		return key;
	}

	export async function regenerateSummaries(params: CombinedParams, names: string[], infoHandler?: AgoraStreamer): Promise<string[]> {
		const result = [];
		for (const name of names) {
			try {
				const entries = await IdeaWorkshop.readEntries(name);
				if (Object.keys(entries).length == 0) {
					continue;
				}
				const content = await IdeaWorkshop.buildIdeaContent(name, false);
				if (content == `Idea: ${name}`) {
					continue;
				}
				if (infoHandler) {
					infoHandler.streamInfo(`Updating summary of ${name}:`);
				}
				const streamed = infoHandler ? { ...params, handler: infoHandler } : params;
				const prompt = await IdeaWorkshop.composePrompt(streamed, IdeaWorkshop.resolveSummaryPrompt(streamed.idea), { content });
				const model = IdeaWorkshop.resolveIdeaModel(streamed, streamed.idea.summaryModel, streamed.generate.smallModel);
				const summary = await GenerateUtil.generateRaw(streamed, model, [ { role: "user", content: prompt } ]);
				if (summary.trim()) {
					await FileUtil.writeTextLocked(IdeaWorkshop.summaryPath(name), summary.trim());
					result.push(name);
				}
			} catch (error) {
				console.warn(error);
			}
		}
		return result;
	}

	// Regenerates the catalogue description from the stored entry and renames it.
	export async function summarizeEntry(params: CombinedParams, name: string, key: string): Promise<IdeaCatalogueEntry> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null) {
			return null;
		}
		const catalogue = await IdeaWorkshop.readCatalogue(clean);
		const entries = catalogue.entries ?? {};
		const entry = entries[key];
		if (entry == null) {
			return null;
		}
		const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(clean, key));
		const images = entry.images ?? [];
		if (content == null && images.length == 0) {
			return null;
		}
		const described = await IdeaWorkshop.describeItem(params, content ?? "", images);
		const result: IdeaCatalogueEntry = { ...entry, title: described.title, short: described.short, long: described.long };
		const newKey = renameKey(entry, described.title);
		if (newKey != key && Object.prototype.hasOwnProperty.call(entries, newKey) == false) {
			try {
				await NodeUtil.renamePromise(IdeaWorkshop.entryPath(clean, key), IdeaWorkshop.entryPath(clean, newKey));
				delete entries[key];
				entries[newKey] = result;
				await IdeaWorkshop.writeCatalogue(clean, catalogue);
				return result;
			} catch (error) {
				console.warn(error);
			}
		}
		entries[key] = result;
		await IdeaWorkshop.writeCatalogue(clean, catalogue);
		return result;
	}

	// Fresh ideas stay out of scheduled contemplation; empty ideas stay out always.
	export async function selectContemplation(manual: boolean, limit: number): Promise<string[]> {
		if (limit <= 0) {
			return [];
		}
		const now = Date.now();
		const week = 7 * 86400000;
		const candidates = [];
		for (const name of await IdeaWorkshop.listIdeaNames()) {
			const entries = await IdeaWorkshop.readEntries(name);
			if (Object.keys(entries).length == 0) {
				continue;
			}
			const last = IdeaWorkshop.getLastEntry(entries);
			if (last?.kind == "note") {
				// the ark wrote the latest entry, so wait for new material or a manual request
				continue;
			}
			const times = await IdeaWorkshop.getIdeaTimes(name);
			if (manual == false && (times.first == 0 || now - times.first < week)) {
				continue;
			}
			let weight = Math.min(now - times.created, (now - times.last) * 0.5);
			if (weight <= 0) {
				if (manual == false) {
					continue;
				}
				weight = 1;
			}
			candidates.push({ name, weight });
		}
		const selected = [];
		while (selected.length < limit && candidates.length) {
			const name = IdeaWorkshop.pickWeighted(candidates);
			selected.push(name);
			for (let i = 0; i < candidates.length; ++i) {
				if (candidates[i].name == name) {
					candidates.splice(i, 1);
					break;
				}
			}
		}
		return selected;
	}

	export function getLastEntry(entries: Dict<IdeaCatalogueEntry>): IdeaCatalogueEntry {
		let result: IdeaCatalogueEntry = null;
		for (const key in entries) {
			const entry = entries[key];
			if (result == null || (entry.time ?? 0) > (result.time ?? 0)) {
				result = entry;
			}
		}
		return result;
	}

	export function pickWeighted(items: { name: string, weight: number }[]): string {
		let total = 0;
		for (const item of items) {
			total += item.weight;
		}
		let value = Math.random() * total;
		for (const item of items) {
			value -= item.weight;
			if (value < 0) {
				return item.name;
			}
		}
		return items[items.length - 1].name;
	}

	// Two to five turns, web actions allowed, memory read and written when the ark allows it.
	export async function contemplate(params: CombinedParams, arkName: string, names: string[], infoHandler: AgoraStreamer): Promise<{ note: string, turns: number }> {
		const thoughts = await ParamsUtil.setArkSettings(params, arkName);
		thoughts.process = { ...thoughts.process, arkName };
		thoughts.chatID = `ideas-${names.join("-")}`;
		const settings = thoughts.idea;
		const content = await IdeaWorkshop.buildIdeasContent(names);
		const actionParams = IdeaWorkshop.webOnlyParams(thoughts);
		const prompt = await IdeaWorkshop.composePrompt(actionParams, IdeaWorkshop.resolveContemplatePrompt(settings), { ideas: content });
		const memories = await MemoryUtil.loadMemories(thoughts, [ { type: "message", time: Date.now(), role: "user", name: "idea-workshop", content } ], true);
		const systemParts: string[] = [];
		const basePrompt = await GenerateUtil.expandPrompt(actionParams, thoughts.generate.prompt ?? "");
		if (basePrompt) {
			systemParts.push(basePrompt);
		}
		if (memories) {
			systemParts.push(memories);
		}
		const images = await IdeaWorkshop.readIdeaImageData(names);
		const message: ChatMessage = { role: "user", content: prompt };
		let model = IdeaWorkshop.resolveIdeaModel(thoughts, settings.contemplateModel, thoughts.generate.mainModel);
		if (images.length) {
			model = IdeaWorkshop.resolveVisionModel(thoughts, model);
			if (model.vision) {
				message.images = images;
			}
		}
		const context: ChatMessage[] = [];
		if (systemParts.length) {
			context.push({ role: "system", content: systemParts.join("\n\n") });
		}
		context.push(message);
		const generateParams = infoHandler ? { ...thoughts, handler: infoHandler } : thoughts;
		const block: ContextEntry[] = [];
		const turns = 2 + Math.floor(Math.random() * 4);
		for (let turn = 0; turn < turns; ++turn) {
			const reply = (await GenerateUtil.generateRaw(generateParams, model, context)).trim();
			if (reply == "") {
				break;
			}
			const time = Date.now();
			context.push({ role: "assistant", content: reply });
			block.push({ type: "message", time, role: "ark", name: arkName, content: reply });
			const webResults = await IdeaWorkshop.runWebActions(thoughts, reply, time);
			for (const web of webResults) {
				context.push({ role: "user", content: `Result of @web-${web.action} ${web.args}:\n\n${web.result}` });
				block.push({ type: "message", time, role: "env", name: `web-${web.action}`, content: web.result });
			}
			if (turn + 1 < turns) {
				context.push({ role: "user", content: "Continue the contemplation." });
			}
		}
		const note = ContextUtil.contextToText(block, ContextUtil.archiveTemplate, Infinity);
		if (note.trim()) {
			try {
				const memoryBlock: ContextEntry[] = [
					{ type: "message", time: block[0]?.time ?? Date.now(), role: "env", name: "idea-workshop", content: `This is the state of the current idea, please write your thoughts about it:\n\n${content}` },
					...block,
					{ type: "message", time: block[block.length - 1]?.time ?? Date.now(), role: "env", name: "idea-workshop", content: "When memorizing, do not forget: this is an old conversation, and you should remember the thinking of something past." }
				];
				await MemoryUtil.memorizeBlock(thoughts, memoryBlock);
			} catch (error) {
				console.warn(error);
			}
		}
		return { note, turns: block.filter(item => item.role == "ark").length };
	}

	export async function runWebActions(params: CombinedParams, content: string, time: number): Promise<IdeaWebResult[]> {
		const actions = WorkshopUtil.gatherActions(IdeaWorkshop.webOnlyParams(params)).web;
		if (actions == null) {
			return [];
		}
		const entry: ContextEntry = { type: "message", time, role: "ark", name: params.process.arkName, content };
		const result = [];
		const matches = content.matchAll(/^@([\w]+)-([\w-]+)(?:[\t ]+(.*))?$/gm);
		for (const match of matches) {
			if (match[1] != "web") {
				continue;
			}
			const handler = actions[match[2]];
			if (handler == null) {
				continue;
			}
			const args = match[3] ?? "";
			let output = "";
			try {
				const value = await handler(params, entry, args);
				output = value == null ? "" : String(value);
			} catch (error) {
				output = `web action failed: ${error}`;
			}
			result.push({ action: match[2], args, result: output });
		}
		return result;
	}

	// Contemplation may only use web actions; the other providers stay disabled there.
	export function webOnlyParams(params: CombinedParams): CombinedParams {
		return {
			...params,
			todo: { ...params.todo, enabled: false },
			image: { ...params.image, enabled: false },
			document: { ...params.document, enabled: false },
			idea: { ...params.idea, enabled: false }
		};
	}

	export async function saveNote(names: string[], note: string, turns: number, description: IdeaEntryDescription): Promise<string[]> {
		const time = Date.now();
		const date = DateUtil.toLocalDate(time);
		const result = [];
		for (const name of names) {
			const index = await IdeaWorkshop.nextNoteIndex(name);
			const key = IdeaWorkshop.buildEntryName(date, "note", index, description.title);
			await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(name, key), note);
			await LibraryUtil.setEntry(IdeaWorkshop.ideaCataloguePath(name), key, { time, kind: "note", turns, title: description.title, short: description.short, long: description.long });
			result.push(key);
		}
		return result;
	}

	export async function describeItem(params: CombinedParams, content: string, images: string[] = []): Promise<IdeaEntryDescription> {
		const prompt = await GenerateUtil.expandPrompt(params, IdeaWorkshop.resolveEntryPrompt(params.idea));
		const context: ChatMessage[] = [ { role: "system", content: prompt }, { role: "user", content } ];
		let model = IdeaWorkshop.resolveIdeaModel(params, params.idea.summaryModel, params.generate.smallModel);
		if (images.length) {
			const data = await IdeaWorkshop.readImageData(images);
			model = IdeaWorkshop.resolveVisionModel(params, model);
			if (data.length && model.vision) {
				context[1].images = data;
			}
		}
		const result = await GenerateUtil.generateRaw(params, model, context);
		const fields = { Title: "Untitled", Short: "" };
		const remainder = TextUtil.parseLineFields(result, fields);
		const title = IdeaWorkshop.resolveTitle(fields.Title);
		const long = remainder.trim();
		const short = fields.Short?.trim() || TextUtil.shortifyLineNicely(long.replace(/\s+/g, " "), 200);
		return { title, short, long: long || short };
	}

	export async function readImageData(names: string[]): Promise<string[]> {
		const result = [];
		for (const name of names) {
			const data = await ImageWorkshop.readImage(name);
			if (data) {
				result.push(data);
			}
		}
		return result;
	}

	// The idea summary is the short description used in reports and selection.
	export async function getIdeaShort(name: string): Promise<string> {
		const summary = await IdeaWorkshop.readSummary(name);
		const description = await IdeaWorkshop.readDescriptionFile(name);
		const text = (summary?.trim() || description.trim()).replace(/\s+/g, " ");
		return TextUtil.shortifyLineNicely(text, 300) || "No summary yet.";
	}

	export async function buildIdeasContent(names: string[]): Promise<string> {
		const parts = [];
		for (const name of names) {
			parts.push(await IdeaWorkshop.buildIdeaContent(name, true));
		}
		return parts.join("\n\n---\n\n");
	}

	export async function buildIdeaContent(name: string, includeSummary: boolean): Promise<string> {
		const parts = [];
		const description = await IdeaWorkshop.readDescriptionFile(name);
		if (description.trim()) {
			parts.push(`Description:\n${description.trim()}`);
		}
		if (includeSummary) {
			const summary = await IdeaWorkshop.readSummary(name);
			if (summary?.trim()) {
				parts.push(`Summary:\n${summary.trim()}`);
			}
		}
		const entries = await IdeaWorkshop.readEntries(name);
		const keys = Object.keys(entries).sort((a, b) => {
			const timeA = entries[a].time ?? 0;
			const timeB = entries[b].time ?? 0;
			return timeA == timeB ? a.localeCompare(b) : timeA - timeB;
		});
		for (const key of keys) {
			const entry = entries[key];
			const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(name, key));
			const body = content?.trim() || entry.long?.trim();
			if (body) {
				const header = [ `[${key}]` ];
				if (entry.source) {
					header.push(`Source: ${entry.source}`);
				}
				if (entry.title) {
					header.push(`Title: ${entry.title}`);
				}
				if (entry.short) {
					header.push(`Short: ${entry.short}`);
				}
				header.push(body);
				parts.push(header.join("\n"));
			}
		}
		if (parts.length == 0) {
			return `Idea: ${name}`;
		}
		return `Idea: ${name}\n\n${parts.join("\n\n")}`;
	}

	// Every image the ideas carry, without repeats.
	export async function readIdeaImageData(names: string[]): Promise<string[]> {
		const found = [];
		for (const name of names) {
			const entries = await IdeaWorkshop.readEntries(name);
			for (const key in entries) {
				for (const image of entries[key].images ?? []) {
					if (found.includes(image) == false) {
						found.push(image);
					}
				}
			}
		}
		return await IdeaWorkshop.readImageData(found);
	}

	export async function composePrompt(params: CombinedParams, template: string, values: Dict<string>, fields: Dict<DescriptionField> = null): Promise<string> {
		template = template ?? "";
		const tokens: Dict<string> = {};
		for (const key in values) {
			const token = `\u0000${key.toUpperCase()}\u0000`;
			tokens[token] = values[key];
			template = template.split(`{{${key}}}`).join(token);
		}
		let result = await GenerateUtil.expandPrompt(params, template, fields);
		for (const token in tokens) {
			result = result.split(token).join(tokens[token]);
		}
		return result;
	}

	export function resolveSelectPrompt(settings: IdeaSettings): string {
		return settings.selectPrompt || IdeaWorkshop.defaultSettings.selectPrompt;
	}

	export function resolveSummaryPrompt(settings: IdeaSettings): string {
		return settings.summaryPrompt || IdeaWorkshop.defaultSettings.summaryPrompt;
	}

	export function resolveContemplatePrompt(settings: IdeaSettings): string {
		return settings.contemplatePrompt || IdeaWorkshop.defaultSettings.contemplatePrompt;
	}

	export function resolveEntryPrompt(settings: IdeaSettings): string {
		return settings.entryPrompt || IdeaWorkshop.defaultSettings.entryPrompt;
	}

	export function resolveIdeaModel(params: CombinedParams, name: string, fallback: string): ModelSettings {
		const candidates = [ name, fallback, params.generate.mainModel, params.generate.smallModel ];
		for (const candidate of candidates) {
			if (candidate == null || candidate == "") {
				continue;
			}
			const model = ModelUtil.resolve(params, candidate);
			if (model.model) {
				return model;
			}
		}
		for (const key in params.models) {
			const model = ModelUtil.resolve(params, key);
			if (model.model) {
				return model;
			}
		}
		console.warn(`[IdeaWorkshop] no usable model, tried ${name || "none"} and ${fallback || "none"}`);
		return ModelUtil.resolve(params, fallback);
	}

	// Image material needs a model that can see it, when one is configured.
	export function resolveVisionModel(params: CombinedParams, model: ModelSettings): ModelSettings {
		if (model.vision) {
			return model;
		}
		const vision = ModelUtil.resolve(params, params.generate.visionModel);
		if (vision.vision) {
			return vision;
		}
		return model;
	}

	export async function resolveArkName(settings: IdeaSettings, override: string): Promise<string> {
		const arks = await ArkUtil.getArkNames();
		if (override && arks.includes(override)) {
			return override;
		}
		if (settings.assignedArk && arks.includes(settings.assignedArk)) {
			return settings.assignedArk;
		}
		return arks[0] ?? null;
	}

	export async function buildClarificationReport(item: IdeaInboxItem, content: string): Promise<string> {
		const parts = [];
		parts.push(`Unfiled ${item.baseName}:`);
		const excerpt = TextUtil.shortifyTextNicely(content, 3, 200);
		if (excerpt) {
			parts.push(`Excerpt:\n${excerpt}`);
		}
		parts.push(`No target idea was found. Which idea should this item belong to?`);
		parts.push(`Reply with: @idea-move from=INBOX item=${item.baseName} to=IdeaName`);
		return parts.join("\n");
	}

	export async function buildMoveReport(item: IdeaInboxItem, description: IdeaEntryDescription, targets: string[], keys: string[], verb = "Filed"): Promise<string> {
		const parts = [];
		parts.push(`${verb} ${item.baseName}:`);
		parts.push(`Name: ${description.title}`);
		if (keys.length && keys[0]) {
			parts.push(`File: ${keys[0]}`);
		}
		parts.push(`Short: ${description.short}`);
		parts.push(`Long: ${description.long}`);
		for (const name of targets) {
			parts.push(`Copied to ${name}: ${await IdeaWorkshop.getIdeaShort(name)}`);
		}
		return parts.join("\n");
	}

	export async function sendReport(settings: IdeaSettings, content: string): Promise<void> {
		const target = await IdeaWorkshop.resolveReportChat(settings);
		if (target == null) {
			console.warn("no chat available for idea report");
			return;
		}
		const lock = await Mutex.lock(target);
		try {
			const handler = new AgoraStreamer(target, null);
			const params = await ParamsUtil.getCombinedParams(target, handler);
			await ProcessUtil.sendMessage(params, "env", "idea-report", content, [], []);
		} finally {
			AgoraStreamer.end(target);
			lock.release();
		}
	}

	export async function resolveReportChat(settings: IdeaSettings): Promise<string> {
		if (await ChatUtil.isChatAvailable(settings.defaultChat)) {
			return settings.defaultChat;
		}
		return ChatUtil.latestChat();
	}

	export async function listInbox(limit: number, deferred: string[]): Promise<IdeaInboxItem[]> {
		if (limit <= 0) {
			return [];
		}
		const deferredSet = new Set(deferred);
		const result = [];
		for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.inboxPath)) {
			if (name.endsWith(".txt") == false) {
				continue;
			}
			const path = NodeUtil.getPath(IdeaWorkshop.inboxPath, name);
			let time = 0;
			try {
				const stat = await NodeUtil.fs.promises.stat(path);
				time = stat.mtimeMs;
			} catch {
				// item may vanish during the scan
			}
			result.push({ name, path, baseName: name.slice(0, -4), time });
		}
		result.sort((a, b) => {
			const deferredA = deferredSet.has(a.baseName) ? 1 : 0;
			const deferredB = deferredSet.has(b.baseName) ? 1 : 0;
			if (deferredA != deferredB) {
				return deferredA - deferredB;
			}
			return a.time == b.time ? a.name.localeCompare(b.name) : a.time - b.time;
		});
		return result.slice(0, limit);
	}

	// Touching the file sends an unmatched item to the end of the line.
	export async function deferInboxItem(path: string): Promise<void> {
		try {
			const now = new Date();
			await NodeUtil.fs.promises.utimes(path, now, now);
		} catch {
			// item may be gone
		}
	}

	export async function getIdeaTimes(name: string): Promise<IdeaTimes> {
		const catalogue = await IdeaWorkshop.readCatalogue(name);
		const entries = catalogue.entries ?? {};
		let first = catalogue.created ?? 0;
		let last = first;
		for (const key in entries) {
			const time = entries[key].time ?? 0;
			if (time <= 0) {
				continue;
			}
			if (first == 0 || time < first) {
				first = time;
			}
			if (time > last) {
				last = time;
			}
		}
		if (first == 0) {
			first = await IdeaWorkshop.getFileTime(IdeaWorkshop.summaryPath(name));
		}
		if (last == 0) {
			last = first;
		}
		return { created: catalogue.created || first, first, last };
	}

	export async function getFileTime(path: string): Promise<number> {
		try {
			const stat = await NodeUtil.fs.promises.stat(path);
			return stat.mtimeMs;
		} catch {
			return 0;
		}
	}

	export async function listIdeaNames(): Promise<string[]> {
		const result = [];
		for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.rootPath)) {
			if (name == "INBOX") {
				continue;
			}
			if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name))) {
				result.push(name);
			}
		}
		result.sort((a, b) => a.localeCompare(b));
		return result;
	}

	export async function readSummary(name: string): Promise<string> {
		const path = IdeaWorkshop.summaryPath(name);
		if (await FileUtil.exists(path) == false) {
			return null;
		}
		return FileUtil.readTextLocked(path);
	}

	export async function readDescriptionFile(name: string): Promise<string> {
		const path = IdeaWorkshop.descriptionPath(name);
		if (await FileUtil.exists(path) == false) {
			return "";
		}
		return FileUtil.readTextLocked(path);
	}

	export async function readCatalogue(name: string): Promise<IdeaCatalogue> {
		const data = await FileUtil.readJSONLocked(IdeaWorkshop.ideaCataloguePath(name));
		if (data == null) {
			return { created: 0, lastIndex: 0, lastExcerptIndex: 0, lastNoteIndex: 0, entries: {} };
		}
		data.entries = data.entries ?? {};
		return data;
	}

	export async function readEntries(name: string): Promise<Dict<IdeaCatalogueEntry>> {
		return (await IdeaWorkshop.readCatalogue(name)).entries;
	}

	// support codes for settings UI

	export async function listIdeas(): Promise<IdeaWorkshopInfo[]> {
		const result = [];
		for (const name of await IdeaWorkshop.listIdeaNames()) {
			const entries = await IdeaWorkshop.readEntries(name);
			result.push({ name, entries: Object.keys(entries).sort() });
		}
		return result;
	}

	export async function createIdea(name: string, description: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null) {
			return null;
		}
		if (await FileUtil.exists(IdeaWorkshop.ideaPath(clean))) {
			return null;
		}
		await NodeUtil.makeDirPromise(IdeaWorkshop.ideaPath(clean), { recursive: true });
		const time = Date.now();
		const catalogue: IdeaCatalogue = { created: time, lastIndex: 0, lastExcerptIndex: 0, lastNoteIndex: 0, entries: {} };
		await FileUtil.writeJSONLocked(IdeaWorkshop.ideaCataloguePath(clean), catalogue);
		await FileUtil.writeTextLocked(IdeaWorkshop.descriptionPath(clean), description ?? "");
		return clean;
	}

	export async function renameIdea(oldName: string, newName: string): Promise<string> {
		const from = IdeaWorkshop.sanitizeName(oldName);
		const to = IdeaWorkshop.sanitizeName(newName);
		if (from == null || to == null || from == to) {
			return null;
		}
		if (await FileUtil.exists(IdeaWorkshop.ideaPath(from)) == false) {
			return null;
		}
		if (await FileUtil.exists(IdeaWorkshop.ideaPath(to))) {
			return null;
		}
		await NodeUtil.renamePromise(IdeaWorkshop.ideaPath(from), IdeaWorkshop.ideaPath(to));
		return to;
	}

	// Renames a catalogue entry by replacing the title in its key.
	export async function renameEntry(name: string, key: string, title: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null) {
			return null;
		}
		const catalogue = await IdeaWorkshop.readCatalogue(clean);
		const entry = catalogue.entries[key];
		if (entry == null) {
			return null;
		}
		const resolved = IdeaWorkshop.resolveTitle(LibraryUtil.cleanName(title));
		const newKey = renameKey(entry, resolved);
		if (newKey == key) {
			return key;
		}
		if (Object.prototype.hasOwnProperty.call(catalogue.entries, newKey)) {
			return null;
		}
		await NodeUtil.renamePromise(IdeaWorkshop.entryPath(clean, key), IdeaWorkshop.entryPath(clean, newKey));
		catalogue.entries[newKey] = { ...entry, title: resolved };
		delete catalogue.entries[key];
		await IdeaWorkshop.writeCatalogue(clean, catalogue);
		return newKey;
	}

	export async function removeIdea(name: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null) {
			return null;
		}
		try {
			await NodeUtil.removePromise(IdeaWorkshop.ideaPath(clean), { recursive: true });
		} catch {
			// may not exist
		}
		return clean;
	}

	export async function writeSummary(name: string, content: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(clean)) == false) {
			return null;
		}
		content = content ?? "";
		await FileUtil.writeTextLocked(IdeaWorkshop.summaryPath(clean), content);
		return content;
	}

	export async function writeDescription(name: string, content: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(clean)) == false) {
			return null;
		}
		content = content ?? "";
		await FileUtil.writeTextLocked(IdeaWorkshop.descriptionPath(clean), content);
		return content;
	}

	export async function writeCatalogue(name: string, catalogue: IdeaCatalogue): Promise<IdeaCatalogue> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null || catalogue == null) {
			return null;
		}
		if (await FileUtil.exists(IdeaWorkshop.ideaPath(clean)) == false) {
			return null;
		}
		catalogue.created = catalogue.created ?? Date.now();
		catalogue.lastIndex = catalogue.lastIndex ?? 0;
		catalogue.entries = catalogue.entries ?? {};
		await FileUtil.writeJSONLocked(IdeaWorkshop.ideaCataloguePath(clean), catalogue);
		return catalogue;
	}

	export async function readIdeaEntry(name: string, key: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null) {
			return null;
		}
		const entries = await IdeaWorkshop.readEntries(clean);
		if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
			return null;
		}
		return FileUtil.readTextLocked(IdeaWorkshop.entryPath(clean, key));
	}

	export async function writeIdeaEntry(name: string, key: string, content: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeName(name);
		if (clean == null) {
			return null;
		}
		const entries = await IdeaWorkshop.readEntries(clean);
		if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
			return null;
		}
		content = content ?? "";
		await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(clean, key), content);
		return content;
	}

	export async function listInboxNames(): Promise<string[]> {
		const result = [];
		for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.inboxPath)) {
			if (name.endsWith(".txt")) {
				result.push(name);
			}
		}
		result.sort();
		return result;
	}

	export async function readInbox(name: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeInboxName(name);
		if (clean == null) {
			return null;
		}
		return FileUtil.readTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, clean));
	}

	export async function writeInbox(name: string, content: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeInboxName(name);
		if (clean == null) {
			return null;
		}
		content = content ?? "";
		await FileUtil.writeTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, clean), content);
		return content;
	}

	// Files an uploaded text as the next INBOX item.
	export async function uploadInbox(content: string): Promise<string> {
		const { year, month, day, padded } = await LibraryUtil.nextParts(IdeaWorkshop.settingsPath);
		const name = `${year}-${month}-${day}-${padded}.txt`;
		await FileUtil.writeTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, name), content ?? "");
		return name;
	}

	// Files an uploaded image as the next INBOX item, its text carrying the reference.
	export async function uploadInboxImage(ext: string, data: string): Promise<string> {
		const image = await ImageWorkshop.saveUpload(ext, data);
		return await IdeaWorkshop.uploadInbox(`[image ${image}]\nAn uploaded image.`);
	}

	export async function removeInbox(name: string): Promise<string> {
		const clean = IdeaWorkshop.sanitizeInboxName(name);
		if (clean == null) {
			return null;
		}
		try {
			await NodeUtil.removePromise(NodeUtil.getPath(IdeaWorkshop.inboxPath, clean));
		} catch {
			// may not exist
		}
		const settings = await IdeaWorkshop.readSettings();
		const current = settings.deferred ?? [];
		const baseName = clean.slice(0, -4);
		const deferred = current.filter(item => item != baseName && item != clean);
		if (deferred.length != current.length) {
			await IdeaWorkshop.editSettings({ deferred });
		}
		return clean;
	}

	export function sanitizeInboxName(name: string): string {
		if (name == null) {
			return null;
		}
		const clean = NodeUtil.path.basename(name);
		if (clean.endsWith(".txt") == false || clean == ".txt") {
			return null;
		}
		return clean;
	}

	export function nextEntryName(entries: Dict<IdeaCatalogueEntry>, prefix: string): string {
		let max = 0;
		for (const key in entries) {
			const match = key.match(new RegExp(`^${prefix}-(\\d+)$`));
			if (match) {
				max = Math.max(max, Number(match[1]));
			}
		}
		return `${prefix}-${max + 1}`;
	}

	export function sourceDate(source: string): string {
		const match = (source ?? "").match(/^\d{4}-\d{2}-\d{2}/);
		if (match) {
			return match[0];
		}
		return DateUtil.toLocalDate(Date.now());
	}

	export async function nextExcerptIndex(name: string, source: string): Promise<string> {
		const catalogue = await IdeaWorkshop.readCatalogue(name);
		const entries = catalogue.entries ?? {};
		const found = (source ?? "").match(/^\d{4}-\d{2}-\d{2}-(\d+)$/);
		let index = found ? Number(found[1]) : 0;
		const previous = Math.max(catalogue.lastExcerptIndex ?? 0, IdeaWorkshop.getEntryIndexMax(entries, "excerpt"));
		if (index < 1) {
			index = previous + 1;
		}
		if (index > (catalogue.lastExcerptIndex ?? 0)) {
			catalogue.lastExcerptIndex = index;
			await IdeaWorkshop.writeCatalogue(name, catalogue);
		}
		return found ? found[1] : String(index);
	}

	export async function nextNoteIndex(name: string): Promise<string> {
		const catalogue = await IdeaWorkshop.readCatalogue(name);
		const entries = catalogue.entries ?? {};
		const index = Math.max(catalogue.lastNoteIndex ?? 0, IdeaWorkshop.getEntryIndexMax(entries, "note")) + 1;
		catalogue.lastNoteIndex = index;
		await IdeaWorkshop.writeCatalogue(name, catalogue);
		return String(index);
	}

	export async function syncEntryIndex(name: string, key: string): Promise<void> {
		const parsed = IdeaWorkshop.parseEntryIndex(key);
		if (parsed == null) {
			return;
		}
		const catalogue = await IdeaWorkshop.readCatalogue(name);
		if (parsed.kind == "excerpt") {
			catalogue.lastExcerptIndex = Math.max(catalogue.lastExcerptIndex ?? 0, parsed.index);
		} else {
			catalogue.lastNoteIndex = Math.max(catalogue.lastNoteIndex ?? 0, parsed.index);
		}
		await IdeaWorkshop.writeCatalogue(name, catalogue);
	}

	export function parseEntryIndex(key: string): { kind: string, index: number } {
		const modern = key.match(/^\d{4}-\d{2}-\d{2}-(excerpt|note)-(\d+)/);
		if (modern) {
			return { kind: modern[1], index: Number(modern[2]) };
		}
		const legacy = key.match(/^(excerpt|notes|note)-(\d+)$/);
		if (legacy) {
			return { kind: legacy[1] == "excerpt" ? "excerpt" : "note", index: Number(legacy[2]) };
		}
		return null;
	}

	export function getEntryIndexMax(entries: Dict<IdeaCatalogueEntry>, kind: string): number {
		let max = 0;
		for (const key in entries) {
			const parsed = IdeaWorkshop.parseEntryIndex(key);
			if (parsed != null && parsed.kind == kind) {
				max = Math.max(max, parsed.index);
			}
		}
		return max;
	}

	export function buildEntryName(date: string, kind: string, index: string, title: string): string {
		const clean = IdeaWorkshop.titleToName(title);
		if (clean) {
			return `${date}-${kind}-${index}-${clean}`;
		}
		return `${date}-${kind}-${index}`;
	}

	// A rename keeps the entry's stored date and takes the title slug.
	function renameKey(entry: IdeaCatalogueEntry, title: string): string {
		const date = entry.time ? DateUtil.toLocalDate(entry.time) : DateUtil.toLocalDate(Date.now());
		const titled = IdeaWorkshop.titleToName(title);
		if (titled) {
			return `${date}-${titled}`;
		}
		return date;
	}

	export function titleToName(title: string): string {
		const words = (title ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
		const joined = words.join("-");
		if (joined.length <= 80) {
			return joined;
		}
		const cut = joined.slice(0, 80);
		const lastDash = cut.lastIndexOf("-");
		return lastDash < 0 ? cut : cut.slice(0, lastDash);
	}

	export function resolveTitle(value: string): string {
		return (value ?? "").replace(/^["']+|["']+$/g, "").trim();
	}

	export function parseCount(value: string): number {
		if (value == null) {
			return null;
		}
		const count = parseInt(value);
		if (isNaN(count)) {
			return null;
		}
		return count;
	}

	export function parseNamedArgs(args: string): { name: string, rest: string } {
		const fields: Dict<string> = { name: null };
		let rest = TextUtil.parseMetaFields((args ?? "").trim(), fields);
		let name: string = fields["name"];
		if (name == null) {
			const match = rest.match(/^name=\s*(\S*)\s*([\s\S]*)$/);
			if (match) {
				name = match[1];
				rest = match[2];
			}
		}
		return { name: IdeaWorkshop.sanitizeName(name), rest: rest.trim() };
	}

	export function sanitizeName(value: string): string {
		if (value == null) {
			return null;
		}
		const name = value.replace(/[\/\\\s]+/g, "-").trim();
		if (name == "" || name == "." || name == ".." || name == "INBOX") {
			return null;
		}
		return name;
	}

	export function ideaPath(name: string): string {
		return NodeUtil.getPath(IdeaWorkshop.rootPath, name);
	}

	export function ideaCataloguePath(name: string): string {
		return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), "catalogue.json");
	}

	export function summaryPath(name: string): string {
		return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), "summary.txt");
	}

	export function descriptionPath(name: string): string {
		return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), "description.txt");
	}

	export function entryPath(name: string, key: string): string {
		const safeKey = NodeUtil.path.basename(key);
		return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), `${safeKey}.txt`);
	}

	export function resultEntry(name: string, content: string): ContextEntry {
		return { type: "message", time: Date.now(), role: "env", name, content };
	}

	export function infoEntry(content: string): ContextEntry {
		return { type: "message", time: Date.now(), role: "info", name: "idea", content };
	}
}