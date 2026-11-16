/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Adapters/WebAdapter.ts" />
/// <reference path="../Adapters/WebService.ts" />

interface WebSettings {
	enabled: boolean;
	APIType: string;
	APIHost: string;
	APIKey: string;
}

// TODO: The maxLenght and maxCount values should be coming from the settings too.
namespace WebWorkshop {
	export const rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Web");
	export const settingsPath = NodeUtil.getPath(rootPath, "settings.json");

	export const defaultWebSettings = {
		enabled: true,
		APIType: "ollama",
		APIHost: "https://ollama.com/api",
		APIKey: ""
	};

	export function getActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		if (params.web.enabled) {
			return {
				web: {
					fetch: fetchAction,
					search: searchAction,
					"wide-search": wideSearchAction,
					"deep-search": deepSearchAction
				}
			};
		}
		return {};
	}

	export async function initialize(): Promise<void> {
		await NodeUtil.makeDirPromise(rootPath, { recursive: true });
		await ensureSettings();
	}

	export async function ensureSettings(): Promise<void> {
		await SettingsUtil.ensure(settingsPath, defaultWebSettings);
	}

	export async function readSettings(): Promise<WebSettings> {
		return SettingsUtil.read(settingsPath, defaultWebSettings);
	}

	export async function editSettings(overrides: Partial<WebSettings>): Promise<WebSettings> {
		return SettingsUtil.edit(settingsPath, overrides, defaultWebSettings);
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		if (params.web.enabled == false) {
			return [];
		}
		return [{
			variable: "ACTIONS",
			description: "Web actions",
			content: `Web Actions:
Fetch info from the internet:
@web-fetch <url>
Search on the internet:
@web-search <query>
For many short search results:
@web-wide-search <query>
For many long search results:
@web-deep-search <query>`
		}];
	}

	export async function fetchAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<string> {
		return WebService.fetch({ ...params.web, maxLength: 8000 }, args);
	}

	export async function searchAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<string> {
		return WebService.search({ ...params.web, maxCount: 8, maxLength: 2000 }, args);
	}

	export async function wideSearchAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<string> {
		return WebService.search({ ...params.web, maxCount: 32, maxLength: 500 }, args);
	}

	export async function deepSearchAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<string> {
		return WebService.search({ ...params.web, maxCount: 32, maxLength: 5000 }, args);
	}
}