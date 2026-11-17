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
var OllamaAdapter;
(function (OllamaAdapter) {
    function createChatRequestBody(params, context) {
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
    OllamaAdapter.createChatRequestBody = createChatRequestBody;
    function processChatResponseLine(params, line) {
        const data = JSON.parse(line);
        if (data.message) {
            return { thinking: data.message.thinking ?? "", content: data.message.content ?? data.message.response ?? "" };
        }
        return { thinking: "", content: "" };
    }
    OllamaAdapter.processChatResponseLine = processChatResponseLine;
    function createSearchRequestBody(params, query) {
        return { query, max_results: params.maxCount };
    }
    OllamaAdapter.createSearchRequestBody = createSearchRequestBody;
    function processSearchResponseData(params, data) {
        return data.results;
    }
    OllamaAdapter.processSearchResponseData = processSearchResponseData;
    function createFetchRequestBody(params, url) {
        return { url };
    }
    OllamaAdapter.createFetchRequestBody = createFetchRequestBody;
    function processFetchResponseData(params, data) {
        return data;
    }
    OllamaAdapter.processFetchResponseData = processFetchResponseData;
    function createSpeechRequestBody(params, input, format) {
        return {
            input,
            model: params.model,
            voice: params.voice,
            response_format: format
        };
    }
    OllamaAdapter.createSpeechRequestBody = createSpeechRequestBody;
})(OllamaAdapter || (OllamaAdapter = {}));
var SpeechText;
(function (SpeechText) {
    const speakable = /[^\p{Script=Latin}\p{M}0-9\s.,!?;:'"()\[\]\/%&*+\-=…–—$€£@]/gu;
    const currency = /[₠₡₢₣₤₥₦₧₨₩₪₫₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿¤¥¢]/g;
    const codePatterns = [
        /\bclass\s+\w+\s*(?:extends\s+\w+\s*)?\{/,
        /\b(?:if|for|while|switch|catch)\s*\(/,
        /\b(?:var|let|const)\s+\w+\s*=/,
        /\bfunction\s+\w*\s*\(/,
        /\breturn\s+[^.;]+;/,
        /\w+\.\w+\([^)]*\)\s*;/,
        /^\s*(?:import|export|from)\s+\w/,
        /^\s*(?:public|private|protected|static)\s+\w/,
        /=>/,
        /[{}]\s*$/,
        /\b(?:async\s+)?def\s+\w+\s*\(/,
        /^\s*class\s+\w+\s*(?:\([^)]*\))?\s*:/m,
        /^\s*(?:if|elif|else|for|while|with|try|except|finally)\b[^\n]*:[^\n]*\n[ \t]+\S/m,
        /^\s*[a-zA-Z_]\w*\s*=\s*[^=]/m,
        /\bself\.\w+/,
        /^\s*print\s*\(/m
    ];
    const noses = [
        { from: ":'-", to: ":'" },
        { from: ":-", to: ":" },
        { from: "=-", to: ":" },
        { from: ";-", to: ";" }
    ];
    const smileys = [
        ":'(", "T-T", "T_T", ";_;", "-_-", "o_O", "^_^", "(=)", "(:)", "x-D", "X-D",
        ":)", "(:", "=)", "(=",
        ":(", "):", "=(", ")=",
        ":D", "=D", ":d", "=d",
        "XD", "xd",
        ":P", ":p",
        ";)",
        ":O",
        ":S",
        ":/",
        "D:",
        ":3",
        "<3"
    ];
    function normalize(text) {
        text = text.replace(/–/g, " ... ");
        text = text.replace(currency, " tac ");
        text = removeSmileys(text);
        text = text.replace(speakable, " ");
        return text.replace(/\s+/g, " ").trim();
    }
    SpeechText.normalize = normalize;
    function isCode(text) {
        for (const pattern of codePatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
        return false;
    }
    SpeechText.isCode = isCode;
    function removeSmileys(text) {
        for (const nose of noses) {
            text = text.split(nose.from).join(nose.to);
        }
        for (const smiley of smileys) {
            text = text.split(smiley).join(" ... ");
        }
        return text;
    }
})(SpeechText || (SpeechText = {}));
var TTSService;
(function (TTSService) {
    const adapters = {
        "default": OllamaAdapter,
        "ollama": OllamaAdapter
    };
    TTSService.defaultSettings = {
        enabled: true,
        APIType: "ollama",
        APIHost: "http://localhost:11434/v1/audio/speech",
        APIKey: "ollama",
        model: "phonon",
        voice: "Zoey"
    };
    async function synthesize(params, input, response) {
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
    TTSService.synthesize = synthesize;
    async function synthesizePCM(params, input, sink, signal) {
        input = SpeechText.normalize(input);
        if (input == "") {
            return;
        }
        const result = await requestSpeech(params, input, "pcm", signal);
        if (result.ok == false) {
            throw new Error(await result.text());
        }
        if (result.body) {
            for await (const chunk of StreamUtil.asIterable(result.body)) {
                sink(chunk);
            }
        }
    }
    TTSService.synthesizePCM = synthesizePCM;
    function requestSpeech(params, input, format, signal) {
        const adapter = adapters[params.APIType] ?? adapters["default"];
        const headers = { Authorization: `Bearer ${params.APIKey}`, ...CTJSON };
        const request = {
            method: "POST",
            headers,
            body: JSON.stringify(adapter.createSpeechRequestBody(params, input, format))
        };
        if (signal) {
            request.signal = signal;
        }
        return fetch(params.APIHost, request);
    }
})(TTSService || (TTSService = {}));
var SpeechUtil;
(function (SpeechUtil) {
    const maxSpeechLength = 500;
    const streams = {};
    function open(chatID, settings, response) {
        close(chatID);
        if (settings == null || settings.enabled == false) {
            response.writeHead(204, CTTEXT);
            response.end();
            return;
        }
        response.writeHead(200, { "Content-Type": "application/octet-stream" });
        const stream = {
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
    SpeechUtil.open = open;
    function configure(chatID, settings) {
        const stream = streams[chatID];
        if (stream == null || stream.closed || settings == null) {
            return;
        }
        stream.settings = settings;
        if (settings.enabled == false) {
            abort(chatID);
        }
    }
    SpeechUtil.configure = configure;
    function feed(chatID, content, settings = null) {
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
    SpeechUtil.feed = feed;
    function flush(chatID) {
        const stream = streams[chatID];
        if (stream == null || stream.closed) {
            return;
        }
        enqueue(stream, stream.pending, stream.pendingSettings);
        stream.pending = "";
        stream.pendingSettings = null;
    }
    SpeechUtil.flush = flush;
    function finish(chatID) {
        const stream = streams[chatID];
        if (stream == null || stream.closed) {
            return;
        }
        stream.finished = true;
        enqueue(stream, stream.pending, stream.pendingSettings);
        stream.pending = "";
        stream.pendingSettings = null;
    }
    SpeechUtil.finish = finish;
    function abort(chatID) {
        close(chatID);
    }
    SpeechUtil.abort = abort;
    function close(chatID) {
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
    SpeechUtil.close = close;
    function findCut(text) {
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
    function findSentenceCut(text, limit) {
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
    function enqueue(stream, text, settings = null) {
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
    function splitSpeech(text) {
        if (text == "") {
            return [];
        }
        if (text.length <= maxSpeechLength) {
            return [text];
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
    async function drain(stream) {
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
        }
        finally {
            stream.running = false;
            if (stream.finished && stream.closed == false) {
                close(stream.chatID);
            }
        }
    }
    async function speak(stream, item) {
        try {
            let count = 0;
            await TTSService.synthesizePCM(item.settings, item.text, (data) => {
                if (stream.closed == false) {
                    count += data.length;
                    stream.response.write(data);
                }
            }, stream.controller.signal);
            console.log(`speech ${stream.chatID}: ${count} bytes`);
        }
        catch (error) {
            if (error.name != "AbortError") {
                console.warn(error);
            }
        }
    }
})(SpeechUtil || (SpeechUtil = {}));
class AgoraStreamer {
    static getControl(chatID) {
        return this.controls[chatID] ?? { state: "idle", controller: null };
    }
    static checkAborted(chatID) {
        return this.getControl(chatID).state == "aborted";
    }
    static checkRaised(chatID) {
        return this.getControl(chatID).state == "raised";
    }
    static abort(chatID) {
        SpeechUtil.abort(chatID);
        if (chatID in this.controls) {
            this.controls[chatID].state = "aborted";
            this.controls[chatID].controller.abort();
        }
    }
    static raiseHand(chatID) {
        this.getControl(chatID).state = "raised";
    }
    static end(chatID) {
        SpeechUtil.finish(chatID);
        delete this.controls[chatID];
    }
    flushSpeech() {
        SpeechUtil.flush(this.chatID);
    }
    constructor(chatID, response) {
        this.checkAbort = () => {
            return AgoraStreamer.checkAborted(this.chatID);
        };
        this.onChunk = (chunk) => {
            this.streamEscaped(chunk);
            return chunk;
        };
        this.onSpeak = (chunk, settings) => {
            SpeechUtil.feed(this.chatID, chunk, settings);
        };
        this.onError = (error) => {
            if (error.name == "AbortError") {
                this.streamInfo("interrupted");
                return "\n\n[interrupted]";
            }
            this.streamInfo(error.message);
            return "\n\n[error]";
        };
        this.chatID = chatID;
        this.response = response;
        this.controller = new AbortController();
        AgoraStreamer.controls[chatID] = { state: "active", controller: this.controller };
    }
    streamRaw(content) {
        if (this.response) {
            this.response.write(content);
        }
    }
    streamEscaped(content) {
        if (this.response) {
            this.response.write(content.replace(/\[/g, "\\[").replace(/\]/g, "\\]"));
        }
    }
    streamInfo(content) {
        this.streamRaw("[[message role=info]]\n");
        if (content) {
            this.streamEscaped(content);
            this.streamRaw("\n");
        }
    }
    streamMessage(role, name, time) {
        this.streamRaw(`[[message role=${role} name=${encodeURIComponent(name)} time=${time}]]\n`);
    }
    streamImage(name) {
        this.streamRaw(`[[image name=${encodeURIComponent(name)}]]\n`);
    }
    streamDocument(name) {
        this.streamRaw(`[[document name=${encodeURIComponent(name)}]]\n`);
    }
    streamEntry(entry) {
        if (entry.type == "message") {
            this.streamMessage(entry.role, entry.name, entry.time);
        }
        else if (entry.type == "image") {
            this.streamImage(entry.name);
        }
        else if (entry.type == "document") {
            this.streamDocument(entry.name);
        }
        if (entry.content) {
            this.streamEscaped(entry.content);
            this.streamRaw("\n");
        }
    }
    hasStream() {
        if (this.response) {
            return true;
        }
        else {
            return false;
        }
    }
}
AgoraStreamer.controls = {};
var ModelUtil;
(function (ModelUtil) {
    ModelUtil.modelsPath = SettingsUtil.getLocation("/ThinkTank/Agora/models.json");
    const defaultModel = {
        APIType: "ollama",
        APIHost: "http://localhost:11434/api/chat",
        APIKey: "",
        model: "",
        chat: true,
        vision: true,
        decision: false,
        speech: false,
        think: false,
        temp: 0.35,
        topP: 0.85,
        topK: 35,
        numCtx: 32768,
        numKeep: 8192,
        numPredict: 8192
    };
    async function initialize() {
        const lock = await FileUtil.lock(ModelUtil.modelsPath);
        try {
            if (await FileUtil.readJSONRAW(ModelUtil.modelsPath) == null) {
                await FileUtil.writeJSONRAW(ModelUtil.modelsPath, { models: { default: defaultModel } });
            }
        }
        finally {
            lock.release();
        }
    }
    ModelUtil.initialize = initialize;
    async function readModels() {
        const models = await readRawModels();
        const result = {};
        for (const name in models) {
            const settings = models[name];
            const params = toParams(settings);
            const variants = settings.variants;
            if (variants == null) {
                result[name] = params;
                continue;
            }
            for (const variantName in variants) {
                result[`${name} ${variantName}`] = { ...params, ...variants[variantName] };
            }
        }
        return result;
    }
    ModelUtil.readModels = readModels;
    async function getModelNames() {
        const models = await readRawModels();
        return Object.keys(models);
    }
    ModelUtil.getModelNames = getModelNames;
    async function getModelOptions() {
        const models = await readRawModels();
        const result = [];
        for (const name in models) {
            if (name == "default") {
                continue;
            }
            const settings = models[name];
            const split = splitDisplay(settings.display ?? name);
            const variants = settings.variants;
            if (variants == null) {
                addModelOption(result, name, split, toParams(settings), null);
                continue;
            }
            for (const variantName in variants) {
                const params = { ...toParams(settings), ...variants[variantName] };
                addModelOption(result, `${name} ${variantName}`, split, params, variantName);
            }
        }
        return result;
    }
    ModelUtil.getModelOptions = getModelOptions;
    function resolve(params, modelName) {
        return sanitizeModel({ ...defaultModel, ...params.models.default, ...params.models[modelName], ...params.generate });
    }
    ModelUtil.resolve = resolve;
    function sanitizeModel(model) {
        if (model.speech == false) {
            delete model.voices;
        }
        for (const key of Object.keys(model)) {
            if (model[key] == null) {
                delete model[key];
            }
        }
        return model;
    }
    ModelUtil.sanitizeModel = sanitizeModel;
    async function readModel(name) {
        const models = await readRawModels();
        return models[name];
    }
    ModelUtil.readModel = readModel;
    async function writeModel(name, model) {
        await editModels(models => models[name] = model);
        return model;
    }
    ModelUtil.writeModel = writeModel;
    async function createModel(name) {
        await editModels(models => models[name] = { ...defaultModel, display: name, chat: true });
        return name;
    }
    ModelUtil.createModel = createModel;
    async function renameModel(oldName, newName) {
        await editModels(models => {
            models[newName] = models[oldName];
            delete models[oldName];
        });
        return newName;
    }
    ModelUtil.renameModel = renameModel;
    async function removeModel(name) {
        await editModels(models => {
            delete models[name];
        });
        return name;
    }
    ModelUtil.removeModel = removeModel;
    async function readRawModels() {
        const file = await FileUtil.readJSONRAW(ModelUtil.modelsPath) ?? {};
        return file.models ?? {};
    }
    function toParams(settings) {
        const { display, variants, ...params } = settings;
        return params;
    }
    function splitDisplay(display) {
        for (const separator of ["–", "/"]) {
            const index = display.indexOf(separator);
            if (index >= 0) {
                return {
                    group: display.slice(0, index).trim(),
                    label: display.slice(index + separator.length).trim()
                };
            }
        }
        return { group: "", label: display.trim() };
    }
    function addModelOption(result, name, split, params, variantName) {
        if (params.chat == false) {
            return;
        }
        result.push({
            name,
            group: split.group,
            display: variantName ? `${split.label} ${variantName}` : split.label
        });
    }
    async function editModels(change) {
        const lock = await FileUtil.lock(ModelUtil.modelsPath);
        try {
            const file = await FileUtil.readJSONRAW(ModelUtil.modelsPath) ?? {};
            file.models = file.models ?? {};
            change(file.models);
            await FileUtil.writeJSONRAW(ModelUtil.modelsPath, file);
        }
        finally {
            lock.release();
        }
    }
})(ModelUtil || (ModelUtil = {}));
var DateUtil;
(function (DateUtil) {
    function toUTCParts(time) {
        const date = new Date(time);
        return {
            year: String(date.getUTCFullYear()),
            month: String(1 + date.getUTCMonth()).padStart(2, "0"),
            day: String(date.getUTCDate()).padStart(2, "0"),
            hours: String(date.getUTCHours()).padStart(2, "0"),
            minutes: String(date.getUTCMinutes()).padStart(2, "0"),
            seconds: String(date.getUTCSeconds()).padStart(2, "0")
        };
    }
    DateUtil.toUTCParts = toUTCParts;
    function toLocalParts(time) {
        const date = new Date(time);
        return {
            year: String(date.getFullYear()),
            month: String(1 + date.getMonth()).padStart(2, "0"),
            day: String(date.getDate()).padStart(2, "0"),
            hours: String(date.getHours()).padStart(2, "0"),
            minutes: String(date.getMinutes()).padStart(2, "0"),
            seconds: String(date.getSeconds()).padStart(2, "0")
        };
    }
    DateUtil.toLocalParts = toLocalParts;
    function toUTCDate(time) {
        const { year, month, day } = toUTCParts(time);
        return `${year}-${month}-${day}`;
    }
    DateUtil.toUTCDate = toUTCDate;
    function toLocalDate(time) {
        const { year, month, day } = toLocalParts(time);
        return `${year}-${month}-${day}`;
    }
    DateUtil.toLocalDate = toLocalDate;
    function toUTCTime(time) {
        const { hours, minutes } = toUTCParts(time);
        return `${hours}:${minutes}`;
    }
    DateUtil.toUTCTime = toUTCTime;
    function toLocalTime(time) {
        const { hours, minutes } = toLocalParts(time);
        return `${hours}:${minutes}`;
    }
    DateUtil.toLocalTime = toLocalTime;
    function toUTCFull(time) {
        const { year, month, day, hours, minutes } = toUTCParts(time);
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    DateUtil.toUTCFull = toUTCFull;
    function toLocalFull(time) {
        const { year, month, day, hours, minutes } = toLocalParts(time);
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    DateUtil.toLocalFull = toLocalFull;
    function parseWhen(value) {
        const delta = value.match(/^(\d+)([A-Za-z]+)$/);
        if (delta) {
            return DateUtil.parseDelta(Number(delta[1]), delta[2]);
        }
        return DateUtil.parseAbsolute(value);
    }
    DateUtil.parseWhen = parseWhen;
    function formatWhen(when) {
        if (when == null) {
            return null;
        }
        if (when.hasTime) {
            const { hours, minutes, seconds } = DateUtil.toLocalParts(when.time);
            return `${DateUtil.toLocalDate(when.time)}-${hours}:${minutes}:${seconds}`;
        }
        return DateUtil.toLocalDate(when.time);
    }
    DateUtil.formatWhen = formatWhen;
    function whenTime(value) {
        if (value == null) {
            return null;
        }
        const parts = value.split("-");
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (parts.length == 4) {
            const time = parts[3].split(":");
            date.setHours(Number(time[0]), Number(time[1]), Number(time[2] ?? 0));
        }
        return date.getTime();
    }
    DateUtil.whenTime = whenTime;
    function advanceWhen(value, repeat, now) {
        const match = repeat.match(/^(\d+)([A-Za-z]+)$/);
        if (match == null) {
            return value;
        }
        const count = Number(match[1]);
        const unit = match[2];
        const start = DateUtil.whenTime(value);
        if (start == null) {
            return value;
        }
        const step = DateUtil.unitMillis(count, unit);
        let passed = 0;
        if (step) {
            passed = Math.floor((now - start) / step) + 1;
        }
        else {
            passed = 1;
            while (DateUtil.stepDate(start, count, unit, passed + 1) <= now) {
                ++passed;
            }
        }
        return DateUtil.formatWhen({ time: DateUtil.stepDate(start, count, unit, passed), hasTime: true });
    }
    DateUtil.advanceWhen = advanceWhen;
    function durationMillis(value) {
        const delta = value?.match(/^(\d+)([A-Za-z]+)$/);
        if (delta == null) {
            return null;
        }
        return DateUtil.unitMillis(Number(delta[1]), delta[2]);
    }
    DateUtil.durationMillis = durationMillis;
    function nextMinute(now) {
        return now - now % 60000 + 60000;
    }
    DateUtil.nextMinute = nextMinute;
    function resolveUnit(unit) {
        const lower = unit.toLowerCase();
        if (lower == "y" || lower == "year" || lower == "years") {
            return "year";
        }
        if (unit == "M" || lower == "month" || lower == "months") {
            return "month";
        }
        if (lower == "w" || lower == "week" || lower == "weeks") {
            return "week";
        }
        if (lower == "d" || lower == "day" || lower == "days") {
            return "day";
        }
        if (lower == "h" || lower == "hour" || lower == "hours") {
            return "hour";
        }
        if (unit == "m" || lower == "minute" || lower == "minutes") {
            return "minute";
        }
        if (lower == "s" || lower == "second" || lower == "seconds") {
            return "second";
        }
        return null;
    }
    DateUtil.resolveUnit = resolveUnit;
    function parseDelta(count, unit) {
        const resolved = DateUtil.resolveUnit(unit);
        const date = new Date();
        if (resolved == "year") {
            date.setFullYear(date.getFullYear() + count);
            return { time: date.getTime(), hasTime: false };
        }
        if (resolved == "month") {
            date.setMonth(date.getMonth() + count);
            return { time: date.getTime(), hasTime: false };
        }
        if (resolved == "week") {
            date.setDate(date.getDate() + 7 * count);
            return { time: date.getTime(), hasTime: false };
        }
        if (resolved == "day") {
            date.setDate(date.getDate() + count);
            return { time: date.getTime(), hasTime: false };
        }
        if (resolved == "hour") {
            date.setHours(date.getHours() + count);
            return { time: date.getTime(), hasTime: true };
        }
        if (resolved == "minute") {
            date.setMinutes(date.getMinutes() + count);
            return { time: date.getTime(), hasTime: true };
        }
        if (resolved == "second") {
            date.setSeconds(date.getSeconds() + count);
            return { time: date.getTime(), hasTime: true };
        }
        return null;
    }
    DateUtil.parseDelta = parseDelta;
    function parseAbsolute(value) {
        const parts = value.split("-");
        const time = parts[parts.length - 1].match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        let hasTime = false;
        if (time) {
            hours = Number(time[1]);
            minutes = Number(time[2]);
            seconds = Number(time[3] ?? 0);
            hasTime = true;
            parts.pop();
        }
        let year = null;
        let month = null;
        let day = null;
        if (parts.length == 3) {
            year = Number(parts[0]);
            month = Number(parts[1]);
            day = Number(parts[2]);
        }
        else if (parts.length == 2 && parts[0].length == 4) {
            year = Number(parts[0]);
            month = Number(parts[1]);
            day = 1;
        }
        else if (parts.length == 2) {
            year = new Date().getFullYear();
            month = Number(parts[0]);
            day = Number(parts[1]);
        }
        else {
            return null;
        }
        const date = new Date(year, month - 1, day, hours, minutes, seconds);
        if (isNaN(date.getTime())) {
            return null;
        }
        return { time: date.getTime(), hasTime };
    }
    DateUtil.parseAbsolute = parseAbsolute;
    function unitMillis(count, unit) {
        const resolved = DateUtil.resolveUnit(unit);
        if (resolved == "week") {
            return 7 * 86400000 * count;
        }
        if (resolved == "day") {
            return 86400000 * count;
        }
        if (resolved == "hour") {
            return 3600000 * count;
        }
        if (resolved == "minute") {
            return 60000 * count;
        }
        if (resolved == "second") {
            return 1000 * count;
        }
        return null;
    }
    DateUtil.unitMillis = unitMillis;
    function stepDate(start, count, unit, passed) {
        const resolved = DateUtil.resolveUnit(unit);
        const date = new Date(start);
        if (resolved == "year") {
            date.setFullYear(date.getFullYear() + count * passed);
        }
        else if (resolved == "month") {
            date.setMonth(date.getMonth() + count * passed);
        }
        else if (resolved == "week") {
            date.setDate(date.getDate() + 7 * count * passed);
        }
        else if (resolved == "day") {
            date.setDate(date.getDate() + count * passed);
        }
        else if (resolved == "hour") {
            date.setHours(date.getHours() + count * passed);
        }
        else if (resolved == "minute") {
            date.setMinutes(date.getMinutes() + count * passed);
        }
        else if (resolved == "second") {
            date.setSeconds(date.getSeconds() + count * passed);
        }
        return date.getTime();
    }
    DateUtil.stepDate = stepDate;
})(DateUtil || (DateUtil = {}));
class DateGapHandler {
    constructor(lastGap, prevGap, precision) {
        this.prevTime = 0;
        this.lastTime = 0;
        this.lastGap = lastGap;
        this.prevGap = prevGap;
        this.precision = precision;
    }
    check(currTime) {
        const currDate = DateUtil.toLocalDate(currTime);
        if (this.lastDate == currDate) {
            if (currTime - this.prevTime > this.prevGap || currTime - this.lastTime > this.lastGap) {
                this.prevTime = currTime;
                this.lastTime = currTime;
                return {
                    time: DateUtil.toLocalTime(currTime - currTime % this.precision)
                };
            }
        }
        else {
            this.prevTime = currTime;
            this.lastTime = currTime;
            this.lastDate = currDate;
            return {
                date: currDate,
                time: DateUtil.toLocalTime(currTime - currTime % this.precision)
            };
        }
        this.prevTime = currTime;
        return {};
    }
}
var LibraryUtil;
(function (LibraryUtil) {
    async function ensure(root, defaults) {
        await NodeUtil.makeDirPromise(root, { recursive: true });
        const settingsPath = NodeUtil.getPath(root, "settings.json");
        await SettingsUtil.ensure(settingsPath, defaults);
        const cataloguePath = NodeUtil.getPath(root, "catalogue.json");
        await SettingsUtil.ensure(cataloguePath, {});
    }
    LibraryUtil.ensure = ensure;
    async function nextIndex(path) {
        const lock = await FileUtil.lock(path);
        try {
            const settings = await FileUtil.readJSONRAW(path) ?? {};
            settings.lastIndex = (settings.lastIndex ?? 0) + 1;
            await FileUtil.writeJSONRAW(path, settings);
            return settings.lastIndex;
        }
        finally {
            lock.release();
        }
    }
    LibraryUtil.nextIndex = nextIndex;
    async function nextParts(path) {
        const time = Date.now();
        const parts = DateUtil.toLocalParts(time);
        const index = await nextIndex(path);
        const padded = index.toString().padStart(5, "0");
        return { time, ...parts, index, padded };
    }
    LibraryUtil.nextParts = nextParts;
    function buildName(time, name) {
        const date = DateUtil.toLocalDate(time ?? Date.now());
        const clean = LibraryUtil.cleanName(name);
        if (clean) {
            return `${date}-${clean}`;
        }
        return date;
    }
    LibraryUtil.buildName = buildName;
    function cleanName(value) {
        const trimmed = (value ?? "").trim();
        const match = trimmed.match(/^\d{4}-\d{2}-\d{2}[- ]*(?:(?:excerpt|note)-)?(?:\d+(?=[- ]|$)[- ]*)?(.*)$/);
        if (match) {
            return match[1].trim();
        }
        return trimmed;
    }
    LibraryUtil.cleanName = cleanName;
    async function readEntries(path) {
        const data = await FileUtil.readJSONLocked(path) ?? {};
        return data.entries ?? {};
    }
    LibraryUtil.readEntries = readEntries;
    async function setEntry(path, name, entry) {
        const lock = await FileUtil.lock(path);
        try {
            const data = await FileUtil.readJSONRAW(path) ?? {};
            data.entries = data.entries ?? {};
            data.entries[name] = entry;
            await FileUtil.writeJSONRAW(path, data);
        }
        finally {
            lock.release();
        }
    }
    LibraryUtil.setEntry = setEntry;
    async function getEntry(path, name) {
        const data = await FileUtil.readJSONLocked(path) ?? {};
        const entries = data.entries ?? {};
        return entries[name];
    }
    LibraryUtil.getEntry = getEntry;
    async function removeEntry(path, name) {
        const lock = await FileUtil.lock(path);
        try {
            const data = await FileUtil.readJSONRAW(path) ?? {};
            data.entries = data.entries ?? {};
            delete data.entries[name];
            await FileUtil.writeJSONRAW(path, data);
        }
        finally {
            lock.release();
        }
    }
    LibraryUtil.removeEntry = removeEntry;
    async function listDirectoryEntries(root) {
        try {
            return await NodeUtil.readDirPromise(root);
        }
        catch {
            console.warn(`unable to list directory of ${root}`);
        }
        return [];
    }
    LibraryUtil.listDirectoryEntries = listDirectoryEntries;
    async function listFoldersWithSettings(root) {
        const result = [];
        for (const folder of await listDirectoryEntries(root)) {
            const settingsPath = NodeUtil.getPath(root, folder, "settings.json");
            if (await FileUtil.exists(settingsPath)) {
                result.push(folder);
            }
        }
        return result;
    }
    LibraryUtil.listFoldersWithSettings = listFoldersWithSettings;
})(LibraryUtil || (LibraryUtil = {}));
var ArkUtil;
(function (ArkUtil) {
    const arksPath = SettingsUtil.getLocation("/ThinkTank/Agora/Arks");
    const defaultSettings = {};
    async function initialize() {
        await NodeUtil.makeDirPromise(arksPath, { recursive: true });
        const arkList = await getArkNames();
        if (arkList.length) {
            return;
        }
        const arkFolder = NodeUtil.getPath(arksPath, "Nemo");
        await NodeUtil.makeDirPromise(arkFolder, { recursive: true });
        const settingsPath = NodeUtil.getPath(arkFolder, "settings.json");
        await SettingsUtil.edit(settingsPath, {}, {});
    }
    ArkUtil.initialize = initialize;
    async function readArkSettings(arkName) {
        const settingsPath = NodeUtil.getPath(arksPath, arkName, "settings.json");
        return SettingsUtil.read(settingsPath, defaultSettings);
    }
    ArkUtil.readArkSettings = readArkSettings;
    async function editArkSettings(arkName, overrides) {
        const settingsPath = NodeUtil.getPath(arksPath, arkName, "settings.json");
        return SettingsUtil.edit(settingsPath, overrides, defaultSettings);
    }
    ArkUtil.editArkSettings = editArkSettings;
    async function getArkNames() {
        return LibraryUtil.listFoldersWithSettings(arksPath);
    }
    ArkUtil.getArkNames = getArkNames;
    async function readRawArkSettings(arkName) {
        const settingsPath = NodeUtil.getPath(arksPath, arkName, "settings.json");
        return FileUtil.readJSONLocked(settingsPath);
    }
    ArkUtil.readRawArkSettings = readRawArkSettings;
    async function createArk(name) {
        const arkFolder = NodeUtil.getPath(arksPath, name);
        await NodeUtil.makeDirPromise(arkFolder, { recursive: true });
        const settingsPath = NodeUtil.getPath(arkFolder, "settings.json");
        await SettingsUtil.edit(settingsPath, {}, {});
        return name;
    }
    ArkUtil.createArk = createArk;
    async function removeArk(name) {
        await NodeUtil.removePromise(NodeUtil.getPath(arksPath, name), { recursive: true });
        return name;
    }
    ArkUtil.removeArk = removeArk;
})(ArkUtil || (ArkUtil = {}));
var PromptUtil;
(function (PromptUtil) {
    const agoraPath = SettingsUtil.getLocation("/ThinkTank/Agora");
    const promptsPath = NodeUtil.getPath(agoraPath, "Prompts");
    const arksPath = NodeUtil.getPath(agoraPath, "Arks");
    async function listPrompts() {
        const result = { global: await listMarkdown(promptsPath), arks: {} };
        for (const arkName of await ArkUtil.getArkNames()) {
            result.arks[arkName] = await listMarkdown(NodeUtil.getPath(arksPath, arkName));
        }
        return result;
    }
    PromptUtil.listPrompts = listPrompts;
    async function readPrompt(arkName, name) {
        return FileUtil.readTextLocked(getPromptPath(arkName, name));
    }
    PromptUtil.readPrompt = readPrompt;
    async function writePrompt(arkName, name, content) {
        await FileUtil.writeTextLocked(getPromptPath(arkName, name), content);
        return content;
    }
    PromptUtil.writePrompt = writePrompt;
    function getPromptPath(arkName, name) {
        if (arkName) {
            return NodeUtil.getPath(arksPath, arkName, name);
        }
        return NodeUtil.getPath(promptsPath, name);
    }
    async function listMarkdown(root) {
        const result = [];
        for (const name of await LibraryUtil.listDirectoryEntries(root)) {
            if (name.endsWith(".md")) {
                result.push(name);
            }
        }
        result.sort();
        return result;
    }
})(PromptUtil || (PromptUtil = {}));
var TodoUtil;
(function (TodoUtil) {
    const todoPath = SettingsUtil.getLocation("/ThinkTank/Agora/TODOs");
    async function listTodos() {
        const result = [];
        for (const name of await LibraryUtil.listDirectoryEntries(todoPath)) {
            if (name.endsWith(".txt")) {
                result.push(name);
            }
        }
        result.sort();
        return result;
    }
    TodoUtil.listTodos = listTodos;
    async function createTodo(name) {
        await FileUtil.writeTextLocked(NodeUtil.getPath(todoPath, name), "");
        return name;
    }
    TodoUtil.createTodo = createTodo;
    async function renameTodo(oldName, newName) {
        await NodeUtil.renamePromise(NodeUtil.getPath(todoPath, oldName), NodeUtil.getPath(todoPath, newName));
        return newName;
    }
    TodoUtil.renameTodo = renameTodo;
    async function removeTodo(name) {
        await NodeUtil.removePromise(NodeUtil.getPath(todoPath, name));
        return name;
    }
    TodoUtil.removeTodo = removeTodo;
    async function readTodo(name) {
        return FileUtil.readTextLocked(NodeUtil.getPath(todoPath, name));
    }
    TodoUtil.readTodo = readTodo;
    async function writeTodo(name, content) {
        await FileUtil.writeTextLocked(NodeUtil.getPath(todoPath, name), content);
        return content;
    }
    TodoUtil.writeTodo = writeTodo;
})(TodoUtil || (TodoUtil = {}));
var TextUtil;
(function (TextUtil) {
    function parseLineFields(input, output) {
        const result = [];
        for (const line of input.split("\n")) {
            const match = line.match(/(\w+):(.+)/) ?? [];
            const key = match[1];
            const value = match[2];
            if (key in output) {
                output[key] = value.trim();
            }
            else {
                result.push(line);
            }
        }
        return result.join("\n");
    }
    TextUtil.parseLineFields = parseLineFields;
    function parseMetaFields(input, output) {
        const result = [];
        for (const part of input.split(/\s+/)) {
            const match = part.match(/(@?\w+)=(.+)/) ?? [];
            const key = match[1];
            const value = match[2];
            if (key in output) {
                output[key] = value;
            }
            else {
                result.push(part);
            }
        }
        return result.join(" ");
    }
    TextUtil.parseMetaFields = parseMetaFields;
    async function parseStreamMeta(input, onMeta, onText) {
        let inMeta = false;
        let remainder = "";
        for await (const token of metaTokens(input)) {
            if (inMeta) {
                if (token == "]]\n" || token == "]]") {
                    onMeta(remainder);
                    inMeta = false;
                    remainder = "";
                }
                else {
                    remainder += token;
                }
            }
            else {
                if (token == "[[") {
                    inMeta = true;
                }
                else {
                    onText(token);
                }
            }
        }
    }
    TextUtil.parseStreamMeta = parseStreamMeta;
    async function* metaTokens(stream) {
        let remainder = "";
        for await (const chunk of stream) {
            const text = remainder + chunk;
            const tokens = text.split(/(\[\[|\]\]\n|\]\])/);
            remainder = tokens.pop();
            yield* tokens;
            if (remainder.endsWith("[") || remainder.endsWith("]")) {
            }
            else {
                yield remainder;
                remainder = "";
            }
        }
        if (remainder) {
            yield remainder;
        }
    }
    TextUtil.metaTokens = metaTokens;
    async function* trimChunks(stream) {
        for await (let chunk of stream) {
            chunk = chunk.trim();
            if (chunk) {
                yield chunk;
            }
        }
    }
    TextUtil.trimChunks = trimChunks;
    async function* cleanChunks(stream) {
        for await (let chunk of stream) {
            yield normalizeTypography(chunk);
        }
    }
    TextUtil.cleanChunks = cleanChunks;
    ;
    async function expandText(input, values, replacer) {
        let match;
        while (match = input.match(/\{\{([^{}]+)\}\}/)) {
            const outer = match[0];
            const key = match[1];
            const result = values[key];
            if (typeof result == "string") {
                input = input.replace(outer, result);
            }
            else {
                const result = await replacer(key);
                if (typeof result == "string") {
                    input = input.replace(outer, result);
                }
                else {
                    input = input.replace(outer, "");
                }
            }
        }
        return input;
    }
    TextUtil.expandText = expandText;
    function shortifyLineNicely(value, sizeLimit) {
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
    TextUtil.shortifyLineNicely = shortifyLineNicely;
    function shortifyTextNicely(value, countLimit, sizeLimit) {
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
    TextUtil.shortifyTextNicely = shortifyTextNicely;
    function normalizeLineEndings(input) {
        return input.replace(/\r\n?/g, "\n");
    }
    TextUtil.normalizeLineEndings = normalizeLineEndings;
    function normalizeBlankLines(input) {
        return input
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n\n\n+/g, "\n\n")
            .trim();
    }
    TextUtil.normalizeBlankLines = normalizeBlankLines;
    function normalizeTypography(input) {
        return input
            .replace(/[‘’‚‛‹›]/g, "'")
            .replace(/[“”„‟«»]/g, '"')
            .replace(/…/g, "...")
            .replace(/—/g, "–")
            .replace(/‑/g, "-");
    }
    TextUtil.normalizeTypography = normalizeTypography;
    function normalizeAll(input) {
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
    TextUtil.normalizeAll = normalizeAll;
    function shiftIndent(value, start, end, delta) {
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
                }
                else {
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
    TextUtil.shiftIndent = shiftIndent;
})(TextUtil || (TextUtil = {}));
var ContextUtil;
(function (ContextUtil) {
    const chatsPath = SettingsUtil.getLocation("/ThinkTank/Agora/Chats");
    ContextUtil.streamTemplate = {
        gapHandler: null,
        lineLength: Infinity,
        lineCount: Infinity,
        delimeter: "\n",
        date: null,
        time: null,
        user: "[[message role=user name={{name}} time={{epoch}}]]\n{{content}}",
        ark: "[[message role=ark name={{name}} time={{epoch}}]]\n{{content}}",
        env: "[[message role=env name={{name}} time={{epoch}}]]\n{{content}}",
        info: "[[message role=info]]\n{{content}}",
        image: "[[image name={{name}}]]\n{{content}}",
        document: "[[document name={{name}}]]\n{{content}}"
    };
    ContextUtil.arkTemplate = {
        gapHandler: null,
        lineLength: Infinity,
        lineCount: Infinity,
        delimeter: "\n",
        date: " date={{date}}",
        time: " time={{time}}",
        user: "[[author={{name}}{{date}}{{time}}]]\n{{content}}",
        ark: "{{content}}",
        env: "[[author=env source={{name}}{{date}}{{time}}]]\n{{content}}",
        info: "[[author=env]]\n{{content}}",
        image: "[[image name={{name}}]]\n{{content}}",
        document: "[[document name={{name}}]]\n{{content}}"
    };
    ContextUtil.archiveTemplate = {
        gapHandler: null,
        lineLength: Infinity,
        lineCount: Infinity,
        delimeter: "\n\n",
        date: "\n{{date}}",
        time: "\n{{time}}",
        user: "Message from {{name}}:{{date}}{{time}}\n\n{{content}}",
        ark: "Message from {{name}}:{{date}}{{time}}\n\n{{content}}",
        env: "Result of {{name}}:{{date}}{{time}}\n\n{{content}}",
        info: "[info]\n{{content}}",
        image: "[image {{name}}]\n{{content}}",
        document: "[document {{name}}]\n{{content}}"
    };
    ContextUtil.minimalTemplate = {
        gapHandler: null,
        lineLength: 200,
        lineCount: 2,
        delimeter: "\n",
        date: null,
        time: null,
        user: "{{name}}:\n{{content}}",
        ark: "{{name}}:\n{{content}}",
        env: "[result of {{name}}]",
        info: "[{{content}}]",
        image: "[image {{name}}]",
        document: "[document {{name}}]"
    };
    async function loadActive(chatID) {
        const activePath = NodeUtil.getPath(chatsPath, chatID, "active.json");
        return FileUtil.readJSONLocked(activePath);
    }
    ContextUtil.loadActive = loadActive;
    async function writeActive(chatID, entries) {
        const activePath = NodeUtil.getPath(chatsPath, chatID, "active.json");
        await FileUtil.writeJSONLocked(activePath, entries);
    }
    ContextUtil.writeActive = writeActive;
    async function editActive(chatID, index, entries) {
        const activePath = NodeUtil.getPath(chatsPath, chatID, "active.json");
        return editFile(activePath, index, entries);
    }
    ContextUtil.editActive = editActive;
    async function loadArchive(chatID) {
        const archivePath = NodeUtil.getPath(chatsPath, chatID, "archive.json");
        return FileUtil.readJSONLocked(archivePath);
    }
    ContextUtil.loadArchive = loadArchive;
    async function writeArchive(chatID, entries) {
        const archivePath = NodeUtil.getPath(chatsPath, chatID, "archive.json");
        await FileUtil.writeJSONLocked(archivePath, entries);
    }
    ContextUtil.writeArchive = writeArchive;
    async function editArchive(chatID, index, entries) {
        const archivePath = NodeUtil.getPath(chatsPath, chatID, "archive.json");
        return editFile(archivePath, index, entries);
    }
    ContextUtil.editArchive = editArchive;
    async function editFile(path, index, entries) {
        const lock = await FileUtil.lock(path);
        try {
            const context = await FileUtil.readJSONRAW(path) ?? [];
            context.splice(index, Infinity, ...entries);
            await FileUtil.writeJSONRAW(path, context);
            return context;
        }
        finally {
            lock.release();
        }
    }
    function contextToText(context, template, limit) {
        const result = [];
        for (const entry of context) {
            result.push(entryToText(entry, template));
        }
        return result.slice(-limit).join(template.delimeter);
    }
    ContextUtil.contextToText = contextToText;
    function entryToText(entry, template) {
        let result = template[entry.role ?? entry.type];
        let date = "";
        let time = "";
        if (template.gapHandler) {
            if (result.match(/\{\{date\}\}|\{\{time\}\}/)) {
                const gap = template.gapHandler.check(entry.time);
                if (gap.date) {
                    date = template.date.replace("{{date}}", gap.date);
                }
                if (gap.time) {
                    time = template.time.replace("{{time}}", gap.time);
                }
            }
        }
        let content;
        if (template.lineCount == Infinity) {
            if (template.lineLength == Infinity) {
                content = TextUtil.normalizeAll(entry.content);
            }
            else {
                content = TextUtil.shortifyTextNicely(entry.content, template.lineCount, template.lineLength);
            }
        }
        else {
            content = TextUtil.shortifyTextNicely(entry.content, template.lineCount, template.lineLength);
        }
        return result
            .replace("{{date}}", date)
            .replace("{{time}}", time)
            .replace("{{epoch}}", entry.time)
            .replace("{{name}}", entry.name)
            .replace("{{content}}", content)
            .trim();
    }
    ContextUtil.entryToText = entryToText;
    function getReportArk(entry, name, ending) {
        if (entry.type == "message") {
            if (entry.role == "env") {
                if (entry.name == "name") {
                    if (entry.content.endsWith(ending) == false) {
                        return entry.content.slice(0, -ending.length);
                    }
                }
            }
        }
        return null;
    }
    ContextUtil.getReportArk = getReportArk;
    async function setEntry(chatID, index, entry) {
        const remove = entry == null;
        const archive = await loadArchive(chatID) ?? [];
        const active = await loadActive(chatID) ?? [];
        if (index < 0) {
            return [...archive, ...active];
        }
        if (index < archive.length) {
            if (remove) {
                archive.splice(index, 1);
            }
            else {
                archive[index] = entry;
            }
            await writeArchive(chatID, archive);
        }
        else {
            const activeIndex = index - archive.length;
            if (remove) {
                active.splice(activeIndex, 1);
            }
            else {
                active[activeIndex] = entry;
            }
            await writeActive(chatID, active);
        }
        return [...archive, ...active];
    }
    ContextUtil.setEntry = setEntry;
})(ContextUtil || (ContextUtil = {}));
;
function checkAbort(handler) {
    if (handler.controller) {
        if (handler.checkAbort) {
            if (handler.checkAbort()) {
                handler.controller.abort();
            }
        }
    }
}
async function fetchText(url, method, headers, body) {
    const request = { method };
    if (headers) {
        request.headers = headers;
    }
    if (typeof body == "string") {
        request.body = body;
    }
    else if (body) {
        request.body = JSON.stringify(body);
    }
    const response = await fetch(url, request);
    if (response.body) {
        return StreamUtil.decode(StreamUtil.asIterable(response.body));
    }
    return "";
}
async function fetchData(url, method, headers, body) {
    return JSON.parse(await fetchText(url, method, headers, body));
}
async function fetchByChunk(url, method, headers, body, handler) {
    const request = { method };
    if (handler.controller) {
        request.signal = handler.controller.signal;
    }
    if (headers) {
        request.headers = headers;
    }
    if (typeof body == "string") {
        request.body = body;
    }
    else if (body) {
        request.body = JSON.stringify(body);
    }
    const response = await fetch(url, request);
    if (response.body) {
        const iterable = StreamUtil.byChunk(StreamUtil.asIterable(response.body));
        return StreamUtil.process(iterable, handler);
    }
    return "";
}
async function fetchByLine(url, method, headers, body, handler) {
    const request = { method };
    if (handler.controller) {
        request.signal = handler.controller.signal;
    }
    if (headers) {
        request.headers = headers;
    }
    if (typeof body == "string") {
        request.body = body;
    }
    else if (body) {
        request.body = JSON.stringify(body);
    }
    const response = await fetch(url, request);
    if (response.body) {
        const iterable = StreamUtil.trimChunks(StreamUtil.byLine(StreamUtil.asIterable(response.body)));
        return StreamUtil.process(iterable, handler);
    }
    return "";
}
var OpenAIAdapter;
(function (OpenAIAdapter) {
    const thinkModeMap = {
        "false": "none",
        "true": "high",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "max": "max"
    };
    function createChatRequestBody(params, context) {
        return {
            messages: context.map(convertMessage),
            model: params.model,
            temperature: params.temp,
            top_p: params.topP,
            max_tokens: params.numPredict,
            reasoning_effort: thinkModeMap[String(params.think)],
            stream: true
        };
    }
    OpenAIAdapter.createChatRequestBody = createChatRequestBody;
    function processChatResponseLine(params, line) {
        if (line.startsWith("data:")) {
            line = line.slice(5).trim();
            if (line == "[DONE]") {
                return { thinking: "", content: "" };
            }
            const data = JSON.parse(line);
            if (data.error) {
                throw new Error(`OpenAI type API error: ${data.error.message}`);
            }
            if (data.choices == null || data.choices.length == 0) {
                return { thinking: "", content: "" };
            }
            const selection = data.choices[0];
            const payload = selection.message ?? selection.delta;
            if (payload) {
                return { thinking: payload.reasoning_content ?? payload.reasoning ?? "", content: payload.content ?? "" };
            }
        }
        return { thinking: "", content: "" };
    }
    OpenAIAdapter.processChatResponseLine = processChatResponseLine;
    function convertMessage(message) {
        if (message.images == null || message.images.length == 0) {
            return { role: message.role, content: message.content };
        }
        const parts = [];
        if (message.content) {
            parts.push({ type: "text", text: message.content });
        }
        for (const image of message.images) {
            parts.push({ type: "image_url", image_url: { url: `data:${getMime(image)};base64,${image}` } });
        }
        return { role: message.role, content: parts };
    }
    function getMime(data) {
        if (data.startsWith("iVBORw0KGgo")) {
            return "image/png";
        }
        if (data.startsWith("/9j/")) {
            return "image/jpeg";
        }
        if (data.startsWith("R0lGOD")) {
            return "image/gif";
        }
        if (data.startsWith("UklGR")) {
            return "image/webp";
        }
        return "image/png";
    }
})(OpenAIAdapter || (OpenAIAdapter = {}));
var ChatService;
(function (ChatService) {
    const adapters = {
        "default": OllamaAdapter,
        "ollama": OllamaAdapter,
        "openai": OpenAIAdapter
    };
    async function generate(params, context, handler) {
        const adapter = adapters[params.APIType] ?? adapters["default"];
        const input = adapter.createChatRequestBody(params, context);
        let thought = null;
        let wrote = null;
        const processor = (line) => {
            try {
                checkAbort(handler);
                const data = adapter.processChatResponseLine(params, line);
                if (data.thinking) {
                    streamThought(params.thought, thought, wrote, data.thinking, handler.onChunk);
                    thought = data.thinking;
                    wrote = null;
                }
                if (data.content) {
                    streamContent(params.thought, thought, wrote, data.content, handler.onChunk);
                    if (handler.onSpeak) {
                        handler.onSpeak(data.content);
                    }
                    thought = null;
                    wrote = data.content;
                }
                return data.content;
            }
            catch (error) {
                if (handler.onError) {
                    handler.onError(error);
                }
                return "";
            }
        };
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
        }
        catch (error) {
            if (handler.onError) {
                handler.onError(error);
            }
            return "";
        }
    }
    ChatService.generate = generate;
    function streamThought(mode, thought, wrote, thinking, streamCallback) {
        if (mode == "hidden") {
        }
        else if (thought) {
            if (mode == "visible") {
                streamCallback(thinking);
            }
        }
        else {
            if (wrote) {
                if (wrote.endsWith("\n\n")) {
                }
                else if (wrote.endsWith("\n")) {
                    streamCallback("\n");
                }
                else {
                    streamCallback("\n\n");
                }
            }
            if (mode == "label") {
                streamCallback("Thinking...\n\n");
            }
            else if (mode == "visible") {
                streamCallback("Thoughts:\n\n");
                streamCallback(thinking.trimStart());
            }
        }
    }
    function streamContent(mode, thought, wrote, content, streamCallback) {
        if (wrote) {
            streamCallback(content);
        }
        else {
            if (thought) {
                if (mode == "visible") {
                    if (thought.endsWith("\n\n")) {
                    }
                    else if (thought.endsWith("\n")) {
                        streamCallback("\n");
                    }
                    else {
                        streamCallback("\n\n");
                    }
                    streamCallback("Response:\n\n");
                }
            }
            streamCallback(content.trimStart());
        }
    }
})(ChatService || (ChatService = {}));
var ParamsUtil;
(function (ParamsUtil) {
    async function getBaseSettings(chatID) {
        const workshops = await WorkshopUtil.getSettings();
        const globalSettings = await ChatUtil.readGlobalSettings();
        const chatSettings = await ChatUtil.readChatSettings(chatID);
        return applyMemberDefaults(SettingsUtil.mergeAll(workshops, globalSettings, chatSettings, { chatID }));
    }
    ParamsUtil.getBaseSettings = getBaseSettings;
    async function getCombinedSettings(chatID) {
        const baseSettings = await getBaseSettings(chatID);
        return mergeArkBelowChat(baseSettings, baseSettings.process.arkName);
    }
    ParamsUtil.getCombinedSettings = getCombinedSettings;
    async function getBaseParams(chatID, handler) {
        const models = await ModelUtil.readModels();
        const workshops = await WorkshopUtil.getSettings();
        const globalSettings = await ChatUtil.readGlobalSettings();
        const chatSettings = await ChatUtil.readChatSettings(chatID);
        return applyMemberDefaults(SettingsUtil.mergeAll(workshops, globalSettings, chatSettings, { chatID, models, handler }));
    }
    ParamsUtil.getBaseParams = getBaseParams;
    async function getCombinedParams(chatID, handler, arkName) {
        const baseParams = await getBaseParams(chatID, handler);
        const result = await mergeArkBelowChat(baseParams, arkName ?? baseParams.process.arkName);
        result.process = { ...result.process, arkName: result.arkName };
        return result;
    }
    ParamsUtil.getCombinedParams = getCombinedParams;
    async function getGlobalParams(handler) {
        const models = await ModelUtil.readModels();
        const workshops = await WorkshopUtil.getSettings();
        const globalSettings = await ChatUtil.readGlobalSettings();
        return applyMemberDefaults(SettingsUtil.mergeAll(workshops, globalSettings, { chatID: "global", models, handler }));
    }
    ParamsUtil.getGlobalParams = getGlobalParams;
    function applyMemberDefaults(settings) {
        const result = settings;
        if (result.members == null) {
            result.members = [result.process.userName, result.process.arkName];
        }
        return result;
    }
    async function mergeArkBelowChat(baseSettings, arkName) {
        const settings = baseSettings;
        const arkSettings = await ArkUtil.readArkSettings(arkName);
        const chatSettings = await ChatUtil.readChatSettings(settings.chatID);
        return applyMemberDefaults(SettingsUtil.mergeAll(baseSettings, arkSettings, chatSettings, { arkName }));
    }
    async function setArkSettings(baseSettings, arkName) {
        const arkSettings = await ArkUtil.readArkSettings(arkName);
        return SettingsUtil.mergeAll(baseSettings, arkSettings, { arkName });
    }
    ParamsUtil.setArkSettings = setArkSettings;
})(ParamsUtil || (ParamsUtil = {}));
var TopicMatcher;
(function (TopicMatcher) {
    const stopWordList = [
        "about", "after", "again", "against", "all", "almost", "along", "already", "also",
        "although", "always", "among", "an", "and", "another", "any", "anything", "are",
        "around", "as", "at", "be", "became", "because", "become", "been", "before",
        "being", "below", "between", "both", "but", "by", "can", "cannot", "could",
        "did", "do", "does", "doing", "done", "down", "during", "each", "either", "else",
        "enough", "even", "ever", "every", "for", "from", "further", "get", "got", "had",
        "has", "have", "having", "he", "her", "here", "him", "his", "how", "however",
        "i", "if", "in", "into", "is", "it", "its", "itself", "just", "least", "like",
        "likely", "may", "maybe", "me", "might", "more", "most", "must", "my", "never",
        "no", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
        "out", "over", "own", "perhaps", "quite", "rather", "really", "same", "shall", "she",
        "should", "since", "so", "some", "something", "still", "such", "than", "that", "the",
        "their", "them", "then", "there", "these", "they", "this", "those", "though",
        "through", "thus", "to", "too", "toward", "under", "until", "up", "upon", "us",
        "very", "was", "we", "well", "were", "what", "when", "where", "whether", "which",
        "while", "who", "why", "will", "with", "within", "without", "would", "you", "your"
    ];
    const stopWords = {};
    for (const word of stopWordList) {
        stopWords[word] = true;
    }
    const ageExponent = 3;
    const ageHalfDays = 3;
    const ageCoeff = 0.8;
    const topicExponent = 0.2;
    const topicCoeff = 1;
    const noiseExponent = 5;
    const noiseCoeff = 1;
    const weightCoeff = 0.5;
    const referenceEntries = 8;
    function scorePair(text1, text2) {
        return scoreTerms(toTerms(text1), toTerms(text2));
    }
    TopicMatcher.scorePair = scorePair;
    function scoreTexts(reference, texts) {
        const terms = toTerms(reference);
        const result = [];
        for (const text of texts) {
            result.push(scoreTerms(terms, toTerms(text)));
        }
        return result;
    }
    TopicMatcher.scoreTexts = scoreTexts;
    function scoreMemories(reference, entries, now = Date.now()) {
        let minWeight = Infinity;
        let maxWeight = -Infinity;
        for (const entry of entries) {
            const weight = entry.weight ?? 5;
            if (weight < minWeight) {
                minWeight = weight;
            }
            if (weight > maxWeight) {
                maxWeight = weight;
            }
        }
        const result = [];
        for (const entry of entries) {
            result.push(scoreMemory(entry, reference, minWeight, maxWeight, now));
        }
        return result;
    }
    TopicMatcher.scoreMemories = scoreMemories;
    function scoreBlock(block) {
        const parts = [];
        for (const entry of block) {
            parts.push(toTerms(entry.type == "message" ? entry.content : ""));
        }
        const prefixes = [];
        let prefix = {};
        for (const part of parts) {
            prefixes.push(prefix);
            prefix = mergeTerms(prefix, part);
        }
        const suffixes = [];
        let suffix = {};
        for (let i = parts.length - 1; i >= 0; --i) {
            suffix = mergeTerms(suffix, parts[i]);
            suffixes[i] = suffix;
        }
        const result = [];
        for (let i = 1; i < block.length; ++i) {
            const score = scoreTerms(prefixes[i], suffixes[i]);
            result.push(Math.max(0, 1 - score));
        }
        return result;
    }
    TopicMatcher.scoreBlock = scoreBlock;
    function select(reference, entries, count) {
        const texts = [];
        for (const entry of entries) {
            texts.push(entry.short ?? "");
        }
        const scores = scoreTexts(reference, texts);
        const ranked = [];
        for (let i = 0; i < entries.length; ++i) {
            const weight = entries[i].weight ?? 5;
            ranked.push({ entry: entries[i], rank: weight * scores[i] });
        }
        ranked.sort((a, b) => b.rank - a.rank);
        const result = [];
        const limit = Math.max(0, Math.floor(count));
        for (const item of ranked) {
            if (result.length >= limit) {
                break;
            }
            result.push(item.entry);
        }
        result.sort((a, b) => a.start - b.start);
        return result;
    }
    TopicMatcher.select = select;
    function selectMemories(reference, entries, time, expandedThreshold, expandedMin, expandedMax, shortThreshold, shortMin, shortMax) {
        const scores = scoreMemories(reference, entries, time);
        const ranked = [];
        for (let i = 0; i < entries.length; ++i) {
            ranked.push({ index: i, entry: entries[i], score: scores[i] });
        }
        ranked.sort((a, b) => b.score - a.score);
        const used = new Set();
        const expandedItems = takeRanked(ranked, expandedThreshold, expandedMin, expandedMax, used);
        const shortItems = takeRanked(ranked, shortThreshold, shortMin, shortMax, used);
        expandedItems.sort((a, b) => a.index - b.index);
        shortItems.sort((a, b) => a.index - b.index);
        const expanded = [];
        for (const item of expandedItems) {
            expanded.push(item.entry);
        }
        const shorts = [];
        for (const item of shortItems) {
            shorts.push(item.entry);
        }
        return { shorts, expanded };
    }
    TopicMatcher.selectMemories = selectMemories;
    function selectVar1(reference, entries, time) {
        return selectMemories(reference, entries, time, 0.9, 10, 30, 0.5, 100, 300);
    }
    TopicMatcher.selectVar1 = selectVar1;
    function selectVar2(reference, entries, time) {
        return selectMemories(reference, entries, time, 0.8, 15, 25, 0.3, 150, 250);
    }
    TopicMatcher.selectVar2 = selectVar2;
    function selectMemoriesFor(activeContext, memories, shortMax = 300, longMax = 30) {
        const parts = [];
        const first = Math.max(0, activeContext.length - referenceEntries);
        for (let i = first; i < activeContext.length; ++i) {
            parts.push(ContextUtil.entryToText(activeContext[i], ContextUtil.minimalTemplate));
        }
        return selectMemories(parts.join("\n"), memories, Date.now(), 0.9, 10, longMax, 0.5, 100, shortMax);
    }
    TopicMatcher.selectMemoriesFor = selectMemoriesFor;
    function split(block, minSize, maxSize) {
        const limits = scoreBlock(block);
        let size = 0;
        let best = -1;
        let bestScore = 0;
        for (let i = 1; i < block.length; ++i) {
            const entry = block[i - 1];
            if (entry.type == "message" && (entry.role == "user" || entry.role == "ark")) {
                size += entry.content.length;
            }
            if (size < minSize || size > maxSize) {
                continue;
            }
            if (best < 0 || limits[i - 1] > bestScore) {
                best = i;
                bestScore = limits[i - 1];
            }
        }
        return best;
    }
    TopicMatcher.split = split;
    function toTerms(text) {
        const result = {};
        const words = (text ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [];
        for (const word of words) {
            if (word.length < 3) {
                continue;
            }
            if (stopWords[word]) {
                continue;
            }
            result[word] = (result[word] ?? 0) + 1;
        }
        return result;
    }
    function scoreMemory(entry, reference, minWeight, maxWeight, now) {
        const noisePenalty = 1 - noiseCoeff * Math.pow(Math.random(), noiseExponent);
        const weightPenalty = 1 - weightCoeff * normalizeWeight(entry.weight ?? 5, minWeight, maxWeight);
        const agePenalty = 1 - ageCoeff * scoreAge(entry, now);
        const topicPenalty = 1 - topicCoeff * Math.pow(scorePair(reference, entry.short ?? ""), topicExponent);
        return 1 - noisePenalty * weightPenalty * agePenalty * topicPenalty;
    }
    function scoreAge(entry, now) {
        const days = Math.max(0, now - entry.end) / 86400000;
        return 1 / (1 + Math.pow(days / ageHalfDays, ageExponent));
    }
    function normalizeWeight(weight, minWeight, maxWeight) {
        if (maxWeight == minWeight) {
            return 0;
        }
        return (weight - minWeight) / (maxWeight - minWeight);
    }
    function takeRanked(ranked, threshold, minCount, maxCount, used) {
        const result = [];
        const cap = Math.max(0, Math.floor(maxCount));
        const floor = Math.min(Math.max(0, Math.floor(minCount)), cap);
        for (const item of ranked) {
            if (result.length >= cap) {
                break;
            }
            if (used.has(item.index)) {
                continue;
            }
            if (item.score >= threshold) {
                result.push(item);
                used.add(item.index);
            }
        }
        for (const item of ranked) {
            if (result.length >= floor) {
                break;
            }
            if (used.has(item.index)) {
                continue;
            }
            result.push(item);
            used.add(item.index);
        }
        return result;
    }
    function mergeTerms(terms, addition) {
        const result = { ...terms };
        for (const term in addition) {
            result[term] = (result[term] ?? 0) + addition[term];
        }
        return result;
    }
    function scoreTerms(left, right) {
        let dot = 0;
        let leftSize = 0;
        let rightSize = 0;
        for (const term in left) {
            const weight = 1 + Math.log(left[term]);
            leftSize += weight * weight;
            if (term in right) {
                dot += weight * (1 + Math.log(right[term]));
            }
        }
        for (const term in right) {
            const weight = 1 + Math.log(right[term]);
            rightSize += weight * weight;
        }
        if (leftSize == 0 || rightSize == 0) {
            return 0;
        }
        return dot / Math.sqrt(leftSize * rightSize);
    }
})(TopicMatcher || (TopicMatcher = {}));
var MemoryUtil;
(function (MemoryUtil) {
    const arksPath = SettingsUtil.getLocation("/ThinkTank/Agora/Arks");
    MemoryUtil.defaultSettings = {
        model: "default",
        prompt: "Write a memory paragraph for yourself after the fields, plain text, no formatting.",
        shortLimit: 80,
        longLimit: 8,
        activeLimit: 2,
        activeEntries: 8,
        activeLines: 2,
        activeLength: 80,
        allowRead: true,
        allowWrite: true
    };
    async function getPromptParts(params) {
        return [];
    }
    MemoryUtil.getPromptParts = getPromptParts;
    async function initialize() {
        await WorkshopUtil.scheduleEvery("memory-main", "1h");
    }
    MemoryUtil.initialize = initialize;
    async function onWakeUp(params) {
        console.log("memory wake up");
    }
    MemoryUtil.onWakeUp = onWakeUp;
    function getTimeRange(params, context) {
        let start = 0;
        let end = 0;
        for (const entry of context) {
            if (entry.time) {
                start = start || entry.time;
                end = entry.time || end;
            }
        }
        start = start || params.created;
        end = end || params.updated;
        return { start, end };
    }
    async function onUpdate(params, context) {
        for (const arkName of params.members) {
            if (arkName == params.process.userName) {
                continue;
            }
            const arkParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, arkName);
            if (arkParams.memory.allowWrite == false) {
                continue;
            }
            if (context.length == 0) {
                await removeMemoryEntry(arkName, `active-${params.chatID}`);
                continue;
            }
            const { start, end } = getTimeRange(arkParams, context);
            const entry = { source: params.chatID, short: `latest memory from chat ${params.chatID}`, start, end };
            await writeCatalogueEntry(arkName, `active-${params.chatID}`, entry);
        }
    }
    MemoryUtil.onUpdate = onUpdate;
    async function onDelete(params) {
        params.handler.streamInfo("Deleting active memory...");
        await removeActiveMemory(params);
    }
    MemoryUtil.onDelete = onDelete;
    async function removeActiveMemory(params) {
        for (const arkName of await ArkUtil.getArkNames()) {
            await removeMemoryEntry(arkName, `active-${params.chatID}`);
        }
    }
    MemoryUtil.removeActiveMemory = removeActiveMemory;
    async function removeChatMemories(chatID) {
        for (const arkName of await ArkUtil.getArkNames()) {
            const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
            const memoryData = await LibraryUtil.readEntries(cataloguePath);
            for (const memoryName of Object.keys(memoryData)) {
                if (memoryData[memoryName].source == chatID) {
                    await removeMemoryEntry(arkName, memoryName);
                }
            }
        }
    }
    MemoryUtil.removeChatMemories = removeChatMemories;
    async function onBlock(params, block) {
        if (params.members.length < 3) {
            if (params.memory.allowWrite) {
                params.handler.streamInfo("Memorizing old block...");
                await memorizeBlock(params, block);
            }
            return;
        }
        const jobs = [];
        for (const name of params.members) {
            if (name == params.process.userName) {
                continue;
            }
            let present = true;
            const filtered = [];
            for (const entry of block) {
                const called = ContextUtil.getReportArk(entry, "chat-call", " joined");
                const left = ContextUtil.getReportArk(entry, "chat-leave", " left");
                if (called == name) {
                    present = true;
                    filtered.push(entry);
                }
                else if (left == name) {
                    filtered.push(entry);
                    present = false;
                }
                else if (entry.role == "ark" && entry.name == name) {
                    present = true;
                    filtered.push(entry);
                }
                else if (present) {
                    filtered.push(entry);
                }
            }
            if (filtered.length == 0) {
                continue;
            }
            const arkParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, name);
            if (arkParams.memory.allowWrite == false) {
                continue;
            }
            jobs.push({ params: arkParams, block: filtered });
        }
        if (jobs.length == 0) {
            return;
        }
        params.handler.streamInfo("Memorizing old block...");
        for (const job of jobs) {
            await memorizeBlock(job.params, job.block);
        }
    }
    MemoryUtil.onBlock = onBlock;
    async function memorizeBlock(params, block) {
        const { start, end } = getTimeRange(params, block);
        const cataloguePath = NodeUtil.getPath(arksPath, params.process.arkName, "catalogue.json");
        const { year, month, day, padded } = await LibraryUtil.nextParts(cataloguePath);
        const name = `${year}-${month}-${day}-${padded}`;
        const fields = {
            short: { name: "Short", description: "one line summary" },
            tags: { name: "Tags", description: "comma separated tags", value: "missing tag list" },
            weight: { name: "Weight", description: "importance from 0 to 10", value: "5" },
            content: { description: "the memory paragraph" }
        };
        const result = await GenerateUtil.generateMemory(params, block, fields);
        if (result == null) {
            params.handler.streamInfo("Memory produced no content.");
            return;
        }
        const content = result.content.trim();
        if (content == "") {
            params.handler.streamInfo("Memory produced no content.");
            return;
        }
        const short = result.short || TextUtil.shortifyLineNicely(content, 200);
        const weight = parseFloat(result.weight) || 5;
        const entry = { source: params.chatID, short, start, end, weight };
        await addMemoryEntry(params.process.arkName, name, content, entry);
        params.handler.streamRaw("\n");
    }
    MemoryUtil.memorizeBlock = memorizeBlock;
    async function loadMemories(params, context, useActives) {
        if (params.memory.allowRead == false) {
            return null;
        }
        const cataloguePath = NodeUtil.getPath(arksPath, params.process.arkName, "catalogue.json");
        const memory = await LibraryUtil.readEntries(cataloguePath);
        const actives = [];
        const entries = [];
        const names = new Map();
        for (const name in memory) {
            if (name == `active-${params.chatID}`) {
            }
            else if (name.startsWith("active")) {
                actives.push(name);
            }
            else {
                const entry = memory[name];
                entries.push(entry);
                names.set(entry, name);
            }
        }
        const activeNames = [];
        const activeContents = {};
        const activeTemplate = { ...ContextUtil.minimalTemplate, lineCount: params.memory.activeLines, lineLength: params.memory.activeLength };
        const activeCount = Math.max(0, Math.floor(params.memory.activeLimit));
        const recent = activeCount ? actives.slice(-activeCount) : [];
        for (const name of recent) {
            const entry = memory[name];
            const sourceContext = await ContextUtil.loadActive(entry.source);
            const content = ContextUtil.contextToText(sourceContext ?? [], activeTemplate, params.memory.activeEntries);
            if (content.trim() == "") {
                if (params.memory.allowWrite) {
                    await removeMemoryEntry(params.process.arkName, name);
                }
            }
            else {
                activeNames.push(name);
                activeContents[name] = content;
            }
        }
        const selection = TopicMatcher.selectMemoriesFor(context, entries, params.memory.shortLimit, params.memory.longLimit);
        const lines = [];
        if (selection.shorts.length) {
            lines.push("Other memories:\n");
            for (const entry of selection.shorts) {
                const date = DateUtil.toLocalDate(entry.start);
                lines.push(`${date} – ${entry.short}`);
            }
            lines.push("");
        }
        for (const entry of selection.expanded) {
            const name = names.get(entry);
            const start = DateUtil.toLocalFull(entry.start);
            const end = DateUtil.toLocalFull(entry.end);
            const path = NodeUtil.getPath(arksPath, params.process.arkName, "Memories", `${name}.txt`);
            const content = await FileUtil.readTextLocked(path) ?? "";
            lines.push(`Memory from ${entry.source} at ${start} to ${end}:\n\n${content}\n`);
        }
        if (useActives) {
            for (const name of activeNames) {
                const entry = memory[name];
                const content = activeContents[name];
                lines.push(`Active memory from ${entry.source}:\n\n${content}\n`);
            }
        }
        return lines.join("\n").trim();
    }
    MemoryUtil.loadMemories = loadMemories;
    async function loadShortMemories(arkName, context, limit) {
        const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
        const memory = await LibraryUtil.readEntries(cataloguePath);
        const entries = [];
        for (const name in memory) {
            if (name.startsWith("active")) {
                continue;
            }
            entries.push(memory[name]);
        }
        const selection = TopicMatcher.selectMemoriesFor(context, entries);
        const result = [];
        const start = Math.max(0, selection.shorts.length - Math.max(0, Math.floor(limit)));
        for (let index = start; index < selection.shorts.length; ++index) {
            const short = selection.shorts[index].short?.trim();
            if (short) {
                result.push(short);
            }
        }
        return result;
    }
    MemoryUtil.loadShortMemories = loadShortMemories;
    async function addMemoryEntry(arkName, name, content, entry) {
        const memoriesPath = NodeUtil.getPath(arksPath, arkName, "Memories");
        await NodeUtil.makeDirPromise(memoriesPath, { recursive: true });
        const memoryPath = NodeUtil.getPath(memoriesPath, `${name}.txt`);
        await FileUtil.writeTextLocked(memoryPath, content);
        const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
        await LibraryUtil.setEntry(cataloguePath, name, entry);
    }
    async function saveMemory(arkName, content, entry) {
        const { year, month, day, padded } = await LibraryUtil.nextParts(cataloguePath(arkName));
        const name = `${year}-${month}-${day}-${padded}`;
        await addMemoryEntry(arkName, name, content, entry);
        return name;
    }
    MemoryUtil.saveMemory = saveMemory;
    async function createMemory(arkName) {
        const { year, month, day, time, padded } = await LibraryUtil.nextParts(cataloguePath(arkName));
        const name = `${year}-${month}-${day}-${padded}`;
        const entry = { source: "manual", short: "", start: time, end: time, weight: 1 };
        await addMemoryEntry(arkName, name, "", entry);
        return name;
    }
    MemoryUtil.createMemory = createMemory;
    async function removeMemory(arkName, name) {
        await removeMemoryEntry(arkName, name);
        return name;
    }
    MemoryUtil.removeMemory = removeMemory;
    async function removeMemoryEntry(arkName, name) {
        try {
            const path = NodeUtil.getPath(arksPath, arkName, "Memories", `${name}.txt`);
            await NodeUtil.removePromise(path);
        }
        catch {
        }
        const cataloguePath = NodeUtil.getPath(arksPath, arkName, "catalogue.json");
        await LibraryUtil.removeEntry(cataloguePath, name);
    }
    async function listMemories(arkName) {
        const entries = await LibraryUtil.readEntries(cataloguePath(arkName));
        const result = [];
        for (const name in entries) {
            result.push(name);
        }
        result.sort((a, b) => a < b ? -1 : 1);
        return result;
    }
    MemoryUtil.listMemories = listMemories;
    async function readCatalogueEntry(arkName, name) {
        return LibraryUtil.getEntry(cataloguePath(arkName), name);
    }
    MemoryUtil.readCatalogueEntry = readCatalogueEntry;
    async function writeCatalogueEntry(arkName, name, entry) {
        await LibraryUtil.setEntry(cataloguePath(arkName), name, entry);
        return entry;
    }
    MemoryUtil.writeCatalogueEntry = writeCatalogueEntry;
    async function readMemoryFile(arkName, name) {
        return FileUtil.readTextLocked(memoryPath(arkName, name));
    }
    MemoryUtil.readMemoryFile = readMemoryFile;
    async function writeMemoryFile(arkName, name, content) {
        await NodeUtil.makeDirPromise(NodeUtil.getPath(arksPath, arkName, "Memories"), { recursive: true });
        await FileUtil.writeTextLocked(memoryPath(arkName, name), content);
        return content;
    }
    MemoryUtil.writeMemoryFile = writeMemoryFile;
    function cataloguePath(arkName) {
        return NodeUtil.getPath(arksPath, arkName, "catalogue.json");
    }
    function memoryPath(arkName, name) {
        return NodeUtil.getPath(arksPath, arkName, "Memories", `${name}.txt`);
    }
})(MemoryUtil || (MemoryUtil = {}));
var WebService;
(function (WebService) {
    const adapters = {
        "default": OllamaAdapter,
        "ollama": OllamaAdapter
    };
    async function search(params, query) {
        const adapter = adapters[params.APIType] ?? adapters["default"];
        const headers = { Authorization: `Bearer ${params.APIKey}`, ...CTJSON };
        const input = adapter.createSearchRequestBody(params, query);
        const data = await fetchData(`${params.APIHost}/web_search`, "POST", headers, input);
        const results = adapter.processSearchResponseData(params, data);
        return formatSearchResult(results, params.maxLength);
    }
    WebService.search = search;
    function formatSearchResult(results, maxLength) {
        return results.map((result) => {
            const cleaned = TextUtil.normalizeAll(result.content);
            const shortened = TextUtil.shortifyLineNicely(cleaned, maxLength);
            return `Title: ${result.title}\nLink: ${result.url}\nContent:\n${shortened}`;
        }).join("\n\n");
    }
    async function fetch(params, url) {
        const adapter = adapters[params.APIType] ?? adapters["default"];
        const headers = { Authorization: `Bearer ${params.APIKey}`, ...CTJSON };
        const input = adapter.createFetchRequestBody(params, url);
        const data = await fetchData(`${params.APIHost}/web_fetch`, "POST", headers, input);
        const results = adapter.processFetchResponseData(params, data);
        return formatFetchResult(results, params.maxLength);
    }
    WebService.fetch = fetch;
    function formatFetchResult(result, maxLength) {
        const cleaned = TextUtil.normalizeAll(result.content);
        const shortened = TextUtil.shortifyLineNicely(cleaned, maxLength);
        const links = result.links.join("\n");
        return `Title: ${result.title}\nContent:\n${shortened}\nLinks:\n${links}`;
    }
})(WebService || (WebService = {}));
var WebWorkshop;
(function (WebWorkshop) {
    WebWorkshop.rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Web");
    WebWorkshop.settingsPath = NodeUtil.getPath(WebWorkshop.rootPath, "settings.json");
    WebWorkshop.defaultWebSettings = {
        enabled: true,
        APIType: "ollama",
        APIHost: "https://ollama.com/api",
        APIKey: ""
    };
    function getActions(params) {
        if (params.web.enabled) {
            return {
                web: {
                    fetch: fetchAction,
                    search: searchAction,
                    "wide-search": wideSearchAction,
                    "deep-search": deepSearchAction
                }
            };
        }
        return {};
    }
    WebWorkshop.getActions = getActions;
    async function initialize() {
        await NodeUtil.makeDirPromise(WebWorkshop.rootPath, { recursive: true });
        await ensureSettings();
    }
    WebWorkshop.initialize = initialize;
    async function ensureSettings() {
        await SettingsUtil.ensure(WebWorkshop.settingsPath, WebWorkshop.defaultWebSettings);
    }
    WebWorkshop.ensureSettings = ensureSettings;
    async function readSettings() {
        return SettingsUtil.read(WebWorkshop.settingsPath, WebWorkshop.defaultWebSettings);
    }
    WebWorkshop.readSettings = readSettings;
    async function editSettings(overrides) {
        return SettingsUtil.edit(WebWorkshop.settingsPath, overrides, WebWorkshop.defaultWebSettings);
    }
    WebWorkshop.editSettings = editSettings;
    async function getPromptParts(params) {
        if (params.web.enabled == false) {
            return [];
        }
        return [{
                variable: "ACTIONS",
                description: "Web actions",
                content: `Web Actions:
Fetch info from the internet:
@web-fetch <url>
Search on the internet:
@web-search <query>
For many short search results:
@web-wide-search <query>
For many long search results:
@web-deep-search <query>`
            }];
    }
    WebWorkshop.getPromptParts = getPromptParts;
    async function fetchAction(params, entry, args) {
        return WebService.fetch({ ...params.web, maxLength: 8000 }, args);
    }
    WebWorkshop.fetchAction = fetchAction;
    async function searchAction(params, entry, args) {
        return WebService.search({ ...params.web, maxCount: 8, maxLength: 2000 }, args);
    }
    WebWorkshop.searchAction = searchAction;
    async function wideSearchAction(params, entry, args) {
        return WebService.search({ ...params.web, maxCount: 32, maxLength: 500 }, args);
    }
    WebWorkshop.wideSearchAction = wideSearchAction;
    async function deepSearchAction(params, entry, args) {
        return WebService.search({ ...params.web, maxCount: 32, maxLength: 5000 }, args);
    }
    WebWorkshop.deepSearchAction = deepSearchAction;
})(WebWorkshop || (WebWorkshop = {}));
var ImageWorkshop;
(function (ImageWorkshop) {
    ImageWorkshop.rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Images");
    ImageWorkshop.settingsPath = NodeUtil.getPath(ImageWorkshop.rootPath, "settings.json");
    ImageWorkshop.cataloguePath = NodeUtil.getPath(ImageWorkshop.rootPath, "catalogue.json");
    ImageWorkshop.storagePath = NodeUtil.getPath(ImageWorkshop.rootPath, "Images");
    ImageWorkshop.defaultSettings = {
        enabled: true,
        upload: "describe",
        prompt: "Describe this image, plain text, no formatting.\nUse this template:\n\nTitle: [short title]\nShort: [one line summary]\n[detailed description]",
        convertLargeCommand: "",
        convertSmallCommand: ""
    };
    function getActions(params) {
        if (params.image.enabled) {
            return {
                image: {
                    list: listAction,
                    search: searchAction,
                    view: viewAction
                }
            };
        }
        return {};
    }
    ImageWorkshop.getActions = getActions;
    async function initialize() {
        const commands = await detectCommands();
        await LibraryUtil.ensure(ImageWorkshop.rootPath, { ...ImageWorkshop.defaultSettings, ...commands });
        await WorkshopUtil.scheduleEvery("image-main", "1d");
    }
    ImageWorkshop.initialize = initialize;
    async function readSettings() {
        return SettingsUtil.read(ImageWorkshop.settingsPath, ImageWorkshop.defaultSettings);
    }
    ImageWorkshop.readSettings = readSettings;
    async function editSettings(overrides) {
        return SettingsUtil.edit(ImageWorkshop.settingsPath, overrides, ImageWorkshop.defaultSettings);
    }
    ImageWorkshop.editSettings = editSettings;
    async function getPromptParts(params) {
        if (params.image.enabled == false) {
            return [];
        }
        return [{
                variable: "ACTIONS",
                description: "Image actions",
                content: `Image Actions:
List stored images:
@image-list
Search images by words:
@image-search <words>
View an image by name:
@image-view <name>`
            }];
    }
    ImageWorkshop.getPromptParts = getPromptParts;
    async function listAction(params, entry, args) {
        const catalogueData = await LibraryUtil.readEntries(ImageWorkshop.cataloguePath);
        const parts = [];
        for (const key in catalogueData) {
            const entry = catalogueData[key];
            parts.push(`image: ${key} description: ${entry.short}`);
        }
        const content = parts.join("\n");
        return { type: "message", time: Date.now(), role: "env", name: "images-list", content };
    }
    ImageWorkshop.listAction = listAction;
    async function searchAction(params, entry, args) {
        return null;
    }
    ImageWorkshop.searchAction = searchAction;
    async function viewAction(params, entry, args) {
        const name = args.trim();
        let key = name;
        let item = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
        if (item == null) {
            key = ImageWorkshop.parseFileName(name).name;
            item = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, key);
        }
        if (item) {
            return { type: "image", name: `${key}.original.${item.ext}`, content: item.long };
        }
        return { type: "message", time: Date.now(), role: "env", name: "image-read", content: "missing image" };
    }
    ImageWorkshop.viewAction = viewAction;
    async function readImage(name) {
        const entry = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
        if (entry) {
            return readRAW(name, entry.ext);
        }
        return null;
    }
    ImageWorkshop.readImage = readImage;
    async function readRAW(name, ext) {
        if (ext == null) {
            return null;
        }
        const files = getFileNames(name, ext);
        try {
            const path = NodeUtil.getPath(ImageWorkshop.storagePath, files.large);
            const data = await NodeUtil.readFilePromise(path);
            return data.toString("base64");
        }
        catch {
        }
        try {
            const path = NodeUtil.getPath(ImageWorkshop.storagePath, files.original);
            const data = await NodeUtil.readFilePromise(path);
            return data.toString("base64");
        }
        catch {
        }
        return null;
    }
    ImageWorkshop.readRAW = readRAW;
    async function onWakeUp(params) {
        const settings = await readSettings();
        if (settings.enabled) {
        }
    }
    ImageWorkshop.onWakeUp = onWakeUp;
    async function processImage(params, entry) {
        const settings = await readSettings();
        const { ext, data } = parseContent(entry.content);
        if (settings.upload == "raw") {
            return { ...entry, content: data };
        }
        const parts = await LibraryUtil.nextParts(ImageWorkshop.cataloguePath);
        const name = `${parts.year}-${parts.month}-${parts.day}-${parts.padded}`;
        const time = parts.time;
        if (settings.upload == "save") {
            const short = "An uploaded image.";
            const long = "An uploaded image.";
            await saveImage(name, ext, data);
            await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, name, { time, ext, short, long });
            return { type: "image", name: `${name}.original.${ext}`, content: long };
        }
        params.handler.streamInfo("Describing image:");
        const { title, short, long } = await describeContent(params, data);
        const base = `${name}-${title}`;
        await saveImage(base, ext, data);
        await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, base, { time, ext, title, short, long });
        return { type: "image", name: `${base}.original.${ext}`, content: long };
    }
    ImageWorkshop.processImage = processImage;
    async function convertArkImage(params, entry, template, needsImage) {
        if (entry.name == "raw") {
            if (needsImage) {
                return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template), images: [entry.content] };
            }
            return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template) };
        }
        if (needsImage) {
            const file = ImageWorkshop.parseFileName(entry.name);
            const ext = file.ext ?? (await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, file.name))?.ext;
            const image = await readRAW(file.name, ext);
            if (image) {
                return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template), images: [image] };
            }
        }
        return { role: "user", content: ContextUtil.entryToText(entry, template) };
    }
    ImageWorkshop.convertArkImage = convertArkImage;
    function parseContent(content) {
        const match = content.match(/^ext=([^\n]+)\ndata=([\s\S]+)/);
        if (match) {
            return { ext: match[1], data: match[2] };
        }
        return { ext: "png", data: content };
    }
    ImageWorkshop.parseContent = parseContent;
    function detectExt(data) {
        if (data.startsWith("/9j/")) {
            return "jpeg";
        }
        if (data.startsWith("iVBOR")) {
            return "png";
        }
        if (data.startsWith("R0lGOD")) {
            return "gif";
        }
        if (data.startsWith("UklGR")) {
            return "webp";
        }
        return "png";
    }
    ImageWorkshop.detectExt = detectExt;
    function getFileNames(name, ext) {
        return {
            original: `${name}.original.${ext}`,
            large: `${name}.large.${ext}`,
            small: `${name}.small.${ext}`
        };
    }
    ImageWorkshop.getFileNames = getFileNames;
    async function saveImage(name, ext, data) {
        const settings = await readSettings();
        await NodeUtil.makeDirPromise(ImageWorkshop.storagePath, { recursive: true });
        const files = getFileNames(name, ext);
        const originalPath = NodeUtil.getPath(ImageWorkshop.storagePath, files.original);
        await NodeUtil.writeFilePromise(originalPath, Buffer.from(data, "base64"));
        if (settings.convertLargeCommand) {
            const largePath = NodeUtil.getPath(ImageWorkshop.storagePath, files.large);
            await convertImage(settings.convertLargeCommand, originalPath, largePath);
        }
        if (settings.convertSmallCommand) {
            const smallPath = NodeUtil.getPath(ImageWorkshop.storagePath, files.small);
            await convertImage(settings.convertSmallCommand, originalPath, smallPath);
        }
        return files;
    }
    ImageWorkshop.saveImage = saveImage;
    async function describeImage(params, name, ext) {
        const image = await readRAW(name, ext);
        if (image == null) {
            return null;
        }
        const entry = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
        const described = await describeContent(params, image);
        await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, name, { ...entry, title: described.title, short: described.short, long: described.long });
        return described.short;
    }
    ImageWorkshop.describeImage = describeImage;
    async function summarizeImage(params, name) {
        const entry = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
        if (entry == null) {
            return null;
        }
        const image = await readRAW(name, entry.ext);
        if (image == null) {
            return null;
        }
        const described = await describeContent(params, image);
        const result = { ...entry, title: described.title, short: described.short, long: described.long };
        const newName = LibraryUtil.buildName(entry.time, described.title);
        if (newName != name && await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, newName) == null) {
            await moveEntryFiles(name, newName, entry.ext);
            await LibraryUtil.removeEntry(ImageWorkshop.cataloguePath, name);
            await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, newName, result);
            return result;
        }
        await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, name, result);
        return result;
    }
    ImageWorkshop.summarizeImage = summarizeImage;
    async function describeContent(params, data) {
        const values = await generateDescription(params, data);
        const title = resolveName(values.title) || "Untitled";
        const short = values.short || "An uploaded image.";
        const long = values.long.trim();
        return { title, short, long };
    }
    ImageWorkshop.describeContent = describeContent;
    function parseFileName(fileName) {
        const dot = (fileName ?? "").lastIndexOf(".");
        if (dot < 0) {
            return { name: fileName, ext: null };
        }
        const ext = fileName.slice(dot + 1);
        const base = fileName.slice(0, dot);
        const variant = base.match(/^(.*)\.(original|large|small)$/);
        if (variant) {
            return { name: variant[1], ext };
        }
        return { name: base, ext };
    }
    ImageWorkshop.parseFileName = parseFileName;
    function resolveName(name) {
        const words = (name ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const joined = words.join("-");
        if (joined.length <= 80) {
            return joined;
        }
        const cut = joined.slice(0, 80);
        const lastDash = cut.lastIndexOf("-");
        return lastDash < 0 ? cut : cut.slice(0, lastDash);
    }
    ImageWorkshop.resolveName = resolveName;
    async function generateDescription(params, data) {
        const prompt = params.image.prompt;
        const context = [{ role: "user", images: [data] }];
        const model = ModelUtil.resolve(params, params.generate.visionModel);
        const fields = {
            title: { name: "Title", description: "short title" },
            short: { name: "Short", description: "one line summary" },
            long: { name: null, description: "detailed description of the image" }
        };
        return GenerateUtil.generateFields(params, model, prompt, context, fields);
    }
    ImageWorkshop.generateDescription = generateDescription;
    async function describeEntry(entry, template) {
        return ContextUtil.entryToText(entry, template);
    }
    ImageWorkshop.describeEntry = describeEntry;
    async function detectCommands() {
        if (await NodeUtil.executeProcess("sips", "", "--help")) {
            return {
                convertLargeCommand: "sips -Z 1536 {{input}} --out {{output}}",
                convertSmallCommand: "sips -Z 768 {{input}} --out {{output}}"
            };
        }
        if (await NodeUtil.executeProcess("ffmpeg", "", "-version")) {
            return {
                convertLargeCommand: "ffmpeg -i {{input}} -vf scale=1536:1536:force_original_aspect_ratio=decrease {{output}}",
                convertSmallCommand: "ffmpeg -i {{input}} -vf scale=768:768:force_original_aspect_ratio=decrease {{output}}"
            };
        }
        if (await NodeUtil.executeProcess("magick", "", "-version")) {
            return {
                convertLargeCommand: "magick {{input}} -resize 1536x1536 {{output}}",
                convertSmallCommand: "magick {{input}} -resize 768x768 {{output}}"
            };
        }
        return {
            convertLargeCommand: null,
            convertSmallCommand: null
        };
    }
    ImageWorkshop.detectCommands = detectCommands;
    async function convertImage(command, inputPath, outputPath) {
        const args = [];
        for (const part of command.split(" ")) {
            args.push(part
                .replace("{{input}}", inputPath)
                .replace("{{output}}", outputPath));
        }
        await NodeUtil.executeProcess(args[0], "", ...args.slice(1));
    }
    ImageWorkshop.convertImage = convertImage;
    async function listImages() {
        const catalogueData = await LibraryUtil.readEntries(ImageWorkshop.cataloguePath);
        const result = [];
        for (const name in catalogueData) {
            result.push(name);
        }
        result.sort();
        return result;
    }
    ImageWorkshop.listImages = listImages;
    async function readCatalogueEntry(name) {
        return LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
    }
    ImageWorkshop.readCatalogueEntry = readCatalogueEntry;
    async function writeCatalogueEntry(name, entry) {
        await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, name, entry);
        return entry;
    }
    ImageWorkshop.writeCatalogueEntry = writeCatalogueEntry;
    async function saveUpload(ext, data) {
        const { year, month, day, time, padded } = await LibraryUtil.nextParts(ImageWorkshop.cataloguePath);
        const name = `${year}-${month}-${day}-${padded}`;
        await saveImage(name, ext, data);
        await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, name, { time, ext, title: "", short: "", long: "" });
        return name;
    }
    ImageWorkshop.saveUpload = saveUpload;
    async function uploadImage(ext, data) {
        const name = await ImageWorkshop.saveUpload(ext, data);
        return LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
    }
    ImageWorkshop.uploadImage = uploadImage;
    async function renameImage(oldName, newName) {
        const entry = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, oldName);
        if (entry == null) {
            return null;
        }
        const name = LibraryUtil.buildName(entry.time, newName);
        if (name != oldName && await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name)) {
            return null;
        }
        await moveEntryFiles(oldName, name, entry.ext);
        await LibraryUtil.removeEntry(ImageWorkshop.cataloguePath, oldName);
        await LibraryUtil.setEntry(ImageWorkshop.cataloguePath, name, entry);
        return name;
    }
    ImageWorkshop.renameImage = renameImage;
    async function moveEntryFiles(oldName, newName, ext) {
        const oldFiles = getFileNames(oldName, ext);
        const newFiles = getFileNames(newName, ext);
        await moveFile(oldFiles.original, newFiles.original);
        await moveFile(oldFiles.large, newFiles.large);
        await moveFile(oldFiles.small, newFiles.small);
    }
    async function removeImage(name) {
        const entry = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
        const files = getFileNames(name, entry.ext);
        await removeFile(files.original);
        await removeFile(files.large);
        await removeFile(files.small);
        await LibraryUtil.removeEntry(ImageWorkshop.cataloguePath, name);
        return name;
    }
    ImageWorkshop.removeImage = removeImage;
    async function moveFile(from, to) {
        try {
            await NodeUtil.renamePromise(NodeUtil.getPath(ImageWorkshop.storagePath, from), NodeUtil.getPath(ImageWorkshop.storagePath, to));
        }
        catch {
        }
    }
    ImageWorkshop.moveFile = moveFile;
    async function removeFile(file) {
        try {
            await NodeUtil.removePromise(NodeUtil.getPath(ImageWorkshop.storagePath, file));
        }
        catch {
        }
    }
    ImageWorkshop.removeFile = removeFile;
})(ImageWorkshop || (ImageWorkshop = {}));
var DocumentWorkshop;
(function (DocumentWorkshop) {
    DocumentWorkshop.rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Documents");
    DocumentWorkshop.settingsPath = NodeUtil.getPath(DocumentWorkshop.rootPath, "settings.json");
    DocumentWorkshop.cataloguePath = NodeUtil.getPath(DocumentWorkshop.rootPath, "catalogue.json");
    DocumentWorkshop.storagePath = NodeUtil.getPath(DocumentWorkshop.rootPath, "Documents");
    DocumentWorkshop.defaultSettings = {
        enabled: true,
        upload: "describe",
        prompt: "Describe this document, plain text, no formatting.\nUse this template:\n\nTitle: [short title]\nShort: [one line summary]\n[detailed description]",
        rawCount: 3,
        rawLines: 10,
        rawLength: 200
    };
    function getActions(params) {
        if (params.document.enabled) {
            return {
                document: {
                    list: listAction,
                    search: searchAction,
                    read: readAction
                }
            };
        }
        return {};
    }
    DocumentWorkshop.getActions = getActions;
    async function initialize() {
        await LibraryUtil.ensure(DocumentWorkshop.rootPath, DocumentWorkshop.defaultSettings);
        await WorkshopUtil.scheduleEvery("document-main", "1h");
    }
    DocumentWorkshop.initialize = initialize;
    async function readSettings() {
        return SettingsUtil.read(DocumentWorkshop.settingsPath, DocumentWorkshop.defaultSettings);
    }
    DocumentWorkshop.readSettings = readSettings;
    async function editSettings(overrides) {
        return SettingsUtil.edit(DocumentWorkshop.settingsPath, overrides, DocumentWorkshop.defaultSettings);
    }
    DocumentWorkshop.editSettings = editSettings;
    async function getPromptParts(params) {
        if (params.document.enabled == false) {
            return [];
        }
        return [{
                variable: "ACTIONS",
                description: "Document actions",
                content: `Document Actions:
List stored documents:
@document-list
Search documents by words:
@document-search <words>
Read a document by name:
@document-read <name>`
            }];
    }
    DocumentWorkshop.getPromptParts = getPromptParts;
    async function listAction(params, entry, args) {
        const catalogueData = await LibraryUtil.readEntries(DocumentWorkshop.cataloguePath);
        const parts = [];
        for (const key in catalogueData) {
            const entry = catalogueData[key];
            parts.push(`document: ${key} short: ${entry.short}`);
        }
        const content = parts.join("\n");
        return { type: "message", time: Date.now(), role: "env", name: "documents-list", content };
    }
    DocumentWorkshop.listAction = listAction;
    async function searchAction(params, entry, args) {
        return null;
    }
    DocumentWorkshop.searchAction = searchAction;
    async function readAction(params, entry, args) {
        const name = args.trim();
        let key = name;
        let item = await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, name);
        if (item == null) {
            key = DocumentWorkshop.parseFileName(name).name;
            item = await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, key);
        }
        if (item) {
            return { type: "document", name: `${key}.${item.ext}`, content: item.long };
        }
        return { type: "message", time: Date.now(), role: "env", name: "document-read", content: "missing document" };
    }
    DocumentWorkshop.readAction = readAction;
    async function readDocument(name, ext = null) {
        if (ext == null) {
            const entry = await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, name);
            if (entry == null) {
                return null;
            }
            ext = entry.ext;
        }
        const documentPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${ext}`);
        return FileUtil.readTextLocked(documentPath);
    }
    DocumentWorkshop.readDocument = readDocument;
    async function summarizeDocument(params, name) {
        const entry = await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, name);
        if (entry == null) {
            return null;
        }
        const documentPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${entry.ext}`);
        const data = await FileUtil.readTextLocked(documentPath);
        if (data == null) {
            return null;
        }
        const { title, short, long } = await DocumentWorkshop.describeContent(params, data);
        const result = { ...entry, title, short, long };
        const newName = LibraryUtil.buildName(entry.time, title);
        if (newName != name && await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, newName) == null) {
            const newPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${newName}.${entry.ext}`);
            await NodeUtil.renamePromise(documentPath, newPath);
            await LibraryUtil.removeEntry(DocumentWorkshop.cataloguePath, name);
            await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, newName, result);
            return result;
        }
        await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, result);
        return result;
    }
    DocumentWorkshop.summarizeDocument = summarizeDocument;
    async function onWakeUp(params) {
        const settings = await DocumentWorkshop.readSettings();
        if (settings.enabled) {
        }
    }
    DocumentWorkshop.onWakeUp = onWakeUp;
    async function processDocument(params, entry) {
        const settings = await DocumentWorkshop.readSettings();
        const { ext, data } = DocumentWorkshop.parseContent(entry.content);
        if (settings.upload == "raw") {
            return { ...entry, content: data };
        }
        const parts = await LibraryUtil.nextParts(DocumentWorkshop.cataloguePath);
        const name = `${parts.year}-${parts.month}-${parts.day}-${parts.padded}`;
        const time = parts.time;
        if (settings.upload == "save") {
            const long = TextUtil.shortifyTextNicely(data, settings.rawLines, settings.rawLength);
            const short = "An uploaded document.";
            await DocumentWorkshop.saveDocument(name, ext, data);
            await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { time, ext, short, long });
            return { type: "document", name: `${name}.${ext}`, content: long };
        }
        params.handler.streamInfo("Describing document:");
        const { title, short, long } = await describeContent(params, data);
        const base = `${name}-${title}`;
        await DocumentWorkshop.saveDocument(base, ext, data);
        await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, base, { time, ext, title, short, long });
        return { type: "document", name: `${base}.${ext}`, content: long };
    }
    DocumentWorkshop.processDocument = processDocument;
    async function convertArkDocument(params, entry, template, needsDocument) {
        if (entry.name == "raw") {
            if (needsDocument) {
                return { role: "user", content: ContextUtil.entryToText(entry, template) };
            }
            return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template) };
        }
        let content = entry.content;
        if (needsDocument) {
            const file = DocumentWorkshop.parseFileName(entry.name);
            const full = await DocumentWorkshop.readDocument(file.name, file.ext);
            if (full != null) {
                content = full;
            }
        }
        return { role: "user", content: ContextUtil.entryToText({ ...entry, content }, template) };
    }
    DocumentWorkshop.convertArkDocument = convertArkDocument;
    function parseContent(content) {
        const match = content.match(/^ext=([^\n]+)\ndata=([\s\S]+)/);
        if (match) {
            return { ext: match[1], data: match[2] };
        }
        return { ext: "txt", data: content };
    }
    DocumentWorkshop.parseContent = parseContent;
    async function saveDocument(name, ext, data) {
        await NodeUtil.makeDirPromise(DocumentWorkshop.storagePath, { recursive: true });
        const documentPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${ext}`);
        await FileUtil.writeTextLocked(documentPath, data);
    }
    DocumentWorkshop.saveDocument = saveDocument;
    async function describeContent(params, data) {
        const values = await DocumentWorkshop.generateDescription(params, data);
        const title = resolveName(values.title) || "Untitled";
        const short = values.short || "An uploaded document.";
        const long = values.long.trim();
        return { title, short, long };
    }
    DocumentWorkshop.describeContent = describeContent;
    function parseFileName(fileName) {
        const dot = (fileName ?? "").lastIndexOf(".");
        if (dot < 0) {
            return { name: fileName, ext: null };
        }
        return { name: fileName.slice(0, dot), ext: fileName.slice(dot + 1) };
    }
    DocumentWorkshop.parseFileName = parseFileName;
    function resolveName(name) {
        const words = (name ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const joined = words.join("-");
        if (joined.length <= 80) {
            return joined;
        }
        const cut = joined.slice(0, 80);
        const lastDash = cut.lastIndexOf("-");
        return lastDash < 0 ? cut : cut.slice(0, lastDash);
    }
    DocumentWorkshop.resolveName = resolveName;
    async function generateDescription(params, data) {
        const prompt = params.document.prompt;
        const context = [{ role: "user", content: data }];
        const model = ModelUtil.resolve(params, params.generate.smallModel);
        const fields = {
            title: { name: "Title", description: "short title" },
            short: { name: "Short", description: "one line summary" },
            long: { name: null, description: "detailed description of the document" }
        };
        return GenerateUtil.generateFields(params, model, prompt, context, fields);
    }
    DocumentWorkshop.generateDescription = generateDescription;
    async function listDocuments() {
        const catalogueData = await LibraryUtil.readEntries(DocumentWorkshop.cataloguePath);
        const result = [];
        for (const name in catalogueData) {
            result.push({ name, ext: catalogueData[name].ext ?? "md" });
        }
        result.sort((a, b) => a.name < b.name ? -1 : 1);
        return result;
    }
    DocumentWorkshop.listDocuments = listDocuments;
    async function readCatalogueEntry(name) {
        return LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, name);
    }
    DocumentWorkshop.readCatalogueEntry = readCatalogueEntry;
    async function writeCatalogueEntry(name, entry) {
        await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, entry);
        return entry;
    }
    DocumentWorkshop.writeCatalogueEntry = writeCatalogueEntry;
    async function writeDocument(name, ext, content) {
        await DocumentWorkshop.saveDocument(name, ext, content);
        return content;
    }
    DocumentWorkshop.writeDocument = writeDocument;
    async function createDocument() {
        const { year, month, day, time, padded } = await LibraryUtil.nextParts(DocumentWorkshop.cataloguePath);
        const name = `${year}-${month}-${day}-${padded}`;
        const ext = "md";
        await DocumentWorkshop.saveDocument(name, ext, "");
        await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { time, ext, short: "", long: "" });
        return { name, ext };
    }
    DocumentWorkshop.createDocument = createDocument;
    async function renameDocument(oldName, newName) {
        const entry = await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, oldName);
        if (entry == null) {
            return null;
        }
        const dot = newName.lastIndexOf(".");
        const typed = dot > 0 ? newName.slice(0, dot) : newName;
        const ext = dot > 0 ? newName.slice(dot + 1) : entry.ext;
        const name = LibraryUtil.buildName(entry.time, typed);
        if (name != oldName && await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, name)) {
            return null;
        }
        const oldPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${oldName}.${entry.ext}`);
        const newPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${ext}`);
        await NodeUtil.renamePromise(oldPath, newPath);
        await LibraryUtil.removeEntry(DocumentWorkshop.cataloguePath, oldName);
        await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { ...entry, ext });
        return { name, ext };
    }
    DocumentWorkshop.renameDocument = renameDocument;
    async function uploadDocument(ext, data) {
        const { year, month, day, time, padded } = await LibraryUtil.nextParts(DocumentWorkshop.cataloguePath);
        const name = `${year}-${month}-${day}-${padded}`;
        await DocumentWorkshop.saveDocument(name, ext, data);
        await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { time, ext, short: "", long: "" });
        return { name, ext };
    }
    DocumentWorkshop.uploadDocument = uploadDocument;
    async function removeDocument(name) {
        const entry = await LibraryUtil.getEntry(DocumentWorkshop.cataloguePath, name);
        if (entry) {
            try {
                await NodeUtil.removePromise(NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${entry.ext}`));
            }
            catch {
            }
        }
        await LibraryUtil.removeEntry(DocumentWorkshop.cataloguePath, name);
        return name;
    }
    DocumentWorkshop.removeDocument = removeDocument;
})(DocumentWorkshop || (DocumentWorkshop = {}));
var TODOWorkshop;
(function (TODOWorkshop) {
    TODOWorkshop.rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/TODOs");
    TODOWorkshop.settingsPath = NodeUtil.getPath(TODOWorkshop.rootPath, "settings.json");
    TODOWorkshop.defaultSettings = {
        enabled: true,
        lastIndex: 0
    };
    function getActions(params) {
        if (params.todo.enabled) {
            return {
                todo: {
                    add: TODOWorkshop.addAction,
                    list: TODOWorkshop.listAction,
                    cats: TODOWorkshop.catsAction,
                    done: TODOWorkshop.doneAction,
                    edit: TODOWorkshop.editAction,
                    remove: TODOWorkshop.removeAction,
                    remind: TODOWorkshop.remindAction,
                    cancel: TODOWorkshop.cancelAction
                }
            };
        }
        return {};
    }
    TODOWorkshop.getActions = getActions;
    async function initialize() {
        await NodeUtil.makeDirPromise(TODOWorkshop.rootPath, { recursive: true });
        await SettingsUtil.ensure(TODOWorkshop.settingsPath, TODOWorkshop.defaultSettings);
    }
    TODOWorkshop.initialize = initialize;
    async function readSettings() {
        return SettingsUtil.read(TODOWorkshop.settingsPath, TODOWorkshop.defaultSettings);
    }
    TODOWorkshop.readSettings = readSettings;
    async function editSettings(overrides) {
        return SettingsUtil.edit(TODOWorkshop.settingsPath, overrides, TODOWorkshop.defaultSettings);
    }
    TODOWorkshop.editSettings = editSettings;
    async function getPromptParts(params) {
        if (params.todo.enabled == false) {
            return [];
        }
        return [{
                variable: "ACTIONS",
                description: "TODO actions",
                content: `TODO Actions:
Create a TODO:
@todo-add [cat=name] [due=when] [repeat=every] <text>
List TODO categories:
@todo-cats
List TODOs:
@todo-list [cat=name] [words]
Mark a TODO done:
@todo-done <id>
Edit a TODO:
@todo-edit <id> [category=name] [due=when] [repeat=every] [text]
Remove a TODO:
@todo-remove <id>
Schedule a reminder:
@todo-remind [time=when] [repeat=every] <message>
Cancel a reminder:
@todo-cancel <id>`
            }];
    }
    TODOWorkshop.getPromptParts = getPromptParts;
    async function addAction(params, entry, args) {
        const fields = { cat: "INBOX", due: null, repeat: null };
        const text = TextUtil.parseMetaFields((args ?? "").trim(), fields);
        if (text) {
            const category = fields.cat;
            const due = fields.due ? TODOWorkshop.parseDue(fields.due) : null;
            const repeat = fields.repeat;
            const todos = await TODOWorkshop.readTodos(category);
            const { year, month, day, padded } = await LibraryUtil.nextParts(TODOWorkshop.settingsPath);
            const id = `${year}-${month}-${day}-${padded}`;
            const todo = { category, text, name: id, due, repeat, done: false };
            todos.push(todo);
            await TODOWorkshop.writeTodos(category, todos);
            return TODOWorkshop.infoEntry(`Created TODO:\n${TODOWorkshop.formatTodo(todo)}`);
        }
        return null;
    }
    TODOWorkshop.addAction = addAction;
    async function listAction(params, entry, args) {
        const fields = { cat: null };
        const text = TextUtil.parseMetaFields((args ?? "").trim(), fields);
        const words = text.toLowerCase().split(/\s+/).filter(Boolean);
        const names = fields.cat ? [fields.cat] : await TODOWorkshop.listCategories();
        const blocks = [];
        for (const name of names) {
            const lines = [];
            for (const todo of await TODOWorkshop.readTodos(name)) {
                if (TODOWorkshop.matchesWords(todo, words)) {
                    lines.push(TODOWorkshop.formatTodo(todo));
                }
            }
            if (lines.length) {
                blocks.push(`${name}:\n${lines.join("\n")}`);
            }
        }
        if (blocks.length == 0) {
            return TODOWorkshop.resultEntry("todo-list", "There are no TODOs.");
        }
        return TODOWorkshop.resultEntry("todo-list", blocks.join("\n\n"));
    }
    TODOWorkshop.listAction = listAction;
    async function catsAction(params, entry, args) {
        const categories = await TODOWorkshop.listCategories();
        if (categories.length == 0) {
            return TODOWorkshop.resultEntry("todo-cats", "There are no categories.");
        }
        return TODOWorkshop.resultEntry("todo-cats", categories.join("\n"));
    }
    TODOWorkshop.catsAction = catsAction;
    async function doneAction(params, entry, args) {
        const id = (args ?? "").trim();
        for (const category of await TODOWorkshop.listCategories()) {
            const todos = await TODOWorkshop.readTodos(category);
            for (const todo of todos) {
                if (todo.name == id) {
                    todo.done = true;
                    if (todo.repeat && todo.due) {
                        todos.push(await TODOWorkshop.repeatTodo(todo));
                    }
                    await TODOWorkshop.writeTodos(category, todos);
                    return TODOWorkshop.infoEntry(`Done TODO:\n${TODOWorkshop.formatTodo(todo)}`);
                }
            }
        }
        return null;
    }
    TODOWorkshop.doneAction = doneAction;
    async function editAction(params, entry, args) {
        const parts = (args ?? "").trim().split(/[ \t]+/);
        const id = parts.shift() ?? "";
        for (const category of await TODOWorkshop.listCategories()) {
            const todos = await TODOWorkshop.readTodos(category);
            for (let index = 0; index < todos.length; ++index) {
                if (todos[index].name == id) {
                    const todo = todos[index];
                    const target = TODOWorkshop.editTodo(todo, parts);
                    if (target && target != category) {
                        todos.splice(index, 1);
                        await TODOWorkshop.writeTodos(category, todos);
                        todo.category = target;
                        const targetTodos = await TODOWorkshop.readTodos(target);
                        targetTodos.push(todo);
                        await TODOWorkshop.writeTodos(target, targetTodos);
                    }
                    else {
                        await TODOWorkshop.writeTodos(category, todos);
                    }
                    return TODOWorkshop.infoEntry(`Edited TODO:\n${TODOWorkshop.formatTodo(todo)}`);
                }
            }
        }
        return null;
    }
    TODOWorkshop.editAction = editAction;
    async function removeAction(params, entry, args) {
        const id = (args ?? "").trim();
        for (const category of await TODOWorkshop.listCategories()) {
            const todos = await TODOWorkshop.readTodos(category);
            for (let index = 0; index < todos.length; ++index) {
                if (todos[index].name == id) {
                    const todo = todos[index];
                    todos.splice(index, 1);
                    await TODOWorkshop.writeTodos(category, todos);
                    return TODOWorkshop.infoEntry(`Removed TODO:\n${TODOWorkshop.formatTodo(todo)}`);
                }
            }
        }
        return null;
    }
    TODOWorkshop.removeAction = removeAction;
    async function cancelAction(params, entry, args) {
        const id = (args ?? "").trim();
        if (id && await WorkshopUtil.removeSchedule(id)) {
            return TODOWorkshop.infoEntry(`Canceled reminder: ${id}`);
        }
        return null;
    }
    TODOWorkshop.cancelAction = cancelAction;
    async function remindAction(params, entry, args) {
        const fields = { time: "1d", repeat: null };
        const content = TextUtil.parseMetaFields((args ?? "").trim(), fields);
        const next = TODOWorkshop.parseDue(fields.time);
        if (params.chatID && content && next) {
            const { year, month, day, padded } = await LibraryUtil.nextParts(TODOWorkshop.settingsPath);
            const id = `${year}-${month}-${day}-${padded}`;
            let line = `Created reminder:\n- ${content} @id=${id} @due=${next}`;
            if (fields.repeat) {
                line += ` @repeat=${fields.repeat}`;
            }
            await WorkshopUtil.scheduleAt(id, next, "onRemind", { chatID: params.chatID, content }, fields.repeat);
            return TODOWorkshop.infoEntry(line);
        }
        return null;
    }
    TODOWorkshop.remindAction = remindAction;
    async function onSchedule(params) {
        const content = await TODOWorkshop.buildDueReport(Date.now());
        if (content) {
            await TODOWorkshop.sendReport(params.chatID, content);
        }
    }
    TODOWorkshop.onSchedule = onSchedule;
    async function onRemind(params) {
        const content = TODOWorkshop.buildContent([params.content], "");
        await TODOWorkshop.sendReport(params.chatID, content);
    }
    TODOWorkshop.onRemind = onRemind;
    async function buildDueReport(now) {
        const today = DateUtil.toLocalDate(now);
        const twoDays = DateUtil.toLocalDate(now + 2 * 86400000);
        const sevenDays = DateUtil.toLocalDate(now + 7 * 86400000);
        const pastDue = [];
        const dueTwo = [];
        const dueSeven = [];
        for (const category of await TODOWorkshop.listCategories()) {
            for (const todo of await TODOWorkshop.readTodos(category)) {
                if (todo.done || todo.due == null) {
                    continue;
                }
                const dueDate = todo.due.slice(0, 10);
                if (dueDate < today) {
                    pastDue.push(todo);
                }
                else if (dueDate <= twoDays) {
                    dueTwo.push(todo);
                }
                else if (dueDate <= sevenDays) {
                    dueSeven.push(todo);
                }
            }
        }
        if (pastDue.length == 0 && dueTwo.length == 0 && dueSeven.length == 0) {
            return "";
        }
        const parts = ["Wake up to scheduled TODO check:"];
        TODOWorkshop.addDueSection(parts, "Past due items:", pastDue);
        TODOWorkshop.addDueSection(parts, "Due in two days:", dueTwo);
        TODOWorkshop.addDueSection(parts, "Due in seven days:", dueSeven);
        return parts.join("\n\n");
    }
    TODOWorkshop.buildDueReport = buildDueReport;
    function addDueSection(parts, title, todos) {
        if (todos.length == 0) {
            return;
        }
        const lines = [title];
        for (const todo of todos) {
            lines.push(TODOWorkshop.formatTodo(todo));
        }
        parts.push(lines.join("\n"));
    }
    TODOWorkshop.addDueSection = addDueSection;
    async function sendReport(chatID, content) {
        const target = await TODOWorkshop.resolveChat(chatID);
        if (target.chatID == null) {
            return;
        }
        const lock = await Mutex.lock(target.chatID);
        try {
            const params = await ParamsUtil.getCombinedParams(target.chatID, new AgoraStreamer(target.chatID, null));
            await ProcessUtil.sendMessage(params, "env", "todo-report", target.notice + content, [], []);
        }
        finally {
            AgoraStreamer.end(target.chatID);
            lock.release();
        }
    }
    TODOWorkshop.sendReport = sendReport;
    async function resolveChat(chatID) {
        if (await ChatUtil.isChatAvailable(chatID)) {
            return { chatID, notice: "" };
        }
        const settings = await TODOWorkshop.readSettings();
        const defaultChat = settings.defaultChat;
        if (await ChatUtil.isChatAvailable(defaultChat)) {
            return { chatID: defaultChat, notice: `Source chat ${chatID} is unavailable, sending here instead:\n` };
        }
        const latestChat = await ChatUtil.latestChat();
        if (latestChat) {
            return { chatID: latestChat, notice: `Source chat ${chatID} and default ${defaultChat} are unavailable, sending here instead:\n` };
        }
        return { chatID: null, notice: "" };
    }
    TODOWorkshop.resolveChat = resolveChat;
    function categoryPath(category) {
        return NodeUtil.getPath(TODOWorkshop.rootPath, `${category.replace(/\W+/g, "-")}.txt`);
    }
    TODOWorkshop.categoryPath = categoryPath;
    function resultEntry(name, content) {
        return { type: "message", time: Date.now(), role: "env", name, content };
    }
    TODOWorkshop.resultEntry = resultEntry;
    function infoEntry(content) {
        return { type: "message", time: Date.now(), role: "info", name: "todo", content };
    }
    TODOWorkshop.infoEntry = infoEntry;
    async function listCategories() {
        const result = [];
        for (const name of await LibraryUtil.listDirectoryEntries(TODOWorkshop.rootPath)) {
            if (name.endsWith(".txt")) {
                result.push(name.slice(0, -4));
            }
        }
        return result;
    }
    TODOWorkshop.listCategories = listCategories;
    async function readCategory(category) {
        return FileUtil.readTextLocked(TODOWorkshop.categoryPath(category));
    }
    TODOWorkshop.readCategory = readCategory;
    async function readTodos(category) {
        const content = await TODOWorkshop.readCategory(category);
        const result = [];
        if (content) {
            for (const line of content.split("\n")) {
                const entry = TODOWorkshop.parseTodo(category, line);
                if (entry) {
                    result.push(entry);
                }
            }
        }
        return result;
    }
    TODOWorkshop.readTodos = readTodos;
    async function writeTodos(category, todos) {
        await NodeUtil.makeDirPromise(TODOWorkshop.rootPath, { recursive: true });
        const lines = [];
        for (const todo of todos) {
            lines.push(TODOWorkshop.formatTodo(todo));
        }
        await FileUtil.writeTextLocked(TODOWorkshop.categoryPath(category), lines.join("\n"));
    }
    TODOWorkshop.writeTodos = writeTodos;
    function parseTodo(category, line) {
        const trimmed = line.trim();
        const done = trimmed.startsWith("+ ");
        if (done || trimmed.startsWith("- ")) {
            const fields = { "@id": null, "@due": null, "@repeat": null };
            const text = TextUtil.parseMetaFields(trimmed.slice(2), fields);
            return { category, text: text.trim(), name: fields["@id"], due: fields["@due"], repeat: fields["@repeat"], done };
        }
        return null;
    }
    TODOWorkshop.parseTodo = parseTodo;
    function formatTodo(todo) {
        let mark = "-";
        if (todo.done) {
            mark = "+";
        }
        let line = `${mark} ${todo.text} @id=${todo.name}`;
        if (todo.due) {
            line += ` @due=${todo.due}`;
        }
        if (todo.repeat) {
            line += ` @repeat=${todo.repeat}`;
        }
        return line;
    }
    TODOWorkshop.formatTodo = formatTodo;
    function matchesWords(todo, words) {
        const text = todo.text.toLowerCase();
        for (const word of words) {
            if (text.includes(word) == false) {
                return false;
            }
        }
        return true;
    }
    TODOWorkshop.matchesWords = matchesWords;
    function editTodo(todo, parts) {
        const fields = {};
        const text = TextUtil.parseMetaFields(parts.join(" "), fields);
        if (text) {
            todo.text = text;
        }
        if (fields.due) {
            todo.due = TODOWorkshop.parseDue(fields.due);
        }
        if (fields.repeat) {
            todo.repeat = fields.repeat;
        }
        return fields.category ?? null;
    }
    TODOWorkshop.editTodo = editTodo;
    async function repeatTodo(todo) {
        const { year, month, day, padded } = await LibraryUtil.nextParts(TODOWorkshop.settingsPath);
        const id = `${year}-${month}-${day}-${padded}`;
        const due = DateUtil.advanceWhen(todo.due, todo.repeat, Date.now());
        return { ...todo, name: id, due, done: false };
    }
    TODOWorkshop.repeatTodo = repeatTodo;
    function parseDue(value) {
        return DateUtil.formatWhen(DateUtil.parseWhen(value));
    }
    TODOWorkshop.parseDue = parseDue;
    function buildReminder(messages) {
        if (messages.length == 0) {
            return "";
        }
        let title = "Wake up to reminders:";
        return [title, ...messages].join("\n");
    }
    TODOWorkshop.buildReminder = buildReminder;
    function buildContent(messages, todos) {
        const reminder = TODOWorkshop.buildReminder(messages);
        const parts = [reminder, todos];
        return parts.filter(part => part).join("\n\n");
    }
    TODOWorkshop.buildContent = buildContent;
})(TODOWorkshop || (TODOWorkshop = {}));
var IdeaWorkshop;
(function (IdeaWorkshop) {
    IdeaWorkshop.rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Ideas");
    IdeaWorkshop.inboxPath = NodeUtil.getPath(IdeaWorkshop.rootPath, "INBOX");
    IdeaWorkshop.settingsPath = NodeUtil.getPath(IdeaWorkshop.rootPath, "settings.json");
    IdeaWorkshop.defaultSettings = {
        enabled: true,
        assignedArk: "",
        selectPrompt: "Classify whether the provided text relates to each topic below.\nOutput exactly one line per topic, no other text:\nTopicName: true or TopicName: false\n\nTOPICS:\n\n{{topics}}\n\nEXCERPT:\n\n{{excerpt}}",
        summaryPrompt: "Summarize the following text, plain text, no formatting.\n\n{{content}}",
        contemplatePrompt: "Contemplate on the following ideas, free but grounded associations.\n\nIDEAS:\n\n{{ideas}}",
        entryPrompt: "Describe this material, plain text, no formatting.\nUse this template:\n\nTitle: [short title]\nShort: [one line summary]\n[detailed description]",
        itemsPerWake: 3,
        thinkCount: 1,
        deferred: [],
        defaultChat: null
    };
    function getActions(params) {
        if (params.idea.enabled) {
            return {
                idea: {
                    create: createAction,
                    list: listAction,
                    details: detailsAction,
                    update: updateAction,
                    contemplate: contemplateAction,
                    delete: deleteAction,
                    move: moveAction,
                    copy: copyAction
                }
            };
        }
        return {};
    }
    IdeaWorkshop.getActions = getActions;
    async function initialize() {
        await NodeUtil.makeDirPromise(IdeaWorkshop.rootPath, { recursive: true });
        const settings = await SettingsUtil.ensure(IdeaWorkshop.settingsPath, IdeaWorkshop.defaultSettings);
        delete settings.prompt;
        await FileUtil.writeJSONLocked(IdeaWorkshop.settingsPath, settings);
        await NodeUtil.makeDirPromise(IdeaWorkshop.inboxPath, { recursive: true });
        await syncInboxIndex();
        await migrateDescriptions();
        await migrateCatalogueIndexes();
        await WorkshopUtil.scheduleEvery("idea-main", "1h");
    }
    IdeaWorkshop.initialize = initialize;
    async function migrateDescriptions() {
        for (const name of await IdeaWorkshop.listIdeaNames()) {
            const entries = await IdeaWorkshop.readEntries(name);
            if (Object.keys(entries).length) {
                continue;
            }
            const description = IdeaWorkshop.descriptionPath(name);
            if (await FileUtil.exists(description)) {
                continue;
            }
            const summary = IdeaWorkshop.summaryPath(name);
            if (await FileUtil.exists(summary) == false) {
                continue;
            }
            const content = await FileUtil.readTextLocked(summary);
            const trimmed = content?.trim();
            if (trimmed == null || trimmed == "" || trimmed.includes("\n") || trimmed.length > 500) {
                continue;
            }
            try {
                await NodeUtil.renamePromise(summary, description);
            }
            catch (error) {
                console.warn(error);
            }
        }
    }
    async function migrateCatalogueIndexes() {
        for (const name of await IdeaWorkshop.listIdeaNames()) {
            const catalogue = await IdeaWorkshop.readCatalogue(name);
            const excerptIndex = Math.max(catalogue.lastExcerptIndex ?? 0, IdeaWorkshop.getEntryIndexMax(catalogue.entries, "excerpt"));
            const noteIndex = Math.max(catalogue.lastNoteIndex ?? 0, IdeaWorkshop.getEntryIndexMax(catalogue.entries, "note"));
            if (catalogue.lastExcerptIndex == excerptIndex && catalogue.lastNoteIndex == noteIndex) {
                continue;
            }
            catalogue.lastExcerptIndex = excerptIndex;
            catalogue.lastNoteIndex = noteIndex;
            await IdeaWorkshop.writeCatalogue(name, catalogue);
        }
    }
    async function syncInboxIndex() {
        const settingsPath = IdeaWorkshop.settingsPath;
        const raw = await FileUtil.readJSONRAW(settingsPath) ?? {};
        let lastIndex = Number(raw.lastIndex) || 0;
        const oldPath = NodeUtil.getPath(IdeaWorkshop.rootPath, "catalogue.json");
        if (await FileUtil.exists(oldPath)) {
            const old = await FileUtil.readJSONRAW(oldPath);
            if (old?.lastIndex) {
                lastIndex = Math.max(lastIndex, Number(old.lastIndex) || 0);
            }
        }
        for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.inboxPath)) {
            const match = name.match(/-(\d+)\.txt$/);
            if (match) {
                lastIndex = Math.max(lastIndex, Number(match[1]));
            }
        }
        if (typeof raw.lastIndex != "number" || raw.lastIndex != lastIndex) {
            raw.lastIndex = lastIndex;
            await FileUtil.writeJSONLocked(settingsPath, raw);
        }
    }
    async function readSettings() {
        return SettingsUtil.read(IdeaWorkshop.settingsPath, IdeaWorkshop.defaultSettings);
    }
    IdeaWorkshop.readSettings = readSettings;
    async function editSettings(overrides) {
        return SettingsUtil.edit(IdeaWorkshop.settingsPath, overrides, IdeaWorkshop.defaultSettings);
    }
    IdeaWorkshop.editSettings = editSettings;
    async function getPromptParts(params) {
        if (params.idea.enabled == false) {
            return [];
        }
        return [{
                variable: "ACTIONS",
                description: "Idea actions",
                content: `Idea Actions:
Create an idea:
@idea-create name=Name <description>
List ideas:
@idea-list
Show idea details:
@idea-details name=Name
Run an idea update:
@idea-update [sort=count] [contemplate=count]
Contemplate an idea:
@idea-contemplate name=Name
Delete an idea:
@idea-delete name=Name
Move an entry:
@idea-move from=<Idea|INBOX> item=entry-name to=<Idea|INBOX>
File an INBOX item:
@idea-move from=INBOX item=INBOX-name to=TargetIdea,Idea2
Copy an entry:
@idea-copy from=<Idea|INBOX> item=entry-name to=<Idea|INBOX>
Copy an INBOX item:
@idea-copy from=INBOX item=INBOX-name to=TargetIdea,Idea2`
            }];
    }
    IdeaWorkshop.getPromptParts = getPromptParts;
    async function onUpdate(params, context) {
    }
    IdeaWorkshop.onUpdate = onUpdate;
    async function onBlock(params, block) {
        const filtered = block.filter(entry => {
            if (entry.role == "env" || entry.role == "info") {
                if (entry.name == "idea") {
                    return false;
                }
                if (entry.name.startsWith("idea-")) {
                    return false;
                }
                return true;
            }
            if (entry.role == "user" && entry.content.trim().startsWith("@idea ")) {
                return false;
            }
            return true;
        });
        if (filtered.length == 0) {
            return;
        }
        const preserved = await preserveBlockImages(filtered);
        const { year, month, day, padded } = await LibraryUtil.nextParts(IdeaWorkshop.settingsPath);
        const name = `${year}-${month}-${day}-${padded}`;
        const content = ContextUtil.contextToText(preserved, ContextUtil.archiveTemplate, Infinity);
        const thoughtPath = NodeUtil.getPath(IdeaWorkshop.inboxPath, `${name}.txt`);
        await FileUtil.writeTextLocked(thoughtPath, content);
    }
    IdeaWorkshop.onBlock = onBlock;
    async function preserveBlockImages(entries) {
        const result = [];
        for (const entry of entries) {
            if (entry.type == "image" && entry.name == "raw") {
                if (entry.content.trim() == "") {
                    continue;
                }
                const ext = ImageWorkshop.detectExt(entry.content);
                const name = await ImageWorkshop.saveUpload(ext, entry.content);
                result.push({ ...entry, name, content: "An uploaded image." });
            }
            else {
                result.push(entry);
            }
        }
        return result;
    }
    async function onDelete(params) {
    }
    IdeaWorkshop.onDelete = onDelete;
    async function onWakeUp(params) {
        const settings = await IdeaWorkshop.readSettings();
        await IdeaWorkshop.runUpdate(settings, "IdeaWorkshop", null, null, false);
    }
    IdeaWorkshop.onWakeUp = onWakeUp;
    async function createAction(params, entry, args) {
        const parsed = IdeaWorkshop.parseNamedArgs(args);
        if (parsed.name == null || parsed.rest == "") {
            return IdeaWorkshop.infoEntry("Usage: @idea-create name=Name <description>");
        }
        const name = await IdeaWorkshop.createIdea(parsed.name, parsed.rest);
        if (name == null) {
            return IdeaWorkshop.infoEntry(`Idea ${parsed.name} already exists.`);
        }
        return IdeaWorkshop.infoEntry(`Created idea: ${name}\n${parsed.rest}`);
    }
    IdeaWorkshop.createAction = createAction;
    async function listAction(params, entry, args) {
        const names = await IdeaWorkshop.listIdeaNames();
        if (names.length == 0) {
            return IdeaWorkshop.resultEntry("idea-list", "There are no ideas.");
        }
        const parts = [];
        for (const name of names) {
            const summary = await IdeaWorkshop.readSummary(name);
            const description = await IdeaWorkshop.readDescriptionFile(name);
            parts.push(`${name}:\n${summary?.trim() || description?.trim() || "No summary yet."}`);
        }
        return IdeaWorkshop.resultEntry("idea-list", parts.join("\n\n"));
    }
    IdeaWorkshop.listAction = listAction;
    async function detailsAction(params, entry, args) {
        const parsed = IdeaWorkshop.parseNamedArgs(args);
        const name = parsed.name ?? IdeaWorkshop.sanitizeName(parsed.rest);
        if (name == null) {
            return IdeaWorkshop.infoEntry("Usage: @idea-details name=Name");
        }
        if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name)) == false) {
            return IdeaWorkshop.infoEntry(`Idea ${name} does not exist.`);
        }
        const content = await IdeaWorkshop.buildIdeaContent(name, true);
        return IdeaWorkshop.resultEntry("idea-details", content);
    }
    IdeaWorkshop.detailsAction = detailsAction;
    async function updateAction(params, entry, args) {
        const fields = { sort: null, contemplate: null };
        TextUtil.parseMetaFields((args ?? "").trim(), fields);
        const sort = IdeaWorkshop.parseCount(fields.sort);
        const contemplate = IdeaWorkshop.parseCount(fields.contemplate);
        const result = await IdeaWorkshop.runUpdate(params.idea, params.chatID, params.process.arkName, params.handler, true, sort, contemplate);
        if (result.report) {
            return IdeaWorkshop.resultEntry("idea-report", result.report);
        }
        return IdeaWorkshop.infoEntry("Idea update finished with nothing to report.");
    }
    IdeaWorkshop.updateAction = updateAction;
    async function contemplateAction(params, entry, args) {
        const parsed = IdeaWorkshop.parseNamedArgs(args);
        const name = parsed.name ?? IdeaWorkshop.sanitizeName(parsed.rest);
        if (name == null) {
            return IdeaWorkshop.infoEntry("Usage: @idea-contemplate name=Name");
        }
        if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name)) == false) {
            return IdeaWorkshop.infoEntry(`Idea ${name} does not exist.`);
        }
        const arkName = await IdeaWorkshop.resolveArkName(params.idea, params.process.arkName);
        if (arkName == null) {
            return IdeaWorkshop.infoEntry("No ark is available for contemplation.");
        }
        const silentID = `idea-contemplate-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const silent = new AgoraStreamer(silentID, null);
        try {
            const base = await ParamsUtil.getBaseParams(params.chatID, silent);
            const report = await IdeaWorkshop.runContemplation(base, arkName, [name], params.handler);
            return IdeaWorkshop.resultEntry("idea-report", report);
        }
        finally {
            AgoraStreamer.end(silentID);
        }
    }
    IdeaWorkshop.contemplateAction = contemplateAction;
    async function deleteAction(params, entry, args) {
        const parsed = IdeaWorkshop.parseNamedArgs(args);
        const name = parsed.name ?? IdeaWorkshop.sanitizeName(parsed.rest);
        if (name == null) {
            return IdeaWorkshop.infoEntry("Usage: @idea-delete name=Name");
        }
        if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name)) == false) {
            return IdeaWorkshop.infoEntry(`Idea ${name} does not exist.`);
        }
        await IdeaWorkshop.removeIdea(name);
        return IdeaWorkshop.resultEntry("idea-delete", `Deleted idea ${name}.`);
    }
    IdeaWorkshop.deleteAction = deleteAction;
    async function moveAction(params, entry, args) {
        return await transferAction(params, args, true);
    }
    IdeaWorkshop.moveAction = moveAction;
    async function copyAction(params, entry, args) {
        return await transferAction(params, args, false);
    }
    IdeaWorkshop.copyAction = copyAction;
    async function transferAction(params, args, removeSource) {
        const fields = { from: null, to: null, item: null, name: null, entry: null };
        TextUtil.parseMetaFields((args ?? "").trim(), fields);
        const command = removeSource ? "@idea-move" : "@idea-copy";
        const from = (fields["from"] ?? fields["name"])?.trim();
        const to = fields["to"]?.trim();
        const item = (fields["item"] ?? fields["entry"])?.trim();
        if (from == null || to == null || item == null || item == "") {
            return IdeaWorkshop.infoEntry(`Usage: ${command} from=<Idea|INBOX> item=entry-name to=<Idea|INBOX>`);
        }
        if (from == "INBOX") {
            if (to == "INBOX") {
                return IdeaWorkshop.infoEntry(`Cannot transfer INBOX item ${item} to INBOX.`);
            }
            return await IdeaWorkshop.transferInboxItem(params, item, to, removeSource);
        }
        const source = IdeaWorkshop.sanitizeName(from);
        if (source == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(source)) == false) {
            return IdeaWorkshop.infoEntry(`Idea ${from} does not exist.`);
        }
        if (to == "INBOX") {
            return await transferToInbox(params, source, item, removeSource);
        }
        const target = IdeaWorkshop.sanitizeName(to);
        if (target == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(target)) == false) {
            return IdeaWorkshop.infoEntry(`Idea ${to} does not exist.`);
        }
        return await transferIdeaEntry(params, source, target, item, removeSource);
    }
    async function transferIdeaEntry(params, from, to, key, removeSource) {
        const entries = await IdeaWorkshop.readEntries(from);
        if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
            return IdeaWorkshop.infoEntry(`Idea ${from} has no entry ${key}.`);
        }
        const entryData = entries[key];
        const source = entryData.source ?? key;
        const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(from, key));
        if (content == null) {
            return IdeaWorkshop.infoEntry(`Entry ${key} file is missing.`);
        }
        if (removeSource) {
            const targetEntries = await IdeaWorkshop.readEntries(to);
            if (Object.prototype.hasOwnProperty.call(targetEntries, key) && (targetEntries[key].source ?? key) != source) {
                return IdeaWorkshop.infoEntry(`Idea ${to} already has entry ${key}.`);
            }
            const occurrences = await findOccurrences(source, key);
            const affected = [];
            for (const occurrence of occurrences) {
                await removeOccurrence(occurrence);
                if (affected.includes(occurrence.idea) == false) {
                    affected.push(occurrence.idea);
                }
            }
            await writeEntryTo(to, key, entryData, content);
            if (affected.includes(to) == false) {
                affected.push(to);
            }
            const updated = await IdeaWorkshop.regenerateSummaries(params, affected, params.handler);
            const parts = [`Moved ${key}:`, `Copied to ${to}: ${await IdeaWorkshop.getIdeaShort(to)}`];
            for (const idea of affected) {
                if (idea != to) {
                    parts.push(`Removed from ${idea}: ${key}`);
                }
            }
            if (updated.length) {
                parts.push(`Summary updated: ${updated.join(", ")}`);
            }
            return IdeaWorkshop.resultEntry("idea-move", parts.join("\n"));
        }
        const targetEntries = await IdeaWorkshop.readEntries(to);
        for (const targetKey in targetEntries) {
            if (targetKey == key || targetEntries[targetKey].source == source) {
                return IdeaWorkshop.infoEntry(`Idea ${to} already has this entry.`);
            }
        }
        await writeEntryTo(to, key, entryData, content);
        const updated = await IdeaWorkshop.regenerateSummaries(params, [to], params.handler);
        const parts = [`Copied ${key}:`, `Copied to ${to}: ${await IdeaWorkshop.getIdeaShort(to)}`];
        if (updated.length) {
            parts.push(`Summary updated: ${updated.join(", ")}`);
        }
        return IdeaWorkshop.resultEntry("idea-copy", parts.join("\n"));
    }
    async function transferToInbox(params, from, key, removeSource) {
        const entries = await IdeaWorkshop.readEntries(from);
        if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
            return IdeaWorkshop.infoEntry(`Idea ${from} has no entry ${key}.`);
        }
        const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(from, key));
        if (content == null) {
            return IdeaWorkshop.infoEntry(`Entry ${key} file is missing.`);
        }
        const name = `${NodeUtil.path.basename(key)}.txt`;
        await FileUtil.writeTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, name), content);
        if (removeSource) {
            await removeOccurrence({ idea: from, key, entry: entries[key] });
        }
        const updated = removeSource ? await IdeaWorkshop.regenerateSummaries(params, [from], params.handler) : [];
        const parts = [`${removeSource ? "Moved" : "Copied"} ${key} to INBOX:`, `File: ${name}`];
        if (updated.length) {
            parts.push(`Summary updated: ${updated.join(", ")}`);
        }
        return IdeaWorkshop.resultEntry(removeSource ? "idea-move" : "idea-copy", parts.join("\n"));
    }
    async function transferInboxItem(params, itemName, targetList, removeSource) {
        const clean = IdeaWorkshop.sanitizeInboxName(itemName.endsWith(".txt") ? itemName : `${itemName}.txt`);
        const command = removeSource ? "@idea-move" : "@idea-copy";
        if (clean == null) {
            return IdeaWorkshop.infoEntry(`Usage: ${command} from=INBOX item=INBOX-name to=TargetIdea,Idea2`);
        }
        const targets = [];
        for (const name of (targetList ?? "").split(",")) {
            const target = IdeaWorkshop.sanitizeName(name);
            if (target && targets.includes(target) == false) {
                targets.push(target);
            }
        }
        if (targets.length == 0) {
            return IdeaWorkshop.infoEntry(`Usage: ${command} from=INBOX item=INBOX-name to=TargetIdea,Idea2`);
        }
        for (const target of targets) {
            if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(target)) == false) {
                return IdeaWorkshop.infoEntry(`Idea ${target} does not exist.`);
            }
        }
        const content = await IdeaWorkshop.readInbox(clean);
        if (content == null || content.trim() == "") {
            return IdeaWorkshop.infoEntry(`INBOX item ${clean} is empty or missing.`);
        }
        const images = await IdeaWorkshop.readInboxImages(content);
        const baseName = clean.slice(0, -4);
        const item = { name: clean, path: NodeUtil.getPath(IdeaWorkshop.inboxPath, clean), baseName, time: Date.now() };
        if (params.handler) {
            params.handler.streamInfo(`Describing ${baseName}:`);
        }
        const description = await IdeaWorkshop.describeItem(params, content, images);
        const excerpt = images.length ? `${content}\n\n${description.long}` : content;
        const affected = [];
        const removed = [];
        if (removeSource) {
            for (const occurrence of await findOccurrences(baseName, null)) {
                await removeOccurrence(occurrence);
                if (removed.includes(occurrence.idea) == false) {
                    removed.push(occurrence.idea);
                }
                if (affected.includes(occurrence.idea) == false) {
                    affected.push(occurrence.idea);
                }
            }
        }
        const keys = [];
        const copied = [];
        const skipped = [];
        for (const target of targets) {
            const key = await IdeaWorkshop.addExcerpt(target, excerpt, baseName, description, images);
            if (key) {
                keys.push(key);
                copied.push(target);
                if (affected.includes(target) == false) {
                    affected.push(target);
                }
            }
            else {
                skipped.push(target);
            }
        }
        if (removeSource) {
            await IdeaWorkshop.removeInbox(clean);
        }
        const updated = await IdeaWorkshop.regenerateSummaries(params, affected, params.handler);
        const parts = [await IdeaWorkshop.buildMoveReport(item, description, copied, keys, removeSource ? "Moved" : "Copied")];
        for (const idea of removed) {
            if (copied.includes(idea) == false) {
                parts.push(`Removed from ${idea}: ${baseName}`);
            }
        }
        for (const idea of skipped) {
            parts.push(`Already present in ${idea}`);
        }
        if (updated.length) {
            parts.push(`Summary updated: ${updated.join(", ")}`);
        }
        return IdeaWorkshop.resultEntry(removeSource ? "idea-move" : "idea-copy", parts.join("\n"));
    }
    IdeaWorkshop.transferInboxItem = transferInboxItem;
    async function findOccurrences(source, key) {
        const result = [];
        for (const idea of await IdeaWorkshop.listIdeaNames()) {
            const entries = await IdeaWorkshop.readEntries(idea);
            for (const current in entries) {
                const entry = entries[current];
                if (entry.source == source || (key != null && current == key)) {
                    result.push({ idea, key: current, entry });
                }
            }
        }
        return result;
    }
    async function removeOccurrence(occurrence) {
        await LibraryUtil.removeEntry(IdeaWorkshop.ideaCataloguePath(occurrence.idea), occurrence.key);
        try {
            await NodeUtil.removePromise(IdeaWorkshop.entryPath(occurrence.idea, occurrence.key));
        }
        catch {
        }
    }
    async function writeEntryTo(idea, key, entry, content) {
        await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(idea, key), content);
        await LibraryUtil.setEntry(IdeaWorkshop.ideaCataloguePath(idea), key, entry);
        await IdeaWorkshop.syncEntryIndex(idea, key);
    }
    async function runUpdate(settings, settingsChatID, arkName, infoHandler, manual, sort = null, contemplate = null) {
        if (settings.enabled == false) {
            if (infoHandler) {
                infoHandler.streamInfo("Idea workshop is disabled.");
            }
            return { report: "" };
        }
        const silentID = `idea-workshop-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const silent = new AgoraStreamer(silentID, null);
        try {
            const params = await ParamsUtil.getBaseParams(settingsChatID || "IdeaWorkshop", silent);
            const streamed = infoHandler ? { ...params, handler: infoHandler } : params;
            const count = Math.max(0, sort ?? settings.itemsPerWake ?? IdeaWorkshop.defaultSettings.itemsPerWake);
            const workshop = await IdeaWorkshop.readSettings();
            const deferred = new Set(workshop.deferred ?? []);
            const originalDeferred = Array.from(deferred).join("\n");
            const items = await IdeaWorkshop.listInbox(count, Array.from(deferred));
            const reports = [];
            if (items.length && infoHandler) {
                infoHandler.streamInfo(`Checking ${items.length} INBOX item(s):`);
            }
            for (const item of items) {
                const result = await IdeaWorkshop.processInboxItem(streamed, item, infoHandler);
                if (result.remove) {
                    await NodeUtil.removePromise(item.path);
                    deferred.delete(item.baseName);
                }
                else {
                    await IdeaWorkshop.deferInboxItem(item.path);
                    deferred.add(item.baseName);
                }
                if (result.report) {
                    reports.push(result.report);
                }
                if (result.remove && result.selected.length) {
                    const updated = await IdeaWorkshop.regenerateSummaries(params, result.selected, infoHandler);
                    if (updated.length && result.report) {
                        reports[reports.length - 1] += `\nSummary updated: ${updated.join(", ")}`;
                    }
                }
            }
            const updatedDeferred = Array.from(deferred);
            if (updatedDeferred.join("\n") != originalDeferred) {
                await IdeaWorkshop.editSettings({ deferred: updatedDeferred });
            }
            const thinkCount = Math.floor(Math.max(0, contemplate ?? settings.thinkCount ?? IdeaWorkshop.defaultSettings.thinkCount));
            if (thinkCount > 0) {
                const selected = await IdeaWorkshop.selectContemplation(manual, thinkCount);
                if (selected.length) {
                    const thinker = await IdeaWorkshop.resolveArkName(settings, arkName);
                    if (thinker) {
                        const report = await IdeaWorkshop.runContemplation(params, thinker, selected, infoHandler);
                        reports.push(report);
                    }
                    else if (infoHandler) {
                        infoHandler.streamInfo("No ark is available for contemplation.");
                    }
                }
            }
            const report = reports.join("\n\n");
            if (manual == false && report) {
                await IdeaWorkshop.sendReport(settings, report);
            }
            return { report };
        }
        finally {
            AgoraStreamer.end(silentID);
        }
    }
    IdeaWorkshop.runUpdate = runUpdate;
    async function sortInboxItem(name) {
        const clean = IdeaWorkshop.sanitizeInboxName(name);
        if (clean == null) {
            return null;
        }
        const path = NodeUtil.getPath(IdeaWorkshop.inboxPath, clean);
        const settings = await IdeaWorkshop.readSettings();
        if (settings.enabled == false || await FileUtil.exists(path) == false) {
            return null;
        }
        const silentID = `idea-sort-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const silent = new AgoraStreamer(silentID, null);
        try {
            const params = await ParamsUtil.getBaseParams("IdeaWorkshop", silent);
            const baseName = clean.slice(0, -4);
            const item = { name: clean, path, baseName, time: Date.now() };
            const result = await IdeaWorkshop.processInboxItem(params, item, null);
            const current = settings.deferred ?? [];
            const deferred = current.filter(entry => entry != baseName);
            if (result.remove) {
                await NodeUtil.removePromise(path);
                if (result.selected.length) {
                    await IdeaWorkshop.regenerateSummaries(params, result.selected, null);
                }
            }
            else {
                await IdeaWorkshop.deferInboxItem(path);
                deferred.push(baseName);
            }
            if (current.join("\n") != deferred.join("\n")) {
                await IdeaWorkshop.editSettings({ deferred });
            }
            return result.report;
        }
        finally {
            AgoraStreamer.end(silentID);
        }
    }
    IdeaWorkshop.sortInboxItem = sortInboxItem;
    async function runContemplation(params, arkName, names, infoHandler) {
        if (infoHandler) {
            for (const name of names) {
                infoHandler.streamInfo(`Contemplating on ${name}: ${await IdeaWorkshop.getIdeaShort(name)}`);
            }
        }
        const result = await IdeaWorkshop.contemplate(params, arkName, names, infoHandler);
        if (result.note.trim() == "") {
            return `Contemplation of ${names.join(", ")} produced no note.`;
        }
        const streamed = infoHandler ? { ...params, handler: infoHandler } : params;
        if (infoHandler) {
            infoHandler.streamInfo("Describing note:");
        }
        const description = await IdeaWorkshop.describeItem(streamed, result.note);
        const keys = await IdeaWorkshop.saveNote(names, result.note, result.turns, description);
        const updated = await IdeaWorkshop.regenerateSummaries(params, names, infoHandler);
        const parts = [];
        for (let i = 0; i < keys.length; ++i) {
            parts.push(`Saved note ${keys[i]} to ${names[i]}:\nName: ${description.title}\nShort: ${description.short}\nLong: ${description.long}`);
        }
        if (updated.length) {
            parts.push(`Summary updated: ${updated.join(", ")}`);
        }
        return parts.join("\n");
    }
    IdeaWorkshop.runContemplation = runContemplation;
    async function processInboxItem(params, item, infoHandler) {
        const content = await FileUtil.readTextLocked(item.path);
        if (content == null || content.trim() == "") {
            return { selected: [], report: null, remove: true, categorization: null };
        }
        const images = await IdeaWorkshop.readInboxImages(content);
        if (infoHandler) {
            infoHandler.streamInfo(`Matching ${item.baseName}:`);
        }
        const names = await IdeaWorkshop.listIdeaNames();
        if (names.length == 0) {
            return { selected: [], report: await IdeaWorkshop.buildClarificationReport(item, content), remove: false, categorization: "no ideas" };
        }
        const topics = await IdeaWorkshop.buildTopics(names);
        let description = null;
        if (images.length) {
            if (infoHandler) {
                infoHandler.streamInfo(`Describing ${item.baseName}:`);
            }
            description = await IdeaWorkshop.describeItem(params, content, images);
        }
        const excerpt = description ? `${content}\n\n${description.long}` : content;
        const selection = await IdeaWorkshop.selectTopics(params, topics, excerpt, names);
        const categorization = selection.response.trim() || "no output";
        if (selection.selected.length == 0) {
            return { selected: [], report: await IdeaWorkshop.buildClarificationReport(item, excerpt), remove: false, categorization };
        }
        if (description == null) {
            if (infoHandler) {
                infoHandler.streamInfo(`Describing ${item.baseName}:`);
            }
            description = await IdeaWorkshop.describeItem(params, content, images);
        }
        const keys = [];
        for (const name of selection.selected) {
            keys.push(await IdeaWorkshop.addExcerpt(name, excerpt, item.baseName, description, images));
        }
        return { selected: selection.selected, report: await IdeaWorkshop.buildMoveReport(item, description, selection.selected, keys), remove: true, categorization };
    }
    IdeaWorkshop.processInboxItem = processInboxItem;
    async function selectTopics(params, topics, excerpt, names) {
        const fields = {};
        for (const name of names) {
            fields[name] = { name, description: "true or false" };
        }
        const prompt = await IdeaWorkshop.composePrompt(params, IdeaWorkshop.resolveSelectPrompt(params.idea), { topics, excerpt }, fields);
        const model = IdeaWorkshop.resolveIdeaModel(params, params.idea.selectModel, params.generate.mainModel);
        const response = await GenerateUtil.generateRaw(params, model, [{ role: "user", content: prompt }]);
        const selected = IdeaWorkshop.parseSelection(response, names);
        return { selected, response };
    }
    IdeaWorkshop.selectTopics = selectTopics;
    async function buildTopics(names) {
        const lines = [];
        for (const name of names) {
            const description = await IdeaWorkshop.readDescriptionFile(name);
            const text = TextUtil.shortifyLineNicely((description ?? "").replace(/\s+/g, " ").trim(), 500);
            lines.push(`${name}: ${text || "No description yet."}`);
        }
        return lines.join("\n");
    }
    IdeaWorkshop.buildTopics = buildTopics;
    function parseInboxImages(content) {
        const result = [];
        const matches = content.matchAll(/^\[image (.+)\]$/gm);
        for (const match of matches) {
            const name = match[1].trim();
            if (result.includes(name) == false) {
                result.push(name);
            }
        }
        return result;
    }
    IdeaWorkshop.parseInboxImages = parseInboxImages;
    async function readInboxImages(content) {
        const result = [];
        for (const name of IdeaWorkshop.parseInboxImages(content)) {
            const entry = await LibraryUtil.getEntry(ImageWorkshop.cataloguePath, name);
            if (entry) {
                result.push(name);
            }
        }
        return result;
    }
    IdeaWorkshop.readInboxImages = readInboxImages;
    function parseSelection(content, names) {
        const values = {};
        for (const line of content.split("\n")) {
            const clean = line.trim().replace(/^(?:[-*]|\d+[.)])\s*/, "");
            const index = clean.indexOf(":");
            if (index < 0) {
                continue;
            }
            const key = clean.slice(0, index).trim();
            const value = clean.slice(index + 1).trim();
            for (const name of names) {
                if (name.toLowerCase() == key.toLowerCase()) {
                    values[name] = value;
                    break;
                }
            }
        }
        const result = [];
        for (const name of names) {
            if ((values[name] ?? "").toLowerCase() != "true") {
                continue;
            }
            if (result.includes(name) == false) {
                result.push(name);
            }
        }
        return result;
    }
    IdeaWorkshop.parseSelection = parseSelection;
    async function addExcerpt(name, content, source, description, images = []) {
        const entries = await IdeaWorkshop.readEntries(name);
        for (const key in entries) {
            if (entries[key].source == source) {
                return null;
            }
        }
        const index = await IdeaWorkshop.nextExcerptIndex(name, source);
        const title = description.title || "Untitled";
        const key = IdeaWorkshop.buildEntryName(IdeaWorkshop.sourceDate(source), "excerpt", index, title);
        await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(name, key), content);
        const entry = { time: Date.now(), kind: "excerpt", source, title, short: description.short, long: description.long };
        if (images.length) {
            entry.images = images;
        }
        await LibraryUtil.setEntry(IdeaWorkshop.ideaCataloguePath(name), key, entry);
        return key;
    }
    IdeaWorkshop.addExcerpt = addExcerpt;
    async function regenerateSummaries(params, names, infoHandler) {
        const result = [];
        for (const name of names) {
            try {
                const entries = await IdeaWorkshop.readEntries(name);
                if (Object.keys(entries).length == 0) {
                    continue;
                }
                const content = await IdeaWorkshop.buildIdeaContent(name, false);
                if (content == `Idea: ${name}`) {
                    continue;
                }
                if (infoHandler) {
                    infoHandler.streamInfo(`Updating summary of ${name}:`);
                }
                const streamed = infoHandler ? { ...params, handler: infoHandler } : params;
                const prompt = await IdeaWorkshop.composePrompt(streamed, IdeaWorkshop.resolveSummaryPrompt(streamed.idea), { content });
                const model = IdeaWorkshop.resolveIdeaModel(streamed, streamed.idea.summaryModel, streamed.generate.smallModel);
                const summary = await GenerateUtil.generateRaw(streamed, model, [{ role: "user", content: prompt }]);
                if (summary.trim()) {
                    await FileUtil.writeTextLocked(IdeaWorkshop.summaryPath(name), summary.trim());
                    result.push(name);
                }
            }
            catch (error) {
                console.warn(error);
            }
        }
        return result;
    }
    IdeaWorkshop.regenerateSummaries = regenerateSummaries;
    async function summarizeEntry(params, name, key) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null) {
            return null;
        }
        const catalogue = await IdeaWorkshop.readCatalogue(clean);
        const entries = catalogue.entries ?? {};
        const entry = entries[key];
        if (entry == null) {
            return null;
        }
        const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(clean, key));
        const images = entry.images ?? [];
        if (content == null && images.length == 0) {
            return null;
        }
        const described = await IdeaWorkshop.describeItem(params, content ?? "", images);
        const result = { ...entry, title: described.title, short: described.short, long: described.long };
        const newKey = renameKey(entry, described.title);
        if (newKey != key && Object.prototype.hasOwnProperty.call(entries, newKey) == false) {
            try {
                await NodeUtil.renamePromise(IdeaWorkshop.entryPath(clean, key), IdeaWorkshop.entryPath(clean, newKey));
                delete entries[key];
                entries[newKey] = result;
                await IdeaWorkshop.writeCatalogue(clean, catalogue);
                return result;
            }
            catch (error) {
                console.warn(error);
            }
        }
        entries[key] = result;
        await IdeaWorkshop.writeCatalogue(clean, catalogue);
        return result;
    }
    IdeaWorkshop.summarizeEntry = summarizeEntry;
    async function selectContemplation(manual, limit) {
        if (limit <= 0) {
            return [];
        }
        const now = Date.now();
        const week = 7 * 86400000;
        const candidates = [];
        for (const name of await IdeaWorkshop.listIdeaNames()) {
            const entries = await IdeaWorkshop.readEntries(name);
            if (Object.keys(entries).length == 0) {
                continue;
            }
            const last = IdeaWorkshop.getLastEntry(entries);
            if (last?.kind == "note") {
                continue;
            }
            const times = await IdeaWorkshop.getIdeaTimes(name);
            if (manual == false && (times.first == 0 || now - times.first < week)) {
                continue;
            }
            let weight = Math.min(now - times.created, (now - times.last) * 0.5);
            if (weight <= 0) {
                if (manual == false) {
                    continue;
                }
                weight = 1;
            }
            candidates.push({ name, weight });
        }
        const selected = [];
        while (selected.length < limit && candidates.length) {
            const name = IdeaWorkshop.pickWeighted(candidates);
            selected.push(name);
            for (let i = 0; i < candidates.length; ++i) {
                if (candidates[i].name == name) {
                    candidates.splice(i, 1);
                    break;
                }
            }
        }
        return selected;
    }
    IdeaWorkshop.selectContemplation = selectContemplation;
    function getLastEntry(entries) {
        let result = null;
        for (const key in entries) {
            const entry = entries[key];
            if (result == null || (entry.time ?? 0) > (result.time ?? 0)) {
                result = entry;
            }
        }
        return result;
    }
    IdeaWorkshop.getLastEntry = getLastEntry;
    function pickWeighted(items) {
        let total = 0;
        for (const item of items) {
            total += item.weight;
        }
        let value = Math.random() * total;
        for (const item of items) {
            value -= item.weight;
            if (value < 0) {
                return item.name;
            }
        }
        return items[items.length - 1].name;
    }
    IdeaWorkshop.pickWeighted = pickWeighted;
    async function contemplate(params, arkName, names, infoHandler) {
        const thoughts = await ParamsUtil.setArkSettings(params, arkName);
        thoughts.process = { ...thoughts.process, arkName };
        thoughts.chatID = `ideas-${names.join("-")}`;
        const settings = thoughts.idea;
        const content = await IdeaWorkshop.buildIdeasContent(names);
        const actionParams = IdeaWorkshop.webOnlyParams(thoughts);
        const prompt = await IdeaWorkshop.composePrompt(actionParams, IdeaWorkshop.resolveContemplatePrompt(settings), { ideas: content });
        const memories = await MemoryUtil.loadMemories(thoughts, [{ type: "message", time: Date.now(), role: "user", name: "idea-workshop", content }], true);
        const systemParts = [];
        const basePrompt = await GenerateUtil.expandPrompt(actionParams, thoughts.generate.prompt ?? "");
        if (basePrompt) {
            systemParts.push(basePrompt);
        }
        if (memories) {
            systemParts.push(memories);
        }
        const images = await IdeaWorkshop.readIdeaImageData(names);
        const message = { role: "user", content: prompt };
        let model = IdeaWorkshop.resolveIdeaModel(thoughts, settings.contemplateModel, thoughts.generate.mainModel);
        if (images.length) {
            model = IdeaWorkshop.resolveVisionModel(thoughts, model);
            if (model.vision) {
                message.images = images;
            }
        }
        const context = [];
        if (systemParts.length) {
            context.push({ role: "system", content: systemParts.join("\n\n") });
        }
        context.push(message);
        const generateParams = infoHandler ? { ...thoughts, handler: infoHandler } : thoughts;
        const block = [];
        const turns = 2 + Math.floor(Math.random() * 4);
        for (let turn = 0; turn < turns; ++turn) {
            const reply = (await GenerateUtil.generateRaw(generateParams, model, context)).trim();
            if (reply == "") {
                break;
            }
            const time = Date.now();
            context.push({ role: "assistant", content: reply });
            block.push({ type: "message", time, role: "ark", name: arkName, content: reply });
            const webResults = await IdeaWorkshop.runWebActions(thoughts, reply, time);
            for (const web of webResults) {
                context.push({ role: "user", content: `Result of @web-${web.action} ${web.args}:\n\n${web.result}` });
                block.push({ type: "message", time, role: "env", name: `web-${web.action}`, content: web.result });
            }
            if (turn + 1 < turns) {
                context.push({ role: "user", content: "Continue the contemplation." });
            }
        }
        const note = ContextUtil.contextToText(block, ContextUtil.archiveTemplate, Infinity);
        if (note.trim()) {
            try {
                const memoryBlock = [
                    { type: "message", time: block[0]?.time ?? Date.now(), role: "env", name: "idea-workshop", content: `This is the state of the current idea, please write your thoughts about it:\n\n${content}` },
                    ...block,
                    { type: "message", time: block[block.length - 1]?.time ?? Date.now(), role: "env", name: "idea-workshop", content: "When memorizing, do not forget: this is an old conversation, and you should remember the thinking of something past." }
                ];
                await MemoryUtil.memorizeBlock(thoughts, memoryBlock);
            }
            catch (error) {
                console.warn(error);
            }
        }
        return { note, turns: block.filter(item => item.role == "ark").length };
    }
    IdeaWorkshop.contemplate = contemplate;
    async function runWebActions(params, content, time) {
        const actions = WorkshopUtil.gatherActions(IdeaWorkshop.webOnlyParams(params)).web;
        if (actions == null) {
            return [];
        }
        const entry = { type: "message", time, role: "ark", name: params.process.arkName, content };
        const result = [];
        const matches = content.matchAll(/^@([\w]+)-([\w-]+)(?:[\t ]+(.*))?$/gm);
        for (const match of matches) {
            if (match[1] != "web") {
                continue;
            }
            const handler = actions[match[2]];
            if (handler == null) {
                continue;
            }
            const args = match[3] ?? "";
            let output = "";
            try {
                const value = await handler(params, entry, args);
                output = value == null ? "" : String(value);
            }
            catch (error) {
                output = `web action failed: ${error}`;
            }
            result.push({ action: match[2], args, result: output });
        }
        return result;
    }
    IdeaWorkshop.runWebActions = runWebActions;
    function webOnlyParams(params) {
        return {
            ...params,
            todo: { ...params.todo, enabled: false },
            image: { ...params.image, enabled: false },
            document: { ...params.document, enabled: false },
            idea: { ...params.idea, enabled: false }
        };
    }
    IdeaWorkshop.webOnlyParams = webOnlyParams;
    async function saveNote(names, note, turns, description) {
        const time = Date.now();
        const date = DateUtil.toLocalDate(time);
        const result = [];
        for (const name of names) {
            const index = await IdeaWorkshop.nextNoteIndex(name);
            const key = IdeaWorkshop.buildEntryName(date, "note", index, description.title);
            await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(name, key), note);
            await LibraryUtil.setEntry(IdeaWorkshop.ideaCataloguePath(name), key, { time, kind: "note", turns, title: description.title, short: description.short, long: description.long });
            result.push(key);
        }
        return result;
    }
    IdeaWorkshop.saveNote = saveNote;
    async function describeItem(params, content, images = []) {
        const prompt = await GenerateUtil.expandPrompt(params, IdeaWorkshop.resolveEntryPrompt(params.idea));
        const context = [{ role: "system", content: prompt }, { role: "user", content }];
        let model = IdeaWorkshop.resolveIdeaModel(params, params.idea.summaryModel, params.generate.smallModel);
        if (images.length) {
            const data = await IdeaWorkshop.readImageData(images);
            model = IdeaWorkshop.resolveVisionModel(params, model);
            if (data.length && model.vision) {
                context[1].images = data;
            }
        }
        const result = await GenerateUtil.generateRaw(params, model, context);
        const fields = { Title: "Untitled", Short: "" };
        const remainder = TextUtil.parseLineFields(result, fields);
        const title = IdeaWorkshop.resolveTitle(fields.Title);
        const long = remainder.trim();
        const short = fields.Short?.trim() || TextUtil.shortifyLineNicely(long.replace(/\s+/g, " "), 200);
        return { title, short, long: long || short };
    }
    IdeaWorkshop.describeItem = describeItem;
    async function readImageData(names) {
        const result = [];
        for (const name of names) {
            const data = await ImageWorkshop.readImage(name);
            if (data) {
                result.push(data);
            }
        }
        return result;
    }
    IdeaWorkshop.readImageData = readImageData;
    async function getIdeaShort(name) {
        const summary = await IdeaWorkshop.readSummary(name);
        const description = await IdeaWorkshop.readDescriptionFile(name);
        const text = (summary?.trim() || description.trim()).replace(/\s+/g, " ");
        return TextUtil.shortifyLineNicely(text, 300) || "No summary yet.";
    }
    IdeaWorkshop.getIdeaShort = getIdeaShort;
    async function buildIdeasContent(names) {
        const parts = [];
        for (const name of names) {
            parts.push(await IdeaWorkshop.buildIdeaContent(name, true));
        }
        return parts.join("\n\n---\n\n");
    }
    IdeaWorkshop.buildIdeasContent = buildIdeasContent;
    async function buildIdeaContent(name, includeSummary) {
        const parts = [];
        const description = await IdeaWorkshop.readDescriptionFile(name);
        if (description.trim()) {
            parts.push(`Description:\n${description.trim()}`);
        }
        if (includeSummary) {
            const summary = await IdeaWorkshop.readSummary(name);
            if (summary?.trim()) {
                parts.push(`Summary:\n${summary.trim()}`);
            }
        }
        const entries = await IdeaWorkshop.readEntries(name);
        const keys = Object.keys(entries).sort((a, b) => {
            const timeA = entries[a].time ?? 0;
            const timeB = entries[b].time ?? 0;
            return timeA == timeB ? a.localeCompare(b) : timeA - timeB;
        });
        for (const key of keys) {
            const entry = entries[key];
            const content = await FileUtil.readTextLocked(IdeaWorkshop.entryPath(name, key));
            const body = content?.trim() || entry.long?.trim();
            if (body) {
                const header = [`[${key}]`];
                if (entry.source) {
                    header.push(`Source: ${entry.source}`);
                }
                if (entry.title) {
                    header.push(`Title: ${entry.title}`);
                }
                if (entry.short) {
                    header.push(`Short: ${entry.short}`);
                }
                header.push(body);
                parts.push(header.join("\n"));
            }
        }
        if (parts.length == 0) {
            return `Idea: ${name}`;
        }
        return `Idea: ${name}\n\n${parts.join("\n\n")}`;
    }
    IdeaWorkshop.buildIdeaContent = buildIdeaContent;
    async function readIdeaImageData(names) {
        const found = [];
        for (const name of names) {
            const entries = await IdeaWorkshop.readEntries(name);
            for (const key in entries) {
                for (const image of entries[key].images ?? []) {
                    if (found.includes(image) == false) {
                        found.push(image);
                    }
                }
            }
        }
        return await IdeaWorkshop.readImageData(found);
    }
    IdeaWorkshop.readIdeaImageData = readIdeaImageData;
    async function composePrompt(params, template, values, fields = null) {
        template = template ?? "";
        const tokens = {};
        for (const key in values) {
            const token = `\u0000${key.toUpperCase()}\u0000`;
            tokens[token] = values[key];
            template = template.split(`{{${key}}}`).join(token);
        }
        let result = await GenerateUtil.expandPrompt(params, template, fields);
        for (const token in tokens) {
            result = result.split(token).join(tokens[token]);
        }
        return result;
    }
    IdeaWorkshop.composePrompt = composePrompt;
    function resolveSelectPrompt(settings) {
        return settings.selectPrompt || IdeaWorkshop.defaultSettings.selectPrompt;
    }
    IdeaWorkshop.resolveSelectPrompt = resolveSelectPrompt;
    function resolveSummaryPrompt(settings) {
        return settings.summaryPrompt || IdeaWorkshop.defaultSettings.summaryPrompt;
    }
    IdeaWorkshop.resolveSummaryPrompt = resolveSummaryPrompt;
    function resolveContemplatePrompt(settings) {
        return settings.contemplatePrompt || IdeaWorkshop.defaultSettings.contemplatePrompt;
    }
    IdeaWorkshop.resolveContemplatePrompt = resolveContemplatePrompt;
    function resolveEntryPrompt(settings) {
        return settings.entryPrompt || IdeaWorkshop.defaultSettings.entryPrompt;
    }
    IdeaWorkshop.resolveEntryPrompt = resolveEntryPrompt;
    function resolveIdeaModel(params, name, fallback) {
        const candidates = [name, fallback, params.generate.mainModel, params.generate.smallModel];
        for (const candidate of candidates) {
            if (candidate == null || candidate == "") {
                continue;
            }
            const model = ModelUtil.resolve(params, candidate);
            if (model.model) {
                return model;
            }
        }
        for (const key in params.models) {
            const model = ModelUtil.resolve(params, key);
            if (model.model) {
                return model;
            }
        }
        console.warn(`[IdeaWorkshop] no usable model, tried ${name || "none"} and ${fallback || "none"}`);
        return ModelUtil.resolve(params, fallback);
    }
    IdeaWorkshop.resolveIdeaModel = resolveIdeaModel;
    function resolveVisionModel(params, model) {
        if (model.vision) {
            return model;
        }
        const vision = ModelUtil.resolve(params, params.generate.visionModel);
        if (vision.vision) {
            return vision;
        }
        return model;
    }
    IdeaWorkshop.resolveVisionModel = resolveVisionModel;
    async function resolveArkName(settings, override) {
        const arks = await ArkUtil.getArkNames();
        if (override && arks.includes(override)) {
            return override;
        }
        if (settings.assignedArk && arks.includes(settings.assignedArk)) {
            return settings.assignedArk;
        }
        return arks[0] ?? null;
    }
    IdeaWorkshop.resolveArkName = resolveArkName;
    async function buildClarificationReport(item, content) {
        const parts = [];
        parts.push(`Unfiled ${item.baseName}:`);
        const excerpt = TextUtil.shortifyTextNicely(content, 3, 200);
        if (excerpt) {
            parts.push(`Excerpt:\n${excerpt}`);
        }
        parts.push(`No target idea was found. Which idea should this item belong to?`);
        parts.push(`Reply with: @idea-move from=INBOX item=${item.baseName} to=IdeaName`);
        return parts.join("\n");
    }
    IdeaWorkshop.buildClarificationReport = buildClarificationReport;
    async function buildMoveReport(item, description, targets, keys, verb = "Filed") {
        const parts = [];
        parts.push(`${verb} ${item.baseName}:`);
        parts.push(`Name: ${description.title}`);
        if (keys.length && keys[0]) {
            parts.push(`File: ${keys[0]}`);
        }
        parts.push(`Short: ${description.short}`);
        parts.push(`Long: ${description.long}`);
        for (const name of targets) {
            parts.push(`Copied to ${name}: ${await IdeaWorkshop.getIdeaShort(name)}`);
        }
        return parts.join("\n");
    }
    IdeaWorkshop.buildMoveReport = buildMoveReport;
    async function sendReport(settings, content) {
        const target = await IdeaWorkshop.resolveReportChat(settings);
        if (target == null) {
            console.warn("no chat available for idea report");
            return;
        }
        const lock = await Mutex.lock(target);
        try {
            const handler = new AgoraStreamer(target, null);
            const params = await ParamsUtil.getCombinedParams(target, handler);
            await ProcessUtil.sendMessage(params, "env", "idea-report", content, [], []);
        }
        finally {
            AgoraStreamer.end(target);
            lock.release();
        }
    }
    IdeaWorkshop.sendReport = sendReport;
    async function resolveReportChat(settings) {
        if (await ChatUtil.isChatAvailable(settings.defaultChat)) {
            return settings.defaultChat;
        }
        return ChatUtil.latestChat();
    }
    IdeaWorkshop.resolveReportChat = resolveReportChat;
    async function listInbox(limit, deferred) {
        if (limit <= 0) {
            return [];
        }
        const deferredSet = new Set(deferred);
        const result = [];
        for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.inboxPath)) {
            if (name.endsWith(".txt") == false) {
                continue;
            }
            const path = NodeUtil.getPath(IdeaWorkshop.inboxPath, name);
            let time = 0;
            try {
                const stat = await NodeUtil.fs.promises.stat(path);
                time = stat.mtimeMs;
            }
            catch {
            }
            result.push({ name, path, baseName: name.slice(0, -4), time });
        }
        result.sort((a, b) => {
            const deferredA = deferredSet.has(a.baseName) ? 1 : 0;
            const deferredB = deferredSet.has(b.baseName) ? 1 : 0;
            if (deferredA != deferredB) {
                return deferredA - deferredB;
            }
            return a.time == b.time ? a.name.localeCompare(b.name) : a.time - b.time;
        });
        return result.slice(0, limit);
    }
    IdeaWorkshop.listInbox = listInbox;
    async function deferInboxItem(path) {
        try {
            const now = new Date();
            await NodeUtil.fs.promises.utimes(path, now, now);
        }
        catch {
        }
    }
    IdeaWorkshop.deferInboxItem = deferInboxItem;
    async function getIdeaTimes(name) {
        const catalogue = await IdeaWorkshop.readCatalogue(name);
        const entries = catalogue.entries ?? {};
        let first = catalogue.created ?? 0;
        let last = first;
        for (const key in entries) {
            const time = entries[key].time ?? 0;
            if (time <= 0) {
                continue;
            }
            if (first == 0 || time < first) {
                first = time;
            }
            if (time > last) {
                last = time;
            }
        }
        if (first == 0) {
            first = await IdeaWorkshop.getFileTime(IdeaWorkshop.summaryPath(name));
        }
        if (last == 0) {
            last = first;
        }
        return { created: catalogue.created || first, first, last };
    }
    IdeaWorkshop.getIdeaTimes = getIdeaTimes;
    async function getFileTime(path) {
        try {
            const stat = await NodeUtil.fs.promises.stat(path);
            return stat.mtimeMs;
        }
        catch {
            return 0;
        }
    }
    IdeaWorkshop.getFileTime = getFileTime;
    async function listIdeaNames() {
        const result = [];
        for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.rootPath)) {
            if (name == "INBOX") {
                continue;
            }
            if (await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(name))) {
                result.push(name);
            }
        }
        result.sort((a, b) => a.localeCompare(b));
        return result;
    }
    IdeaWorkshop.listIdeaNames = listIdeaNames;
    async function readSummary(name) {
        const path = IdeaWorkshop.summaryPath(name);
        if (await FileUtil.exists(path) == false) {
            return null;
        }
        return FileUtil.readTextLocked(path);
    }
    IdeaWorkshop.readSummary = readSummary;
    async function readDescriptionFile(name) {
        const path = IdeaWorkshop.descriptionPath(name);
        if (await FileUtil.exists(path) == false) {
            return "";
        }
        return FileUtil.readTextLocked(path);
    }
    IdeaWorkshop.readDescriptionFile = readDescriptionFile;
    async function readCatalogue(name) {
        const data = await FileUtil.readJSONLocked(IdeaWorkshop.ideaCataloguePath(name));
        if (data == null) {
            return { created: 0, lastIndex: 0, lastExcerptIndex: 0, lastNoteIndex: 0, entries: {} };
        }
        data.entries = data.entries ?? {};
        return data;
    }
    IdeaWorkshop.readCatalogue = readCatalogue;
    async function readEntries(name) {
        return (await IdeaWorkshop.readCatalogue(name)).entries;
    }
    IdeaWorkshop.readEntries = readEntries;
    async function listIdeas() {
        const result = [];
        for (const name of await IdeaWorkshop.listIdeaNames()) {
            const entries = await IdeaWorkshop.readEntries(name);
            result.push({ name, entries: Object.keys(entries).sort() });
        }
        return result;
    }
    IdeaWorkshop.listIdeas = listIdeas;
    async function createIdea(name, description) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null) {
            return null;
        }
        if (await FileUtil.exists(IdeaWorkshop.ideaPath(clean))) {
            return null;
        }
        await NodeUtil.makeDirPromise(IdeaWorkshop.ideaPath(clean), { recursive: true });
        const time = Date.now();
        const catalogue = { created: time, lastIndex: 0, lastExcerptIndex: 0, lastNoteIndex: 0, entries: {} };
        await FileUtil.writeJSONLocked(IdeaWorkshop.ideaCataloguePath(clean), catalogue);
        await FileUtil.writeTextLocked(IdeaWorkshop.descriptionPath(clean), description ?? "");
        return clean;
    }
    IdeaWorkshop.createIdea = createIdea;
    async function renameIdea(oldName, newName) {
        const from = IdeaWorkshop.sanitizeName(oldName);
        const to = IdeaWorkshop.sanitizeName(newName);
        if (from == null || to == null || from == to) {
            return null;
        }
        if (await FileUtil.exists(IdeaWorkshop.ideaPath(from)) == false) {
            return null;
        }
        if (await FileUtil.exists(IdeaWorkshop.ideaPath(to))) {
            return null;
        }
        await NodeUtil.renamePromise(IdeaWorkshop.ideaPath(from), IdeaWorkshop.ideaPath(to));
        return to;
    }
    IdeaWorkshop.renameIdea = renameIdea;
    async function renameEntry(name, key, title) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null) {
            return null;
        }
        const catalogue = await IdeaWorkshop.readCatalogue(clean);
        const entry = catalogue.entries[key];
        if (entry == null) {
            return null;
        }
        const resolved = IdeaWorkshop.resolveTitle(LibraryUtil.cleanName(title));
        const newKey = renameKey(entry, resolved);
        if (newKey == key) {
            return key;
        }
        if (Object.prototype.hasOwnProperty.call(catalogue.entries, newKey)) {
            return null;
        }
        await NodeUtil.renamePromise(IdeaWorkshop.entryPath(clean, key), IdeaWorkshop.entryPath(clean, newKey));
        catalogue.entries[newKey] = { ...entry, title: resolved };
        delete catalogue.entries[key];
        await IdeaWorkshop.writeCatalogue(clean, catalogue);
        return newKey;
    }
    IdeaWorkshop.renameEntry = renameEntry;
    async function removeIdea(name) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null) {
            return null;
        }
        try {
            await NodeUtil.removePromise(IdeaWorkshop.ideaPath(clean), { recursive: true });
        }
        catch {
        }
        return clean;
    }
    IdeaWorkshop.removeIdea = removeIdea;
    async function writeSummary(name, content) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(clean)) == false) {
            return null;
        }
        content = content ?? "";
        await FileUtil.writeTextLocked(IdeaWorkshop.summaryPath(clean), content);
        return content;
    }
    IdeaWorkshop.writeSummary = writeSummary;
    async function writeDescription(name, content) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null || await FileUtil.exists(IdeaWorkshop.ideaCataloguePath(clean)) == false) {
            return null;
        }
        content = content ?? "";
        await FileUtil.writeTextLocked(IdeaWorkshop.descriptionPath(clean), content);
        return content;
    }
    IdeaWorkshop.writeDescription = writeDescription;
    async function writeCatalogue(name, catalogue) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null || catalogue == null) {
            return null;
        }
        if (await FileUtil.exists(IdeaWorkshop.ideaPath(clean)) == false) {
            return null;
        }
        catalogue.created = catalogue.created ?? Date.now();
        catalogue.lastIndex = catalogue.lastIndex ?? 0;
        catalogue.entries = catalogue.entries ?? {};
        await FileUtil.writeJSONLocked(IdeaWorkshop.ideaCataloguePath(clean), catalogue);
        return catalogue;
    }
    IdeaWorkshop.writeCatalogue = writeCatalogue;
    async function readIdeaEntry(name, key) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null) {
            return null;
        }
        const entries = await IdeaWorkshop.readEntries(clean);
        if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
            return null;
        }
        return FileUtil.readTextLocked(IdeaWorkshop.entryPath(clean, key));
    }
    IdeaWorkshop.readIdeaEntry = readIdeaEntry;
    async function writeIdeaEntry(name, key, content) {
        const clean = IdeaWorkshop.sanitizeName(name);
        if (clean == null) {
            return null;
        }
        const entries = await IdeaWorkshop.readEntries(clean);
        if (Object.prototype.hasOwnProperty.call(entries, key) == false) {
            return null;
        }
        content = content ?? "";
        await FileUtil.writeTextLocked(IdeaWorkshop.entryPath(clean, key), content);
        return content;
    }
    IdeaWorkshop.writeIdeaEntry = writeIdeaEntry;
    async function listInboxNames() {
        const result = [];
        for (const name of await LibraryUtil.listDirectoryEntries(IdeaWorkshop.inboxPath)) {
            if (name.endsWith(".txt")) {
                result.push(name);
            }
        }
        result.sort();
        return result;
    }
    IdeaWorkshop.listInboxNames = listInboxNames;
    async function readInbox(name) {
        const clean = IdeaWorkshop.sanitizeInboxName(name);
        if (clean == null) {
            return null;
        }
        return FileUtil.readTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, clean));
    }
    IdeaWorkshop.readInbox = readInbox;
    async function writeInbox(name, content) {
        const clean = IdeaWorkshop.sanitizeInboxName(name);
        if (clean == null) {
            return null;
        }
        content = content ?? "";
        await FileUtil.writeTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, clean), content);
        return content;
    }
    IdeaWorkshop.writeInbox = writeInbox;
    async function uploadInbox(content) {
        const { year, month, day, padded } = await LibraryUtil.nextParts(IdeaWorkshop.settingsPath);
        const name = `${year}-${month}-${day}-${padded}.txt`;
        await FileUtil.writeTextLocked(NodeUtil.getPath(IdeaWorkshop.inboxPath, name), content ?? "");
        return name;
    }
    IdeaWorkshop.uploadInbox = uploadInbox;
    async function uploadInboxImage(ext, data) {
        const image = await ImageWorkshop.saveUpload(ext, data);
        return await IdeaWorkshop.uploadInbox(`[image ${image}]\nAn uploaded image.`);
    }
    IdeaWorkshop.uploadInboxImage = uploadInboxImage;
    async function removeInbox(name) {
        const clean = IdeaWorkshop.sanitizeInboxName(name);
        if (clean == null) {
            return null;
        }
        try {
            await NodeUtil.removePromise(NodeUtil.getPath(IdeaWorkshop.inboxPath, clean));
        }
        catch {
        }
        const settings = await IdeaWorkshop.readSettings();
        const current = settings.deferred ?? [];
        const baseName = clean.slice(0, -4);
        const deferred = current.filter(item => item != baseName && item != clean);
        if (deferred.length != current.length) {
            await IdeaWorkshop.editSettings({ deferred });
        }
        return clean;
    }
    IdeaWorkshop.removeInbox = removeInbox;
    function sanitizeInboxName(name) {
        if (name == null) {
            return null;
        }
        const clean = NodeUtil.path.basename(name);
        if (clean.endsWith(".txt") == false || clean == ".txt") {
            return null;
        }
        return clean;
    }
    IdeaWorkshop.sanitizeInboxName = sanitizeInboxName;
    function nextEntryName(entries, prefix) {
        let max = 0;
        for (const key in entries) {
            const match = key.match(new RegExp(`^${prefix}-(\\d+)$`));
            if (match) {
                max = Math.max(max, Number(match[1]));
            }
        }
        return `${prefix}-${max + 1}`;
    }
    IdeaWorkshop.nextEntryName = nextEntryName;
    function sourceDate(source) {
        const match = (source ?? "").match(/^\d{4}-\d{2}-\d{2}/);
        if (match) {
            return match[0];
        }
        return DateUtil.toLocalDate(Date.now());
    }
    IdeaWorkshop.sourceDate = sourceDate;
    async function nextExcerptIndex(name, source) {
        const catalogue = await IdeaWorkshop.readCatalogue(name);
        const entries = catalogue.entries ?? {};
        const found = (source ?? "").match(/^\d{4}-\d{2}-\d{2}-(\d+)$/);
        let index = found ? Number(found[1]) : 0;
        const previous = Math.max(catalogue.lastExcerptIndex ?? 0, IdeaWorkshop.getEntryIndexMax(entries, "excerpt"));
        if (index < 1) {
            index = previous + 1;
        }
        if (index > (catalogue.lastExcerptIndex ?? 0)) {
            catalogue.lastExcerptIndex = index;
            await IdeaWorkshop.writeCatalogue(name, catalogue);
        }
        return found ? found[1] : String(index);
    }
    IdeaWorkshop.nextExcerptIndex = nextExcerptIndex;
    async function nextNoteIndex(name) {
        const catalogue = await IdeaWorkshop.readCatalogue(name);
        const entries = catalogue.entries ?? {};
        const index = Math.max(catalogue.lastNoteIndex ?? 0, IdeaWorkshop.getEntryIndexMax(entries, "note")) + 1;
        catalogue.lastNoteIndex = index;
        await IdeaWorkshop.writeCatalogue(name, catalogue);
        return String(index);
    }
    IdeaWorkshop.nextNoteIndex = nextNoteIndex;
    async function syncEntryIndex(name, key) {
        const parsed = IdeaWorkshop.parseEntryIndex(key);
        if (parsed == null) {
            return;
        }
        const catalogue = await IdeaWorkshop.readCatalogue(name);
        if (parsed.kind == "excerpt") {
            catalogue.lastExcerptIndex = Math.max(catalogue.lastExcerptIndex ?? 0, parsed.index);
        }
        else {
            catalogue.lastNoteIndex = Math.max(catalogue.lastNoteIndex ?? 0, parsed.index);
        }
        await IdeaWorkshop.writeCatalogue(name, catalogue);
    }
    IdeaWorkshop.syncEntryIndex = syncEntryIndex;
    function parseEntryIndex(key) {
        const modern = key.match(/^\d{4}-\d{2}-\d{2}-(excerpt|note)-(\d+)/);
        if (modern) {
            return { kind: modern[1], index: Number(modern[2]) };
        }
        const legacy = key.match(/^(excerpt|notes|note)-(\d+)$/);
        if (legacy) {
            return { kind: legacy[1] == "excerpt" ? "excerpt" : "note", index: Number(legacy[2]) };
        }
        return null;
    }
    IdeaWorkshop.parseEntryIndex = parseEntryIndex;
    function getEntryIndexMax(entries, kind) {
        let max = 0;
        for (const key in entries) {
            const parsed = IdeaWorkshop.parseEntryIndex(key);
            if (parsed != null && parsed.kind == kind) {
                max = Math.max(max, parsed.index);
            }
        }
        return max;
    }
    IdeaWorkshop.getEntryIndexMax = getEntryIndexMax;
    function buildEntryName(date, kind, index, title) {
        const clean = IdeaWorkshop.titleToName(title);
        if (clean) {
            return `${date}-${kind}-${index}-${clean}`;
        }
        return `${date}-${kind}-${index}`;
    }
    IdeaWorkshop.buildEntryName = buildEntryName;
    function renameKey(entry, title) {
        const date = entry.time ? DateUtil.toLocalDate(entry.time) : DateUtil.toLocalDate(Date.now());
        const titled = IdeaWorkshop.titleToName(title);
        if (titled) {
            return `${date}-${titled}`;
        }
        return date;
    }
    function titleToName(title) {
        const words = (title ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const joined = words.join("-");
        if (joined.length <= 80) {
            return joined;
        }
        const cut = joined.slice(0, 80);
        const lastDash = cut.lastIndexOf("-");
        return lastDash < 0 ? cut : cut.slice(0, lastDash);
    }
    IdeaWorkshop.titleToName = titleToName;
    function resolveTitle(value) {
        return (value ?? "").replace(/^["']+|["']+$/g, "").trim();
    }
    IdeaWorkshop.resolveTitle = resolveTitle;
    function parseCount(value) {
        if (value == null) {
            return null;
        }
        const count = parseInt(value);
        if (isNaN(count)) {
            return null;
        }
        return count;
    }
    IdeaWorkshop.parseCount = parseCount;
    function parseNamedArgs(args) {
        const fields = { name: null };
        let rest = TextUtil.parseMetaFields((args ?? "").trim(), fields);
        let name = fields["name"];
        if (name == null) {
            const match = rest.match(/^name=\s*(\S*)\s*([\s\S]*)$/);
            if (match) {
                name = match[1];
                rest = match[2];
            }
        }
        return { name: IdeaWorkshop.sanitizeName(name), rest: rest.trim() };
    }
    IdeaWorkshop.parseNamedArgs = parseNamedArgs;
    function sanitizeName(value) {
        if (value == null) {
            return null;
        }
        const name = value.replace(/[\/\\\s]+/g, "-").trim();
        if (name == "" || name == "." || name == ".." || name == "INBOX") {
            return null;
        }
        return name;
    }
    IdeaWorkshop.sanitizeName = sanitizeName;
    function ideaPath(name) {
        return NodeUtil.getPath(IdeaWorkshop.rootPath, name);
    }
    IdeaWorkshop.ideaPath = ideaPath;
    function ideaCataloguePath(name) {
        return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), "catalogue.json");
    }
    IdeaWorkshop.ideaCataloguePath = ideaCataloguePath;
    function summaryPath(name) {
        return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), "summary.txt");
    }
    IdeaWorkshop.summaryPath = summaryPath;
    function descriptionPath(name) {
        return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), "description.txt");
    }
    IdeaWorkshop.descriptionPath = descriptionPath;
    function entryPath(name, key) {
        const safeKey = NodeUtil.path.basename(key);
        return NodeUtil.getPath(IdeaWorkshop.ideaPath(name), `${safeKey}.txt`);
    }
    IdeaWorkshop.entryPath = entryPath;
    function resultEntry(name, content) {
        return { type: "message", time: Date.now(), role: "env", name, content };
    }
    IdeaWorkshop.resultEntry = resultEntry;
    function infoEntry(content) {
        return { type: "message", time: Date.now(), role: "info", name: "idea", content };
    }
    IdeaWorkshop.infoEntry = infoEntry;
})(IdeaWorkshop || (IdeaWorkshop = {}));
var DreamWorkshop;
(function (DreamWorkshop) {
    DreamWorkshop.rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Dream");
    DreamWorkshop.settingsPath = NodeUtil.getPath(DreamWorkshop.rootPath, "settings.json");
    DreamWorkshop.defaultSettings = {
        enabled: true,
        interval: "1d",
        memoryCount: 5,
        sentenceCount: 3,
        reducePrompt: "Reduce these fragments into short associative notes, plain text, no formatting.\n\n{{sentences}}",
        dreamPrompt: "Write a dream from these bits and pieces, plain text, no formatting.\n\nBITS AND PIECES:\n{{fragments}}"
    };
    function getActions(params) {
        if (params.dream.enabled) {
            return {
                dream: {
                    dream: dreamAction
                }
            };
        }
        return {};
    }
    DreamWorkshop.getActions = getActions;
    async function getPromptParts(params) {
        if (params.dream.enabled == false) {
            return [];
        }
        return [{
                variable: "ACTIONS",
                description: "Dream actions",
                content: `Dream Actions:
Dream from your memories:
@dream-dream`
            }];
    }
    DreamWorkshop.getPromptParts = getPromptParts;
    async function initialize() {
        await NodeUtil.makeDirPromise(DreamWorkshop.rootPath, { recursive: true });
        const existed = await FileUtil.exists(DreamWorkshop.settingsPath);
        await SettingsUtil.ensure(DreamWorkshop.settingsPath, DreamWorkshop.defaultSettings);
        if (existed == false) {
            for (const arkName of await ArkUtil.getArkNames()) {
                await DreamWorkshop.scheduleArk(arkName);
            }
        }
    }
    DreamWorkshop.initialize = initialize;
    async function readSettings() {
        return SettingsUtil.read(DreamWorkshop.settingsPath, DreamWorkshop.defaultSettings);
    }
    DreamWorkshop.readSettings = readSettings;
    async function editSettings(overrides) {
        return SettingsUtil.edit(DreamWorkshop.settingsPath, overrides, DreamWorkshop.defaultSettings);
    }
    DreamWorkshop.editSettings = editSettings;
    async function resolveSettings(arkName) {
        const global = await DreamWorkshop.readSettings();
        const ark = await ArkUtil.readArkSettings(arkName);
        return SettingsUtil.mergeAll(global, ark.dream);
    }
    DreamWorkshop.resolveSettings = resolveSettings;
    async function scheduleArk(arkName) {
        const settings = await DreamWorkshop.resolveSettings(arkName);
        const interval = settings.interval || DreamWorkshop.defaultSettings.interval;
        const millis = DateUtil.durationMillis(interval) ?? 86400000;
        const next = DateUtil.formatWhen({ time: Date.now() + millis, hasTime: true });
        await WorkshopUtil.scheduleAt(`dream-${arkName}`, next, "dream", { arkName }, interval);
    }
    DreamWorkshop.scheduleArk = scheduleArk;
    async function onWakeUp(params) {
        const arkName = params?.arkName;
        if (arkName == null) {
            return;
        }
        const arks = await ArkUtil.getArkNames();
        if (arks.includes(arkName) == false) {
            await WorkshopUtil.removeSchedule(`dream-${arkName}`);
            return;
        }
        const silentID = `dream-${arkName}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const silent = new AgoraStreamer(silentID, null);
        try {
            const base = await ParamsUtil.getBaseParams(`dream-${arkName}`, silent);
            const dreams = await ParamsUtil.setArkSettings(base, arkName);
            dreams.process = { ...dreams.process, arkName };
            dreams.chatID = `dream-${arkName}`;
            await runDream(dreams, null);
        }
        catch (error) {
            console.warn(error);
        }
        finally {
            AgoraStreamer.end(silentID);
        }
    }
    DreamWorkshop.onWakeUp = onWakeUp;
    async function dreamAction(params, entry, args) {
        if (params.dream.enabled == false) {
            return DreamWorkshop.infoEntry("Dream workshop is disabled.");
        }
        const result = await runDream(params, params.handler);
        if (result == null) {
            return DreamWorkshop.infoEntry("No dream was generated.");
        }
        return null;
    }
    DreamWorkshop.dreamAction = dreamAction;
    async function runDream(params, infoHandler) {
        const settings = params.dream;
        if (settings.enabled == false) {
            return null;
        }
        if (params.memory.allowWrite == false) {
            if (infoHandler) {
                infoHandler.streamInfo("Memory writing is disabled.");
            }
            return null;
        }
        if (params.memory.allowRead == false) {
            if (infoHandler) {
                infoHandler.streamInfo("Memory reading is disabled.");
            }
            return null;
        }
        const arkName = params.process.arkName;
        if (infoHandler) {
            infoHandler.streamInfo("Dreaming:");
        }
        const selected = await selectMemories(arkName, settings.memoryCount);
        if (selected.length == 0) {
            if (infoHandler) {
                infoHandler.streamInfo("No memories to dream from.");
            }
            return null;
        }
        const sentences = [];
        for (const item of selected) {
            const content = await MemoryUtil.readMemoryFile(arkName, item.name);
            if (content == null) {
                continue;
            }
            const parts = splitSentences(content);
            sentences.push(...pickSentences(parts, settings.sentenceCount));
        }
        if (sentences.length == 0) {
            if (infoHandler) {
                infoHandler.streamInfo("No sentences to dream from.");
            }
            return null;
        }
        shuffle(sentences);
        const scrambled = sentences.join(" ");
        if (infoHandler) {
            infoHandler.streamInfo("Reducing dream material:");
        }
        const reducePrompt = await composePrompt(params, settings.reducePrompt, "sentences", scrambled);
        const reduceModel = ModelUtil.resolve(params, params.generate.smallModel);
        let fragments = (await GenerateUtil.generateRaw(params, reduceModel, [{ role: "user", content: reducePrompt }])).trim();
        if (fragments == "") {
            fragments = scrambled;
        }
        if (infoHandler) {
            infoHandler.streamInfo("Dreaming the dream:");
        }
        const dreamModel = ModelUtil.resolve(params, params.memory.model);
        const fields = {
            short: { name: "Short", description: "one line summary" },
            content: { description: "the dream itself" }
        };
        const systemParts = [];
        const modelPart = await GenerateUtil.createModelPart(params, dreamModel);
        if (modelPart) {
            systemParts.push(modelPart);
        }
        const basePrompt = await GenerateUtil.expandPrompt(params, params.generate.prompt ?? "");
        if (basePrompt) {
            systemParts.push(basePrompt);
        }
        const memories = await MemoryUtil.loadMemories(params, [{ type: "message", time: Date.now(), role: "user", name: "dream", content: fragments }], true);
        if (memories) {
            systemParts.push(memories);
        }
        const context = [];
        if (systemParts.length) {
            context.push({ role: "system", content: systemParts.join("\n\n") });
        }
        const dreamPrompt = await composePrompt(params, settings.dreamPrompt, "fragments", fragments, fields);
        context.push({ role: "user", content: dreamPrompt });
        const result = await GenerateUtil.generateRaw(params, dreamModel, context);
        const values = GenerateUtil.parseFields(result, fields);
        const paragraph = (values.content ?? "").trim();
        if (paragraph == "") {
            if (infoHandler) {
                infoHandler.streamInfo("Dream produced no text.");
            }
            return null;
        }
        const short = values.short?.trim() || TextUtil.shortifyLineNicely(paragraph.replace(/\s+/g, " "), 200);
        const weight = Math.max(1, ...selected.map(item => item.weight));
        const time = Date.now();
        const entry = { source: `dream-${arkName}`, short, start: time, end: time, weight };
        const name = await MemoryUtil.saveMemory(arkName, paragraph, entry);
        return name;
    }
    async function composePrompt(params, template, key, value, fields = null) {
        const token = `\u0000${key.toUpperCase()}\u0000`;
        template = template.split(`{{${key}}}`).join(token);
        const result = await GenerateUtil.expandPrompt(params, template, fields);
        return result.split(token).join(value);
    }
    async function selectMemories(arkName, limit) {
        const candidates = [];
        for (const name of await MemoryUtil.listMemories(arkName)) {
            if (name.startsWith("active-")) {
                continue;
            }
            const entry = await MemoryUtil.readCatalogueEntry(arkName, name);
            const weight = Math.max(1, entry?.weight ?? 1);
            candidates.push({ name, weight });
        }
        const count = Math.max(0, Math.floor(limit));
        const result = [];
        while (result.length < count && candidates.length) {
            const name = pickWeighted(candidates);
            for (let i = 0; i < candidates.length; ++i) {
                if (candidates[i].name == name) {
                    result.push(candidates[i]);
                    candidates.splice(i, 1);
                    break;
                }
            }
        }
        return result;
    }
    function pickWeighted(items) {
        let total = 0;
        for (const item of items) {
            total += item.weight;
        }
        let value = Math.random() * total;
        for (const item of items) {
            value -= item.weight;
            if (value < 0) {
                return item.name;
            }
        }
        return items[items.length - 1].name;
    }
    function splitSentences(content) {
        const text = content.replace(/\s+/g, " ").trim();
        const matches = text.match(/[^.!?]+[.!?]+/g) ?? [];
        const result = [];
        for (const match of matches) {
            const sentence = match.trim();
            if (sentence) {
                result.push(sentence);
            }
        }
        if (result.length == 0 && text) {
            result.push(text);
        }
        return result;
    }
    function pickSentences(sentences, count) {
        const result = [];
        const available = sentences.slice();
        const limit = Math.max(0, Math.floor(count));
        while (result.length < limit && available.length) {
            const index = Math.floor(Math.random() * available.length);
            result.push(available.splice(index, 1)[0]);
        }
        return result;
    }
    function shuffle(items) {
        for (let i = items.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1));
            const value = items[i];
            items[i] = items[j];
            items[j] = value;
        }
    }
    function resultEntry(name, content) {
        return { type: "message", time: Date.now(), role: "env", name, content };
    }
    DreamWorkshop.resultEntry = resultEntry;
    function infoEntry(content) {
        return { type: "message", time: Date.now(), role: "info", name: "dream", content };
    }
    DreamWorkshop.infoEntry = infoEntry;
})(DreamWorkshop || (DreamWorkshop = {}));
var ActionsUtil;
(function (ActionsUtil) {
    ActionsUtil.defaultSettings = {
        enabled: true,
        generate: true,
        prompt: "Summarize the following information, concise, clear, plain text, no formatting."
    };
    async function processMessage(params, entry, output) {
        const matches = entry.content.matchAll(/^@([\w]+)-([\w-]+)(?:[\t ]+(.+)|[\t ]+()|())/gm);
        for (const match of matches) {
            const result = await executeAction(params, entry, match[1], match[2], match[3]);
            if (typeof result == "string") {
                const entry = await processResult(params, match[1], match[2], result);
                output.push(entry);
            }
            else if (result == null) {
                continue;
            }
            else if (result.type == "message") {
                params.handler.streamEntry(result);
                output.push(result);
            }
            else {
                const name = `result of ${match[1]}-${match[2]} action`;
                const message = { type: "message", time: Date.now(), role: "env", name, content: "" };
                params.handler.streamEntry(message);
                output.push(message);
                params.handler.streamEntry(result);
                output.push(result);
            }
        }
    }
    ActionsUtil.processMessage = processMessage;
    async function executeAction(params, entry, groupName, actionName, args) {
        const actionGroup = WorkshopUtil.gatherActions(params)[groupName];
        if (actionGroup == null) {
            return reportError(`action group ${groupName} does not exist`);
        }
        const actionHandler = actionGroup[actionName];
        if (actionHandler == null) {
            return reportError(`action ${actionName} does not exist in group ${groupName}`);
        }
        try {
            return await actionHandler(params, entry, args);
        }
        catch (error) {
            console.warn(error);
            return reportError(`error during executing ${actionName} of ${groupName}`);
        }
    }
    async function processResult(params, group, action, result) {
        const source = `${group}-${action}`;
        params.handler.streamMessage("env", source, Date.now());
        if (params.actions.generate) {
            const model = ModelUtil.resolve(params, params.generate.smallModel);
            const prompt = await GenerateUtil.expandPrompt(params, params.actions.prompt);
            const context = [{ role: "system", content: prompt }, { role: "user", content: result }];
            result = await GenerateUtil.generateRaw(params, model, context);
            params.handler.streamRaw("\n");
        }
        else {
            params.handler.streamEscaped(result);
            params.handler.streamRaw("\n");
        }
        result = result.trim();
        return { type: "message", time: Date.now(), role: "env", name: source, content: result };
    }
    function reportError(content) {
        console.warn(content);
        return { type: "message", time: Date.now(), role: "env", name: "actions", content };
    }
})(ActionsUtil || (ActionsUtil = {}));
var WorkshopUtil;
(function (WorkshopUtil) {
    WorkshopUtil.defaultSettings = {
        interval: "1h",
        schedules: {}
    };
    const settingsProviders = {
        web: WebWorkshop,
        image: ImageWorkshop,
        document: DocumentWorkshop,
        todo: TODOWorkshop,
        idea: IdeaWorkshop,
        dream: DreamWorkshop
    };
    const chatProvider = {
        getActions: (params) => ProcessUtil.getActions(params),
        getPromptParts: (params) => ProcessUtil.getPromptParts(params)
    };
    const promptProviders = {
        web: WebWorkshop,
        image: ImageWorkshop,
        document: DocumentWorkshop,
        todo: TODOWorkshop,
        idea: IdeaWorkshop,
        dream: DreamWorkshop,
        memory: MemoryUtil,
        chat: chatProvider
    };
    const contextListeners = {
        memory: MemoryUtil,
        idea: IdeaWorkshop
    };
    const messageProcessors = {
        actions: ActionsUtil
    };
    const imageProcessors = {
        image: ImageWorkshop
    };
    const documentProcessors = {
        document: DocumentWorkshop
    };
    const actionHandlers = {
        web: WebWorkshop,
        image: ImageWorkshop,
        document: DocumentWorkshop,
        todo: TODOWorkshop,
        idea: IdeaWorkshop,
        dream: DreamWorkshop,
        chat: chatProvider
    };
    const scheduleHandlers = {
        "memory-main": MemoryUtil.onWakeUp,
        "image-main": ImageWorkshop.onWakeUp,
        "document-main": DocumentWorkshop.onWakeUp,
        "idea-main": IdeaWorkshop.onWakeUp,
        "dream": DreamWorkshop.onWakeUp,
        "onSchedule": TODOWorkshop.onSchedule,
        "onRemind": TODOWorkshop.onRemind
    };
    const initializers = {
        web: WebWorkshop,
        image: ImageWorkshop,
        document: DocumentWorkshop,
        todo: TODOWorkshop,
        idea: IdeaWorkshop,
        dream: DreamWorkshop,
        memory: MemoryUtil
    };
    async function initialize() {
        for (const key in initializers) {
            await initializers[key].initialize();
        }
        await startScheduler();
    }
    WorkshopUtil.initialize = initialize;
    async function getSettings() {
        const result = {};
        for (const key in settingsProviders) {
            result[key] = await settingsProviders[key].readSettings();
        }
        return result;
    }
    WorkshopUtil.getSettings = getSettings;
    async function getPromptParts(params) {
        const result = [];
        for (const key in promptProviders) {
            const parts = await promptProviders[key].getPromptParts(params);
            result.push(...parts);
        }
        return result;
    }
    WorkshopUtil.getPromptParts = getPromptParts;
    async function getPromptVariables(params) {
        const groups = {};
        for (const part of await WorkshopUtil.getPromptParts(params)) {
            if (part.variable == null || part.content == null || part.content == "") {
                continue;
            }
            if (groups[part.variable] == null) {
                groups[part.variable] = [];
            }
            groups[part.variable].push(part.content);
        }
        const result = { ACTIONS: "" };
        for (const variable in groups) {
            result[variable] = groups[variable].join("\n\n");
        }
        return result;
    }
    WorkshopUtil.getPromptVariables = getPromptVariables;
    async function onUpdate(params, context) {
        for (const key in contextListeners) {
            if (isEnabled(params, key)) {
                await contextListeners[key].onUpdate(params, context);
            }
        }
    }
    WorkshopUtil.onUpdate = onUpdate;
    async function onBlock(params, block) {
        for (const key in contextListeners) {
            if (isEnabled(params, key)) {
                await contextListeners[key].onBlock(params, block);
            }
        }
    }
    WorkshopUtil.onBlock = onBlock;
    async function onDelete(params) {
        for (const key in contextListeners) {
            await contextListeners[key].onDelete(params);
        }
    }
    WorkshopUtil.onDelete = onDelete;
    async function processMessage(params, entry, output) {
        for (const key in messageProcessors) {
            await messageProcessors[key].processMessage(params, entry, output);
        }
    }
    WorkshopUtil.processMessage = processMessage;
    async function processImage(params, entry) {
        for (const key in imageProcessors) {
            return await imageProcessors[key].processImage(params, entry);
        }
        return entry;
    }
    WorkshopUtil.processImage = processImage;
    async function processDocument(params, entry) {
        for (const key in documentProcessors) {
            return await documentProcessors[key].processDocument(params, entry);
        }
        return entry;
    }
    WorkshopUtil.processDocument = processDocument;
    async function convertArkImageEntry(params, entry, template, needsImage) {
        for (const key in imageProcessors) {
            return await imageProcessors[key].convertArkImage(params, entry, template, needsImage);
        }
        return { role: "user", content: ContextUtil.entryToText(entry, template) };
    }
    WorkshopUtil.convertArkImageEntry = convertArkImageEntry;
    async function convertArkDocumentEntry(params, entry, template, needsDocument) {
        for (const key in documentProcessors) {
            return await documentProcessors[key].convertArkDocument(params, entry, template, needsDocument);
        }
        return { role: "user", content: ContextUtil.entryToText(entry, template) };
    }
    WorkshopUtil.convertArkDocumentEntry = convertArkDocumentEntry;
    function gatherActions(params) {
        const result = {};
        for (const key in actionHandlers) {
            const actions = actionHandlers[key].getActions(params);
            for (const group in actions) {
                result[group] = actions[group];
            }
        }
        return result;
    }
    WorkshopUtil.gatherActions = gatherActions;
    async function scheduleEvery(call, repeat, params) {
        await setSchedule(call, { next: nextRound(), repeat, call, params });
    }
    WorkshopUtil.scheduleEvery = scheduleEvery;
    async function scheduleAt(id, next, call, params, repeat) {
        await setSchedule(id, { next, repeat, call, params });
    }
    WorkshopUtil.scheduleAt = scheduleAt;
    async function removeSchedule(id) {
        const lock = await Mutex.lock("WorkshopSchedules");
        try {
            const settings = await ChatUtil.readGlobalSettings();
            if (id in settings.workshop.schedules == false) {
                return false;
            }
            const schedules = { ...settings.workshop.schedules };
            schedules[id] = null;
            const interval = settings.workshop.interval;
            await ChatUtil.editGlobalSettings({ workshop: { interval, schedules } });
            return true;
        }
        finally {
            lock.release();
        }
    }
    WorkshopUtil.removeSchedule = removeSchedule;
    function nextRound() {
        return DateUtil.formatWhen({ time: DateUtil.nextMinute(Date.now()), hasTime: true });
    }
    async function setSchedule(id, schedule) {
        const lock = await Mutex.lock("WorkshopSchedules");
        try {
            const settings = await ChatUtil.readGlobalSettings();
            if (id in settings.workshop.schedules && schedule.repeat) {
                return;
            }
            const schedules = { ...settings.workshop.schedules, [id]: schedule };
            const interval = settings.workshop.interval;
            await ChatUtil.editGlobalSettings({ workshop: { interval, schedules } });
        }
        finally {
            lock.release();
        }
    }
    async function startScheduler() {
        const settings = await ChatUtil.readGlobalSettings();
        setTimeout(tick, DateUtil.durationMillis(settings.workshop.interval) ?? 60000);
    }
    async function tick() {
        try {
            for (const schedule of await takeDueSchedules(Date.now())) {
                const handler = scheduleHandlers[schedule.call];
                if (handler) {
                    try {
                        await handler(schedule.params);
                    }
                    catch (error) {
                        console.error(error);
                    }
                }
            }
        }
        catch (error) {
            console.error(error);
        }
        const settings = await ChatUtil.readGlobalSettings();
        setTimeout(tick, DateUtil.durationMillis(settings.workshop.interval) ?? 60000);
    }
    async function takeDueSchedules(now) {
        const lock = await Mutex.lock("WorkshopSchedules");
        try {
            const settings = await ChatUtil.readGlobalSettings();
            const schedules = { ...settings.workshop.schedules };
            const due = [];
            let changed = false;
            for (const id in schedules) {
                const schedule = schedules[id];
                const time = DateUtil.whenTime(schedule.next);
                if (time == null || now < time) {
                    continue;
                }
                due.push(schedule);
                changed = true;
                if (schedule.repeat) {
                    schedules[id] = { ...schedule, next: DateUtil.advanceWhen(schedule.next, schedule.repeat, now) };
                }
                else {
                    schedules[id] = null;
                }
            }
            if (changed) {
                const interval = settings.workshop.interval;
                await ChatUtil.editGlobalSettings({ workshop: { interval, schedules } });
            }
            return due;
        }
        finally {
            lock.release();
        }
    }
    function isEnabled(params, key) {
        const group = params[key];
        if (group == null) {
            return false;
        }
        if (group.enabled == null) {
            return true;
        }
        return group.enabled == true;
    }
})(WorkshopUtil || (WorkshopUtil = {}));
var GenerateUtil;
(function (GenerateUtil) {
    const agoraPath = SettingsUtil.getLocation("/ThinkTank/Agora");
    const latestCount = 3;
    GenerateUtil.defaultSettings = {
        mainModel: "default",
        visionModel: "default",
        smallModel: "default",
        thinking: "label",
        prompt: "You are sharp, analytical, insightful, truth seeking, balanced. You write in plain text, no formatting."
    };
    async function expandPrompt(params, prompt, fields = null, extra = null) {
        const variables = await WorkshopUtil.getPromptVariables(params);
        if (extra) {
            for (const key in extra) {
                variables[key] = extra[key];
            }
        }
        variables.FIELDS = fields ? createFieldsPart(fields) ?? "" : "";
        let match;
        while (match = prompt.match(/\{\{([^{}]+)\}\}/)) {
            const outer = match[0];
            const inner = match[1];
            if (inner in variables) {
                prompt = prompt.replace(outer, variables[inner]);
            }
            else if (inner == "ARK") {
                prompt = prompt.replace(outer, params.process.arkName);
            }
            else if (inner == "USER") {
                prompt = prompt.replace(outer, params.process.userName);
            }
            else if (inner == "MODEL") {
                prompt = prompt.replace(outer, params.generate.mainModel);
            }
            else if (inner == "THINK") {
                prompt = prompt.replace(outer, String(params.generate.think));
            }
            else {
                const importPath = NodeUtil.getPath(agoraPath, inner);
                const importText = await FileUtil.readTextRAW(importPath);
                prompt = prompt.replace(outer, importText);
            }
        }
        return prompt;
    }
    GenerateUtil.expandPrompt = expandPrompt;
    function addSystemPrompt(entries, systemPrompt) {
        if (systemPrompt == null) {
            return entries;
        }
        if (entries.length == 0) {
            return [{ role: "system", content: systemPrompt }];
        }
        const head = entries[0];
        if (head.role == "system") {
            return [{ role: "system", content: `${head.content}\n\n${systemPrompt}` }, ...entries.slice(1)];
        }
        return [{ role: "system", content: systemPrompt }, ...entries];
    }
    GenerateUtil.addSystemPrompt = addSystemPrompt;
    function createFieldsPart(fields) {
        const lines = [];
        for (const key in fields) {
            const field = fields[key];
            if (field.name) {
                lines.push(`${field.name}: [${field.description}]`);
            }
            else {
                lines.push(`[${field.description}]`);
            }
        }
        if (lines.length) {
            return lines.join("\n");
        }
        return null;
    }
    GenerateUtil.createFieldsPart = createFieldsPart;
    async function generateRaw(params, model, context, speak = false) {
        const handler = params.handler;
        const speechHandler = {
            controller: handler.controller,
            checkAbort: handler.checkAbort,
            onChunk: handler.onChunk,
            onError: handler.onError,
            onSpeak: speak ? (chunk) => handler.onSpeak(chunk, params.tts) : null
        };
        return ChatService.generate({ ...model, thought: params.generate.thinking }, context, speechHandler);
    }
    GenerateUtil.generateRaw = generateRaw;
    async function generateFields(params, model, prompt, context, fields) {
        context = [...context];
        context = addSystemPrompt(context, await createModelPart(params, model));
        context = addSystemPrompt(context, await expandPrompt(params, prompt, fields));
        let result = await generateRaw(params, model, context, false);
        result = TextUtil.normalizeAll(result);
        return parseFields(result, fields);
    }
    GenerateUtil.generateFields = generateFields;
    async function generateMemory(params, block, fields) {
        const model = ModelUtil.resolve(params, params.memory.model);
        const converted = await convertContext(params, block, model.vision ? "raw" : "none");
        const prompt = await expandPrompt(params, params.memory.prompt, fields);
        let context = [...converted];
        context = addSystemPrompt(context, await createModelPart(params, model));
        context = addSystemPrompt(context, await expandPrompt(params, params.generate.prompt));
        context.push({ role: "user", content: prompt });
        let result = await generateRaw(params, model, context, false);
        result = TextUtil.normalizeAll(result);
        return parseFields(result, fields);
    }
    GenerateUtil.generateMemory = generateMemory;
    async function generateMessage(params, context) {
        const model = resolveMessageModel(params, context);
        let converted = await convertContext(params, context, model.vision ? "latest" : "none");
        const prompt = await expandPrompt(params, params.generate.prompt);
        const memories = await MemoryUtil.loadMemories(params, context, true);
        converted = addSystemPrompt(converted, await createModelPart(params, model));
        converted = addSystemPrompt(converted, prompt);
        converted = addSystemPrompt(converted, memories);
        let result = await generateRaw(params, model, converted, true);
        return TextUtil.normalizeAll(result);
    }
    GenerateUtil.generateMessage = generateMessage;
    async function convertContext(params, context, imageMode) {
        const gapHandler = params.process.useClock ? new DateGapHandler(1800000, 300000, 300000) : null;
        const template = { ...ContextUtil.arkTemplate, gapHandler };
        const result = [];
        let documentCount = 0;
        let imageCount = 0;
        let i = context.length;
        while (i--) {
            const entry = context[i];
            const fullDocument = documentCount < params.document.rawCount;
            const fullImage = shouldResolveImage(imageMode, entry, imageCount);
            result.unshift(await convertEntry(params, template, fullDocument, fullImage, entry));
            if (entry.type == "image") {
                ++imageCount;
            }
            if (entry.type == "document") {
                ++documentCount;
            }
        }
        return result;
    }
    GenerateUtil.convertContext = convertContext;
    async function convertEntry(params, template, useFullDocument, useFullImage, entry) {
        if (entry.type == "message") {
            return convertMessage(entry, params.process.arkName, template);
        }
        if (entry.type == "image") {
            return await WorkshopUtil.convertArkImageEntry(params, entry, template, useFullImage);
        }
        return await WorkshopUtil.convertArkDocumentEntry(params, entry, template, useFullDocument);
    }
    function convertMessage(entry, arkName, template) {
        if (entry.name == arkName) {
            return { role: "assistant", content: entry.content };
        }
        return { role: "user", content: ContextUtil.entryToText(entry, template) };
    }
    function shouldResolveImage(mode, entry, count) {
        if (entry.type == "image") {
            if (mode == "raw") {
                return entry.name == "raw";
            }
            if (mode == "latest") {
                return count < latestCount;
            }
        }
        return false;
    }
    function resolveMessageModel(params, context) {
        const main = ModelUtil.resolve(params, params.generate.mainModel);
        if (main.vision) {
            return main;
        }
        const vision = ModelUtil.resolve(params, params.generate.visionModel);
        if (vision.vision && lastTurnHasImage(context)) {
            return vision;
        }
        return main;
    }
    function lastTurnHasImage(context) {
        for (let index = context.length - 1; index >= 0; --index) {
            const entry = context[index];
            if (entry.type == "image") {
                return true;
            }
            if (entry.role == "user") {
                break;
            }
        }
        return false;
    }
    function parseFields(response, fields) {
        const values = {};
        for (const key in fields) {
            const field = fields[key];
            if (field.name) {
                values[field.name] = field.value;
            }
        }
        const remainder = TextUtil.parseLineFields(response, values);
        const result = {};
        for (const key in fields) {
            const field = fields[key];
            if (field.name) {
                result[key] = values[field.name];
            }
            else {
                result[key] = remainder;
            }
        }
        return result;
    }
    GenerateUtil.parseFields = parseFields;
    async function createModelPart(params, model) {
        if (model.tweak == null || model.tweak == "") {
            return null;
        }
        return expandPrompt(params, model.tweak);
    }
    GenerateUtil.createModelPart = createModelPart;
})(GenerateUtil || (GenerateUtil = {}));
var ProcessAlt;
(function (ProcessAlt) {
    function remember() {
    }
    function forget() {
    }
    function update() {
    }
    function sendMessage() {
    }
    function replyMessage() {
    }
})(ProcessAlt || (ProcessAlt = {}));
var ProcessUtil;
(function (ProcessUtil) {
    ProcessUtil.defaultSettings = {
        userName: "User",
        arkName: "Nemo",
        urgempt: `Score how urgently each participant should respond next.\n\nMemories:\n{{memories}}\n\nChat:\n{{chat}}\n\nOutput format:\n{{FIELDS}}`,
        useClock: true,
        useArchive: true,
        minContextCount: 5,
        minContextSize: 51200,
        minBlockSize: 2560
    };
    const overdueWeight = 3;
    const overdueWidth = 5;
    const randomWeight = 1;
    const memoryLimit = 12;
    const contextLimit = 12;
    function getActions(params) {
        return {
            chat: {
                call: callAction,
                leave: leaveAction
            }
        };
    }
    ProcessUtil.getActions = getActions;
    async function getPromptParts(params) {
        return [{
                variable: "ACTIONS",
                description: "Chat actions",
                content: `Chat Actions:
Invite an ark into the chat (user only):
@chat-call <arkName>
Leave the chat (arks only):
@chat-leave`
            }];
    }
    ProcessUtil.getPromptParts = getPromptParts;
    async function callAction(params, entry, name) {
        if (entry.role == "user") {
            name = (name ?? "").trim();
            if (name == params.process.userName) {
                return reportEntry("chat-call", `${name} is user`);
            }
            if (params.members.includes(name)) {
                return reportEntry("chat-call", `${name} already here`);
            }
            const arkList = await ArkUtil.getArkNames();
            if (arkList.includes(name)) {
                params.members.push(name);
                await ChatUtil.editChatSettings(params.chatID, { members: params.members });
                return reportEntry("chat-call", `${name} joined`);
            }
            return reportEntry("chat-call", `no ${name} known`);
        }
        return reportEntry("chat-call", `only user is allowed to call new members in`);
    }
    ProcessUtil.callAction = callAction;
    async function leaveAction(params, entry, args) {
        if (entry.role == "ark") {
            if (entry.name == params.process.arkName) {
                return reportEntry("chat-leave", `${entry.name} is not allowed to leave`);
            }
            const index = params.members.indexOf(entry.name);
            if (index < 0) {
                return reportEntry("chat-leave", `${entry.name} not in the list of members`);
            }
            params.members.splice(index, 1);
            await ChatUtil.editChatSettings(params.chatID, { members: params.members });
            return reportEntry("chat-leave", `${entry.name} left`);
        }
        return reportEntry("chat-leave", `user is not allowed to leave the chat`);
    }
    ProcessUtil.leaveAction = leaveAction;
    async function remember(params) {
        const context = await ContextUtil.loadActive(params.chatID);
        await handleEnding(params, context);
    }
    ProcessUtil.remember = remember;
    async function forget(params) {
        MemoryUtil.removeChatMemories(params.chatID);
    }
    ProcessUtil.forget = forget;
    async function update(params) {
        const context = await ContextUtil.loadActive(params.chatID);
        WorkshopUtil.onUpdate(params, context);
    }
    ProcessUtil.update = update;
    async function archive(params, remember) {
        const context = await ContextUtil.loadActive(params.chatID);
        if (remember) {
            await handleEnding(params, [...context]);
        }
        else {
            await MemoryUtil.removeChatMemories(params.chatID);
        }
        if (context.length) {
            await ContextUtil.editArchive(params.chatID, Infinity, context);
        }
        await ContextUtil.writeActive(params.chatID, []);
        await ProcessUtil.update(params);
        const time = Date.now();
        await ChatUtil.editChatSettings(params.chatID, { updated: time, viewed: time, archived: true });
    }
    ProcessUtil.archive = archive;
    async function replyMessage(params) {
        const context = await ContextUtil.loadActive(params.chatID);
        const time = Date.now();
        const speaker = await nextSpeaker(params, context);
        if (speaker == null || speaker == params.process.userName) {
            return;
        }
        const speakerParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, speaker);
        params.handler.streamMessage("ark", speaker, time);
        const message = await GenerateUtil.generateMessage(speakerParams, context);
        params.handler.flushSpeech();
        if (message) {
            params.handler.streamRaw("\n");
            await ProcessUtil.sendMessage(speakerParams, "ark", speaker, message, [], []);
        }
    }
    ProcessUtil.replyMessage = replyMessage;
    async function sendMessage(params, role, name, content, images, documents) {
        const input = await createInput(role, name, content, images, documents);
        const processed = await processInput(params, name, input);
        const context = await addToContext(params, processed);
        const time = Date.now();
        if (processed.length) {
            if (params.handler.hasStream()) {
                await ChatUtil.editChatSettings(params.chatID, { updated: time, viewed: time });
            }
            else {
                await ChatUtil.editChatSettings(params.chatID, { updated: time });
            }
        }
        const speaker = await nextSpeaker(params, context);
        if (speaker == null || speaker == params.process.userName) {
            return;
        }
        const speakerParams = await ParamsUtil.getCombinedParams(params.chatID, params.handler, speaker);
        params.handler.streamMessage("ark", speaker, time);
        const message = await GenerateUtil.generateMessage(speakerParams, context);
        params.handler.flushSpeech();
        if (message) {
            params.handler.streamRaw("\n");
            await ProcessUtil.sendMessage(speakerParams, "ark", speaker, message, [], []);
        }
    }
    ProcessUtil.sendMessage = sendMessage;
    async function createInput(role, name, content, images, documents) {
        const result = [];
        const time = Date.now();
        result.push({ type: "message", time, role, name, content });
        for (const image of images) {
            result.push({ type: "image", name: "raw", content: image });
        }
        for (const document of documents) {
            result.push({ type: "document", name: "raw", content: document });
        }
        return result;
    }
    ProcessUtil.createInput = createInput;
    async function processInput(params, name, input) {
        const result = [];
        for (let entry of input) {
            if (entry.type == "message") {
                result.push(entry);
                if (entry.role == "user") {
                    params.handler.streamEntry(entry);
                }
            }
            else {
                if (entry.type == "image") {
                    entry = await WorkshopUtil.processImage(params, entry);
                }
                else {
                    entry = await WorkshopUtil.processDocument(params, entry);
                }
                result.push(entry);
                params.handler.streamEntry(entry);
            }
        }
        for (let entry of input) {
            if (entry.type == "message") {
                await WorkshopUtil.processMessage(params, entry, result);
            }
        }
        return result;
    }
    async function addToContext(params, entries) {
        const context = await ContextUtil.loadActive(params.chatID);
        context.push(...entries);
        await checkSplit(params, context);
        await ContextUtil.writeActive(params.chatID, context);
        await WorkshopUtil.onUpdate(params, context);
        return context;
    }
    async function checkSplit(params, context) {
        if (params.process.useArchive == false) {
            return;
        }
        let messageCount = 0;
        let contextSize = 0;
        for (const entry of context) {
            if (entry.role == "user" || entry.role == "ark") {
                ++messageCount;
                contextSize += entry.content.length;
            }
        }
        let currentBlock = [];
        let blockSize = 0;
        while (contextSize > params.process.minContextSize) {
            const entry = context.shift();
            if (entry.role == "user" || entry.role == "ark") {
                if (blockSize > params.process.minBlockSize) {
                    await ContextUtil.editArchive(params.chatID, Infinity, currentBlock);
                    await WorkshopUtil.onBlock(params, currentBlock);
                    currentBlock = [];
                    blockSize = 0;
                }
                --messageCount;
                contextSize -= entry.content.length;
                blockSize += entry.content.length;
            }
            currentBlock.push(entry);
            if (messageCount < params.process.minContextCount) {
                break;
            }
        }
        if (currentBlock.length) {
            context.unshift(...currentBlock);
        }
    }
    async function handleEnding(params, context) {
        let contextSize = 0;
        for (const entry of context) {
            if (entry.type == "message") {
                contextSize += entry.content.length;
            }
        }
        let currentBlock = [];
        let blockSize = 0;
        while (contextSize > params.process.minBlockSize * 0.5) {
            const entry = context.shift();
            if (entry.type == "message") {
                if (blockSize > params.process.minBlockSize) {
                    await WorkshopUtil.onBlock(params, currentBlock);
                    currentBlock = [];
                    blockSize = 0;
                }
                contextSize -= entry.content.length;
                blockSize += entry.content.length;
            }
            currentBlock.push(entry);
        }
        context.unshift(...currentBlock);
        if (context.length) {
            await WorkshopUtil.onBlock(params, context);
        }
    }
    async function nextSpeaker(params, context) {
        if (AgoraStreamer.checkRaised(params.chatID)) {
            return params.process.userName;
        }
        if (params.members.length < 3) {
            return privateChatNext(params, context);
        }
        return groupChatNext(params, context);
    }
    function privateChatNext(params, context) {
        let index = context.length;
        while (index) {
            --index;
            const entry = context[index];
            if (entry.role == "env") {
                return params.process.arkName;
            }
            if (entry.role == "user") {
                return params.process.arkName;
            }
            if (entry.role == "ark") {
                return params.process.userName;
            }
        }
        return params.process.userName;
    }
    async function groupChatNext(params, context) {
        const members = collectMembers(params, context);
        const urgencies = await inferUrgencies(params, context) ?? {};
        let maxScore = -Infinity;
        let maxName = params.process.userName;
        for (const name of params.members) {
            const urgency = urgencies[name] ?? 3;
            const index = members[name];
            const x = index / params.members.length;
            const overdue = 1 - 1 / (1 + Math.pow(x / overdueWidth, 3));
            const random = Math.random() * randomWeight;
            const score = urgency + overdue * overdueWeight + random;
            if (maxScore < score) {
                maxScore = score;
                maxName = name;
            }
        }
        return maxName;
    }
    function collectMembers(params, messages) {
        const turns = [];
        for (const message of messages) {
            if (message.role == "user" || message.role == "ark") {
                turns.push(message);
            }
        }
        const members = {};
        for (const name of params.members) {
            members[name] = 0;
        }
        let index = turns.length;
        while (index--) {
            const message = turns[index];
            if (members[message.name] == 0) {
                members[message.name] = index;
            }
        }
        for (const name in members) {
            members[name] = turns.length - members[name] - 1;
        }
        return members;
    }
    async function inferUrgencies(params, context) {
        try {
            const fields = {};
            for (const name of params.members) {
                fields[name] = { name, description: "urgency as one digit from 0 to 9" };
            }
            const model = ModelUtil.resolve(params, params.generate.smallModel);
            const handler = new AgoraStreamer(`${params.chatID}.urgency`, null);
            const prompt = await GenerateUtil.expandPrompt(params, params.process.urgempt, fields);
            const content = await buildUrgencyContent(params, context);
            const values = await GenerateUtil.generateFields({ ...params, handler }, model, prompt, [{ role: "user", content }], fields);
            console.warn("Urgencies:", values);
            const result = {};
            for (const name of params.members) {
                const value = parseInt(values[name]);
                result[name] = isNaN(value) ? 3 : value;
            }
            return result;
        }
        catch (error) {
            console.warn(error);
            return null;
        }
    }
    async function buildUrgencyContent(params, context) {
        const parts = [];
        for (const name of params.members) {
            if (name == params.process.userName) {
                continue;
            }
            const memories = await MemoryUtil.loadShortMemories(name, context, memoryLimit);
            if (memories.length == 0) {
                continue;
            }
            memories.unshift(name);
            parts.push(memories.join("\n"));
        }
        const memories = parts.join("\n\n");
        const chatTemplate = {
            ...ContextUtil.archiveTemplate,
            lineCount: 3,
            lineLength: 200,
            delimeter: "\n",
            user: "{{name}}:\n{{content}}",
            ark: "{{name}}:\n{{content}}",
            env: "Result:\n{{content}}"
        };
        const history = ContextUtil.contextToText(context, chatTemplate, contextLimit);
        return `Memories:\n\n${memories}\n\nHistory:\n\n${history}`;
    }
    function reportEntry(name, content) {
        return { type: "message", time: Date.now(), role: "env", name, content };
    }
})(ProcessUtil || (ProcessUtil = {}));
var ChatUtil;
(function (ChatUtil) {
    const globalSettingsPath = SettingsUtil.getLocation("/ThinkTank/Agora/settings.json");
    const defaultGlobalSettings = {
        lastIndex: 0,
        workshop: WorkshopUtil.defaultSettings,
        process: ProcessUtil.defaultSettings,
        generate: GenerateUtil.defaultSettings,
        memory: MemoryUtil.defaultSettings,
        actions: ActionsUtil.defaultSettings,
        tts: TTSService.defaultSettings
    };
    const chatsPath = SettingsUtil.getLocation("/ThinkTank/Agora/Chats");
    const defaultChatSettings = {
        title: "untitled",
        created: 0,
        updated: 0,
        viewed: 0,
        archived: false,
        members: null
    };
    async function initialize() {
        await NodeUtil.makeDirPromise(chatsPath, { recursive: true });
        await SettingsUtil.ensure(globalSettingsPath, defaultGlobalSettings);
    }
    ChatUtil.initialize = initialize;
    async function readGlobalSettings() {
        return SettingsUtil.read(globalSettingsPath, defaultGlobalSettings);
    }
    ChatUtil.readGlobalSettings = readGlobalSettings;
    async function editGlobalSettings(overrides) {
        return SettingsUtil.edit(globalSettingsPath, overrides, defaultGlobalSettings);
    }
    ChatUtil.editGlobalSettings = editGlobalSettings;
    async function readChatSettings(chatID) {
        const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
        return SettingsUtil.read(settingsPath, defaultChatSettings);
    }
    ChatUtil.readChatSettings = readChatSettings;
    async function editChatSettings(chatID, overrides) {
        const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
        return SettingsUtil.edit(settingsPath, overrides, defaultChatSettings);
    }
    ChatUtil.editChatSettings = editChatSettings;
    async function getChatMetas() {
        const result = [];
        for (const chatID of await LibraryUtil.listFoldersWithSettings(chatsPath)) {
            const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
            const settingsData = await FileUtil.readJSONLocked(settingsPath);
            if (settingsData) {
                result.push({
                    chatID,
                    title: settingsData.title,
                    created: settingsData.created,
                    updated: settingsData.updated,
                    viewed: settingsData.viewed,
                    archived: settingsData.archived == true
                });
            }
        }
        return result;
    }
    ChatUtil.getChatMetas = getChatMetas;
    async function existsChat(chatID) {
        const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
        return FileUtil.exists(settingsPath);
    }
    ChatUtil.existsChat = existsChat;
    async function isChatAvailable(chatID) {
        if (chatID == null) {
            return false;
        }
        if (await existsChat(chatID) == false) {
            return false;
        }
        const settings = await readChatSettings(chatID);
        return settings.archived == false;
    }
    ChatUtil.isChatAvailable = isChatAvailable;
    async function latestChat() {
        let result = null;
        let updated = 0;
        for (const meta of await getChatMetas()) {
            if (meta.archived) {
                continue;
            }
            if (updated < meta.updated) {
                updated = meta.updated;
                result = meta.chatID;
            }
        }
        return result;
    }
    ChatUtil.latestChat = latestChat;
    async function createMeta() {
        const { year, month, day, time, padded } = await LibraryUtil.nextParts(globalSettingsPath);
        return {
            chatID: `${year}-${month}-${day}-${padded}`,
            title: `Chat ${year}-${month} ${padded}`,
            created: time,
            updated: time,
            viewed: time,
            archived: false
        };
    }
    async function createChat() {
        const chatMeta = await createMeta();
        const chatFolder = NodeUtil.getPath(chatsPath, chatMeta.chatID);
        await NodeUtil.makeDirPromise(chatFolder, { recursive: true });
        await editChatSettings(chatMeta.chatID, {
            title: chatMeta.title,
            created: chatMeta.created,
            updated: chatMeta.updated,
            viewed: chatMeta.viewed
        });
        await ContextUtil.writeArchive(chatMeta.chatID, []);
        await ContextUtil.writeActive(chatMeta.chatID, []);
        return chatMeta;
    }
    ChatUtil.createChat = createChat;
    async function copyChat(sourceID, title) {
        const { chatID, created, updated, viewed } = await createMeta();
        const sourceFolder = NodeUtil.getPath(chatsPath, sourceID);
        const chatFolder = NodeUtil.getPath(chatsPath, chatID);
        await NodeUtil.makeDirPromise(chatFolder, { recursive: true });
        const sourceSettings = NodeUtil.getPath(sourceFolder, "settings.json");
        const settingsPath = NodeUtil.getPath(chatFolder, "settings.json");
        await NodeUtil.copyPromise(sourceSettings, settingsPath);
        const sourceArchive = NodeUtil.getPath(sourceFolder, "archive.json");
        const archivePath = NodeUtil.getPath(chatFolder, "archive.json");
        await NodeUtil.copyPromise(sourceArchive, archivePath);
        const sourceActive = NodeUtil.getPath(sourceFolder, "active.json");
        const activePath = NodeUtil.getPath(chatFolder, "active.json");
        await NodeUtil.copyPromise(sourceActive, activePath);
        await editChatSettings(chatID, {
            title,
            created,
            updated,
            viewed,
            archived: false,
            process: {
                useArchive: false
            },
            memory: {
                allowRead: false,
                allowWrite: false
            },
            idea: {
                enabled: false
            }
        });
        return { chatID, title, created, updated, viewed, archived: false };
    }
    ChatUtil.copyChat = copyChat;
    async function clearChat(chatID) {
        await ContextUtil.writeArchive(chatID, []);
        await ContextUtil.writeActive(chatID, []);
        const time = Date.now();
        await editChatSettings(chatID, { updated: time, viewed: time });
    }
    ChatUtil.clearChat = clearChat;
    async function deleteChat(chatID) {
        const chatFolder = NodeUtil.getPath(chatsPath, chatID);
        await NodeUtil.removePromise(chatFolder, { recursive: true });
    }
    ChatUtil.deleteChat = deleteChat;
    async function readContext(chatID) {
        const archiveContext = await ContextUtil.loadArchive(chatID);
        const activeContext = await ContextUtil.loadActive(chatID);
        const time = Date.now();
        await editChatSettings(chatID, { viewed: time });
        return [...archiveContext, ...activeContext];
    }
    ChatUtil.readContext = readContext;
    async function readTranscript(chatID) {
        const archiveContext = await ContextUtil.loadArchive(chatID) ?? [];
        const activeContext = await ContextUtil.loadActive(chatID) ?? [];
        const context = [...archiveContext, ...activeContext];
        const template = { ...ContextUtil.archiveTemplate, gapHandler: new DateGapHandler(1800000, 300000, 300000) };
        return TextUtil.normalizeAll(ContextUtil.contextToText(context, template, Infinity));
    }
    ChatUtil.readTranscript = readTranscript;
    async function editContext(chatID, index, entries) {
        const context = await ContextUtil.editActive(chatID, index, entries);
        const time = Date.now();
        await editChatSettings(chatID, { updated: time, viewed: time });
        return context;
    }
    ChatUtil.editContext = editContext;
    async function popMessage(chatID, role, shallow) {
        const context = await ContextUtil.loadActive(chatID);
        let images = [];
        let documents = [];
        let i = context.length;
        while (i--) {
            const entry = context[i];
            if (entry.role == role) {
                const message = { content: entry.content, images, documents };
                context.splice(i);
                await ContextUtil.writeActive(chatID, context);
                const time = Date.now();
                await editChatSettings(chatID, { updated: time, viewed: time });
                return message;
            }
            if (entry.type == "message") {
                images = [];
                documents = [];
                if (shallow) {
                    return {};
                }
            }
            else if (entry.type == "image") {
                if (entry.name == "raw") {
                    images.push(entry.content);
                }
            }
            else if (entry.type == "document") {
                if (entry.name == "raw") {
                    documents.push(entry.content);
                }
            }
        }
        return {};
    }
    ChatUtil.popMessage = popMessage;
    async function readRawGlobalSettings() {
        return FileUtil.readJSONLocked(globalSettingsPath);
    }
    ChatUtil.readRawGlobalSettings = readRawGlobalSettings;
    async function readRawChatSettings(chatID) {
        const settingsPath = NodeUtil.getPath(chatsPath, chatID, "settings.json");
        return FileUtil.readJSONLocked(settingsPath);
    }
    ChatUtil.readRawChatSettings = readRawChatSettings;
    async function setContextEntry(chatID, index, entry) {
        const context = await ContextUtil.setEntry(chatID, index, entry);
        const time = Date.now();
        await editChatSettings(chatID, { updated: time, viewed: time });
        return context;
    }
    ChatUtil.setContextEntry = setContextEntry;
})(ChatUtil || (ChatUtil = {}));
var AgoraUtil;
(function (AgoraUtil) {
    async function initialize() {
        await ArkUtil.initialize();
        await ChatUtil.initialize();
        await ModelUtil.initialize();
        await WorkshopUtil.initialize();
    }
    AgoraUtil.initialize = initialize;
    async function loadModels() {
        return ModelUtil.getModelOptions();
    }
    AgoraUtil.loadModels = loadModels;
    async function loadArks() {
        return ArkUtil.getArkNames();
    }
    AgoraUtil.loadArks = loadArks;
    async function loadChats() {
        return ChatUtil.getChatMetas();
    }
    AgoraUtil.loadChats = loadChats;
    async function createChat() {
        return ChatUtil.createChat();
    }
    AgoraUtil.createChat = createChat;
    async function copyChat(sourceID, title) {
        return ChatUtil.copyChat(sourceID, title);
    }
    AgoraUtil.copyChat = copyChat;
    async function clearChat(chatID, remember, response) {
        AgoraStreamer.abort(chatID);
        const lock = await Mutex.lock(chatID);
        try {
            const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
            if (remember) {
                await ProcessUtil.remember(params);
            }
            else {
                await ProcessUtil.forget(params);
            }
            await ChatUtil.clearChat(chatID);
            await ProcessUtil.update(params);
        }
        finally {
            AgoraStreamer.end(chatID);
            lock.release();
        }
    }
    AgoraUtil.clearChat = clearChat;
    async function deleteChat(chatID, remember, response) {
        AgoraStreamer.abort(chatID);
        const lock = await Mutex.lock(chatID);
        try {
            const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
            if (remember) {
                await ProcessUtil.remember(params);
            }
            else {
                await ProcessUtil.forget(params);
            }
            await ChatUtil.clearChat(chatID);
            await ProcessUtil.update(params);
            await ChatUtil.deleteChat(chatID);
        }
        finally {
            AgoraStreamer.end(chatID);
            lock.release();
        }
    }
    AgoraUtil.deleteChat = deleteChat;
    async function archiveChat(chatID, remember, response) {
        AgoraStreamer.abort(chatID);
        const lock = await Mutex.lock(chatID);
        try {
            const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
            await ProcessUtil.archive(params, remember);
        }
        finally {
            AgoraStreamer.end(chatID);
            lock.release();
        }
    }
    AgoraUtil.archiveChat = archiveChat;
    async function readGlobalSettings() {
        return ChatUtil.readGlobalSettings();
    }
    AgoraUtil.readGlobalSettings = readGlobalSettings;
    async function editGlobalSettings(settings) {
        return ChatUtil.editGlobalSettings(settings);
    }
    AgoraUtil.editGlobalSettings = editGlobalSettings;
    async function readChatSettings(chatID) {
        return ChatUtil.readChatSettings(chatID);
    }
    AgoraUtil.readChatSettings = readChatSettings;
    async function editChatSettings(chatID, overrides) {
        return ChatUtil.editChatSettings(chatID, overrides);
    }
    AgoraUtil.editChatSettings = editChatSettings;
    async function readArkSettings(arkName) {
        return ArkUtil.readArkSettings(arkName);
    }
    AgoraUtil.readArkSettings = readArkSettings;
    async function editArkSettings(arkName, overrides) {
        return ArkUtil.editArkSettings(arkName, overrides);
    }
    AgoraUtil.editArkSettings = editArkSettings;
    async function getCombinedSettings(chatID) {
        return ParamsUtil.getCombinedSettings(chatID);
    }
    AgoraUtil.getCombinedSettings = getCombinedSettings;
    async function readContext(chatID) {
        return ChatUtil.readContext(chatID);
    }
    AgoraUtil.readContext = readContext;
    async function getTranscript(chatID) {
        return ChatUtil.readTranscript(chatID);
    }
    AgoraUtil.getTranscript = getTranscript;
    async function editContext(chatID, index, entries) {
        AgoraStreamer.abort(chatID);
        const lock = await Mutex.lock(chatID);
        try {
            const params = await ParamsUtil.getCombinedParams(chatID, null);
            const context = await ChatUtil.editContext(chatID, index, entries);
            await ProcessUtil.update(params);
            return context;
        }
        finally {
            lock.release();
        }
    }
    AgoraUtil.editContext = editContext;
    async function popMessage(chatID, role, shallow) {
        AgoraStreamer.abort(chatID);
        const lock = await Mutex.lock(chatID);
        try {
            const params = await ParamsUtil.getCombinedParams(chatID, null);
            const context = await ChatUtil.popMessage(chatID, role, shallow);
            await ProcessUtil.update(params);
            return context;
        }
        finally {
            lock.release();
        }
    }
    AgoraUtil.popMessage = popMessage;
    async function sendMessage(chatID, content, images, documents, response) {
        const lock = await Mutex.lock(chatID);
        try {
            const settings = await ChatUtil.readChatSettings(chatID);
            if (settings.archived) {
                const handler = new AgoraStreamer(chatID, response);
                handler.streamInfo("Message sending to archived chat disabled.");
                return;
            }
            const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
            if (content == null) {
                await ProcessUtil.replyMessage(params);
            }
            else {
                await ProcessUtil.sendMessage(params, "user", params.process.userName, content, images, documents);
            }
        }
        finally {
            AgoraStreamer.end(chatID);
            lock.release();
        }
    }
    AgoraUtil.sendMessage = sendMessage;
    function raiseHand(chatID) {
        AgoraStreamer.raiseHand(chatID);
    }
    AgoraUtil.raiseHand = raiseHand;
    function abortChat(chatID) {
        AgoraStreamer.abort(chatID);
    }
    AgoraUtil.abortChat = abortChat;
    async function readRawGlobalSettings() {
        return ChatUtil.readRawGlobalSettings();
    }
    AgoraUtil.readRawGlobalSettings = readRawGlobalSettings;
    async function readRawChatSettings(chatID) {
        return ChatUtil.readRawChatSettings(chatID);
    }
    AgoraUtil.readRawChatSettings = readRawChatSettings;
    async function readRawArkSettings(arkName) {
        return ArkUtil.readRawArkSettings(arkName);
    }
    AgoraUtil.readRawArkSettings = readRawArkSettings;
    async function createArk(name) {
        const result = await ArkUtil.createArk(name);
        await DreamWorkshop.scheduleArk(name);
        return result;
    }
    AgoraUtil.createArk = createArk;
    async function removeArk(name) {
        await WorkshopUtil.removeSchedule(`dream-${name}`);
        return ArkUtil.removeArk(name);
    }
    AgoraUtil.removeArk = removeArk;
    async function setContextEntry(chatID, index, entry) {
        AgoraStreamer.abort(chatID);
        const lock = await Mutex.lock(chatID);
        try {
            const params = entry == null ? null : await ParamsUtil.getCombinedParams(chatID, null);
            const context = await ChatUtil.setContextEntry(chatID, index, entry);
            if (params) {
                await ProcessUtil.update(params);
            }
            return context;
        }
        finally {
            lock.release();
        }
    }
    AgoraUtil.setContextEntry = setContextEntry;
    async function listPrompts() {
        return PromptUtil.listPrompts();
    }
    AgoraUtil.listPrompts = listPrompts;
    async function readPrompt(arkName, name) {
        return PromptUtil.readPrompt(arkName, name);
    }
    AgoraUtil.readPrompt = readPrompt;
    async function writePrompt(arkName, name, content) {
        return PromptUtil.writePrompt(arkName, name, content);
    }
    AgoraUtil.writePrompt = writePrompt;
    async function listDocuments() {
        return DocumentWorkshop.listDocuments();
    }
    AgoraUtil.listDocuments = listDocuments;
    async function createDocument() {
        return DocumentWorkshop.createDocument();
    }
    AgoraUtil.createDocument = createDocument;
    async function renameDocument(oldName, newName) {
        return DocumentWorkshop.renameDocument(oldName, newName);
    }
    AgoraUtil.renameDocument = renameDocument;
    async function readDocumentEntry(name) {
        return DocumentWorkshop.readCatalogueEntry(name);
    }
    AgoraUtil.readDocumentEntry = readDocumentEntry;
    async function writeDocumentEntry(name, entry) {
        return DocumentWorkshop.writeCatalogueEntry(name, entry);
    }
    AgoraUtil.writeDocumentEntry = writeDocumentEntry;
    async function readDocumentFile(name, ext) {
        return DocumentWorkshop.readDocument(name, ext);
    }
    AgoraUtil.readDocumentFile = readDocumentFile;
    async function writeDocumentFile(name, ext, content) {
        return DocumentWorkshop.writeDocument(name, ext, content);
    }
    AgoraUtil.writeDocumentFile = writeDocumentFile;
    async function summarizeDocument(name, response) {
        return summarizeWith(response, params => DocumentWorkshop.summarizeDocument(params, name));
    }
    AgoraUtil.summarizeDocument = summarizeDocument;
    async function uploadDocument(ext, data) {
        return DocumentWorkshop.uploadDocument(ext, data);
    }
    AgoraUtil.uploadDocument = uploadDocument;
    async function removeDocument(name) {
        return DocumentWorkshop.removeDocument(name);
    }
    AgoraUtil.removeDocument = removeDocument;
    async function listMemories(arkName) {
        return MemoryUtil.listMemories(arkName);
    }
    AgoraUtil.listMemories = listMemories;
    async function readMemoryEntry(arkName, name) {
        return MemoryUtil.readCatalogueEntry(arkName, name);
    }
    AgoraUtil.readMemoryEntry = readMemoryEntry;
    async function writeMemoryEntry(arkName, name, entry) {
        return MemoryUtil.writeCatalogueEntry(arkName, name, entry);
    }
    AgoraUtil.writeMemoryEntry = writeMemoryEntry;
    async function readMemoryFile(arkName, name) {
        return MemoryUtil.readMemoryFile(arkName, name);
    }
    AgoraUtil.readMemoryFile = readMemoryFile;
    async function writeMemoryFile(arkName, name, content) {
        return MemoryUtil.writeMemoryFile(arkName, name, content);
    }
    AgoraUtil.writeMemoryFile = writeMemoryFile;
    async function createMemory(arkName) {
        return MemoryUtil.createMemory(arkName);
    }
    AgoraUtil.createMemory = createMemory;
    async function removeMemory(arkName, name) {
        return MemoryUtil.removeMemory(arkName, name);
    }
    AgoraUtil.removeMemory = removeMemory;
    async function listModels() {
        return ModelUtil.getModelNames();
    }
    AgoraUtil.listModels = listModels;
    async function readModel(name) {
        return ModelUtil.readModel(name);
    }
    AgoraUtil.readModel = readModel;
    async function writeModel(name, model) {
        return ModelUtil.writeModel(name, model);
    }
    AgoraUtil.writeModel = writeModel;
    async function createModel(name) {
        return ModelUtil.createModel(name);
    }
    AgoraUtil.createModel = createModel;
    async function renameModel(oldName, newName) {
        return ModelUtil.renameModel(oldName, newName);
    }
    AgoraUtil.renameModel = renameModel;
    async function removeModel(name) {
        return ModelUtil.removeModel(name);
    }
    AgoraUtil.removeModel = removeModel;
    async function listImages() {
        return ImageWorkshop.listImages();
    }
    AgoraUtil.listImages = listImages;
    async function readImageEntry(name) {
        return ImageWorkshop.readCatalogueEntry(name);
    }
    AgoraUtil.readImageEntry = readImageEntry;
    async function writeImageEntry(name, entry) {
        return ImageWorkshop.writeCatalogueEntry(name, entry);
    }
    AgoraUtil.writeImageEntry = writeImageEntry;
    async function uploadImage(ext, data) {
        return ImageWorkshop.uploadImage(ext, data);
    }
    AgoraUtil.uploadImage = uploadImage;
    async function renameImage(oldName, newName) {
        return ImageWorkshop.renameImage(oldName, newName);
    }
    AgoraUtil.renameImage = renameImage;
    async function removeImage(name) {
        return ImageWorkshop.removeImage(name);
    }
    AgoraUtil.removeImage = removeImage;
    async function summarizeImage(name, response) {
        return summarizeWith(response, params => ImageWorkshop.summarizeImage(params, name));
    }
    AgoraUtil.summarizeImage = summarizeImage;
    async function listTodos() {
        return TodoUtil.listTodos();
    }
    AgoraUtil.listTodos = listTodos;
    async function readTodo(name) {
        return TodoUtil.readTodo(name);
    }
    AgoraUtil.readTodo = readTodo;
    async function writeTodo(name, content) {
        return TodoUtil.writeTodo(name, content);
    }
    AgoraUtil.writeTodo = writeTodo;
    async function createTodo(name) {
        return TodoUtil.createTodo(name);
    }
    AgoraUtil.createTodo = createTodo;
    async function renameTodo(oldName, newName) {
        return TodoUtil.renameTodo(oldName, newName);
    }
    AgoraUtil.renameTodo = renameTodo;
    async function removeTodo(name) {
        return TodoUtil.removeTodo(name);
    }
    AgoraUtil.removeTodo = removeTodo;
    async function listIdeas() {
        return { ideas: await IdeaWorkshop.listIdeas(), inbox: await IdeaWorkshop.listInboxNames() };
    }
    AgoraUtil.listIdeas = listIdeas;
    async function createIdea(name, description) {
        return IdeaWorkshop.createIdea(name, description);
    }
    AgoraUtil.createIdea = createIdea;
    async function renameIdea(oldName, newName) {
        return IdeaWorkshop.renameIdea(oldName, newName);
    }
    AgoraUtil.renameIdea = renameIdea;
    async function renameIdeaEntry(name, key, title) {
        return IdeaWorkshop.renameEntry(name, key, title);
    }
    AgoraUtil.renameIdeaEntry = renameIdeaEntry;
    async function removeIdea(name) {
        return IdeaWorkshop.removeIdea(name);
    }
    AgoraUtil.removeIdea = removeIdea;
    async function readIdeaSettings() {
        const settings = await IdeaWorkshop.readSettings();
        delete settings.lastIndex;
        delete settings.prompt;
        return settings;
    }
    AgoraUtil.readIdeaSettings = readIdeaSettings;
    async function writeIdeaSettings(setting) {
        const clean = { ...setting };
        delete clean.lastIndex;
        delete clean.prompt;
        const result = await IdeaWorkshop.editSettings(clean);
        delete result.lastIndex;
        delete result.prompt;
        return result;
    }
    AgoraUtil.writeIdeaSettings = writeIdeaSettings;
    async function readIdeaSummary(name) {
        const summary = await IdeaWorkshop.readSummary(name);
        return summary ?? "";
    }
    AgoraUtil.readIdeaSummary = readIdeaSummary;
    async function writeIdeaSummary(name, content) {
        return IdeaWorkshop.writeSummary(name, content);
    }
    AgoraUtil.writeIdeaSummary = writeIdeaSummary;
    async function readIdeaDescription(name) {
        return IdeaWorkshop.readDescriptionFile(name);
    }
    AgoraUtil.readIdeaDescription = readIdeaDescription;
    async function writeIdeaDescription(name, content) {
        return IdeaWorkshop.writeDescription(name, content);
    }
    AgoraUtil.writeIdeaDescription = writeIdeaDescription;
    async function readIdeaCatalogue(name) {
        return IdeaWorkshop.readCatalogue(name);
    }
    AgoraUtil.readIdeaCatalogue = readIdeaCatalogue;
    async function writeIdeaCatalogue(name, catalogue) {
        return IdeaWorkshop.writeCatalogue(name, catalogue);
    }
    AgoraUtil.writeIdeaCatalogue = writeIdeaCatalogue;
    async function readIdeaEntry(name, key) {
        return IdeaWorkshop.readIdeaEntry(name, key);
    }
    AgoraUtil.readIdeaEntry = readIdeaEntry;
    async function writeIdeaEntry(name, key, content) {
        return IdeaWorkshop.writeIdeaEntry(name, key, content);
    }
    AgoraUtil.writeIdeaEntry = writeIdeaEntry;
    async function readIdeaInbox(name) {
        return IdeaWorkshop.readInbox(name);
    }
    AgoraUtil.readIdeaInbox = readIdeaInbox;
    async function writeIdeaInbox(name, content) {
        return IdeaWorkshop.writeInbox(name, content);
    }
    AgoraUtil.writeIdeaInbox = writeIdeaInbox;
    async function uploadIdeaInbox(data, sort, ext) {
        const name = ext ? await IdeaWorkshop.uploadInboxImage(ext, data) : await IdeaWorkshop.uploadInbox(data);
        if (name == null) {
            return null;
        }
        if (sort) {
            return { name, report: await IdeaWorkshop.sortInboxItem(name) };
        }
        return { name, report: null };
    }
    AgoraUtil.uploadIdeaInbox = uploadIdeaInbox;
    async function removeIdeaInbox(name) {
        return IdeaWorkshop.removeInbox(name);
    }
    AgoraUtil.removeIdeaInbox = removeIdeaInbox;
    async function summarizeIdea(name, key, response) {
        if (key) {
            return summarizeWith(response, params => IdeaWorkshop.summarizeEntry(params, name, key));
        }
        return summarizeWith(response, params => IdeaWorkshop.regenerateSummaries(params, [name]));
    }
    AgoraUtil.summarizeIdea = summarizeIdea;
    async function summarizeWith(response, task) {
        const silentID = `summarize-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const streamer = new AgoraStreamer(silentID, response);
        try {
            const params = await ParamsUtil.getGlobalParams(streamer);
            return await task(params);
        }
        finally {
            AgoraStreamer.end(silentID);
        }
    }
})(AgoraUtil || (AgoraUtil = {}));
var AgoraServer;
(function (AgoraServer) {
    async function handleModels(requestData, response) {
        return AgoraUtil.loadModels();
    }
    AgoraServer.handleModels = handleModels;
    async function handleArks(requestData, response) {
        return AgoraUtil.loadArks();
    }
    AgoraServer.handleArks = handleArks;
    async function handleChats(requestData, response) {
        return AgoraUtil.loadChats();
    }
    AgoraServer.handleChats = handleChats;
    async function handleCreate(requestData, response) {
        return AgoraUtil.createChat();
    }
    AgoraServer.handleCreate = handleCreate;
    async function handleCopy(requestData, response) {
        if (requestData.chatID) {
            return AgoraUtil.copyChat(requestData.chatID, requestData.title);
        }
        return null;
    }
    AgoraServer.handleCopy = handleCopy;
    async function handleClear(requestData, response) {
        if (requestData.chatID) {
            response.writeHead(200, CTTEXT);
            await AgoraUtil.clearChat(requestData.chatID, requestData.remember, response);
            response.end();
        }
    }
    AgoraServer.handleClear = handleClear;
    async function handleDelete(requestData, response) {
        if (requestData.chatID) {
            response.writeHead(200, CTTEXT);
            await AgoraUtil.deleteChat(requestData.chatID, requestData.remember, response);
            response.end();
        }
    }
    AgoraServer.handleDelete = handleDelete;
    async function handleArchive(requestData, response) {
        if (requestData.chatID) {
            response.writeHead(200, CTTEXT);
            await AgoraUtil.archiveChat(requestData.chatID, requestData.remember, response);
            response.end();
        }
    }
    AgoraServer.handleArchive = handleArchive;
    async function handleSettings(requestData, response) {
        if (requestData.chatID) {
            if (requestData.setting) {
                const edited = await AgoraUtil.editChatSettings(requestData.chatID, requestData.setting);
                if (requestData.combine) {
                    return AgoraUtil.getCombinedSettings(requestData.chatID);
                }
                return edited;
            }
            if (requestData.combine) {
                return AgoraUtil.getCombinedSettings(requestData.chatID);
            }
            return AgoraUtil.readChatSettings(requestData.chatID);
        }
        if (requestData.arkName) {
            if (requestData.setting) {
                return AgoraUtil.editArkSettings(requestData.arkName, requestData.setting);
            }
            return AgoraUtil.readArkSettings(requestData.arkName);
        }
        if (requestData.setting) {
            return AgoraUtil.editGlobalSettings(requestData.setting);
        }
        return AgoraUtil.readGlobalSettings();
    }
    AgoraServer.handleSettings = handleSettings;
    async function handleTranscript(requestData, response) {
        if (requestData.chatID) {
            return AgoraUtil.getTranscript(requestData.chatID);
        }
        return null;
    }
    AgoraServer.handleTranscript = handleTranscript;
    async function handleContext(requestData, response) {
        if (requestData.chatID) {
            if (requestData.messages == null) {
                if (requestData.index == null) {
                    return AgoraUtil.readContext(requestData.chatID);
                }
            }
            return AgoraUtil.editContext(requestData.chatID, requestData.index ?? Infinity, requestData.messages || []);
        }
        return null;
    }
    AgoraServer.handleContext = handleContext;
    async function handlePop(requestData, response) {
        if (requestData.chatID) {
            return AgoraUtil.popMessage(requestData.chatID, requestData.role, requestData.shallow);
        }
        return null;
    }
    AgoraServer.handlePop = handlePop;
    async function handleSend(requestData, response) {
        if (requestData.chatID) {
            response.writeHead(200, CTTEXT);
            await AgoraUtil.sendMessage(requestData.chatID, requestData.content, requestData.images ?? [], requestData.documents ?? [], response);
            response.end();
        }
    }
    AgoraServer.handleSend = handleSend;
    async function handleHand(requestData, response) {
        if (requestData.chatID) {
            AgoraUtil.raiseHand(requestData.chatID);
            return { success: true };
        }
        return null;
    }
    AgoraServer.handleHand = handleHand;
    async function handleAbort(requestData, response) {
        if (requestData.chatID) {
            AgoraUtil.abortChat(requestData.chatID);
            return { success: true };
        }
        return null;
    }
    AgoraServer.handleAbort = handleAbort;
    async function handleSpeech(requestData, response) {
        if (requestData.text) {
            await TTSService.synthesize(TTSService.defaultSettings, requestData.text, response);
        }
        else {
            response.writeHead(400, CTTEXT);
            response.end("text missing");
        }
    }
    AgoraServer.handleSpeech = handleSpeech;
    async function handleListen(requestData, response, request) {
        const url = new URL("http://" + request.headers.host + request.url);
        const chatID = url.searchParams.get("chatID");
        if (chatID) {
            SpeechUtil.open(chatID, TTSService.defaultSettings, response);
            ParamsUtil.getCombinedSettings(chatID).then(settings => SpeechUtil.configure(chatID, settings.tts));
            return;
        }
        response.writeHead(400, CTTEXT);
        response.end("chatID missing");
    }
    AgoraServer.handleListen = handleListen;
    async function handleSilence(requestData, response) {
        if (requestData.chatID) {
            SpeechUtil.abort(requestData.chatID);
            return { success: true };
        }
        return null;
    }
    AgoraServer.handleSilence = handleSilence;
    async function handleRawSettings(requestData, response) {
        if (requestData.chatID) {
            return AgoraUtil.readRawChatSettings(requestData.chatID);
        }
        if (requestData.arkName) {
            return AgoraUtil.readRawArkSettings(requestData.arkName);
        }
        return AgoraUtil.readRawGlobalSettings();
    }
    AgoraServer.handleRawSettings = handleRawSettings;
    async function handleContextEntry(requestData, response) {
        return AgoraUtil.setContextEntry(requestData.chatID, requestData.index, requestData.entry);
    }
    AgoraServer.handleContextEntry = handleContextEntry;
    async function handlePrompts(requestData, response) {
        return AgoraUtil.listPrompts();
    }
    AgoraServer.handlePrompts = handlePrompts;
    async function handlePrompt(requestData, response) {
        if (requestData.content == null) {
            return AgoraUtil.readPrompt(requestData.arkName, requestData.name);
        }
        return AgoraUtil.writePrompt(requestData.arkName, requestData.name, requestData.content);
    }
    AgoraServer.handlePrompt = handlePrompt;
    async function handleDocuments(requestData, response) {
        return AgoraUtil.listDocuments();
    }
    AgoraServer.handleDocuments = handleDocuments;
    async function handleDocument(requestData, response) {
        if (requestData.summarize) {
            response.writeHead(200, CTTEXT);
            await AgoraUtil.summarizeDocument(requestData.name, response);
            response.end();
            return;
        }
        if (requestData.create) {
            return AgoraUtil.createDocument();
        }
        if (requestData.upload) {
            return AgoraUtil.uploadDocument(requestData.ext, requestData.data);
        }
        if (requestData.rename) {
            return AgoraUtil.renameDocument(requestData.oldName, requestData.newName);
        }
        if (requestData.remove) {
            return AgoraUtil.removeDocument(requestData.name);
        }
        if (requestData.kind == "entry") {
            if (requestData.entry == null) {
                return AgoraUtil.readDocumentEntry(requestData.name);
            }
            return AgoraUtil.writeDocumentEntry(requestData.name, requestData.entry);
        }
        if (requestData.content == null) {
            return AgoraUtil.readDocumentFile(requestData.name, requestData.ext);
        }
        return AgoraUtil.writeDocumentFile(requestData.name, requestData.ext, requestData.content);
    }
    AgoraServer.handleDocument = handleDocument;
    async function handleMemories(requestData, response) {
        return AgoraUtil.listMemories(requestData.arkName);
    }
    AgoraServer.handleMemories = handleMemories;
    async function handleMemory(requestData, response) {
        if (requestData.create) {
            return AgoraUtil.createMemory(requestData.arkName);
        }
        if (requestData.remove) {
            return AgoraUtil.removeMemory(requestData.arkName, requestData.name);
        }
        if (requestData.kind == "entry") {
            if (requestData.entry == null) {
                return AgoraUtil.readMemoryEntry(requestData.arkName, requestData.name);
            }
            return AgoraUtil.writeMemoryEntry(requestData.arkName, requestData.name, requestData.entry);
        }
        if (requestData.content == null) {
            return AgoraUtil.readMemoryFile(requestData.arkName, requestData.name);
        }
        return AgoraUtil.writeMemoryFile(requestData.arkName, requestData.name, requestData.content);
    }
    AgoraServer.handleMemory = handleMemory;
    async function handleModelList(requestData, response) {
        return AgoraUtil.listModels();
    }
    AgoraServer.handleModelList = handleModelList;
    async function handleModel(requestData, response) {
        if (requestData.create) {
            return AgoraUtil.createModel(requestData.name);
        }
        if (requestData.rename) {
            return AgoraUtil.renameModel(requestData.oldName, requestData.newName);
        }
        if (requestData.remove) {
            return AgoraUtil.removeModel(requestData.name);
        }
        if (requestData.model == null) {
            return AgoraUtil.readModel(requestData.name);
        }
        return AgoraUtil.writeModel(requestData.name, requestData.model);
    }
    AgoraServer.handleModel = handleModel;
    async function handleImages(requestData, response) {
        return AgoraUtil.listImages();
    }
    AgoraServer.handleImages = handleImages;
    async function handleImage(requestData, response) {
        if (requestData.summarize) {
            response.writeHead(200, CTTEXT);
            await AgoraUtil.summarizeImage(requestData.name, response);
            response.end();
            return;
        }
        if (requestData.upload) {
            return AgoraUtil.uploadImage(requestData.ext, requestData.data);
        }
        if (requestData.rename) {
            return AgoraUtil.renameImage(requestData.oldName, requestData.newName);
        }
        if (requestData.remove) {
            return AgoraUtil.removeImage(requestData.name);
        }
        if (requestData.entry == null) {
            return AgoraUtil.readImageEntry(requestData.name);
        }
        return AgoraUtil.writeImageEntry(requestData.name, requestData.entry);
    }
    AgoraServer.handleImage = handleImage;
    async function handleTodos(requestData, response) {
        return AgoraUtil.listTodos();
    }
    AgoraServer.handleTodos = handleTodos;
    async function handleTodo(requestData, response) {
        if (requestData.create) {
            return AgoraUtil.createTodo(requestData.name);
        }
        if (requestData.rename) {
            return AgoraUtil.renameTodo(requestData.oldName, requestData.newName);
        }
        if (requestData.remove) {
            return AgoraUtil.removeTodo(requestData.name);
        }
        if (requestData.content == null) {
            return AgoraUtil.readTodo(requestData.name);
        }
        return AgoraUtil.writeTodo(requestData.name, requestData.content);
    }
    AgoraServer.handleTodo = handleTodo;
    async function handleIdeas(requestData, response) {
        return AgoraUtil.listIdeas();
    }
    AgoraServer.handleIdeas = handleIdeas;
    async function handleIdea(requestData, response) {
        if (requestData.summarize) {
            response.writeHead(200, CTTEXT);
            await AgoraUtil.summarizeIdea(requestData.name, requestData.key, response);
            response.end();
            return;
        }
        if (requestData.create) {
            return { name: await AgoraUtil.createIdea(requestData.name, requestData.description) };
        }
        if (requestData.upload) {
            return AgoraUtil.uploadIdeaInbox(requestData.data, requestData.sort, requestData.ext);
        }
        if (requestData.rename) {
            if (requestData.key) {
                return { name: await AgoraUtil.renameIdeaEntry(requestData.name, requestData.key, requestData.title) };
            }
            return { name: await AgoraUtil.renameIdea(requestData.oldName, requestData.newName) };
        }
        if (requestData.remove) {
            if (requestData.inbox) {
                return { name: await AgoraUtil.removeIdeaInbox(requestData.name) };
            }
            return { name: await AgoraUtil.removeIdea(requestData.name) };
        }
        if (requestData.kind == "settings") {
            if (requestData.setting == null) {
                return AgoraUtil.readIdeaSettings();
            }
            return AgoraUtil.writeIdeaSettings(requestData.setting);
        }
        if (requestData.kind == "summary") {
            if (requestData.content == null) {
                return AgoraUtil.readIdeaSummary(requestData.name);
            }
            return AgoraUtil.writeIdeaSummary(requestData.name, requestData.content);
        }
        if (requestData.kind == "description") {
            if (requestData.content == null) {
                return AgoraUtil.readIdeaDescription(requestData.name);
            }
            return AgoraUtil.writeIdeaDescription(requestData.name, requestData.content);
        }
        if (requestData.kind == "catalogue") {
            if (requestData.content == null) {
                return AgoraUtil.readIdeaCatalogue(requestData.name);
            }
            return AgoraUtil.writeIdeaCatalogue(requestData.name, requestData.content);
        }
        if (requestData.kind == "entry") {
            if (requestData.content == null) {
                return AgoraUtil.readIdeaEntry(requestData.name, requestData.key);
            }
            return AgoraUtil.writeIdeaEntry(requestData.name, requestData.key, requestData.content);
        }
        if (requestData.kind == "inbox") {
            if (requestData.content == null) {
                return AgoraUtil.readIdeaInbox(requestData.name);
            }
            return AgoraUtil.writeIdeaInbox(requestData.name, requestData.content);
        }
        return null;
    }
    AgoraServer.handleIdea = handleIdea;
    async function handleArk(requestData, response) {
        if (requestData.create) {
            return AgoraUtil.createArk(requestData.name);
        }
        if (requestData.remove) {
            return AgoraUtil.removeArk(requestData.name);
        }
        return null;
    }
    AgoraServer.handleArk = handleArk;
})(AgoraServer || (AgoraServer = {}));
let agoraPort = 8091;
for (let i = 0; i < process.argv.length; ++i) {
    if (process.argv[i] == "--port" && i + 1 < process.argv.length) {
        agoraPort = parseInt(process.argv[i + 1]) || agoraPort;
    }
}
AgoraUtil.initialize();
startServer(agoraPort, { route: "/api/arks", handler: AgoraServer.handleArks }, { route: "/api/models", handler: AgoraServer.handleModels }, { route: "/api/chats", handler: AgoraServer.handleChats }, { route: "/api/create", handler: AgoraServer.handleCreate }, { route: "/api/copy", handler: AgoraServer.handleCopy }, { route: "/api/clear", handler: AgoraServer.handleClear }, { route: "/api/delete", handler: AgoraServer.handleDelete }, { route: "/api/archive", handler: AgoraServer.handleArchive }, { route: "/api/content/raw", handler: AgoraServer.handleRawSettings }, { route: "/api/content/context", handler: AgoraServer.handleContextEntry }, { route: "/api/content/prompts", handler: AgoraServer.handlePrompts }, { route: "/api/content/prompt", handler: AgoraServer.handlePrompt }, { route: "/api/content/ark", handler: AgoraServer.handleArk }, { route: "/api/content/documents", handler: AgoraServer.handleDocuments }, { route: "/api/content/document", handler: AgoraServer.handleDocument }, { route: "/api/content/memories", handler: AgoraServer.handleMemories }, { route: "/api/content/memory", handler: AgoraServer.handleMemory }, { route: "/api/content/models", handler: AgoraServer.handleModelList }, { route: "/api/content/model", handler: AgoraServer.handleModel }, { route: "/api/content/images", handler: AgoraServer.handleImages }, { route: "/api/content/image", handler: AgoraServer.handleImage }, { route: "/api/content/todos", handler: AgoraServer.handleTodos }, { route: "/api/content/todo", handler: AgoraServer.handleTodo }, { route: "/api/content/ideas", handler: AgoraServer.handleIdeas }, { route: "/api/content/idea", handler: AgoraServer.handleIdea }, { route: "/api/settings", handler: AgoraServer.handleSettings }, { route: "/api/context", handler: AgoraServer.handleContext }, { route: "/api/transcript", handler: AgoraServer.handleTranscript }, { route: "/api/pop", handler: AgoraServer.handlePop }, { route: "/api/send", handler: AgoraServer.handleSend }, { route: "/api/speech", handler: AgoraServer.handleSpeech }, { route: "/api/listen", handler: AgoraServer.handleListen }, { route: "/api/silence", handler: AgoraServer.handleSilence }, { route: "/api/hand", handler: AgoraServer.handleHand }, { route: "/api/abort", handler: AgoraServer.handleAbort }, { route: "/ui/images/", dir: SettingsUtil.getLocation("/ThinkTank/Agora/Images/Images/") }, { route: "/ui/content/", dir: "./web/content/" }, { route: "/ui/", dir: "./web/agora-ui/" });
