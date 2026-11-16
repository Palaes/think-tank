/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="../Adapters/ChatAdapter.ts" />
/// <reference path="../Adapters/ChatService.ts" />

/// <reference path="AgoraStreamer.ts" />
/// <reference path="ContextUtil.ts" />
/// <reference path="MemoryUtil.ts" />
/// <reference path="ParamsUtil.ts" />
/// <reference path="WorkshopUtil.ts" />

interface GenerateSettings {
	mainModel: string;
	visionModel: string;
	smallModel: string;
	thinking: ThoughtMode;
	prompt: string;
	think?: ThinkMode;
	temp?: number;
	topP?: number;
	topK?: number;
	numCtx?: number;
	numKeep?: number;
	numPredict?: number;
}

interface DescriptionField {
	name?: string;
	value?: string;
	description: string;
}

type ImageMode = "none" | "latest" | "raw";

namespace GenerateUtil {
	const agoraPath = SettingsUtil.getLocation("/ThinkTank/Agora");

	const latestCount = 3;

	export const defaultSettings: GenerateSettings = {
		mainModel: "default",
		visionModel: "default",
		smallModel: "default",
		thinking: "label",
		prompt: "You are sharp, analytical, insightful, truth seeking, balanced. You write in plain text, no formatting."
	};

	export async function expandPrompt(params: CombinedParams, prompt: string, fields: Dict<DescriptionField> = null, extra: Dict<string> = null): Promise<string> {
		const variables = await WorkshopUtil.getPromptVariables(params);
		if (extra) {
			for (const key in extra) {
				variables[key] = extra[key];
			}
		}
		variables.FIELDS = fields ? createFieldsPart(fields) ?? "" : "";
		let match: RegExpMatchArray;
		while (match = prompt.match(/\{\{([^{}]+)\}\}/)) {
			const outer = match[0];
			const inner = match[1];
			if (inner in variables) {
				prompt = prompt.replace(outer, variables[inner]);
			} else if (inner == "ARK") {
				prompt = prompt.replace(outer, params.process.arkName);
			} else if (inner == "USER") {
				prompt = prompt.replace(outer, params.process.userName);
			} else if (inner == "MODEL") {
				prompt = prompt.replace(outer, params.generate.mainModel);
			} else if (inner == "THINK") {
				prompt = prompt.replace(outer, String(params.generate.think));
			} else {
				const importPath = NodeUtil.getPath(agoraPath, inner);
				const importText = await FileUtil.readTextRAW(importPath);
				prompt = prompt.replace(outer, importText);
			}
		}
		return prompt;
	}

	export function addSystemPrompt(entries: ChatMessage[], systemPrompt: string): ChatMessage[] {
		if (systemPrompt == null) {
			return entries;
		}
		if (entries.length == 0) {
			return [{ role: "system", content: systemPrompt }];
		}
		const head = entries[0];
		if (head.role == "system") {
			return [{ role: "system", content: `${head.content}\n\n${systemPrompt}` }, ...entries.slice(1) ]
		}
		return [{ role: "system", content: systemPrompt }, ...entries ]
	}

	export function createFieldsPart(fields: Dict<DescriptionField>): string {
		const lines = [];
		for (const key in fields) {
			const field = fields[key];
			if (field.name) {
				lines.push(`${field.name}: [${field.description}]`);
			} else {
				lines.push(`[${field.description}]`);
			}
		}
		if (lines.length) {
			return lines.join("\n");
		}
		return null;
	}

	export async function generateRaw(params: CombinedParams, model: ModelParams, context: ChatMessage[], speak = false): Promise<string> {
		const handler = params.handler;
		const speechHandler: FetchHandler = {
			controller: handler.controller,
			checkAbort: handler.checkAbort,
			onChunk: handler.onChunk,
			onError: handler.onError,
			onSpeak: speak ? (chunk: string) => handler.onSpeak(chunk, params.tts) : null
		};
		return ChatService.generate({ ...model, thought: params.generate.thinking }, context, speechHandler);
	}

	// returns field value dict
	export async function generateFields(params: CombinedParams, model: ModelParams, prompt: string, context: ChatMessage[], fields: Dict<DescriptionField>): Promise<Dict<string>> {
		context = [ ...context ];
		context = addSystemPrompt(context, await createModelPart(params, model));
		context = addSystemPrompt(context, await expandPrompt(params, prompt, fields));
		const response = await generateRaw(params, model, context);
		return parseFields(response, fields);
	}

	export async function generateMemory(params: CombinedParams, block: ContextEntry[], fields: Dict<DescriptionField>): Promise<Dict<string>> {
		const model = ModelUtil.resolve(params, params.memory.model);
		const converted = await convertContext(params, block, model.vision ? "raw" : "none");
		const prompt = await expandPrompt(params, params.memory.prompt, fields);
		let context = [ ...converted ];
		context = addSystemPrompt(context, await createModelPart(params, model));
		context = addSystemPrompt(context, await expandPrompt(params, params.generate.prompt));
		context.push({ role: "user", content: prompt });
		const response = await generateRaw(params, model, context);
		return parseFields(response, fields);
	}

	export async function generateMessage(params: CombinedParams, context: ContextEntry[]): Promise<string> {
		const model = resolveMessageModel(params, context);
		const converted = await convertContext(params, context, model.vision ? "latest" : "none");
		const prompt = await expandPrompt(params, params.generate.prompt);
		const memories = await MemoryUtil.loadMemories(params, context, true);
		let result = addSystemPrompt(converted, await createModelPart(params, model));
		result = addSystemPrompt(result, prompt);
		result = addSystemPrompt(result, memories);
		return generateRaw(params, model, result, true);
	}

	export async function convertContext(params: CombinedParams, context: ContextEntry[], imageMode: ImageMode): Promise<ChatMessage[]> {
		// the clock setting keeps the ark aware of time, off leaves it without timestamps
		const gapHandler = params.process.useClock ? new DateGapHandler(1800000, 300000, 300000) : null;
		const template = { ...ContextUtil.arkTemplate, gapHandler };
		const result = [];
		let documentCount = 0;
		let imageCount = 0;
		let i = context.length;
		while (i--) {
			const entry = context[i];
			const fullDocument = documentCount < params.document.rawCount;
			const fullImage = shouldResolveImage(imageMode, entry, imageCount);
			result.unshift(await convertEntry(params, template, fullDocument, fullImage, entry));
			if (entry.type == "image") {
				++imageCount;
			}
			if (entry.type == "document") {
				++documentCount;
			}
		}
		return result;
	}

	async function convertEntry(params: CombinedParams, template: TranscriptTemplate, useFullDocument: boolean, useFullImage: boolean, entry: ContextEntry): Promise<ChatMessage> {
		if (entry.type == "message") {
			return convertMessage(entry, params.process.arkName, template);
		}
		if (entry.type == "image") {
			return await WorkshopUtil.convertArkImageEntry(params, entry, template, useFullImage);
		}
		return await WorkshopUtil.convertArkDocumentEntry(params, entry, template, useFullDocument);
	}

	function convertMessage(entry: ContextEntry, arkName: string, template: TranscriptTemplate): ChatMessage {
		if (entry.name == arkName) {
			return { role: "assistant", content: entry.content };
		}
		return { role: "user", content: ContextUtil.entryToText(entry, template) };
	}

	function shouldResolveImage(mode: ImageMode, entry: ContextEntry, count: number): boolean {
		if (entry.type == "image") {
			if (mode == "raw") {
				return entry.name == "raw";
			}
			if (mode == "latest") {
				return count < latestCount;
			}
		}
		return false;
	}

	function resolveMessageModel(params: CombinedParams, context: ContextEntry[]): ModelParams {
		const main = ModelUtil.resolve(params, params.generate.mainModel);
		if (main.vision) {
			return main;
		}
		const vision = ModelUtil.resolve(params, params.generate.visionModel);
		if (vision.vision && lastTurnHasImage(context)) {
			return vision;
		}
		return main;
	}

	function lastTurnHasImage(context: ContextEntry[]): boolean {
		for (let index = context.length - 1; index >= 0; --index) {
			const entry = context[index];
			if (entry.type == "image") {
				return true;
			}
			if (entry.role == "user") {
				break;
			}
		}
		return false;
	}

	export function parseFields(response: string, fields: Dict<DescriptionField>): Dict<string> {
		const values = {};
		for (const key in fields) {
			const field = fields[key];
			if (field.name) {
				values[field.name] = field.value;
			}
		}
		const remainder = TextUtil.parseLineFields(response, values);
		const result = {};
		for (const key in fields) {
			const field = fields[key];
			if (field.name) {
				result[key] = values[field.name];
			} else {
				result[key] = remainder;
			}
		}
		return result;
	}

	export async function createModelPart(params: CombinedParams, model: ModelParams): Promise<string> {
		if (model.tweak == null || model.tweak == "") {
			return null;
		}
		return expandPrompt(params, model.tweak);
	}
}