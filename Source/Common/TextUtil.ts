namespace TextUtil {
	// parses `name: text` lines and returns the rest
	export function parseLineFields(input: string, output: any): string {
		const result = [];
		for (const line of input.split("\n")) {
			const match = line.match(/(\w+):(.+)/) ?? [];
			const key = match[1];
			const value = match[2];
			if (key in output) {
				output[key] = value.trim();
			} else {
				result.push(line);
			}
		}
		return result.join("\n");
	}

	// parses `name=word-like` parts, with an optional leading @, and returns the rest
	export function parseMetaFields(input: string, output: any): string {
		const result = [];
		for (const part of input.split(/\s+/)) {
			const match = part.match(/(@?\w+)=(.+)/) ?? [];
			const key = match[1];
			const value = match[2];
			if (key in output) {
				output[key] = value;
			} else {
				result.push(part);
			}
		}
		return result.join(" ");
	}

	// parses `[[meta content]]` parts and calls the right callback
	export async function parseStreamMeta(input: AsyncGenerator<string>, onMeta: StringCallback, onText: StringCallback): Promise<void> {
		let inMeta = false;
		let remainder = "";
		for await (const token of metaTokens(input)) {
			if (inMeta) {
				if (token == "]]\n" || token == "]]") {
					onMeta(remainder);
					inMeta = false;
					remainder = "";
				} else {
					remainder += token;
				}
			} else {
				if (token == "[[") {
					inMeta = true;
				} else {
					onText(token);
				}
			}
		}
	}

	// tokanizes meta tag syntax
	export async function * metaTokens(stream: AsyncIterable<string>): AsyncIterable<string> {
		let remainder = "";
		for await (const chunk of stream) {
			const text = remainder + chunk;
			const tokens = text.split(/(\[\[|\]\]\n|\]\])/);
			remainder = tokens.pop();
			yield * tokens;
			if (remainder.endsWith("[") || remainder.endsWith("]")) {
				// could be partial token
			} else {
				yield remainder;
				remainder = "";
			}
		}
		if (remainder) {
			yield remainder;
		}
	}

	export async function * trimChunks(stream: AsyncIterable<string>): AsyncIterable<string> {
		for await (let chunk of stream) {
			chunk = chunk.trim();
			if (chunk) {
				yield chunk;
			}
		}
	}

	export async function * cleanChunks(stream: AsyncIterable<string>): AsyncIterable<string> {
		for await (let chunk of stream) {
			yield normalizeTypography(chunk);
		}
	};

	export async function expandText(input: string, values: any, replacer: any): Promise<string> {
		let match: RegExpMatchArray;
		while (match = input.match(/\{\{([^{}]+)\}\}/)) {
			const outer = match[0];
			const key = match[1];
			const result = values[key];
			if (typeof result == "string") {
				input = input.replace(outer, result);
			} else {
				const result = await replacer(key);
				if (typeof result == "string") {
					input = input.replace(outer, result);
				} else {
					input = input.replace(outer, "");
				}
			}
		}
		return input;
	}

	export function shortifyLineNicely(value: string, sizeLimit: number): string {
		if (value.length > sizeLimit) {
			return value
				.substring(0, sizeLimit)
				.split(/s+/)
				.slice(0, -1)
				.join(" ")
				.concat("...");
		}
		return value
			.split(/s+/)
			.join(" ");
	}

	export function shortifyTextNicely(value: string, countLimit: number, sizeLimit: number): string {
		const lines = value
			.split(/\n/)
			.map(line => line.trim())
			.filter(Boolean);
		if (lines.length > countLimit) {
			lines.splice(countLimit - 1, lines.length - countLimit, "...");
		}
		return lines
			.map(line => shortifyLineNicely(line, sizeLimit))
			.filter(Boolean)
			.join("\n");
	}

	export function normalizeLineEndings(input: string): string {
		return input.replace(/\r\n?/g, "\n");
	}

	export function normalizeBlankLines(input: string): string {
		return input
			.replace(/[ \t]+\n/g, "\n")
			.replace(/\n\n\n+/g, "\n\n")
			.trim();
	}

	export function normalizeTypography(input: string): string {
		return input
			.replace(/[‘’‚‛‹›]/g, "'")
			.replace(/[“”„‟«»]/g, '"')
			.replace(/…/g, "...")
			.replace(/—/g, "–")
			.replace(/‑/g, "-");
	}

	export function normalizeAll(input: string): string {
		return input
			.replace(/\r\n?/g, "\n")
			.replace(/[ \t]+\n/g, "\n")
			.replace(/\n\n\n+/g, "\n\n")
			.replace(/[‘’‚‛‹›]/g, "'")
			.replace(/[“”„‟«»]/g, '"')
			.replace(/…/g, "...")
			.replace(/—/g, "–")
			.replace(/‑/g, "-")
			.trim();
	}

	// One level is a tab and two spaces count as one level. Every line the range
	// touches gets its leading whitespace rewritten as tabs at the shifted level.
	export function shiftIndent(value: string, start: number, end: number, delta: number): { value: string, start: number, end: number } {
		const first = value.lastIndexOf("\n", start - 1) + 1;
		const found = value.indexOf("\n", end);
		const last = found < 0 ? value.length : found;
		const lines = value.slice(first, last).split("\n");
		const results = [];
		const starts = [];
		let position = first;
		for (const line of lines) {
			starts.push(position);
			position += line.length + 1;
			const lead = line.match(/^[ \t]*/)[0];
			let tabs = 0;
			let spaces = 0;
			for (const char of lead) {
				if (char == "\t") {
					++tabs;
				} else {
					++spaces;
				}
			}
			const level = Math.max(0, Math.floor(tabs + spaces * 0.5 + delta));
			results.push("\t".repeat(level) + line.slice(lead.length));
		}
		let newStart = start;
		let newEnd = end;
		for (let i = 0; i < lines.length; ++i) {
			const change = results[i].length - lines[i].length;
			if (starts[i] < start || (starts[i] == start && change > 0)) {
				newStart += change;
			}
			if (starts[i] < end || (starts[i] == end && change > 0)) {
				newEnd += change;
			}
		}
		const replacement = results.join("\n");
		return { value: value.slice(0, first) + replacement + value.slice(last), start: newStart, end: newEnd };
	}
}