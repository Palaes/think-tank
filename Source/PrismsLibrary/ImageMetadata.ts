// Reads generation metadata from PNG and JPEG image files.
// The parser is shared by the server and the web UI, so it must not use
// node-specific APIs. Compressed PNG text chunks need an inflater, which the
// server passes in, the web UI can only read uncompressed chunks.

interface ExtractedImageMetadata {
	positivePrompt?: string;
	negativePrompt?: string;
	seed?: number;
	steps?: number;
	sampler?: string;
	guidanceScale?: number;
	model?: string;
	width?: number;
	height?: number;
	strength?: number;
	shift?: number;
	seedMode?: string;
	maskBlur?: number;
	originalWidth?: number;
	originalHeight?: number;
	targetWidth?: number;
	targetHeight?: number;
	negativeOriginalWidth?: number;
	negativeOriginalHeight?: number;
}

type ImageMetadataInflater = (data: Uint8Array) => Uint8Array;

namespace ImageMetadataUtil {
	export function extract(data: Uint8Array, inflater?: ImageMetadataInflater): ExtractedImageMetadata {
		const texts: string[] = [];
		try {
			if (isPng(data)) {
				readPngTexts(data, texts, inflater);
			} else if (isJpeg(data)) {
				readJpegTexts(data, texts);
			}
		} catch {
			// Keep whatever metadata was parsed before the malformed part.
		}
		return parseTexts(texts);
	}

	export function merge(target: ExtractedImageMetadata, source: ExtractedImageMetadata): ExtractedImageMetadata {
		if (!source) {
			return target;
		}
		for (const key in source) {
			const value = source[key];
			if (value === undefined || value === null || value === "") {
				continue;
			}
			if (target[key] === undefined || target[key] === null || target[key] === "") {
				target[key] = value;
			}
		}
		return target;
	}

	// Rewrite the generation metadata of a PNG, returns null for other formats.
	// The description holds the combined prompt and the parameters, the comment
	// holds the whole config in the field Draw Things uses for it.
	export function write(data: Uint8Array, description: string, userComment: string): Uint8Array {
		if (!isPng(data)) {
			return null;
		}
		const chunk = buildTextChunk("XML:com.adobe.xmp", buildXmp(description, userComment));
		const parts: Uint8Array[] = [ data.subarray(0, 8) ];
		let position = 8;
		let inserted = false;
		while (position + 12 <= data.length) {
			const length = readUInt32(data, position, false);
			const end = position + 12 + length;
			if (end > data.length) {
				return null;
			}
			const type = decodeLatin1(data.subarray(position + 4, position + 8));
			// own chunk first, so a stale one later in the file never wins on read
			if (type != "IHDR" && !inserted) {
				parts.push(chunk);
				inserted = true;
			}
			if (!isMetadataChunk(data, position, type, length)) {
				parts.push(data.subarray(position, end));
			}
			position = end;
			if (type == "IEND") {
				break;
			}
		}
		if (!inserted) {
			return null;
		}
		return joinBytes(parts);
	}

	function isPng(data: Uint8Array): boolean {
		return data.length > 8
			&& data[0] == 0x89
			&& data[1] == 0x50
			&& data[2] == 0x4E
			&& data[3] == 0x47;
	}

	function isJpeg(data: Uint8Array): boolean {
		return data.length > 2 && data[0] == 0xFF && data[1] == 0xD8;
	}

	function readPngTexts(data: Uint8Array, texts: string[], inflater: ImageMetadataInflater): void {
		let position = 8;
		while (position + 12 <= data.length) {
			const length = readUInt32(data, position, false);
			const type = decodeLatin1(data.subarray(position + 4, position + 8));
			const start = position + 8;
			const end = start + length;
			if (end + 4 > data.length) {
				break;
			}
			const chunk = data.subarray(start, end);
			if (type == "tEXt") {
				readKeywordText(chunk, texts);
			} else if (type == "zTXt") {
				readCompressedText(chunk, texts, inflater);
			} else if (type == "iTXt") {
				readInternationalText(chunk, texts, inflater);
			} else if (type == "eXIf") {
				readTiff(chunk, texts);
			}
			position = end + 4;
			if (type == "IEND") {
				break;
			}
		}
	}

	function readKeywordText(data: Uint8Array, texts: string[]): void {
		const zero = indexOfByte(data, 0);
		if (zero >= 0 && zero + 1 < data.length) {
			const keyword = decodeLatin1(data.subarray(0, zero));
			if (isMetadataKeyword(keyword)) {
				const text = decodeLatin1(data.subarray(zero + 1));
				pushText(texts, text);
			}
		}
	}

	function readCompressedText(data: Uint8Array, texts: string[], inflater: ImageMetadataInflater): void {
		const zero = indexOfByte(data, 0);
		if (zero >= 0 && zero + 2 < data.length && inflater) {
			const keyword = decodeLatin1(data.subarray(0, zero));
			if (isMetadataKeyword(keyword)) {
				const text = decodeUtf8(inflater(data.subarray(zero + 2)));
				pushText(texts, text);
			}
		}
	}

	function readInternationalText(data: Uint8Array, texts: string[], inflater: ImageMetadataInflater): void {
		const keywordEnd = indexOfByte(data, 0);
		if (keywordEnd < 0 || keywordEnd + 3 > data.length) {
			return;
		}
		const keyword = decodeLatin1(data.subarray(0, keywordEnd));
		if (!isMetadataKeyword(keyword)) {
			return;
		}
		const compressionFlag = data[keywordEnd + 1];
		const languageEnd = indexOfByte(data, 0, keywordEnd + 3);
		if (languageEnd < 0) {
			return;
		}
		const translatedEnd = indexOfByte(data, 0, languageEnd + 1);
		if (translatedEnd < 0) {
			return;
		}
		const text = data.subarray(translatedEnd + 1);
		if (compressionFlag) {
			if (inflater) {
				pushText(texts, decodeUtf8(inflater(text)));
			}
		} else {
			pushText(texts, decodeUtf8(text));
		}
	}

	function isMetadataKeyword(keyword: string): boolean {
		switch (keyword.toLowerCase()) {
			case "description":
			case "comment":
			case "parameters":
			case "prompt":
			case "caption":
			case "caption-abstract":
			case "imagedescription":
			case "xml:com.adobe.xmp":
			case "xmp":
				return true;
		}
		return false;
	}

	function readJpegTexts(data: Uint8Array, texts: string[]): void {
		let position = 2;
		while (position + 4 <= data.length) {
			if (data[position] != 0xFF) {
				++position;
				continue;
			}
			while (position < data.length && data[position] == 0xFF) {
				++position;
			}
			if (position >= data.length) {
				break;
			}
			const marker = data[position++];
			if (marker == 0xD8 || marker == 0xD9) {
				continue;
			}
			if (marker >= 0xD0 && marker <= 0xD7) {
				continue;
			}
			if (position + 2 > data.length) {
				break;
			}
			const length = readUInt16(data, position, false);
			const start = position + 2;
			const end = position + length;
			if (end > data.length) {
				break;
			}
			if (marker == 0xE1 && decodeLatin1(data.subarray(start, start + 6)) == "Exif\0\0") {
				readTiff(data.subarray(start, end), texts);
			} else if (marker == 0xFE) {
				pushText(texts, decodeUtf8(data.subarray(start, end)));
			} else if (marker == 0xDA) {
				break;
			}
			position = end;
		}
	}

	function readTiff(data: Uint8Array, texts: string[]): void {
		let start = 0;
		if (data.length >= 6 && decodeLatin1(data.subarray(0, 4)) == "Exif") {
			start = 6;
		}
		if (data.length < start + 8) {
			return;
		}
		const little = data[start] == 0x49 && data[start + 1] == 0x49;
		const big = data[start] == 0x4D && data[start + 1] == 0x4D;
		if (!little && !big) {
			return;
		}
		if (readUInt16(data, start + 2, little) != 42) {
			return;
		}
		const offset = readUInt32(data, start + 4, little);
		readIfd(data, start, offset, little, texts, 0);
	}

	function readIfd(data: Uint8Array, start: number, offset: number, little: boolean, texts: string[], depth: number): void {
		if (depth > 4) {
			return;
		}
		const position = start + offset;
		if (position < 0 || position + 2 > data.length) {
			return;
		}
		const count = readUInt16(data, position, little);
		for (let i = 0; i < count; ++i) {
			const entry = position + 2 + i * 12;
			if (entry + 12 > data.length) {
				break;
			}
			const tag = readUInt16(data, entry, little);
			const type = readUInt16(data, entry + 2, little);
			const itemCount = readUInt32(data, entry + 4, little);
			const value = readTiffValue(data, start, entry, type, itemCount, little);
			if (!value) {
				continue;
			}
			if (tag == 0x010E) {
				pushText(texts, decodeAscii(value));
			} else if (tag == 0x9286) {
				pushText(texts, decodeUserComment(value));
			} else if (tag == 0x8769) {
				readIfd(data, start, readUInt32(value, 0, little), little, texts, depth + 1);
			} else if (tag == 0x83BB) {
				readIptc(value, texts);
			}
		}
	}

	function readTiffValue(data: Uint8Array, start: number, entry: number, type: number, count: number, little: boolean): Uint8Array {
		const sizes = [ 0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8 ];
		const size = sizes[type];
		if (!size || count == 0) {
			return null;
		}
		const total = size * count;
		if (total <= 4) {
			return data.subarray(entry + 8, entry + 8 + total);
		}
		const position = start + readUInt32(data, entry + 8, little);
		if (position < 0 || position + total > data.length) {
			return null;
		}
		return data.subarray(position, position + total);
	}

	function readIptc(data: Uint8Array, texts: string[]): void {
		let position = 0;
		while (position + 5 <= data.length) {
			if (data[position] != 0x1C) {
				++position;
				continue;
			}
			const record = data[position + 1];
			const dataset = data[position + 2];
			let length = readUInt16(data, position + 3, false);
			let start = position + 5;
			if (length & 0x8000) {
				const byteCount = length & 0x7FFF;
				length = 0;
				for (let i = 0; i < byteCount; ++i) {
					length = (length << 8) | data[start + i];
				}
				start += byteCount;
			}
			const end = start + length;
			if (end > data.length) {
				break;
			}
			if ((record == 1 && dataset == 2) || (record == 2 && (dataset == 5 || dataset == 120))) {
				pushText(texts, decodeLatin1(data.subarray(start, end)));
			}
			position = end;
		}
	}

	function parseTexts(texts: string[]): ExtractedImageMetadata {
		const result: ExtractedImageMetadata = {};
		const candidates = [];
		for (const text of texts) {
			const metadata = parseText(text);
			if (hasMetadata(metadata)) {
				candidates.push({ score: scoreText(text), metadata });
			}
		}
		candidates.sort((a, b) => b.score - a.score);
		for (const candidate of candidates) {
			merge(result, candidate.metadata);
		}
		return result;
	}

	function scoreText(text: string): number {
		const trimmed = text.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("<")) {
			return 3;
		}
		if (/Steps:\s*\d+/i.test(trimmed)) {
			return 2;
		}
		return 1;
	}

	function parseText(text: string): ExtractedImageMetadata {
		const result: ExtractedImageMetadata = {};
		const trimmed = text.trim();
		if (trimmed.startsWith("{")) {
			const data = parseJson(trimmed);
			if (data) {
				readJsonMetadata(result, data);
				return result;
			}
		}
		if (trimmed.startsWith("<")) {
			readXmpMetadata(result, trimmed);
			return result;
		}
		readParameterText(result, trimmed);
		return result;
	}

	function readXmpMetadata(result: ExtractedImageMetadata, text: string): void {
		// the comment carries the plain prompt, the description the combined one
		readXmpValue(result, extractXmlValue(text, "exif:UserComment"));
		readXmpValue(result, extractXmlValue(text, "exif:ImageDescription"));
		readXmpValue(result, extractXmlValue(text, "tiff:ImageDescription"));
		readXmpValue(result, extractXmlValue(text, "dc:description"));
		readXmpValue(result, extractXmlValue(text, "dc:title"));
		readXmpValue(result, extractXmlValue(text, "photoshop:Caption"));
		readXmpValue(result, extractXmlValue(text, "photoshop:Headline"));
		readXmpValue(result, extractXmlValue(text, "photoshop:Instructions"));
		readXmpValue(result, extractXmlValue(text, "xmp:Description"));
		for (const match of text.matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi)) {
			const value = decodeXml(stripXmlTags(match[1])).trim();
			if (value.startsWith("{") || /Steps:\s*\d+/i.test(value)) {
				merge(result, parseText(value));
			}
		}
	}

	function readXmpValue(result: ExtractedImageMetadata, value: string): void {
		if (value) {
			merge(result, parseText(value));
		}
	}

	function extractXmlValue(text: string, tag: string): string {
		const element = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
		const elementMatch = text.match(element);
		if (elementMatch) {
			return decodeXml(stripXmlTags(elementMatch[1])).trim();
		}
		const attribute = new RegExp(`${tag}\\s*=\\s*"([^"]*)"`, "i");
		const attributeMatch = text.match(attribute);
		if (attributeMatch) {
			return decodeXml(attributeMatch[1]).trim();
		}
		return null;
	}

	function stripXmlTags(text: string): string {
		return text.replace(/<[^>]+>/g, " ");
	}

	function decodeXml(text: string): string {
		return text
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, "\"")
			.replace(/&apos;/g, "'")
			.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
			.replace(/&#(\d+);/g, (_, number) => String.fromCharCode(parseInt(number)))
			.replace(/&amp;/g, "&");
	}

	function parseJson(text: string): any {
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start < 0 || end <= start) {
			return null;
		}
		try {
			return JSON.parse(text.substring(start, end + 1));
		} catch {
			return null;
		}
	}

	function readJsonMetadata(result: ExtractedImageMetadata, data: any): void {
		if (!data || typeof data != "object") {
			return;
		}
		setString(result, "positivePrompt", data.c ?? data.prompt ?? data.positive_prompt ?? data.positivePrompt);
		setString(result, "negativePrompt", data.uc ?? data.negative_prompt ?? data.negativePrompt ?? data.negative);
		setNumber(result, "seed", data.seed);
		setNumber(result, "steps", data.steps);
		setString(result, "sampler", data.sampler);
		setNumber(result, "guidanceScale", data.scale ?? data.guidance_scale ?? data.guidanceScale ?? data.cfg);
		setString(result, "model", data.model ?? data.model_name);
		setNumber(result, "strength", data.strength);
		setString(result, "seedMode", data.seed_mode ?? data.seedMode);
		setNumber(result, "maskBlur", data.mask_blur ?? data.maskBlur);
		setSize(result, data.size);
		setNumber(result, "width", data.width);
		setNumber(result, "height", data.height);
		// Draw Things keeps its own parameters in a nested block
		const v2 = data.v2 || {};
		setNumber(result, "shift", data.shift ?? data.shift_scale ?? data.shiftScale ?? v2.shift ?? v2.shift_scale ?? v2.shiftScale);
		setNumber(result, "originalWidth", data.original_width ?? v2.originalImageWidth ?? data.originalWidth);
		setNumber(result, "originalHeight", data.original_height ?? v2.originalImageHeight ?? data.originalHeight);
		setNumber(result, "targetWidth", data.target_width ?? v2.targetImageWidth ?? data.targetWidth);
		setNumber(result, "targetHeight", data.target_height ?? v2.targetImageHeight ?? data.targetHeight);
		setNumber(result, "negativeOriginalWidth", data.negative_original_width ?? v2.negativeOriginalImageWidth ?? data.negativeOriginalWidth);
		setNumber(result, "negativeOriginalHeight", data.negative_original_height ?? v2.negativeOriginalImageHeight ?? data.negativeOriginalHeight);
	}

	function readParameterText(result: ExtractedImageMetadata, text: string): void {
		const marker = text.match(/(?:Steps:\s*\d+|Sampler:\s*[^,\n]+|Guidance Scale:\s*[\d.]+|CFG scale:\s*[\d.]+|Seed:\s*\d+|Size:\s*\d+\s*[x×]\s*\d+|Model:\s*[^,\n]+|Strength:\s*[\d.]+|Seed Mode:\s*[^,\n]+)/i);
		const markerIndex = marker ? marker.index : -1;
		const promptPart = markerIndex >= 0 ? text.substring(0, markerIndex) : text;
		const parameterPart = markerIndex >= 0 ? text.substring(markerIndex) : "";
		const negativeIndex = promptPart.search(/Negative prompt:/i);
		if (negativeIndex >= 0) {
			setString(result, "positivePrompt", promptPart.substring(0, negativeIndex));
			setString(result, "negativePrompt", promptPart.substring(negativeIndex + "Negative prompt:".length));
		} else {
			setString(result, "positivePrompt", promptPart);
		}
		if (markerIndex < 0) {
			return;
		}
		setNumber(result, "seed", matchValue(parameterPart, /Seed:\s*(\d+)/i));
		setNumber(result, "steps", matchValue(parameterPart, /Steps:\s*(\d+)/i));
		setString(result, "sampler", matchValue(parameterPart, /Sampler:\s*([^,\n]+)/i));
		setNumber(result, "guidanceScale", matchValue(parameterPart, /(?:Guidance Scale|CFG scale|Scale):\s*([\d.]+)/i));
		setString(result, "model", matchValue(parameterPart, /Model:\s*([^,\n]+)/i));
		setNumber(result, "strength", matchValue(parameterPart, /(?:Strength|Denoising strength):\s*([\d.]+)/i));
		setString(result, "seedMode", matchValue(parameterPart, /Seed Mode:\s*([^,\n]+)/i));
		setNumber(result, "maskBlur", matchValue(parameterPart, /Mask Blur:\s*([\d.]+)/i));
		// our own parameters block is written one value per line
		setNumber(result, "guidanceScale", matchValue(parameterPart, /^CFG:\s*([\d.]+)/im));
		setNumber(result, "shift", matchValue(parameterPart, /Shift:\s*([\d.]+)/i));
		setNumber(result, "width", matchValue(parameterPart, /^Width:\s*(\d+)/im));
		setNumber(result, "height", matchValue(parameterPart, /^Height:\s*(\d+)/im));
		const size = parameterPart.match(/Size:\s*(\d+)\s*[x×]\s*(\d+)/i);
		if (size) {
			result.width = parseInt(size[1]);
			result.height = parseInt(size[2]);
		}
	}

	function matchValue(text: string, pattern: RegExp): string {
		const match = text.match(pattern);
		return match ? match[1] : null;
	}

	function setString(result: ExtractedImageMetadata, key: string, value: any): void {
		if (typeof value == "string" && value.trim()) {
			result[key] = value.trim();
		}
	}

	function setNumber(result: ExtractedImageMetadata, key: string, value: any): void {
		const number = typeof value == "number" ? value : parseFloat(value);
		if (!isNaN(number)) {
			result[key] = number;
		}
	}

	function setSize(result: ExtractedImageMetadata, value: any): void {
		if (typeof value == "string") {
			const match = value.match(/(\d+)\s*[x×]\s*(\d+)/);
			if (match) {
				result.width = parseInt(match[1]);
				result.height = parseInt(match[2]);
			}
		} else if (value && typeof value == "object") {
			setNumber(result, "width", value.width);
			setNumber(result, "height", value.height);
		}
	}

	function hasMetadata(metadata: ExtractedImageMetadata): boolean {
		for (const key in metadata) {
			if (metadata[key] !== undefined) {
				return true;
			}
		}
		return false;
	}

	function decodeUserComment(data: Uint8Array): string {
		if (data.length < 8) {
			return decodeAscii(data);
		}
		const encoding = decodeLatin1(data.subarray(0, 8));
		if (encoding.startsWith("UNICODE")) {
			return decodeUtf16(data.subarray(8));
		}
		if (encoding.startsWith("ASCII")) {
			return decodeAscii(data.subarray(8));
		}
		if (encoding.startsWith("JIS")) {
			return decodeLatin1(data.subarray(8)).trim();
		}
		if (isZeroHeader(data)) {
			return decodeAscii(data.subarray(8));
		}
		return decodeAscii(data);
	}

	function isZeroHeader(data: Uint8Array): boolean {
		for (let i = 0; i < 8; ++i) {
			if (data[i] != 0) {
				return false;
			}
		}
		return true;
	}

	function decodeUtf16(data: Uint8Array): string {
		let result = "";
		for (let i = 0; i + 1 < data.length; i += 2) {
			const code = (data[i] << 8) | data[i + 1];
			if (code == 0) {
				break;
			}
			result += String.fromCharCode(code);
		}
		return result.trim();
	}

	function decodeUtf8(data: Uint8Array): string {
		if (typeof TextDecoder != "undefined") {
			return new TextDecoder("utf-8").decode(data);
		}
		return decodeLatin1(data);
	}

	function decodeAscii(data: Uint8Array): string {
		let end = data.length;
		for (let i = 0; i < data.length; ++i) {
			if (data[i] == 0) {
				end = i;
				break;
			}
		}
		return decodeLatin1(data.subarray(0, end)).trim();
	}

	function decodeLatin1(data: Uint8Array): string {
		let result = "";
		for (let i = 0; i < data.length; ++i) {
			result += String.fromCharCode(data[i]);
		}
		return result;
	}

	function pushText(texts: string[], text: string): void {
		const value = text.trim();
		if (value) {
			texts.push(value);
		}
	}

	function indexOfByte(data: Uint8Array, value: number, start = 0): number {
		for (let i = start; i < data.length; ++i) {
			if (data[i] == value) {
				return i;
			}
		}
		return -1;
	}

	function readUInt16(data: Uint8Array, position: number, little: boolean): number {
		if (position + 2 > data.length) {
			return 0;
		}
		if (little) {
			return data[position] | (data[position + 1] << 8);
		}
		return (data[position] << 8) | data[position + 1];
	}

	function readUInt32(data: Uint8Array, position: number, little: boolean): number {
		if (position + 4 > data.length) {
			return 0;
		}
		if (little) {
			return data[position] | (data[position + 1] << 8) | (data[position + 2] << 16) | (data[position + 3] << 24);
		}
		return (data[position] << 24) | (data[position + 1] << 16) | (data[position + 2] << 8) | data[position + 3];
	}

	function isMetadataChunk(data: Uint8Array, position: number, type: string, length: number): boolean {
		if (type != "tEXt" && type != "iTXt" && type != "zTXt") {
			return false;
		}
		const keyword = data.subarray(position + 8, position + 8 + length);
		const zero = indexOfByte(keyword, 0, 0);
		if (zero < 0) {
			return false;
		}
		return isMetadataKeyword(decodeLatin1(keyword.subarray(0, zero)));
	}

	function buildTextChunk(keyword: string, text: string): Uint8Array {
		const keywordBytes = encodeUtf8(keyword);
		const textBytes = encodeUtf8(text);
		// keyword, terminator, compression flag, compression method, empty
		// language tag, empty translated keyword, then the text itself
		const content = new Uint8Array(keywordBytes.length + 5 + textBytes.length);
		content.set(keywordBytes, 0);
		content.set(textBytes, keywordBytes.length + 5);
		return buildChunk("iTXt", content);
	}

	function buildChunk(type: string, content: Uint8Array): Uint8Array {
		const result = new Uint8Array(12 + content.length);
		writeUInt32(result, 0, content.length);
		result.set(encodeUtf8(type), 4);
		result.set(content, 8);
		writeUInt32(result, 8 + content.length, crc32(result.subarray(4, 8 + content.length)));
		return result;
	}

	function buildXmp(description: string, userComment: string): string {
		return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Prisms">
   <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about=""
            xmlns:dc="http://purl.org/dc/elements/1.1/"
            xmlns:xmp="http://ns.adobe.com/xap/1.0/"
            xmlns:exif="http://ns.adobe.com/exif/1.0/">
         <dc:description>
            <rdf:Alt>
               <rdf:li xml:lang="x-default">${encodeXml(description)}</rdf:li>
            </rdf:Alt>
         </dc:description>
         <xmp:CreatorTool>Prisms</xmp:CreatorTool>
         <exif:UserComment>
            <rdf:Alt>
               <rdf:li xml:lang="x-default">${encodeXml(userComment)}</rdf:li>
            </rdf:Alt>
         </exif:UserComment>
      </rdf:Description>
   </rdf:RDF>
</x:xmpmeta>`;
	}

	function encodeXml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/\r\n/g, "\n")
			.replace(/\n/g, "&#xA;");
	}

	function encodeUtf8(text: string): Uint8Array {
		if (typeof TextEncoder != "undefined") {
			return new TextEncoder().encode(text);
		}
		const result = new Uint8Array(text.length);
		for (let i = 0; i < text.length; ++i) {
			result[i] = text.charCodeAt(i) & 0xFF;
		}
		return result;
	}

	function crc32(data: Uint8Array): number {
		let crc = 0xFFFFFFFF;
		for (let i = 0; i < data.length; ++i) {
			crc ^= data[i];
			for (let bit = 0; bit < 8; ++bit) {
				crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
			}
		}
		return (crc ^ 0xFFFFFFFF) >>> 0;
	}

	function writeUInt32(data: Uint8Array, position: number, value: number): void {
		data[position] = (value >>> 24) & 0xFF;
		data[position + 1] = (value >>> 16) & 0xFF;
		data[position + 2] = (value >>> 8) & 0xFF;
		data[position + 3] = value & 0xFF;
	}

	function joinBytes(parts: Uint8Array[]): Uint8Array {
		let size = 0;
		for (const part of parts) {
			size += part.length;
		}
		const result = new Uint8Array(size);
		let position = 0;
		for (const part of parts) {
			result.set(part, position);
			position += part.length;
		}
		return result;
	}
}
