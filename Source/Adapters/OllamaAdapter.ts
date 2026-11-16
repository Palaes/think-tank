/// <reference path="ChatAdapter.ts" />
/// <reference path="WebAdapter.ts" />
/// <reference path="TTSAdapter.ts" />

namespace OllamaAdapter {
	export function createChatRequestBody(params: ChatParams, context: ChatMessage[]): any {
		return {
			messages: context,
			model: params.model,
			think: params.think,
			stream: true,
			params: {
				temperature: params.temp,
				top_p: params.topP,
				top_k: params.topK,
				num_keep: params.numKeep,
				num_predict: params.numPredict
			}
		};
	}

	export function processChatResponseLine(params: ChatParams, line: string): { thinking: string, content: string } {
		const data = JSON.parse(line);
		if (data.message) {
			return { thinking: data.message.thinking ?? "", content: data.message.content ?? data.message.response ?? "" };
		}
		return { thinking: "", content: "" };
	}

	export function createSearchRequestBody(params: WebSearchParams, query: string): any {
		return { query, max_results: params.maxCount };
	}

	export function processSearchResponseData(params: WebSearchParams, data: any): { url: string, title: string, content: string }[] {
		return data.results;
	}

	export function createFetchRequestBody(params: WebFetchParams, url: string): any {
		return { url };
	}

	export function processFetchResponseData(params: WebFetchParams, data: any): { content: string } {
		return data;
	}

	export function createSpeechRequestBody(params: TTSSettings, input: string, format: string): any {
		return {
			input,
			model: params.model,
			voice: params.voice,
			response_format: format
		};
	}
}