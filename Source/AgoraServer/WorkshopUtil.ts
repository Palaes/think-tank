/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />

/// <reference path="../Adapters/ChatAdapter.ts" />

/// <reference path="../Workshops/WebWorkshop.ts" />
/// <reference path="../Workshops/ImageWorkshop.ts" />
/// <reference path="../Workshops/DocumentWorkshop.ts" />
/// <reference path="../Workshops/TODOWorkshop.ts" />
/// <reference path="../Workshops/IdeaWorkshop.ts" />
/// <reference path="../Workshops/DreamWorkshop.ts" />

/// <reference path="ActionsUtil.ts" />
/// <reference path="ChatUtil.ts" />
/// <reference path="ContextUtil.ts" />
/// <reference path="MemoryUtil.ts" />
/// <reference path="ParamsUtil.ts" />
/// <reference path="ProcessUtil.ts" />

interface WorkshopSettings {
	interval: string;
	schedules: Dict<WorkshopSchedule>;
}

interface PromptPart {
	variable: string;
	description: string;
	content: string;
}

interface WorkshopSchedule {
	next: string;
	repeat?: string;
	call: string;
	params?: any;
}

type ScheduleCallback = (params: any) => Promise<void>;

interface WorkshopInitializer {
	initialize(): Promise<void>;
}

type ActionCallback = (params: CombinedParams, entry: ContextEntry, parameters: string) => Promise<any>;

interface SettingsProvider {
	readSettings(): Promise<any>;
}

interface PromptProvider {
	getPromptParts(params: CombinedParams): Promise<PromptPart[]>;
}

interface ContextListener {
	onUpdate(params: CombinedParams, context: ContextEntry[]): Promise<void>;
	onBlock(params: CombinedParams, block: ContextEntry[]): Promise<void>;
	onDelete(params: CombinedParams): Promise<void>;
}

interface MessageProcessor {
	processMessage(params: CombinedParams, entry: ContextEntry, output: ContextEntry[]): Promise<void>;
}

interface ImageProcessor {
	processImage(params: CombinedParams, entry: ContextEntry): Promise<ContextEntry>;
	convertArkImage(params: CombinedParams, entry: ContextEntry, template: TranscriptTemplate, needsImage: boolean): Promise<ChatMessage>;
}

interface DocumentProcessor {
	processDocument(params: CombinedParams, entry: ContextEntry): Promise<ContextEntry>;
	convertArkDocument(params: CombinedParams, entry: ContextEntry, template: TranscriptTemplate, needsDocument: boolean): Promise<ChatMessage>;
}

interface ResultProcessor {
	processResult(params: CombinedParams, source: string, result: any): Promise<ContextEntry>;
}

interface ActionProvider {
	getActions(params: CombinedParams): Dict<Dict<ActionCallback>>;
}

namespace WorkshopUtil {
	export const defaultSettings: WorkshopSettings = {
		interval: "1h",
		schedules: {}
	};

	const settingsProviders: Dict<SettingsProvider> = {
		web: WebWorkshop,
		image: ImageWorkshop,
		document: DocumentWorkshop,
		todo: TODOWorkshop,
		idea: IdeaWorkshop,
		dream: DreamWorkshop
	};

	// ProcessUtil is emitted after this module, so the provider is resolved at call time
	const chatProvider = {
		getActions: (params: CombinedParams) => ProcessUtil.getActions(params),
		getPromptParts: (params: CombinedParams) => ProcessUtil.getPromptParts(params)
	};

	const promptProviders: Dict<PromptProvider> = {
		web: WebWorkshop,
		image: ImageWorkshop,
		document: DocumentWorkshop,
		todo: TODOWorkshop,
		idea: IdeaWorkshop,
		dream: DreamWorkshop,
		memory: MemoryUtil,
		chat: chatProvider
	};

	const contextListeners: Dict<ContextListener> = {
		memory: MemoryUtil,
		idea: IdeaWorkshop
	};

	const messageProcessors: Dict<MessageProcessor> = {
		actions: ActionsUtil
	};

	const imageProcessors: Dict<ImageProcessor> = {
		image: ImageWorkshop
	};

	const documentProcessors: Dict<DocumentProcessor> = {
		document: DocumentWorkshop
	};

	const actionHandlers: Dict<ActionProvider> = {
		web: WebWorkshop,
		image: ImageWorkshop,
		document: DocumentWorkshop,
		todo: TODOWorkshop,
		idea: IdeaWorkshop,
		dream: DreamWorkshop,
		chat: chatProvider
	};

	const scheduleHandlers: Dict<ScheduleCallback> = {
		"memory-main": MemoryUtil.onWakeUp,
		"image-main": ImageWorkshop.onWakeUp,
		"document-main": DocumentWorkshop.onWakeUp,
		"idea-main": IdeaWorkshop.onWakeUp,
		"dream": DreamWorkshop.onWakeUp,
		"onSchedule": TODOWorkshop.onSchedule,
		"onRemind": TODOWorkshop.onRemind
	};

	const initializers: Dict<WorkshopInitializer> = {
		web: WebWorkshop,
		image: ImageWorkshop,
		document: DocumentWorkshop,
		todo: TODOWorkshop,
		idea: IdeaWorkshop,
		dream: DreamWorkshop,
		memory: MemoryUtil
	};

	export async function initialize(): Promise<void> {
		for (const key in initializers) {
			await initializers[key].initialize();
		}
		await startScheduler();
	}

	export async function getSettings(): Promise<Dict<any>> {
		const result = {};
		for (const key in settingsProviders) {
			result[key] = await settingsProviders[key].readSettings();
		}
		return result;
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		const result = [];
		for (const key in promptProviders) {
			const parts = await promptProviders[key].getPromptParts(params);
			result.push(...parts);
		}
		return result;
	}

	export async function getPromptVariables(params: CombinedParams): Promise<Dict<string>> {
		const groups: Dict<string[]> = {};
		for (const part of await WorkshopUtil.getPromptParts(params)) {
			if (part.variable == null || part.content == null || part.content == "") {
				continue;
			}
			if (groups[part.variable] == null) {
				groups[part.variable] = [];
			}
			groups[part.variable].push(part.content);
		}
		const result: Dict<string> = { ACTIONS: "" };
		for (const variable in groups) {
			result[variable] = groups[variable].join("\n\n");
		}
		return result;
	}

	export async function onUpdate(params: CombinedParams, context: ContextEntry[]): Promise<void> {
		for (const key in contextListeners) {
			if (isEnabled(params, key)) {
				await contextListeners[key].onUpdate(params, context);
			}
		}
	}

	export async function onBlock(params: CombinedParams, block: ContextEntry[]): Promise<void> {
		for (const key in contextListeners) {
			if (isEnabled(params, key)) {
				await contextListeners[key].onBlock(params, block);
			}
		}
	}

	export async function onDelete(params: CombinedParams): Promise<void> {
		for (const key in contextListeners) {
			await contextListeners[key].onDelete(params);
		}
	}

	// TODO: Unify these?
	export async function processMessage(params: CombinedParams, entry: ContextEntry, output: ContextEntry[]): Promise<void> {
		for (const key in messageProcessors) {
			await messageProcessors[key].processMessage(params, entry, output);
		}
	}

	// TODO: Unify these?
	export async function processImage(params: CombinedParams, entry: ContextEntry): Promise<ContextEntry> {
		for (const key in imageProcessors) {
			return await imageProcessors[key].processImage(params, entry);
		}
		return entry;
	}

	// TODO: Unify these?
	export async function processDocument(params: CombinedParams, entry: ContextEntry): Promise<ContextEntry> {
		for (const key in documentProcessors) {
			return await documentProcessors[key].processDocument(params, entry);
		}
		return entry;
	}

	// TODO: Unify these?
	export async function convertArkImageEntry(params: CombinedParams, entry: ContextEntry, template: TranscriptTemplate, needsImage: boolean): Promise<ChatMessage> {
		for (const key in imageProcessors) {
			return await imageProcessors[key].convertArkImage(params, entry, template, needsImage);
		}
		return { role: "user", content: ContextUtil.entryToText(entry, template) };
	}

	// TODO: Unify these?
	export async function convertArkDocumentEntry(params: CombinedParams, entry: ContextEntry, template: TranscriptTemplate, needsDocument: boolean): Promise<ChatMessage> {
		for (const key in documentProcessors) {
			return await documentProcessors[key].convertArkDocument(params, entry, template, needsDocument);
		}
		return { role: "user", content: ContextUtil.entryToText(entry, template) };
	}

	export function gatherActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		const result = {};
		for (const key in actionHandlers) {
			const actions = actionHandlers[key].getActions(params);
			for (const group in actions) {
				result[group] = actions[group];
			}
		}
		return result;
	}

	// Recurring schedule under the call's own name, kept when already present.
	export async function scheduleEvery(call: string, repeat: string, params?: any): Promise<void> {
		await setSchedule(call, { next: nextRound(), repeat, call, params });
	}

	// One-shot or repeating schedule under the given id.
	export async function scheduleAt(id: string, next: string, call: string, params?: any, repeat?: string): Promise<void> {
		await setSchedule(id, { next, repeat, call, params });
	}

	// Drops the schedule with the given id, reporting whether it was there.
	export async function removeSchedule(id: string): Promise<boolean> {
		const lock = await Mutex.lock("WorkshopSchedules");
		try {
			const settings = await ChatUtil.readGlobalSettings();
			if (id in settings.workshop.schedules == false) {
				return false;
			}
			const schedules = { ...settings.workshop.schedules };
			schedules[id] = null;
			const interval = settings.workshop.interval;
			await ChatUtil.editGlobalSettings({ workshop: { interval, schedules } });
			return true;
		} finally {
			lock.release();
		}
	}

	function nextRound(): string {
		return DateUtil.formatWhen({ time: DateUtil.nextMinute(Date.now()), hasTime: true });
	}

	async function setSchedule(id: string, schedule: WorkshopSchedule): Promise<void> {
		const lock = await Mutex.lock("WorkshopSchedules");
		try {
			const settings = await ChatUtil.readGlobalSettings();
			if (id in settings.workshop.schedules && schedule.repeat) {
				return;
			}
			const schedules = { ...settings.workshop.schedules, [id]: schedule };
			const interval = settings.workshop.interval;
			await ChatUtil.editGlobalSettings({ workshop: { interval, schedules } });
		} finally {
			lock.release();
		}
	}

	async function startScheduler(): Promise<void> {
		const settings = await ChatUtil.readGlobalSettings();
		setTimeout(tick, DateUtil.durationMillis(settings.workshop.interval) ?? 60000);
	}

	// Re-arms only after a run, so long wakeups delay instead of pile up.
	async function tick(): Promise<void> {
		try {
			for (const schedule of await takeDueSchedules(Date.now())) {
				const handler = scheduleHandlers[schedule.call];
				if (handler) {
					try {
						await handler(schedule.params);
					} catch (error) {
						console.error(error);
					}
				}
			}
		} catch (error) {
			console.error(error);
		}
		const settings = await ChatUtil.readGlobalSettings();
		setTimeout(tick, DateUtil.durationMillis(settings.workshop.interval) ?? 60000);
	}

	// Removes the due schedules, repeating or dropping them.
	async function takeDueSchedules(now: number): Promise<WorkshopSchedule[]> {
		const lock = await Mutex.lock("WorkshopSchedules");
		try {
			const settings = await ChatUtil.readGlobalSettings();
			const schedules = { ...settings.workshop.schedules };
			const due = [];
			let changed = false;
			for (const id in schedules) {
				const schedule = schedules[id];
				const time = DateUtil.whenTime(schedule.next);
				if (time == null || now < time) {
					continue;
				}
				due.push(schedule);
				changed = true;
				if (schedule.repeat) {
					schedules[id] = { ...schedule, next: DateUtil.advanceWhen(schedule.next, schedule.repeat, now) };
				} else {
					schedules[id] = null;
				}
			}
			if (changed) {
				const interval = settings.workshop.interval;
				await ChatUtil.editGlobalSettings({ workshop: { interval, schedules } });
			}
			return due;
		} finally {
			lock.release();
		}
	}

	function isEnabled(params: CombinedParams, key: string): boolean {
		const group = params[key];
		if (group == null) {
			return false;
		}
		if (group.enabled == null) {
			return true;
		}
		return group.enabled == true;
	}
}