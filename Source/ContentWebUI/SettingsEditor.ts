/// <reference path="../Common/FontUtil.ts" />

/// <reference path="./EditorUtil.ts" />
/// <reference path="../Common/TextEditor.ts" />

// a picture the editor shows in place of editable text
class EditorImage {
	public readonly src: string;

	public constructor(src: string) {
		this.src = src;
	}
}

interface EditorEntry {
	label: string;
	data: any;
	// a stable identity for the stored selection, falling back to the label
	id?: string;
	// entries with the same group share one collapsible list section
	group?: string;
}

// readItem returns a string for raw text editing, an EditorImage for a picture,
// anything else is textified and parsed back on update; the value updateItem
// returns is fed to the editor
interface EditorSource {
	// the entry to select first, from the page's URL scope
	select?: string;
	// lets a page follow the selection, to enable its own buttons
	onSelect?: (entries: EditorEntry[]) => void;
	getListData: () => Promise<EditorEntry[]>;
	readItem: (data: any) => Promise<string | EditorImage | any>;
	updateItem: (data: any, value: string | any) => Promise<string | EditorImage | any>;
}

class SettingsEditor {
	private source: EditorSource;
	private listContainer: HTMLElement;
	private editorInput: HTMLTextAreaElement;
	private saveButton: HTMLButtonElement;
	private imageElement: HTMLImageElement = null;
	private buttons: Map<EditorEntry, HTMLButtonElement> = new Map();
	private groups: Map<string, { container: HTMLElement, content: HTMLElement }> = new Map();
	private selection: EditorEntry[] = [];
	// the end a shift click reaches from
	private anchor: EditorEntry = null;
	private storageKey: string;
	private pendingSelect: string;
	// a later selection read wins over one still in flight
	private renderToken = 0;
	// an operation is in flight, so edits are held back
	private busy = false;
	// the editor holds changes that are not saved yet
	private dirty = false;
	// raw text is the only mode where the editor holds the value untouched
	private rawMode = false;

	public static initialize(source: EditorSource): SettingsEditor {
		const editor = new SettingsEditor(source);
		editor.init();
		return editor;
	}

	public constructor(source: EditorSource) {
		this.source = source;
	}

	public async init(): Promise<void> {
		FontUtil.applyEditor();
		this.listContainer = document.getElementById("editorList");
		this.editorInput = document.getElementById("editorInput") as HTMLTextAreaElement;
		this.saveButton = document.getElementById("saveButton") as HTMLButtonElement;
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

	// the list is rebuilt from scratch and the selection is let go
	public async reload(): Promise<void> {
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

	// the header offers the editor font, separate from the chat font
	private buildFontSelect(): void {
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

	private buildOption(value: string): HTMLOptionElement {
		const option = document.createElement("option");
		option.innerText = value;
		option.value = value;
		return option;
	}

	// the entries the user has picked; a page can drive extra actions off them
	public getSelection(): EditorEntry[] {
		return this.selection.slice();
	}

	// A generation streams into the editor: the field is cleared first, the
	// saved content replaces the stream once the work is done.
	public async stream(action: (onChunk: StringProcessor) => Promise<void>): Promise<void> {
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
		const onChunk: StringProcessor = (chunk: string) => {
			this.editorInput.value += chunk;
			this.editorInput.scrollTop = this.editorInput.scrollHeight;
			return chunk;
		};
		try {
			await action(onChunk);
		} finally {
			try {
				await this.reload();
			} finally {
				this.busy = false;
				this.editorInput.readOnly = false;
				document.body.classList.remove("blockRun");
			}
		}
	}

	// A page wraps its mutations here: short work only blocks the controls,
	// long work (inference) also dims them. The list and the selection are
	// always read back once the work is done.
	public async run(long: boolean, action: () => Promise<void>, guard = true): Promise<boolean> {
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
		} finally {
			this.busy = false;
			this.editorInput.readOnly = false;
			document.body.classList.remove("blockRun");
			document.body.classList.remove("blockAll");
		}
	}

	private createButton(entry: EditorEntry): void {
		const button = document.createElement("button");
		button.innerText = entry.label;
		button.addEventListener("click", event => this.toggleSelect(entry, event));
		this.groupContainer(entry.group).appendChild(button);
		this.buttons.set(entry, button);
	}

	// ungrouped entries sit directly in the list, grouped ones in their own section
	private groupContainer(name: string): HTMLElement {
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
		// groups start collapsed, only a stored open state opens them
		container.classList.toggle("collapsed", localStorage.getItem(this.groupKey(name)) != "0");
		this.groups.set(name, { container, content });
		return content;
	}

	private toggleGroup(name: string, container: HTMLElement): void {
		const collapsed = container.classList.contains("collapsed") == false;
		container.classList.toggle("collapsed", collapsed);
		localStorage.setItem(this.groupKey(name), collapsed ? "1" : "0");
	}

	private groupKey(name: string): string {
		return `collapsed.${this.storageKey}.${name}`;
	}

	// a plain click lands on one item, meta or control toggles one, and shift
	// reaches from the anchor to the clicked item
	private async toggleSelect(entry: EditorEntry, event: MouseEvent): Promise<void> {
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
		} else if (event.metaKey || event.ctrlKey) {
			const index = this.selection.indexOf(entry);
			if (index < 0) {
				this.selection.push(entry);
			} else {
				this.selection.splice(index, 1);
			}
			this.anchor = entry;
		} else {
			this.selection = [ entry ];
			this.anchor = entry;
		}
		this.saveSelection();
		this.paintSelection();
		this.renderSelection();
	}

	// the anchor stays put, so a second shift click reaches from the same end
	private selectRange(entry: EditorEntry): void {
		const order = Array.from(this.buttons.keys());
		const from = order.indexOf(this.anchor);
		const to = order.indexOf(entry);
		if (from < 0 || to < 0) {
			this.selection = [ entry ];
			this.anchor = entry;
			return;
		}
		const start = Math.min(from, to);
		const end = Math.max(from, to);
		this.selection = order.slice(start, end + 1);
	}

	// nudges the whole selection one slot, the list order itself stays
	private moveSelection(step: number): void {
		if (this.selection.length == 0) {
			return;
		}
		const order = Array.from(this.buttons.keys());
		const moved = [];
		for (const entry of this.selection) {
			const index = order.indexOf(entry) + step;
			if (index < 0 || index >= order.length) {
				// the selection cannot pass the ends, so it stays whole
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

	// the selection is kept per chat, per ark, and per page otherwise
	private readStorageKey(): string {
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

	private entryKey(entry: EditorEntry): string {
		return entry.id ?? entry.label;
	}

	private saveSelection(): void {
		if (this.storageKey) {
			const keys = this.selection.map(entry => this.entryKey(entry));
			localStorage.setItem(this.storageKey, JSON.stringify(keys));
		}
	}

	private restoreSelection(): void {
		if (this.pendingSelect) {
			const key = this.pendingSelect;
			this.pendingSelect = null;
			const entry = this.findEntry(key);
			if (entry) {
				this.selection = [ entry ];
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

	private findEntry(key: string): EditorEntry {
		for (const entry of Array.from(this.buttons.keys())) {
			if (this.entryKey(entry) == key) {
				return entry;
			}
		}
		return null;
	}

	// the title toggles the list, and a click off the list drops it on narrow
	private bindChrome(): void {
		const title = document.getElementById("titleButton");
		if (title) {
			title.addEventListener("click", event => {
				event.stopPropagation();
				document.body.classList.toggle("listHidden");
			});
		}
		document.addEventListener("click", event => this.onOutsideClick(event));
	}

	private onOutsideClick(event: MouseEvent): void {
		if (window.innerWidth > 850) {
			return;
		}
		if (document.body.classList.contains("listHidden")) {
			return;
		}
		const panel = this.listContainer.parentElement;
		if (panel.contains(event.target as Node)) {
			return;
		}
		document.body.classList.add("listHidden");
	}

	private paintSelection(): void {
		for (const entry of Array.from(this.buttons.keys())) {
			const button = this.buttons.get(entry);
			button.classList.toggle("selected", this.selection.indexOf(entry) >= 0);
		}
		if (this.source.onSelect) {
			this.source.onSelect(this.selection);
		}
	}

	// reads every selected item, then hands the values to the editor; an older
	// read is dropped when the selection moved on meanwhile
	private async renderSelection(): Promise<void> {
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

	private renderValues(values: any[]): void {
		if (values.length == 0) {
			this.rawMode = false;
			this.setEditor("", true);
			return;
		}
		if (this.hasImage(values)) {
			this.rawMode = false;
			if (values.length == 1) {
				this.showImage(values[0]);
			} else {
				this.setEditor(this.combineText(values), true);
			}
			return;
		}
		if (this.hasRawText(values)) {
			if (values.length > 1) {
				// many text items are only read together
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

	// every selected content one after another, for the read only view
	private combineText(values: any[]): string {
		const parts = [];
		for (const value of values) {
			if (value instanceof EditorImage) {
				parts.push("[image]");
			} else if (typeof value == "string") {
				parts.push(value);
			} else {
				parts.push(EditorUtil.textify(value));
			}
		}
		return parts.join("\n\n");
	}

	private hasImage(values: any[]): boolean {
		let result = false;
		for (const value of values) {
			if (value instanceof EditorImage) {
				result = true;
				break;
			}
		}
		return result;
	}

	private hasRawText(values: any[]): boolean {
		let result = false;
		for (const value of values) {
			if (typeof value == "string") {
				result = true;
				break;
			}
		}
		return result;
	}

	private setEditor(text: string, disabled: boolean): void {
		this.showEditor();
		this.editorInput.value = text;
		this.editorInput.disabled = disabled;
		this.saveButton.disabled = disabled;
		this.clearDirty();
	}

	// a picture is not text, so it takes the editor's place and cannot be saved
	private showImage(image: EditorImage): void {
		this.showImageElement();
		this.imageElement.src = image.src;
		this.editorInput.style.display = "none";
		this.saveButton.disabled = true;
		this.clearDirty();
	}

	private markDirty(): void {
		this.dirty = true;
		this.saveButton.classList.add("dirty");
	}

	private clearDirty(): void {
		this.dirty = false;
		this.saveButton.classList.remove("dirty");
	}

	// leaving the editor, or moving the selection, must not drop unsaved work
	private async confirmDiscard(): Promise<boolean> {
		if (this.dirty == false) {
			return true;
		}
		if (confirm("Save unsaved changes? Cancel discards them.")) {
			return await this.save();
		}
		this.clearDirty();
		return true;
	}

	private onBeforeUnload(event: BeforeUnloadEvent): void {
		if (this.dirty) {
			event.preventDefault();
			event.returnValue = "";
		}
	}

	private showEditor(): void {
		if (this.imageElement) {
			this.imageElement.style.display = "none";
		}
		this.editorInput.style.display = "";
	}

	private showImageElement(): void {
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

	private async save(): Promise<boolean> {
		if (this.busy || this.selection.length == 0) {
			return false;
		}
		const text = this.editorInput.value;
		let value: any;
		if (this.rawMode) {
			value = text;
		} else {
			try {
				value = EditorUtil.parseText(text);
			} catch (error) {
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

	// meta or control with s saves, the arrows walk the list selection
	private onKeyDown(event: KeyboardEvent): void {
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
			// the text area keeps its own arrow behaviour
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
