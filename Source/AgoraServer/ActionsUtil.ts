/// <reference path="ContextUtil.ts" />
/// <reference path="GenerateUtil.ts" />
/// <reference path="ParamsUtil.ts" />

interface ActionsSettings {
	enabled: boolean;
	generate: boolean;
	prompt: string;
}

namespace ActionsUtil {
	export const defaultSettings: ActionsSettings = {
		enabled: true,
		generate: true,
		prompt: "Summarize the following information, concise, clear, plain text, no formatting."
	};

	export async function processMessage(params: CombinedParams, entry: ContextEntry, output: ContextEntry[]): Promise<void> {
		const matches = entry.content.matchAll(/^@([\w]+)-([\w-]+)(?:[\t ]+(.+)|[\t ]+()|())/gm);
		for (const match of matches) {
			const result = await executeAction(params, entry, match[1], match[2], match[3]);
			if (typeof result == "string") {
				// streaming while processing for immediate generation feedback
				const entry = await processResult(params, match[1], match[2], result);
				output.push(entry);
			} else if (result == null) {
				continue;
			} else if (result.type == "message") {
				params.handler.streamEntry(result);
				output.push(result);
			} else {
				const name = `result of ${match[1]}-${match[2]} action`;
				const message: ContextEntry = { type: "message", time: Date.now(), role: "env", name, content: "" };
				params.handler.streamEntry(message);
				output.push(message);
				params.handler.streamEntry(result);
				output.push(result);
			}
		}
	}

	async function executeAction(params: CombinedParams, entry: ContextEntry, groupName: string, actionName: string, args: string): Promise<ContextEntry> {
		const actionGroup = WorkshopUtil.gatherActions(params)[groupName];
		if (actionGroup == null) {
			return reportError(`action group ${groupName} does not exist`)
		}
		const actionHandler = actionGroup[actionName];
		if (actionHandler == null) {
			return reportError(`action ${actionName} does not exist in group ${groupName}`);
		}
		try {
			return await actionHandler(params, entry, args);
		} catch (error) {
			console.warn(error);
			return reportError(`error during executing ${actionName} of ${groupName}`);
		}
	}

	async function processResult(params: CombinedParams, group: string, action: string, result: string): Promise<ContextEntry> {
		const source = `${group}-${action}`;
		params.handler.streamMessage("env", source, Date.now());
		if (params.actions.generate) {
			const model = ModelUtil.resolve(params, params.generate.smallModel);
			const prompt = await GenerateUtil.expandPrompt(params, params.actions.prompt);
			const context: ChatMessage[] = [{ role: "system", content: prompt }, { role: "user", content: result }];
			result = await GenerateUtil.generateRaw(params, model, context);
			params.handler.streamRaw("\n");
		} else {
			params.handler.streamEscaped(result);
			params.handler.streamRaw("\n");
		}
		result = result.trim();
		return { type: "message", time: Date.now(), role: "env", name: source, content: result };
	}

	function reportError(content: string): ContextEntry {
		console.warn(content);
		return { type: "message", time: Date.now(), role: "env", name: "actions", content };
	}
}