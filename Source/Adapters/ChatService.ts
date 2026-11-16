/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FetchUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="ChatAdapter.ts" />
/// <reference path="OllamaAdapter.ts" />
/// <reference path="OpenAIAdapter.ts" />

namespace ChatService {
	const adapters = {
		"default": OllamaAdapter,
		"ollama": OllamaAdapter,
		"openai": OpenAIAdapter
	};

	export async function generate(params: ChatParams, context: ChatMessage[], handler: FetchHandler): Promise<string> {
		const adapter = adapters[params.APIType] ?? adapters["default"];
		const input = adapter.createChatRequestBody(params, context);

		let thought = null;
		let wrote = null;

		const processor = (line: string) => {
			try {
				checkAbort(handler);
				const data = adapter.processChatResponseLine(params, line);
				if (data.thinking) {
					// data.thinking = TextUtil.normalizeTypography(data.thinking);
					streamThought(params.thought, thought, wrote, data.thinking, handler.onChunk);
					thought = data.thinking;
					wrote = null;
				}
				if (data.content) {
					// data.content = TextUtil.normalizeTypography(data.content);
					streamContent(params.thought, thought, wrote, data.content, handler.onChunk);
					if (handler.onSpeak) {
						handler.onSpeak(data.content);
					}
					thought = null;
					wrote = data.content;
				}
				return data.content;
			} catch (error) {
				if (handler.onError) {
					handler.onError(error);
				}
				return "";
			}
		}

		const wrapper = {
			controller: handler.controller,
			checkAbort: handler.checkAbort,
			onChunk: processor,
			onError: handler.onError
		};

		const headers = { Authorization: `Bearer ${params.APIKey}`, ...CTJSON };
		try {
			const result = await fetchByLine(params.APIHost, "POST", headers, input, wrapper);
			return result.trim();
		} catch (error) {
			if (handler.onError) {
				handler.onError(error);
			}
			return "";
		}
	}

	function streamThought(mode: ThoughtMode, thought: string, wrote: string, thinking: string, streamCallback: StringCallback): void {
		if (mode == "hidden") {
			// nothing to do
		} else if (thought) {
			// continuation of thought
			if (mode == "visible") {
				streamCallback(thinking);
			}
		} else {
			if (wrote) {
				// ensuring blank line when switching from content
				if (wrote.endsWith("\n\n")) {
					// no need to stream newlines
				} else if (wrote.endsWith("\n")) {
					streamCallback("\n");
				} else {
					streamCallback("\n\n");
				}
			}
			// beginning of thought
			if (mode == "label") {
				streamCallback("Thinking...\n\n");
			} else if (mode == "visible") {
				streamCallback("Thoughts:\n\n");
				streamCallback(thinking.trimStart());
			}
		}
	}

	function streamContent(mode: ThoughtMode, thought: string, wrote: string, content: string, streamCallback: StringCallback): void {
		if (wrote) {
			// continuation of content
			streamCallback(content);
		} else {
			if (thought) {
				if (mode == "visible") {
					// ensuring blank line when switching from thought
					if (thought.endsWith("\n\n")) {
					// no need to stream newlines
					} else if (thought.endsWith("\n")) {
						streamCallback("\n");
					} else {
						streamCallback("\n\n");
					}
					streamCallback("Response:\n\n");
				}
			}
			// beginning of content
			streamCallback(content.trimStart());
		}
	}
}