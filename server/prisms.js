var NodeUtil;
(function (NodeUtil) {
    NodeUtil.os = require("os");
    NodeUtil.path = require("path");
    function getPath(...segments) {
        return NodeUtil.path.join(...segments);
    }
    NodeUtil.getPath = getPath;
    NodeUtil.fs = require("fs");
    function accessSync(path) {
        return NodeUtil.fs.accessSync(path);
    }
    NodeUtil.accessSync = accessSync;
    function makeDirSync(path, options) {
        return NodeUtil.fs.mkdirSync(path, options);
    }
    NodeUtil.makeDirSync = makeDirSync;
    function readFileSync(path, encoding) {
        return NodeUtil.fs.readFileSync(path, encoding);
    }
    NodeUtil.readFileSync = readFileSync;
    function writeFileSync(path, content, encoding) {
        return NodeUtil.fs.writeFileSync(path, content, encoding);
    }
    NodeUtil.writeFileSync = writeFileSync;
    function readDirSync(path) {
        return NodeUtil.fs.readdirSync(path);
    }
    NodeUtil.readDirSync = readDirSync;
    function copySync(source, destination, options) {
        return NodeUtil.fs.cpSync(source, destination, options);
    }
    NodeUtil.copySync = copySync;
    function renameSync(source, destination, options) {
        return NodeUtil.fs.renameSync(source, destination);
    }
    NodeUtil.renameSync = renameSync;
    function removeSync(path, options) {
        return NodeUtil.fs.rmSync(path, options);
    }
    NodeUtil.removeSync = removeSync;
    async function accessPromise(path) {
        return NodeUtil.fs.promises.access(path);
    }
    NodeUtil.accessPromise = accessPromise;
    async function makeDirPromise(path, options) {
        return NodeUtil.fs.promises.mkdir(path, options);
    }
    NodeUtil.makeDirPromise = makeDirPromise;
    async function readFilePromise(path, encoding) {
        return NodeUtil.fs.promises.readFile(path, encoding);
    }
    NodeUtil.readFilePromise = readFilePromise;
    async function writeFilePromise(path, content, encoding) {
        return NodeUtil.fs.promises.writeFile(path, content, encoding);
    }
    NodeUtil.writeFilePromise = writeFilePromise;
    async function appendFilePromise(path, content, encoding) {
        return NodeUtil.fs.promises.appendFile(path, content, encoding);
    }
    NodeUtil.appendFilePromise = appendFilePromise;
    async function readDirPromise(path) {
        return NodeUtil.fs.promises.readdir(path);
    }
    NodeUtil.readDirPromise = readDirPromise;
    async function copyPromise(source, destination, options) {
        return NodeUtil.fs.promises.cp(source, destination, options);
    }
    NodeUtil.copyPromise = copyPromise;
    async function renamePromise(source, destination, options) {
        return NodeUtil.fs.promises.rename(source, destination);
    }
    NodeUtil.renamePromise = renamePromise;
    async function removePromise(path, options) {
        return NodeUtil.fs.promises.rm(path, options);
    }
    NodeUtil.removePromise = removePromise;
    NodeUtil.http = require("http");
    NodeUtil.zlib = require("zlib");
    NodeUtil.process = require("child_process");
    async function executeProcess(command, input, ...args) {
        const child = NodeUtil.process.spawn(command, args);
        return new Promise(resolve => {
            let stdout = "";
            child.stdout.on("data", data => {
                stdout += data.toString();
            });
            child.stderr.on("data", data => {
                console.warn(data.toString());
            });
            child.on("error", error => {
                console.warn(`unable to spawn ${command}`);
                console.warn(error);
                resolve(null);
            });
            child.on("close", code => {
                if (code) {
                    console.warn(`${command} ended with code ${code}`);
                    resolve(null);
                }
                else {
                    resolve(stdout);
                }
            });
            child.stdin.on("error", error => {
                console.warn(`unable to write stdin to ${command}`);
                console.warn(error);
                resolve(null);
            });
            child.stdin.end(input);
        });
    }
    NodeUtil.executeProcess = executeProcess;
})(NodeUtil || (NodeUtil = {}));
const ENCODING = "utf-8";
const CTTEXT = { "Content-Type": "text/plain" };
const CTJSON = { "Content-Type": "application/json" };
class MLock {
    constructor() {
        this.release = () => { };
        this.promise = new Promise(resolve => this.release = resolve);
    }
}
var Mutex;
(function (Mutex) {
    const locks = {};
    async function lock(key) {
        const prev = locks[key];
        const lock = new MLock();
        locks[key] = lock;
        if (prev) {
            await prev.promise;
        }
        return lock;
    }
    Mutex.lock = lock;
})(Mutex || (Mutex = {}));
var FileUtil;
(function (FileUtil) {
    async function exists(path) {
        try {
            await NodeUtil.accessPromise(path);
            return true;
        }
        catch {
            return false;
        }
    }
    FileUtil.exists = exists;
    async function lock(path) {
        return Mutex.lock(path);
    }
    FileUtil.lock = lock;
    function readTextSync(path) {
        try {
            return NodeUtil.readFileSync(path, ENCODING);
        }
        catch {
            console.warn(`unable to read ${path}`);
        }
        return null;
    }
    FileUtil.readTextSync = readTextSync;
    function readJSONSync(path) {
        return parseJSON(path, readTextSync(path));
    }
    FileUtil.readJSONSync = readJSONSync;
    function writeTextSync(path, content) {
        try {
            NodeUtil.writeFileSync(path, content, ENCODING);
        }
        catch {
            console.error(`unable to write ${path}`);
        }
    }
    FileUtil.writeTextSync = writeTextSync;
    function writeJSONSync(path, data) {
        writeTextSync(path, JSON.stringify(data, null, "\t"));
    }
    FileUtil.writeJSONSync = writeJSONSync;
    async function readTextRAW(path) {
        try {
            return await NodeUtil.readFilePromise(path, ENCODING);
        }
        catch {
            console.warn(`unable to read ${path}`);
        }
        return null;
    }
    FileUtil.readTextRAW = readTextRAW;
    async function readJSONRAW(path) {
        return parseJSON(path, await readTextRAW(path));
    }
    FileUtil.readJSONRAW = readJSONRAW;
    async function writeTextRAW(path, content) {
        try {
            await NodeUtil.writeFilePromise(path, content, ENCODING);
        }
        catch {
            console.error(`unable to write ${path}`);
        }
    }
    FileUtil.writeTextRAW = writeTextRAW;
    async function writeJSONRAW(path, data) {
        await writeTextRAW(path, JSON.stringify(data, null, "\t"));
    }
    FileUtil.writeJSONRAW = writeJSONRAW;
    async function readTextLocked(path) {
        const lock = await FileUtil.lock(path);
        const result = await readTextRAW(path);
        lock.release();
        return result;
    }
    FileUtil.readTextLocked = readTextLocked;
    async function readJSONLocked(path) {
        return parseJSON(path, await readTextLocked(path));
    }
    FileUtil.readJSONLocked = readJSONLocked;
    async function writeTextLocked(path, content) {
        const lock = await FileUtil.lock(path);
        await writeTextRAW(path, content);
        lock.release();
    }
    FileUtil.writeTextLocked = writeTextLocked;
    async function writeJSONLocked(path, data) {
        await writeTextLocked(path, JSON.stringify(data, null, "\t"));
    }
    FileUtil.writeJSONLocked = writeJSONLocked;
    function parseJSON(path, content) {
        if (content) {
            try {
                return JSON.parse(content);
            }
            catch {
                console.error(`unable to parse ${path}`);
            }
        }
        return null;
    }
})(FileUtil || (FileUtil = {}));
var StreamUtil;
(function (StreamUtil) {
    async function* asIterable(stream) {
        if (stream[Symbol.asyncIterator]) {
            yield* stream;
        }
        else {
            const reader = stream.getReader();
            try {
                while (true) {
                    const result = await reader.read();
                    if (result.done) {
                        break;
                    }
                    yield result.value;
                }
            }
            finally {
                reader.releaseLock();
            }
        }
    }
    StreamUtil.asIterable = asIterable;
    async function* byChunk(stream) {
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
    StreamUtil.byChunk = byChunk;
    async function* byLine(stream) {
        const decoder = new TextDecoder(ENCODING);
        let remainder = "";
        for await (const chunk of stream) {
            const text = decoder.decode(chunk, { stream: true });
            const lines = text.split("\n");
            if (lines.length > 1) {
                yield remainder + lines.shift();
                remainder = lines.pop();
                yield* lines;
            }
            else {
                remainder += text;
            }
        }
        yield remainder + decoder.decode();
    }
    StreamUtil.byLine = byLine;
    async function* trimChunks(stream) {
        for await (let chunk of stream) {
            chunk = chunk.trim();
            if (chunk) {
                yield chunk;
            }
        }
    }
    StreamUtil.trimChunks = trimChunks;
    async function decode(stream) {
        const decoder = new TextDecoder(ENCODING);
        let result = "";
        for await (const chunk of stream) {
            result += decoder.decode(chunk, { stream: true });
        }
        result += decoder.decode();
        return result;
    }
    StreamUtil.decode = decode;
    async function process(stream, handler) {
        let result = "";
        try {
            for await (const chunk of stream) {
                try {
                    if (handler.onChunk) {
                        result += handler.onChunk(chunk);
                    }
                }
                catch (error) {
                    if (handler.onError) {
                        result += handler.onError(error);
                    }
                }
            }
        }
        catch (error) {
            if (handler.onError) {
                result += handler.onError(error);
            }
        }
        return result;
    }
    StreamUtil.process = process;
})(StreamUtil || (StreamUtil = {}));
function sendError(response, status, message, error) {
    if (response.headersSent) {
        response.end(`\n\n[Error: ${message}]`);
    }
    else {
        response.writeHead(status, CTTEXT);
        response.end(message);
    }
    console.error(message);
    console.error(error);
}
async function handleWith(request, response, handler) {
    let requestText;
    try {
        requestText = await StreamUtil.decode(request);
    }
    catch (error) {
        sendError(response, 400, "unable to decode request text", error);
        return;
    }
    let requestData;
    const contentType = request.headers["content-type"];
    if (contentType == null) {
        if (requestText.length) {
            sendError(response, 400, "content type missing for body", null);
            return;
        }
    }
    else if (contentType.toLowerCase().includes("json")) {
        try {
            requestData = JSON.parse(requestText);
        }
        catch (error) {
            sendError(response, 400, "unable to parse request JSON", error);
            return;
        }
    }
    else if (contentType.toLowerCase().includes("text")) {
        requestData = requestText;
    }
    else {
        sendError(response, 400, "wrong content type", contentType);
        return;
    }
    let responseData;
    try {
        responseData = await handler(requestData, response, request);
    }
    catch (error) {
        sendError(response, 500, "internal server error", error);
        return;
    }
    if (response.headersSent) {
    }
    else if (typeof responseData == "string") {
        response.writeHead(200, CTTEXT);
        response.end(responseData);
    }
    else if (responseData) {
        response.writeHead(200, CTJSON);
        response.end(JSON.stringify(responseData));
    }
    else {
        sendError(response, 500, "internal server error", "no response data");
    }
}
async function handleStatic(response, path) {
    try {
        const data = await NodeUtil.readFilePromise(path);
        response.statusCode = 200;
        response.end(data);
    }
    catch {
        sendError(response, 404, "static not found", path);
    }
}
function ensureSlash(path) {
    if (path.endsWith("/")) {
        return path;
    }
    return path + "/";
}
function startServer(port, ...specs) {
    async function serverFunction(request, response) {
        const url = new URL("http://" + request.headers.host + request.url);
        for (const item of specs) {
            const path = ensureSlash(url.pathname);
            const route = ensureSlash(item.route);
            if (path.startsWith(route)) {
                if (item.handler) {
                    await handleWith(request, response, item.handler);
                }
                else if (item.dir) {
                    const rest = decodeURIComponent(url.pathname.slice(route.length));
                    const path = item.dir + (rest || "index.html");
                    await handleStatic(response, path);
                }
                return;
            }
        }
        response.statusCode = 404;
        response.end("not found");
    }
    const server = NodeUtil.http.createServer(serverFunction);
    server.listen(port, event => {
        console.log("Server started at:");
        console.log("localhost:" + port);
    });
}
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
var GenMetadata;
(function (GenMetadata) {
    function describe(taskData) {
        const result = [];
        result.push(`Seed: ${text(taskData.seed)}`);
        result.push(`Model: ${text(taskData.model)}`);
        if (taskData.refiner_model) {
            result.push(`Refiner Model: ${text(taskData.refiner_model)}`);
            result.push(`Refiner Start: ${text(taskData.refiner_start)}`);
        }
        addLoRAs(result, taskData.loras || []);
        addControls(result, taskData.controls || []);
        result.push(`Sampler: ${text(taskData.sampler)}`);
        result.push(`Steps: ${text(taskData.steps)}`);
        result.push(`CFG: ${text(taskData.guidance_scale)}`);
        result.push(`Shift: ${text(taskData.shift)}`);
        result.push(`SSS: ${text(taskData.stochastic_sampling_gamma)}`);
        if (taskData.strength != null && taskData.strength != 1) {
            result.push(`Strength: ${text(taskData.strength)}`);
        }
        result.push(`Width: ${text(taskData.width)}`);
        result.push(`Height: ${text(taskData.height)}`);
        if (taskData.hires_fix) {
            result.push(`HR Width: ${text(taskData.hires_fix_width)}`);
            result.push(`HR Height: ${text(taskData.hires_fix_height)}`);
            result.push(`HR Strength: ${text(taskData.hires_fix_strength)}`);
        }
        return result.join("\n");
    }
    GenMetadata.describe = describe;
    function addLoRAs(result, loras) {
        let index = 0;
        for (const lora of loras) {
            if (lora == null) {
                continue;
            }
            result.push(`${ordinal(index)} LoRA File: ${text(lora.file)}`);
            result.push(`${ordinal(index)} LoRA Weight: ${text(lora.weight)}`);
            ++index;
        }
    }
    function addControls(result, controls) {
        let index = 0;
        for (const control of controls) {
            if (control == null) {
                continue;
            }
            result.push(`${ordinal(index)} Control File: ${text(control.file)}`);
            result.push(`${ordinal(index)} Control Weight: ${text(control.weight)}`);
            ++index;
        }
    }
    function ordinal(index) {
        switch (index) {
            case 0:
                return "First";
            case 1:
                return "Second";
            case 2:
                return "Third";
        }
        return `${index + 1}.`;
    }
    function combine(taskData) {
        const result = [];
        addLines(result, taskData.prompt, "");
        addLines(result, taskData.negative_prompt, "- ");
        return result.join("\n");
    }
    GenMetadata.combine = combine;
    function toJSON(taskData) {
        return JSON.stringify(taskData, null, "\t");
    }
    GenMetadata.toJSON = toJSON;
    function describeImage(taskData) {
        const prompt = combine(taskData);
        if (prompt) {
            return `${prompt}\n${describe(taskData)}`;
        }
        return describe(taskData);
    }
    GenMetadata.describeImage = describeImage;
    function normalize(taskData) {
        if (!taskData.hires_fix) {
            taskData.hires_fix_width = taskData.width;
            taskData.hires_fix_height = taskData.height;
            taskData.hires_fix_strength = 0.5;
        }
        const width = Math.max(taskData.width || 0, taskData.hires_fix_width || 0);
        const height = Math.max(taskData.height || 0, taskData.hires_fix_height || 0);
        if (width && height) {
            if (taskData.custom_size_embed == null) {
                taskData.custom_size_embed = hasOwnSizeEmbed(taskData, width, height);
            }
            if (!taskData.custom_size_embed) {
                taskData.original_width = width;
                taskData.original_height = height;
                taskData.target_width = width;
                taskData.target_height = height;
                taskData.negative_original_width = width;
                taskData.negative_original_height = height;
            }
        }
        taskData.loras = (taskData.loras || []).filter(item => item != null);
        taskData.controls = (taskData.controls || []).filter(item => item != null);
        delete taskData.sourceImage;
    }
    GenMetadata.normalize = normalize;
    function hasOwnSizeEmbed(taskData, width, height) {
        return differs(taskData.original_width, width)
            || differs(taskData.original_height, height)
            || differs(taskData.target_width, width)
            || differs(taskData.target_height, height)
            || differs(taskData.negative_original_width, width)
            || differs(taskData.negative_original_height, height);
    }
    function differs(value, expected) {
        return value != null && value != expected;
    }
    function addLines(result, source, prefix) {
        for (const line of (source || "").split(/\n+/)) {
            if (line) {
                result.push(prefix + line);
            }
        }
    }
    function text(value) {
        if (value === undefined || value === null) {
            return "";
        }
        return String(value);
    }
})(GenMetadata || (GenMetadata = {}));
var DTHTTPAdapter;
(function (DTHTTPAdapter) {
    const generationEndpoint = "/sdapi/v1/txt2img";
    const img2imgEndpoint = "/sdapi/v1/img2img";
    function convertTo(params) {
        const result = {
            APIHost: params.APIHost,
            inputMode: params.inputMode,
            inputImage: params.inputImage,
            prompt: params.positivePrompt,
            negative_prompt: params.negativePrompt,
            batch_count: params.batchCount,
            seed: params.seed,
            seed_mode: params.seedMode,
            model: params.model,
            refiner_model: params.refinerModel,
            refiner_start: params.refinerStart,
            loras: params.loras.filter(lora => lora.file).map(convertLoRATo),
            controls: params.controls.filter(control => control.file).map(convertControlTo),
            sampler: params.sampler,
            steps: params.steps,
            guidance_scale: params.cfg,
            shift: params.shift,
            stochastic_sampling_gamma: params.sss,
            strength: params.strength,
            hires_fix_strength: params.hiResStrength
        };
        if (params.hiRes) {
            result.hires_fix = true;
            result.width = params.hiResWidth;
            result.height = params.hiResHeight;
            result.hires_fix_width = params.width;
            result.hires_fix_height = params.height;
        }
        else {
            result.hires_fix = false;
            result.width = params.width;
            result.height = params.height;
            result.hires_fix_width = params.hiResWidth;
            result.hires_fix_height = params.hiResHeight;
        }
        result.original_width = params.originalWidth;
        result.original_height = params.originalHeight;
        result.target_width = params.targetWidth;
        result.target_height = params.targetHeight;
        result.negative_original_width = params.negativeWidth;
        result.negative_original_height = params.negativeHeight;
        return result;
    }
    DTHTTPAdapter.convertTo = convertTo;
    function convertFrom(data) {
        const result = {
            APIType: "",
            APIHost: data.APIHost ?? "",
            APITool: "",
            inputMode: data.inputMode ?? "path",
            inputImage: data.inputImage ?? null,
            positivePrompt: data.prompt ?? "",
            negativePrompt: data.negative_prompt ?? "",
            batchCount: data.batch_count,
            seed: data.seed,
            seedMode: data.seed_mode,
            model: data.model,
            refinerModel: data.refiner_model,
            refinerStart: data.refiner_start,
            loras: (data.loras ?? []).filter(lora => lora.file).map(convertLoRAFrom),
            controls: (data.controls ?? []).filter(control => control.file).map(convertControlFrom),
            sampler: data.sampler,
            steps: data.steps,
            cfg: data.guidance_scale,
            shift: data.shift,
            sss: data.stochastic_sampling_gamma,
            strength: data.strength,
            hiResStrength: data.hires_fix_strength,
            customSizeEmbed: data.original_width != null
        };
        if (data.hires_fix) {
            result.hiRes = true;
            result.width = Math.min(data.width, data.hires_fix_width);
            result.height = Math.min(data.height, data.hires_fix_height);
            result.hiResWidth = Math.max(data.width, data.hires_fix_width);
            result.hiResHeight = Math.max(data.height, data.hires_fix_height);
        }
        else {
            result.hiRes = false;
            result.width = data.width;
            result.height = data.height;
            result.hiResWidth = data.hires_fix_width;
            result.hiResHeight = data.hires_fix_height;
        }
        result.originalWidth = data.original_width;
        result.originalHeight = data.original_height;
        result.targetWidth = data.target_width;
        result.targetHeight = data.target_height;
        result.negativeWidth = data.negative_original_width;
        result.negativeHeight = data.negative_original_height;
        return result;
    }
    DTHTTPAdapter.convertFrom = convertFrom;
    function parse(data) {
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    DTHTTPAdapter.parse = parse;
    async function generate(data, outputPath, signal) {
        const config = { ...data };
        delete config.APIHost;
        delete config.inputMode;
        delete config.inputImage;
        if (data.inputImage) {
            config.init_images = [readInputImage(data)];
            const response = await forward(data.APIHost, img2imgEndpoint, "POST", JSON.stringify(config), signal);
            return response.images[0];
        }
        const response = await forward(data.APIHost, generationEndpoint, "POST", JSON.stringify(config), signal);
        return response.images[0];
    }
    DTHTTPAdapter.generate = generate;
    function readInputImage(data) {
        if (data.inputMode == "path") {
            const buffer = NodeUtil.readFileSync(data.inputImage);
            return buffer.toString("base64");
        }
        return data.inputImage;
    }
    function convertLoRATo(param) {
        return { file: param.file, weight: param.weight };
    }
    function convertLoRAFrom(param) {
        return { file: param.file, weight: param.weight };
    }
    function convertControlTo(param) {
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
    function convertControlFrom(param) {
        return {
            file: param.file,
            weight: param.weight,
            priority: param.control_importance,
            start: param.guidance_start,
            end: param.guidance_end,
            inputOverride: param.input_override,
            targetBlocks: param.target_blocks
        };
    }
    async function forward(APIHost, endpoint, method, body, signal) {
        const url = `${APIHost}${endpoint}`;
        const response = await fetch(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : {},
            body,
            signal
        });
        if (response.ok == false) {
            const errorText = await response.text();
            console.error(`Draw Things API error ${response.status}:`, errorText);
            throw new Error(`Draw Things API returned ${response.status}: ${errorText.substring(0, 500)}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        }
        catch (error) {
            console.error("Failed to parse response:", text.substring(0, 500));
            throw error;
        }
    }
})(DTHTTPAdapter || (DTHTTPAdapter = {}));
var DTCLIAdapter;
(function (DTCLIAdapter) {
    const samplerNames = [
        "DPM++ 2M Karras",
        "Euler a",
        "DDIM",
        "UniPC",
        "DPM++ SDE Karras",
        "PLMS",
        "LCM",
        "Euler A Substep",
        "DPM++ SDE Substep",
        "TCD",
        "Euler A Trailing",
        "DPM++ SDE Trailing",
        "DPM++ 2M AYS",
        "Euler A AYS",
        "DPM++ SDE AYS",
        "DPM++ 2M Trailing",
        "DDIM Trailing",
        "UniPC Trailing",
        "UniPC AYS",
        "TCD Trailing"
    ];
    const seedModeNames = [
        "Legacy",
        "Torch",
        "Scale Alike"
    ];
    function convertTo(params) {
        const sampler = samplerNames.indexOf(params.sampler);
        const seedMode = seedModeNames.indexOf(params.seedMode);
        const result = {
            APITool: params.APITool,
            modelsFolder: params.modelsFolder,
            inputMode: params.inputMode,
            inputImage: params.inputImage,
            prompt: params.positivePrompt,
            negativePrompt: params.negativePrompt,
            seed: params.seed,
            seedMode,
            batchCount: params.batchCount,
            model: params.model,
            refinerModel: params.refinerModel,
            refinerStart: params.refinerStart,
            loras: params.loras.filter(lora => lora.file).map(convertLoRATo),
            controls: params.controls.filter(control => control.file).map(convertControlTo),
            sampler,
            steps: params.steps,
            guidanceScale: params.cfg,
            shift: params.shift,
            stochasticSamplingGamma: params.sss,
            strength: params.strength,
            hiresFixStrength: params.hiResStrength
        };
        if (params.hiRes) {
            result.hiresFix = true;
            result.width = params.hiResWidth;
            result.height = params.hiResHeight;
            result.hiresFixWidth = params.width;
            result.hiresFixHeight = params.height;
        }
        else {
            result.hiresFix = false;
            result.width = params.width;
            result.height = params.height;
            result.hiresFixWidth = params.hiResWidth;
            result.hiresFixHeight = params.hiResHeight;
        }
        result.originalImageWidth = params.originalWidth;
        result.originalImageHeight = params.originalHeight;
        result.targetImageWidth = params.targetWidth;
        result.targetImageHeight = params.targetHeight;
        result.negativeOriginalImageWidth = params.negativeWidth;
        result.negativeOriginalImageHeight = params.negativeHeight;
        return result;
    }
    DTCLIAdapter.convertTo = convertTo;
    function convertFrom(data) {
        const result = {
            APIType: "",
            APIHost: "",
            APITool: data.APITool ?? "",
            modelsFolder: data.modelsFolder ?? null,
            inputMode: data.inputMode ?? "path",
            inputImage: data.inputImage ?? null,
            positivePrompt: data.prompt ?? "",
            negativePrompt: data.negativePrompt ?? "",
            batchCount: data.batchCount,
            seed: data.seed,
            seedMode: seedModeNames[data.seedMode],
            model: data.model,
            refinerModel: data.refinerModel,
            refinerStart: data.refinerStart,
            loras: (data.loras ?? []).filter(lora => lora.file).map(convertLoRAFrom),
            controls: (data.controls ?? []).filter(control => control.file).map(convertControlFrom),
            sampler: samplerNames[data.sampler],
            steps: data.steps,
            cfg: data.guidanceScale,
            shift: data.shift,
            sss: data.stochasticSamplingGamma,
            strength: data.strength,
            hiResStrength: data.hiresFixStrength,
            customSizeEmbed: data.originalImageWidth != null
        };
        if (data.hiresFix) {
            result.hiRes = true;
            result.width = Math.min(data.width, data.hiresFixWidth);
            result.height = Math.min(data.height, data.hiresFixHeight);
            result.hiResWidth = Math.max(data.width, data.hiresFixWidth);
            result.hiResHeight = Math.max(data.height, data.hiresFixHeight);
        }
        else {
            result.hiRes = false;
            result.width = data.width;
            result.height = data.height;
            result.hiResWidth = data.hiresFixWidth;
            result.hiResHeight = data.hiresFixHeight;
        }
        result.originalWidth = data.originalImageWidth;
        result.originalHeight = data.originalImageHeight;
        result.targetWidth = data.targetImageWidth;
        result.targetHeight = data.targetImageHeight;
        result.negativeWidth = data.negativeOriginalImageWidth;
        result.negativeHeight = data.negativeOriginalImageHeight;
        return result;
    }
    DTCLIAdapter.convertFrom = convertFrom;
    function parse(data) {
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    DTCLIAdapter.parse = parse;
    async function generate(data, outputPath, signal, onProgress) {
        const tool = data.APITool ?? "draw-things-cli";
        const config = { ...data };
        delete config.APITool;
        delete config.modelsFolder;
        delete config.inputMode;
        delete config.inputImage;
        delete config.prompt;
        delete config.negativePrompt;
        const configJson = JSON.stringify(config);
        const args = [
            "generate",
            "--config-json", configJson,
            "-p", data.prompt ?? "",
            "--output", outputPath,
            "--model", data.model ?? "",
            "--models-dir", data.modelsFolder ?? ""
        ];
        let inputPath = null;
        if (data.inputImage) {
            if (data.inputMode == "path") {
                inputPath = data.inputImage;
            }
            else {
                inputPath = `${outputPath}.input.png`;
                await NodeUtil.writeFilePromise(inputPath, Buffer.from(data.inputImage, "base64"));
            }
            args.push("--image", inputPath);
        }
        if (data.negativePrompt) {
            args.push("--negative-prompt", data.negativePrompt);
        }
        try {
            return await spawn(tool, args, outputPath, signal, onProgress);
        }
        finally {
            if (inputPath && data.inputMode == "raw") {
                try {
                    await NodeUtil.removePromise(inputPath);
                }
                catch {
                }
            }
        }
    }
    DTCLIAdapter.generate = generate;
    function spawn(tool, args, outputPath, signal, onProgress) {
        const child = NodeUtil.process.spawn(tool, args);
        return new Promise((resolve, reject) => {
            let stderr = "";
            let progressText = "";
            const collectProgress = (text) => {
                if (!onProgress) {
                    return;
                }
                progressText += text;
                if (progressText.length > 4096) {
                    progressText = progressText.slice(-4096);
                }
                const percentage = parseProgress(progressText);
                if (percentage != null) {
                    onProgress(percentage);
                }
            };
            const abortCallback = () => child.kill();
            if (signal) {
                signal.addEventListener("abort", abortCallback);
            }
            child.stdout.on("data", data => {
                const str = data.toString();
                process.stdout.write(str);
                collectProgress(str);
            });
            child.stderr.on("data", data => {
                const str = data.toString();
                stderr += str;
                process.stderr.write(str);
                collectProgress(str);
            });
            child.on("close", code => {
                if (signal) {
                    signal.removeEventListener("abort", abortCallback);
                }
                if (signal && signal.aborted) {
                    reject(new Error("Generation aborted"));
                }
                else if (code != 0) {
                    console.error(`draw-things-cli failed with code ${code}`);
                    reject(new Error(`draw-things-cli failed: ${stderr}`));
                }
                else {
                    try {
                        if (NodeUtil.fs.existsSync(outputPath) == false) {
                            reject(new Error(`Output file not found: ${outputPath}`));
                            return;
                        }
                        resolve(NodeUtil.readFileSync(outputPath).toString("base64"));
                    }
                    catch (error) {
                        reject(new Error(`Failed to read output image: ${error}`));
                    }
                }
            });
            child.on("error", error => {
                if (signal) {
                    signal.removeEventListener("abort", abortCallback);
                }
                console.error("Failed to spawn draw-things-cli:", error);
                reject(error);
            });
        });
    }
    function parseProgress(text) {
        let percentage = null;
        let match;
        const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
        while (match = percentPattern.exec(text)) {
            percentage = parseFloat(match[1]);
        }
        if (percentage == null) {
            const stepPattern = /(\d+)\s*\/\s*(\d+)/g;
            while (match = stepPattern.exec(text)) {
                const value = parseInt(match[1]);
                const total = parseInt(match[2]);
                if (total && value <= total) {
                    percentage = value / total * 100;
                }
            }
        }
        if (percentage == null) {
            return null;
        }
        return Math.max(0, Math.min(100, percentage));
    }
    function convertLoRATo(param) {
        return { file: param.file, weight: param.weight };
    }
    function convertLoRAFrom(param) {
        return { file: param.file, weight: param.weight };
    }
    function convertControlTo(param) {
        return {
            file: param.file,
            weight: param.weight,
            controlImportance: param.priority ?? "balanced",
            guidanceStart: param.start ?? 0,
            guidanceEnd: param.end ?? 1,
            noPrompt: false,
            downSamplingRate: 1,
            globalAveragePooling: false,
            inputOverride: param.inputOverride ?? "",
            targetBlocks: param.targetBlocks ?? []
        };
    }
    function convertControlFrom(param) {
        return {
            file: param.file,
            weight: param.weight,
            priority: param.controlImportance,
            start: param.guidanceStart,
            end: param.guidanceEnd,
            inputOverride: param.inputOverride,
            targetBlocks: param.targetBlocks
        };
    }
})(DTCLIAdapter || (DTCLIAdapter = {}));
var ImageGenService;
(function (ImageGenService) {
    const adapters = {
        "default": DTCLIAdapter,
        "dtcli": DTCLIAdapter,
        "cli": DTCLIAdapter,
        "dthttp": DTHTTPAdapter,
        "http": DTHTTPAdapter
    };
    ImageGenService.defaults = {
        APIType: "default",
        APIHost: null,
        APITool: "draw-things-cli",
        modelsFolder: null,
        inputMode: "path",
        inputImage: null,
        positivePrompt: "",
        negativePrompt: "",
        batchCount: 1,
        seed: 0,
        seedMode: "Scale Alike",
        refinerStart: 0.5,
        loras: [],
        controls: [],
        sampler: "DPM++ 2M Karras",
        steps: 20,
        cfg: 5,
        shift: 1,
        sss: 0.3,
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
    function normalize(params) {
        const result = { ...ImageGenService.defaults, ...params };
        result.hiResWidth = params.hiResWidth ?? result.width;
        result.hiResHeight = params.hiResHeight ?? result.height;
        result.originalWidth = params.originalWidth ?? result.width;
        result.originalHeight = params.originalHeight ?? result.height;
        result.targetWidth = params.targetWidth ?? result.width;
        result.targetHeight = params.targetHeight ?? result.height;
        result.negativeWidth = params.negativeWidth ?? result.width;
        result.negativeHeight = params.negativeHeight ?? result.height;
        if (result.hiRes) {
            const width = Math.min(result.width, result.hiResWidth);
            const height = Math.min(result.height, result.hiResHeight);
            result.hiResWidth = Math.max(result.width, result.hiResWidth);
            result.hiResHeight = Math.max(result.height, result.hiResHeight);
            result.width = width;
            result.height = height;
        }
        return result;
    }
    ImageGenService.normalize = normalize;
    async function generate(params, outputPath, signal, onProgress) {
        const adapter = adapters[params.APIType] ?? adapters["default"];
        const converted = adapter.convertTo(normalize(params));
        return adapter.generate(converted, outputPath, signal, onProgress);
    }
    ImageGenService.generate = generate;
    function parse(APIType, data) {
        const adapter = adapters[APIType] ?? adapters["default"];
        return adapter.convertFrom(adapter.parse(data));
    }
    ImageGenService.parse = parse;
})(ImageGenService || (ImageGenService = {}));
var RESRGANAdapter;
(function (RESRGANAdapter) {
    async function listModels(params) {
        const result = [];
        try {
            for (const name of NodeUtil.readDirSync(getModelsPath(params))) {
                if (name.endsWith(".param")) {
                    result.push(name.substring(0, name.length - ".param".length));
                }
            }
        }
        catch {
        }
        result.sort();
        return result;
    }
    RESRGANAdapter.listModels = listModels;
    async function upscale(params, inputPath, outputPath) {
        await NodeUtil.executeProcess(params.APITool, "", "-i", inputPath, "-o", outputPath, "-m", getModelsPath(params), "-n", params.model);
        const buffer = NodeUtil.readFileSync(outputPath);
        return buffer.toString("base64");
    }
    RESRGANAdapter.upscale = upscale;
    function getModelsPath(params) {
        if (params.modelsPath == null) {
            return null;
        }
        if (hasModelFiles(params.modelsPath)) {
            return params.modelsPath;
        }
        const nestedPath = NodeUtil.getPath(params.modelsPath, "models");
        if (hasModelFiles(nestedPath)) {
            return nestedPath;
        }
        return params.modelsPath;
    }
    function hasModelFiles(path) {
        try {
            for (const name of NodeUtil.readDirSync(path)) {
                if (name.endsWith(".param")) {
                    return true;
                }
            }
        }
        catch {
        }
        return false;
    }
})(RESRGANAdapter || (RESRGANAdapter = {}));
var ImageSRService;
(function (ImageSRService) {
    const adapters = {
        "default": RESRGANAdapter,
        "resrgan": RESRGANAdapter,
        "local": RESRGANAdapter
    };
    ImageSRService.defaults = {
        APIType: "default",
        APIHost: null,
        APITool: "realesrgan-ncnn-vulkan",
        modelsPath: null,
        model: null
    };
    function normalize(params) {
        return { ...ImageSRService.defaults, ...params };
    }
    ImageSRService.normalize = normalize;
    async function listModels(params) {
        const normalized = normalize(params);
        const adapter = adapters[normalized.APIType] ?? adapters["default"];
        return adapter.listModels(normalized);
    }
    ImageSRService.listModels = listModels;
    async function upscale(params, inputPath, outputPath) {
        const normalized = normalize(params);
        const adapter = adapters[normalized.APIType] ?? adapters["default"];
        return adapter.upscale(normalized, inputPath, outputPath);
    }
    ImageSRService.upscale = upscale;
})(ImageSRService || (ImageSRService = {}));
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
class BasePreprocessor {
    init(seed, handler) {
        this.variables = {};
        this.random = new XSRandom(seed);
        this.localIndex = 1;
        this.globalIndex = 1;
        this.handler = handler;
    }
    handleBlock(block) {
        this.localIndex = 1;
        const list = [block];
        while (list.length) {
            const current = list.pop();
            const match = current.match(/{[^{}]+}/);
            if (match) {
                const original = match[0];
                try {
                    const result = this.handleWildcard(original);
                    for (const replacement of result.reverse()) {
                        list.push(current.replace(original, replacement));
                    }
                }
                catch (message) {
                    console.log(`Error at wildcard: ${original}`);
                    console.log(`Error message: ${message}`);
                }
            }
            else if (current) {
                console.log("hadling:\n" + current);
                this.handler(current);
                ++this.localIndex;
                ++this.globalIndex;
            }
        }
    }
    handleWildcard(original) {
        let parts;
        if (parts = original.match(/{@(\w+)\s*=(.*)}/s)) {
            return this.handleAssignment(parts[1], parts[2]);
        }
        if (original.match(/\+/)) {
            return this.handleAll(original.substring(1, original.length - 1));
        }
        if (original.match(/\|/)) {
            return this.handleSelect(original.substring(1, original.length - 1));
        }
        if (parts = original.match(/{(\+?\d+)}/)) {
            const count = parseInt(parts[1]);
            return this.handleTimes(count, 1);
        }
        if (parts = original.match(/{([+-]?\d+\.?\d*|[+-]?\.\d+):([+-]?\d+\.?\d*|[+-]?\.\d+):([+-]?\d+\.?\d*|[+-]?\.\d+)}/)) {
            const start = parseFloat(parts[1]);
            const limit = parseFloat(parts[2]);
            const step = parseFloat(parts[3]);
            return this.handleFor(start, limit, step);
        }
        if (original.match(/{@/)) {
            return this.handleFunction(original.substring(2, original.length - 1));
        }
        return this.handleComment(original.substring(1, original.length - 1));
    }
    handleAssignment(name, value) {
        if (name in this.wildcards) {
            throw "Trying to override function.";
        }
        value = value.trim();
        this.variables[name] = value;
        return [value];
    }
    handleAll(content) {
        return content.split("+").map(value => value.trim());
    }
    handleSelect(content) {
        const options = content.split("|").map(value => value.trim());
        const value = options[this.random.next() % options.length];
        return [value];
    }
    handleTimes(count, digits) {
        const result = [];
        for (let i = 0; i < count; ++i) {
            result.push(formatIndex(i + 1, digits));
        }
        return result;
    }
    handleFor(start, limit, step) {
        const result = [];
        step = Math.sign(limit - start) * Math.abs(step);
        if (step > 0) {
            for (let i = start; i < limit + BasePreprocessor.limitThreshold; i += step) {
                result.push(String(i));
            }
        }
        else if (step < 0) {
            for (let i = start; i > limit - BasePreprocessor.limitThreshold; i += step) {
                result.push(String(i));
            }
        }
        else {
            throw "Step should not be 0.";
        }
        return result;
    }
    handleFunction(content) {
        const parts = content.split(/\s*[:\s]\s*/);
        const name = parts[0];
        if (name in this.wildcards) {
            const parameters = new ParameterList(parts.slice(1));
            return this.wildcards[name](parameters);
        }
        if (name in this.variables) {
            const value = this.variables[name];
            return [value];
        }
        throw "No such wildcard.";
    }
    handleComment(content) {
        console.log(content);
        return [""];
    }
}
BasePreprocessor.limitThreshold = 0.000001;
class STDPreprocessor extends BasePreprocessor {
    constructor() {
        super(...arguments);
        this.timesHandler = (parameters) => {
            return this.handleTimes(parameters.nextInt(), parameters.nextInt(1));
        };
        this.forHandler = (parameters) => {
            return this.handleFor(parameters.nextFloat(), parameters.nextFloat(), parameters.nextFloat());
        };
        this.randomDigitsHandler = (parameters) => {
            let result = "";
            const count = parameters.nextInt();
            for (let i = 0; i < count; ++i) {
                result += String.fromCharCode(48 + this.random.next() % 10);
            }
            return [result];
        };
        this.randomLettersHandler = (parameters) => {
            let result = "";
            const count = parameters.nextInt();
            for (let i = 0; i < count; ++i) {
                result += String.fromCharCode(97 + this.random.next() % 26);
            }
            return [result];
        };
        this.localIndexHandler = (parameters) => {
            return [formatIndex(this.localIndex, parameters.nextInt(1))];
        };
        this.globalIndexHandler = (parameters) => {
            return [formatIndex(this.globalIndex, parameters.nextInt(1))];
        };
        this.wildcards = {
            "times": this.timesHandler,
            "for": this.forHandler,
            "randomDigits": this.randomDigitsHandler,
            "num": this.randomDigitsHandler,
            "randomLetters": this.randomLettersHandler,
            "word": this.randomLettersHandler,
            "localIndex": this.localIndexHandler,
            "i": this.localIndexHandler,
            "globalIndex": this.globalIndexHandler,
            "n": this.globalIndexHandler
        };
    }
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
var SettingsUtil;
(function (SettingsUtil) {
    SettingsUtil.homePath = NodeUtil.os.homedir();
    const configDir = NodeUtil.getPath(SettingsUtil.homePath, ".config", "think-tank");
    const configPath = NodeUtil.getPath(configDir, "locations.json");
    function getLocation(local) {
        const locations = FileUtil.readJSONSync(configPath) ?? {};
        return resolveLocation(locations, local);
    }
    SettingsUtil.getLocation = getLocation;
    function resolveLocation(locations, local) {
        const headParts = local.split(/(\/)/);
        const tailParts = [];
        while (true) {
            const headString = headParts.join("");
            const tailString = tailParts.join("");
            if (headString) {
                if (headString in locations) {
                    return `${locations[headString]}${tailString}`;
                }
                else {
                    tailParts.unshift(headParts.pop());
                }
            }
            else {
                return NodeUtil.getPath(SettingsUtil.homePath, tailString);
            }
        }
    }
    async function ensure(path, defaults) {
        const lock = await FileUtil.lock(path);
        try {
            const settings = await FileUtil.readJSONRAW(path);
            if (settings == null) {
                await FileUtil.writeJSONRAW(path, defaults);
            }
            return mergeAll(defaults, settings);
        }
        finally {
            lock.release();
        }
    }
    SettingsUtil.ensure = ensure;
    async function read(path, defaults) {
        return mergeAll(defaults, await FileUtil.readJSONLocked(path));
    }
    SettingsUtil.read = read;
    async function edit(path, overrides, defaults) {
        const lock = await FileUtil.lock(path);
        try {
            const settings = await FileUtil.readJSONRAW(path) ?? {};
            const merged = mergeTwo(settings, pruneNulls(settings, overrides));
            await FileUtil.writeJSONRAW(path, merged);
            return mergeAll(defaults, merged);
        }
        finally {
            lock.release();
        }
    }
    SettingsUtil.edit = edit;
    function pruneNulls(target, overrides) {
        const result = {};
        for (const key in overrides) {
            const value = overrides[key];
            if (value == null) {
                if (isObject(target)) {
                    delete target[key];
                }
            }
            else if (isObject(value)) {
                const child = isObject(target) ? target[key] : null;
                result[key] = pruneNulls(isObject(child) ? child : null, value);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    function isObject(value) {
        if (value == null) {
            return false;
        }
        if (Array.isArray(value)) {
            return false;
        }
        return typeof value == "object";
    }
    function mergeAll(...layers) {
        let result;
        for (const layer of layers) {
            if (layer == null) {
                continue;
            }
            result = mergeTwo(result, layer);
        }
        return result;
    }
    SettingsUtil.mergeAll = mergeAll;
    function mergeTwo(a, b) {
        if (bothPO(a, b)) {
            const result = { ...a };
            for (const key in b) {
                result[key] = mergeTwo(a[key], b[key]);
            }
            return result;
        }
        return b;
    }
    SettingsUtil.mergeTwo = mergeTwo;
    function bothPO(a, b) {
        if (a == null) {
            return false;
        }
        if (typeof a == "object") {
            if (typeof b == "object") {
                if (Array.isArray(a)) {
                    return false;
                }
                if (Array.isArray(b)) {
                    return false;
                }
                return true;
            }
        }
        return false;
    }
})(SettingsUtil || (SettingsUtil = {}));
const DEFAULT_SERVER_PORT = 8092;
const DEFAULT_TARGET_PORT = 7860;
const resultsPath = SettingsUtil.getLocation("/ThinkTank/Prisms");
const DEFAULTS_FILE = 'defaults.json';
const SETTINGS_FILE = 'settings.json';
const HISTORY_FILE = 'history.json';
const QUEUE_FILE = 'queue.json';
const IMAGE_SUFFIX = '.png';
const IMAGE_DIGITS = 5;
const DRAWTHINGS_MODELS_PATH = SettingsUtil.getLocation("/ThinkTank/Prisms/Models/DrawThings");
const ESRGAN_PATH = 'realesrgan-ncnn-vulkan';
const ESRGAN_MODELS_PATH = SettingsUtil.getLocation("/ThinkTank/Prisms/Models/RealESRGAN");
let serverPort = DEFAULT_SERVER_PORT;
let targetPort = DEFAULT_TARGET_PORT;
for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--port' && i + 1 < process.argv.length) {
        serverPort = parseInt(process.argv[i + 1]) || DEFAULT_SERVER_PORT;
    }
    if (process.argv[i] === '--target-port' && i + 1 < process.argv.length) {
        targetPort = parseInt(process.argv[i + 1]) || DEFAULT_TARGET_PORT;
    }
}
const serverPath = `./server`;
const webPath = `./web/prisms`;
const defaultsFilePath = `${serverPath}/${DEFAULTS_FILE}`;
const settingsFilePath = `${resultsPath}/${SETTINGS_FILE}`;
const targetBaseURL = `http://127.0.0.1:${targetPort}`;
function initialize() {
    try {
        NodeUtil.makeDirSync(resultsPath, { recursive: true });
    }
    catch (e) {
    }
    if (!NodeUtil.fs.existsSync(settingsFilePath)) {
        try {
            const defaults = NodeUtil.readFileSync(defaultsFilePath, ENCODING);
            NodeUtil.writeFileSync(settingsFilePath, defaults, ENCODING);
        }
        catch (e) {
            console.error('Failed to initialize settings:', e);
        }
    }
}
function getProjectPath(project) {
    const path = `${resultsPath}/${project}`;
    if (!NodeUtil.fs.existsSync(path)) {
        NodeUtil.makeDirSync(path, { recursive: true });
    }
    return path;
}
function getHistoryFilePath(project) {
    return `${getProjectPath(project)}/${HISTORY_FILE}`;
}
function getQueueFilePath() {
    return `${resultsPath}/${QUEUE_FILE}`;
}
function getImageFilePath(project, ID) {
    return `${getProjectPath(project)}/${formatImageFileName(ID)}`;
}
function formatImageFileName(ID) {
    return `${formatImageIndex(ID, IMAGE_DIGITS)}${IMAGE_SUFFIX}`;
}
function getSourceFilePath(sourceImage) {
    return `${resultsPath}/${sourceImage}`;
}
function getImageFileName(entry) {
    if (entry.imageName) {
        return entry.imageName.split('?')[0];
    }
    return null;
}
function moveImage(source, entry, target, targetID) {
    const fileName = getImageFileName(entry);
    if (fileName == null) {
        return false;
    }
    return renameImageFile(source, fileName, target, formatImageFileName(targetID));
}
function renameImageFile(fromProject, fromName, toProject, toName) {
    const sourcePath = `${getProjectPath(fromProject)}/${fromName}`;
    const targetPath = `${getProjectPath(toProject)}/${toName}`;
    if (!NodeUtil.fs.existsSync(sourcePath)) {
        return false;
    }
    if (NodeUtil.fs.existsSync(targetPath)) {
        return false;
    }
    try {
        NodeUtil.fs.renameSync(sourcePath, targetPath);
    }
    catch (e) {
        return false;
    }
    return NodeUtil.fs.existsSync(targetPath);
}
function formatImageIndex(index, digits) {
    let result = index.toString();
    while (result.length < digits) {
        result = '0' + result;
    }
    return result;
}
function formatImageName(ID) {
    return `${formatImageIndex(ID, IMAGE_DIGITS)}${IMAGE_SUFFIX}?${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
}
async function listUpscalers() {
    return ImageSRService.listModels({
        APIType: "resrgan",
        APIHost: "",
        APITool: ESRGAN_PATH,
        modelsPath: ESRGAN_MODELS_PATH
    });
}
function readHistory(path) {
    if (NodeUtil.fs.existsSync(path)) {
        return FileUtil.readJSONSync(path) ?? [];
    }
    return [];
}
function loadHistory(project) {
    return readHistory(getHistoryFilePath(project));
}
function writeHistory(path, history) {
    const lines = ["["];
    for (let i = 0; i < history.length; ++i) {
        const line = "\t" + flattenJSON(history[i]);
        if (i < history.length - 1) {
            lines.push(`${line},`);
        }
        else {
            lines.push(line);
        }
    }
    lines.push("]");
    FileUtil.writeTextSync(path, lines.join("\n"));
}
function flattenJSON(value) {
    const lines = JSON.stringify(value, null, "\t").split("\n");
    return lines.map(line => line.trim()).join(" ");
}
function saveHistory(project, history) {
    writeHistory(getHistoryFilePath(project), history);
}
function readQueue() {
    const path = getQueueFilePath();
    if (NodeUtil.fs.existsSync(path)) {
        return FileUtil.readJSONSync(path) ?? [];
    }
    return [];
}
function findProjects(path, prefix, result) {
    let entries = [];
    try {
        entries = NodeUtil.fs.readdirSync(path, { withFileTypes: true });
    }
    catch (e) {
        return;
    }
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const childPath = `${path}/${entry.name}`;
            const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (NodeUtil.fs.existsSync(`${childPath}/${HISTORY_FILE}`)) {
                result.push(childPrefix);
            }
            findProjects(childPath, childPrefix, result);
        }
    }
}
function getNextID(project, history) {
    const used = new Set();
    for (const entry of history) {
        used.add(entry.ID);
    }
    for (const fileName of readFileNames(project)) {
        const index = parseImageIndex(fileName);
        if (index) {
            used.add(index);
        }
    }
    let result = 1;
    while (used.has(result)) {
        ++result;
    }
    return result;
}
function readFileNames(project) {
    try {
        return NodeUtil.readDirSync(getProjectPath(project));
    }
    catch (e) {
        return [];
    }
}
function parseImageIndex(fileName) {
    if (!fileName.endsWith(IMAGE_SUFFIX)) {
        return 0;
    }
    const match = fileName.match(/^(\d+)\./);
    if (match) {
        return parseInt(match[1]);
    }
    return 0;
}
function findGen(history, ID) {
    for (const item of history) {
        if (item.ID == ID) {
            return item;
        }
    }
    return null;
}
async function appendGen(project, taskData) {
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        const entry = { ID: getNextID(project, history), status: "pending", taskData };
        history.push(entry);
        writeHistory(path, history);
        return entry;
    }
    finally {
        lock.release();
    }
}
async function updateGen(project, ID, patch) {
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        const entry = findGen(history, ID);
        if (entry) {
            Object.assign(entry, patch);
            writeHistory(path, history);
        }
    }
    finally {
        lock.release();
    }
}
async function removeGen(project, ID) {
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        writeHistory(path, history.filter(item => item.ID != ID));
    }
    finally {
        lock.release();
    }
}
async function appendJob(job) {
    const path = getQueueFilePath();
    const lock = await FileUtil.lock(path);
    try {
        const queue = readQueue();
        queue.push(job);
        FileUtil.writeJSONSync(path, queue);
    }
    finally {
        lock.release();
    }
}
async function appendGens(project, taskDatas) {
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        const result = [];
        for (const taskData of taskDatas) {
            const entry = { ID: getNextID(project, history), status: 'pending', taskData };
            history.push(entry);
            result.push(entry);
        }
        writeHistory(path, history);
        return result;
    }
    finally {
        lock.release();
    }
}
async function appendJobs(jobs) {
    const path = getQueueFilePath();
    const lock = await FileUtil.lock(path);
    try {
        const queue = readQueue();
        queue.push(...jobs);
        FileUtil.writeJSONSync(path, queue);
    }
    finally {
        lock.release();
    }
}
async function removeJobs(keep) {
    const path = getQueueFilePath();
    const lock = await FileUtil.lock(path);
    try {
        FileUtil.writeJSONSync(path, readQueue().filter(keep));
    }
    finally {
        lock.release();
    }
}
async function renameJobs(from, to) {
    const path = getQueueFilePath();
    const lock = await FileUtil.lock(path);
    try {
        const queue = readQueue();
        for (const job of queue) {
            if (job.project == from) {
                job.project = to;
            }
        }
        FileUtil.writeJSONSync(path, queue);
    }
    finally {
        lock.release();
    }
}
function saveImage(project, ID, base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    const path = getImageFilePath(project, ID);
    NodeUtil.writeFileSync(path, buffer);
    return formatImageName(ID);
}
function removeImage(project, ID) {
    try {
        NodeUtil.removeSync(getImageFilePath(project, ID));
    }
    catch (e) {
    }
}
function removeEntryImage(project, entry) {
    const fileName = getImageFileName(entry);
    if (fileName == null) {
        return;
    }
    try {
        NodeUtil.removeSync(`${getProjectPath(project)}/${fileName}`);
    }
    catch (e) {
    }
}
function writeImageMetadata(project, entry) {
    const fileName = getImageFileName(entry);
    if (fileName == null) {
        return;
    }
    const path = `${getProjectPath(project)}/${fileName}`;
    try {
        const data = NodeUtil.fs.readFileSync(path);
        const description = GenMetadata.describeImage(entry.taskData);
        const updated = ImageMetadataUtil.write(data, description, GenMetadata.toJSON(entry.taskData));
        if (updated) {
            NodeUtil.fs.writeFileSync(path, updated);
        }
    }
    catch (e) {
        console.warn(`unable to write the metadata of ${path}`);
    }
}
function readMetadata(base64Data) {
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        return ImageMetadataUtil.extract(buffer, data => NodeUtil.zlib.inflateSync(data));
    }
    catch {
        return {};
    }
}
function extractSeedFromImage(base64Data) {
    try {
        const metadata = readMetadata(base64Data);
        if (metadata.seed !== undefined) {
            return metadata.seed;
        }
        const buffer = Buffer.from(base64Data, 'base64');
        const str = buffer.toString('binary');
        const match = str.match(/"seed":\s*(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
    }
    catch (e) {
    }
    return null;
}
function getProject(requestData) {
    return requestData?.project || 'main';
}
function readSettings() {
    try {
        return JSON.parse(NodeUtil.readFileSync(settingsFilePath, ENCODING));
    }
    catch (e) {
        try {
            return JSON.parse(NodeUtil.readFileSync(defaultsFilePath, ENCODING));
        }
        catch (e2) {
            return {};
        }
    }
}
function createCatalogue(name, categories, CatalogueType) {
    const map = { disabled: null };
    if (categories) {
        const values = Object.values(categories);
        for (const category of values) {
            for (const key in category) {
                map[key.replace(/[\s:+]+/g, '-')] = category[key];
            }
        }
    }
    return new CatalogueType(name, map);
}
function createGenerationEngine() {
    const settings = readSettings();
    modelCatalogue = createCatalogue('models', settings.models, CKPTCatalogue);
    loraCatalogue = createCatalogue('LoRAs', settings.LoRAs, CKPTCatalogue);
    controlCatalogue = createCatalogue('controls', settings.controls, CKPTCatalogue);
    samplerCatalogue = createCatalogue('samplers', settings.samplers, SimpleCatalogue);
    return { engine: new SDCommandEngine(), preprocessor: new STDPreprocessor() };
}
function substituteSource(input, source) {
    const positive = source ? source.positivePrompt : '';
    const negative = source ? source.negativePrompt : '';
    let result = input.split('{@source-prompt}').join(positive);
    result = result.split('{@source-negative}').join(negative);
    return result;
}
function hasPositiveText(block) {
    for (const line of block.split(/\n+/)) {
        const text = line.trim();
        if (text == '' || text.startsWith('/') || text.startsWith('-')) {
            continue;
        }
        return true;
    }
    return false;
}
function splitGenerationBlocks(input) {
    const result = [];
    for (const block of input.split(/\n\s*\n/)) {
        if (block.trim() == '') {
            continue;
        }
        if (hasPositiveText(block) || result.length == 0) {
            result.push(block);
        }
        else {
            result[result.length - 1] += '\n' + block;
        }
    }
    return result;
}
function unrollGeneration(result, engine, preprocessor, taskData, input, seed) {
    const count = taskData.batchCount || 1;
    for (let i = 0; i < count; ++i) {
        taskData.seed = seed;
        taskData.batchCount = 1;
        const tasks = [];
        engine.init(taskData, submitted => tasks.push(submitted));
        preprocessor.init(seed, block => engine.handleBlock(block));
        for (const block of splitGenerationBlocks(input)) {
            preprocessor.handleBlock(block);
        }
        for (const task of tasks) {
            result.push(task);
        }
        seed = XSRandom.next(seed);
    }
    return seed;
}
function unrollGenerations(baseData, input, sources) {
    const result = [];
    if (sources.length == 0) {
        sources.push(null);
    }
    const { engine, preprocessor } = createGenerationEngine();
    let seed = baseData.seed;
    for (const source of sources) {
        const taskData = ParamUtil.duplicateSDGen(baseData);
        if (source) {
            taskData.sourceImage = source.path;
            engine.matchAspect(taskData, source.width > source.height ? 'horizontal' : 'vertical');
        }
        else {
            taskData.strength = 1;
        }
        seed = unrollGeneration(result, engine, preprocessor, taskData, substituteSource(input, source), seed);
    }
    return { tasks: result, seed };
}
function toServerTask(task) {
    const result = { ...ParamUtil.toDTHGen(task) };
    result.sourceImage = task.sourceImage;
    result.type = task.type;
    result.upscaleModel = task.upscaleModel;
    return result;
}
let queueRunning = false;
const activeAborts = new Map();
const activeProgress = new Map();
function jobKey(project, ID) {
    return `${project}/${ID}`;
}
function getGenerationSettings() {
    const result = { mode: 'CLI', modsFolder: DRAWTHINGS_MODELS_PATH, tool: 'draw-things-cli' };
    try {
        const content = NodeUtil.readFileSync(settingsFilePath, ENCODING);
        const settings = JSON.parse(content);
        result.mode = settings.generationMode || result.mode;
        result.tool = settings.drawThingsTool || result.tool;
    }
    catch (e) {
    }
    return result;
}
async function upscaleImage(taskData, outputPath) {
    const params = {
        APIType: "resrgan",
        APIHost: "",
        APITool: ESRGAN_PATH,
        modelsPath: ESRGAN_MODELS_PATH,
        model: taskData.upscaleModel
    };
    return ImageSRService.upscale(params, getSourceFilePath(taskData.sourceImage), outputPath);
}
async function generateImage(project, ID, taskData, signal, onProgress) {
    const startTime = Date.now();
    const settings = getGenerationSettings();
    const outputPath = getImageFilePath(project, ID);
    let imageBase64;
    if (taskData.type === 'upscale') {
        console.log('Upscaling...');
        imageBase64 = await upscaleImage(taskData, outputPath);
    }
    else {
        const params = {
            ...DTHTTPAdapter.convertFrom(taskData),
            APIType: settings.mode === 'HTTP' ? 'dthttp' : 'dtcli',
            APIHost: targetBaseURL,
            APITool: settings.tool,
            modelsFolder: settings.modsFolder,
            inputMode: taskData.sourceImage ? 'path' : 'raw',
            inputImage: taskData.sourceImage ? getSourceFilePath(taskData.sourceImage) : null
        };
        console.log(settings.mode === 'HTTP' ? 'Generating via HTTP API...' : 'Generating via CLI...');
        imageBase64 = await ImageGenService.generate(params, outputPath, signal, onProgress);
        if (settings.mode === 'HTTP') {
            saveImage(project, ID, imageBase64);
        }
    }
    if (!NodeUtil.fs.existsSync(outputPath)) {
        throw new Error(`Generated image not found at ${outputPath}`);
    }
    const genTime = Date.now() - startTime;
    const imageName = formatImageName(ID);
    const extractedSeed = extractSeedFromImage(imageBase64);
    const resultTaskData = { ...taskData };
    if (extractedSeed !== null) {
        resultTaskData.seed = extractedSeed;
    }
    return { imageName, taskData: resultTaskData, genTime };
}
async function executeJob(job) {
    console.log(`Starting job ${job.ID} for project ${job.project}`);
    const controller = new AbortController();
    const key = jobKey(job.project, job.ID);
    activeAborts.set(key, () => controller.abort());
    activeProgress.set(key, 0);
    await updateGen(job.project, job.ID, { status: 'ongoing', startedDate: Date.now() });
    try {
        const patch = await generateImage(job.project, job.ID, job.taskData, controller.signal, percentage => activeProgress.set(key, percentage));
        if (controller.signal.aborted) {
            removeImage(job.project, job.ID);
            return;
        }
        GenMetadata.normalize(patch.taskData);
        const entry = {
            ID: job.ID,
            status: 'done',
            imageName: patch.imageName,
            taskData: patch.taskData,
            genTime: patch.genTime
        };
        await updateGen(job.project, job.ID, entry);
        writeImageMetadata(job.project, entry);
        console.log(`Finished job ${job.ID} for project ${job.project}`);
    }
    catch (error) {
        if (controller.signal.aborted) {
            removeImage(job.project, job.ID);
            console.log(`Aborted job ${job.ID} for project ${job.project}`);
            return;
        }
        console.error(`Job ${job.ID} for project ${job.project} failed:`, error);
        removeImage(job.project, job.ID);
        await updateGen(job.project, job.ID, { status: 'error' });
    }
    finally {
        activeAborts.delete(key);
        activeProgress.delete(key);
    }
}
async function executeQueue() {
    if (queueRunning) {
        return;
    }
    queueRunning = true;
    const path = getQueueFilePath();
    try {
        while (true) {
            const lock = await FileUtil.lock(path);
            let job = null;
            try {
                const queue = readQueue();
                if (queue.length == 0) {
                    queueRunning = false;
                    return;
                }
                job = queue.shift();
                FileUtil.writeJSONSync(path, queue);
            }
            finally {
                lock.release();
            }
            await executeJob(job);
        }
    }
    catch (error) {
        queueRunning = false;
        throw error;
    }
}
async function handleGenerate(requestData, response) {
    if (typeof requestData === 'string') {
        try {
            requestData = JSON.parse(requestData);
        }
        catch (e) {
            throw new Error('Invalid JSON in request body: ' + e);
        }
    }
    if (requestData.taskData) {
        return handleBatchedGenerate(requestData);
    }
    const project = getProject(requestData);
    const cleanRequestData = { ...requestData };
    delete cleanRequestData.project;
    const entry = await appendGen(project, cleanRequestData);
    await appendJob({ project, ID: entry.ID, taskData: cleanRequestData });
    executeQueue().catch(error => console.error('Queue execution failed:', error));
    return entry;
}
async function handleBatchedGenerate(requestData) {
    const project = getProject(requestData);
    const baseData = requestData.taskData || {};
    const input = cleanString(requestData.combinedPrompt ?? baseData.combinedPrompt ?? '');
    delete baseData.combinedPrompt;
    const sources = requestData.sources || [];
    const unrolled = unrollGenerations(baseData, input, sources);
    const entries = await appendGens(project, unrolled.tasks.map(toServerTask));
    await appendJobs(entries.map(entry => ({ project, ID: entry.ID, taskData: entry.taskData })));
    executeQueue().catch(error => console.error('Queue execution failed:', error));
    return { entries, seed: unrolled.seed };
}
async function handleGetTaskStates(requestData, response) {
    const project = getProject(requestData);
    const IDs = requestData.IDs || [];
    const history = loadHistory(project);
    const result = [];
    for (const ID of IDs) {
        const entry = findGen(history, ID);
        if (entry == null) {
            continue;
        }
        const seconds = entry.status == 'ongoing' && entry.startedDate ? Math.floor((Date.now() - entry.startedDate) / 1000) : 0;
        let percentage = Math.round(activeProgress.get(jobKey(project, ID)) ?? 0);
        if (entry.status == 'done') {
            percentage = 100;
        }
        result.push({
            ID,
            status: entry.status,
            seconds,
            percentage,
            imageName: entry.imageName,
            genTime: entry.genTime
        });
    }
    return result;
}
async function handleGetHistory(requestData, response) {
    const project = getProject(requestData);
    return loadHistory(project);
}
async function handleGetProjects(requestData, response) {
    const result = [];
    findProjects(resultsPath, "", result);
    result.sort();
    return result;
}
async function handleCreateProject(requestData, response) {
    const name = requestData.name;
    const source = requestData.sourceProject || 'main';
    const IDs = requestData.IDs || [];
    if (!name) {
        throw new Error('name is required');
    }
    const sourcePath = getHistoryFilePath(source);
    const targetPath = getHistoryFilePath(name);
    if (sourcePath == targetPath) {
        return { success: true };
    }
    const sourceLock = await FileUtil.lock(sourcePath);
    try {
        const targetLock = await FileUtil.lock(targetPath);
        try {
            const history = readHistory(sourcePath);
            const targetHistory = readHistory(targetPath);
            const kept = [];
            const skipped = [];
            let movedCount = 0;
            for (const entry of history) {
                if (IDs.includes(entry.ID)) {
                    const newID = getNextID(name, targetHistory);
                    if (moveImage(source, entry, name, newID)) {
                        ++movedCount;
                        targetHistory.push({
                            ...entry,
                            ID: newID,
                            imageName: formatImageName(newID)
                        });
                        continue;
                    }
                    skipped.push(entry.ID);
                }
                kept.push(entry);
            }
            if (movedCount) {
                writeHistory(targetPath, targetHistory);
                writeHistory(sourcePath, kept);
            }
            if (skipped.length) {
                console.warn(`unable to move ${skipped.length} image(s) to ${name}:`, skipped);
            }
        }
        finally {
            targetLock.release();
        }
    }
    finally {
        sourceLock.release();
    }
    return { success: true };
}
async function handleReindexProject(requestData, response) {
    const project = getProject(requestData);
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        const images = new Map();
        for (const entry of history) {
            const name = getImageFileName(entry);
            if (name == null) {
                continue;
            }
            const temp = `${name}.reindex`;
            if (renameImageFile(project, name, project, temp)) {
                images.set(entry, { name, temp });
            }
            else if (!NodeUtil.fs.existsSync(`${getProjectPath(project)}/${name}`)) {
                entry.imageName = null;
            }
        }
        for (let i = 0; i < history.length; ++i) {
            const entry = history[i];
            const index = i + 1;
            const image = images.get(entry);
            if (image == null) {
                entry.ID = index;
                continue;
            }
            if (renameImageFile(project, image.temp, project, formatImageFileName(index))) {
                entry.ID = index;
                entry.imageName = formatImageName(index);
            }
            else {
                renameImageFile(project, image.temp, project, image.name);
            }
        }
        for (const entry of history) {
            GenMetadata.normalize(entry.taskData);
            writeImageMetadata(project, entry);
        }
        writeHistory(path, history);
    }
    finally {
        lock.release();
    }
    return { success: true };
}
async function handleAssignParams(requestData, response) {
    const project = getProject(requestData);
    const IDs = requestData.IDs || [];
    const taskData = requestData.taskData || {};
    const keepPrompts = IDs.length > 1;
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        for (const entry of history) {
            if (IDs.includes(entry.ID)) {
                const previous = entry.taskData;
                entry.taskData = { ...taskData };
                if (keepPrompts) {
                    entry.taskData.prompt = previous.prompt;
                    entry.taskData.negative_prompt = previous.negative_prompt;
                    entry.taskData.seed = previous.seed;
                }
                GenMetadata.normalize(entry.taskData);
                writeImageMetadata(project, entry);
            }
        }
        writeHistory(path, history);
    }
    finally {
        lock.release();
    }
    return { success: true };
}
async function handleRenameProject(requestData, response) {
    const project = getProject(requestData);
    const name = requestData.name;
    if (!name) {
        throw new Error('name is required');
    }
    const sourcePath = getProjectPath(project);
    const targetPath = `${resultsPath}/${name}`;
    if (sourcePath == targetPath) {
        return { success: true };
    }
    if (NodeUtil.fs.existsSync(targetPath)) {
        throw new Error('a project with that name already exists');
    }
    NodeUtil.fs.renameSync(sourcePath, targetPath);
    await renameJobs(project, name);
    return { success: true };
}
async function handleUpscalers(requestData, response) {
    return listUpscalers();
}
async function handleImportImages(requestData, response) {
    const project = getProject(requestData);
    const images = requestData.images || [];
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    const entries = [];
    try {
        const history = readHistory(path);
        for (const image of images) {
            const base64 = image.data.includes(',') ? image.data.split(',')[1] : image.data;
            const ID = getNextID(project, history);
            const metadata = ImageMetadataUtil.merge(readMetadata(base64), image.metadata || {});
            const width = image.width || metadata.width || 512;
            const height = image.height || metadata.height || 512;
            saveImage(project, ID, base64);
            const taskData = {
                prompt: metadata.positivePrompt || '',
                negative_prompt: metadata.negativePrompt || '',
                seed: metadata.seed ?? 0,
                width,
                height
            };
            if (metadata.model) {
                taskData.model = metadata.model;
            }
            if (metadata.sampler) {
                taskData.sampler = metadata.sampler;
            }
            if (metadata.steps !== undefined) {
                taskData.steps = metadata.steps;
            }
            if (metadata.guidanceScale !== undefined) {
                taskData.guidance_scale = metadata.guidanceScale;
            }
            if (metadata.shift !== undefined) {
                taskData.shift = metadata.shift;
            }
            if (metadata.strength !== undefined) {
                taskData.strength = metadata.strength;
            }
            if (metadata.seedMode) {
                taskData.seed_mode = metadata.seedMode;
            }
            if (metadata.maskBlur !== undefined) {
                taskData.mask_blur = metadata.maskBlur;
            }
            if (metadata.originalWidth != null) {
                taskData.original_width = metadata.originalWidth;
                taskData.original_height = metadata.originalHeight;
            }
            if (metadata.targetWidth != null) {
                taskData.target_width = metadata.targetWidth;
                taskData.target_height = metadata.targetHeight;
            }
            if (metadata.negativeOriginalWidth != null) {
                taskData.negative_original_width = metadata.negativeOriginalWidth;
                taskData.negative_original_height = metadata.negativeOriginalHeight;
            }
            const entry = {
                ID,
                status: 'done',
                imageName: formatImageName(ID),
                taskData,
                genTime: 0
            };
            GenMetadata.normalize(entry.taskData);
            writeImageMetadata(project, entry);
            history.push(entry);
            entries.push(entry);
        }
        writeHistory(path, history);
    }
    finally {
        lock.release();
    }
    return { entries };
}
async function handleMoveGenPrev(requestData, response) {
    const project = getProject(requestData);
    const ID = requestData.ID;
    if (typeof ID !== 'number') {
        throw new Error('ID is required');
    }
    const history = loadHistory(project);
    for (let i = 1; i < history.length; i++) {
        if (history[i].ID === ID) {
            const temp = history[i];
            history[i] = history[i - 1];
            history[i - 1] = temp;
            saveHistory(project, history);
            break;
        }
    }
    return { success: true };
}
async function handleMoveGenNext(requestData, response) {
    const project = getProject(requestData);
    const ID = requestData.ID;
    if (typeof ID !== 'number') {
        throw new Error('ID is required');
    }
    const history = loadHistory(project);
    for (let i = 0; i < history.length - 1; i++) {
        if (history[i].ID === ID) {
            const temp = history[i];
            history[i] = history[i + 1];
            history[i + 1] = temp;
            saveHistory(project, history);
            break;
        }
    }
    return { success: true };
}
function moveEntries(history, IDs, movement, steps) {
    const selected = new Set(IDs);
    if (movement == 'next') {
        for (let i = history.length - 1; i >= 0; --i) {
            if (selected.has(history[i].ID) == false) {
                continue;
            }
            let index = i;
            let count = 0;
            while (count < steps && index < history.length - 1 && selected.has(history[index + 1].ID) == false) {
                const temp = history[index];
                history[index] = history[index + 1];
                history[index + 1] = temp;
                ++index;
                ++count;
            }
        }
    }
    else {
        for (let i = 0; i < history.length; ++i) {
            if (selected.has(history[i].ID) == false) {
                continue;
            }
            let index = i;
            let count = 0;
            while (count < steps && index > 0 && selected.has(history[index - 1].ID) == false) {
                const temp = history[index];
                history[index] = history[index - 1];
                history[index - 1] = temp;
                --index;
                ++count;
            }
        }
    }
}
async function handleMoveGens(requestData, response) {
    const project = getProject(requestData);
    const IDs = requestData.IDs || [];
    const movement = requestData.movement == 'next' ? 'next' : 'prev';
    const steps = requestData.steps || 1;
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        moveEntries(history, IDs, movement, steps);
        writeHistory(path, history);
    }
    finally {
        lock.release();
    }
    return { success: true };
}
async function handleRemoveGen(requestData, response) {
    const project = getProject(requestData);
    const ID = requestData.ID;
    if (typeof ID !== 'number') {
        throw new Error('ID is required');
    }
    const abort = activeAborts.get(jobKey(project, ID));
    if (abort) {
        abort();
    }
    const entry = findGen(loadHistory(project), ID);
    if (entry) {
        removeEntryImage(project, entry);
    }
    await removeGen(project, ID);
    await removeJobs(job => job.project != project || job.ID != ID);
    return { success: true };
}
async function handleRemoveGens(requestData, response) {
    const project = getProject(requestData);
    const IDs = requestData.IDs || [];
    const selected = new Set(IDs);
    for (const ID of IDs) {
        const abort = activeAborts.get(jobKey(project, ID));
        if (abort) {
            abort();
        }
    }
    const path = getHistoryFilePath(project);
    const lock = await FileUtil.lock(path);
    try {
        const history = readHistory(path);
        for (const entry of history) {
            if (selected.has(entry.ID)) {
                removeEntryImage(project, entry);
            }
        }
        writeHistory(path, history.filter(entry => selected.has(entry.ID) == false));
    }
    finally {
        lock.release();
    }
    await removeJobs(job => job.project != project || selected.has(job.ID) == false);
    return { success: true };
}
async function handleClearHistory(requestData, response) {
    const project = getProject(requestData);
    const history = loadHistory(project);
    for (const item of history) {
        removeEntryImage(project, item);
    }
    try {
        NodeUtil.removeSync(getHistoryFilePath(project));
    }
    catch (e) {
    }
    await removeJobs(job => job.project != project);
    return { success: true };
}
async function handleSettings(requestData, response) {
    return readSettings();
}
async function handlePresets(requestData, response) {
    const lock = await FileUtil.lock(settingsFilePath);
    try {
        const settings = FileUtil.readJSONSync(settingsFilePath) || {};
        const presets = settings.presets || {};
        let changed = false;
        for (const name in requestData) {
            presets[name] = requestData[name];
            changed = true;
        }
        if (changed) {
            settings.presets = presets;
            FileUtil.writeJSONSync(settingsFilePath, settings);
        }
        return presets;
    }
    finally {
        lock.release();
    }
}
initialize();
executeQueue().catch(error => console.error('Queue execution failed:', error));
startServer(serverPort, { route: "/api/generate", handler: handleGenerate }, { route: "/api/get-history", handler: handleGetHistory }, { route: "/api/get-task-states", handler: handleGetTaskStates }, { route: "/api/get-projects", handler: handleGetProjects }, { route: "/api/create-project", handler: handleCreateProject }, { route: "/api/reindex-project", handler: handleReindexProject }, { route: "/api/rename-project", handler: handleRenameProject }, { route: "/api/assign-params", handler: handleAssignParams }, { route: "/api/upscalers", handler: handleUpscalers }, { route: "/api/import", handler: handleImportImages }, { route: "/api/move-gen-prev", handler: handleMoveGenPrev }, { route: "/api/move-gen-next", handler: handleMoveGenNext }, { route: "/api/move-gens", handler: handleMoveGens }, { route: "/api/remove-gen", handler: handleRemoveGen }, { route: "/api/remove-gens", handler: handleRemoveGens }, { route: "/api/clear-history", handler: handleClearHistory }, { route: "/api/settings", handler: handleSettings }, { route: "/api/presets", handler: handlePresets }, { route: "/ui/results", dir: resultsPath + "/" }, { route: "/ui/", dir: `./web/prisms-ui/` });
