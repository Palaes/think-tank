/// <reference path="./Globals.ts" />

namespace StreamUtil {
	export interface StreamHandler {
		onChunk?: (chunk: string) => string;
		onError?: (error: Error) => string;
	}

	export async function * asIterable<T>(stream: ReadableStream<T>): AsyncIterable<T> {
		if (stream[Symbol.asyncIterator]) {
			// @ts-ignore
			yield * stream;
		} else {
			const reader = stream.getReader();
			try {
				while (true) {
					const result = await reader.read();
					if (result.done) {
						break;
					}
					yield result.value;
				}
			} finally {
				reader.releaseLock();
			}
		}
	}

	export async function * byChunk(stream: AsyncIterable<Uint8Array>): AsyncIterable<string> {
		const decoder = new TextDecoder(ENCODING);
		for await (const chunk of stream) {
			const text = decoder.decode(chunk, { stream: true });
			if (text) {
				yield text;
			}
		}
		const text = decoder.decode();
		if (text) {
			yield text;
		}
	}

	export async function * byLine(stream: AsyncIterable<Uint8Array>): AsyncIterable<string> {
		const decoder = new TextDecoder(ENCODING);
		let remainder = "";
		for await (const chunk of stream) {
			const text = decoder.decode(chunk, { stream: true });
			const lines = text.split("\n");
			if (lines.length > 1) {
				yield remainder + lines.shift();
				remainder = lines.pop();
				yield * lines;
			} else {
				remainder += text;
			}
		}
		yield remainder + decoder.decode();
	}

	export async function * trimChunks(stream: AsyncIterable<string>): AsyncIterable<string> {
		for await (let chunk of stream) {
			chunk = chunk.trim();
			if (chunk) {
				yield chunk;
			}
		}
	}

	export async function decode(stream: AsyncIterable<Uint8Array>): Promise<string> {
		const decoder = new TextDecoder(ENCODING);
		let result: string = "";
		for await (const chunk of stream) {
			result += decoder.decode(chunk, { stream: true });
		}
		result += decoder.decode();
		return result;
	}

	export async function process(stream: AsyncIterable<string>, handler: StreamHandler): Promise<string> {
		let result = "";
		try {
			for await (const chunk of stream) {
				try {
					if (handler.onChunk) {
						result += handler.onChunk(chunk);
					}
				} catch (error) {
					if (handler.onError) {
						result += handler.onError(error);
					}
				}
			}
		} catch (error) {
			// an aborted stream still returns what arrived before the abort
			if (handler.onError) {
				result += handler.onError(error);
			}
		}
		return result;
	}
}