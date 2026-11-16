/// <reference path="../Common/StreamUtil.ts" />

/// <reference path="TTSAdapter.ts" />
/// <reference path="OllamaAdapter.ts" />
/// <reference path="SpeechText.ts" />

namespace TTSService {
	const adapters = {
		"default": OllamaAdapter,
		"ollama": OllamaAdapter
	};

	export const defaultSettings: TTSSettings = {
		enabled: true,
		APIType: "ollama",
		APIHost: "http://localhost:11434/v1/audio/speech",
		APIKey: "ollama",
		model: "phonon",
		voice: "Zoey"
	};

	export async function synthesize(params: TTSSettings, input: string, response: any): Promise<void> {
		input = SpeechText.normalize(input);
		if (input == "") {
			response.writeHead(204, CTTEXT);
			response.end();
			return;
		}
		const result = await requestSpeech(params, input, "wav");
		if (result.ok == false) {
			const message = await result.text();
			response.writeHead(result.status, CTTEXT);
			response.end(message);
			return;
		}
		response.writeHead(200, { "Content-Type": "audio/wav" });
		if (result.body) {
			for await (const chunk of StreamUtil.asIterable(result.body)) {
				response.write(chunk);
			}
		}
		response.end();
	}

	export async function synthesizePCM(params: TTSSettings, input: string, sink: (data: Uint8Array) => void, signal?: AbortSignal): Promise<void> {
		input = SpeechText.normalize(input);
		if (input == "") {
			return;
		}
		const result = await requestSpeech(params, input, "pcm", signal);
		if (result.ok == false) {
			throw new Error(await result.text());
		}
		if (result.body) {
			for await (const chunk of StreamUtil.asIterable<Uint8Array>(result.body)) {
				sink(chunk);
			}
		}
	}

	function requestSpeech(params: TTSSettings, input: string, format: string, signal?: AbortSignal): Promise<any> {
		const adapter = adapters[params.APIType] ?? adapters["default"];
		const headers = { Authorization: `Bearer ${params.APIKey}`, ...CTJSON };
		const request: RequestInit = {
			method: "POST",
			headers,
			body: JSON.stringify(adapter.createSpeechRequestBody(params, input, format))
		};
		if (signal) {
			request.signal = signal;
		}
		return fetch(params.APIHost, request);
	}
}
