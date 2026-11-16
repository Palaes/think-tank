/// <reference path="AgoraStreamer.ts" />
/// <reference path="ArkUtil.ts" />
/// <reference path="ChatUtil.ts" />
/// <reference path="ContextUtil.ts" />
/// <reference path="GenerateUtil.ts" />
/// <reference path="MemoryUtil.ts" />
/// <reference path="ModelUtil.ts" />
/// <reference path="ParamsUtil.ts" />

/// <reference path="../Common/Globals.ts" />

interface ProcessSettings {
	userName: string;
	arkName: string;
	urgempt: string;
	useClock: boolean;
	useArchive: boolean;
	minContextCount: number;
	minContextSize: number;
	minBlockSize: number;
}

namespace ProcessAlt {
	function remember() {
	}

	function forget() {
	}

	function update() {
	}

	function sendMessage() {
	}

	function replyMessage() {
	}
}

namespace ProcessUtil {
	export const defaultSettings: ProcessSettings = {
		userName: "User",
		arkName: "Nemo",
		urgempt: `Score how urgently each participant should respond next.\n\nMemories:\n{{memories}}\n\nChat:\n{{chat}}\n\nOutput format:\n{{FIELDS}}`,
		useClock: true,
		useArchive: true,
		minContextCount: 5,
		minContextSize: 51200,
		minBlockSize: 2560
	};

	const overdueWeight = 3;
	const overdueWidth = 5;
	const randomWeight = 1;
	const memoryLimit = 12;
	const contextLimit = 12;

	export function getActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		return {
			chat: {
				call: callAction,
				leave: leaveAction
			}
		};
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		return [{
			variable: "ACTIONS",
			description: "Chat actions",
			content: `Chat Actions:
Invite an ark into the chat (user only):
@chat-call <arkName>
Leave the chat (arks only):
@chat-leave`
		}];
	}

	export async function callAction(params: CombinedParams, entry: ContextEntry, name: string): Promise<ContextEntry> {
		if (entry.role == "user") {
			name = (name ?? "").trim();
			if (name == params.process.userName) {
				return reportEntry("chat-call", `${name} is user`);
			}
			if (params.members.includes(name)) {
				return reportEntry("chat-call", `${name} already here`);
			}
			const arkList = await ArkUtil.getArkNames();
			if (arkList.includes(name)) {
				params.members.push(name);
				await ChatUtil.editChatSettings(params.chatID, { members: params.members });
				return reportEntry("chat-call", `${name} joined`);
			}
			return reportEntry("chat-call", `no ${name} known`);
		}
		return reportEntry("chat-call", `only user is allowed to call new members in`);
	}

	export async function leaveAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		if (entry.role == "ark") {
			if (entry.name == params.process.arkName) {
				return reportEntry("chat-leave", `${entry.name} is not allowed to leave`);
			}
			const index = params.members.indexOf(entry.name);
			if (index < 0) {
				return reportEntry("chat-leave", `${entry.name} not in the list of members`);
			}
			params.members.splice(index, 1);
			await ChatUtil.editChatSettings(params.chatID, { members: params.members });
			return reportEntry("chat-leave", `${entry.name} left`);
		}
		return reportEntry("chat-leave", `user is not allowed to leave the chat`);
	}

	export async function remember(params: CombinedParams): Promise<void> {
		const context = await ContextUtil.loadActive(params.chatID);
		await handleEnding(params, context);
	}

	export async function forget(params: CombinedParams): Promise<void> {
		MemoryUtil.removeChatMemories(params.chatID);
		// WorkshopUtil.onDelete(params);
	}

	export async function update(params: CombinedParams): Promise<void> {
		const context = await ContextUtil.loadActive(params.chatID);
		WorkshopUtil.onUpdate(params, context);
	}

	// Memorizes every block or drops the chat's memories, then moves the whole active context into the archive.
	export async function archive(params: CombinedParams, remember: boolean): Promise<void> {
		const context = await ContextUtil.loadActive(params.chatID);
		if (remember) {
			// the ending walk rewrites its argument, so it works on a copy
			await handleEnding(params, [ ...context ]);
		} else {
			await MemoryUtil.removeChatMemories(params.chatID);
		}
		if (context.length) {
			await ContextUtil.editArchive(params.chatID, Infinity, context);
		}
		await ContextUtil.writeActive(params.chatID, []);
		await ProcessUtil.update(params);
		const time = Date.now();
		await ChatUtil.editChatSettings(params.chatID, { updated: time, viewed: time, archived: true });
	}

	export async function replyMessage(params: CombinedParams): Promise<void> {
		const context = await ContextUtil.loadActive(params.chatID);
		const time = Date.now();
		const speaker = await nextSpeaker(params, context);
		if (speaker == null || speaker == params.process.userName) {
			// handing over to user
			return;
		}
		const speakerParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, speaker);
		params.handler.streamMessage("ark", speaker, time);
		const message = await GenerateUtil.generateMessage(speakerParams, context);
		params.handler.flushSpeech();
		if (message) {
			params.handler.streamRaw("\n");
			await ProcessUtil.sendMessage(speakerParams, "ark", speaker, message, [], []);
		}
	}

	export async function sendMessage(params: CombinedParams, role: string, name: string, content: string, images: string[], documents: string[]): Promise<void> {
		const input = await createInput(role, name, content, images, documents);
		const processed = await processInput(params, name, input);
		const context = await addToContext(params, processed);
		const time = Date.now();
		if (processed.length) {
			if (params.handler.hasStream()) {
				await ChatUtil.editChatSettings(params.chatID, { updated: time, viewed: time });
			} else {
				await ChatUtil.editChatSettings(params.chatID, { updated: time });
			}
		}
		const speaker = await nextSpeaker(params, context);
		if (speaker == null || speaker == params.process.userName) {
			// handing over to user
			return;
		}
		const speakerParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, speaker);
		params.handler.streamMessage("ark", speaker, time);
		const message = await GenerateUtil.generateMessage(speakerParams, context);
		params.handler.flushSpeech();
		if (message) {
			params.handler.streamRaw("\n");
			await ProcessUtil.sendMessage(speakerParams, "ark", speaker, message, [], []);
		}
	}

	export async function createInput(role: string, name: string, content: string, images: string[], documents: string[]): Promise<ContextEntry[]> {
		const result = [];
		const time = Date.now();
		result.push({ type: "message", time, role, name, content });
		for (const image of images) {
			result.push({ type: "image", name: "raw", content: image });
		}
		for (const document of documents) {
			result.push({ type: "document", name: "raw", content: document });
		}
		return result;
	}

	async function processInput(params: CombinedParams, name: string, input: ContextEntry[]): Promise<ContextEntry[]> {
		const result = [];
		for (let entry of input) {
			if (entry.type == "message") {
				result.push(entry);
				if (entry.role == "user") {
					params.handler.streamEntry(entry);
				}
			} else {
				if (entry.type == "image") {
					entry = await WorkshopUtil.processImage(params, entry);
				} else {
					entry = await WorkshopUtil.processDocument(params, entry);
				}
				result.push(entry);
				params.handler.streamEntry(entry);
			}
		}
		for (let entry of input) {
			if (entry.type == "message") {
				await WorkshopUtil.processMessage(params, entry, result);
			}
		}
		return result;
	}

	async function addToContext(params: CombinedParams, entries: ContextEntry[]): Promise<ContextEntry[]> {
		const context = await ContextUtil.loadActive(params.chatID);
		context.push(...entries);
		// this changes context in place
		await checkSplit(params, context);
		await ContextUtil.writeActive(params.chatID, context);
		await WorkshopUtil.onUpdate(params, context);
		return context;
	}

	async function checkSplit(params: CombinedParams, context: ContextEntry[]): Promise<void> {
		// archiving off turns off block detection, everything stays in the active context
		if (params.process.useArchive == false) {
			return;
		}
		let messageCount = 0;
		let contextSize = 0;
		for (const entry of context) {
			if (entry.role == "user" || entry.role == "ark") {
				++messageCount;
				contextSize += entry.content.length;
			}
		}
		let currentBlock = [];
		let blockSize = 0;
		// context limit is minimal guaranteed to stay
		while (contextSize > params.process.minContextSize) {
			const entry = context.shift();
			if (entry.role == "user" || entry.role == "ark") {
				// previous block should close when new item is message
				if (blockSize > params.process.minBlockSize) {
					await ContextUtil.editArchive(params.chatID, Infinity, currentBlock);
					await WorkshopUtil.onBlock(params, currentBlock);
					currentBlock = [];
					blockSize = 0;
				}
				--messageCount;
				contextSize -= entry.content.length;
				blockSize += entry.content.length;
			}
			currentBlock.push(entry);
			// prevent context to end up with too few messages
			if (messageCount < params.process.minContextCount) {
				// overshoot so need to put back
				break;
			}
		}
		// put back small partial block
		if (currentBlock.length) {
			context.unshift(...currentBlock);
		}
	}

	async function handleEnding(params: CombinedParams, context: ContextEntry[]): Promise<void> {
		let contextSize = 0;
		for (const entry of context) {
			if (entry.type == "message") {
				contextSize += entry.content.length;
			}
		}
		let currentBlock = [];
		let blockSize = 0;
		while (contextSize > params.process.minBlockSize * 0.5) {
			const entry = context.shift();
			if (entry.type == "message") {
				// previous block should close when new item is message
				if (blockSize > params.process.minBlockSize) {
					await WorkshopUtil.onBlock(params, currentBlock);
					currentBlock = [];
					blockSize = 0;
				}
				contextSize -= entry.content.length;
				blockSize += entry.content.length;
			}
			currentBlock.push(entry);
		}
		// memorize all the leftovers
		context.unshift(...currentBlock);
		if (context.length) {
			await WorkshopUtil.onBlock(params, context);
		}
	}

	async function nextSpeaker(params: CombinedParams, context: ContextEntry[]): Promise<string> {
		if (AgoraStreamer.checkRaised(params.chatID)) {
			return params.process.userName;
		}
		if (params.members.length < 3) {
			return privateChatNext(params, context);
		}
		return groupChatNext(params, context);
	}

	function privateChatNext(params: CombinedParams, context: ContextEntry[]): string {
		let index = context.length;
		while (index) {
			--index;
			const entry = context[index];
			if (entry.role == "env") {
				return params.process.arkName;
			}
			if (entry.role == "user") {
				return params.process.arkName;
			}
			if (entry.role == "ark") {
				return params.process.userName;
			}
		}
		return params.process.userName;
	}

	async function groupChatNext(params: CombinedParams, context: ContextEntry[]): Promise<string> {
		const members = collectMembers(params, context);
		const urgencies = await inferUrgencies(params, context) ?? {};
		let maxScore = -Infinity;
		let maxName = params.process.userName;
		for (const name of params.members) {
			const urgency = urgencies[name] ?? 3;
			const index = members[name];
			const x = index / params.members.length;
			const overdue = 1 - 1 / (1 + Math.pow(x / overdueWidth, 3));
			const random = Math.random() * randomWeight;
			const score = urgency + overdue * overdueWeight + random;
			if (maxScore < score) {
				maxScore = score;
				maxName = name;
			}
		}
		return maxName;
	}

	function collectMembers(params: CombinedParams, messages: ContextEntry[]): Dict<number> {
		const turns = [];
		for (const message of messages) {
			if (message.role == "user" || message.role == "ark") {
				turns.push(message);
			}
		}
		const members = {};
		for (const name of params.members) {
			members[name] = 0;
		}
		let index = turns.length;
		while (index--) {
			const message = turns[index];
			if (members[message.name] == 0) {
				members[message.name] = index;
			}
		}
		for (const name in members) {
			members[name] = turns.length - members[name] - 1;
		}
		return members;
	}

	async function inferUrgencies(params: CombinedParams, context: ContextEntry[]): Promise<Dict<number>> {
		try {
			const fields = {};
			for (const name of params.members) {
				fields[name] = { name, description: "urgency as one digit from 0 to 9" };
			}
			const model = ModelUtil.resolve(params, params.generate.smallModel);
			const handler = new AgoraStreamer(`${params.chatID}.urgency`, null);
			const prompt = await GenerateUtil.expandPrompt(params, params.process.urgempt, fields);
			const content = await buildUrgencyContent(params, context);
			const values = await GenerateUtil.generateFields({ ...params, handler }, model, prompt, [{ role: "user", content }], fields);
			console.warn("Urgencies:", values);
			const result = {};
			for (const name of params.members) {
				const value = parseInt(values[name]);
				// trusting prompt not to output out of bounds number
				result[name] = isNaN(value) ? 3 : value;
			}
			return result;
		} catch (error) {
			console.warn(error);
			return null;
		}
	}

	async function buildUrgencyContent(params: CombinedParams, context: ContextEntry[]): Promise<string> {
		const parts = [];
		for (const name of params.members) {
			if (name == params.process.userName) {
				continue;
			}
			const memories = await MemoryUtil.loadShortMemories(name, context, memoryLimit);
			if (memories.length == 0) {
				continue;
			}
			memories.unshift(name);
			parts.push(memories.join("\n"));
		}
		const memories = parts.join("\n\n");
		const chatTemplate = {
			...ContextUtil.archiveTemplate,
			lineCount: 3,
			lineLength: 200,
			delimeter: "\n",
			user: "{{name}}:\n{{content}}",
			ark: "{{name}}:\n{{content}}",
			env: "Result:\n{{content}}"
		};
		const history = ContextUtil.contextToText(context, chatTemplate, contextLimit);
		return `Memories:\n\n${memories}\n\nHistory:\n\n${history}`
	}

	function reportEntry(name: string, content: string): ContextEntry {
		return { type: "message", time: Date.now(), role: "env", name, content };
	}
}