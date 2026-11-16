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
var EditorUtil;
(function (EditorUtil) {
    function textify(value) {
        return JSON.stringify(value, null, "\t");
    }
    EditorUtil.textify = textify;
    function parseText(text) {
        return JSON.parse(text);
    }
    EditorUtil.parseText = parseText;
    function intersect(values) {
        let result = values[0] ?? {};
        for (let i = 1; i < values.length; ++i) {
            result = intersectTwo(result, values[i]);
        }
        return result;
    }
    EditorUtil.intersect = intersect;
    function intersectTwo(a, b) {
        const result = {};
        for (const key in a) {
            if (key in b) {
                const childA = a[key];
                const childB = b[key];
                if (isObject(childA) && isObject(childB)) {
                    result[key] = intersectTwo(childA, childB);
                }
                else if (JSON.stringify(childA) == JSON.stringify(childB)) {
                    result[key] = childA;
                }
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
})(EditorUtil || (EditorUtil = {}));
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
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, -1)
                .join(" ")
                .concat("...");
        }
        return value
            .split(/\s+/)
            .filter(Boolean)
            .join(" ");
    }
    TextUtil.shortifyLineNicely = shortifyLineNicely;
    function shortifyTextNicely(value, countLimit, sizeLimit) {
        const lines = value
            .split(/\n+/)
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
            .replace(/\n\n\n+/g, "\n\n");
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
            .replace(/‑/g, "-");
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
class EditorImage {
    constructor(src) {
        this.src = src;
    }
}
class SettingsEditor {
    static initialize(source) {
        const editor = new SettingsEditor(source);
        editor.init();
        return editor;
    }
    constructor(source) {
        this.imageElement = null;
        this.buttons = new Map();
        this.groups = new Map();
        this.selection = [];
        this.anchor = null;
        this.renderToken = 0;
        this.busy = false;
        this.dirty = false;
        this.rawMode = false;
        this.source = source;
    }
    async init() {
        FontUtil.applyEditor();
        this.listContainer = document.getElementById("editorList");
        this.editorInput = document.getElementById("editorInput");
        this.saveButton = document.getElementById("saveButton");
        this.saveButton.addEventListener("click", () => this.save());
        this.editorInput.addEventListener("input", () => this.markDirty());
        TextEditor.bind(this.editorInput);
        document.addEventListener("keydown", event => this.onKeyDown(event));
        this.storageKey = this.readStorageKey();
        this.pendingSelect = this.source.select;
        this.bindChrome();
        this.buildFontSelect();
        window.addEventListener("beforeunload", event => this.onBeforeUnload(event));
        await this.reload();
    }
    async reload() {
        this.buttons.clear();
        this.groups.clear();
        this.selection = [];
        this.anchor = null;
        this.renderValues([]);
        const entries = await this.source.getListData() ?? [];
        this.listContainer.innerHTML = "";
        for (const entry of entries) {
            this.createButton(entry);
        }
        this.restoreSelection();
        this.paintSelection();
        await this.renderSelection();
    }
    buildFontSelect() {
        const panel = document.getElementById("titlePanel");
        if (panel == null) {
            return;
        }
        const select = document.createElement("select");
        select.id = "fontSelect";
        for (const family of FontUtil.getFamilies()) {
            select.appendChild(this.buildOption(family));
        }
        select.value = FontUtil.readEditor();
        select.addEventListener("change", () => FontUtil.writeEditor(select.value));
        panel.appendChild(select);
    }
    buildOption(value) {
        const option = document.createElement("option");
        option.innerText = value;
        option.value = value;
        return option;
    }
    getSelection() {
        return this.selection.slice();
    }
    async stream(action) {
        if (this.busy) {
            return;
        }
        if (this.dirty && await this.confirmDiscard() == false) {
            return;
        }
        this.busy = true;
        this.editorInput.readOnly = true;
        document.body.classList.add("blockRun");
        this.showEditor();
        this.editorInput.value = "";
        this.saveButton.disabled = true;
        this.clearDirty();
        const onChunk = (chunk) => {
            this.editorInput.value += chunk;
            this.editorInput.scrollTop = this.editorInput.scrollHeight;
            return chunk;
        };
        try {
            await action(onChunk);
        }
        finally {
            try {
                await this.reload();
            }
            finally {
                this.busy = false;
                this.editorInput.readOnly = false;
                document.body.classList.remove("blockRun");
            }
        }
    }
    async run(long, action, guard = true) {
        if (this.busy) {
            return false;
        }
        if (guard && this.dirty && await this.confirmDiscard() == false) {
            return false;
        }
        this.busy = true;
        this.editorInput.readOnly = true;
        document.body.classList.add(long ? "blockRun" : "blockAll");
        try {
            await action();
            await this.reload();
            return true;
        }
        finally {
            this.busy = false;
            this.editorInput.readOnly = false;
            document.body.classList.remove("blockRun");
            document.body.classList.remove("blockAll");
        }
    }
    createButton(entry) {
        const button = document.createElement("button");
        button.innerText = entry.label;
        button.addEventListener("click", event => this.toggleSelect(entry, event));
        this.groupContainer(entry.group).appendChild(button);
        this.buttons.set(entry, button);
    }
    groupContainer(name) {
        if (name == null) {
            return this.listContainer;
        }
        if (this.groups.has(name)) {
            return this.groups.get(name).content;
        }
        const container = document.createElement("div");
        container.className = "collapseGroup";
        this.listContainer.appendChild(container);
        const button = document.createElement("button");
        button.className = "groupButton";
        button.innerText = name;
        button.addEventListener("click", () => this.toggleGroup(name, container));
        container.appendChild(button);
        const content = document.createElement("div");
        content.className = "groupContent";
        container.appendChild(content);
        container.classList.toggle("collapsed", localStorage.getItem(this.groupKey(name)) != "0");
        this.groups.set(name, { container, content });
        return content;
    }
    toggleGroup(name, container) {
        const collapsed = container.classList.contains("collapsed") == false;
        container.classList.toggle("collapsed", collapsed);
        localStorage.setItem(this.groupKey(name), collapsed ? "1" : "0");
    }
    groupKey(name) {
        return `collapsed.${this.storageKey}.${name}`;
    }
    async toggleSelect(entry, event) {
        if (this.busy) {
            return;
        }
        if (this.selection.length == 1 && this.selection[0] == entry && event.shiftKey == false && event.metaKey == false && event.ctrlKey == false) {
            return;
        }
        const key = this.entryKey(entry);
        if (this.dirty && await this.confirmDiscard() == false) {
            return;
        }
        entry = this.findEntry(key) ?? entry;
        if (event.shiftKey) {
            this.selectRange(entry);
        }
        else if (event.metaKey || event.ctrlKey) {
            const index = this.selection.indexOf(entry);
            if (index < 0) {
                this.selection.push(entry);
            }
            else {
                this.selection.splice(index, 1);
            }
            this.anchor = entry;
        }
        else {
            this.selection = [entry];
            this.anchor = entry;
        }
        this.saveSelection();
        this.paintSelection();
        this.renderSelection();
    }
    selectRange(entry) {
        const order = Array.from(this.buttons.keys());
        const from = order.indexOf(this.anchor);
        const to = order.indexOf(entry);
        if (from < 0 || to < 0) {
            this.selection = [entry];
            this.anchor = entry;
            return;
        }
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        this.selection = order.slice(start, end + 1);
    }
    moveSelection(step) {
        if (this.selection.length == 0) {
            return;
        }
        const order = Array.from(this.buttons.keys());
        const moved = [];
        for (const entry of this.selection) {
            const index = order.indexOf(entry) + step;
            if (index < 0 || index >= order.length) {
                return;
            }
            moved.push(order[index]);
        }
        this.selection = moved;
        if (this.anchor) {
            const index = order.indexOf(this.anchor) + step;
            if (index >= 0 && index < order.length) {
                this.anchor = order[index];
            }
        }
        this.saveSelection();
        this.paintSelection();
        this.renderSelection();
    }
    readStorageKey() {
        const params = new URLSearchParams(location.search);
        const chat = params.get("chat");
        if (chat) {
            return `${location.pathname}?chat=${chat}`;
        }
        const ark = params.get("ark");
        if (ark) {
            return `${location.pathname}?ark=${ark}`;
        }
        return location.pathname;
    }
    entryKey(entry) {
        return entry.id ?? entry.label;
    }
    saveSelection() {
        if (this.storageKey) {
            const keys = this.selection.map(entry => this.entryKey(entry));
            localStorage.setItem(this.storageKey, JSON.stringify(keys));
        }
    }
    restoreSelection() {
        if (this.pendingSelect) {
            const key = this.pendingSelect;
            this.pendingSelect = null;
            const entry = this.findEntry(key);
            if (entry) {
                this.selection = [entry];
                this.anchor = entry;
                return;
            }
        }
        const stored = this.storageKey ? localStorage.getItem(this.storageKey) : null;
        if (stored == null) {
            return;
        }
        const keys = JSON.parse(stored) ?? [];
        this.selection = [];
        for (const entry of Array.from(this.buttons.keys())) {
            if (keys.indexOf(this.entryKey(entry)) >= 0) {
                this.selection.push(entry);
            }
        }
        this.anchor = this.selection[this.selection.length - 1] ?? null;
    }
    findEntry(key) {
        for (const entry of Array.from(this.buttons.keys())) {
            if (this.entryKey(entry) == key) {
                return entry;
            }
        }
        return null;
    }
    bindChrome() {
        const title = document.getElementById("titleButton");
        if (title) {
            title.addEventListener("click", event => {
                event.stopPropagation();
                document.body.classList.toggle("listHidden");
            });
        }
        document.addEventListener("click", event => this.onOutsideClick(event));
    }
    onOutsideClick(event) {
        if (window.innerWidth > 850) {
            return;
        }
        if (document.body.classList.contains("listHidden")) {
            return;
        }
        const panel = this.listContainer.parentElement;
        if (panel.contains(event.target)) {
            return;
        }
        document.body.classList.add("listHidden");
    }
    paintSelection() {
        for (const entry of Array.from(this.buttons.keys())) {
            const button = this.buttons.get(entry);
            button.classList.toggle("selected", this.selection.indexOf(entry) >= 0);
        }
        if (this.source.onSelect) {
            this.source.onSelect(this.selection);
        }
    }
    async renderSelection() {
        const token = ++this.renderToken;
        const values = [];
        for (const entry of this.selection) {
            values.push(await this.source.readItem(entry.data));
        }
        if (token != this.renderToken) {
            return;
        }
        this.renderValues(values);
    }
    renderValues(values) {
        if (values.length == 0) {
            this.rawMode = false;
            this.setEditor("", true);
            return;
        }
        if (this.hasImage(values)) {
            this.rawMode = false;
            if (values.length == 1) {
                this.showImage(values[0]);
            }
            else {
                this.setEditor(this.combineText(values), true);
            }
            return;
        }
        if (this.hasRawText(values)) {
            if (values.length > 1) {
                this.rawMode = false;
                this.setEditor(this.combineText(values), true);
                return;
            }
            this.rawMode = true;
            this.setEditor(values[0], false);
            return;
        }
        this.rawMode = false;
        const combined = values.length > 1 ? EditorUtil.intersect(values) : values[0];
        this.setEditor(EditorUtil.textify(combined), false);
    }
    combineText(values) {
        const parts = [];
        for (const value of values) {
            if (value instanceof EditorImage) {
                parts.push("[image]");
            }
            else if (typeof value == "string") {
                parts.push(value);
            }
            else {
                parts.push(EditorUtil.textify(value));
            }
        }
        return parts.join("\n\n");
    }
    hasImage(values) {
        let result = false;
        for (const value of values) {
            if (value instanceof EditorImage) {
                result = true;
                break;
            }
        }
        return result;
    }
    hasRawText(values) {
        let result = false;
        for (const value of values) {
            if (typeof value == "string") {
                result = true;
                break;
            }
        }
        return result;
    }
    setEditor(text, disabled) {
        this.showEditor();
        this.editorInput.value = text;
        this.editorInput.disabled = disabled;
        this.saveButton.disabled = disabled;
        this.clearDirty();
    }
    showImage(image) {
        this.showImageElement();
        this.imageElement.src = image.src;
        this.editorInput.style.display = "none";
        this.saveButton.disabled = true;
        this.clearDirty();
    }
    markDirty() {
        this.dirty = true;
        this.saveButton.classList.add("dirty");
    }
    clearDirty() {
        this.dirty = false;
        this.saveButton.classList.remove("dirty");
    }
    async confirmDiscard() {
        if (this.dirty == false) {
            return true;
        }
        if (confirm("Save unsaved changes? Cancel discards them.")) {
            return await this.save();
        }
        this.clearDirty();
        return true;
    }
    onBeforeUnload(event) {
        if (this.dirty) {
            event.preventDefault();
            event.returnValue = "";
        }
    }
    showEditor() {
        if (this.imageElement) {
            this.imageElement.style.display = "none";
        }
        this.editorInput.style.display = "";
    }
    showImageElement() {
        if (this.imageElement == null) {
            this.imageElement = document.createElement("img");
            this.imageElement.style.maxWidth = "100%";
            this.imageElement.style.maxHeight = "100%";
            this.imageElement.style.objectFit = "contain";
            this.imageElement.style.margin = "auto";
            this.editorInput.parentElement.appendChild(this.imageElement);
        }
        this.imageElement.style.display = "block";
    }
    async save() {
        if (this.busy || this.selection.length == 0) {
            return false;
        }
        const text = this.editorInput.value;
        let value;
        if (this.rawMode) {
            value = text;
        }
        else {
            try {
                value = EditorUtil.parseText(text);
            }
            catch (error) {
                alert(`invalid JSON, nothing saved\n${error.message}`);
                return false;
            }
        }
        return await this.run(false, async () => {
            for (const entry of this.selection) {
                await this.source.updateItem(entry.data, value);
            }
        }, false);
    }
    onKeyDown(event) {
        if (this.busy) {
            return;
        }
        if (event.metaKey || event.ctrlKey) {
            if (event.key.toLowerCase() == "s") {
                event.preventDefault();
                if (this.saveButton.disabled == false) {
                    this.save();
                }
                return;
            }
            if (event.target == this.editorInput) {
                return;
            }
            if (event.key == "ArrowUp") {
                event.preventDefault();
                this.moveSelection(-1);
                return;
            }
            if (event.key == "ArrowDown") {
                event.preventDefault();
                this.moveSelection(1);
            }
        }
    }
}
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
