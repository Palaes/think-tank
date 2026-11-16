/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />

/// <reference path="../ContentServer/LibraryUtil.ts" />

/// <reference path="ArkUtil.ts" />

interface PromptListing {
	global: string[];
	arks: Dict<string[]>;
}

namespace PromptUtil {
	const agoraPath = SettingsUtil.getLocation("/ThinkTank/Agora");
	const promptsPath = NodeUtil.getPath(agoraPath, "Prompts");
	const arksPath = NodeUtil.getPath(agoraPath, "Arks");

	export async function listPrompts(): Promise<PromptListing> {
		const result: PromptListing = { global: await listMarkdown(promptsPath), arks: {} };
		for (const arkName of await ArkUtil.getArkNames()) {
			result.arks[arkName] = await listMarkdown(NodeUtil.getPath(arksPath, arkName));
		}
		return result;
	}

	export async function readPrompt(arkName: string, name: string): Promise<string> {
		return FileUtil.readTextLocked(getPromptPath(arkName, name));
	}

	export async function writePrompt(arkName: string, name: string, content: string): Promise<string> {
		await FileUtil.writeTextLocked(getPromptPath(arkName, name), content);
		return content;
	}

	// a global prompt sits in Prompts, an ark prompt inside that ark's folder
	function getPromptPath(arkName: string, name: string): string {
		if (arkName) {
			return NodeUtil.getPath(arksPath, arkName, name);
		}
		return NodeUtil.getPath(promptsPath, name);
	}

	async function listMarkdown(root: string): Promise<string[]> {
		const result = [];
		for (const name of await LibraryUtil.listDirectoryEntries(root)) {
			if (name.endsWith(".md")) {
				result.push(name);
			}
		}
		result.sort();
		return result;
	}
}