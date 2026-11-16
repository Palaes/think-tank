var ImageMetadataUtil;
(function (ImageMetadataUtil) {
    function extract(data, inflater) {
        const texts = [];
        try {
            if (isPng(data)) {
                readPngTexts(data, texts, inflater);
            }
            else if (isJpeg(data)) {
                readJpegTexts(data, texts);
            }
        }
        catch {
        }
        return parseTexts(texts);
    }
    ImageMetadataUtil.extract = extract;
    function merge(target, source) {
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
    ImageMetadataUtil.merge = merge;
    function write(data, description, userComment) {
        if (!isPng(data)) {
            return null;
        }
        const chunk = buildTextChunk("XML:com.adobe.xmp", buildXmp(description, userComment));
        const parts = [data.subarray(0, 8)];
        let position = 8;
        let inserted = false;
        while (position + 12 <= data.length) {
            const length = readUInt32(data, position, false);
            const end = position + 12 + length;
            if (end > data.length) {
                return null;
            }
            const type = decodeLatin1(data.subarray(position + 4, position + 8));
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
    ImageMetadataUtil.write = write;
    function isPng(data) {
        return data.length > 8
            && data[0] == 0x89
            && data[1] == 0x50
            && data[2] == 0x4E
            && data[3] == 0x47;
    }
    function isJpeg(data) {
        return data.length > 2 && data[0] == 0xFF && data[1] == 0xD8;
    }
    function readPngTexts(data, texts, inflater) {
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
            }
            else if (type == "zTXt") {
                readCompressedText(chunk, texts, inflater);
            }
            else if (type == "iTXt") {
                readInternationalText(chunk, texts, inflater);
            }
            else if (type == "eXIf") {
                readTiff(chunk, texts);
            }
            position = end + 4;
            if (type == "IEND") {
                break;
            }
        }
    }
    function readKeywordText(data, texts) {
        const zero = indexOfByte(data, 0);
        if (zero >= 0 && zero + 1 < data.length) {
            const keyword = decodeLatin1(data.subarray(0, zero));
            if (isMetadataKeyword(keyword)) {
                const text = decodeLatin1(data.subarray(zero + 1));
                pushText(texts, text);
            }
        }
    }
    function readCompressedText(data, texts, inflater) {
        const zero = indexOfByte(data, 0);
        if (zero >= 0 && zero + 2 < data.length && inflater) {
            const keyword = decodeLatin1(data.subarray(0, zero));
            if (isMetadataKeyword(keyword)) {
                const text = decodeUtf8(inflater(data.subarray(zero + 2)));
                pushText(texts, text);
            }
        }
    }
    function readInternationalText(data, texts, inflater) {
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
        }
        else {
            pushText(texts, decodeUtf8(text));
        }
    }
    function isMetadataKeyword(keyword) {
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
    function readJpegTexts(data, texts) {
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
            }
            else if (marker == 0xFE) {
                pushText(texts, decodeUtf8(data.subarray(start, end)));
            }
            else if (marker == 0xDA) {
                break;
            }
            position = end;
        }
    }
    function readTiff(data, texts) {
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
    function readIfd(data, start, offset, little, texts, depth) {
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
            }
            else if (tag == 0x9286) {
                pushText(texts, decodeUserComment(value));
            }
            else if (tag == 0x8769) {
                readIfd(data, start, readUInt32(value, 0, little), little, texts, depth + 1);
            }
            else if (tag == 0x83BB) {
                readIptc(value, texts);
            }
        }
    }
    function readTiffValue(data, start, entry, type, count, little) {
        const sizes = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
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
    function readIptc(data, texts) {
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
    function parseTexts(texts) {
        const result = {};
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
    function scoreText(text) {
        const trimmed = text.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("<")) {
            return 3;
        }
        if (/Steps:\s*\d+/i.test(trimmed)) {
            return 2;
        }
        return 1;
    }
    function parseText(text) {
        const result = {};
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
    function readXmpMetadata(result, text) {
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
    function readXmpValue(result, value) {
        if (value) {
            merge(result, parseText(value));
        }
    }
    function extractXmlValue(text, tag) {
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
    function stripXmlTags(text) {
        return text.replace(/<[^>]+>/g, " ");
    }
    function decodeXml(text) {
        return text
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"")
            .replace(/&apos;/g, "'")
            .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_, number) => String.fromCharCode(parseInt(number)))
            .replace(/&amp;/g, "&");
    }
    function parseJson(text) {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return JSON.parse(text.substring(start, end + 1));
        }
        catch {
            return null;
        }
    }
    function readJsonMetadata(result, data) {
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
        const v2 = data.v2 || {};
        setNumber(result, "shift", data.shift ?? data.shift_scale ?? data.shiftScale ?? v2.shift ?? v2.shift_scale ?? v2.shiftScale);
        setNumber(result, "originalWidth", data.original_width ?? v2.originalImageWidth ?? data.originalWidth);
        setNumber(result, "originalHeight", data.original_height ?? v2.originalImageHeight ?? data.originalHeight);
        setNumber(result, "targetWidth", data.target_width ?? v2.targetImageWidth ?? data.targetWidth);
        setNumber(result, "targetHeight", data.target_height ?? v2.targetImageHeight ?? data.targetHeight);
        setNumber(result, "negativeOriginalWidth", data.negative_original_width ?? v2.negativeOriginalImageWidth ?? data.negativeOriginalWidth);
        setNumber(result, "negativeOriginalHeight", data.negative_original_height ?? v2.negativeOriginalImageHeight ?? data.negativeOriginalHeight);
    }
    function readParameterText(result, text) {
        const marker = text.match(/(?:Steps:\s*\d+|Sampler:\s*[^,\n]+|Guidance Scale:\s*[\d.]+|CFG scale:\s*[\d.]+|Seed:\s*\d+|Size:\s*\d+\s*[x×]\s*\d+|Model:\s*[^,\n]+|Strength:\s*[\d.]+|Seed Mode:\s*[^,\n]+)/i);
        const markerIndex = marker ? marker.index : -1;
        const promptPart = markerIndex >= 0 ? text.substring(0, markerIndex) : text;
        const parameterPart = markerIndex >= 0 ? text.substring(markerIndex) : "";
        const negativeIndex = promptPart.search(/Negative prompt:/i);
        if (negativeIndex >= 0) {
            setString(result, "positivePrompt", promptPart.substring(0, negativeIndex));
            setString(result, "negativePrompt", promptPart.substring(negativeIndex + "Negative prompt:".length));
        }
        else {
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
    function matchValue(text, pattern) {
        const match = text.match(pattern);
        return match ? match[1] : null;
    }
    function setString(result, key, value) {
        if (typeof value == "string" && value.trim()) {
            result[key] = value.trim();
        }
    }
    function setNumber(result, key, value) {
        const number = typeof value == "number" ? value : parseFloat(value);
        if (!isNaN(number)) {
            result[key] = number;
        }
    }
    function setSize(result, value) {
        if (typeof value == "string") {
            const match = value.match(/(\d+)\s*[x×]\s*(\d+)/);
            if (match) {
                result.width = parseInt(match[1]);
                result.height = parseInt(match[2]);
            }
        }
        else if (value && typeof value == "object") {
            setNumber(result, "width", value.width);
            setNumber(result, "height", value.height);
        }
    }
    function hasMetadata(metadata) {
        for (const key in metadata) {
            if (metadata[key] !== undefined) {
                return true;
            }
        }
        return false;
    }
    function decodeUserComment(data) {
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
    function isZeroHeader(data) {
        for (let i = 0; i < 8; ++i) {
            if (data[i] != 0) {
                return false;
            }
        }
        return true;
    }
    function decodeUtf16(data) {
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
    function decodeUtf8(data) {
        if (typeof TextDecoder != "undefined") {
            return new TextDecoder("utf-8").decode(data);
        }
        return decodeLatin1(data);
    }
    function decodeAscii(data) {
        let end = data.length;
        for (let i = 0; i < data.length; ++i) {
            if (data[i] == 0) {
                end = i;
                break;
            }
        }
        return decodeLatin1(data.subarray(0, end)).trim();
    }
    function decodeLatin1(data) {
        let result = "";
        for (let i = 0; i < data.length; ++i) {
            result += String.fromCharCode(data[i]);
        }
        return result;
    }
    function pushText(texts, text) {
        const value = text.trim();
        if (value) {
            texts.push(value);
        }
    }
    function indexOfByte(data, value, start = 0) {
        for (let i = start; i < data.length; ++i) {
            if (data[i] == value) {
                return i;
            }
        }
        return -1;
    }
    function readUInt16(data, position, little) {
        if (position + 2 > data.length) {
            return 0;
        }
        if (little) {
            return data[position] | (data[position + 1] << 8);
        }
        return (data[position] << 8) | data[position + 1];
    }
    function readUInt32(data, position, little) {
        if (position + 4 > data.length) {
            return 0;
        }
        if (little) {
            return data[position] | (data[position + 1] << 8) | (data[position + 2] << 16) | (data[position + 3] << 24);
        }
        return (data[position] << 24) | (data[position + 1] << 16) | (data[position + 2] << 8) | data[position + 3];
    }
    function isMetadataChunk(data, position, type, length) {
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
    function buildTextChunk(keyword, text) {
        const keywordBytes = encodeUtf8(keyword);
        const textBytes = encodeUtf8(text);
        const content = new Uint8Array(keywordBytes.length + 5 + textBytes.length);
        content.set(keywordBytes, 0);
        content.set(textBytes, keywordBytes.length + 5);
        return buildChunk("iTXt", content);
    }
    function buildChunk(type, content) {
        const result = new Uint8Array(12 + content.length);
        writeUInt32(result, 0, content.length);
        result.set(encodeUtf8(type), 4);
        result.set(content, 8);
        writeUInt32(result, 8 + content.length, crc32(result.subarray(4, 8 + content.length)));
        return result;
    }
    function buildXmp(description, userComment) {
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
    function encodeXml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/\r\n/g, "\n")
            .replace(/\n/g, "&#xA;");
    }
    function encodeUtf8(text) {
        if (typeof TextEncoder != "undefined") {
            return new TextEncoder().encode(text);
        }
        const result = new Uint8Array(text.length);
        for (let i = 0; i < text.length; ++i) {
            result[i] = text.charCodeAt(i) & 0xFF;
        }
        return result;
    }
    function crc32(data) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; ++i) {
            crc ^= data[i];
            for (let bit = 0; bit < 8; ++bit) {
                crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
            }
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    function writeUInt32(data, position, value) {
        data[position] = (value >>> 24) & 0xFF;
        data[position + 1] = (value >>> 16) & 0xFF;
        data[position + 2] = (value >>> 8) & 0xFF;
        data[position + 3] = value & 0xFF;
    }
    function joinBytes(parts) {
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
})(ImageMetadataUtil || (ImageMetadataUtil = {}));
class ParameterList {
    constructor(parameters) {
        this.parameters = parameters.filter(Boolean);
        this.count = 0;
    }
    nextString(fallBack = undefined) {
        if (this.parameters.length) {
            ++this.count;
            return this.parameters.shift();
        }
        if (fallBack === undefined) {
            throw `String parameter at ${this.count} is missing.`;
        }
        return fallBack;
    }
    nextFloat(fallBack = undefined) {
        if (this.parameters.length) {
            ++this.count;
            const result = parseFloat(this.parameters.shift());
            if (isNaN(result)) {
                throw `Parameter at ${this.count} is not a number.`;
            }
            return result;
        }
        if (fallBack === undefined) {
            throw `Number parameter at ${this.count} is missing.`;
        }
        return fallBack;
    }
    nextInt(fallBack = undefined) {
        if (this.parameters.length) {
            ++this.count;
            const result = parseInt(this.parameters.shift());
            if (isNaN(result)) {
                throw `Parameter at ${this.count} is not an integer.`;
            }
            return result;
        }
        if (fallBack === undefined) {
            throw `Integer parameter at ${this.count} is missing.`;
        }
        return fallBack;
    }
    nextBool(fallBack = undefined) {
        if (this.parameters.length) {
            ++this.count;
            switch (this.parameters.shift()) {
                case "false":
                case "no":
                case "0":
                    return false;
                case "true":
                case "yes":
                case "1":
                    return true;
                default:
                    throw `Parameter at ${this.count} is not a boolean.`;
            }
        }
        if (fallBack === undefined) {
            throw `Boolean parameter at ${this.count} is missing.`;
        }
        return fallBack;
    }
    checkEmpty(name) {
        if (this.parameters.length) {
            throw `Too many arguments for ${name} command.`;
        }
    }
}
class BaseCommandEngine {
    handleBlock(block) {
        if (block) {
            for (const line of block.split(/\n+/)) {
                this.handleLine(line.trim());
            }
        }
        this.handleEnd();
    }
    handleLine(line) {
        if (line.startsWith("//")) {
            console.log(line.substring(2).trim());
        }
        else if (line.startsWith("/")) {
            try {
                this.handleCommand(line.substring(1).trim());
            }
            catch (message) {
                if (message == "ABORT") {
                    throw "ABORT";
                }
                console.log(`Error at line: ${line}`);
                console.log(`Error message: ${message}`);
            }
        }
        else if (line.startsWith("-")) {
            line = line.substring(1).trim();
            if (line) {
                this.handleNegative(this.cleanLine(line));
            }
        }
        else if (line) {
            this.handlePositive(this.cleanLine(line));
        }
    }
    handleCommand(line) {
        const parts = line.split(/\s*[:\s]\s*/);
        const name = parts[0];
        if (name in this.commands) {
            const parameters = new ParameterList(parts.slice(1));
            this.commands[name](parameters);
            parameters.checkEmpty(name);
        }
        else {
            throw "No such command.";
        }
    }
    cleanLine(line) {
        return line
            .replace(/\s+/g, " ")
            .replace(/\s\./g, ".")
            .replace(/\.+/g, ".")
            .replace(/\s,/g, ",")
            .replace(/,+/g, ",");
    }
}
function prettyFormat(object) {
    return JSON.stringify(object, null, "\t");
}
function prettyPrint(object) {
    console.log(prettyFormat(object));
}
function getAllPropertyNames(object) {
    const result = [];
    let current = object;
    while (current) {
        result.push(...Object.getOwnPropertyNames(current));
        current = Object.getPrototypeOf(current);
    }
    return result;
}
function printProperties(object, propertyNames) {
    for (const name of propertyNames) {
        const value = object[name];
        if (typeof value == "object") {
            console.log(name + ": " + prettyFormat(value));
        }
        else {
            console.log(name + ": " + value);
        }
    }
}
function printOwnProperties(object) {
    printProperties(object, Object.getOwnPropertyNames(object));
}
function printAllProperties(object) {
    printProperties(object, getAllPropertyNames(object));
}
function cleanString(value) {
    return value.trim().replace(/\r\n|\r|\u2028/g, "\n");
}
class XSRandom {
    static next(seed) {
        seed = seed || 3850;
        seed = seed ^ (seed << 13);
        seed = seed ^ (seed >> 17);
        seed = seed ^ (seed << 5);
        return seed >>> 0;
    }
    constructor(seed) {
        this.seed = seed;
    }
    next() {
        const result = this.seed;
        this.seed = XSRandom.next(this.seed);
        return result;
    }
}
function formatIndex(index, digits = 1) {
    let result = index.toString();
    while (result.length < digits) {
        result = "0" + result;
    }
    return result;
}
const defaultGenParam = {
    positivePrompt: "",
    negativePrompt: "",
    batchCount: 1,
    refinerModel: null,
    refinerStart: 0.5,
    loras: [],
    controls: [],
    sampler: "DPM++ 2M Karras",
    steps: 20,
    CFG: 5,
    shift: 1,
    SSS: 0.3,
    strength: 0.5,
    width: 768,
    height: 512,
    hiRes: false,
    hiResWidth: 1152,
    hiResHeight: 768,
    hiResStrength: 0.5,
    customSizeEmbed: false,
    originalWidth: 768,
    originalHeight: 512,
    targetWidth: 768,
    targetHeight: 512,
    negativeWidth: 768,
    negativeHeight: 512
};
class SimpleCatalogue {
    constructor(name, map) {
        this.name = name;
        this.map = map;
    }
    get(key) {
        if (key in this.map) {
            return this.map[key];
        }
        return this.handle(key);
    }
    handle(value) {
        throw `No such ${this.name} registered in catalogue: ${value}`;
    }
}
class CKPTCatalogue extends SimpleCatalogue {
    handle(value) {
        if (value.endsWith(".ckpt")) {
            return value;
        }
        throw `No such ${this.name} registered in catalogue (nor is it a ckpt name): ${value}`;
    }
}
class IntCatalogue extends SimpleCatalogue {
    handle(value) {
        const result = parseInt(value);
        if (isNaN(result)) {
            throw `No such ${this.name} registered in catalogue (nor is it an integer): ${value}`;
        }
        return result;
    }
}
let modelCatalogue;
let loraCatalogue;
let controlCatalogue;
let samplerCatalogue;
const seedModeCatalogue = new IntCatalogue("seed mode", {
    legacy: "Legacy",
    torch: "Torch CPU Compatible",
    default: "Scale Alike",
    nvidia: "NVIDIA GPU Compatible"
});
class SDCommandEngine extends BaseCommandEngine {
    constructor() {
        super();
        this.handleDefaults = (parameters) => {
            ParamUtil.overrideGen(this.current, defaultGenParam);
        };
        this.handleReset = (parameters) => {
            ParamUtil.overrideGen(this.current, this.initial);
        };
        this.handleEmpty = (parameters) => {
            this.positive = "";
            this.negative = "";
        };
        this.handleLoRA = (parameters) => {
            const index = parameters.nextInt();
            if (index < 1) {
                throw "LoRA indexing should start from 1.";
            }
            this.current.loras[index - 1] = {
                file: loraCatalogue.get(parameters.nextString()),
                weight: parameters.nextFloat(1)
            };
        };
        this.handleControl = (parameters) => {
            const index = parameters.nextInt();
            if (index < 1) {
                throw "Control indexing should start from 1.";
            }
            this.current.controls[index - 1] = {
                file: controlCatalogue.get(parameters.nextString()),
                weight: parameters.nextFloat(1),
                priority: parameters.nextString("balanced"),
                start: parameters.nextFloat(0),
                end: parameters.nextFloat(1)
            };
        };
        this.handleSeed = (parameters) => {
            this.current.seed = parameters.nextInt(XSRandom.next(this.current.seed));
        };
        this.handleSize = (parameters) => {
            this.current.width = parameters.nextInt();
            this.current.height = parameters.nextInt();
        };
        this.handleAspect = (parameters) => {
            this.matchAspect(this.current, parameters.nextString());
        };
        this.handleGenerate = (parameters) => {
            if (typeof this.negative == "string") {
                this.current.negativePrompt = this.negative;
                this.negative = null;
            }
            if (typeof this.positive == "string") {
                this.current.positivePrompt = this.positive;
                this.positive = null;
            }
            this.handler(ParamUtil.duplicateSDGen(this.current));
        };
        this.commands = {
            ...this.buildAPIMap(),
            ...this.buildCustomMap()
        };
    }
    init(taskData, handler) {
        this.initial = ParamUtil.duplicateSDGen(taskData);
        this.current = ParamUtil.duplicateSDGen(taskData);
        this.positive = taskData.positivePrompt;
        this.negative = taskData.negativePrompt;
        this.handler = handler;
    }
    buildAPIMap() {
        const result = {};
        for (const key in defaultGenParam) {
            switch (typeof defaultGenParam[key]) {
                case "string":
                    result[key] = (parameters) => this.current[key] = parameters.nextString();
                    break;
                case "number":
                    result[key] = (parameters) => this.current[key] = parameters.nextFloat();
                    break;
                case "boolean":
                    result[key] = (parameters) => this.current[key] = parameters.nextBool();
                    break;
            }
        }
        return result;
    }
    buildCustomMap() {
        return {
            generate: this.handleGenerate,
            defaults: this.handleDefaults,
            reset: this.handleReset,
            empty: this.handleEmpty,
            model: this.createStandardHandler("model", modelCatalogue, undefined),
            refinerModel: this.createStandardHandler("refinerModel", modelCatalogue, undefined),
            lora: this.handleLoRA,
            control: this.handleControl,
            sampler: this.createStandardHandler("sampler", samplerCatalogue, undefined),
            seed: this.handleSeed,
            seedMode: this.createStandardHandler("seedMode", seedModeCatalogue, undefined),
            size: this.handleSize,
            aspect: this.handleAspect,
            enableHiRes: this.createStandardHandler("hiRes", "const", true),
            setHiRes: this.createStandardHandler("hiRes", "const", true, "hiResWidth", "int", undefined, "hiResHeight", "int", undefined, "hiResStrength", "float", undefined),
            disableHiRes: this.createStandardHandler("hiRes", "const", false)
        };
    }
    createStandardHandler(...targets) {
        return (parameterList) => {
            let i = 0;
            while (i < targets.length) {
                const key = targets[i++];
                const type = targets[i++];
                const fallback = targets[i++];
                if (type instanceof SimpleCatalogue) {
                    this.current[key] = type.get(parameterList.nextString(fallback));
                }
                else if (type == "const") {
                    this.current[key] = fallback;
                }
                else if (type == "string") {
                    this.current[key] = parameterList.nextString(fallback);
                }
                else if (type == "float") {
                    this.current[key] = parameterList.nextFloat(fallback);
                }
                else if (type == "int") {
                    this.current[key] = parameterList.nextInt(fallback);
                }
                else {
                    this.current[key] = fallback;
                }
            }
        };
    }
    swapHorizontal(target, widthKey, heightKey) {
        const width = target[widthKey];
        const height = target[heightKey];
        target[widthKey] = Math.max(width, height);
        target[heightKey] = Math.min(width, height);
    }
    swapVertical(target, widthKey, heightKey) {
        const width = target[widthKey];
        const height = target[heightKey];
        target[widthKey] = Math.min(width, height);
        target[heightKey] = Math.max(width, height);
    }
    matchAspect(target, aspect) {
        if (aspect == "horizontal") {
            this.swapHorizontal(target, "width", "height");
            this.swapHorizontal(target, "hiResWidth", "hiResHeight");
            this.swapHorizontal(target, "originalWidth", "originalHeight");
            this.swapHorizontal(target, "targetWidth", "targetHeight");
            this.swapHorizontal(target, "negativeWidth", "negativeHeight");
        }
        else if (aspect == "vertical") {
            this.swapVertical(target, "width", "height");
            this.swapVertical(target, "hiResWidth", "hiResHeight");
            this.swapVertical(target, "originalWidth", "originalHeight");
            this.swapVertical(target, "targetWidth", "targetHeight");
            this.swapVertical(target, "negativeWidth", "negativeHeight");
        }
        else {
            throw "Aspect should be horizontal or vertical.";
        }
    }
    handlePositive(line) {
        if (this.positive) {
            this.positive += "\n";
            this.positive += line;
        }
        else {
            this.positive = line;
        }
    }
    handleNegative(line) {
        if (this.negative) {
            this.negative += "\n";
            this.negative += line;
        }
        else {
            this.negative = line;
        }
    }
    handleEnd() {
        if (typeof this.negative == "string") {
            this.current.negativePrompt = this.negative;
            this.negative = null;
        }
        if (this.positive) {
            this.current.positivePrompt = this.positive;
            this.positive = null;
            this.handler(ParamUtil.duplicateSDGen(this.current));
        }
    }
}
const ENCODING = "utf-8";
const CTTEXT = { "Content-Type": "text/plain" };
const CTJSON = { "Content-Type": "application/json" };
const defaultDTHGenParam = {
    prompt: "",
    negative_prompt: "",
    batch_count: 1,
    batch_size: 1,
    seed_mode: "Scale Alike",
    refiner_model: null,
    refiner_start: 0.5,
    loras: [],
    controls: [],
    sampler: "DPM++ 2M Karras",
    steps: 20,
    guidance_scale: 5,
    resolution_dependent_shift: false,
    shift: 1,
    stochastic_sampling_gamma: 0.3,
    strength: 1,
    width: 512,
    height: 512,
    hires_fix: false,
    hires_fix_width: 512,
    hires_fix_height: 512,
    hires_fix_strength: 0.5,
    sharpness: 0,
    clip_skip: 1,
    clip_weight: 1,
    zero_negative_prompt: false,
    upscaler: null,
    upscaler_scale: 1,
    original_width: 512,
    original_height: 512,
    target_width: 512,
    target_height: 512,
    negative_original_width: 512,
    negative_original_height: 512,
    crop_top: 0,
    crop_left: 0,
    aesthetic_score: 6,
    negative_aesthetic_score: 2,
    mask_blur: 5,
    mask_blur_outset: 0,
    preserve_original_after_inpaint: true,
    fps: 5,
    num_frames: 21,
    start_frame_guidance: 1,
    guiding_frame_noise: 0.02,
    motion_scale: 127,
    tiled_decoding: false,
    decoding_tile_width: 768,
    decoding_tile_height: 768,
    decoding_tile_overlap: 128,
    tiled_diffusion: false,
    diffusion_tile_width: 1536,
    diffusion_tile_height: 1536,
    diffusion_tile_overlap: 256,
    image_prior_steps: 5,
    negative_prompt_for_image_prior: true
};
const defaultDTSGenParam = {
    seedMode: 2,
    batchCount: 1,
    batchSize: 1,
    refinerModel: null,
    refinerStart: 0.5,
    loras: [],
    controls: [],
    sampler: 0,
    steps: 20,
    guidanceScale: 5,
    resolutionDependentShift: false,
    shift: 1,
    stochasticSamplingGamma: 0.3,
    strength: 1,
    width: 512,
    height: 512,
    hiresFix: false,
    hiresFixWidth: 512,
    hiresFixHeight: 512,
    hiresFixStrength: 0.5,
    sharpness: 0,
    clipSkip: 1,
    clipWeight: 1,
    zeroNegativePrompt: false,
    imageGuidanceScale: 1.5,
    upscaler: null,
    upscalerScale: 0,
    faceRestoration: null,
    originalImageWidth: 512,
    originalImageHeight: 512,
    targetImageWidth: 512,
    targetImageHeight: 512,
    negativeOriginalImageWidth: 512,
    negativeOriginalImageHeight: 512,
    cropTop: 0,
    cropLeft: 0,
    aestheticScore: 6,
    negativeAestheticScore: 2,
    maskBlur: 5,
    maskBlurOutset: 0,
    preserveOriginalAfterInpaint: true,
    fps: 5,
    numFrames: 21,
    startFrameGuidance: 1,
    guidingFrameNoise: 0.02,
    motionScale: 127,
    stage2Steps: 10,
    stage2Guidance: 1,
    stage2Shift: 1,
    tiledDecoding: false,
    decodingTileWidth: 768,
    decodingTileHeight: 768,
    decodingTileOverlap: 128,
    tiledDiffusion: false,
    diffusionTileWidth: 1536,
    diffusionTileHeight: 1536,
    diffusionTileOverlap: 256,
    imagePriorSteps: 5,
    negativePromptForImagePrior: true
};
var ParamUtil;
(function (ParamUtil) {
    function toDTHLoRA(param) {
        if (param.file) {
            return {
                file: param.file,
                weight: param.weight
            };
        }
        return null;
    }
    function toDTHControl(param) {
        if (param.file) {
            return {
                file: param.file,
                weight: param.weight,
                control_importance: param.priority ?? "balanced",
                guidance_start: param.start ?? 0,
                guidance_end: param.end ?? 1,
                input_override: param.inputOverride ?? "",
                target_blocks: param.targetBlocks ?? [],
                no_prompt: false,
                down_sampling_rate: 1,
                global_average_pooling: false
            };
        }
        return null;
    }
    function toDTHGen(param) {
        const result = { ...defaultDTHGenParam };
        result.model = param.model;
        result.refiner_model = param.refinerModel;
        result.refiner_start = param.refinerStart;
        if (param.loras) {
            result.loras = param.loras.map(toDTHLoRA).filter(Boolean);
        }
        if (param.controls) {
            result.controls = param.controls.map(toDTHControl).filter(Boolean);
        }
        result.sampler = param.sampler;
        result.steps = param.steps;
        result.guidance_scale = param.CFG;
        result.shift = param.shift;
        result.stochastic_sampling_gamma = param.SSS;
        result.strength = param.strength;
        result.seed = param.seed;
        result.width = param.width;
        result.height = param.height;
        if (param.hiRes) {
            result.hires_fix = true;
            result.width = Math.max(param.width, param.hiResWidth);
            result.height = Math.max(param.height, param.hiResHeight);
            result.hires_fix_width = Math.min(param.width, param.hiResWidth);
            result.hires_fix_height = Math.min(param.height, param.hiResHeight);
        }
        else {
            result.hires_fix = false;
            result.width = param.width;
            result.height = param.height;
            result.hires_fix_width = param.hiResWidth;
            result.hires_fix_height = param.hiResHeight;
        }
        result.hires_fix_strength = param.hiResStrength;
        if (param.customSizeEmbed) {
            result.custom_size_embed = true;
            result.original_width = param.originalWidth;
            result.original_height = param.originalHeight;
            result.target_width = param.targetWidth;
            result.target_height = param.targetHeight;
            result.negative_original_width = param.negativeWidth;
            result.negative_original_height = param.negativeHeight;
        }
        else {
            result.custom_size_embed = false;
            result.original_width = param.width;
            result.original_height = param.height;
            result.target_width = param.width;
            result.target_height = param.height;
            result.negative_original_width = param.width;
            result.negative_original_height = param.height;
        }
        result.prompt = param.positivePrompt;
        result.negative_prompt = param.negativePrompt;
        result.batch_count = param.batchCount;
        return result;
    }
    ParamUtil.toDTHGen = toDTHGen;
    function fromDTHLoRA(param) {
        if (param.file) {
            return {
                file: param.file,
                weight: param.weight
            };
        }
        return null;
    }
    function fromDTHControl(param) {
        if (param.file) {
            return {
                file: param.file,
                weight: param.weight,
                priority: param.control_importance,
                start: param.guidance_start,
                end: param.guidance_end
            };
        }
        return null;
    }
    function fromDTHGen(param) {
        const result = { ...defaultGenParam };
        result.model = param.model;
        result.refinerModel = param.refiner_model;
        result.refinerStart = param.refiner_start;
        if (param.loras) {
            result.loras = param.loras.map(fromDTHLoRA).filter(Boolean);
        }
        for (let i = 0; i < 3; ++i) {
            result.loras[i] = result.loras[i] || { file: null, weight: 0 };
        }
        if (param.controls) {
            result.controls = param.controls.map(fromDTHControl).filter(Boolean);
        }
        for (let i = 0; i < 3; ++i) {
            result.controls[i] = result.controls[i] || { file: null, weight: 0 };
        }
        result.sampler = param.sampler;
        result.steps = param.steps;
        result.CFG = param.guidance_scale;
        result.shift = param.shift;
        result.SSS = param.stochastic_sampling_gamma;
        result.strength = param.strength;
        result.seed = param.seed;
        if (param.hires_fix) {
            result.hiRes = true;
            result.width = Math.min(param.width, param.hires_fix_width);
            result.height = Math.min(param.height, param.hires_fix_height);
            result.hiResWidth = Math.max(param.width, param.hires_fix_width);
            result.hiResHeight = Math.max(param.height, param.hires_fix_height);
        }
        else {
            result.hiRes = false;
            result.width = param.width;
            result.height = param.height;
            result.hiResWidth = param.hires_fix_width;
            result.hiResHeight = param.hires_fix_height;
        }
        result.hiResStrength = param.hires_fix_strength;
        result.customSizeEmbed = param.custom_size_embed ?? false;
        result.originalWidth = param.original_width;
        result.originalHeight = param.original_height;
        result.targetWidth = param.target_width;
        result.targetHeight = param.target_height;
        result.negativeWidth = param.negative_original_width;
        result.negativeHeight = param.negative_original_height;
        result.positivePrompt = param.prompt ?? "";
        result.negativePrompt = param.negative_prompt ?? "";
        return result;
    }
    ParamUtil.fromDTHGen = fromDTHGen;
    function duplicateLoRA(param) {
        return { ...param };
    }
    function duplicateControl(param) {
        return { ...param };
    }
    function duplicateSDGen(param) {
        const result = { ...param };
        if (param.loras) {
            result.loras = param.loras.map(duplicateLoRA);
        }
        if (param.controls) {
            result.controls = param.controls.map(duplicateControl);
        }
        return result;
    }
    ParamUtil.duplicateSDGen = duplicateSDGen;
    function overrideGen(target, source) {
        for (const key in source) {
            target[key] = source[key];
        }
        if (source.loras) {
            target.loras = source.loras.map(duplicateLoRA);
        }
        if (source.controls) {
            target.controls = source.controls.map(duplicateControl);
        }
    }
    ParamUtil.overrideGen = overrideGen;
})(ParamUtil || (ParamUtil = {}));
var SDConnector;
(function (SDConnector) {
    SDConnector.project = new URLSearchParams(window.location.search).get("p") || "Main";
    async function getResponse(location, method = "GET", body = undefined) {
        const request = {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers: body ? CTJSON : undefined
        };
        const response = await fetch(location, request);
        const result = await response.json();
        return result;
    }
    function sendRequest(location, method = "POST", body = undefined) {
        const request = {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers: body ? CTJSON : undefined
        };
        fetch(location, request);
    }
    async function getProjects() {
        return getResponse("/api/get-projects");
    }
    SDConnector.getProjects = getProjects;
    async function createProject(name, IDs) {
        return getResponse("/api/create-project", "POST", { name, sourceProject: SDConnector.project, IDs });
    }
    SDConnector.createProject = createProject;
    async function reindexProject() {
        return getResponse("/api/reindex-project", "POST", { project: SDConnector.project });
    }
    SDConnector.reindexProject = reindexProject;
    async function assignParams(IDs, taskData) {
        return getResponse("/api/assign-params", "POST", { project: SDConnector.project, IDs, taskData: ParamUtil.toDTHGen(taskData) });
    }
    SDConnector.assignParams = assignParams;
    async function renameProject(name) {
        return getResponse("/api/rename-project", "POST", { project: SDConnector.project, name });
    }
    SDConnector.renameProject = renameProject;
    async function getUpscalers() {
        return getResponse("/api/upscalers");
    }
    SDConnector.getUpscalers = getUpscalers;
    async function importImages(images) {
        const result = await getResponse("/api/import", "POST", { project: SDConnector.project, images });
        for (const entry of result.entries) {
            entry.status = entry.status || "done";
            entry.taskData = ParamUtil.fromDTHGen(entry.taskData);
        }
        return result.entries;
    }
    SDConnector.importImages = importImages;
    async function getHistory() {
        const result = await getResponse("/api/get-history", "POST", { project: SDConnector.project });
        for (const item of result) {
            item.status = item.status || "done";
            item.taskData = ParamUtil.fromDTHGen(item.taskData);
        }
        return result;
    }
    SDConnector.getHistory = getHistory;
    async function generate(taskData) {
        const converted = ParamUtil.toDTHGen(taskData);
        const result = await getResponse("/api/generate", "POST", { ...converted, project: SDConnector.project, sourceImage: taskData.sourceImage, type: taskData.type, upscaleModel: taskData.upscaleModel });
        result.status = result.status || "done";
        result.taskData = ParamUtil.fromDTHGen(result.taskData);
        return result;
    }
    SDConnector.generate = generate;
    async function generateTasks(taskData, combinedPrompt, sources) {
        const result = await getResponse("/api/generate", "POST", { project: SDConnector.project, taskData, combinedPrompt, sources });
        for (const entry of result.entries) {
            entry.status = entry.status || "pending";
            entry.taskData = ParamUtil.fromDTHGen(entry.taskData);
        }
        return result;
    }
    SDConnector.generateTasks = generateTasks;
    async function getTaskStates(IDs) {
        return getResponse("/api/get-task-states", "POST", { project: SDConnector.project, IDs });
    }
    SDConnector.getTaskStates = getTaskStates;
    function moveGens(IDs, movement, steps) {
        sendRequest("/api/move-gens", "POST", { project: SDConnector.project, IDs, movement, steps });
    }
    SDConnector.moveGens = moveGens;
    function removeGens(IDs) {
        sendRequest("/api/remove-gens", "POST", { project: SDConnector.project, IDs });
    }
    SDConnector.removeGens = removeGens;
    function moveGen(ID, movement) {
        switch (movement) {
            case 0:
                return sendRequest("/api/move-gen-prev", "POST", { ID, project: SDConnector.project });
            case 1:
                return sendRequest("/api/move-gen-next", "POST", { ID, project: SDConnector.project });
        }
    }
    SDConnector.moveGen = moveGen;
    function removeGen(ID) {
        sendRequest("/api/remove-gen", "POST", { ID, project: SDConnector.project });
    }
    SDConnector.removeGen = removeGen;
    async function clearHistory() {
        return getResponse("/api/clear-history");
    }
    SDConnector.clearHistory = clearHistory;
    async function getSettings() {
        return getResponse("/api/settings");
    }
    SDConnector.getSettings = getSettings;
    async function getPresets() {
        return getResponse("/api/presets", "POST", {});
    }
    SDConnector.getPresets = getPresets;
    async function savePreset(presetName, preset) {
        return getResponse("/api/presets", "POST", { [presetName]: preset });
    }
    SDConnector.savePreset = savePreset;
    function imageURL(name) {
        return `/ui/results/${SDConnector.project}/${name}`;
    }
    SDConnector.imageURL = imageURL;
})(SDConnector || (SDConnector = {}));
var UIUtil;
(function (UIUtil) {
    function combineMultiLine(start, positive, negative, delimiter) {
        for (const line of (positive || "").split(/\n+/)) {
            if (line) {
                if (start) {
                    start += delimiter;
                }
                start += line;
            }
        }
        for (const line of (negative || "").split(/\n+/)) {
            if (line) {
                if (start) {
                    start += delimiter;
                }
                start += "- ";
                start += line;
            }
        }
        return start;
    }
    UIUtil.combineMultiLine = combineMultiLine;
    function combineSingleLine(start, positive, negative, delimiter) {
        if (positive) {
            if (start) {
                start += delimiter;
            }
            start += positive;
        }
        if (negative) {
            if (start) {
                start += delimiter;
            }
            start += "- ";
            start += negative;
        }
        return start;
    }
    UIUtil.combineSingleLine = combineSingleLine;
    function firstLine(text) {
        return (text || "").split(/\n+/)[0];
    }
    function waitingText(taskData) {
        return combineSingleLine(`waiting\n${taskData.seed}`, firstLine(taskData.positivePrompt), firstLine(taskData.negativePrompt), "\n");
    }
    UIUtil.waitingText = waitingText;
    function errorText(taskData) {
        return combineSingleLine(`error\n${taskData.seed}`, firstLine(taskData.positivePrompt), firstLine(taskData.negativePrompt), "\n");
    }
    UIUtil.errorText = errorText;
    function runningText(seconds, percentage, taskData) {
        return combineSingleLine(`${seconds.toFixed(0)} seconds – ${percentage.toFixed(0)} %\n${taskData.seed}`, firstLine(taskData.positivePrompt), firstLine(taskData.negativePrompt), "\n");
    }
    UIUtil.runningText = runningText;
    function imageText(seconds, taskData) {
        return combineSingleLine(`${seconds.toFixed(1)} seconds | ${taskData.seed}`, firstLine(taskData.positivePrompt), firstLine(taskData.negativePrompt), " | ");
    }
    UIUtil.imageText = imageText;
    function createHeaderIcon(parent, clickCallback, className, icon) {
        const result = document.createElement("div");
        result.classList.add(className);
        result.textContent = icon;
        result.addEventListener("click", clickCallback);
        parent.appendChild(result);
        return result;
    }
    function diceForSeed(seed) {
        switch (seed % 6) {
            case 1:
                return "⚀";
            case 2:
                return "⚁";
            case 3:
                return "⚂";
            case 4:
                return "⚃";
            case 5:
                return "⚄";
            default:
                return "⚅";
        }
    }
    function addCopyPromptIcon(parent, taskData, clickCallback) {
        const icon = createHeaderIcon(parent, clickCallback, "iconPrompt", "✑");
        icon.title = combineMultiLine(`Copy Prompt:`, taskData.positivePrompt, taskData.negativePrompt, "\n");
    }
    UIUtil.addCopyPromptIcon = addCopyPromptIcon;
    function addCopySeedIcon(parent, taskData, clickCallback) {
        const icon = createHeaderIcon(parent, clickCallback, "iconSeed", diceForSeed(taskData.seed));
        icon.title = `Copy Seed:\n${taskData.seed}`;
    }
    UIUtil.addCopySeedIcon = addCopySeedIcon;
    function addCopyParamIcon(parent, taskData, clickCallback) {
        const icon = createHeaderIcon(parent, clickCallback, "iconParam", "⚙");
        icon.title = `Copy Parameters:
Model: ${taskData.model}
Refiner Model: ${taskData.refinerModel}
Refiner Start: ${taskData.refinerStart}
First LoRA File: ${taskData.loras[0].file}
First LoRA Weight: ${taskData.loras[0].weight}
Second LoRA File: ${taskData.loras[1].file}
Second LoRA Weight: ${taskData.loras[1].weight}
Sampler: ${taskData.sampler}
Steps: ${taskData.steps}
CFG: ${taskData.CFG}
Shift: ${taskData.shift}
SSS: ${taskData.SSS}
Width: ${taskData.width}
Height: ${taskData.height}
HR Enabled: ${taskData.hiRes}
HR Width: ${taskData.hiResWidth}
HR Height: ${taskData.hiResHeight}
HR Strength: ${taskData.hiResStrength}`;
    }
    UIUtil.addCopyParamIcon = addCopyParamIcon;
    function addIconSpacer(parent) {
        const result = document.createElement("div");
        result.classList.add("iconSpacer");
        parent.appendChild(result);
    }
    UIUtil.addIconSpacer = addIconSpacer;
    function addNextIcon(parent, clickCallback) {
        const icon = createHeaderIcon(parent, clickCallback, "iconArrow", "◄");
        icon.title = "Move Forward";
    }
    UIUtil.addNextIcon = addNextIcon;
    function addPrevIcon(parent, clickCallback) {
        const icon = createHeaderIcon(parent, clickCallback, "iconArrow", "►");
        icon.title = "Move Backward";
    }
    UIUtil.addPrevIcon = addPrevIcon;
    function addRemoveIcon(parent, clickCallback) {
        const icon = createHeaderIcon(parent, clickCallback, "iconRemove", "✖");
        icon.title = "Remove";
    }
    UIUtil.addRemoveIcon = addRemoveIcon;
})(UIUtil || (UIUtil = {}));
var TaskUtil;
(function (TaskUtil) {
    const touchDevice = window.matchMedia("(hover: none)").matches;
    function addFlexStyle(element, taskData) {
        const width = taskData.width || 512;
        const height = taskData.height || 512;
        let minWidth = Math.max(150, 150 * width / height);
        let maxWidth = Math.min(800, 500 * width / height);
        let initialWidth = Math.max(250, 250 * width / height, Math.sqrt(80000 * width / height));
        initialWidth = Math.max(minWidth, Math.min(maxWidth, initialWidth));
        maxWidth = Math.max(initialWidth, 800 * width / height);
        element.style.width = `${initialWidth}px`;
        element.style.maxWidth = `${maxWidth}px`;
        element.style.minHeight = `135px`;
        element.style.aspectRatio = `${width} / ${height}`;
        element.style.flexGrow = `${initialWidth}`;
        element.style.flexShrink = `${initialWidth}`;
    }
    function addHeader(container, parent, taskData, moveCallback, removeCallback) {
        const header = document.createElement("div");
        header.classList.add("itemHeader");
        parent.appendChild(header);
        UIUtil.addCopyPromptIcon(header, taskData, event => {
            SDControl.applyParameters({
                positivePrompt: taskData.positivePrompt,
                negativePrompt: taskData.negativePrompt
            });
            event.stopPropagation();
        });
        UIUtil.addCopySeedIcon(header, taskData, event => {
            SDControl.applyParameters({
                seed: taskData.seed
            });
            event.stopPropagation();
        });
        UIUtil.addCopyParamIcon(header, taskData, event => {
            SDControl.applyParameters({
                ...taskData,
                combinedPrompt: undefined,
                positivePrompt: undefined,
                negativePrompt: undefined,
                batchCount: undefined,
                seed: undefined
            });
            event.stopPropagation();
        });
        UIUtil.addIconSpacer(header);
        if (moveCallback) {
            UIUtil.addNextIcon(header, event => {
                const prev = parent.previousElementSibling;
                if (prev) {
                    if (prev.classList.contains("imageWrapper")) {
                        moveCallback(1);
                        container.insertBefore(parent, prev);
                    }
                    else if (prev.classList.contains("error")) {
                        container.insertBefore(parent, prev);
                    }
                }
                event.stopPropagation();
            });
            UIUtil.addPrevIcon(header, event => {
                const next = parent.nextElementSibling;
                if (next) {
                    if (next.classList.contains("imageWrapper")) {
                        moveCallback(0);
                        container.insertBefore(next, parent);
                    }
                    else if (next.classList.contains("error")) {
                        container.insertBefore(next, parent);
                    }
                }
                event.stopPropagation();
            });
        }
        if (removeCallback) {
            UIUtil.addRemoveIcon(header, event => {
                removeCallback();
                event.stopPropagation();
            });
        }
    }
    function createGenericWrapper(container, taskData, moveCallback, removeCallback) {
        const result = document.createElement("div");
        addFlexStyle(result, taskData);
        addHeader(container, result, taskData, moveCallback, removeCallback);
        return result;
    }
    function addClickHandler(target, taskData) {
        target.addEventListener("click", event => {
            SDControl.applyParameters(taskData);
            event.stopPropagation();
        });
    }
    function createWrapper(container, genData) {
        switch (genData.status) {
            case "pending":
                return createWaitingWrapper(container, genData);
            case "ongoing":
                return createRunningWrapper(container, genData);
            case "error":
                return createErrorWrapper(container, genData);
        }
        return createImageWrapper(container, genData);
    }
    TaskUtil.createWrapper = createWrapper;
    function createWaitingWrapper(container, genData) {
        const result = createGenericWrapper(container, genData.taskData, null, () => SDControl.removeTask(genData.ID));
        result.classList.add("itemWrapper");
        const content = document.createElement("div");
        content.classList.add("itemContent");
        content.textContent = UIUtil.waitingText(genData.taskData);
        addClickHandler(content, genData.taskData);
        result.appendChild(content);
        return result;
    }
    TaskUtil.createWaitingWrapper = createWaitingWrapper;
    function createRunningWrapper(container, genData) {
        const result = createGenericWrapper(container, genData.taskData, null, () => SDControl.removeTask(genData.ID));
        result.classList.add("itemWrapper");
        result.classList.add("running");
        const content = document.createElement("div");
        content.classList.add("itemContent");
        addClickHandler(content, genData.taskData);
        result.appendChild(content);
        content.innerText = UIUtil.runningText(progressOf(genData).seconds, progressOf(genData).percentage, genData.taskData);
        return result;
    }
    TaskUtil.createRunningWrapper = createRunningWrapper;
    function updateRunningWrapper(wrapper, genData) {
        const content = wrapper.querySelector(".itemContent");
        if (content) {
            content.innerText = UIUtil.runningText(progressOf(genData).seconds, progressOf(genData).percentage, genData.taskData);
        }
    }
    TaskUtil.updateRunningWrapper = updateRunningWrapper;
    function createErrorWrapper(container, genData) {
        const result = createGenericWrapper(container, genData.taskData, null, () => SDControl.removeTask(genData.ID));
        result.classList.add("itemWrapper");
        result.classList.add("error");
        const content = document.createElement("div");
        content.classList.add("itemContent");
        content.textContent = UIUtil.errorText(genData.taskData);
        addClickHandler(content, genData.taskData);
        result.appendChild(content);
        return result;
    }
    TaskUtil.createErrorWrapper = createErrorWrapper;
    function createImageWrapper(container, genData) {
        const result = createGenericWrapper(container, genData.taskData, (movement) => SDConnector.moveGen(genData.ID, movement), () => SDControl.removeTask(genData.ID));
        result.classList.add("imageWrapper");
        const image = document.createElement("img");
        image.src = SDConnector.imageURL(genData.imageName);
        result.appendChild(image);
        const content = document.createElement("div");
        content.classList.add("itemContent");
        content.textContent = UIUtil.imageText(genData.genTime / 1000, genData.taskData);
        addClickHandler(content, genData.taskData);
        result.firstChild.appendChild(content);
        result.addEventListener("click", event => {
            event.stopPropagation();
            if (touchDevice) {
                const selected = SDControl.toggleSelection(genData);
                result.classList.toggle("selected", selected);
                return;
            }
            if (event.shiftKey) {
                SDControl.selectRange(genData);
                return;
            }
            if (event.ctrlKey || event.metaKey) {
                const selected = SDControl.toggleSelection(genData);
                result.classList.toggle("selected", selected);
                return;
            }
            if (event.altKey) {
                toggleFullScreen(result);
                return;
            }
            const selected = SDControl.selectExclusive(genData);
            result.classList.toggle("selected", selected);
        });
        document.addEventListener("keydown", event => {
            if (result.classList.contains("FullScreen")) {
                if (event.key == "ArrowLeft") {
                    const prevElement = result.previousElementSibling;
                    if (prevElement) {
                        if (prevElement.classList.contains("imageWrapper")) {
                            prevElement.classList.add("FullScreen");
                            result.classList.remove("FullScreen");
                            event.stopImmediatePropagation();
                            event.preventDefault();
                        }
                    }
                }
                else if (event.key == "ArrowRight") {
                    const nextElement = result.nextElementSibling;
                    if (nextElement) {
                        if (nextElement.classList.contains("imageWrapper")) {
                            nextElement.classList.add("FullScreen");
                            result.classList.remove("FullScreen");
                            event.stopImmediatePropagation();
                            event.preventDefault();
                        }
                    }
                }
            }
        });
        return result;
    }
    TaskUtil.createImageWrapper = createImageWrapper;
    function toggleFullScreen(result) {
        if (result.classList.contains("FullScreen")) {
            result.classList.remove("FullScreen");
        }
        else {
            result.classList.add("FullScreen");
        }
    }
    function progressOf(genData) {
        return genData.progress || { seconds: 0, percentage: 0 };
    }
})(TaskUtil || (TaskUtil = {}));
class GenTask {
    constructor(container, genData) {
        this.container = container;
        this.ID = genData.ID;
        this.status = null;
        this.wrapper = null;
        this.update(genData);
    }
    update(genData) {
        if (genData.status === this.status) {
            if (genData.status == "ongoing") {
                TaskUtil.updateRunningWrapper(this.wrapper, genData);
            }
            return;
        }
        this.refresh(genData);
    }
    refresh(genData) {
        const next = TaskUtil.createWrapper(this.container, genData);
        if (this.wrapper) {
            this.container.replaceChild(next, this.wrapper);
        }
        this.wrapper = next;
        this.status = genData.status;
    }
}
var SDControl;
(function (SDControl) {
    let inputs;
    let container;
    const wrappers = new Map();
    const pollInterval = 1000;
    let pollHandle = null;
    let polling = false;
    function applyParameters(parameters) {
        if (parameters.combinedPrompt == null) {
            if (typeof parameters.positivePrompt == "string") {
                if (typeof parameters.negativePrompt == "string") {
                    parameters.combinedPrompt = UIUtil.combineMultiLine("", parameters.positivePrompt, parameters.negativePrompt, "\n");
                }
            }
        }
        for (const input of inputs) {
            let value = parameters;
            const key = input.getAttribute("SDTarget");
            for (const part of key.split("/")) {
                if (value) {
                    value = value[part];
                }
            }
            if (value === undefined) {
                continue;
            }
            const type = input.getAttribute("SDType");
            switch (type) {
                case "bool":
                    input.checked = value;
                    break;
                case "int":
                    input.value = value.toFixed(0);
                    break;
                case "float":
                    input.value = Number(value.toFixed(2));
                    break;
                case "string":
                    input.value = value;
                    break;
                case "nest":
                    addMissingOption(input, value);
                    input.value = value || "";
                    break;
            }
        }
    }
    SDControl.applyParameters = applyParameters;
    function addMissingOption(select, value) {
        if (value == null || value == "") {
            return;
        }
        for (const option of select.options) {
            if (option.value == value) {
                return;
            }
        }
        const option = document.createElement("option");
        option.textContent = value;
        option.value = value;
        select.appendChild(option);
    }
    const seedInput = document.getElementById("currentSeed");
    function applyNextSeed() {
        seedInput.value = XSRandom.next(parseInt(seedInput.value));
    }
    const widthInput = document.getElementById("width");
    const heightInput = document.getElementById("height");
    const hiResWidthInput = document.getElementById("hiResWidth");
    const hiResHeightInput = document.getElementById("hiResHeight");
    const hiResStrengthInput = document.getElementById("hiResStrength");
    const originalWidthInput = document.getElementById("originalWidth");
    const originalHeightInput = document.getElementById("originalHeight");
    const targetWidthInput = document.getElementById("targetWidth");
    const targetHeightInput = document.getElementById("targetHeight");
    const negativeWidthInput = document.getElementById("negativeWidth");
    const negativeHeightInput = document.getElementById("negativeHeight");
    const projectList = document.getElementById("projectList");
    const upscalerList = document.getElementById("upscalerList");
    const presetList = document.getElementById("presetList");
    const presetsByName = new Map();
    const selectedIDs = new Set();
    const genDataByID = new Map();
    let selectionAnchor = null;
    function resetSiblings(...elements) {
        for (const element of elements) {
            element.nextElementSibling.value = element.value;
        }
    }
    function executeSwapResolution() {
        [widthInput.value, heightInput.value] = [heightInput.value, widthInput.value];
        resetSiblings(widthInput, heightInput);
        [hiResWidthInput.value, hiResHeightInput.value] = [hiResHeightInput.value, hiResWidthInput.value];
        resetSiblings(hiResWidthInput, hiResHeightInput);
        [originalWidthInput.value, originalHeightInput.value] = [originalHeightInput.value, originalWidthInput.value];
        resetSiblings(originalWidthInput, originalHeightInput);
        [targetWidthInput.value, targetHeightInput.value] = [targetHeightInput.value, targetWidthInput.value];
        resetSiblings(targetWidthInput, targetHeightInput);
        [negativeWidthInput.value, negativeHeightInput.value] = [negativeHeightInput.value, negativeWidthInput.value];
        resetSiblings(negativeWidthInput, negativeHeightInput);
    }
    function executeResetHiRes() {
        [hiResWidthInput.value, hiResHeightInput.value] = [widthInput.value, heightInput.value];
        resetSiblings(hiResWidthInput, hiResHeightInput);
        hiResStrengthInput.value = 0.5;
        resetSiblings(hiResStrengthInput);
    }
    function executeResetSizeEmbed() {
        [originalWidthInput.value, originalHeightInput.value] = [widthInput.value, heightInput.value];
        resetSiblings(originalWidthInput, originalHeightInput);
        [targetWidthInput.value, targetHeightInput.value] = [widthInput.value, heightInput.value];
        resetSiblings(targetWidthInput, targetHeightInput);
        [negativeWidthInput.value, negativeHeightInput.value] = [widthInput.value, heightInput.value];
        resetSiblings(negativeWidthInput, negativeHeightInput);
    }
    async function executeCopyParams() {
        const parameters = createTaskData();
        parameters.positivePrompt = undefined;
        parameters.negativePrompt = undefined;
        await navigator.clipboard.writeText(JSON.stringify(parameters, null, "\t"));
    }
    async function executePasteParams() {
        const paramsData = JSON.parse(await navigator.clipboard.readText());
        applyParameters(paramsData);
    }
    function createTaskData() {
        const taskData = ParamUtil.duplicateSDGen(defaultGenParam);
        for (const input of inputs) {
            let target = taskData;
            let key = input.getAttribute("SDTarget");
            const parts = key.split("/");
            key = parts.pop();
            for (const part of parts) {
                target = target[part] = target[part] || {};
            }
            const type = input.getAttribute("SDType");
            switch (type) {
                case "bool":
                    target[key] = input.checked;
                    break;
                case "int":
                    target[key] = parseInt(input.value);
                    break;
                case "float":
                    target[key] = parseFloat(input.value);
                    break;
                case "string":
                    target[key] = input.value;
                    break;
                case "nest":
                    target[key] = input.value || null;
                    break;
            }
        }
        return taskData;
    }
    function collectTaskData() {
        const taskData = createTaskData();
        const input = cleanString(taskData.combinedPrompt);
        delete taskData.combinedPrompt;
        let result = null;
        commandEngine.init(taskData, submitted => result = submitted);
        commandEngine.handleBlock(input);
        return result || taskData;
    }
    let commandEngine;
    async function addAll(randomize) {
        const taskData = createTaskData();
        const input = cleanString(taskData.combinedPrompt);
        delete taskData.combinedPrompt;
        const sources = collectSources();
        try {
            const result = await SDConnector.generateTasks(taskData, input, sources);
            renderGenerated(result.entries);
            if (randomize) {
                applyParameters({ seed: result.seed });
            }
        }
        catch (error) {
            console.warn("Unable to submit generation.");
            console.trace(error);
        }
    }
    function collectSources() {
        const result = [];
        for (const task of selectionInOrder()) {
            const genData = genDataByID.get(task.ID);
            if (genData) {
                result.push({
                    path: `${SDConnector.project}/${genData.imageName.split("?")[0]}`,
                    positivePrompt: genData.taskData.positivePrompt,
                    negativePrompt: genData.taskData.negativePrompt,
                    width: genData.taskData.width,
                    height: genData.taskData.height
                });
            }
        }
        return result;
    }
    async function submitTask(taskData) {
        try {
            await SDConnector.generate(taskData);
        }
        catch (error) {
            console.warn("Unable to submit generation.");
            console.trace(error);
        }
    }
    function renderGenerated(entries) {
        for (const genData of entries) {
            const existing = wrappers.get(genData.ID);
            if (existing) {
                genDataByID.set(genData.ID, genData);
                existing.update(genData);
                continue;
            }
            genDataByID.set(genData.ID, genData);
            const task = new GenTask(container, genData);
            wrappers.set(genData.ID, task);
            container.insertBefore(task.wrapper, container.firstChild);
        }
        updatePolling();
    }
    function renderHistory(history) {
        const seen = new Set();
        let previous = null;
        for (let i = history.length; i-- > 0;) {
            const genData = history[i];
            seen.add(genData.ID);
            genDataByID.set(genData.ID, genData);
            let task = wrappers.get(genData.ID);
            if (task) {
                task.update(genData);
            }
            else {
                task = new GenTask(container, genData);
                wrappers.set(genData.ID, task);
            }
            const anchor = previous ? previous.nextElementSibling : container.firstChild;
            if (task.wrapper != anchor) {
                container.insertBefore(task.wrapper, anchor);
            }
            previous = task.wrapper;
        }
        for (const [ID, task] of wrappers) {
            if (!seen.has(ID)) {
                if (task.wrapper.parentNode == container) {
                    container.removeChild(task.wrapper);
                }
                wrappers.delete(ID);
                genDataByID.delete(ID);
                selectedIDs.delete(ID);
            }
        }
    }
    function toggleSelection(genData) {
        if (selectedIDs.has(genData.ID)) {
            selectedIDs.delete(genData.ID);
        }
        else {
            selectedIDs.add(genData.ID);
        }
        selectionAnchor = genData.ID;
        return selectedIDs.has(genData.ID);
    }
    SDControl.toggleSelection = toggleSelection;
    function addSelection(genData) {
        selectedIDs.add(genData.ID);
        selectionAnchor = genData.ID;
    }
    SDControl.addSelection = addSelection;
    function selectExclusive(genData) {
        const wasOnly = selectedIDs.size == 1 && selectedIDs.has(genData.ID);
        if (wasOnly) {
            selectedIDs.delete(genData.ID);
            wrappers.get(genData.ID).wrapper.classList.remove("selected");
        }
        else {
            applySelection(new Set([genData.ID]));
        }
        selectionAnchor = genData.ID;
        return !wasOnly;
    }
    SDControl.selectExclusive = selectExclusive;
    function selectRange(genData) {
        const IDs = allSelectionIDs();
        const from = IDs.indexOf(selectionAnchor);
        const to = IDs.indexOf(genData.ID);
        if (from < 0 || to < 0) {
            applySelection(new Set([genData.ID]));
        }
        else {
            const next = new Set();
            const start = Math.min(from, to);
            const end = Math.max(from, to);
            for (let i = start; i <= end; ++i) {
                next.add(IDs[i]);
            }
            applySelection(next);
        }
        selectionAnchor = genData.ID;
    }
    SDControl.selectRange = selectRange;
    function clearSelection() {
        selectedIDs.clear();
        selectionAnchor = null;
        for (const [ID, task] of wrappers) {
            task.wrapper.classList.remove("selected");
        }
    }
    SDControl.clearSelection = clearSelection;
    function removeSelection() {
        const tasks = selectionInOrder();
        if (tasks.length == 0) {
            return;
        }
        const IDs = [];
        for (const task of tasks) {
            IDs.push(task.ID);
            if (task.wrapper.parentNode == container) {
                container.removeChild(task.wrapper);
            }
            wrappers.delete(task.ID);
            genDataByID.delete(task.ID);
            selectedIDs.delete(task.ID);
        }
        selectionAnchor = null;
        SDConnector.removeGens(IDs);
        updatePolling();
    }
    function removeTask(ID) {
        const task = wrappers.get(ID);
        if (task) {
            if (task.wrapper.parentNode == container) {
                container.removeChild(task.wrapper);
            }
            wrappers.delete(ID);
            genDataByID.delete(ID);
            selectedIDs.delete(ID);
        }
        SDConnector.removeGen(ID);
        updatePolling();
    }
    SDControl.removeTask = removeTask;
    function allSelectionIDs() {
        const result = [];
        for (const child of container.children) {
            if (child.classList.contains("imageWrapper")) {
                result.push(entryID(child));
            }
        }
        return result;
    }
    function applySelection(IDs) {
        selectedIDs.clear();
        for (const [ID, task] of wrappers) {
            if (IDs.has(ID)) {
                selectedIDs.add(ID);
                task.wrapper.classList.add("selected");
            }
            else {
                task.wrapper.classList.remove("selected");
            }
        }
    }
    function entryID(element) {
        for (const [ID, task] of wrappers) {
            if (task.wrapper == element) {
                return ID;
            }
        }
        return null;
    }
    function selectionInOrder() {
        const result = [];
        for (const child of container.children) {
            for (const [ID, task] of wrappers) {
                if (task.wrapper == child && selectedIDs.has(ID)) {
                    result.push(task);
                }
            }
        }
        return result;
    }
    function shiftSelection(vertical, forward) {
        const next = new Set();
        for (const ID of selectedIDs) {
            const neighbor = neighborOf(wrappers.get(ID).wrapper, vertical, forward);
            if (neighbor) {
                next.add(entryID(neighbor));
            }
        }
        if (next.size) {
            applySelection(next);
        }
    }
    function expandSelection(vertical, forward) {
        const tasks = selectionInOrder();
        if (tasks.length == 0) {
            return;
        }
        const edge = forward ? tasks[tasks.length - 1] : tasks[0];
        const neighbor = neighborOf(edge.wrapper, vertical, forward);
        if (neighbor) {
            selectedIDs.add(entryID(neighbor));
            neighbor.classList.add("selected");
        }
    }
    function moveSelection(vertical, forward) {
        const tasks = selectionInOrder();
        if (tasks.length == 0) {
            return;
        }
        if (vertical) {
            if (forward) {
                tasks.reverse();
            }
            const movement = forward ? 0 : 1;
            for (const task of tasks) {
                const wrapper = task.wrapper;
                const target = neighborOf(wrapper, true, forward);
                if (target == null) {
                    continue;
                }
                const steps = Math.abs(flatIndex(target) - flatIndex(wrapper));
                for (let i = 0; i < steps; ++i) {
                    const neighbor = forward ? wrapper.nextElementSibling : wrapper.previousElementSibling;
                    if (neighbor == null) {
                        break;
                    }
                    SDConnector.moveGen(task.ID, movement);
                    if (forward) {
                        container.insertBefore(neighbor, wrapper);
                    }
                    else {
                        container.insertBefore(wrapper, neighbor);
                    }
                }
            }
            return;
        }
        if (forward) {
            tasks.reverse();
        }
        const IDs = [];
        for (const task of tasks) {
            IDs.push(task.ID);
            const neighbor = forward ? task.wrapper.nextElementSibling : task.wrapper.previousElementSibling;
            if (neighbor == null) {
                continue;
            }
            if (forward) {
                container.insertBefore(neighbor, task.wrapper);
            }
            else {
                container.insertBefore(task.wrapper, neighbor);
            }
        }
        SDConnector.moveGens(IDs, forward ? "prev" : "next", 1);
    }
    function togglePreview() {
        const full = document.querySelector(".FullScreen");
        if (full) {
            full.classList.remove("FullScreen");
            return;
        }
        for (const child of container.children) {
            if (child.classList.contains("imageWrapper") && child.classList.contains("selected")) {
                child.classList.add("FullScreen");
                return;
            }
        }
    }
    function neighborOf(wrapper, vertical, forward) {
        if (vertical) {
            return verticalNeighbor(wrapper, forward);
        }
        const neighbor = forward ? wrapper.nextElementSibling : wrapper.previousElementSibling;
        if (neighbor && neighbor.classList.contains("imageWrapper")) {
            return neighbor;
        }
        return null;
    }
    function verticalNeighbor(wrapper, forward) {
        const rows = measureRows();
        let column = -1;
        let index = -1;
        for (let i = 0; i < rows.length; ++i) {
            column = rows[i].indexOf(wrapper);
            if (column >= 0) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            return null;
        }
        const target = forward ? rows[index + 1] : rows[index - 1];
        if (target == null) {
            return null;
        }
        let best = null;
        let distance = Infinity;
        for (let i = 0; i < target.length; ++i) {
            if (Math.abs(i - column) < distance) {
                distance = Math.abs(i - column);
                best = target[i];
            }
        }
        if (best && best.classList.contains("imageWrapper")) {
            return best;
        }
        return null;
    }
    function measureRows() {
        const result = [];
        for (const child of container.children) {
            const row = result[result.length - 1];
            if (row && Math.abs(rowCenter(row) - rowCenter([child])) < 20) {
                row.push(child);
            }
            else {
                result.push([child]);
            }
        }
        return result;
    }
    function rowCenter(row) {
        return row[0].offsetTop + row[0].offsetHeight / 2;
    }
    function flatIndex(wrapper) {
        for (let i = 0; i < container.children.length; ++i) {
            if (container.children[i] == wrapper) {
                return i;
            }
        }
        return -1;
    }
    async function pollHistory() {
        try {
            renderHistory(await SDConnector.getHistory());
            updatePolling();
        }
        catch (error) {
            console.warn("Unable to poll history.");
            console.trace(error);
        }
    }
    function runningTaskIDs() {
        const result = [];
        for (const [ID, task] of wrappers) {
            if (task.status == "pending" || task.status == "ongoing") {
                result.push(ID);
            }
        }
        return result;
    }
    function startPoll() {
        if (pollHandle != null) {
            return;
        }
        pollHandle = setInterval(() => {
            if (document.hidden == false) {
                pollStates();
            }
        }, pollInterval);
    }
    function stopPoll() {
        if (pollHandle != null) {
            clearInterval(pollHandle);
            pollHandle = null;
        }
    }
    function updatePolling() {
        if (runningTaskIDs().length == 0) {
            stopPoll();
        }
        else {
            startPoll();
        }
    }
    async function pollStates() {
        if (polling) {
            return;
        }
        const IDs = runningTaskIDs();
        if (IDs.length == 0) {
            stopPoll();
            return;
        }
        polling = true;
        try {
            const states = await SDConnector.getTaskStates(IDs);
            for (const state of states) {
                const genData = genDataByID.get(state.ID);
                const task = wrappers.get(state.ID);
                if (genData && task) {
                    genData.status = state.status;
                    genData.imageName = state.imageName ?? genData.imageName;
                    genData.genTime = state.genTime ?? genData.genTime;
                    genData.progress = { seconds: state.seconds, percentage: state.percentage };
                    task.update(genData);
                }
            }
        }
        catch (error) {
            console.warn("Unable to poll task states.");
            console.trace(error);
        }
        polling = false;
        updatePolling();
    }
    function initCollapsibleGroups() {
        const groups = document.querySelectorAll("[collapsible]");
        for (const group of groups) {
            const storageKey = `${group.id}-collapsed`;
            const storedState = localStorage.getItem(storageKey);
            if (storedState == "true") {
                group.classList.add("collapsed");
            }
            else if (storedState == "false") {
                group.classList.remove("collapsed");
            }
            group.firstElementChild.addEventListener("click", event => {
                if (group.classList.contains("collapsed")) {
                    group.classList.remove("collapsed");
                    localStorage.setItem(storageKey, "false");
                }
                else {
                    group.classList.add("collapsed");
                    localStorage.setItem(storageKey, "true");
                }
                event.stopPropagation();
            });
        }
    }
    function initCombinedInputs() {
        const rows = document.querySelectorAll("[combined]");
        for (const row of rows) {
            const slider = row.children[1];
            const numeric = row.children[2];
            slider.setAttribute("SDTarget", numeric.getAttribute("SDTarget"));
            slider.setAttribute("SDType", numeric.getAttribute("SDType"));
            numeric.min = slider.min;
            numeric.max = slider.max;
            numeric.step = slider.step;
            numeric.value = slider.value;
            slider.addEventListener("input", event => {
                numeric.value = slider.value;
            });
            numeric.addEventListener("input", event => {
                slider.value = numeric.value;
            });
        }
    }
    function initControlInterface() {
        inputs = document.querySelectorAll("[SDTarget]");
        container = document.getElementById("images");
        container.addEventListener("click", event => {
            if (event.target == container) {
                clearSelection();
            }
        });
        const nextSeedButton = document.getElementById("nextSeed");
        nextSeedButton.addEventListener("click", () => applyNextSeed());
        const randomizeCheckBox = document.getElementById("randomize");
        const swapResolutionButton = document.getElementById("swapResolution");
        swapResolutionButton.addEventListener("click", () => executeSwapResolution());
        const resetHiResButton = document.getElementById("resetHiRes");
        resetHiResButton.addEventListener("click", () => executeResetHiRes());
        const resetSizeEmbedButton = document.getElementById("resetSizeEmbed");
        resetSizeEmbedButton.addEventListener("click", () => executeResetSizeEmbed());
        const copyParamsButton = document.getElementById("copyParams");
        copyParamsButton.addEventListener("click", () => executeCopyParams());
        const pasteParamsButton = document.getElementById("pasteParams");
        pasteParamsButton.addEventListener("click", () => executePasteParams());
        const generateButton = document.getElementById("generate");
        generateButton.addEventListener("click", () => addAll(randomizeCheckBox.checked));
        const loadProjectButton = document.getElementById("loadProject");
        loadProjectButton.addEventListener("click", event => {
            const name = window.prompt("project name", SDConnector.project);
            if (name) {
                createProject(name);
            }
        });
        const reindexProjectButton = document.getElementById("reindexProject");
        reindexProjectButton.addEventListener("click", event => {
            reindexProject();
        });
        const assignParamsButton = document.getElementById("assignParams");
        assignParamsButton.addEventListener("click", event => {
            assignParams();
        });
        const renameProjectButton = document.getElementById("renameProject");
        renameProjectButton.addEventListener("click", event => {
            const name = window.prompt("new project name", SDConnector.project);
            if (name) {
                renameProject(name);
            }
        });
        projectList.addEventListener("change", event => {
            loadProject(projectList.value);
        });
        upscalerList.addEventListener("change", event => {
            if (upscalerList.value) {
                upscaleSelection(upscalerList.value);
            }
        });
        const importInput = document.createElement("input");
        importInput.type = "file";
        importInput.accept = "image/*";
        importInput.multiple = true;
        importInput.addEventListener("change", event => importSelectedImages(importInput));
        const importImagesButton = document.getElementById("importImages");
        importImagesButton.addEventListener("click", event => importInput.click());
        document.body.addEventListener("dragover", event => checkImageDrag(event));
        document.body.addEventListener("drop", event => importDroppedImages(event));
        const savePresetButton = document.getElementById("savePreset");
        savePresetButton.addEventListener("click", event => {
            const name = window.prompt("preset name");
            if (name) {
                savePreset(name);
            }
        });
        presetList.addEventListener("change", event => {
            const preset = presetsByName.get(presetList.value);
            if (preset) {
                applyParameters(preset);
            }
        });
    }
    function loadProject(projectName) {
        window.location.href = `?p=${projectName}`;
    }
    async function createProject(name) {
        const IDs = Array.from(selectedIDs);
        if (IDs.length) {
            try {
                await SDConnector.createProject(name, IDs);
            }
            catch (error) {
                console.warn("Unable to create project.");
                console.trace(error);
            }
        }
        loadProject(name);
    }
    async function renameProject(name) {
        try {
            await SDConnector.renameProject(name);
        }
        catch (error) {
            console.warn("Unable to rename project.");
            console.trace(error);
            return;
        }
        loadProject(name);
    }
    async function reindexProject() {
        try {
            await SDConnector.reindexProject();
        }
        catch (error) {
            console.warn("Unable to reindex project.");
            console.trace(error);
            return;
        }
        wrappers.clear();
        genDataByID.clear();
        selectedIDs.clear();
        selectionAnchor = null;
        container.replaceChildren();
        pollHistory();
    }
    async function assignParams() {
        const IDs = Array.from(selectedIDs);
        if (IDs.length == 0) {
            return;
        }
        try {
            await SDConnector.assignParams(IDs, collectTaskData());
        }
        catch (error) {
            console.warn("Unable to assign parameters.");
            console.trace(error);
            return;
        }
        await pollHistory();
        for (const ID of IDs) {
            const genData = genDataByID.get(ID);
            const task = wrappers.get(ID);
            if (genData && task) {
                task.refresh(genData);
            }
        }
        applySelection(new Set(IDs));
    }
    async function loadServer() {
        await loadSettings();
        await loadProjects();
        await loadUpscalers();
        await loadPresets();
        await pollHistory();
    }
    async function loadSettings() {
        try {
            const settings = await SDConnector.getSettings();
            addGroupsTo(settings.models, document.getElementById("model"));
            addGroupsTo(settings.models, document.getElementById("refinerModel"));
            addGroupsTo(settings.LoRAs, document.getElementById("LoRA0Model"));
            addGroupsTo(settings.LoRAs, document.getElementById("LoRA1Model"));
            addGroupsTo(settings.LoRAs, document.getElementById("LoRA2Model"));
            addGroupsTo(settings.controls, document.getElementById("control0Model"));
            addGroupsTo(settings.controls, document.getElementById("control1Model"));
            addGroupsTo(settings.controls, document.getElementById("control2Model"));
            addGroupsTo(settings.samplers, document.getElementById("sampler"));
            const combinedArea = document.getElementById("combined");
            combinedArea.rows = settings.combinedLines;
            modelCatalogue = createCatalogue("models", settings.models, CKPTCatalogue);
            loraCatalogue = createCatalogue("LoRAs", settings.LoRAs, CKPTCatalogue);
            controlCatalogue = createCatalogue("controls", settings.controls, CKPTCatalogue);
            samplerCatalogue = createCatalogue("samplers", settings.samplers, SimpleCatalogue);
            commandEngine = new SDCommandEngine();
        }
        catch (error) {
            console.warn("Unable to load settings.");
            console.trace(error);
        }
    }
    function addGroupsTo(groups, target) {
        for (const key in groups) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = key;
            const options = groups[key];
            addOptionsTo(options, optgroup);
            target.appendChild(optgroup);
        }
    }
    function addOptionsTo(options, target) {
        for (const key in options) {
            const option = document.createElement("option");
            option.textContent = key;
            option.value = options[key];
            target.appendChild(option);
        }
    }
    function populateProjects(projects) {
        if (projects.includes(SDConnector.project) == false) {
            projects.push(SDConnector.project);
        }
        appendProjectNode(buildProjectTree(projects), projectList);
        selectCurrentProject();
    }
    function buildProjectTree(projects) {
        const result = { path: "", items: [], folders: new Map() };
        for (const project of projects) {
            const parts = project.split("/");
            parts.pop();
            let path = "";
            let node = result;
            for (const part of parts) {
                path = path ? `${path}/${part}` : part;
                let child = node.folders.get(part);
                if (child == null) {
                    child = { path, items: [], folders: new Map() };
                    node.folders.set(part, child);
                }
                node = child;
            }
            node.items.push(project);
        }
        return result;
    }
    function appendProjectNode(node, target) {
        for (const item of node.items.sort()) {
            const option = document.createElement("option");
            option.textContent = item.slice(item.lastIndexOf("/") + 1);
            option.value = item;
            target.appendChild(option);
        }
        for (const name of Array.from(node.folders.keys()).sort()) {
            const child = node.folders.get(name);
            const group = document.createElement("optgroup");
            const depth = child.path.split("/").length - 1;
            group.label = "\u00A0\u00A0".repeat(depth) + name;
            projectList.appendChild(group);
            appendProjectNode(child, group);
        }
    }
    function selectCurrentProject() {
        projectList.value = SDConnector.project;
    }
    function createCatalogue(name, categories, CatalogueType) {
        const map = { disabled: null };
        if (categories) {
            categories = Object.values(categories);
            for (const category of categories) {
                for (const key in category) {
                    const dashed = key.replace(/[\s:+]+/g, "-");
                    map[dashed] = category[key];
                }
            }
        }
        return new CatalogueType(name, map);
    }
    async function loadProjects() {
        try {
            populateProjects(await SDConnector.getProjects());
        }
        catch (error) {
            console.warn("Unable to load projects.");
            console.trace(error);
        }
    }
    async function loadUpscalers() {
        try {
            populateUpscalers(await SDConnector.getUpscalers());
        }
        catch (error) {
            console.warn("Unable to load upscalers.");
            console.trace(error);
        }
    }
    function populateUpscalers(upscalers) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "select";
        upscalerList.appendChild(placeholder);
        for (const name of upscalers) {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            upscalerList.appendChild(option);
        }
    }
    async function loadPresets() {
        try {
            populatePresets(await SDConnector.getPresets());
        }
        catch (error) {
            console.warn("Unable to load presets.");
            console.trace(error);
        }
    }
    function populatePresets(presets) {
        presetsByName.clear();
        presetList.innerHTML = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "select";
        presetList.appendChild(placeholder);
        for (const name in presets) {
            presetsByName.set(name, presets[name]);
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            presetList.appendChild(option);
        }
    }
    async function savePreset(presetName) {
        try {
            populatePresets(await SDConnector.savePreset(presetName, createTaskData()));
        }
        catch (error) {
            console.warn("Unable to save preset.");
            console.trace(error);
        }
    }
    async function upscaleSelection(model) {
        for (const ID of selectedIDs) {
            const genData = genDataByID.get(ID);
            if (genData) {
                const taskData = { ...genData.taskData, type: "upscale" };
                taskData.sourceImage = `${SDConnector.project}/${genData.imageName.split("?")[0]}`;
                taskData.upscaleModel = model;
                await submitTask(taskData);
            }
        }
        upscalerList.value = "";
        pollHistory();
    }
    let importing = false;
    async function importSelectedImages(input) {
        await importImages(input.files);
        input.value = "";
    }
    async function importImages(files) {
        importing = true;
        document.body.style.pointerEvents = "none";
        document.body.style.opacity = "0.5";
        try {
            const images = [];
            for (let i = 0; i < files.length; ++i) {
                images.push(await readImage(files[i]));
            }
            if (images.length) {
                const entries = await SDConnector.importImages(images);
                renderGenerated(entries);
            }
        }
        catch (error) {
            console.warn("Unable to import images.");
            console.trace(error);
        }
        finally {
            importing = false;
            document.body.style.pointerEvents = "";
            document.body.style.opacity = "";
        }
    }
    function checkImageDrag(event) {
        if (importing) {
            return;
        }
        if (Array.from(event.dataTransfer.types).indexOf("Files") >= 0) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        }
    }
    function importDroppedImages(event) {
        const files = collectImageFiles(event.dataTransfer.files);
        if (files.length == 0) {
            return;
        }
        event.preventDefault();
        if (importing) {
            return;
        }
        importImages(files);
    }
    function collectImageFiles(files) {
        const result = [];
        for (let i = 0; i < files.length; ++i) {
            const file = files[i];
            if (file.type.startsWith("image/")) {
                result.push(file);
            }
        }
        return result;
    }
    function readImage(file) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.addEventListener("load", event => {
                const url = String(reader.result);
                const data = url.split(",")[1];
                const metadata = readImageMetadata(data);
                const image = new Image();
                image.addEventListener("load", () => resolve({ data, width: image.naturalWidth, height: image.naturalHeight, metadata }));
                image.addEventListener("error", () => resolve({ data, width: 512, height: 512, metadata }));
                image.src = url;
            });
            reader.readAsDataURL(file);
        });
    }
    function readImageMetadata(data) {
        try {
            return ImageMetadataUtil.extract(decodeBase64(data));
        }
        catch {
            return {};
        }
    }
    function decodeBase64(data) {
        const binary = atob(data);
        const result = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; ++i) {
            result[i] = binary.charCodeAt(i);
        }
        return result;
    }
    function initKeyboard() {
        document.addEventListener("keydown", event => {
            const target = event.target;
            if (target.tagName == "INPUT" || target.tagName == "TEXTAREA" || target.tagName == "SELECT") {
                return;
            }
            if (event.key == " ") {
                togglePreview();
                event.preventDefault();
            }
            else if (event.key == "Backspace" || event.key == "Delete") {
                if (event.ctrlKey || event.metaKey) {
                    removeSelection();
                    event.preventDefault();
                }
            }
            else if (event.key == "ArrowLeft" || event.key == "ArrowRight" || event.key == "ArrowUp" || event.key == "ArrowDown") {
                if (document.querySelector(".FullScreen")) {
                    return;
                }
                const vertical = event.key == "ArrowUp" || event.key == "ArrowDown";
                const forward = event.key == "ArrowRight" || event.key == "ArrowDown";
                if (event.shiftKey) {
                    expandSelection(vertical, forward);
                }
                else if (event.ctrlKey || event.metaKey) {
                    moveSelection(vertical, forward);
                }
                else {
                    shiftSelection(vertical, forward);
                }
                event.preventDefault();
            }
        });
    }
    async function initWakeLock() {
        try {
            await navigator.wakeLock.request("screen");
        }
        catch (error) {
            console.warn("Locking screen failed.");
        }
    }
    initCollapsibleGroups();
    initCombinedInputs();
    initControlInterface();
    initKeyboard();
    loadServer();
    initWakeLock();
})(SDControl || (SDControl = {}));
