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
class InternalChannel {
    constructor() {
        this.queue = [];
    }
    async *read() {
        while (true) {
            const next = this.queue.shift();
            if (next == null) {
                break;
            }
            yield next;
        }
    }
    async write(value) {
        this.queue.push(value);
    }
}
class ExecutionState {
    constructor(factory, sink) {
        this.variables = {};
        this.channels = {};
        this.factory = factory;
        this.sink = sink;
    }
    setVariable(name, value) {
        this.variables[name] = value;
    }
    getString(name) {
        const raw = this.variables[name];
        if (raw == undefined) {
            return undefined;
        }
        return String(raw);
    }
    getBoolean(name) {
        const raw = this.variables[name];
        if (raw == undefined) {
            return undefined;
        }
        if (typeof raw == "string") {
            switch (raw) {
                case "TRUE":
                case "True":
                case "true":
                case "T":
                case "t":
                case "YES":
                case "Yes":
                case "yes":
                case "Y":
                case "y":
                    return true;
                default:
                    return false;
            }
        }
        if (typeof raw == "boolean") {
            return raw;
        }
        if (typeof raw == "number") {
            return raw > 0;
        }
    }
    getNumber(name) {
        const raw = this.variables[name];
        if (raw == undefined) {
            return undefined;
        }
        if (typeof raw == "string") {
            const num = parseFloat(raw);
            if (isNaN(num)) {
                return undefined;
            }
            return num;
        }
        if (typeof raw == "boolean") {
            if (raw) {
                return 1;
            }
            return 0;
        }
        if (typeof raw == "number") {
            return raw;
        }
    }
    increment(name) {
        const value = this.getNumber(name) ?? 0;
        this.variables[name] = value + 1;
    }
    delete(name) {
        delete this.variables[name];
    }
    getChannel(name) {
        const external = this.factory.create(name);
        if (external) {
            return external;
        }
        if (name.includes("/") || name.includes(".")) {
            return null;
        }
        return this.channels[name] = this.channels[name] ?? new InternalChannel();
    }
    stream(text) {
        this.sink.stream(text);
    }
    print(text) {
        this.sink.print(text);
    }
    async expandName(text) {
        return this.expandSubstitutions(text, false);
    }
    async expandValue(text) {
        return this.expandSubstitutions(text, true);
    }
    async expandSubstitutions(result, useChannels) {
        let match;
        while (match = result.match(/\{\{([^{}]+)\}\}/)) {
            const outer = match[0];
            const inner = match[1];
            let replacement = this.getString(inner);
            if (replacement == undefined) {
                if (useChannels) {
                    const channel = this.getChannel(inner);
                    if (channel) {
                        replacement = "";
                        for await (const chunk of channel.read()) {
                            replacement += chunk;
                            replacement += "\n\n";
                        }
                    }
                    else {
                        replacement = "UNDEFINED";
                    }
                }
                else {
                    replacement = "UNDEFINED";
                }
            }
            result = result.replace(outer, replacement);
        }
        return result;
    }
}
class CLIParser {
    static parse(args) {
        let result = [];
        let command;
        let parameters = [];
        for (const arg of args) {
            if (arg.endsWith(":")) {
                if (command) {
                    result.push({ command, parameters });
                }
                command = arg.substring(0, arg.length - 1);
                parameters = [];
            }
            else if (command) {
                parameters.push(arg);
            }
            else {
            }
        }
        if (command) {
            result.push({ command, parameters });
        }
        return result;
    }
}
class ScriptParser {
    static *descape(source) {
        let state = "normal";
        for (let i = 0; i < source.length; ++i) {
            const char = source[i];
            if (state == "escape") {
                if (char == "s") {
                    yield "\\ ";
                }
                else if (char == "t") {
                    yield "\\\t";
                }
                else if (char == "n") {
                    yield "\\\n";
                }
                else {
                    yield "\\" + char;
                }
                state = "normal";
            }
            else if (state == "comment") {
                if (char == "/") {
                    yield "//";
                }
                else {
                    yield "/";
                    yield char;
                }
                state = "normal";
            }
            else if (char == "\\") {
                state = "escape";
            }
            else if (char == "/") {
                state = "comment";
            }
            else {
                yield char;
            }
        }
    }
    static *tokanize(source) {
        let token = "";
        let state = "normal";
        for (const char of this.descape(source)) {
            const transition = this.transitions[state][char];
            if (transition == "new") {
                if (token) {
                    yield token;
                }
                token = "";
                state = "normal";
            }
            else if (transition) {
                state = transition;
            }
            else if (state == "cmt") {
            }
            else {
                token += char.slice(-1);
            }
        }
        if (token) {
            yield token;
        }
    }
    static parse(source) {
        return CLIParser.parse([...this.tokanize(source)]);
    }
}
ScriptParser.transitions = {
    "normal": {
        " ": "new",
        "\t": "new",
        "\n": "new",
        "\"": "str-1",
        "'": "str-2",
        "`": "str-3",
        "//": "cmt"
    },
    "str-1": {
        "\"": "normal"
    },
    "str-2": {
        "'": "normal"
    },
    "str-3": {
        "`": "normal"
    },
    "cmt": {
        "\n": "new"
    }
};
class BaseHandlers {
    static async set(state, name, value) {
        value = await state.expandValue(value);
        state.setVariable(name, value);
    }
    static async run(state, source) {
        source = await state.expandName(source);
        const input = state.getChannel(source);
        for await (const text of input.read()) {
            const calls = ScriptParser.parse(text);
            for (const call of calls) {
                await ExecutionCore.executeCall(state, call);
            }
        }
    }
    static async print(state, value) {
        value = await state.expandValue(value);
        state.print(value);
    }
}
class IOHandlers {
    static async add(state, value, target) {
        target = await state.expandName(target);
        state.getChannel(target).write(value);
    }
    static async read(state, source, target) {
        source = await state.expandName(source);
        const input = state.getChannel(source);
        input.write(null);
        state.delete("index");
        for await (let text of input.read()) {
            state.increment("index");
            state.increment("count");
            target = await state.expandName(target);
            const output = state.getChannel(target);
            await output.write(text);
        }
    }
    static async write(state, target, source) {
        source = await state.expandName(source);
        const input = state.getChannel(source);
        input.write(null);
        state.delete("index");
        for await (let text of input.read()) {
            state.increment("index");
            state.increment("count");
            text = await state.expandValue(text);
            target = await state.expandName(target);
            const output = state.getChannel(target);
            await output.write(text);
        }
    }
    static async copy(state, target, source) {
        source = await state.expandName(source);
        const input = state.getChannel(source);
        input.write(null);
        state.delete("index");
        for await (let text of input.read()) {
            state.increment("index");
            state.increment("count");
            target = await state.expandName(target);
            const output = state.getChannel(target);
            await output.write(text);
            await input.write(text);
        }
    }
}
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
class TextHandlers {
    static async *trimChunks(chunks) {
        for await (const chunk of chunks) {
            chunk.content = chunk.content.trim();
            if (chunk.content) {
                yield chunk;
            }
        }
    }
    static async *chunked(content, limit) {
        if (content.length == 0) {
            yield {
                content: "",
                split: this.splits[0]
            };
            return;
        }
        let start = 0;
        let i = 0;
        let best = this.splits[0];
        while (true) {
            ++i;
            if (i == content.length) {
                yield {
                    content: content.slice(start),
                    split: this.splits[0]
                };
                break;
            }
            for (const split of this.splits) {
                if (split.text == content.slice(i, i + split.length)) {
                    split.latestIndex = i;
                    if (best.priority < split.priority) {
                        best = split;
                    }
                }
            }
            if (i == start + limit) {
                yield {
                    content: content.slice(start, best.latestIndex),
                    split: best
                };
                start = best.latestIndex + best.length;
                i = best.latestIndex + best.length;
                best = this.splits[0];
            }
        }
    }
    static async split(state, limit, source, target) {
        const max = parseInt(limit) || 2000;
        source = await state.expandName(source);
        const input = state.getChannel(source);
        input.write(null);
        state.delete("index");
        for await (let text of input.read()) {
            for await (const trimmed of TextHandlers.trimChunks(TextHandlers.chunked(text, max))) {
                state.increment("index");
                state.increment("count");
                target = await state.expandName(target);
                const output = state.getChannel(target);
                await output.write(trimmed);
            }
        }
    }
    static async merge(state, separator, source, target) {
        source = await state.expandName(source);
        const input = state.getChannel(source);
        let result = "";
        for await (const text of input.read()) {
            if (result) {
                result += separator;
            }
            result += text;
        }
        target = await state.expandName(target);
        const output = state.getChannel(target);
        await output.write(result);
    }
    static async generate(messages, state) {
        const chatParams = {
            ...this.defaultParams,
            APIType: state.getString("APIType") ?? this.defaultParams.APIType,
            APIHost: state.getString("APIHost") ?? this.defaultParams.APIHost,
            APIKey: state.getString("APIKey") ?? this.defaultParams.APIKey,
            model: state.getString("model") ?? this.defaultParams.model,
            think: state.getBoolean("think") ?? this.defaultParams.think,
            temp: state.getNumber("temp") ?? this.defaultParams.temp,
            topP: state.getNumber("topP") ?? this.defaultParams.topP,
            topK: state.getNumber("topK") ?? this.defaultParams.topK,
            numKeep: state.getNumber("numKeep") ?? this.defaultParams.numKeep,
            numPredict: state.getNumber("numPredict") ?? this.defaultParams.numPredict
        };
        const print = state.getBoolean("print") ?? true;
        const handler = {
            onChunk: (chunk) => {
                if (print) {
                    state.stream(chunk);
                }
                return chunk;
            }
        };
        return ChatService.generate(chatParams, messages, handler);
    }
    static async process(state, prompt, source, target) {
        prompt = await state.expandValue(prompt);
        source = await state.expandName(source);
        const input = state.getChannel(source);
        input.write(null);
        state.delete("index");
        const limit = state.getNumber("limit") ?? 2000;
        const context = state.getBoolean("context") ?? false;
        const print = state.getBoolean("print") ?? true;
        for await (let text of input.read()) {
            state.increment("index");
            state.increment("count");
            text = await state.expandValue(text);
            let result = "";
            let prevInput;
            let prevOutput;
            const chunks = [];
            for await (const chunk of TextHandlers.chunked(text, limit)) {
                chunk.content = chunk.content.trim();
                if (chunk.content) {
                    chunks.push(chunk);
                }
            }
            if (chunks.length == 0) {
                chunks.push({ content: "", split: TextHandlers.splits[0] });
            }
            for (const trimmed of chunks) {
                let messages;
                if (prevInput) {
                    messages = [
                        { role: "system", content: prompt },
                        { role: "user", content: prevInput },
                        { role: "assistant", content: prevOutput },
                        { role: "user", content: trimmed.content }
                    ];
                }
                else {
                    messages = [
                        { role: "system", content: prompt },
                        { role: "user", content: trimmed.content }
                    ];
                }
                if (context) {
                    prevInput = trimmed.content;
                }
                const response = await TextHandlers.generate(messages, state);
                prevOutput = response;
                if (print) {
                    state.stream(trimmed.split.connector);
                }
                result += response;
                result += trimmed.split.connector;
            }
            target = await state.expandName(target);
            const output = state.getChannel(target);
            await output.write(result);
        }
    }
    static async replace(state, pattern, replacement, source, target) {
        source = await state.expandName(source);
        const input = state.getChannel(source);
        input.write(null);
        state.delete("index");
        const regexp = new RegExp(pattern, "g");
        for await (let text of input.read()) {
            state.increment("index");
            state.increment("count");
            text = await state.expandValue(text);
            text = text.replace(regexp, replacement);
            target = await state.expandName(target);
            const output = state.getChannel(target);
            await output.write(text);
        }
    }
    static async clean(state, source, target) {
        source = await state.expandName(source);
        const input = state.getChannel(source);
        input.write(null);
        state.delete("index");
        for await (let text of input.read()) {
            state.increment("index");
            state.increment("count");
            text = text
                .replace(/\r\n?/g, "\n")
                .replace(/<split\/>/g, "\n\n<split/>\n\n")
                .replace(/[ \t]+\n/g, "\n")
                .replace(/\n\n\n+/g, "\n\n")
                .replace(/['‛’‚‹›]/g, "'")
                .replace(/["‟”„«»]/g, '"')
                .replace(/…/g, "...")
                .replace(/—/g, "–")
                .replace(/‑/g, "-")
                .replace(/(\w\: *)(\w)/g, (a, b, c) => b + c.toUpperCase())
                .replace(/(\w\.\.\. *)(\w)/g, (a, b, c) => b + c.toUpperCase())
                .replace(/[áéíóöőúüűq]/gi, (value) => value.toLowerCase())
                .trim();
            target = await state.expandName(target);
            const output = state.getChannel(target);
            await output.write(text);
        }
    }
}
TextHandlers.splits = [
    { text: "", priority: 0, latestIndex: 0, length: 0, connector: "" },
    { text: " ", priority: 1, latestIndex: 0, length: 1, connector: " " },
    { text: "\n", priority: 2, latestIndex: 0, length: 1, connector: "\n" },
    { text: "\n\n", priority: 3, latestIndex: 0, length: 2, connector: "\n\n" },
    { text: "\n\n\n\n", priority: 4, latestIndex: 0, length: 4, connector: "\n\n\n\n" },
    { text: "<split/>", priority: 5, latestIndex: 0, length: 8, connector: "\n\n<split/>\n\n" }
];
TextHandlers.defaultParams = {
    APIType: "ollama",
    APIHost: "http://localhost:11434/api/chat",
    APIKey: null,
    thought: "hidden",
    model: "qwen3.5:9b",
    think: false,
    temp: 0.35,
    topP: 0.85,
    topK: 35,
    numKeep: 1536,
    numPredict: 8192
};
var _a;
class ExecutionCore {
    static createDescriptor(representation, handler) {
        const signature = [];
        for (const parameter of representation.split(" ")) {
            const [type, fallback] = parameter.split("=");
            signature.push({ type: type, fallback });
        }
        return { signature, handler };
    }
    static async executeCall(state, call) {
        const command = this.commands[call.command];
        if (command) {
            if (command.signature.length < call.parameters.length) {
            }
            const resolved = [];
            for (let i = 0; i < command.signature.length; ++i) {
                resolved[i] = call.parameters[i] ?? command.signature[i].fallback;
            }
            await command.handler(state, ...resolved);
        }
        else {
        }
    }
}
_a = ExecutionCore;
ExecutionCore.commands = {
    set: _a.createDescriptor("name value", BaseHandlers.set),
    run: _a.createDescriptor("source=stdin", BaseHandlers.run),
    print: _a.createDescriptor("value", BaseHandlers.print),
    add: _a.createDescriptor("value target=main", IOHandlers.add),
    read: _a.createDescriptor("source=stdin target=main", IOHandlers.read),
    write: _a.createDescriptor("target=stdout source=main", IOHandlers.write),
    copy: _a.createDescriptor("target=stdout source=main", IOHandlers.copy),
    split: _a.createDescriptor("limit=2000 source=main target=main", TextHandlers.split),
    merge: _a.createDescriptor("separator=\n\n source=main target=main", TextHandlers.merge),
    process: _a.createDescriptor("prompt source=main target=main", TextHandlers.process),
    replace: _a.createDescriptor("pattern replacement source=main target=main", TextHandlers.replace),
    clean: _a.createDescriptor("source=main target=main", TextHandlers.clean)
};
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
var TextForgeServerConfig;
(function (TextForgeServerConfig) {
    function getRootPath() {
        return SettingsUtil.getLocation("/ThinkTank/TextForge");
    }
    TextForgeServerConfig.getRootPath = getRootPath;
    function getSettingsPath() {
        return NodeUtil.getPath(getRootPath(), "settings.json");
    }
    TextForgeServerConfig.getSettingsPath = getSettingsPath;
    function getFilePath(location) {
        if (NodeUtil.path.isAbsolute(location)) {
            return location;
        }
        return NodeUtil.getPath(getRootPath(), location);
    }
    TextForgeServerConfig.getFilePath = getFilePath;
})(TextForgeServerConfig || (TextForgeServerConfig = {}));
var TextForgeServer;
(function (TextForgeServer) {
    const CTNDJSON = { "Content-Type": "application/x-ndjson" };
    class SinkChannel {
        constructor(sink) {
            this.sink = sink;
        }
        async *read() {
        }
        async write(value) {
            if (value) {
                this.sink.stream(`${value}\n\n`);
            }
        }
    }
    class RequestChannelFactory {
        constructor(input, sink) {
            this.inputChannel = new InternalChannel();
            this.inputChannel.write(input);
            this.stdoutChannel = new SinkChannel(sink);
        }
        create(name) {
            if (name == "stdin" || name == "input") {
                return this.inputChannel;
            }
            if (name == "stdout") {
                return this.stdoutChannel;
            }
            if (name.includes("/") || name.includes(".")) {
                throw new Error(`channel not allowed: ${name}`);
            }
            return null;
        }
    }
    function getSpecs() {
        return [
            { route: "/api/scripts", handler: TextForgeServer.handleScripts },
            { route: "/api/script", handler: TextForgeServer.handleScript },
            { route: "/api/run", handler: TextForgeServer.handleRun },
            { route: "/ui/", dir: "./web/textforge-ui/" }
        ];
    }
    TextForgeServer.getSpecs = getSpecs;
    async function handleScripts(requestData, response) {
        const settings = await readSettings();
        if (settings?.scripts) {
            return Object.keys(settings.scripts);
        }
        return [];
    }
    TextForgeServer.handleScripts = handleScripts;
    async function handleScript(requestData, response) {
        const name = requestData?.name;
        if (name) {
            const settings = await readSettings();
            const location = settings?.scripts?.[name];
            if (location) {
                return FileUtil.readTextRAW(TextForgeServerConfig.getFilePath(location));
            }
        }
        return null;
    }
    TextForgeServer.handleScript = handleScript;
    async function handleRun(requestData, response) {
        response.writeHead(200, CTNDJSON);
        const sink = {
            stream: (text) => sendEvent(response, { type: "stream", text }),
            print: (text) => sendEvent(response, { type: "stream", text: `${text}\n` })
        };
        const factory = new RequestChannelFactory(requestData?.input ?? "", sink);
        const state = new ExecutionState(factory, sink);
        try {
            const input = requestData?.input ?? "";
            const settings = await readSettings();
            await loadSettings(state, settings);
            await state.getChannel("main").write(input);
            await state.getChannel("original").write(input);
            const calls = ScriptParser.parse(requestData?.script ?? "");
            for (const call of calls) {
                await ExecutionCore.executeCall(state, call);
            }
            const output = await readChannel(state.getChannel("main"));
            sendEvent(response, { type: "output", text: output });
        }
        catch (error) {
            sendEvent(response, { type: "error", message: getMessage(error) });
        }
        sendEvent(response, { type: "done" });
        response.end();
    }
    TextForgeServer.handleRun = handleRun;
    async function readSettings() {
        return FileUtil.readJSONRAW(TextForgeServerConfig.getSettingsPath());
    }
    async function loadSettings(state, settings) {
        if (settings?.variables) {
            for (const name in settings.variables) {
                const content = await FileUtil.readTextRAW(TextForgeServerConfig.getFilePath(settings.variables[name]));
                if (content != null) {
                    state.setVariable(name, content);
                }
            }
        }
        if (settings?.channels) {
            for (const name in settings.channels) {
                const content = await FileUtil.readTextRAW(TextForgeServerConfig.getFilePath(settings.channels[name]));
                if (content != null) {
                    const channel = state.getChannel(name);
                    if (channel) {
                        await channel.write(content);
                    }
                }
            }
        }
    }
    async function readChannel(channel) {
        let result = "";
        if (channel == null) {
            return result;
        }
        for await (const chunk of channel.read()) {
            if (result) {
                result += "\n\n";
            }
            result += chunk;
        }
        return result;
    }
    function sendEvent(response, value) {
        response.write(`${JSON.stringify(value)}\n`);
    }
    function getMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
})(TextForgeServer || (TextForgeServer = {}));
let textForgePort = 8093;
for (let i = 0; i < process.argv.length; ++i) {
    if (process.argv[i] == "--port" && i + 1 < process.argv.length) {
        textForgePort = parseInt(process.argv[i + 1]) || textForgePort;
    }
}
startServer(textForgePort, ...TextForgeServer.getSpecs());
