/// <reference path="../Common/SettingsUtil.ts" />

/// <reference path="../Adapters/TTSAdapter.ts" />

/// <reference path="AgoraStreamer.ts" />
/// <reference path="ChatUtil.ts" />
/// <reference path="ArkUtil.ts" />
/// <reference path="ModelUtil.ts" />

interface CombinedSettings {
	chatID: string;
	members: string[];
	arkName: string;
	title: string;
	created: number;
	updated: number;
	viewed: number;
	archived: boolean;
	process: ProcessSettings;
	generate: GenerateSettings;
	memory: MemorySettings;
	actions: ActionsSettings;
	workshop: WorkshopSettings;
	image: ImageSettings;
	document: DocumentSettings;
	web: WebSettings;
	idea: IdeaSettings;
	dream: DreamSettings;
	todo: TODOSettings;
	tts: TTSSettings;
}

interface CombinedParams extends CombinedSettings {
	models: Dict<ModelParams>;
	handler: AgoraStreamer;
}

namespace ParamsUtil {
	export async function getBaseSettings(chatID: string): Promise<CombinedSettings> {
		const workshops = await WorkshopUtil.getSettings();
		const globalSettings = await ChatUtil.readGlobalSettings();
		const chatSettings = await ChatUtil.readChatSettings(chatID);
		return applyMemberDefaults(SettingsUtil.mergeAll(workshops, globalSettings, chatSettings, { chatID }));
	}

	export async function getCombinedSettings(chatID: string): Promise<CombinedSettings> {
		const baseSettings = await getBaseSettings(chatID);
		return mergeArkBelowChat(baseSettings, baseSettings.process.arkName);
	}

	export async function getBaseParams(chatID: string, handler: AgoraStreamer): Promise<CombinedParams> {
		const models = await ModelUtil.readModels();
		const workshops = await WorkshopUtil.getSettings();
		const globalSettings = await ChatUtil.readGlobalSettings();
		const chatSettings = await ChatUtil.readChatSettings(chatID);
		return applyMemberDefaults(SettingsUtil.mergeAll(workshops, globalSettings, chatSettings, { chatID, models, handler }));
	}

	export async function getCombinedParams(chatID: string, handler: AgoraStreamer, arkName?: string): Promise<CombinedParams> {
		const baseParams = await getBaseParams(chatID, handler);
		const result = await mergeArkBelowChat(baseParams, arkName ?? baseParams.process.arkName);
		result.process = { ...result.process, arkName: result.arkName };
		return result;
	}

	// library editors work without a chat, so only the global layer applies
	export async function getGlobalParams(handler: AgoraStreamer): Promise<CombinedParams> {
		const models = await ModelUtil.readModels();
		const workshops = await WorkshopUtil.getSettings();
		const globalSettings = await ChatUtil.readGlobalSettings();
		return applyMemberDefaults(SettingsUtil.mergeAll(workshops, globalSettings, { chatID: "global", models, handler }));
	}

	// a chat always has the user and its own ark, even before the first call
	function applyMemberDefaults<Type>(settings: Type): Type {
		const result: any = settings;
		if (result.members == null) {
			result.members = [ result.process.userName, result.process.arkName ];
		}
		return result;
	}

	// The ark layer sits below the chat layer, so a chat can override what its ark sets.
	async function mergeArkBelowChat<Type>(baseSettings: Type, arkName: string): Promise<Type> {
		const settings: any = baseSettings;
		const arkSettings = await ArkUtil.readArkSettings(arkName);
		const chatSettings = await ChatUtil.readChatSettings(settings.chatID);
		return applyMemberDefaults(SettingsUtil.mergeAll(baseSettings, arkSettings, chatSettings, { arkName }));
	}

	export async function setArkSettings<Type>(baseSettings: Type, arkName: string): Promise<Type> {
		const arkSettings = await ArkUtil.readArkSettings(arkName);
		return SettingsUtil.mergeAll(baseSettings, arkSettings, { arkName });
	}
}