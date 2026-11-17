/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="../ContentServer/LibraryUtil.ts" />

/// <reference path="ArkUtil.ts" />
/// <reference path="ContextUtil.ts" />
/// <reference path="GenerateUtil.ts" />
/// <reference path="ParamsUtil.ts" />
/// <reference path="TopicMatcher.ts" />

type MemoryMode = "enabled" | "readonly" | "disabled";

interface MemorySettings {
	model: string;
	prompt: string;
	shortLimit: number;
	longLimit: number;
	activeLimit: number;
	activeEntries: number;
	activeLines: number;
	activeLength: number;
	allowRead: boolean;
	allowWrite: boolean;
}

interface MemoryEntry {
	source: string;
	short: string;
	start: number;
	end: number;
	viewed?: number;
	weight?: number;
}

namespace MemoryUtil {
	const arksPath = SettingsUtil.getLocation("/ThinkTank/Agora/Arks");

	export const defaultSettings: MemorySettings = {
		model: "default",
		prompt: "Write a memory paragraph for yourself after the fields, plain text, no formatting.",
		shortLimit: 80,
		longLimit: 8,
		activeLimit: 2,
		activeEntries: 8,
		activeLines: 2,
		activeLength: 80,
		allowRead: true,
		allowWrite: true
	};

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		// TODO: Implement dynamic prompting.
		return [];
	}

	export async function initialize(): Promise<void> {
		await WorkshopUtil.scheduleEvery("memory-main", "1h");
	}

	export async function onWakeUp(params: any): Promise<void> {
		console.log("memory wake up");
		// TODO: Implement scheduled consolidation.
	}

	function getTimeRange(params: CombinedParams, context: ContextEntry[]): { start: number, end: number } {
		let start = 0;
		let end = 0;
		for (const entry of context) {
			if (entry.time) {
				start = start || entry.time;
				end = entry.time || end;
			}
		}
		start = start || params.created;
		end = end || params.updated;
		return { start, end };
	}

	export async function onUpdate(params: CombinedParams, context: ContextEntry[]): Promise<void> {
		for (const arkName of params.members) {
			if (arkName == params.process.userName) {
				continue;
			}
			const arkParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, arkName);
			if (arkParams.memory.allowWrite == false) {
				continue;
			}
			// an active memory only references its chat, the content is read and shortened on recall
			if (context.length == 0) {
				await removeMemoryEntry(arkName, `active-${params.chatID}`);
				continue;
			}
			const { start, end } = getTimeRange(arkParams, context);
			const entry = { source: params.chatID, short: `latest memory from chat ${params.chatID}`, start, end };
			await writeCatalogueEntry(arkName, `active-${params.chatID}`, entry);
		}
	}

	export async function onDelete(params: CombinedParams): Promise<void> {
		params.handler.streamInfo("Deleting active memory...");
		await removeActiveMemory(params);
	}

	export async function removeActiveMemory(params: CombinedParams): Promise<void> {
		for (const arkName of await ArkUtil.getArkNames()) {
			await removeMemoryEntry(arkName, `active-${params.chatID}`);
		}
	}

	export async function removeChatMemories(chatID: string): Promise<void> {
		for (const arkName of await ArkUtil.getArkNames()) {
			const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
			const memoryData = await LibraryUtil.readEntries<MemoryEntry>(cataloguePath);
			for (const memoryName of Object.keys(memoryData)) {
				if (memoryData[memoryName].source == chatID) {
					await removeMemoryEntry(arkName, memoryName);
				}
			}
		}
	}

	export async function onBlock(params: CombinedParams, block: ContextEntry[]): Promise<void> {
		if (params.members.length < 3) {
			if (params.memory.allowWrite) {
				params.handler.streamInfo("Memorizing old block...");
				await memorizeBlock(params, block);
			}
			return;
		}
		const jobs = [];
		for (const name of params.members) {
			if (name == params.process.userName) {
				continue;
			}
			let present = true;
			const filtered = [];
			for (const entry of block) {
				const called = ContextUtil.getReportArk(entry, "chat-call", " joined");
				const left = ContextUtil.getReportArk(entry, "chat-leave", " left");
				if (called == name) {
					present = true;
					filtered.push(entry);
				} else if (left == name) {
					filtered.push(entry);
					present = false;
				} else if (entry.role == "ark" && entry.name == name) {
					present = true;
					filtered.push(entry);
				} else if (present) {
					filtered.push(entry);
				}
			}
			if (filtered.length == 0) {
				continue;
			}
			const arkParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, name);
			if (arkParams.memory.allowWrite == false) {
				continue;
			}
			jobs.push({ params: arkParams, block: filtered });
		}
		if (jobs.length == 0) {
			return;
		}
		params.handler.streamInfo("Memorizing old block...");
		for (const job of jobs) {
			await memorizeBlock(job.params, job.block);
		}
	}

	export async function memorizeBlock(params: CombinedParams, block: ContextEntry[]): Promise<void> {
		const { start, end } = getTimeRange(params, block);
		const cataloguePath = NodeUtil.getPath(arksPath, params.process.arkName, "catalogue.json");
		const { year, month, day, padded } = await LibraryUtil.nextParts(cataloguePath);
		const name = `${year}-${month}-${day}-${padded}`;
		const fields = {
			short: { name: "Short", description: "one line summary" },
			tags: { name: "Tags", description: "comma separated tags", value: "missing tag list" },
			weight: { name: "Weight", description: "importance from 0 to 10", value: "5" },
			content: { description: "the memory paragraph" }
		};
		const result = await GenerateUtil.generateMemory(params, block, fields);
		if (result == null) {
			params.handler.streamInfo("Memory produced no content.");
			return;
		}
		const content = result.content.trim();
		if (content == "") {
			params.handler.streamInfo("Memory produced no content.");
			return;
		}
		const short = result.short || TextUtil.shortifyLineNicely(content, 200);
		const weight = parseFloat(result.weight) || 5;
		const entry = { source: params.chatID, short, start, end, weight };
		await addMemoryEntry(params.process.arkName, name, content, entry);
		params.handler.streamRaw("\n");
	}

	export async function loadMemories(params: CombinedParams, context: ContextEntry[], useActives: boolean): Promise<string> {
		if (params.memory.allowRead == false) {
			return null;
		}
		const cataloguePath = NodeUtil.getPath(arksPath, params.process.arkName, "catalogue.json");
		const memory = await LibraryUtil.readEntries<MemoryEntry>(cataloguePath);
		const actives = [];
		const entries = [];
		const names = new Map<MemoryEntry, string>();
		for (const name in memory) {
			if (name == `active-${params.chatID}`) {
				// skipping active memory from current chat
			} else if (name.startsWith("active")) {
				actives.push(name);
			} else {
				const entry = memory[name];
				entries.push(entry);
				names.set(entry, name);
			}
		}
		const activeNames = [];
		const activeContents: Dict<string> = {};
		const activeTemplate = { ...ContextUtil.minimalTemplate, lineCount: params.memory.activeLines, lineLength: params.memory.activeLength };
		const activeCount = Math.max(0, Math.floor(params.memory.activeLimit));
		const recent = activeCount ? actives.slice(-activeCount) : [];
		for (const name of recent) {
			const entry = memory[name];
			const sourceContext = await ContextUtil.loadActive(entry.source);
			const content = ContextUtil.contextToText(sourceContext ?? [], activeTemplate, params.memory.activeEntries);
			if (content.trim() == "") {
				// an empty active reference is a leftover, so drop it
				if (params.memory.allowWrite) {
					await removeMemoryEntry(params.process.arkName, name);
				}
			} else {
				activeNames.push(name);
				activeContents[name] = content;
			}
		}
		const selection = TopicMatcher.selectMemoriesFor(context, entries, params.memory.shortLimit, params.memory.longLimit);
		const lines = [];
		if (selection.shorts.length) {
			lines.push("Other memories:\n");
			for (const entry of selection.shorts) {
				const date = DateUtil.toLocalDate(entry.start);
				lines.push(`${date} – ${entry.short}`);
			}
			lines.push("");
		}
		for (const entry of selection.expanded) {
			const name = names.get(entry);
			const start = DateUtil.toLocalFull(entry.start);
			const end = DateUtil.toLocalFull(entry.end);
			const path = NodeUtil.getPath(arksPath, params.process.arkName, "Memories", `${name}.txt`);
			const content = await FileUtil.readTextLocked(path) ?? "";
			lines.push(`Memory from ${entry.source} at ${start} to ${end}:\n\n${content}\n`);
		}
		if (useActives) {
			for (const name of activeNames) {
				const entry = memory[name];
				const content = activeContents[name];
				lines.push(`Active memory from ${entry.source}:\n\n${content}\n`);
			}
		}
		return lines.join("\n").trim();
	}

	// The newest short memories for the urgency inference, capped to the limit.
	export async function loadShortMemories(arkName: string, context: ContextEntry[], limit: number): Promise<string[]> {
		const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
		const memory = await LibraryUtil.readEntries<MemoryEntry>(cataloguePath);
		const entries = [];
		for (const name in memory) {
			if (name.startsWith("active")) {
				continue;
			}
			entries.push(memory[name]);
		}
		const selection = TopicMatcher.selectMemoriesFor(context, entries);
		const result = [];
		const start = Math.max(0, selection.shorts.length - Math.max(0, Math.floor(limit)));
		for (let index = start; index < selection.shorts.length; ++index) {
			const short = selection.shorts[index].short?.trim();
			if (short) {
				result.push(short);
			}
		}
		return result;
	}

	async function addMemoryEntry(arkName: string, name: string, content: string, entry: MemoryEntry): Promise<void> {
		// write memory file
		const memoriesPath = NodeUtil.getPath(arksPath, arkName, "Memories");
		await NodeUtil.makeDirPromise(memoriesPath, { recursive: true });
		const memoryPath = NodeUtil.getPath(memoriesPath, `${name}.txt`);
		await FileUtil.writeTextLocked(memoryPath, content);
		// assign in catalogue
		const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
		await LibraryUtil.setEntry(cataloguePath, name, entry);
	}

	export async function saveMemory(arkName: string, content: string, entry: MemoryEntry): Promise<string> {
		const { year, month, day, padded } = await LibraryUtil.nextParts(cataloguePath(arkName));
		const name = `${year}-${month}-${day}-${padded}`;
		await addMemoryEntry(arkName, name, content, entry);
		return name;
	}

	export async function createMemory(arkName: string): Promise<string> {
		const { year, month, day, time, padded } = await LibraryUtil.nextParts(cataloguePath(arkName));
		const name = `${year}-${month}-${day}-${padded}`;
		const entry: MemoryEntry = { source: "manual", short: "", start: time, end: time, weight: 1 };
		await addMemoryEntry(arkName, name, "", entry);
		return name;
	}

	export async function removeMemory(arkName: string, name: string): Promise<string> {
		await removeMemoryEntry(arkName, name);
		return name;
	}

	async function removeMemoryEntry(arkName: string, name: string): Promise<void> {
		// remove memory file
		try {
			const path = NodeUtil.getPath(arksPath, arkName, "Memories", `${name}.txt`);
			await NodeUtil.removePromise(path);
		} catch {
			// may not exist
		}
		// remove from catalogue
		const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
		await LibraryUtil.removeEntry(cataloguePath, name);
	}

	// support codes for settings UI

	export async function listMemories(arkName: string): Promise<string[]> {
		const entries = await LibraryUtil.readEntries<MemoryEntry>(cataloguePath(arkName));
		const result = [];
		for (const name in entries) {
			result.push(name);
		}
		result.sort((a, b) => a < b ? -1 : 1);
		return result;
	}

	export async function readCatalogueEntry(arkName: string, name: string): Promise<MemoryEntry> {
		return LibraryUtil.getEntry<MemoryEntry>(cataloguePath(arkName), name);
	}

	export async function writeCatalogueEntry(arkName: string, name: string, entry: MemoryEntry): Promise<MemoryEntry> {
		await LibraryUtil.setEntry(cataloguePath(arkName), name, entry);
		return entry;
	}

	export async function readMemoryFile(arkName: string, name: string): Promise<string> {
		return FileUtil.readTextLocked(memoryPath(arkName, name));
	}

	export async function writeMemoryFile(arkName: string, name: string, content: string): Promise<string> {
		await NodeUtil.makeDirPromise(NodeUtil.getPath(arksPath, arkName, "Memories"), { recursive: true });
		await FileUtil.writeTextLocked(memoryPath(arkName, name), content);
		return content;
	}

	function cataloguePath(arkName: string): string {
		return NodeUtil.getPath(arksPath, arkName, "catalogue.json");
	}

	function memoryPath(arkName: string, name: string): string {
		return NodeUtil.getPath(arksPath, arkName, "Memories", `${name}.txt`);
	}
}