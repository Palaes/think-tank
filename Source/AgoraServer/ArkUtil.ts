/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />

/// <reference path="../Adapters/TTSAdapter.ts" />

/// <reference path="../ContentServer/LibraryUtil.ts" />

interface ArkSettings {
	process?: Partial<ProcessSettings>;
	generate?: Partial<GenerateSettings>;
	memory?: Partial<MemorySettings>;
	actions?: Partial<ActionsSettings>;
	image?: Partial<ImageSettings>;
	document?: Partial<DocumentSettings>;
	web?: Partial<WebSettings>;
	idea?: Partial<IdeaSettings>;
	dream?: Partial<DreamSettings>;
	tts?: Partial<TTSSettings>;
}

interface ArkMeta {
	arkName: string;
	description: string;
}

namespace ArkUtil {
	const arksPath = SettingsUtil.getLocation("/ThinkTank/Agora/Arks");

	const defaultSettings: ArkSettings = {};

	export async function initialize(): Promise<void> {
		await NodeUtil.makeDirPromise(arksPath, { recursive: true });
		const arkList = await getArkNames();
		if (arkList.length) {
			return;
		}
		const arkFolder = NodeUtil.getPath(arksPath, "Nemo");
		await NodeUtil.makeDirPromise(arkFolder, { recursive: true });
		const settingsPath = NodeUtil.getPath(arkFolder, "settings.json");
		await SettingsUtil.edit(settingsPath, {}, {});
	}

	export async function readArkSettings(arkName: string): Promise<ArkSettings> {
		const settingsPath = NodeUtil.getPath(arksPath, arkName, "settings.json");
		return SettingsUtil.read(settingsPath, defaultSettings);
	}

	export async function editArkSettings(arkName: string, overrides: Partial<ArkSettings>): Promise<ArkSettings> {
		const settingsPath = NodeUtil.getPath(arksPath, arkName, "settings.json");
		return SettingsUtil.edit(settingsPath, overrides, defaultSettings);
	}

	export async function getArkNames(): Promise<string[]> {
		return LibraryUtil.listFoldersWithSettings(arksPath);
	}

	// support codes for settings UI

	export async function readRawArkSettings(arkName: string): Promise<ArkSettings> {
		const settingsPath = NodeUtil.getPath(arksPath, arkName, "settings.json");
		return FileUtil.readJSONLocked(settingsPath);
	}

	export async function createArk(name: string): Promise<string> {
		const arkFolder = NodeUtil.getPath(arksPath, name);
		await NodeUtil.makeDirPromise(arkFolder, { recursive: true });
		const settingsPath = NodeUtil.getPath(arkFolder, "settings.json");
		await SettingsUtil.edit(settingsPath, {}, {});
		return name;
	}

	export async function removeArk(name: string): Promise<string> {
		await NodeUtil.removePromise(NodeUtil.getPath(arksPath, name), { recursive: true });
		return name;
	}
}