/// <reference path="../Common/Globals.ts" />
/// <reference path="../Common/StreamUtil.ts" />
/// <reference path="../Adapters/ChatService.ts" />

class TextHandlers {
	private static readonly splits = [
		{ text: "", priority: 0, latestIndex: 0, length: 0, connector: "" },
		{ text: " ", priority: 1, latestIndex: 0, length: 1, connector: " " },
		{ text: "\n", priority: 2, latestIndex: 0, length: 1, connector: "\n" },
		{ text: "\n\n", priority: 3, latestIndex: 0, length: 2, connector: "\n\n" },
		{ text: "\n\n\n\n", priority: 4, latestIndex: 0, length: 4, connector: "\n\n\n\n" },
		{ text: "<split/>", priority: 5, latestIndex: 0, length: 8, connector: "\n\n<split/>\n\n" }
	];

	private static async * trimChunks(chunks: AsyncGenerator<any>): AsyncGenerator<any> {
		for await (const chunk of chunks as any) {
			chunk.content = chunk.content.trim();
			if (chunk.content) {
				yield chunk;
			}
		}
	}

	private static async * chunked(content: string, limit: number): AsyncGenerator<any> {
		if (content.length == 0) {
			yield {
				content: "",
				split: this.splits[0]
			};
			return;
		}
		let start = 0;
		let i = 0;
		let best = this.splits[0];
		while (true) {
			++i;
			if (i == content.length) {
				yield {
					content: content.slice(start),
					split: this.splits[0]
				};
				break;
			}
			for (const split of this.splits) {
				if (split.text == content.slice(i, i + split.length)) {
					split.latestIndex = i;
					if (best.priority < split.priority) {
						best = split;
					}
				}
			}
			if (i == start + limit) {
				yield {
					content: content.slice(start, best.latestIndex),
					split: best
				};
				start = best.latestIndex + best.length;
				i = best.latestIndex + best.length;
				best = this.splits[0];
			}
		}
	}

	public static async split(state: ExecutionState, limit: string, source: string, target: string): Promise<void> {
		const max = parseInt(limit) || 2000;
		source = await state.expandName(source);
		const input = state.getChannel(source);
		// prevents infinite circling when source and target are the same
		input.write(null);
		state.delete("index");
		for await (let text of input.read()) {
			for await (const trimmed of TextHandlers.trimChunks(TextHandlers.chunked(text, max))) {
				state.increment("index");
				state.increment("count");
				target = await state.expandName(target);
				const output = state.getChannel(target);
				// trimmed = await state.expandValue(trimmed);
				await output.write(trimmed);
			}
		}
	}

	public static async merge(state: ExecutionState, separator: string, source: string, target: string): Promise<void> {
		source = await state.expandName(source);
		const input = state.getChannel(source);
		let result = "";
		for await (const text of input.read()) {
			if (result) {
				result += separator;
			}
			result += text;
		}
		target = await state.expandName(target);
		const output = state.getChannel(target);
		// result = await state.expandValue(result);
		await output.write(result);
	}

	private static readonly defaultParams: ChatParams = {
		APIType: "ollama",
		APIHost: "http://localhost:11434/api/chat",
		APIKey: null,
		thought: "hidden",
		model: "qwen3.5:9b",
		think: false,
		temp: 0.35,
		topP: 0.85,
		topK: 35,
		numKeep: 1536,
		numPredict: 8192
	};

	private static async generate(messages: ChatMessage[], state: ExecutionState): Promise<string> {
		const chatParams = {
			...this.defaultParams,
			APIType: state.getString("APIType") ?? this.defaultParams.APIType,
			APIHost: state.getString("APIHost") ?? this.defaultParams.APIHost,
			APIKey: state.getString("APIKey") ?? this.defaultParams.APIKey,
			model: state.getString("model") ?? this.defaultParams.model,
			think: state.getBoolean("think") ?? this.defaultParams.think,
			temp: state.getNumber("temp") ?? this.defaultParams.temp,
			topP: state.getNumber("topP") ?? this.defaultParams.topP,
			topK: state.getNumber("topK") ?? this.defaultParams.topK,
			numKeep: state.getNumber("numKeep") ?? this.defaultParams.numKeep,
			numPredict: state.getNumber("numPredict") ?? this.defaultParams.numPredict
		};

		const print = state.getBoolean("print") ?? true;
		const handler: FetchHandler = {
			onChunk: (chunk: string) => {
				if (print) {
					state.stream(chunk);
				}
				return chunk;
			}
		};

		return ChatService.generate(chatParams, messages, handler);
	}

	public static async process(state: ExecutionState, prompt: string, source: string, target: string): Promise<void> {
		prompt = await state.expandValue(prompt);
		source = await state.expandName(source);
		const input = state.getChannel(source);
		input.write(null);
		state.delete("index");

		const limit = state.getNumber("limit") ?? 2000;
		const context = state.getBoolean("context") ?? false;
		const print = state.getBoolean("print") ?? true;

		for await (let text of input.read()) {
			state.increment("index");
			state.increment("count");
			text = await state.expandValue(text);
			let result = "";
			let prevInput: string;
			let prevOutput: string;
			const chunks = [];
			for await (const chunk of TextHandlers.chunked(text, limit)) {
				chunk.content = chunk.content.trim();
				if (chunk.content) {
					chunks.push(chunk);
				}
			}
			if (chunks.length == 0) {
				chunks.push({ content: "", split: TextHandlers.splits[0] });
			}
			for (const trimmed of chunks) {
				let messages: ChatMessage[];
				if (prevInput) {
					messages = [
						{ role: "system", content: prompt },
						{ role: "user", content: prevInput },
						{ role: "assistant", content: prevOutput },
						{ role: "user", content: trimmed.content }
					];
				} else {
					messages = [
						{ role: "system", content: prompt },
						{ role: "user", content: trimmed.content }
					];
				}
				if (context) {
					prevInput = trimmed.content;
				}
				const response = await TextHandlers.generate(messages, state);
				prevOutput = response;
				if (print) {
					state.stream(trimmed.split.connector);
				}
				result += response;
				result += trimmed.split.connector;
			}
			target = await state.expandName(target);
			const output = state.getChannel(target);
			await output.write(result);
		}
	}

	public static async replace(state: ExecutionState, pattern: string, replacement: string, source: string, target: string): Promise<void> {
		source = await state.expandName(source);
		const input = state.getChannel(source);
		// prevents infinite circling when source and target are the same
		input.write(null);
		state.delete("index");
		const regexp = new RegExp(pattern, "g");
		for await (let text of input.read()) {
			state.increment("index");
			state.increment("count");
			text = await state.expandValue(text);
			text = text.replace(regexp, replacement);
			target = await state.expandName(target);
			const output = state.getChannel(target);
			await output.write(text);
		}
	}

	public static async clean(state: ExecutionState, source: string, target: string): Promise<void> {
		source = await state.expandName(source);
		const input = state.getChannel(source);
		// prevents infinite circling when source and target are the same
		input.write(null);
		state.delete("index");
		for await (let text of input.read()) {
			state.increment("index");
			state.increment("count");
			text = text
				.replace(/\r\n?/g, "\n")
				.replace(/<split\/>/g, "\n\n<split/>\n\n")
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n\n\n+/g, "\n\n")
				.replace(/['‛’‚‹›]/g, "'")
				.replace(/["‟”„«»]/g, '"')
				.replace(/…/g, "...")
				.replace(/—/g, "–")
				.replace(/‑/g, "-")
				.replace(/(\w\: *)(\w)/g, (a: string, b: string, c: string) => b + c.toUpperCase())
				.replace(/(\w\.\.\. *)(\w)/g, (a: string, b: string, c: string) => b + c.toUpperCase())
				.replace(/[áéíóöőúüűq]/gi, (value: string) => value.toLowerCase())
				.trim();
			target = await state.expandName(target);
			const output = state.getChannel(target);
			await output.write(text);
		}
	}
}