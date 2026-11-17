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
class AgoraAPI {
    static async arks() {
        return fetchData(`${this.baseURL}/api/arks`, "GET", null, null);
    }
    static async models() {
        return fetchData(`${this.baseURL}/api/models`, "GET", null, null);
    }
    static async chats() {
        return fetchData(`${this.baseURL}/api/chats`, "GET", null, null);
    }
    static async create() {
        return fetchData(`${this.baseURL}/api/create`, "GET", null, null);
    }
    static async copy(chatID, title) {
        return fetchData(`${this.baseURL}/api/copy`, "POST", CTJSON, { chatID, title });
    }
    static async settings(chatID, arkName, combined, setting) {
        return fetchData(`${this.baseURL}/api/settings`, "POST", CTJSON, { chatID, arkName, combine: combined, setting });
    }
    static async readContext(chatID) {
        return fetchData(`${this.baseURL}/api/context`, "POST", CTJSON, { chatID });
    }
    static async transcript(chatID) {
        return fetchText(`${this.baseURL}/api/transcript`, "POST", CTJSON, { chatID });
    }
    static async editContext(chatID, index, messages) {
        return fetchData(`${this.baseURL}/api/context`, "POST", CTJSON, { chatID, index, messages });
    }
    static async popMessage(chatID, role, shallow) {
        return fetchData(`${this.baseURL}/api/pop`, "POST", CTJSON, { chatID, role, shallow });
    }
    static async clear(chatID, remember, onChunk) {
        return fetchByChunk(`${this.baseURL}/api/clear`, "POST", CTJSON, { chatID, remember }, { onChunk });
    }
    static async delete(chatID, remember, onChunk) {
        return fetchByChunk(`${this.baseURL}/api/delete`, "POST", CTJSON, { chatID, remember }, { onChunk });
    }
    static async archive(chatID, remember, onChunk) {
        return fetchByChunk(`${this.baseURL}/api/archive`, "POST", CTJSON, { chatID, remember }, { onChunk });
    }
    static async send(chatID, content, images, documents, onChunk) {
        return fetchByChunk(`${this.baseURL}/api/send`, "POST", CTJSON, { chatID, content, images, documents }, { onChunk });
    }
    static async hand(chatID) {
        return fetchData(`${this.baseURL}/api/hand`, "POST", CTJSON, { chatID });
    }
    static async abort(chatID) {
        return fetchData(`${this.baseURL}/api/abort`, "POST", CTJSON, { chatID });
    }
    static async silence(chatID) {
        return fetchData(`${this.baseURL}/api/silence`, "POST", CTJSON, { chatID });
    }
    static async rawSettings(chatID, arkName) {
        return fetchData(`${this.baseURL}/api/content/raw`, "POST", CTJSON, { chatID, arkName });
    }
    static async setContext(chatID, index, entry) {
        return fetchData(`${this.baseURL}/api/content/context`, "POST", CTJSON, { chatID, index, entry });
    }
    static async prompts() {
        return fetchData(`${this.baseURL}/api/content/prompts`, "GET", null, null);
    }
    static async readPrompt(arkName, name) {
        return fetchText(`${this.baseURL}/api/content/prompt`, "POST", CTJSON, { arkName, name });
    }
    static async writePrompt(arkName, name, content) {
        return fetchText(`${this.baseURL}/api/content/prompt`, "POST", CTJSON, { arkName, name, content });
    }
    static async documents() {
        return fetchData(`${this.baseURL}/api/content/documents`, "GET", null, null);
    }
    static async createDocument() {
        return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { create: true });
    }
    static async renameDocument(oldName, newName) {
        return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { rename: true, oldName, newName });
    }
    static async readDocumentEntry(name) {
        return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, kind: "entry" });
    }
    static async writeDocumentEntry(name, entry) {
        return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, kind: "entry", entry });
    }
    static async readDocumentFile(name, ext) {
        return fetchText(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, ext, kind: "file" });
    }
    static async writeDocumentFile(name, ext, content) {
        return fetchText(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, ext, kind: "file", content });
    }
    static async memories(arkName) {
        return fetchData(`${this.baseURL}/api/content/memories`, "POST", CTJSON, { arkName });
    }
    static async readMemoryEntry(arkName, name) {
        return fetchData(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "entry" });
    }
    static async writeMemoryEntry(arkName, name, entry) {
        return fetchData(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "entry", entry });
    }
    static async readMemoryFile(arkName, name) {
        return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "file" });
    }
    static async writeMemoryFile(arkName, name, content) {
        return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "file", content });
    }
    static async createMemory(arkName) {
        return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, create: true });
    }
    static async removeMemory(arkName, name) {
        return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, remove: true });
    }
    static async modelList() {
        return fetchData(`${this.baseURL}/api/content/models`, "GET", null, null);
    }
    static async readModel(name) {
        return fetchData(`${this.baseURL}/api/content/model`, "POST", CTJSON, { name });
    }
    static async writeModel(name, model) {
        return fetchData(`${this.baseURL}/api/content/model`, "POST", CTJSON, { name, model });
    }
    static async createModel(name) {
        return fetchText(`${this.baseURL}/api/content/model`, "POST", CTJSON, { create: true, name });
    }
    static async renameModel(oldName, newName) {
        return fetchText(`${this.baseURL}/api/content/model`, "POST", CTJSON, { rename: true, oldName, newName });
    }
    static async removeModel(name) {
        return fetchText(`${this.baseURL}/api/content/model`, "POST", CTJSON, { remove: true, name });
    }
    static async imageList() {
        return fetchData(`${this.baseURL}/api/content/images`, "GET", null, null);
    }
    static async readImageEntry(name) {
        return fetchData(`${this.baseURL}/api/content/image`, "POST", CTJSON, { name });
    }
    static async writeImageEntry(name, entry) {
        return fetchData(`${this.baseURL}/api/content/image`, "POST", CTJSON, { name, entry });
    }
    static async todoList() {
        return fetchData(`${this.baseURL}/api/content/todos`, "GET", null, null);
    }
    static async readTodo(name) {
        return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { name });
    }
    static async writeTodo(name, content) {
        return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { name, content });
    }
    static async createArk(name) {
        return fetchText(`${this.baseURL}/api/content/ark`, "POST", CTJSON, { create: true, name });
    }
    static async removeArk(name) {
        return fetchText(`${this.baseURL}/api/content/ark`, "POST", CTJSON, { delete: true, name });
    }
    static async uploadDocument(ext, data) {
        return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { upload: true, ext, data });
    }
    static async removeDocument(name) {
        return fetchText(`${this.baseURL}/api/content/document`, "POST", CTJSON, { remove: true, name });
    }
    static async summarizeDocument(name, onChunk) {
        return fetchByChunk(`${this.baseURL}/api/content/document`, "POST", CTJSON, { summarize: true, name }, { onChunk });
    }
    static async uploadImage(ext, data) {
        return fetchData(`${this.baseURL}/api/content/image`, "POST", CTJSON, { upload: true, ext, data });
    }
    static async renameImage(oldName, newName) {
        return fetchText(`${this.baseURL}/api/content/image`, "POST", CTJSON, { rename: true, oldName, newName });
    }
    static async removeImage(name) {
        return fetchText(`${this.baseURL}/api/content/image`, "POST", CTJSON, { remove: true, name });
    }
    static async summarizeImage(name, onChunk) {
        return fetchByChunk(`${this.baseURL}/api/content/image`, "POST", CTJSON, { summarize: true, name }, { onChunk });
    }
    static async createTodo(name) {
        return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { create: true, name });
    }
    static async renameTodo(oldName, newName) {
        return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { rename: true, oldName, newName });
    }
    static async removeTodo(name) {
        return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { remove: true, name });
    }
    static async ideas() {
        return fetchData(`${this.baseURL}/api/content/ideas`, "GET", null, null);
    }
    static async createIdea(name, description) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { create: true, name, description });
    }
    static async renameIdea(oldName, newName) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { rename: true, oldName, newName });
    }
    static async renameIdeaEntry(name, key, title) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { rename: true, name, key, title });
    }
    static async removeIdea(name) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { remove: true, name });
    }
    static async readIdeaSettings() {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { kind: "settings" });
    }
    static async writeIdeaSettings(setting) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { kind: "settings", setting });
    }
    static async readIdeaSummary(name) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "summary" });
    }
    static async writeIdeaSummary(name, content) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "summary", content });
    }
    static async readIdeaDescription(name) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "description" });
    }
    static async writeIdeaDescription(name, content) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "description", content });
    }
    static async readIdeaCatalogue(name) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "catalogue" });
    }
    static async writeIdeaCatalogue(name, catalogue) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "catalogue", content: catalogue });
    }
    static async readIdeaEntry(name, key) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, key, kind: "entry" });
    }
    static async writeIdeaEntry(name, key, content) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, key, kind: "entry", content });
    }
    static async readIdeaInbox(name) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "inbox" });
    }
    static async writeIdeaInbox(name, content) {
        return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "inbox", content });
    }
    static async removeIdeaInbox(name) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { remove: true, inbox: true, name });
    }
    static async summarizeIdea(name, key, onChunk) {
        return fetchByChunk(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { summarize: true, name, key }, { onChunk });
    }
    static async uploadIdeaInbox(data, sort, ext) {
        return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { upload: true, data, sort, ext });
    }
}
AgoraAPI.baseURL = `http://${location.hostname}:${location.port}`;
class InputDisabler {
    constructor() {
        this.inputs = new Set();
        this.states = new Map();
    }
    addInput(input, handler) {
        this.inputs.add({ input, handler });
    }
    updateAll(state) {
        for (const item of this.inputs) {
            if (item.handler) {
                item.handler(state);
            }
            else {
                if (state < 1) {
                    item.input["disabled"] = false;
                    item.input.style.pointerEvents = "";
                    item.input.style.cursor = "";
                }
                else {
                    item.input["disabled"] = true;
                    item.input.style.pointerEvents = "none";
                    item.input.style.cursor = "default";
                }
                if (state < 2) {
                    item.input.style.opacity = "";
                }
                else {
                    item.input.style.opacity = "0.5";
                }
            }
        }
    }
    selectGroup(group) {
        this.current = group;
        this.updateAll(this.states[group] ?? 0);
    }
    silenceGroup(group) {
        if (this.states[group] > 1) {
            return;
        }
        this.states[group] = 1;
        if (group == this.current) {
            this.updateAll(this.states[group]);
        }
    }
    wakeGroup(group) {
        if (this.states[group] > 1) {
            return;
        }
        this.states[group] = 0;
        if (group == this.current) {
            this.updateAll(this.states[group]);
        }
    }
    disableGroup(group) {
        this.states[group] = 2;
        if (group == this.current) {
            this.updateAll(this.states[group]);
        }
    }
    enableGroup(group) {
        this.states[group] = 0;
        if (group == this.current) {
            this.updateAll(this.states[group]);
        }
    }
}
class CollapseGroup {
    constructor(parent, name) {
        this.name = name;
        this.container = document.createElement("div");
        this.container.className = "collapseGroup";
        parent.appendChild(this.container);
        this.button = document.createElement("button");
        this.button.className = "groupButton";
        this.button.innerText = name;
        this.button.addEventListener("click", () => this.toggle());
        this.container.appendChild(this.button);
        this.content = document.createElement("div");
        this.content.className = "groupContent";
        this.container.appendChild(this.content);
        this.loadState();
    }
    expand() {
        this.setState(false);
    }
    setUnread(unread) {
        this.button.classList.toggle("unread", unread);
    }
    moveToEnd() {
        this.container.parentElement.appendChild(this.container);
    }
    toggle() {
        this.setState(!this.isCollapsed());
    }
    isCollapsed() {
        return this.container.classList.contains("collapsed");
    }
    setState(collapsed) {
        if (collapsed) {
            this.container.classList.add("collapsed");
            localStorage.setItem(this.key(), "1");
        }
        else {
            this.container.classList.remove("collapsed");
            localStorage.setItem(this.key(), "0");
        }
    }
    loadState() {
        if (localStorage.getItem(this.key()) == "0") {
            this.container.classList.remove("collapsed");
        }
        else {
            this.container.classList.add("collapsed");
        }
    }
    key() {
        return `collapsed.${this.name}`;
    }
}
class ChatList {
    constructor(parent, container) {
        this.groups = new Map();
        this.buttons = new Map();
        this.metas = new Map();
        this.selected = null;
        this.parent = parent;
        this.container = container;
    }
    async loadChatList() {
        const chatList = await AgoraAPI.chats() ?? [];
        chatList.sort((a, b) => b.created - a.created);
        this.container.innerHTML = "";
        this.groups.clear();
        this.buttons.clear();
        this.metas.clear();
        for (const chatMeta of chatList) {
            this.metas.set(chatMeta.chatID, chatMeta);
        }
        this.selected = this.pickSelected(chatList);
        for (const chatMeta of chatList) {
            this.createButton(chatMeta);
        }
        this.expandGroup(this.selected);
        return this.metas.get(this.selected) ?? null;
    }
    async refreshChatList() {
        const chatList = await AgoraAPI.chats();
        if (chatList == null) {
            return null;
        }
        chatList.sort((a, b) => b.created - a.created);
        const selectedBefore = this.selected;
        const seen = new Set();
        for (const chatMeta of chatList) {
            seen.add(chatMeta.chatID);
            this.applyMeta(chatMeta);
        }
        for (const chatID of Array.from(this.metas.keys())) {
            if (seen.has(chatID) == false) {
                this.removeButton(chatID);
            }
        }
        if (this.metas.has(this.selected) == false) {
            this.selected = this.pickSelected(chatList);
        }
        this.paintAll();
        if (this.selected != selectedBefore) {
            return { select: this.metas.get(this.selected) ?? null, unread: false };
        }
        return { select: null, unread: this.isUnread(this.metas.get(this.selected)) };
    }
    getMeta(chatID) {
        return this.metas.get(chatID);
    }
    clearUnread(chatID) {
        const chatMeta = this.metas.get(chatID);
        if (chatMeta) {
            chatMeta.viewed = chatMeta.updated;
        }
        this.paintChat(chatID);
    }
    selectChat(chatID) {
        const previous = this.selected;
        this.selected = chatID;
        this.expandGroup(chatID);
        if (previous != null) {
            this.paintChat(previous);
        }
        this.paintChat(chatID);
    }
    expandGroup(chatID) {
        const button = this.buttons.get(chatID);
        if (button == null) {
            return;
        }
        button["group"]?.expand();
    }
    pickSelected(chatList) {
        let result = null;
        let viewed = -1;
        for (const chatMeta of chatList) {
            if (chatMeta.viewed > viewed) {
                viewed = chatMeta.viewed;
                result = chatMeta.chatID;
            }
        }
        return result;
    }
    isUnread(chatMeta) {
        return chatMeta != null && chatMeta.viewed < chatMeta.updated;
    }
    isGroupUnread(groupName) {
        let result = false;
        for (const chatMeta of this.metas.values()) {
            if (this.groupName(chatMeta.title) == groupName && this.isUnread(chatMeta)) {
                result = true;
                break;
            }
        }
        return result;
    }
    paintChat(chatID) {
        const button = this.buttons.get(chatID);
        if (button == null) {
            return;
        }
        const chatMeta = this.metas.get(chatID);
        const unread = this.isUnread(chatMeta);
        button.classList.toggle("unread", unread);
        button.classList.toggle("selected", chatID == this.selected);
        const group = button["group"];
        if (group) {
            group.setUnread(this.isGroupUnread(this.groupName(chatMeta.title)));
        }
    }
    paintAll() {
        for (const chatID of this.buttons.keys()) {
            this.paintChat(chatID);
        }
    }
    applyMeta(chatMeta) {
        const button = this.buttons.get(chatMeta.chatID);
        const previous = this.metas.get(chatMeta.chatID);
        this.metas.set(chatMeta.chatID, chatMeta);
        if (button == null) {
            this.createButton(chatMeta);
            return;
        }
        button["meta"] = chatMeta;
        if (previous == null || previous.title != chatMeta.title) {
            button.innerText = this.shortTitle(chatMeta.title);
        }
    }
    createButton(chatMeta) {
        const groupName = this.groupName(chatMeta.title);
        const group = groupName ? this.getGroup(groupName) : null;
        const button = document.createElement("button");
        button.innerText = this.shortTitle(chatMeta.title);
        button["chatID"] = chatMeta.chatID;
        button["meta"] = chatMeta;
        button["group"] = group;
        button.addEventListener("click", () => this.parent.onChatClick(button["chatID"]));
        if (group) {
            group.content.appendChild(button);
            group.moveToEnd();
        }
        else {
            this.container.appendChild(button);
        }
        this.buttons.set(chatMeta.chatID, button);
        this.paintChat(chatMeta.chatID);
    }
    removeButton(chatID) {
        this.buttons.get(chatID)?.remove();
        this.buttons.delete(chatID);
        this.metas.delete(chatID);
    }
    groupName(title) {
        const parts = title.split(/\s*[/–—]+\s*/);
        return parts[parts.length - 2];
    }
    shortTitle(title) {
        const parts = title.split(/\s*[/–—]+\s*/);
        return parts[parts.length - 1];
    }
    getGroup(groupName) {
        let group = this.groups.get(groupName);
        if (group == null) {
            group = new CollapseGroup(this.container, groupName);
            this.groups.set(groupName, group);
        }
        return group;
    }
}
class MenuView {
    constructor(parent, container) {
        this.globalModels = {};
        this.chatModels = {};
        this.arkModels = {};
        this.globalToggles = {};
        this.chatToggles = {};
        this.arkToggles = {};
        this.buttonGroups = new Map();
        this.modelNames = [];
        this.globalSettings = {};
        this.chatSettings = {};
        this.arkSettings = {};
        this.onArkChange = async () => {
            const arkName = this.chatArk.value ? this.chatArk.value : null;
            await this.saveLayer("chat", this.buildPatch("process", "arkName", arkName));
            this.arkName = arkName ?? this.readValue(this.globalSettings, "process", "arkName");
            this.arkSettings = await this.loadArkSettings(this.arkName);
            this.applyArkLayer();
        };
        this.nextRowID = 0;
        this.parent = parent;
        this.container = container;
        this.buildGlobalGroup();
        this.buildChatGroup();
        this.buildArkGroup();
    }
    async loadMenu(chatID) {
        this.chatID = chatID;
        this.globalSettings = await AgoraAPI.settings(null, null, false, null) ?? {};
        this.chatSettings = await AgoraAPI.settings(chatID, null, false, null) ?? {};
        this.arkName = this.readValue(this.chatSettings, "process", "arkName") ?? this.readValue(this.globalSettings, "process", "arkName");
        this.arkSettings = await this.loadArkSettings(this.arkName);
        this.modelNames = await AgoraAPI.modelList() ?? [];
        this.fillOptions(await AgoraAPI.models(), await AgoraAPI.arks());
        this.applyGlobalLayer();
        this.applyChatLayer();
        this.applyArkLayer();
    }
    buildGlobalGroup() {
        const group = new CollapseGroup(this.container, "Global Settings");
        this.addAction(group, "edit settings", () => this.openSettingsEditor("global"));
        this.addAction(group, "manage models", () => this.openModelEditor());
        this.addAction(group, "manage images", () => this.openImageEditor());
        this.addAction(group, "manage documents", () => this.openDocumentEditor());
        this.addAction(group, "manage todos", () => this.openTodoEditor());
        this.addAction(group, "manage ideas", () => this.openIdeaEditor());
        this.buildModelRows(group, "global", this.globalModels);
        this.buildToggleRows(group, "global", this.globalToggles, MenuView.globalToggleRows);
    }
    buildChatGroup() {
        const group = new CollapseGroup(this.container, "Chat Settings");
        this.addAction(group, "edit settings", () => this.openSettingsEditor(this.chatID));
        this.addAction(group, "manage context", () => this.openContextEditor());
        this.addAction(group, "archive chat", () => this.parent.onArchive());
        this.addAction(group, "save chat", () => this.parent.onSaveDocument());
        this.addAction(group, "copy chat", () => this.parent.onCopyContent());
        this.chatArk = document.createElement("select");
        this.chatArk.addEventListener("change", this.onArkChange);
        this.addRow(group, "Ark", this.chatArk);
        this.buildModelRows(group, "chat", this.chatModels);
        this.chatTemperature = this.buildTemperatureRow(group, "chat");
        this.buildToggleRows(group, "chat", this.chatToggles);
    }
    openContextEditor() {
        window.open(`/ui/content/context.html?chat=${this.chatID}`, "_blank");
    }
    openSettingsEditor(chatID) {
        window.open(`/ui/content/chats.html?chat=${chatID}`, "_blank");
    }
    openArkEditor() {
        if (this.arkName) {
            window.open(`/ui/content/arks.html?ark=${this.arkName}`, "_blank");
        }
    }
    openModelEditor() {
        const model = this.readValue(this.chatSettings, "generate", "mainModel") ?? this.readValue(this.arkSettings, "generate", "mainModel") ?? this.readValue(this.globalSettings, "generate", "mainModel");
        if (model) {
            window.open(`/ui/content/models.html?model=${encodeURIComponent(this.findModelName(model))}`, "_blank");
            return;
        }
        window.open("/ui/content/models.html", "_blank");
    }
    findModelName(model) {
        if (this.modelNames.indexOf(model) >= 0) {
            return model;
        }
        let result = null;
        for (const name of this.modelNames) {
            if (model.startsWith(`${name} `)) {
                if (result == null || name.length > result.length) {
                    result = name;
                }
            }
        }
        return result ?? model;
    }
    openMemoryEditor() {
        if (this.arkName) {
            window.open(`/ui/content/memory.html?ark=${this.arkName}`, "_blank");
        }
    }
    openImageEditor() {
        window.open("/ui/content/images.html", "_blank");
    }
    openDocumentEditor() {
        window.open("/ui/content/documents.html", "_blank");
    }
    openTodoEditor() {
        window.open("/ui/content/todos.html", "_blank");
    }
    openIdeaEditor() {
        window.open("/ui/content/ideas.html", "_blank");
    }
    buildArkGroup() {
        const group = new CollapseGroup(this.container, "Ark Settings");
        this.addAction(group, "edit settings", () => this.openArkEditor());
        this.addAction(group, "manage memory", () => this.openMemoryEditor());
        this.buildModelRows(group, "ark", this.arkModels);
        this.arkTemperature = this.buildTemperatureRow(group, "ark");
        this.buildToggleRows(group, "ark", this.arkToggles);
    }
    buildModelRows(group, layer, controls) {
        for (const row of MenuView.modelRows[layer]) {
            const select = document.createElement("select");
            select.addEventListener("change", () => this.onModelChange(layer, row, select));
            controls[row.label] = select;
            this.addRow(group, row.label, select, MenuView.modelHints[row.label]);
        }
    }
    async onModelChange(layer, row, select) {
        await this.saveLayer(layer, this.buildPatch(row.section, row.key, select.value ? select.value : null));
    }
    buildTemperatureRow(group, layer) {
        const select = document.createElement("select");
        select.addEventListener("change", () => this.saveLayer(layer, this.buildPatch("generate", "temp", select.value ? Number(select.value) : null)));
        this.addRow(group, "temp", select);
        return select;
    }
    buildToggleRows(group, layer, controls, rows = MenuView.toggleRows) {
        for (const row of rows) {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.addEventListener("change", () => this.saveToggle(layer, row, input));
            controls[row.label] = input;
            this.addRow(group, row.label, input);
        }
    }
    saveToggle(layer, row, input) {
        const value = input.checked ? null : false;
        this.saveLayer(layer, this.buildPatch(row.section, row.key, value));
    }
    async loadArkSettings(arkName) {
        if (arkName) {
            return await AgoraAPI.settings(null, arkName, false, null) ?? {};
        }
        return {};
    }
    async saveLayer(layer, settings) {
        if (layer == "ark" && this.arkName == null) {
            return;
        }
        const chatID = layer == "chat" ? this.chatID : null;
        const arkName = layer == "ark" ? this.arkName : null;
        const result = await this.parent.saveSettings(chatID, arkName, settings);
        if (layer == "global") {
            this.globalSettings = result;
            this.applyGlobalLayer();
        }
        else if (layer == "chat") {
            this.chatSettings = result;
            this.applyChatLayer();
        }
        else {
            this.arkSettings = result;
            this.applyArkLayer();
        }
    }
    applyGlobalLayer() {
        this.applyModels("global", this.globalModels, this.globalSettings);
        this.applyToggles(this.globalToggles, this.globalSettings, MenuView.globalToggleRows);
    }
    applyChatLayer() {
        this.applyModels("chat", this.chatModels, this.chatSettings);
        this.chatArk.value = this.readValue(this.chatSettings, "process", "arkName") ?? "";
        this.chatTemperature.value = this.valueText(this.readValue(this.chatSettings, "generate", "temp"));
        this.applyToggles(this.chatToggles, this.chatSettings);
    }
    applyArkLayer() {
        this.applyModels("ark", this.arkModels, this.arkSettings);
        this.arkTemperature.value = this.valueText(this.readValue(this.arkSettings, "generate", "temp"));
        this.applyToggles(this.arkToggles, this.arkSettings);
    }
    applyModels(layer, controls, settings) {
        for (const row of MenuView.modelRows[layer]) {
            controls[row.label].value = this.readValue(settings, row.section, row.key) ?? "";
        }
    }
    applyToggles(controls, settings, rows = MenuView.toggleRows) {
        for (const row of rows) {
            controls[row.label].checked = this.readValue(settings, row.section, row.key) ?? true;
        }
    }
    buildPatch(section, key, value) {
        const result = {};
        if (section == "process") {
            result.process = this.processPatch(key, value);
        }
        else if (section == "generate") {
            result.generate = this.generatePatch(key, value);
        }
        else if (section == "memory") {
            result.memory = this.memoryPatch(key, value);
        }
        else if (section == "tts") {
            result.tts = this.ttsPatch(key, value);
        }
        else {
            result.idea = this.ideaPatch(key, value);
        }
        return result;
    }
    processPatch(key, value) {
        const patch = {};
        patch[key] = value;
        return patch;
    }
    generatePatch(key, value) {
        const patch = {};
        patch[key] = value;
        return patch;
    }
    memoryPatch(key, value) {
        const patch = {};
        patch[key] = value;
        return patch;
    }
    ttsPatch(key, value) {
        const patch = {};
        patch[key] = value;
        return patch;
    }
    ideaPatch(key, value) {
        const patch = {};
        patch[key] = value;
        return patch;
    }
    readValue(settings, section, key) {
        const group = settings[section];
        if (group == null) {
            return null;
        }
        return group[key];
    }
    fillOptions(models, arks) {
        this.chatArk.innerHTML = "";
        this.chatArk.appendChild(this.buildUnsetOption());
        for (const arkName of arks) {
            this.chatArk.appendChild(this.buildOption(arkName, arkName));
        }
        for (const row of MenuView.modelRows.global) {
            this.fillModelSelect(this.globalModels[row.label], models);
        }
        for (const row of MenuView.modelRows.chat) {
            this.fillModelSelect(this.chatModels[row.label], models);
        }
        for (const row of MenuView.modelRows.ark) {
            this.fillModelSelect(this.arkModels[row.label], models);
        }
        this.fillTemperatureSelect(this.chatTemperature);
        this.fillTemperatureSelect(this.arkTemperature);
    }
    fillModelSelect(select, models) {
        select.innerHTML = "";
        select.appendChild(this.buildUnsetOption());
        const groups = new Map();
        for (const model of models) {
            if (model.group) {
                let group = groups.get(model.group);
                if (group == null) {
                    group = document.createElement("optgroup");
                    group.label = model.group;
                    select.appendChild(group);
                    groups.set(model.group, group);
                }
                group.appendChild(this.buildOption(model.name, model.display));
            }
            else {
                select.appendChild(this.buildOption(model.name, model.display));
            }
        }
    }
    fillTemperatureSelect(select) {
        select.innerHTML = "";
        select.appendChild(this.buildUnsetOption());
        for (const value of MenuView.temperatureValues) {
            select.appendChild(this.buildOption(String(value), String(value)));
        }
    }
    buildOption(value, text) {
        const option = document.createElement("option");
        option.innerText = text;
        option.value = value;
        return option;
    }
    buildUnsetOption() {
        const option = document.createElement("option");
        option.innerText = "–";
        option.value = "";
        return option;
    }
    valueText(value) {
        if (value == null) {
            return "";
        }
        return String(value);
    }
    addRow(group, label, control, hint = null) {
        const row = document.createElement("div");
        row.className = "settingRow";
        if (hint) {
            row.title = hint;
        }
        const text = document.createElement("label");
        text.innerText = label;
        if (control instanceof HTMLInputElement) {
            control.id = `setting-${++this.nextRowID}`;
            text.htmlFor = control.id;
        }
        row.appendChild(text);
        row.appendChild(control);
        group.content.appendChild(row);
    }
    addAction(group, label, handler) {
        const button = document.createElement("button");
        button.innerText = label;
        if (handler) {
            button.addEventListener("click", handler);
        }
        this.getButtonGroup(group).appendChild(button);
    }
    getButtonGroup(group) {
        let buttonGroup = this.buttonGroups.get(group);
        if (buttonGroup == null) {
            buttonGroup = document.createElement("div");
            buttonGroup.className = "buttonGroup";
            group.content.appendChild(buttonGroup);
            this.buttonGroups.set(group, buttonGroup);
        }
        return buttonGroup;
    }
}
MenuView.modelRows = {
    global: [
        { label: "main", section: "generate", key: "mainModel" },
        { label: "vision", section: "generate", key: "visionModel" },
        { label: "small", section: "generate", key: "smallModel" }
    ],
    chat: [
        { label: "main", section: "generate", key: "mainModel" },
        { label: "vision", section: "generate", key: "visionModel" },
        { label: "small", section: "generate", key: "smallModel" }
    ],
    ark: [
        { label: "main", section: "generate", key: "mainModel" },
        { label: "vision", section: "generate", key: "visionModel" },
        { label: "memory", section: "memory", key: "model" }
    ]
};
MenuView.modelHints = {
    main: "Model used for generating chat responses.",
    vision: "Model used when chat has recent images.",
    memory: "Used to generate Ark memories."
};
MenuView.toggleRows = [
    { label: "clock", section: "process", key: "useClock" },
    { label: "archive", section: "process", key: "useArchive" },
    { label: "learn", section: "memory", key: "allowWrite" },
    { label: "recall", section: "memory", key: "allowRead" },
    { label: "ideas", section: "idea", key: "enabled" },
];
MenuView.globalToggleRows = [
    { label: "audio", section: "tts", key: "enabled" },
];
MenuView.temperatureValues = [0, 0.25, 0.5, 0.75, 1];
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
const LINK_START = "(?:https?://|localhost://|\\d{1,3}(?:\\.\\d{1,3}){3}://|www\\.)";
const LINK_BODY = "[^\\s<>()\\[\\]{}\"']+";
const linkPattern = new RegExp(LINK_START + LINK_BODY, "gi");
const fullLinkPattern = new RegExp("^" + LINK_START + LINK_BODY + "$", "i");
const tokenPattern = new RegExp(LINK_START, "gi");
const linkTokens = ["http://", "https://", "localhost://", "www."];
const ipPartialPattern = /^(?=.*\d)[\d./:]+$/;
function trimLink(value) {
    return value.replace(/[.,;:!]+$/, "");
}
function linkifyText(value) {
    const segments = [];
    let index = 0;
    linkPattern.lastIndex = 0;
    let match;
    while ((match = linkPattern.exec(value)) != null) {
        if (match.index > index) {
            segments.push({ text: value.slice(index, match.index) });
        }
        const url = trimLink(match[0]);
        if (fullLinkPattern.test(url)) {
            segments.push({ link: url });
            index = match.index + url.length;
        }
        else {
            index = match.index;
        }
    }
    if (index < value.length) {
        segments.push({ text: value.slice(index) });
    }
    return segments;
}
function pendingLinkStart(value) {
    let start = value.length;
    while (start > 0 && !/\s/.test(value[start - 1])) {
        start--;
    }
    const tail = value.slice(start);
    tokenPattern.lastIndex = 0;
    const tokenMatch = tokenPattern.exec(tail);
    if (tokenMatch) {
        return start + tokenMatch.index;
    }
    for (let index = 0; index < tail.length; index++) {
        if (index > 0 && /\w/.test(tail[index - 1])) {
            continue;
        }
        const part = tail.slice(index);
        if (linkTokens.some(token => token.startsWith(part))) {
            return start + index;
        }
    }
    if (ipPartialPattern.test(tail)) {
        return start;
    }
    return value.length;
}
function linkHref(url) {
    return /^www\./i.test(url) ? `http://${url}` : url;
}
function createLinkElement(url) {
    const anchor = document.createElement("a");
    anchor.classList.add("messageLink");
    anchor.href = linkHref(url);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = url;
    return anchor;
}
function appendTextSegments(container, segments) {
    for (const segment of segments) {
        if (segment.link) {
            container.appendChild(createLinkElement(segment.link));
        }
        else if (segment.text) {
            container.appendChild(document.createTextNode(segment.text));
        }
    }
}
class MessageView {
    constructor(chatMessage, extraContent = "") {
        this.contentElement = null;
        this.imageElement = null;
        this.imageLink = null;
        this.hasHeader = false;
        this.pendingText = "";
        this.legacyImageIndex = 0;
        this.imageFailed = false;
        this.imageTriedFull = false;
        this.chatMessage = chatMessage;
        this.wrapperElement = document.createElement("span");
        this.wrapperElement.classList.add("messageWrapper");
        this.wrapperElement.classList.add(`type-${chatMessage.type}`);
        if (chatMessage.role) {
            this.wrapperElement.classList.add(`role-${chatMessage.role}`);
        }
        if (chatMessage.name == "raw") {
            this.wrapperElement.classList.add("data-raw");
        }
        const isRawImage = chatMessage.type == "image" && chatMessage.name == "raw";
        const isSavedImage = chatMessage.type == "image" && chatMessage.name != "raw";
        if (isRawImage) {
            this.imageElement = document.createElement("img");
            this.imageElement.src = "data:image;base64," + chatMessage.content;
            this.wrapperElement.appendChild(this.imageElement);
        }
        else if (isSavedImage) {
            this.imageLink = document.createElement("a");
            this.imageLink.target = "_blank";
            this.imageElement = document.createElement("img");
            this.imageLink.appendChild(this.imageElement);
            this.wrapperElement.appendChild(this.imageLink);
        }
        const label = this.labelText(chatMessage);
        if (label) {
            this.labelElement = document.createElement("span");
            this.labelElement.classList.add("messageHeader");
            this.labelElement.innerText = label;
            this.wrapperElement.appendChild(this.labelElement);
        }
        this.hasHeader = label != "" || extraContent != "";
        if (extraContent) {
            if (label) {
                this.wrapperElement.appendChild(document.createTextNode("\n"));
            }
            this.wrapperElement.appendChild(document.createTextNode(extraContent));
        }
        this.tailElement = document.createTextNode("\n\n");
        this.wrapperElement.appendChild(this.tailElement);
        if (isSavedImage) {
            this.renderImage();
        }
        if (!isRawImage && !isSavedImage) {
            if (chatMessage.type == "document") {
                if (this.isRawDocument(chatMessage) || chatMessage.content) {
                    this.renderDocument(chatMessage);
                }
                else {
                    this.setupDocument(chatMessage);
                }
            }
            else {
                this.renderText(chatMessage.content);
            }
        }
    }
    labelText(chatMessage) {
        if (chatMessage.role == "info") {
            return "";
        }
        if (chatMessage.type == "message") {
            return chatMessage.name ? `### ${chatMessage.name}:` : "";
        }
        return "";
    }
    isRawDocument(chatMessage) {
        return chatMessage.type == "document" && chatMessage.name == "raw";
    }
    entryTitle(chatMessage) {
        if (this.isRawDocument(chatMessage)) {
            return "RAW Document";
        }
        return chatMessage.name;
    }
    entryContent(chatMessage) {
        if (this.isRawDocument(chatMessage)) {
            return this.shortenDocument(chatMessage.content);
        }
        return chatMessage.content;
    }
    shortenDocument(content) {
        return TextUtil.shortifyTextNicely(content, MessageView.documentLineCount, MessageView.documentLineLength);
    }
    renderImage() {
        const files = this.resolveImageFiles();
        if (files == null) {
            this.renderLegacyImage();
            return;
        }
        this.imageLink.href = `/ui/images/${encodeURIComponent(files.original)}`;
        this.imageElement.onerror = () => {
            if (this.imageTriedFull == false && files.original != files.small) {
                this.imageTriedFull = true;
                this.imageElement.src = `/ui/images/${encodeURIComponent(files.original)}`;
            }
            else {
                this.failImage();
            }
        };
        this.imageElement.src = `/ui/images/${encodeURIComponent(files.small)}`;
    }
    resolveImageFiles() {
        const name = this.chatMessage.name;
        if (name && name.indexOf(".original.") >= 0) {
            return { small: name.replace(".original.", ".small."), original: name };
        }
        if (this.isImageFileName(name)) {
            const dot = name.lastIndexOf(".");
            return { small: `${name.slice(0, dot)}.small${name.slice(dot)}`, original: name };
        }
        const lines = this.chatMessage.content.split("\n");
        if (this.isImageFileName(lines[0])) {
            const small = lines[0];
            const original = this.isImageFileName(lines[1]) ? lines[1] : small;
            return { small, original };
        }
        return null;
    }
    isImageFileName(name) {
        return /\.(jpeg|png|webp|gif)$/i.test(name ?? "");
    }
    renderLegacyImage() {
        if (this.legacyImageIndex >= MessageView.legacyImageExts.length) {
            this.failImage();
            return;
        }
        const ext = MessageView.legacyImageExts[this.legacyImageIndex];
        const small = `${this.chatMessage.name}.small.${ext}`;
        const original = `${this.chatMessage.name}.original.${ext}`;
        this.imageElement.onerror = () => {
            ++this.legacyImageIndex;
            this.renderLegacyImage();
        };
        this.imageElement.src = `/ui/images/${encodeURIComponent(small)}`;
        this.imageLink.href = `/ui/images/${encodeURIComponent(original)}`;
    }
    failImage() {
        this.imageFailed = true;
        this.imageElement.onerror = null;
        if (this.imageLink) {
            this.imageLink.remove();
        }
        else {
            this.imageElement.remove();
        }
        this.renderDocument(this.chatMessage);
    }
    getMessage() {
        return this.chatMessage;
    }
    getElement() {
        return this.wrapperElement;
    }
    renderText(text) {
        if (text == "") {
            return;
        }
        this.ensureContent();
        this.contentElement.textContent = "";
        appendTextSegments(this.contentElement, linkifyText(text));
    }
    renderDocument(chatMessage) {
        this.renderEntryText(this.entryTitle(chatMessage), this.entryContent(chatMessage));
    }
    setupDocument(chatMessage) {
        this.ensureContent();
        this.contentElement.textContent = "";
        const title = this.entryTitle(chatMessage);
        if (title) {
            const titleElement = document.createElement("strong");
            titleElement.classList.add("messageTitle");
            titleElement.textContent = title;
            this.contentElement.appendChild(titleElement);
            this.contentElement.appendChild(document.createTextNode("\n\n"));
        }
    }
    renderEntryText(title, content) {
        if (title == "" && content == "") {
            return;
        }
        this.ensureContent();
        this.contentElement.textContent = "";
        if (title) {
            const titleElement = document.createElement("strong");
            titleElement.classList.add("messageTitle");
            titleElement.textContent = title;
            this.contentElement.appendChild(titleElement);
            this.contentElement.appendChild(document.createTextNode("\n\n"));
        }
        appendTextSegments(this.contentElement, linkifyText(content));
    }
    renderPending() {
        this.ensureContent();
        const hold = pendingLinkStart(this.pendingText);
        appendTextSegments(this.contentElement, linkifyText(this.pendingText.slice(0, hold)));
        this.pendingText = this.pendingText.slice(hold);
    }
    ensureContent() {
        if (this.contentElement == null) {
            this.contentElement = document.createElement("span");
            this.contentElement.classList.add("messageContent");
            if (this.hasHeader) {
                this.wrapperElement.insertBefore(document.createTextNode("\n\n"), this.tailElement);
            }
            this.wrapperElement.insertBefore(this.contentElement, this.tailElement);
        }
    }
    flush() {
        if (this.contentElement && this.pendingText) {
            appendTextSegments(this.contentElement, linkifyText(this.pendingText));
            this.pendingText = "";
        }
    }
    appendChunk(chunk) {
        this.chatMessage.content += chunk;
        if (this.chatMessage.type == "image") {
            if (this.chatMessage.name == "raw") {
                this.imageElement.src = "data:image;base64," + this.chatMessage.content;
            }
            else if (this.imageFailed) {
                this.renderDocument(this.chatMessage);
            }
            return;
        }
        if (this.chatMessage.type == "document") {
            if (this.isRawDocument(this.chatMessage)) {
                this.renderDocument(this.chatMessage);
            }
            else {
                this.pendingText += chunk;
                this.renderPending();
            }
            return;
        }
        this.pendingText += chunk;
        this.renderPending();
    }
}
MessageView.documentLineCount = 10;
MessageView.documentLineLength = 300;
MessageView.legacyImageExts = ["jpeg", "png"];
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
class ContextView {
    constructor(contentWrapper, chatContent) {
        this.messages = [];
        this.current = null;
        this.buffer = "";
        this.escapeHold = "";
        this.contentWrapper = contentWrapper;
        this.chatContent = chatContent;
        this.dateGapHander = this.newGapHandler();
    }
    async loadContext(chatID) {
        const context = await AgoraAPI.readContext(chatID);
        this.chatContent.innerHTML = "";
        this.messages = [];
        this.current = null;
        this.buffer = "";
        this.escapeHold = "";
        this.dateGapHander = this.newGapHandler();
        for (const message of context) {
            this.appendMessage(message);
        }
    }
    async loadDiff(chatID) {
        const context = await AgoraAPI.readContext(chatID);
        const anchor = this.firstDiff(context);
        if (anchor == -1) {
            return;
        }
        while (this.messages.length > anchor) {
            const view = this.messages.pop();
            view.getElement().remove();
        }
        this.current = this.messages[this.messages.length - 1] ?? null;
        this.buffer = "";
        this.escapeHold = "";
        this.rebuildGaps(anchor);
        for (let index = anchor; index < context.length; ++index) {
            this.appendMessage(context[index]);
        }
    }
    appendMessage(message) {
        this.flushEscape();
        if (this.current) {
            this.current.flush();
        }
        let label;
        if (message.role == "user" || message.role == "ark") {
            const result = this.dateGapHander.check(message.time);
            if (result.time) {
                if (result.date) {
                    label = `${result.date} ${result.time}`;
                }
                else {
                    label = result.time;
                }
            }
        }
        const view = new MessageView(message, label);
        this.messages.push(view);
        this.current = view;
        this.chatContent.appendChild(view.getElement());
        this.scrollToBottom();
        return view;
    }
    appendChunk(chunk) {
        this.feed(chunk);
        return chunk;
    }
    removeMessage(role, shallow) {
        for (let index = this.messages.length - 1; index >= 0; --index) {
            const entry = this.messages[index].getMessage();
            if (entry.type == "message" && entry.role == role) {
                this.removeAt(index);
                return;
            }
            if (entry.type == "message" && shallow) {
                return;
            }
        }
    }
    removeAt(cut) {
        const removed = [];
        while (this.messages.length > cut) {
            const view = this.messages.pop();
            view.getElement().remove();
            removed.unshift(view.getMessage());
        }
        this.current = this.messages[this.messages.length - 1] ?? null;
        this.buffer = "";
        this.escapeHold = "";
        return removed;
    }
    flush() {
        this.releaseHolds();
        if (this.current) {
            this.current.flush();
        }
    }
    feed(chunk) {
        this.buffer += chunk;
        while (true) {
            const start = this.buffer.indexOf("[[");
            if (start == -1) {
                let flush = this.buffer;
                let hold = "";
                if (flush.endsWith("[")) {
                    hold = "[";
                    flush = flush.slice(0, -1);
                }
                else if (flush.endsWith("\n")) {
                    hold = "\n";
                    flush = flush.slice(0, -1);
                }
                this.buffer = hold;
                this.appendContent(flush);
                return;
            }
            let before = this.buffer.slice(0, start);
            if (before.endsWith("\r\n")) {
                before = before.slice(0, -2);
            }
            else if (before.endsWith("\n")) {
                before = before.slice(0, -1);
            }
            this.appendContent(before);
            const end = this.buffer.indexOf("]]", start);
            if (end == -1) {
                this.buffer = this.buffer.slice(start);
                return;
            }
            const meta = this.buffer.slice(start, end + 2);
            this.buffer = this.buffer.slice(end + 2);
            if (this.buffer.startsWith("\r\n")) {
                this.buffer = this.buffer.slice(2);
            }
            else if (this.buffer.startsWith("\n")) {
                this.buffer = this.buffer.slice(1);
            }
            this.processMeta(meta);
        }
    }
    appendContent(content) {
        if (!content || !this.current) {
            return;
        }
        const isAtBottom = this.isAtBottom();
        this.appendLive(this.decodeContent(content));
        if (isAtBottom) {
            this.scrollToBottom();
        }
    }
    appendLive(content) {
        this.current.appendChunk(content);
    }
    decodeContent(content) {
        let result = this.escapeHold + content;
        this.escapeHold = "";
        if (result.endsWith("\\")) {
            this.escapeHold = "\\";
            result = result.slice(0, -1);
        }
        return result.replace(/\\\[/g, "[").replace(/\\\]/g, "]");
    }
    flushEscape() {
        if (this.escapeHold && this.current) {
            this.current.appendChunk(this.escapeHold);
        }
        this.escapeHold = "";
    }
    releaseHolds() {
        if (!this.current) {
            this.buffer = "";
            this.escapeHold = "";
            return;
        }
        let held = this.escapeHold + this.buffer;
        this.buffer = "";
        this.escapeHold = "";
        if (held.endsWith("\n")) {
            held = held.slice(0, -1);
        }
        if (held) {
            this.appendLive(held.replace(/\\\[/g, "[").replace(/\\\]/g, "]"));
        }
    }
    processMeta(meta) {
        const parts = meta.slice(2, -2).trim().split(/\s+/);
        const kind = parts.shift();
        const attrs = {};
        for (const part of parts) {
            const index = part.indexOf("=");
            if (index >= 0) {
                attrs[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
            }
        }
        if (kind == "message") {
            this.appendMessage({
                type: "message",
                time: attrs.time ? parseInt(attrs.time) : Date.now(),
                role: attrs.role ?? "ark",
                name: attrs.name ?? "",
                content: ""
            });
        }
        else if (kind == "image" || kind == "document") {
            this.appendMessage({
                type: kind,
                name: attrs.name ?? "",
                content: ""
            });
        }
    }
    popMessage() {
        if (this.messages.length) {
            const lastView = this.messages.pop();
            lastView.getElement().remove();
            this.current = this.messages[this.messages.length - 1] ?? null;
            return lastView.getMessage();
        }
        return null;
    }
    getContent() {
        return this.chatContent.innerText;
    }
    isAtBottom() {
        return Math.abs(this.contentWrapper.scrollTop - this.contentWrapper.scrollHeight + this.contentWrapper.clientHeight) < 10;
    }
    scrollToBottom() {
        this.contentWrapper.scrollTop = this.contentWrapper.scrollHeight - this.contentWrapper.clientHeight;
    }
    newGapHandler() {
        return new DateGapHandler(1800000, 300000, 300000);
    }
    firstDiff(context) {
        const limit = Math.min(this.messages.length, context.length);
        for (let index = 0; index < limit; ++index) {
            const entry = this.messages[index].getMessage();
            if (entry.time != context[index].time || entry.type != context[index].type) {
                return index;
            }
        }
        if (this.messages.length != context.length) {
            return limit;
        }
        return -1;
    }
    rebuildGaps(anchor) {
        this.dateGapHander = this.newGapHandler();
        for (let index = 0; index < anchor; ++index) {
            const entry = this.messages[index].getMessage();
            if (entry.role == "user" || entry.role == "ark") {
                this.dateGapHander.check(entry.time);
            }
        }
    }
}
var TextEditor;
(function (TextEditor) {
    function bind(input) {
        input.addEventListener("keydown", event => TextEditor.onKeyDown(input, event));
    }
    TextEditor.bind = bind;
    function isChord(event) {
        if (event.ctrlKey && event.altKey) {
            return true;
        }
        if (event.ctrlKey && event.metaKey) {
            return true;
        }
        return event.altKey && event.metaKey;
    }
    TextEditor.isChord = isChord;
    function onKeyDown(input, event) {
        if (event.key == "Tab") {
            event.preventDefault();
            if (event.shiftKey) {
                TextEditor.shiftIndent(input, -1);
            }
            else {
                TextEditor.insertTab(input);
            }
            return;
        }
        if (TextEditor.isChord(event)) {
            if (event.key == "ArrowRight") {
                event.preventDefault();
                TextEditor.shiftIndent(input, 1);
                return;
            }
            if (event.key == "ArrowLeft") {
                event.preventDefault();
                TextEditor.shiftIndent(input, -1);
                return;
            }
            if (event.key == "ArrowUp") {
                event.preventDefault();
                TextEditor.moveLines(input, -1);
                return;
            }
            if (event.key == "ArrowDown") {
                event.preventDefault();
                TextEditor.moveLines(input, 1);
            }
        }
    }
    TextEditor.onKeyDown = onKeyDown;
    function shiftIndent(input, delta) {
        const result = TextUtil.shiftIndent(input.value, input.selectionStart, input.selectionEnd, delta);
        input.value = result.value;
        input.selectionStart = result.start;
        input.selectionEnd = result.end;
    }
    TextEditor.shiftIndent = shiftIndent;
    function insertTab(input) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.slice(0, start) + "\t" + input.value.slice(end);
        input.selectionStart = start + 1;
        input.selectionEnd = start + 1;
    }
    TextEditor.insertTab = insertTab;
    function moveLines(input, delta) {
        const value = input.value;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const lines = value.split("\n");
        const firstLine = value.slice(0, start).split("\n").length - 1;
        let lastLine = value.slice(0, end).split("\n").length - 1;
        if (end > start && value[end - 1] == "\n") {
            --lastLine;
        }
        if (lastLine < firstLine) {
            lastLine = firstLine;
        }
        const count = lastLine - firstLine + 1;
        const target = firstLine + delta;
        if (target < 0 || target > lines.length - count) {
            return;
        }
        const oldStart = TextEditor.lineOffset(lines, firstLine);
        const block = lines.splice(firstLine, count);
        lines.splice(target, 0, ...block);
        const newStart = TextEditor.lineOffset(lines, target);
        input.value = lines.join("\n");
        input.selectionStart = newStart + (start - oldStart);
        input.selectionEnd = newStart + (end - oldStart);
    }
    TextEditor.moveLines = moveLines;
    function lineOffset(lines, index) {
        let result = 0;
        for (let i = 0; i < index; ++i) {
            result += lines[i].length + 1;
        }
        return result;
    }
    TextEditor.lineOffset = lineOffset;
})(TextEditor || (TextEditor = {}));
class ChatInput {
    constructor(parent, messageInput, tryAgainButton, editLastButton, attachButton, sendButton) {
        this.state = "idle";
        this.archived = false;
        this.documents = [];
        this.images = [];
        this.onTryAgain = async () => {
            await this.parent.onTryAgain();
        };
        this.onKeyDown = (event) => {
            if (TextEditor.isChord(event)) {
                return;
            }
            if (event.key == "ArrowUp" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.onEditLast();
                return;
            }
            if (event.key == "ArrowDown" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.onTryAgain();
                return;
            }
            if (event.key == "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.onSend();
            }
        };
        this.onEditLast = async () => {
            await this.parent.onEditLast();
        };
        this.onAttach = async () => {
            if (this.images.length || this.documents.length) {
                this.clearAttached();
            }
            else {
                this.attachInput.click();
            }
        };
        this.onDragOver = (event) => {
            if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
            }
        };
        this.onDrop = (event) => {
            if (event.dataTransfer.files.length == 0) {
                return;
            }
            event.preventDefault();
            this.addFiles(event.dataTransfer.files);
        };
        this.onSend = async () => {
            if (this.archived) {
                return;
            }
            if (this.state == "active") {
                this.state = "raised";
                this.updateSend();
                await this.parent.raiseHand();
                return;
            }
            if (this.state == "raised") {
                this.state = "aborted";
                this.updateSend();
                await this.parent.abort();
                return;
            }
            if (this.state == "aborted") {
                return;
            }
            const content = this.messageInput.value;
            const documents = this.documents;
            const images = this.images;
            this.clearMessage();
            this.clearAttached();
            this.state = "active";
            this.updateSend();
            try {
                await this.parent.onSend(content, images, documents);
            }
            finally {
                this.state = "idle";
                this.updateSend();
            }
        };
        this.onFileSelect = async () => {
            this.addFiles(this.attachInput.files);
        };
        this.parent = parent;
        this.messageInput = messageInput;
        this.tryAgainButton = tryAgainButton;
        this.editLastButton = editLastButton;
        this.attachButton = attachButton;
        this.sendButton = sendButton;
        const disabler = this.parent.getDisabler();
        disabler.addInput(tryAgainButton);
        disabler.addInput(editLastButton);
        disabler.addInput(attachButton);
        disabler.addInput(sendButton, () => this.updateSend());
        this.tryAgainButton.addEventListener("click", this.onTryAgain);
        this.editLastButton.addEventListener("click", this.onEditLast);
        this.attachButton.addEventListener("click", this.onAttach);
        this.sendButton.addEventListener("click", this.onSend);
        this.messageInput.addEventListener("keydown", this.onKeyDown);
        TextEditor.bind(this.messageInput);
        this.attachInput = document.createElement("input");
        this.attachInput.type = "file";
        this.attachInput.multiple = true;
        this.attachInput.addEventListener("change", this.onFileSelect);
        window.addEventListener("dragover", this.onDragOver);
        window.addEventListener("drop", this.onDrop);
        this.updateSend();
    }
    updateSend() {
        if (this.archived || this.state == "idle") {
            this.sendButton.textContent = "send";
            this.sendButton.classList.remove("hand");
            this.sendButton.classList.remove("stop");
        }
        else if (this.state == "active") {
            this.sendButton.textContent = "hand";
            this.sendButton.classList.add("hand");
            this.sendButton.classList.remove("stop");
        }
        else {
            this.sendButton.textContent = "stop";
            this.sendButton.classList.remove("hand");
            this.sendButton.classList.add("stop");
        }
    }
    addFiles(files) {
        for (const file of files) {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.addEventListener("load", event => this.onImageRead(file.name, file.type, event.target ? event.target.result : null));
                reader.readAsDataURL(file);
            }
            else {
                const reader = new FileReader();
                reader.addEventListener("load", event => this.onDocumentRead(file.name, file.type, event.target ? event.target.result : null));
                reader.readAsText(file);
            }
        }
    }
    static detectExtension(name, type) {
        const dot = (name ?? "").lastIndexOf(".");
        if (dot > 0 && dot < name.length - 1) {
            return name.slice(dot + 1).toLowerCase();
        }
        return type.split("/")[1] ?? type;
    }
    onImageRead(name, type, data) {
        if (typeof data == "string") {
            const ext = ChatInput.detectExtension(name, type);
            this.images.push(`ext=${ext}\ndata=${data.split(",")[1]}`);
            this.updateAttached();
        }
    }
    onDocumentRead(name, type, data) {
        if (typeof data == "string") {
            const ext = ChatInput.detectExtension(name, type);
            this.documents.push(`ext=${ext}\ndata=${data}`);
            this.updateAttached();
        }
    }
    clearMessage() {
        this.messageInput.value = "";
    }
    begin() {
        this.state = "active";
        this.updateSend();
    }
    end() {
        this.state = "idle";
        this.updateSend();
    }
    setArchived(archived) {
        this.archived = archived;
        if (archived) {
            this.state = "idle";
        }
        this.updateSend();
        if (archived) {
            this.sendButton.disabled = true;
            this.sendButton.style.pointerEvents = "none";
            this.sendButton.style.cursor = "default";
            this.sendButton.style.opacity = "0.5";
        }
        else {
            this.sendButton.disabled = false;
            this.sendButton.style.pointerEvents = "";
            this.sendButton.style.cursor = "";
            this.sendButton.style.opacity = "";
        }
    }
    setMessage(message) {
        this.messageInput.value = message.content ?? "";
        this.attachInput.value = "";
        this.images = message.images ?? [];
        this.documents = message.documents ?? [];
        this.updateAttached();
    }
    updateAttached() {
        const count = this.images.length + this.documents.length;
        if (count) {
            this.attachButton.textContent = `remove (${count})`;
        }
        else {
            this.attachButton.textContent = "attach";
        }
    }
    clearAttached() {
        this.attachButton.textContent = "attach";
        this.attachInput.value = "";
        this.documents = [];
        this.images = [];
    }
}
class SpeechPlayer {
    constructor() {
        this.controller = null;
        this.sources = [];
        this.leftover = new Uint8Array(0);
        this.nextTime = 0;
    }
    prepare() {
        if (this.context == null) {
            this.context = new AudioContext();
        }
        this.context.resume();
    }
    start(url) {
        this.stop();
        this.prepare();
        this.controller = new AbortController();
        this.play(url, this.controller.signal);
    }
    stop() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
        for (const source of this.sources) {
            source.stop();
        }
        this.sources = [];
        this.leftover = new Uint8Array(0);
        this.nextTime = 0;
    }
    async play(url, signal) {
        let response;
        try {
            response = await fetch(url, { signal });
        }
        catch {
            return;
        }
        if (response.ok == false || response.body == null) {
            return;
        }
        for await (const chunk of StreamUtil.asIterable(response.body)) {
            if (signal.aborted) {
                return;
            }
            this.append(chunk);
        }
    }
    append(chunk) {
        const combined = new Uint8Array(this.leftover.length + chunk.length);
        combined.set(this.leftover, 0);
        combined.set(chunk, this.leftover.length);
        const count = combined.length - combined.length % 2;
        if (count == 0) {
            this.leftover = combined;
            return;
        }
        this.leftover = combined.slice(count);
        const samples = new Int16Array(combined.buffer, combined.byteOffset, count / 2);
        this.schedule(samples);
    }
    schedule(samples) {
        const buffer = this.context.createBuffer(1, samples.length, SpeechPlayer.sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < samples.length; ++index) {
            data[index] = samples[index] / 32768;
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        const time = Math.max(this.nextTime, this.context.currentTime + 0.1);
        source.start(time);
        this.nextTime = time + buffer.duration;
        this.sources.push(source);
        source.addEventListener("ended", () => {
            const index = this.sources.indexOf(source);
            if (index >= 0) {
                this.sources.splice(index, 1);
            }
        });
    }
}
SpeechPlayer.sampleRate = 24000;
var FontUtil;
(function (FontUtil) {
    const chatKey = "chatFont";
    const editorKey = "editorFont";
    const chatDefault = "Roboto";
    const editorDefault = "Consolas";
    const families = ["Roboto", "Charter", "Consolas"];
    const classes = ["fontCharter", "fontRoboto", "fontConsolas"];
    function applyChat(family = readChat()) {
        apply(family);
    }
    FontUtil.applyChat = applyChat;
    function applyEditor(family = readEditor()) {
        apply(family);
    }
    FontUtil.applyEditor = applyEditor;
    function readChat() {
        return read(chatKey, chatDefault);
    }
    FontUtil.readChat = readChat;
    function readEditor() {
        return read(editorKey, editorDefault);
    }
    FontUtil.readEditor = readEditor;
    function writeChat(family) {
        localStorage.setItem(chatKey, family);
        applyChat(family);
    }
    FontUtil.writeChat = writeChat;
    function writeEditor(family) {
        localStorage.setItem(editorKey, family);
        applyEditor(family);
    }
    FontUtil.writeEditor = writeEditor;
    function getFamilies() {
        return families.slice();
    }
    FontUtil.getFamilies = getFamilies;
    function read(key, fallback) {
        const stored = localStorage.getItem(key);
        if (families.includes(stored)) {
            return stored;
        }
        return fallback;
    }
    function apply(family) {
        document.body.classList.remove(...classes);
        document.body.classList.add(`font${family}`);
    }
})(FontUtil || (FontUtil = {}));
class AgoraUI {
    constructor() {
        this.speechPlayer = new SpeechPlayer();
        this.combinedSettings = {};
        this.chatPollInterval = 60000;
        this.running = false;
        this.pendingPoll = false;
        this.tail = Promise.resolve();
        this.createChat = async () => {
            const chatMeta = await AgoraAPI.create();
            if (chatMeta) {
                await this.runBlocked("blockAll", () => this.selectAndLoad());
            }
        };
        this.renameChat = async () => {
            const title = prompt("Enter new chat title:", this.chatTitle.innerText);
            if (title) {
                await this.runBlocked("blockAll", async () => {
                    await this.saveSettings(this.chatMeta.chatID, null, { title });
                    await this.chatList.loadChatList();
                });
            }
        };
        this.copyChat = async () => {
            const title = prompt("Enter new chat title:", this.chatTitle.innerText);
            if (title) {
                await this.runBlocked("blockAll", async () => {
                    const newChatMeta = await AgoraAPI.copy(this.chatMeta.chatID, title);
                    if (newChatMeta) {
                        await this.selectAndLoad();
                    }
                });
            }
        };
        this.clearChat = async () => {
            const chatID = this.chatMeta.chatID;
            const title = this.chatMeta.title;
            const confirmed = confirm(`Are you sure you want to clear ${title}?`);
            if (confirmed) {
                await this.runBlocked("blockLoad", async () => {
                    this.disabler.disableGroup(chatID);
                    const remember = confirm("Do you wish the Ark to remember the conversation?");
                    const onChunk = (chunk) => {
                        return this.contextView.appendChunk(chunk);
                    };
                    await AgoraAPI.clear(chatID, remember, onChunk);
                    await this.contextView.loadContext(chatID);
                    this.disabler.enableGroup(chatID);
                });
            }
        };
        this.deleteChat = async () => {
            const chatID = this.chatMeta.chatID;
            const title = this.chatMeta.title;
            const confirmed = confirm(`Are you sure you want to delete ${title}?`);
            if (confirmed) {
                await this.runBlocked("blockAll", async () => {
                    this.disabler.disableGroup(chatID);
                    const remember = confirm("Do you wish the Ark to remember the conversation?");
                    const onChunk = (chunk) => {
                        return this.contextView.appendChunk(chunk);
                    };
                    await AgoraAPI.delete(chatID, remember, onChunk);
                    await this.selectAndLoad();
                    this.disabler.enableGroup(chatID);
                });
            }
        };
        this.onArchive = async () => {
            const chatID = this.chatMeta.chatID;
            const title = this.chatMeta.title;
            const confirmed = confirm(`Archive ${title}?`);
            if (confirmed) {
                await this.runBlocked("blockLoad", async () => {
                    this.disabler.disableGroup(chatID);
                    const remember = confirm("Do you wish the Ark to remember the conversation?");
                    const onChunk = (chunk) => {
                        return this.contextView.appendChunk(chunk);
                    };
                    await AgoraAPI.archive(chatID, remember, onChunk);
                    await this.refreshTitle();
                    await this.contextView.loadContext(chatID);
                    await this.chatList.loadChatList();
                    this.disabler.enableGroup(chatID);
                });
            }
        };
    }
    bindAction(name, handler, useDisabler) {
        const button = document.getElementById(name);
        if (button) {
            button.addEventListener("click", handler);
            if (useDisabler) {
                this.disabler.addInput(button);
            }
        }
    }
    getChatMeta() {
        return this.chatMeta;
    }
    getDisabler() {
        return this.disabler;
    }
    async init() {
        FontUtil.applyChat();
        this.disabler = new InputDisabler();
        this.chatList = new ChatList(this, document.getElementById("chatList"));
        this.menuView = new MenuView(this, document.getElementById("menuBar"));
        this.bindAction("createButton", this.createChat, false);
        this.bindAction("renameButton", this.renameChat, true);
        this.bindAction("copyButton", this.copyChat, true);
        this.bindAction("clearButton", this.clearChat, true);
        this.bindAction("deleteButton", this.deleteChat, true);
        this.contextView = new ContextView(document.getElementById("contentWrapper"), document.getElementById("chatContent"));
        this.chatInput = new ChatInput(this, document.getElementById("messageInput"), document.getElementById("tryAgainButton"), document.getElementById("editLastButton"), document.getElementById("attachButton"), document.getElementById("sendButton"));
        this.chatTitle = document.getElementById("chatTitle");
        this.menuButton = document.getElementById("menuButton");
        this.buildFontSelect();
        this.chatTitle.addEventListener("click", event => {
            event.stopPropagation();
            this.toggleSidebar("chatList");
        });
        this.menuButton.addEventListener("click", event => {
            event.stopPropagation();
            this.toggleSidebar("menu");
        });
        document.getElementById("main").addEventListener("click", event => {
            if (this.isNarrow() && this.isAnySidebarOpen()) {
                event.stopPropagation();
                this.hideSidebars();
            }
        });
        this.applySidebarDefaults();
        await this.loadInitial();
        this.startChatPoll();
    }
    buildFontSelect() {
        const panel = document.getElementById("titlePanel");
        if (panel == null) {
            return;
        }
        const select = document.createElement("select");
        select.id = "fontSelect";
        for (const family of FontUtil.getFamilies()) {
            const option = document.createElement("option");
            option.innerText = family;
            option.value = family;
            select.appendChild(option);
        }
        select.value = FontUtil.readChat();
        select.addEventListener("change", () => FontUtil.writeChat(select.value));
        panel.insertBefore(select, this.menuButton);
    }
    setBlockMode(mode) {
        document.body.classList.remove("blockAll");
        document.body.classList.remove("blockLoad");
        document.body.classList.remove("blockRun");
        if (mode) {
            document.body.classList.add(mode);
        }
    }
    runBlocked(mode, action) {
        const run = this.tail.then(() => this.enter(mode, action));
        this.tail = run.then(() => { }, () => { });
        return run;
    }
    async enter(mode, action) {
        this.running = true;
        this.setBlockMode(mode);
        try {
            await action();
        }
        finally {
            this.setBlockMode(null);
            this.running = false;
            if (this.pendingPoll) {
                this.pendingPoll = false;
                this.pollChatList();
            }
        }
    }
    isNarrow() {
        return window.innerWidth <= 850;
    }
    applySidebarDefaults() {
        if (this.isNarrow()) {
            this.setSidebar("chatList", false);
            this.setSidebar("menu", false);
            return;
        }
        const chatList = this.readSidebarState("chatList") ?? window.innerWidth > 1100;
        const menu = this.readSidebarState("menu") ?? window.innerWidth > 1400;
        this.setSidebar("chatList", chatList);
        this.setSidebar("menu", menu);
    }
    readSidebarState(name) {
        const stored = localStorage.getItem(`sidebar.${name}`);
        if (stored) {
            return stored == "1";
        }
        return null;
    }
    toggleSidebar(name) {
        const open = !document.body.classList.contains(`${name}Visible`);
        if (open && this.isNarrow()) {
            const other = name == "chatList" ? "menu" : "chatList";
            this.setSidebar(other, false);
        }
        this.setSidebar(name, open);
        if (this.isNarrow()) {
            return;
        }
        localStorage.setItem(`sidebar.${name}`, open ? "1" : "0");
    }
    setSidebar(name, open) {
        if (open) {
            document.body.classList.add(`${name}Visible`);
            document.body.classList.remove(`${name}Hidden`);
        }
        else {
            document.body.classList.add(`${name}Hidden`);
            document.body.classList.remove(`${name}Visible`);
        }
    }
    isAnySidebarOpen() {
        return document.body.classList.contains("chatListVisible") || document.body.classList.contains("menuVisible");
    }
    hideSidebars() {
        this.setSidebar("chatList", false);
        this.setSidebar("menu", false);
    }
    async loadInitial() {
        await this.runBlocked("blockAll", () => this.selectAndLoad());
    }
    async selectAndLoad() {
        this.setBlockMode("blockAll");
        let chatMeta = await this.chatList.loadChatList();
        if (chatMeta == null) {
            await AgoraAPI.create();
            chatMeta = await this.chatList.loadChatList();
        }
        if (chatMeta) {
            this.setBlockMode("blockLoad");
            await this.loadChat(chatMeta);
        }
    }
    async loadChat(chatMeta) {
        this.chatMeta = chatMeta;
        this.disabler.selectGroup(chatMeta.chatID);
        this.chatList.selectChat(chatMeta.chatID);
        await this.menuView.loadMenu(chatMeta.chatID);
        await this.contextView.loadContext(chatMeta.chatID);
        await this.refreshTitle();
        if (this.isNarrow()) {
            this.hideSidebars();
        }
    }
    async updateChat(chatMeta) {
        await this.menuView.loadMenu(chatMeta.chatID);
        await this.contextView.loadDiff(chatMeta.chatID);
        await this.refreshTitle();
    }
    async pollChatList() {
        if (this.running) {
            this.pendingPoll = true;
            return;
        }
        await this.runBlocked("blockAll", async () => {
            const refresh = await this.chatList.refreshChatList();
            if (refresh == null) {
                return;
            }
            if (refresh.select) {
                this.setBlockMode("blockLoad");
                await this.loadChat(refresh.select);
            }
            else if (refresh.unread && this.chatMeta != null) {
                this.setBlockMode("blockLoad");
                await this.updateChat(this.chatMeta);
            }
        });
    }
    startChatPoll() {
        setInterval(() => {
            if (document.hidden == false) {
                this.pollChatList();
            }
        }, this.chatPollInterval);
    }
    async onChatClick(chatID) {
        const chatMeta = this.chatList.getMeta(chatID);
        if (chatMeta == null) {
            return;
        }
        const previous = this.chatMeta;
        const reselect = previous == null || previous.chatID != chatID;
        if (reselect) {
            this.chatList.selectChat(chatID);
        }
        if (reselect && previous != null) {
            this.speechPlayer.stop();
            this.chatList.clearUnread(previous.chatID);
            await AgoraAPI.silence(previous.chatID);
        }
        this.chatList.clearUnread(chatID);
        if (reselect) {
            await this.runBlocked("blockLoad", () => this.loadChat(chatMeta));
        }
        else {
            await this.runBlocked("blockLoad", () => this.updateChat(chatMeta));
        }
    }
    async saveSettings(chatID, arkName, settings) {
        const result = await AgoraAPI.settings(chatID, arkName, false, settings);
        await this.refreshTitle();
        return result;
    }
    async refreshTitle() {
        const combined = await AgoraAPI.settings(this.chatMeta.chatID, null, true, null);
        this.combinedSettings = combined ?? {};
        this.chatInput.setArchived(this.combinedSettings.archived == true);
        this.chatTitle.innerText = combined.title ?? this.chatMeta.title;
        this.menuButton.innerText = `${combined.process?.arkName ?? ""} – ${combined.generate?.mainModel ?? ""}`;
        if (this.combinedSettings.tts?.enabled == false) {
            this.speechPlayer.stop();
        }
    }
    startSpeech(chatID) {
        if (this.combinedSettings.tts?.enabled == false) {
            return;
        }
        const url = `${AgoraAPI.baseURL}/api/listen?chatID=${encodeURIComponent(chatID)}&time=${Date.now()}`;
        this.speechPlayer.start(url);
    }
    async onEditLast() {
        const chatID = this.chatMeta.chatID;
        this.speechPlayer.stop();
        await this.runBlocked("blockAll", async () => {
            this.disabler.disableGroup(chatID);
            const message = await AgoraAPI.popMessage(chatID, "user", false);
            this.contextView.removeMessage("user", false);
            if (message && message.content != null) {
                this.chatInput.setMessage(message);
            }
            this.disabler.enableGroup(chatID);
        });
    }
    async onTryAgain() {
        const chatID = this.chatMeta.chatID;
        this.speechPlayer.prepare();
        this.speechPlayer.stop();
        await this.runBlocked("blockRun", async () => {
            this.disabler.disableGroup(chatID);
            await AgoraAPI.popMessage(chatID, "ark", true);
            this.contextView.removeMessage("ark", true);
            this.chatInput.begin();
            try {
                this.startSpeech(chatID);
                const onChunk = (chunk) => {
                    return this.contextView.appendChunk(chunk);
                };
                await AgoraAPI.send(chatID, null, null, null, onChunk);
                this.contextView.flush();
            }
            finally {
                this.chatInput.end();
                this.disabler.enableGroup(chatID);
            }
        });
    }
    async onCopyContent() {
        const contents = await AgoraAPI.transcript(this.chatMeta.chatID);
        await navigator.clipboard.writeText(contents);
    }
    async onSaveDocument() {
        const contents = await AgoraAPI.transcript(this.chatMeta.chatID);
        const document = await AgoraAPI.createDocument();
        if (document) {
            await AgoraAPI.writeDocumentFile(document.name, document.ext, contents);
            alert(`Saved as document ${document.name}.`);
        }
    }
    async onSend(content, images, documents) {
        const chatID = this.chatMeta.chatID;
        this.startSpeech(chatID);
        await this.runBlocked("blockRun", async () => {
            this.disabler.disableGroup(chatID);
            const onChunk = (chunk) => {
                return this.contextView.appendChunk(chunk);
            };
            await AgoraAPI.send(chatID, content, images, documents, onChunk);
            this.contextView.flush();
            this.disabler.enableGroup(chatID);
        });
    }
    async raiseHand() {
        await AgoraAPI.hand(this.chatMeta.chatID);
    }
    async abort() {
        this.speechPlayer.stop();
        await AgoraAPI.abort(this.chatMeta.chatID);
    }
}
new AgoraUI().init();
