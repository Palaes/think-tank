/// <reference path="../Adapters/TTSService.ts" />
/// <reference path="../Adapters/SpeechText.ts" />

interface SpeechItem {
	text: string;
	settings: TTSSettings;
}

interface SpeechStream {
	chatID: string;
	settings: TTSSettings;
	response: any;
	queue: SpeechItem[];
	pending: string;
	pendingSettings: TTSSettings;
	controller: AbortController;
	running: boolean;
	finished: boolean;
	closed: boolean;
}

namespace SpeechUtil {
	const maxSpeechLength = 500;

	const streams: Dict<SpeechStream> = {};

	// The audio element points here, so the response stays open and is fed per sentence.
	export function open(chatID: string, settings: TTSSettings, response: any): void {
		close(chatID);
		if (settings == null || settings.enabled == false) {
			response.writeHead(204, CTTEXT);
			response.end();
			return;
		}
		response.writeHead(200, { "Content-Type": "application/octet-stream" });
		const stream: SpeechStream = {
			chatID,
			settings,
			response,
			queue: [],
			pending: "",
			pendingSettings: null,
			controller: new AbortController(),
			running: false,
			finished: false,
			closed: false
		};
		streams[chatID] = stream;
		response.on("close", () => close(chatID));
	}

	// The settings are resolved after the stream is open, so the first sentence
	// cannot arrive before there is somewhere to write it.
	export function configure(chatID: string, settings: TTSSettings): void {
		const stream = streams[chatID];
		if (stream == null || stream.closed || settings == null) {
			return;
		}
		stream.settings = settings;
		if (settings.enabled == false) {
			abort(chatID);
		}
	}

	// Text arrives in arbitrary chunks. A paragraph is the speaking unit, and a
	// long paragraph is cut at lines, then sentences, then spaces.
	export function feed(chatID: string, content: string, settings: TTSSettings = null): void {
		const stream = streams[chatID];
		if (stream == null || stream.closed || stream.finished) {
			return;
		}
		const config = settings ?? stream.settings;
		if (stream.pending == "") {
			stream.pendingSettings = config;
		}
		stream.pending += content;
		while (true) {
			const cut = stream.pending.indexOf("\n\n");
			if (cut < 0) {
				break;
			}
			enqueue(stream, stream.pending.slice(0, cut + 2), config);
			stream.pending = stream.pending.slice(cut + 2);
		}
		while (stream.pending.length > maxSpeechLength) {
			const cut = findCut(stream.pending);
			enqueue(stream, stream.pending.slice(0, cut), config);
			stream.pending = stream.pending.slice(cut);
		}
	}

	// The generation is over, so whatever is left is a paragraph too.
	export function flush(chatID: string): void {
		const stream = streams[chatID];
		if (stream == null || stream.closed) {
			return;
		}
		enqueue(stream, stream.pending, stream.pendingSettings);
		stream.pending = "";
		stream.pendingSettings = null;
	}

	// No more text is coming, so the stream ends once the queue has played out.
	export function finish(chatID: string): void {
		const stream = streams[chatID];
		if (stream == null || stream.closed) {
			return;
		}
		stream.finished = true;
		enqueue(stream, stream.pending, stream.pendingSettings);
		stream.pending = "";
		stream.pendingSettings = null;
	}

	// A hard stop: the sentence in flight is cut as well, not only the queue.
	export function abort(chatID: string): void {
		close(chatID);
	}

	export function close(chatID: string): void {
		const stream = streams[chatID];
		if (stream == null) {
			return;
		}
		delete streams[chatID];
		stream.closed = true;
		stream.queue = [];
		stream.pending = "";
		stream.pendingSettings = null;
		stream.controller.abort();
		if (stream.response.writableEnded == false) {
			stream.response.end();
		}
	}

	function findCut(text: string): number {
		let cut = text.lastIndexOf("\n", maxSpeechLength);
		if (cut > 0) {
			return cut;
		}
		cut = findSentenceCut(text, maxSpeechLength);
		if (cut > 0) {
			return cut;
		}
		cut = text.lastIndexOf(" ", maxSpeechLength);
		if (cut > 0) {
			return cut;
		}
		return maxSpeechLength;
	}

	function findSentenceCut(text: string, limit: number): number {
		let cut = -1;
		for (let index = 0; index < limit; ++index) {
			const char = text[index];
			if (char == "." || char == "!" || char == "?") {
				const next = text[index + 1];
				if (next == " " || next == "\t" || next == "\n") {
					cut = index + 1;
				}
			}
		}
		return cut;
	}

	function enqueue(stream: SpeechStream, text: string, settings: TTSSettings = null): void {
		const config = settings ?? stream.settings;
		if (config == null || config.enabled == false) {
			return;
		}
		for (const part of splitSpeech(text.trim())) {
			if (SpeechText.isCode(part) == false) {
				stream.queue.push({ text: part, settings: config });
			}
		}
		drain(stream);
	}

	function splitSpeech(text: string): string[] {
		if (text == "") {
			return [];
		}
		if (text.length <= maxSpeechLength) {
			return [ text ];
		}
		const result = [];
		let rest = text;
		while (rest.length > maxSpeechLength) {
			const cut = findCut(rest);
			const part = rest.slice(0, cut).trim();
			if (part) {
				result.push(part);
			}
			rest = rest.slice(cut).trimStart();
		}
		if (rest) {
			result.push(rest);
		}
		return result;
	}

	// Sentences are synthesized one at a time, so the audio arrives in reading order.
	async function drain(stream: SpeechStream): Promise<void> {
		if (stream.running) {
			return;
		}
		stream.running = true;
		try {
			while (stream.closed == false) {
				const item = stream.queue.shift();
				if (item == undefined) {
					break;
				}
				await speak(stream, item);
			}
		} finally {
			stream.running = false;
			if (stream.finished && stream.closed == false) {
				close(stream.chatID);
			}
		}
	}

	async function speak(stream: SpeechStream, item: SpeechItem): Promise<void> {
		try {
			let count = 0;
			await TTSService.synthesizePCM(item.settings, item.text, (data: Uint8Array) => {
				if (stream.closed == false) {
					count += data.length;
					stream.response.write(data);
				}
			}, stream.controller.signal);
			console.log(`speech ${stream.chatID}: ${count} bytes`);
		} catch (error) {
			if (error.name != "AbortError") {
				console.warn(error);
			}
		}
	}
}
