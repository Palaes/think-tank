/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="../AgoraServer/AgoraStreamer.ts" />
/// <reference path="../AgoraServer/ArkUtil.ts" />
/// <reference path="../AgoraServer/GenerateUtil.ts" />
/// <reference path="../AgoraServer/MemoryUtil.ts" />
/// <reference path="../AgoraServer/ModelUtil.ts" />
/// <reference path="../AgoraServer/ParamsUtil.ts" />

interface DreamSettings {
	enabled: boolean;
	interval: string;
	memoryCount: number;
	sentenceCount: number;
	reducePrompt: string;
	dreamPrompt: string;
}

namespace DreamWorkshop {
	export const rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Dream");
	export const settingsPath = NodeUtil.getPath(rootPath, "settings.json");

	export const defaultSettings: DreamSettings = {
		enabled: true,
		interval: "1d",
		memoryCount: 5,
		sentenceCount: 3,
		reducePrompt: "Reduce these fragments into short associative notes, plain text, no formatting.\n\n{{sentences}}",
		dreamPrompt: "Write a dream from these bits and pieces, plain text, no formatting.\n\nBITS AND PIECES:\n{{fragments}}"
	};

	export function getActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		if (params.dream.enabled) {
			return {
				dream: {
					dream: dreamAction
				}
			};
		}
		return {};
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		if (params.dream.enabled == false) {
			return [];
		}
		return [{
			variable: "ACTIONS",
			description: "Dream actions",
			content: `Dream Actions:
Dream from your memories:
@dream-dream`
		}];
	}

	export async function initialize(): Promise<void> {
		await NodeUtil.makeDirPromise(DreamWorkshop.rootPath, { recursive: true });
		const existed = await FileUtil.exists(DreamWorkshop.settingsPath);
		await SettingsUtil.ensure(DreamWorkshop.settingsPath, DreamWorkshop.defaultSettings);
		if (existed == false) {
			for (const arkName of await ArkUtil.getArkNames()) {
				await DreamWorkshop.scheduleArk(arkName);
			}
		}
	}

	export async function readSettings(): Promise<DreamSettings> {
		return SettingsUtil.read(DreamWorkshop.settingsPath, DreamWorkshop.defaultSettings);
	}

	export async function editSettings(overrides: Partial<DreamSettings>): Promise<DreamSettings> {
		return SettingsUtil.edit(DreamWorkshop.settingsPath, overrides, DreamWorkshop.defaultSettings);
	}

	export async function resolveSettings(arkName: string): Promise<DreamSettings> {
		const global = await DreamWorkshop.readSettings();
		const ark = await ArkUtil.readArkSettings(arkName);
		return SettingsUtil.mergeAll(global, ark.dream);
	}

	export async function scheduleArk(arkName: string): Promise<void> {
		const settings = await DreamWorkshop.resolveSettings(arkName);
		const interval = settings.interval || DreamWorkshop.defaultSettings.interval;
		const millis = DateUtil.durationMillis(interval) ?? 86400000;
		const next = DateUtil.formatWhen({ time: Date.now() + millis, hasTime: true });
		await WorkshopUtil.scheduleAt(`dream-${arkName}`, next, "dream", { arkName }, interval);
	}

	export async function onWakeUp(params: any): Promise<void> {
		const arkName = params?.arkName;
		if (arkName == null) {
			return;
		}
		const arks = await ArkUtil.getArkNames();
		if (arks.includes(arkName) == false) {
			await WorkshopUtil.removeSchedule(`dream-${arkName}`);
			return;
		}
		const silentID = `dream-${arkName}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const silent = new AgoraStreamer(silentID, null);
		try {
			const base = await ParamsUtil.getBaseParams(`dream-${arkName}`, silent);
			const dreams = await ParamsUtil.setArkSettings(base, arkName);
			dreams.process = { ...dreams.process, arkName };
			dreams.chatID = `dream-${arkName}`;
			await runDream(dreams, null);
		} catch (error) {
			console.warn(error);
		} finally {
			AgoraStreamer.end(silentID);
		}
	}

	export async function dreamAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		if (params.dream.enabled == false) {
			return DreamWorkshop.infoEntry("Dream workshop is disabled.");
		}
		const result = await runDream(params, params.handler);
		if (result == null) {
			return DreamWorkshop.infoEntry("No dream was generated.");
		}
		return null;
	}

	async function runDream(params: CombinedParams, infoHandler: AgoraStreamer): Promise<string> {
		const settings = params.dream;
		if (settings.enabled == false) {
			return null;
		}
		if (params.memory.allowWrite == false) {
			if (infoHandler) {
				infoHandler.streamInfo("Memory writing is disabled.");
			}
			return null;
		}
		if (params.memory.allowRead == false) {
			if (infoHandler) {
				infoHandler.streamInfo("Memory reading is disabled.");
			}
			return null;
		}
		const arkName = params.process.arkName;
		if (infoHandler) {
			infoHandler.streamInfo("Dreaming:");
		}
		const selected = await selectMemories(arkName, settings.memoryCount);
		if (selected.length == 0) {
			if (infoHandler) {
				infoHandler.streamInfo("No memories to dream from.");
			}
			return null;
		}
		const sentences = [];
		for (const item of selected) {
			const content = await MemoryUtil.readMemoryFile(arkName, item.name);
			if (content == null) {
				continue;
			}
			const parts = splitSentences(content);
			sentences.push(...pickSentences(parts, settings.sentenceCount));
		}
		if (sentences.length == 0) {
			if (infoHandler) {
				infoHandler.streamInfo("No sentences to dream from.");
			}
			return null;
		}
		shuffle(sentences);
		const scrambled = sentences.join(" ");
		if (infoHandler) {
			infoHandler.streamInfo("Reducing dream material:");
		}
		const reducePrompt = await composePrompt(params, settings.reducePrompt, "sentences", scrambled);
		const reduceModel = ModelUtil.resolve(params, params.generate.smallModel);
		let fragments = (await GenerateUtil.generateRaw(params, reduceModel, [ { role: "user", content: reducePrompt } ])).trim();
		if (fragments == "") {
			fragments = scrambled;
		}
		if (infoHandler) {
			infoHandler.streamInfo("Dreaming the dream:");
		}
		const dreamModel = ModelUtil.resolve(params, params.memory.model);
		const fields = {
			short: { name: "Short", description: "one line summary" },
			content: { description: "the dream itself" }
		};
		const systemParts = [];
		const modelPart = await GenerateUtil.createModelPart(params, dreamModel);
		if (modelPart) {
			systemParts.push(modelPart);
		}
		const basePrompt = await GenerateUtil.expandPrompt(params, params.generate.prompt ?? "");
		if (basePrompt) {
			systemParts.push(basePrompt);
		}
		const memories = await MemoryUtil.loadMemories(params, [ { type: "message", time: Date.now(), role: "user", name: "dream", content: fragments } ], true);
		if (memories) {
			systemParts.push(memories);
		}
		const context: ChatMessage[] = [];
		if (systemParts.length) {
			context.push({ role: "system", content: systemParts.join("\n\n") });
		}
		const dreamPrompt = await composePrompt(params, settings.dreamPrompt, "fragments", fragments, fields);
		context.push({ role: "user", content: dreamPrompt });
		const result = await GenerateUtil.generateRaw(params, dreamModel, context);
		const values = GenerateUtil.parseFields(result, fields);
		const paragraph = (values.content ?? "").trim();
		if (paragraph == "") {
			if (infoHandler) {
				infoHandler.streamInfo("Dream produced no text.");
			}
			return null;
		}
		const short = values.short?.trim() || TextUtil.shortifyLineNicely(paragraph.replace(/\s+/g, " "), 200);
		const weight = Math.max(1, ...selected.map(item => item.weight));
		const time = Date.now();
		const entry: MemoryEntry = { source: `dream-${arkName}`, short, start: time, end: time, weight };
		const name = await MemoryUtil.saveMemory(arkName, paragraph, entry);
		return name;
	}

	async function composePrompt(params: CombinedParams, template: string, key: string, value: string, fields: Dict<DescriptionField> = null): Promise<string> {
		const token = `\u0000${key.toUpperCase()}\u0000`;
		template = template.split(`{{${key}}}`).join(token);
		const result = await GenerateUtil.expandPrompt(params, template, fields);
		return result.split(token).join(value);
	}

	async function selectMemories(arkName: string, limit: number): Promise<{ name: string, weight: number }[]> {
		const candidates = [];
		for (const name of await MemoryUtil.listMemories(arkName)) {
			if (name.startsWith("active-")) {
				continue;
			}
			const entry = await MemoryUtil.readCatalogueEntry(arkName, name);
			const weight = Math.max(1, entry?.weight ?? 1);
			candidates.push({ name, weight });
		}
		const count = Math.max(0, Math.floor(limit));
		const result = [];
		while (result.length < count && candidates.length) {
			const name = pickWeighted(candidates);
			for (let i = 0; i < candidates.length; ++i) {
				if (candidates[i].name == name) {
					result.push(candidates[i]);
					candidates.splice(i, 1);
					break;
				}
			}
		}
		return result;
	}

	function pickWeighted(items: { name: string, weight: number }[]): string {
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

	function splitSentences(content: string): string[] {
		const text = content.replace(/\s+/g, " ").trim();
		const matches = text.match(/[^.!?]+[.!?]+/g) ?? [];
		const result = [];
		for (const match of matches) {
			const sentence = match.trim();
			if (sentence) {
				result.push(sentence);
			}
		}
		if (result.length == 0 && text) {
			result.push(text);
		}
		return result;
	}

	function pickSentences(sentences: string[], count: number): string[] {
		const result = [];
		const available = sentences.slice();
		const limit = Math.max(0, Math.floor(count));
		while (result.length < limit && available.length) {
			const index = Math.floor(Math.random() * available.length);
			result.push(available.splice(index, 1)[0]);
		}
		return result;
	}

	function shuffle(items: string[]): void {
		for (let i = items.length - 1; i > 0; --i) {
			const j = Math.floor(Math.random() * (i + 1));
			const value = items[i];
			items[i] = items[j];
			items[j] = value;
		}
	}

	export function resultEntry(name: string, content: string): ContextEntry {
		return { type: "message", time: Date.now(), role: "env", name, content };
	}

	export function infoEntry(content: string): ContextEntry {
		return { type: "message", time: Date.now(), role: "info", name: "dream", content };
	}
}
