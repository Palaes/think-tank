/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="../Adapters/TTSService.ts" />

/// <reference path="../ContentServer/LibraryUtil.ts" />

/// <reference path="ContextUtil.ts" />
/// <reference path="ProcessUtil.ts" />
/// <reference path="GenerateUtil.ts" />
/// <reference path="MemoryUtil.ts" />
/// <reference path="ActionsUtil.ts" />
/// <reference path="WorkshopUtil.ts" />

interface GlobalSettings {
	lastIndex: number;
	process: ProcessSettings;
	generate: GenerateSettings;
	memory: MemorySettings;
	actions: ActionsSettings;
	workshop: WorkshopSettings;
	tts: TTSSettings;
}

interface ChatSettings {
	title: string;
	created: number;
	updated: number;
	viewed: number;
	archived: boolean;
	members: string[];
	process?: Partial<ProcessSettings>;
	generate?: Partial<GenerateSettings>;
	memory?: Partial<MemorySettings>;
	actions?: Partial<ActionsSettings>;
	image?: Partial<ImageSettings>;
	document?: Partial<DocumentSettings>;
	idea?: Partial<IdeaSettings>;
	todo?: Partial<TODOSettings>;
	web?: Partial<WebSettings>;
}

interface ChatMeta {
	chatID: string;
	title: string;
	created: number;
	updated: number;
	viewed: number;
	archived: boolean;
}

namespace ChatUtil {
	const globalSettingsPath = SettingsUtil.getLocation("/ThinkTank/Agora/settings.json");

	const defaultGlobalSettings: GlobalSettings = {
		lastIndex: 0,
		workshop: WorkshopUtil.defaultSettings,
		process: ProcessUtil.defaultSettings,
		generate: GenerateUtil.defaultSettings,
		memory: MemoryUtil.defaultSettings,
		actions: ActionsUtil.defaultSettings,
		tts: TTSService.defaultSettings
	};

	const chatsPath = SettingsUtil.getLocation("/ThinkTank/Agora/Chats");

	const defaultChatSettings: ChatSettings = {
		title: "untitled",
		created: 0,
		updated: 0,
		viewed: 0,
		archived: false,
		members: null
	};

	export async function initialize(): Promise<void> {
		await NodeUtil.makeDirPromise(chatsPath, { recursive: true });
		await SettingsUtil.ensure(globalSettingsPath, defaultGlobalSettings);
	}

	export async function readGlobalSettings(): Promise<GlobalSettings> {
		return SettingsUtil.read(globalSettingsPath, defaultGlobalSettings);
	}

	export async function editGlobalSettings(overrides: Partial<GlobalSettings>): Promise<GlobalSettings> {
		return SettingsUtil.edit(globalSettingsPath, overrides, defaultGlobalSettings);
	}

	export async function readChatSettings(chatID: string): Promise<ChatSettings> {
		const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
		return SettingsUtil.read(settingsPath, defaultChatSettings);
	}

	export async function editChatSettings(chatID: string, overrides: Partial<ChatSettings>): Promise<ChatSettings> {
		const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
		return SettingsUtil.edit(settingsPath, overrides, defaultChatSettings);
	}

	export async function getChatMetas(): Promise<ChatMeta[]> {
		const result = [];
		for (const chatID of await LibraryUtil.listFoldersWithSettings(chatsPath)) {
			const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
			const settingsData = await FileUtil.readJSONLocked(settingsPath);
			if (settingsData) {
				result.push({
					chatID,
					title: settingsData.title,
					created: settingsData.created,
					updated: settingsData.updated,
					viewed: settingsData.viewed,
					archived: settingsData.archived == true
				});
			}
		}
		return result;
	}

	export async function existsChat(chatID: string): Promise<boolean> {
		const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
		return FileUtil.exists(settingsPath);
	}

	// A chat can take reports while it exists and is not archived.
	export async function isChatAvailable(chatID: string): Promise<boolean> {
		if (chatID == null) {
			return false;
		}
		if (await existsChat(chatID) == false) {
			return false;
		}
		const settings = await readChatSettings(chatID);
		return settings.archived == false;
	}

	export async function latestChat(): Promise<string> {
		let result = null;
		let updated = 0;
		for (const meta of await getChatMetas()) {
			if (meta.archived) {
				continue;
			}
			if (updated < meta.updated) {
				updated = meta.updated;
				result = meta.chatID;
			}
		}
		return result;
	}

	async function createMeta(): Promise<ChatMeta> {
		const { year, month, day, time, padded } = await LibraryUtil.nextParts(globalSettingsPath);
		return {
			chatID: `${year}-${month}-${day}-${padded}`,
			title: `Chat ${year}-${month} ${padded}`,
			created: time,
			updated: time,
			viewed: time,
			archived: false
		};
	}

	export async function createChat(): Promise<ChatMeta> {
		const chatMeta = await createMeta();
		const chatFolder = NodeUtil.getPath(chatsPath, chatMeta.chatID);
		await NodeUtil.makeDirPromise(chatFolder, { recursive: true });
		await editChatSettings(chatMeta.chatID, {
			title: chatMeta.title,
			created: chatMeta.created,
			updated: chatMeta.updated,
			viewed: chatMeta.viewed
		});
		await ContextUtil.writeArchive(chatMeta.chatID, []);
		await ContextUtil.writeActive(chatMeta.chatID, []);
		return chatMeta;
	}

	export async function copyChat(sourceID: string, title: string): Promise<ChatMeta> {
		const { chatID, created, updated, viewed } = await createMeta();
		const sourceFolder = NodeUtil.getPath(chatsPath, sourceID);
		const chatFolder = NodeUtil.getPath(chatsPath, chatID);
		await NodeUtil.makeDirPromise(chatFolder, { recursive: true });
		const sourceSettings = NodeUtil.getPath(sourceFolder, "settings.json");
		const settingsPath = NodeUtil.getPath(chatFolder, "settings.json");
		await NodeUtil.copyPromise(sourceSettings, settingsPath);
		const sourceArchive = NodeUtil.getPath(sourceFolder, "archive.json");
		const archivePath = NodeUtil.getPath(chatFolder, "archive.json");
		await NodeUtil.copyPromise(sourceArchive, archivePath);
		const sourceActive = NodeUtil.getPath(sourceFolder, "active.json");
		const activePath = NodeUtil.getPath(chatFolder, "active.json");
		await NodeUtil.copyPromise(sourceActive, activePath);
		await editChatSettings(chatID, {
			title,
			created,
			updated,
			viewed,
			archived: false,
			process: {
				useArchive: false
			},
			memory: {
				allowRead: false,
				allowWrite: false
			},
			idea: {
				enabled: false
			}
		});
		return { chatID, title, created, updated, viewed, archived: false };
	}

	export async function clearChat(chatID: string): Promise<void> {
		await ContextUtil.writeArchive(chatID, []);
		await ContextUtil.writeActive(chatID, []);
		const time = Date.now();
		await editChatSettings(chatID, { updated: time, viewed: time });
	}

	export async function deleteChat(chatID: string): Promise<void> {
		const chatFolder = NodeUtil.getPath(chatsPath, chatID);
		await NodeUtil.removePromise(chatFolder, { recursive: true });
	}

	export async function readContext(chatID: string): Promise<ContextEntry[]> {
		const archiveContext = await ContextUtil.loadArchive(chatID);
		const activeContext = await ContextUtil.loadActive(chatID);
		const time = Date.now();
		await editChatSettings(chatID, { viewed: time });
		return [ ...archiveContext, ...activeContext ];
	}

	// The full conversation as plain text, without touching the viewed time.
	export async function readTranscript(chatID: string): Promise<string> {
		const archiveContext = await ContextUtil.loadArchive(chatID) ?? [];
		const activeContext = await ContextUtil.loadActive(chatID) ?? [];
		const context = [ ...archiveContext, ...activeContext ];
		// the same date gap parameters the context view uses
		const template = { ...ContextUtil.archiveTemplate, gapHandler: new DateGapHandler(1800000, 300000, 300000) };
		return TextUtil.normalizeAll(ContextUtil.contextToText(context, template, Infinity));
	}

	export async function editContext(chatID: string, index: number, entries: ContextEntry[]): Promise<ContextEntry[]> {
		const context = await ContextUtil.editActive(chatID, index, entries);
		const time = Date.now();
		await editChatSettings(chatID, { updated: time, viewed: time });
		return context;
	}

	// TODO: This is more ContextUtil territory.
	export async function popMessage(chatID: string, role: string, shallow: boolean): Promise<any> {
		const context = await ContextUtil.loadActive(chatID);
		let images = [];
		let documents = [];
		let i = context.length;
		while (i--) {
			const entry = context[i];
			if (entry.role == role) {
				const message = { content: entry.content, images, documents };
				context.splice(i);
				await ContextUtil.writeActive(chatID, context);
				const time = Date.now();
				await editChatSettings(chatID, { updated: time, viewed: time });
				return message;
			}
			if (entry.type == "message") {
				images = [];
				documents = [];
				if (shallow) {
					return {};
				}
			} else if (entry.type == "image") {
				if (entry.name == "raw") {
					images.push(entry.content);
				}
			} else if (entry.type == "document") {
				if (entry.name == "raw") {
					documents.push(entry.content);
				}
			}
		}
		return {};
	}

	// support codes for settings UI

	export async function readRawGlobalSettings(): Promise<GlobalSettings> {
		return FileUtil.readJSONLocked(globalSettingsPath);
	}

	export async function readRawChatSettings(chatID: string): Promise<ChatSettings> {
		const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
		return FileUtil.readJSONLocked(settingsPath);
	}

	export async function setContextEntry(chatID: string, index: number, entry: ContextEntry): Promise<ContextEntry[]> {
		const context = await ContextUtil.setEntry(chatID, index, entry);
		const time = Date.now();
		await editChatSettings(chatID, { updated: time, viewed: time });
		return context;
	}
}